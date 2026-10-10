import {
  ArrowRightIcon, BasketIcon, CheckCircleIcon, CheckIcon, CircleDashedIcon, ClipboardTextIcon, ClockIcon, PenNibIcon, ScalesIcon,
  TrashIcon, WarningOctagonIcon, type Icon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import { Loading } from "@/components/common"
import { vnParts } from "@/layouts/StoreBits"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { isoDay, time } from "@/lib/format"
import type { CountSession, Handover, WasteSlip } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWork } from "@/lib/work"
import { CARD, TONE, type StoreTone } from "@/pages/store/parts"

interface Step {
  n: number
  title: string
  when: string
  tone: StoreTone
  label: string
  done?: boolean
  urgent?: boolean
  action?: { to: string; label: string }
}

function hoursOf(iso: string) {
  const p = vnParts(new Date(iso))
  return Number(p.hh) + Number(p.mm) / 60
}

/** "Hôm nay 09:12" hoặc "08/10 22:31" */
function when(iso: string, today: string) {
  const p = vnParts(new Date(iso))
  return isoDay(new Date(iso)) === today ? `Hôm nay ${p.hh}:${p.mm}` : `${p.dd}/${p.mo} ${p.hh}:${p.mm}`
}

export function StoreToday() {
  const { me } = useAuth()
  const nav = useNavigate()
  const now = useServerNow(1000)
  const work = useWork()
  const locked = useQuery({ queryKey: ["counts", "locked"], queryFn: () => api.get<CountSession[]>("/counts?status=locked") })
  const handAll = useQuery({ queryKey: ["handovers"], queryFn: () => api.get<Handover[]>("/handovers") })
  const waste = useQuery({ queryKey: ["waste"], queryFn: () => api.get<WasteSlip[]>("/waste") })
  const { receipts, shifts } = work.queries
  if (receipts.isLoading || shifts.isLoading) return <Loading />

  const p = vnParts(now)
  const today = isoDay(now)
  const shift = me?.shift
  const countedA = (locked.data ?? []).some((s) => s.kind === "periodic" && s.location === "kho" && s.cutoff_at && isoDay(new Date(s.cutoff_at)) === today && s.lines.some((l) => l.group === "A"))
  const late = work.openShifts.filter((s) => new Date(s.planned_end).getTime() <= now.getTime())
  const openNotLate = work.openShifts.filter((s) => new Date(s.planned_end).getTime() > now.getTime())

  const steps: Step[] = [
    {
      n: 1, title: "Nhận hàng nhà cung cấp", when: "Khi hàng về",
      ...(work.receiptsToReceive ? { tone: "warn" as const, label: `${work.receiptsToReceive} phiếu chờ hàng về` } : { tone: "good" as const, label: "Không có phiếu chờ", done: true }),
      action: { to: "/van-hanh/nhap-hang", label: work.receiptsToReceive ? "Nhận hàng" : "Xem phiếu nhập" },
    },
    {
      n: 2, title: "Bàn giao đầu ca cho bếp", when: shift ? `Đầu ${shift.name.toLowerCase()}, ${time(shift.planned_start)}` : "Đầu mỗi ca",
      ...(!shift ? { tone: "neutral" as const, label: "Ngoài giờ ca" }
        : shift.status !== "planned" ? { tone: "good" as const, label: `Đã ký${shift.head_chef ? `, ${shift.head_chef}` : ""}`, done: true }
          : work.handoversToSign ? { tone: "warn" as const, label: "Chờ bếp trưởng cân lại và ký" }
            : { tone: "bad" as const, label: "Chưa bàn giao", urgent: true }),
      action: { to: "/van-hanh/kho", label: shift?.status === "open" ? "Bàn giao bổ sung" : work.handoversToSign ? "Mở phiếu chờ ký" : "Bàn giao đầu ca" },
    },
    {
      n: 3, title: "Cân trả cuối ca", when: shift ? `Sau ${time(shift.planned_end)}` : "Cuối mỗi ca",
      ...(late.length ? { tone: "bad" as const, label: `Đến giờ cân trả ${late.map((s) => s.name.toLowerCase()).join(", ")}`, urgent: true }
        : openNotLate.length ? { tone: "neutral" as const, label: `Ca đang mở, cân trả sau ${time(openNotLate[0].planned_end)}` }
          : shift?.status === "closed" ? { tone: "good" as const, label: "Đã cân trả", done: true }
            : { tone: "neutral" as const, label: "Chưa có ca mở" }),
      action: work.openShifts.length ? { to: "/van-hanh/can-tra", label: "Cân trả" } : undefined,
    },
    {
      n: 4, title: "Kiểm kê cuối ngày nhóm A", when: "Sau ca cuối",
      ...(work.openCounts ? { tone: "warn" as const, label: `${work.openCounts} phiên đang mở, chưa chốt` }
        : countedA ? { tone: "good" as const, label: "Hôm nay đã kiểm kê", done: true }
          : { tone: "neutral" as const, label: "Chưa kiểm kê hôm nay" }),
      action: { to: "/van-hanh/kiem-ke", label: work.openCounts ? "Tiếp tục phiên" : "Mở kiểm kê" },
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.find((s) => s.urgent) ?? steps.find((s) => !s.done && s.tone === "warn")

  // Nhịp ngày: từ giờ bắt đầu ca đầu tiên tới giờ kết thúc ca cuối cùng của hôm nay.
  const todayShifts = (shifts.data ?? []).filter((s) => s.business_date === today).sort((a, b) => a.planned_start.localeCompare(b.planned_start))
  const dayStart = todayShifts.length ? hoursOf(todayShifts[0].planned_start) : 6
  const dayEnd = todayShifts.length ? hoursOf(todayShifts[todayShifts.length - 1].planned_end) : 22
  const pctOf = (h: number) => Math.max(0, Math.min(100, ((h - dayStart) / (dayEnd - dayStart)) * 100))
  const nowPct = pctOf(p.hours)
  const marks = [
    { pct: 0, at: todayShifts[0] ? time(todayShifts[0].planned_start) : "06:00", text: `Bàn giao ${todayShifts[0]?.name.toLowerCase() ?? "ca sáng"}` },
    ...todayShifts.slice(1).map((s) => ({ pct: pctOf(hoursOf(s.planned_start)), at: time(s.planned_start), text: `Cân trả, giao ${s.name.toLowerCase()}` })),
    { pct: 100, at: todayShifts.length ? time(todayShifts[todayShifts.length - 1].planned_end) : "22:00", text: "Cân trả, kiểm kê" },
  ]

  // Hoạt động gần đây: ghép từ phiếu nhập, bàn giao, kiểm kê, hao hụt.
  const feed: { at: string; icon: Icon; text: string }[] = [
    ...(receipts.data ?? []).filter((r) => r.received_at).map((r) => ({ at: r.received_at!, icon: BasketIcon, text: `Nhận ${r.code} từ ${r.supplier}${r.status === "pending_approval" ? " (có lệch, chờ duyệt)" : ""}` })),
    ...(handAll.data ?? []).filter((h) => h.signed_at).map((h) => ({ at: h.signed_at!, icon: PenNibIcon, text: `${h.received_by} ký nhận bàn giao ${h.code}` })),
    ...(locked.data ?? []).filter((c) => c.cutoff_at).map((c) => ({ at: c.cutoff_at!, icon: c.kind === "shift_return" ? ScalesIcon : ClipboardTextIcon, text: `${c.counted_by ?? c.created_by} chốt ${c.kind_label.toLowerCase()} (${c.code})` })),
    ...(waste.data ?? []).filter((w) => w.location === "kho").map((w) => ({ at: w.at, icon: TrashIcon, text: `${w.created_by} ghi hao hụt ${w.ingredient}, ${w.type_label.toLowerCase()}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)

  const greeting = p.hours < 11 ? "Chào buổi sáng" : p.hours < 14 ? "Chào buổi trưa" : p.hours < 18 ? "Chào buổi chiều" : "Chào buổi tối"
  const firstName = me?.full_name.trim().split(/\s+/).pop() ?? ""

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="text-sm font-semibold tracking-[.02em] text-[#7c3410]">{p.weekday}, {p.dd}/{p.mo}/{p.yyyy}</div>
        <h1 className="mt-1 text-[44px] leading-[1.05] font-bold tracking-[-.035em]">{greeting}, {firstName}</h1>
        <p className="mt-2 max-w-[620px] text-base text-[#4f4a45]">Các việc của thủ kho trong ngày theo thứ tự. Việc gấp có nhãn đỏ; bấm nút trên thẻ để làm ngay.</p>
      </div>

      <div className="on-dark flex flex-wrap items-center gap-[22px] rounded-3xl bg-[#1c1917] px-[26px] py-[22px] text-[#fafaf9] shadow-[0_2px_4px_rgba(41,37,36,.06),0_24px_48px_-24px_rgba(41,37,36,.55)]">
        <div className="relative size-[84px] flex-none" role="img" aria-label={`${doneCount} trên 4 việc đã xong`}>
          <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90" aria-hidden>
            <circle cx="42" cy="42" r="34" fill="none" stroke="#3a3532" strokeWidth="7" />
            <circle cx="42" cy="42" r="34" fill="none" stroke="#eb9360" strokeWidth="7" strokeLinecap="round" strokeDasharray="213.6"
              strokeDashoffset={213.6 * (1 - doneCount / 4)} className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden>
            <span className="font-display text-[26px] font-bold tabular">{doneCount}/4</span>
            <span className="mt-[3px] text-[11px] font-semibold text-[#d6d3d1]">việc xong</span>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="text-sm font-semibold text-[#d6d3d1]">{next ? "Nên làm tiếp" : "Hôm nay"}</div>
          <div className="mt-0.5 font-display text-[28px] leading-[1.15] font-bold tracking-[-.025em] text-balance">{next ? next.title : "Đã xong các việc cần làm lúc này"}</div>
          <div className="mt-1 text-[15px] font-semibold text-[#f3c4a6]">{next ? next.label : "Các việc còn lại tới giờ mới làm được."}</div>
        </div>
        {next?.action && (
          <button type="button" onClick={() => nav(next.action!.to)}
            className="inline-flex h-14 flex-none items-center gap-2.5 rounded-[14px] bg-[#eb9360] px-6 text-[17px] font-bold whitespace-nowrap text-[#1c1917] shadow-[inset_0_-2px_0_rgba(28,25,23,.15)] transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-[#f19c6a] active:scale-[.97]">
            {next.action.label} <ArrowRightIcon className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className={cn(CARD, "px-[26px] pt-5 pb-[26px]")}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl tracking-[-.02em]">Nhịp ngày</h2>
          <span className="text-sm text-[#4f4a45]">{todayShifts.length || 2} ca, {marks[0].at} đến {marks[marks.length - 1].at}</span>
        </div>
        <div className="relative mx-2 mt-[46px] mb-[34px] h-2.5 rounded-full bg-[#efedeb]">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#f6c9ad] transition-[width] duration-1000 ease-linear" style={{ width: `${nowPct}%` }} />
          {marks.slice(1, -1).map((m) => <div key={m.at} aria-hidden className="absolute -top-1 h-[18px] w-0.5 bg-[#d6d3d1]" style={{ left: `${m.pct}%` }} />)}
          <div className="absolute top-1/2 transition-[left] duration-1000 ease-linear" style={{ left: `${nowPct}%` }}>
            <div aria-hidden className="st-ping absolute -top-[9px] -left-[9px] size-[18px] rounded-full bg-[#eb9360]" />
            <div aria-hidden className="absolute -top-[9px] -left-[9px] size-[18px] rounded-full bg-[#1c1917] shadow-[0_0_0_4px_#fdfdfc]" />
            <div className="absolute bottom-[18px] left-0 rounded-lg bg-[#1c1917] px-2.5 py-[3px] text-[13px] font-bold whitespace-nowrap text-[#fafaf9] tabular"
              style={{ transform: nowPct < 8 ? "translateX(-14px)" : nowPct > 92 ? "translateX(calc(-100% + 14px))" : "translateX(-50%)" }}>
              Bây giờ {p.hh}:{p.mm}
            </div>
          </div>
          {marks.map((m, i) => (
            <div key={m.at + i} className="absolute top-5 text-[13px] whitespace-nowrap text-[#4f4a45]"
              style={i === 0 ? { left: 0 } : i === marks.length - 1 ? { right: 0, textAlign: "right" } : { left: `${m.pct}%`, transform: "translateX(-50%)" }}>
              <b className="text-[#1c1917]">{m.at}</b> {m.text}
            </div>
          ))}
        </div>
      </div>

      <ol className="flex flex-col gap-px overflow-hidden rounded-[22px] bg-[#efedeb] shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-10px_rgba(41,37,36,.14),0_0_0_1px_rgba(28,25,23,.05)]">
        {steps.map((s) => {
          const PI = s.done ? CheckCircleIcon : s.urgent ? WarningOctagonIcon : s.tone === "warn" ? ClockIcon : CircleDashedIcon
          return (
            <li key={s.n} className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors duration-500", s.urgent ? "bg-[#fdf2f1]" : "bg-[#fdfdfc]")}>
              <span className={cn("flex size-10 flex-none items-center justify-center rounded-full font-display text-[17px] font-bold", s.done ? "bg-[#eb9360]" : "bg-[#e7e4e1]")}>
                {s.done ? <CheckIcon className="size-5" weight="bold" aria-label="Xong" /> : s.n}
              </span>
              <div className="min-w-0 flex-[1_1_220px] leading-[1.3]">
                <div className="font-display text-lg font-bold tracking-[-.015em]">{s.title}</div>
                <div className="text-sm text-[#4f4a45]">{s.when}</div>
              </div>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-sm font-semibold", TONE[s.tone])}><PI className="size-4" aria-hidden />{s.label}</span>
              {s.action && (
                <button type="button" onClick={() => nav(s.action!.to)}
                  className={cn("inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] px-4 text-[15px] font-bold whitespace-nowrap transition-transform duration-200 hover:-translate-y-px active:scale-[.97]",
                    s.done ? "border-[#d6d3d1] bg-transparent" : "border-[#eb9360] bg-[#eb9360]")}>
                  {s.action.label} <ArrowRightIcon className="size-[17px]" aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <div className={cn(CARD, "px-6 py-5")}>
        <h2 className="mt-0 mb-2 text-xl tracking-[-.02em]">Hoạt động gần đây</h2>
        {feed.length ? (
          <ul className="flex flex-col">
            {feed.map((f, i) => (
              <li key={i} className="grid grid-cols-[120px_36px_minmax(0,1fr)] items-center gap-2.5 border-t border-[#efedeb] py-2.5">
                <span className="text-[13px] font-semibold text-[#4f4a45] tabular">{when(f.at, today)}</span>
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#fbeae0] text-[#7c3410]"><f.icon className="size-[18px]" aria-hidden /></span>
                <span className="text-[15px]">{f.text}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[#4f4a45]">Chưa có hoạt động nào.</p>}
      </div>
    </div>
  )
}

