import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CheckCircle2, CircleDashed, ClipboardCheck, ListTodo, Scale, ShoppingBasket, Truck, AlertOctagon, Clock } from "@/components/icons"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Loading, PageHeader, StatusPill, type Tone } from "@/components/common"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { isoDay, time } from "@/lib/format"
import type { CountSession } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWork } from "@/lib/work"

interface Step {
  n: number
  icon: typeof Truck
  title: string
  when: string
  state: { tone: Tone; label: string; done?: boolean; urgent?: boolean }
  detail: ReactNode
  action?: { to: string; label: string }
}

/** Màn "Hôm nay" của thủ kho: các việc trong ngày theo đúng thứ tự, mỗi việc một trạng thái và một nút. */
export function TodayPage() {
  const { me } = useAuth()
  const now = useServerNow(30_000)
  const work = useWork()
  const locked = useQuery({ queryKey: ["counts", "locked"], queryFn: () => api.get<CountSession[]>("/counts?status=locked") })
  const { receipts, shifts, handovers } = work.queries
  if (receipts.isLoading || shifts.isLoading || handovers.isLoading) return <Loading />

  const shift = me?.shift
  const today = isoDay(now)
  const countedA = (locked.data ?? []).some((s) =>
    s.kind === "periodic" && s.location === "kho" && s.cutoff_at && isoDay(new Date(s.cutoff_at)) === today && s.lines.some((l) => l.group === "A"))
  const late = work.openShifts.filter((s) => new Date(s.planned_end).getTime() <= now.getTime())
  const openNotLate = work.openShifts.filter((s) => new Date(s.planned_end).getTime() > now.getTime())

  const steps: Step[] = [
    {
      n: 1, icon: ShoppingBasket, title: "Nhận hàng nhà cung cấp", when: "khi hàng về",
      state: work.receiptsToReceive
        ? { tone: "warn", label: `${work.receiptsToReceive} phiếu chờ hàng về` }
        : { tone: "good", label: "Không có phiếu chờ", done: true },
      detail: "Cân / đếm số thực nhận. Lệch số đặt phải ghi lý do; tồn Kho tăng ngay khi xác nhận.",
      action: { to: "/van-hanh/nhap-hang", label: work.receiptsToReceive ? "Nhận hàng" : "Tạo phiếu nhập" },
    },
    {
      n: 2, icon: Truck, title: "Bàn giao đầu ca cho bếp", when: shift ? `đầu ${shift.name.toLowerCase()}, ${time(shift.planned_start)}` : "đầu mỗi ca",
      state: !shift
        ? { tone: "neutral", label: "Ngoài giờ ca" }
        : shift.status === "open" || shift.status === "closed"
          ? { tone: "good", label: `Đã ký nhận${shift.head_chef ? ` · ${shift.head_chef}` : ""}`, done: true }
          : work.handoversToSign
            ? { tone: "warn", label: "Chờ bếp trưởng cân lại và ký" }
            : { tone: "bad", label: "Chưa bàn giao", urgent: true },
      detail: "Cân xuất nhóm A, đưa máy cho bếp trưởng cân lại và ký PIN. Giữa ca bếp báo hết thì làm bàn giao bổ sung.",
      action: { to: "/van-hanh/kho", label: shift?.status === "open" ? "Bàn giao bổ sung" : work.handoversToSign ? "Mở phiếu chờ ký" : "Bàn giao đầu ca" },
    },
    {
      n: 3, icon: Scale, title: "Cân trả cuối ca", when: shift ? `sau ${time(shift.planned_end)}` : "cuối mỗi ca",
      state: late.length
        ? { tone: "bad", label: `Đến giờ cân trả: ${late.map((s) => s.name).join(", ")}`, urgent: true }
        : openNotLate.length
          ? { tone: "neutral", label: `Ca đang mở, cân trả sau ${time(openNotLate[0].planned_end)}` }
          : shift?.status === "closed"
            ? { tone: "good", label: "Đã cân trả", done: true }
            : { tone: "neutral", label: "Chưa có ca mở" },
      detail: "Cân mù toàn bộ nhóm A bếp trả lại (nhập 0 nếu đã hết). Chốt xong thì ca đóng.",
      action: work.openShifts.length ? { to: "/van-hanh/can-tra", label: "Cân trả" } : undefined,
    },
    {
      n: 4, icon: ClipboardCheck, title: "Kiểm kê cuối ngày nhóm A", when: "sau ca cuối",
      state: work.openCounts
        ? { tone: "warn", label: `${work.openCounts} phiên đang mở, chưa chốt` }
        : countedA
          ? { tone: "good", label: "Hôm nay đã kiểm kê", done: true }
          : { tone: "neutral", label: "Chưa kiểm kê hôm nay" },
      detail: "Đếm mù nhóm A tại Kho. Nhóm C kiểm kê theo định kỳ.",
      action: { to: "/van-hanh/kiem-ke", label: work.openCounts ? "Tiếp tục phiên" : "Mở kiểm kê" },
    },
  ]
  const nextStep = steps.find((s) => s.state.urgent) ?? steps.find((s) => !s.state.done && s.state.tone === "warn")

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Việc hôm nay" icon={ListTodo}
        description="Các việc của thủ kho trong ngày theo thứ tự. Việc gấp có nhãn đỏ; bấm nút bên phải để làm ngay." />
      {nextStep && (
        <div className="on-dark mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-ink px-5 py-4 text-ink-foreground shadow-lift">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
            <AlertOctagon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-stone-300">Nên làm tiếp</div>
            <div className="font-display text-xl font-bold">{nextStep.title}: {nextStep.state.label}</div>
          </div>
          {nextStep.action && <Button asChild size="xl"><Link to={nextStep.action.to}>{nextStep.action.label} <ArrowRight /></Link></Button>}
        </div>
      )}
      {/* Dòng thời gian: đường dọc nối các bước, chỉ lộ ra ở khe giữa các thẻ */}
      <ol className="relative space-y-4 before:absolute before:top-8 before:bottom-8 before:left-[2.625rem] before:w-0.5 before:bg-input/40">
        {steps.map((s) => {
          const StateIcon = s.state.done ? CheckCircle2 : s.state.urgent ? AlertOctagon : s.state.tone === "warn" ? Clock : CircleDashed
          return (
            <li key={s.n} className={cn("relative flex flex-wrap items-center gap-4 surface p-5", s.state.urgent && "border-l-4 border-l-destructive")}>
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold",
                s.state.done ? "bg-primary text-primary-foreground" : "bg-secondary text-ink")}>
                {s.state.done ? <CheckCircle2 className="size-6" aria-label="Xong" /> : s.n}
              </span>
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <s.icon className="size-5 text-muted-foreground" aria-hidden />
                  <h2 className="text-xl font-bold">{s.title}</h2>
                  <span className="text-sm text-muted-foreground">({s.when})</span>
                </div>
                <div className="mt-1.5">
                  <StatusPill tone={s.state.tone} className="text-sm"><StateIcon className="size-4" aria-hidden /> {s.state.label}</StatusPill>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.detail}</p>
              </div>
              {s.action && (
                <Button asChild size="xl" variant={s.state.done ? "outline" : "default"} className="shrink-0">
                  <Link to={s.action.to}>{s.action.label} <ArrowRight /></Link>
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
