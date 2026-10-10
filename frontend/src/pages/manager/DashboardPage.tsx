import { useQuery } from "@tanstack/react-query"
import { AlarmClock, ArrowRight, Bell, CheckCircle2, CircleDashed, ClipboardCheck, FileSearch, LayoutDashboard, Lock, Scale, ShieldAlert, ShoppingBasket, Trash2, Truck, XCircle } from "@/components/icons"
import { useState } from "react"
import { Link } from "react-router-dom"

import { ChartCard, DivergeLegend, DivergingColumns, HBars, Meter, StatTile } from "@/components/charts"
import { Loading, PageHeader, Section, SeverityIcon, StatusPill, TONE_CLS, type Tone } from "@/components/common"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, qs } from "@/lib/api"
import { dateOnly, dateTime, money, moneyShort, qty, time } from "@/lib/format"
import type { Alert, MenuItem } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Dashboard {
  day: string
  now: string
  unexplained_value: number
  shortage_value: number
  counts_today: number
  top_ingredients: { ingredient_id: number; ingredient: string; unit: string; value: number; qty: number }[]
  investigations: { open: number; due_soon: number; overdue: number; open_value: number }
  shifts: {
    id: number; name: string; status: string; planned_start: string; planned_end: string; head_chef: string | null
    handover_signed: boolean; handover_pending: number; returned: boolean; late_return: boolean; variance_value: number; sod_violation: boolean
  }[]
  a_counted_today: boolean
  sod_shifts: { id: number; name: string; business_date: string; notes: string }[]
  waste_on_time: number
  waste_late: number
  locked_dishes: MenuItem[]
  pending_receipts: number
  pending_waste: number
  alerts: Alert[]
  trend: {
    days: number
    ingredients: string[]
    series: Record<string, number | string>[]
    by_shift: { shift: string; value: number }[]
    by_chef: { chef: string; value: number; periods: number }[]
  }
}

function Check({ ok, pending, label }: { ok: boolean; pending?: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : pending ? CircleDashed : XCircle
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", ok ? "text-good-ink" : pending ? "text-muted-foreground" : "text-critical-ink")}>
      <Icon className="size-4" /> {label}
    </span>
  )
}

interface Task { key: string; tone: Tone; icon: typeof Bell; title: string; hint?: string; to: string }

/** Việc cần quản lý xử lý, xếp theo mức gấp: đỏ trước, vàng sau, thông tin cuối. */
function tasksOf(d: Dashboard): Task[] {
  const t: Task[] = []
  const critical = d.alerts.filter((a) => a.severity === "critical").length
  if (d.investigations.overdue) t.push({ key: "inv-over", tone: "bad", icon: AlarmClock, title: `${d.investigations.overdue} phiếu điều tra quá hạn`, hint: "Kết luận và tất toán", to: "/quan-ly/dieu-tra" })
  for (const s of d.shifts.filter((x) => x.late_return)) t.push({ key: `late-${s.id}`, tone: "bad", icon: Scale, title: `${s.name} quá giờ chưa cân trả`, hint: s.head_chef ? `Bếp trưởng ${s.head_chef}` : undefined, to: "/quan-ly/ca" })
  if (critical) t.push({ key: "alerts", tone: "bad", icon: Bell, title: `${critical} cảnh báo nghiêm trọng`, hint: "Xem và đánh dấu đã xử lý", to: "/quan-ly/canh-bao" })
  if (d.investigations.due_soon) t.push({ key: "inv-soon", tone: "warn", icon: FileSearch, title: `${d.investigations.due_soon} phiếu điều tra sắp hạn`, to: "/quan-ly/dieu-tra" })
  for (const s of d.shifts.filter((x) => x.handover_pending && !x.handover_signed)) t.push({ key: `ho-${s.id}`, tone: "warn", icon: Truck, title: `${s.name}: bàn giao chờ bếp trưởng ký`, to: "/quan-ly/ca" })
  if (d.pending_receipts) t.push({ key: "rcp", tone: "warn", icon: ShoppingBasket, title: `${d.pending_receipts} phiếu nhập chờ duyệt`, hint: "Lệch số đặt / đơn giá", to: "/quan-ly/phieu-nhap" })
  if (d.pending_waste) t.push({ key: "waste", tone: "warn", icon: Trash2, title: `${d.pending_waste} phiếu hao hụt chờ duyệt`, to: "/quan-ly/hao-hut" })
  if (!d.a_counted_today) t.push({ key: "count", tone: "info", icon: ClipboardCheck, title: "Nhóm A tại Kho chưa kiểm kê hôm nay", to: "/quan-ly/kiem-ke" })
  if (d.locked_dishes.length) t.push({ key: "locked", tone: "info", icon: Lock, title: `${d.locked_dishes.length} món đang khóa bán`, hint: d.locked_dishes.map((m) => m.name).join(", "), to: "/quan-ly/mon" })
  return t
}

function TaskStrip({ d }: { d: Dashboard }) {
  const tasks = tasksOf(d)
  if (!tasks.length) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-status-good/40 bg-status-good/10 px-4 py-3 text-sm font-medium text-good-ink">
        <CheckCircle2 className="size-5" aria-hidden /> Không có việc tồn đọng cần xử lý
      </div>
    )
  }
  return (
    <section aria-label="Cần xử lý ngay">
      <h2 className="mb-3 text-xl font-bold">Cần xử lý ngay <span className="font-sans text-base font-semibold text-muted-foreground">({tasks.length})</span></h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tasks.map((t) => (
          <Link key={t.key} to={t.to}
            className={cn("group flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_2px_rgb(28_25_23/0.05)] transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-lift",
              t.tone === "bad" && "border-l-4 border-l-destructive", t.tone === "warn" && "border-l-4 border-l-status-warning")}>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border", TONE_CLS[t.tone])}>
              <t.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug">{t.title}</span>
              {t.hint && <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>}
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  )
}

export function DashboardPage() {
  const [day, setDay] = useState("")
  const q = useQuery({ queryKey: ["dashboard", day], queryFn: () => api.get<Dashboard>(`/dashboard${qs({ day })}`), refetchInterval: 60_000 })
  const d = q.data
  if (q.isLoading || !d) return <Loading />
  const wasteTotal = Number(d.waste_on_time) + Number(d.waste_late)
  const series = d.trend.series.map((r) => ({ key: String(r.day), value: Number(r.total) }))

  return (
    <div className={cn("space-y-5", q.isFetching && "opacity-90")}>
      <PageHeader
        title="Tổng quan"
        icon={LayoutDashboard}
        description="Việc cần xử lý, chênh lệch giữa lượng đáng lẽ phải dùng và thực tế đã dùng, ai chịu trách nhiệm, quy trình có được tuân thủ."
        actions={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ngày</span>
            <Input type="date" className="h-10 w-44" aria-label="Chọn ngày" value={day || d.day} onChange={(e) => setDay(e.target.value)} />
          </div>
        }
      />

      <TaskStrip d={d} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        {/* Ô chính của bảng số liệu: nền than, số paprika (7,4 : 1) */}
        <div className="on-dark rounded-2xl bg-ink p-6 text-ink-foreground shadow-lift sm:col-span-2 xl:col-span-1">
          <div className="text-sm text-stone-300">Chênh lệch chưa giải thích ngày {dateOnly(d.day)}</div>
          <div className="mt-2 font-display text-6xl leading-none font-bold tabular text-primary">
            {moneyShort(d.unexplained_value)}
          </div>
          <div className="mt-3 text-sm text-stone-300">
            {d.counts_today} lần kiểm kê hoặc cân trả, phần thiếu {money(d.shortage_value)}
          </div>
        </div>
        <Link to="/quan-ly/dieu-tra" className="block">
          <StatTile
            label="Phiếu điều tra đang mở"
            value={d.investigations.open}
            tone={d.investigations.overdue ? "bad" : undefined}
            hint={<>{d.investigations.overdue} quá hạn, {d.investigations.due_soon} sắp hạn, {moneyShort(d.investigations.open_value)}</>}
          />
        </Link>
        <div className="rounded-2xl bg-card p-5 shadow-soft ring-1 ring-stone-900/5">
          <Meter value={Number(d.waste_on_time)} total={wasteTotal} label="Hao hụt ghi đúng lúc (30 ngày)" />
          <div className="mt-3 text-sm text-muted-foreground">
            Đúng lúc {moneyShort(d.waste_on_time)}, ghi muộn qua điều tra {moneyShort(d.waste_late)}
          </div>
        </div>
        <Link to="/quan-ly/canh-bao" className="block">
          <StatTile
            label="Cảnh báo đang mở"
            value={d.alerts.length}
            tone={d.alerts.some((a) => a.severity === "critical") ? "bad" : undefined}
            hint={<>{d.alerts.filter((a) => a.severity === "critical").length} nghiêm trọng, {d.alerts.filter((a) => a.severity === "warn").length} cảnh báo</>}
          />
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Tuân thủ quy trình hôm nay" actions={<Check ok={d.a_counted_today} label={d.a_counted_today ? "Nhóm A tại Kho đã kiểm kê" : "Nhóm A tại Kho chưa kiểm kê"} />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ca</TableHead>
                <TableHead>Bàn giao đầu ca</TableHead>
                <TableHead>Cân trả</TableHead>
                <TableHead>Bếp trưởng ca</TableHead>
                <TableHead className="text-right">Chênh lệch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name} <span className="text-muted-foreground">{time(s.planned_start)}-{time(s.planned_end)}</span></TableCell>
                  <TableCell>
                    <Check ok={s.handover_signed} pending={s.status === "planned" && !s.handover_pending}
                      label={s.handover_signed ? "Đã ký nhận" : s.handover_pending ? "Chờ ký" : "Chưa bàn giao"} />
                  </TableCell>
                  <TableCell>
                    {s.late_return ? <Check ok={false} label="Quá giờ, chưa cân trả" /> :
                      <Check ok={s.returned} pending={!s.returned} label={s.returned ? "Đã cân trả" : "Chưa đến giờ"} />}
                  </TableCell>
                  <TableCell>
                    {s.head_chef ?? "-"} {s.sod_violation && <StatusPill tone="bad"><ShieldAlert className="size-3.5" />Kiêm nhiệm</StatusPill>}
                  </TableCell>
                  <TableCell className="text-right tabular">{s.returned ? money(s.variance_value) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {d.sod_shifts.length > 0 && (
            <div className="mt-3 rounded-lg border border-status-critical/30 bg-status-critical/5 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-critical-ink"><ShieldAlert className="size-4" /> Ca không đảm bảo phân tách nhiệm vụ (7 ngày): nên tăng kiểm kê đột xuất</div>
              <ul className="space-y-0.5">
                {d.sod_shifts.map((s) => <li key={s.id}>{s.name} {dateOnly(s.business_date)}: {s.notes}</li>)}
              </ul>
            </div>
          )}
        </Section>

        <ChartCard
          title="Nguyên liệu lệch nhiều nhất theo tiền"
          subtitle={`Ngày ${dateOnly(d.day)}`}
          legend={<DivergeLegend />}
          table={
            <Table>
              <TableHeader><TableRow><TableHead>Nguyên liệu</TableHead><TableHead className="text-right">Lượng</TableHead><TableHead className="text-right">Giá trị</TableHead></TableRow></TableHeader>
              <TableBody>{d.top_ingredients.map((r) => (
                <TableRow key={r.ingredient_id}><TableCell>{r.ingredient}</TableCell><TableCell className="text-right tabular">{qty(r.qty, r.unit)}</TableCell><TableCell className="text-right tabular">{money(r.value)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          }
        >
          {d.top_ingredients.length ? (
            <HBars rows={d.top_ingredients.map((r) => ({ key: String(r.ingredient_id), label: r.ingredient, sub: qty(r.qty, r.unit), value: Number(r.value) }))} format={moneyShort} />
          ) : <p className="py-6 text-center text-sm text-muted-foreground">Chưa có kiểm kê / cân trả nào trong ngày</p>}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Xu hướng chênh lệch 30 ngày"
          subtitle="Giá trị chênh lệch chưa giải thích mỗi ngày (tất cả nguyên liệu, mọi vị trí)"
          legend={<DivergeLegend />}
          table={
            <Table>
              <TableHeader><TableRow><TableHead>Ngày</TableHead>{d.trend.ingredients.map((n) => <TableHead key={n} className="text-right">{n}</TableHead>)}<TableHead className="text-right">Tổng</TableHead></TableRow></TableHeader>
              <TableBody>{d.trend.series.map((r) => (
                <TableRow key={String(r.day)}><TableCell>{dateOnly(String(r.day))}</TableCell>
                  {d.trend.ingredients.map((n) => <TableCell key={n} className="text-right tabular">{money(r[n] as number)}</TableCell>)}
                  <TableCell className="text-right tabular">{money(r.total as number)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          }
        >
          <DivergingColumns data={series} format={moneyShort} label={(k) => `${k.slice(8, 10)}/${k.slice(5, 7)}`} />
        </ChartCard>
        <ChartCard
          title="Chênh lệch theo bếp trưởng ca (30 ngày)"
          subtitle="Tổng giá trị tại Bếp gắn với người đã ký nhận"
          legend={<DivergeLegend />}
          table={
            <Table>
              <TableHeader><TableRow><TableHead>Bếp trưởng</TableHead><TableHead className="text-right">Số kỳ</TableHead><TableHead className="text-right">Giá trị</TableHead></TableRow></TableHeader>
              <TableBody>{d.trend.by_chef.map((r) => <TableRow key={r.chef}><TableCell>{r.chef}</TableCell><TableCell className="text-right tabular">{r.periods}</TableCell><TableCell className="text-right tabular">{money(r.value)}</TableCell></TableRow>)}
                {d.trend.by_shift.map((r) => <TableRow key={r.shift}><TableCell>{r.shift} (theo ca)</TableCell><TableCell /><TableCell className="text-right tabular">{money(r.value)}</TableCell></TableRow>)}</TableBody>
            </Table>
          }
        >
          <HBars rows={d.trend.by_chef.map((r) => ({ key: r.chef, label: r.chef, sub: `${r.periods} kỳ đo`, value: r.value }))} format={moneyShort} />
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Theo ca</div>
            <HBars rows={d.trend.by_shift.map((r) => ({ key: r.shift, label: r.shift, value: r.value }))} format={moneyShort} />
          </div>
        </ChartCard>
      </div>

      <Section title={`Cảnh báo đang mở (${d.alerts.length})`} actions={<Link to="/quan-ly/canh-bao" className="text-sm text-paprika-ink underline underline-offset-4 hover:decoration-2">Xem tất cả</Link>}>
        <ul className="divide-y">
          {d.alerts.slice(0, 10).map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2.5">
              <SeverityIcon severity={a.severity} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {a.ref_type === "investigation" && a.ref_id ? <Link className="underline underline-offset-4 hover:decoration-2" to={`/quan-ly/dieu-tra/${a.ref_id}`}>{a.title}</Link> : a.title}
                </div>
                {a.body && <div className="text-sm text-muted-foreground">{a.body}</div>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{dateTime(a.at)}</span>
            </li>
          ))}
          {!d.alerts.length && <li className="py-4 text-sm text-muted-foreground">Không có cảnh báo</li>}
        </ul>
      </Section>
    </div>
  )
}
