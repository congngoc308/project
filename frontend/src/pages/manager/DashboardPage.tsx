import { useQuery } from "@tanstack/react-query"
import {
  AlarmClock, ArrowRight, BellRing, CheckCircle2, CircleDashed, ClipboardCheck, FileSearch, Lock, Scale, ShieldAlert, ShoppingBasket, Trash2, TrendUp, Truck, XCircle, type IconType,
} from "@/components/icons"
import { useState } from "react"
import { Link } from "react-router-dom"

import { A, BlockTitle, CARD, CARD_HOVER, Initials, PageHead, ViewToggle, delay, useCountUp } from "@/layouts/AdminBits"
import { api, qs } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { dateOnly, money, moneyShort, num, qty, time } from "@/lib/format"
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

type Tone = "bad" | "warn" | "info"
const TONE: Record<Tone, { ibg: string; ic: string; pill: string }> = {
  bad: { ibg: A.badBg, ic: A.bad, pill: "Gấp" },
  warn: { ibg: A.warnBg, ic: A.warn, pill: "Chờ xử lý" },
  info: { ibg: A.line2, ic: A.sub, pill: "Lưu ý" },
}
interface Task { key: string; tone: Tone; icon: IconType; title: string; hint?: string; cta: string; to: string }

/** Việc cần quản lý xử lý, xếp theo mức gấp: đỏ trước, vàng sau, thông tin cuối. */
function tasksOf(d: Dashboard): Task[] {
  const t: Task[] = []
  const critical = d.alerts.filter((a) => a.severity === "critical").length
  if (d.investigations.overdue) t.push({ key: "inv-over", tone: "bad", icon: AlarmClock, title: `${d.investigations.overdue} phiếu điều tra quá hạn`, hint: "Kết luận và tất toán", cta: "Mở phiếu điều tra", to: "/quan-ly/dieu-tra" })
  for (const s of d.shifts.filter((x) => x.late_return)) t.push({ key: `late-${s.id}`, tone: "bad", icon: Scale, title: `${s.name} quá giờ chưa cân trả`, hint: s.head_chef ? `Bếp trưởng ${s.head_chef}` : undefined, cta: "Xem ca và bàn giao", to: "/quan-ly/ca" })
  if (critical) t.push({ key: "alerts", tone: "bad", icon: BellRing, title: `${critical} cảnh báo nghiêm trọng`, hint: "Xem và đánh dấu đã xử lý", cta: "Xem cảnh báo", to: "/quan-ly/canh-bao?muc=critical" })
  if (d.investigations.due_soon) t.push({ key: "inv-soon", tone: "warn", icon: FileSearch, title: `${d.investigations.due_soon} phiếu điều tra sắp hạn`, hint: "Sắp đến hạn kết luận", cta: "Mở phiếu điều tra", to: "/quan-ly/dieu-tra" })
  for (const s of d.shifts.filter((x) => x.handover_pending && !x.handover_signed)) t.push({ key: `ho-${s.id}`, tone: "warn", icon: Truck, title: `${s.name}: bàn giao chờ bếp trưởng ký`, hint: s.head_chef ? `Bếp trưởng ${s.head_chef}` : undefined, cta: "Xem ca và bàn giao", to: "/quan-ly/ca" })
  if (d.pending_receipts) t.push({ key: "rcp", tone: "warn", icon: ShoppingBasket, title: `${d.pending_receipts} phiếu nhập chờ duyệt`, hint: "Lệch số đặt hoặc đơn giá", cta: "Duyệt phiếu nhập", to: "/quan-ly/phieu-nhap" })
  if (d.pending_waste) t.push({ key: "waste", tone: "warn", icon: Trash2, title: `${d.pending_waste} phiếu hao hụt chờ duyệt`, hint: "Vượt hạn mức, chờ quản lý", cta: "Duyệt hao hụt", to: "/quan-ly/hao-hut" })
  if (!d.a_counted_today) t.push({ key: "count", tone: "info", icon: ClipboardCheck, title: "Nhóm A tại Kho chưa kiểm kê hôm nay", hint: "Kiểm kê định kỳ cuối ngày", cta: "Mở kiểm kê", to: "/quan-ly/kiem-ke" })
  if (d.locked_dishes.length) t.push({ key: "locked", tone: "info", icon: Lock, title: `${d.locked_dishes.length} món đang khóa bán`, hint: d.locked_dishes.map((m) => m.name).join(", "), cta: "Xem món", to: "/quan-ly/mon" })
  return t
}

const DAY_NAME = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]
const mins = (iso: string) => { const [h, m] = time(iso).split(":").map(Number); return h * 60 + m }
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

export function DashboardPage() {
  const [day, setDay] = useState("")
  const q = useQuery({ queryKey: ["dashboard", day], queryFn: () => api.get<Dashboard>(`/dashboard${qs({ day })}`), refetchInterval: 60_000 })
  const d = q.data
  if (q.isLoading || !d) return <div className="flex flex-col gap-4"><div className={cn(CARD, "h-60 animate-pulse")} /><div className={cn(CARD, "h-40 animate-pulse")} /></div>
  return <Board d={d} day={day} setDay={setDay} fetching={q.isFetching} />
}

function Board({ d, day, setDay, fetching }: { d: Dashboard; day: string; setDay: (v: string) => void; fetching: boolean }) {
  const now = useServerNow(30_000)
  const [ingView, setIngView] = useState<"chart" | "table">("chart")
  const [trView, setTrView] = useState<"chart" | "table">("chart")
  const [hover, setHover] = useState(-1)
  const tasks = tasksOf(d)
  const series = d.trend.series.map((r) => ({ day: String(r.day), v: Number(r.total) }))
  const spark = series.slice(-14)
  const sMax = Math.max(1, ...spark.map((s) => s.v))
  const isMaxDay = series.length > 1 && Number(d.unexplained_value) >= Math.max(...series.map((s) => s.v)) && Number(d.unexplained_value) > 0
  const hero = useCountUp(Number(d.unexplained_value), d.day)
  const invOpen = Math.round(useCountUp(d.investigations.open, d.day))
  const alertN = Math.round(useCountUp(d.alerts.length, d.day))
  const wasteTotal = Number(d.waste_on_time) + Number(d.waste_late)
  const ringPct = wasteTotal ? Math.round((Number(d.waste_on_time) / wasteTotal) * 100) : 100
  const ring = useCountUp(ringPct, d.day)
  const crit = d.alerts.filter((a) => a.severity === "critical").length
  const dayDate = new Date(`${d.day}T12:00:00+07:00`)

  // Trục thời gian các ca hôm nay: từ giờ bắt đầu sớm nhất đến giờ kết thúc muộn nhất.
  const sh = [...d.shifts].sort((a, b) => a.planned_start.localeCompare(b.planned_start))
  const t0 = sh.length ? Math.min(...sh.map((s) => mins(s.planned_start))) : 360
  const t1 = sh.length ? Math.max(...sh.map((s) => mins(s.planned_end) || 1440)) : 1320
  const span = Math.max(60, t1 - t0)
  const isToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now) === d.day
  const nowM = mins(now.toISOString())
  const nowPct = Math.max(0, Math.min(100, ((nowM - t0) / span) * 100))
  const ticks = Array.from({ length: 5 }, (_, i) => hm(Math.round((t0 + (span * i) / 4) / 60) * 60))

  const ingMax = Math.max(1, ...d.top_ingredients.map((r) => Math.abs(Number(r.value))))
  const pos = Math.max(0, ...series.map((s) => s.v)), neg = Math.max(0, -Math.min(0, ...series.map((s) => s.v)))
  const rng = Math.max(1, pos + neg), zero = (neg / rng) * 100
  const chefMax = Math.max(1, ...d.trend.by_chef.map((c) => Math.abs(c.value)))
  const shiftMax = Math.max(1, ...d.trend.by_shift.map((c) => Math.abs(c.value)))

  return (
    <div className={cn("flex flex-col gap-[30px] transition-opacity", fetching && "opacity-90")}>
      <PageHead kicker={`${DAY_NAME[dayDate.getDay()]}, ${dateOnly(d.day)}`} title="Tổng quan"
        desc="Việc cần xử lý, chênh lệch giữa lượng đáng lẽ phải dùng và thực tế đã dùng, ai chịu trách nhiệm, quy trình có được tuân thủ."
        right={(
          <label className="flex items-center gap-2 text-sm text-[#4f4a45]">Ngày
            <input type="date" value={day || d.day} onChange={(e) => setDay(e.target.value)} aria-label="Chọn ngày"
              className="h-11 rounded-xl bg-[#fdfdfc] px-3 text-[15px] text-[#1c1917] shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.1)]" />
          </label>
        )} />

      <div className="flex flex-wrap gap-4">
        <div className="a-rise relative flex min-h-[240px] flex-[1.7_1_380px] flex-col gap-4 overflow-hidden rounded-3xl bg-[#1c1917] px-7 pt-[26px] pb-6 text-[#fafaf9] shadow-[0_2px_4px_rgba(41,37,36,.06),0_28px_50px_-26px_rgba(41,37,36,.55)]" style={{ animationDelay: "60ms" }}>
          <div aria-hidden className="pointer-events-none absolute -top-[180px] -right-[140px] size-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(235,147,96,.24),rgba(235,147,96,0))]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="text-[15px] font-medium text-[#d6d3d1]">Chênh lệch chưa giải thích ngày {dateOnly(d.day)}</div>
            {isMaxDay && <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-[rgba(235,147,96,.14)] px-3 text-sm font-semibold whitespace-nowrap text-[#f3a274]"><TrendUp weight="bold" aria-hidden />Cao nhất {d.trend.days} ngày</span>}
          </div>
          <div className="relative flex items-baseline gap-2 font-display font-bold tracking-[-.045em] text-[#eb9360] tabular">
            <span className="text-[clamp(52px,5.2vw,76px)] leading-[.9]">{num(Math.round(hero / 1000) * 1000)}</span><span className="text-[30px]">đ</span>
          </div>
          <div className="relative mt-auto flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-[320px] text-[15px] leading-normal text-[#d6d3d1]">{d.counts_today} lần kiểm kê hoặc cân trả, phần thiếu {money(d.shortage_value)}</div>
            {spark.length > 0 && (
              <div className="flex flex-col items-end gap-2" role="img" aria-label={`Chênh lệch ${spark.length} ngày gần nhất, cao nhất ${moneyShort(sMax)}`}>
                <div className="flex h-[58px] items-end gap-1">
                  {spark.map((s, i) => (
                    <span key={s.day} className="a-growY w-[9px] origin-bottom rounded-[3px]"
                      style={{ height: Math.max(4, (Math.max(0, s.v) / sMax) * 58), background: i === spark.length - 1 ? A.paprika : s.v < 0 ? "#57534e" : "rgba(235,147,96,.38)", animationDelay: `${300 + i * 40}ms` }} />
                  ))}
                </div>
                <span className="text-sm whitespace-nowrap text-[#b5afaa]">{spark.length} ngày gần nhất</span>
              </div>
            )}
          </div>
        </div>

        <Link to="/quan-ly/dieu-tra" className={cn(CARD, CARD_HOVER, "a-rise flex flex-[1_1_200px] flex-col gap-3.5 rounded-[22px] p-[22px]")} style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-medium text-[#4f4a45]">Phiếu điều tra đang mở</span>
            <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-[#fbeae0] text-[#7c3410]"><FileSearch className="size-5" aria-hidden /></span></div>
          <div className="font-display text-[54px] leading-[.95] font-bold tracking-[-.04em] tabular" style={{ color: d.investigations.overdue ? A.bad : A.ink }}>{invOpen}</div>
          <div className="a-growX flex h-2 gap-[3px]" style={{ animationDelay: "350ms" }} aria-hidden>
            {d.investigations.open > 0 && <>
              <span className="rounded-full bg-[#d03b3b]" style={{ width: `${(d.investigations.overdue / d.investigations.open) * 100}%` }} />
              <span className="rounded-full bg-[#fab219]" style={{ width: `${(d.investigations.due_soon / d.investigations.open) * 100}%` }} />
            </>}
            <span className="flex-1 rounded-full bg-[#d6d3d1]" />
          </div>
          <div className="text-sm leading-[1.45] text-[#4f4a45]">{d.investigations.overdue} quá hạn, {d.investigations.due_soon} sắp hạn, {moneyShort(d.investigations.open_value)}</div>
        </Link>

        <div className={cn(CARD, "a-rise flex flex-[1_1_200px] flex-col gap-3.5 p-[22px]")} style={{ animationDelay: "180ms" }}>
          <div className="text-[15px] font-medium text-[#4f4a45]">Hao hụt ghi đúng lúc <span className="font-normal">(30 ngày)</span></div>
          <div className="flex items-center gap-[18px]">
            <div className="relative size-[92px] shrink-0 rounded-full" role="img" aria-label={`${ringPct}% hao hụt ghi đúng lúc`}
              style={{ background: `conic-gradient(${A.ink} ${ring * 3.6}deg, ${A.line2} 0)` }}>
              <div className="absolute inset-2.5 flex items-center justify-center rounded-full bg-[#fdfdfc] font-display text-2xl font-bold tracking-[-.03em] tabular">{Math.round(ring)}%</div>
            </div>
            <div className="flex flex-col gap-2 text-sm leading-[1.35] text-[#4f4a45]">
              <div className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-[3px] bg-[#1c1917]" aria-hidden />Đúng lúc {moneyShort(d.waste_on_time)}</div>
              <div className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-[3px] bg-[#d6d3d1]" aria-hidden />Ghi muộn qua điều tra {moneyShort(d.waste_late)}</div>
            </div>
          </div>
        </div>

        <Link to="/quan-ly/canh-bao" className={cn(CARD, CARD_HOVER, "a-rise flex flex-[1_1_200px] flex-col gap-3.5 rounded-[22px] p-[22px]")} style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-medium text-[#4f4a45]">Cảnh báo đang mở</span>
            <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-[#fbeae0] text-[#7c3410]"><BellRing className="size-5" aria-hidden /></span></div>
          <div className="font-display text-[54px] leading-[.95] font-bold tracking-[-.04em] tabular">{alertN}</div>
          <div className="flex min-h-2.5 flex-wrap gap-[5px]" aria-hidden>
            {[...d.alerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1)).slice(0, 24).map((a, i) => (
              <span key={a.id} className="a-dot size-3 rounded" style={{ background: a.severity === "critical" ? A.critMark : A.warnMark, animationDelay: `${500 + i * 50}ms` }} />
            ))}
          </div>
          <div className="text-sm text-[#4f4a45]">{crit} nghiêm trọng, {d.alerts.length - crit} cảnh báo</div>
        </Link>
      </div>

      <section aria-labelledby="can-xu-ly" className="flex flex-col gap-3.5">
        <div className="flex items-baseline gap-2.5"><h2 id="can-xu-ly" className="m-0 font-display text-2xl font-bold tracking-[-.025em]">Cần xử lý ngay</h2><span className="text-[15px] font-semibold text-[#4f4a45]">{tasks.length} việc</span></div>
        {!tasks.length ? (
          <div className={cn(CARD, "flex items-center gap-2 px-5 py-4 text-[15px] font-semibold text-[#004d00]")}><CheckCircle2 className="size-5" aria-hidden />Không có việc tồn đọng cần xử lý</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
            {tasks.map((t, i) => {
              const tone = TONE[t.tone]
              return (
                <Link key={t.key} to={t.to} className="a-rise flex flex-col rounded-[18px] bg-[#fdfdfc] shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-12px_rgba(41,37,36,.16),0_0_0_1px_rgba(28,25,23,.05)] transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:-rotate-[.3deg] hover:shadow-[0_2px_4px_rgba(41,37,36,.06),0_22px_40px_-20px_rgba(41,37,36,.38),0_0_0_1px_rgba(28,25,23,.06)]"
                  style={delay(i, 180, 55)}>
                  <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
                    <span className="flex size-[38px] items-center justify-center rounded-[11px]" style={{ background: tone.ibg, color: tone.ic }}><t.icon className="size-5" aria-hidden /></span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[#4f4a45]">#{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex h-[26px] items-center rounded-full px-2.5 text-sm font-bold whitespace-nowrap" style={{ background: tone.ibg, color: tone.ic }}>{tone.pill}</span>
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 px-4 pb-3.5">
                    <span className="text-[15px] leading-[1.35] font-bold text-pretty">{t.title}</span>
                    {t.hint && <span className="text-sm leading-[1.4] text-[#4f4a45]">{t.hint}</span>}
                  </div>
                  {/* Đường đục lỗ như phiếu, hai khoét tròn cùng màu nền trang */}
                  <div aria-hidden className="relative mx-3.5 h-0 border-t-[1.5px] border-dashed border-[#e2ded9]">
                    <span className="absolute -top-2 -left-[23px] size-4 rounded-full bg-[#f5f5f4]" />
                    <span className="absolute -top-2 -right-[23px] size-4 rounded-full bg-[#f5f5f4]" />
                  </div>
                  <div className="flex items-center justify-between px-4 pt-[11px] pb-[13px] text-sm font-bold text-[#7c3410]">{t.cta}<ArrowRight weight="bold" aria-hidden /></div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className={cn(CARD, "a-rise flex min-w-0 flex-[1.4_1_540px] flex-col gap-5 p-6")} style={{ animationDelay: "200ms" }}>
          <BlockTitle right={d.a_counted_today
            ? <span className="flex items-center gap-1.5 text-sm font-semibold text-[#004d00]"><CheckCircle2 className="size-[18px]" aria-hidden />Nhóm A tại Kho đã kiểm kê</span>
            : <span className="flex items-center gap-1.5 text-sm font-semibold text-[#8f1a1a]"><XCircle className="size-[18px]" aria-hidden />Nhóm A tại Kho chưa kiểm kê</span>}>Tuân thủ quy trình hôm nay</BlockTitle>
          {sh.length > 0 && (
            <div className="relative pt-[34px]" role="img" aria-label={`Trục giờ các ca, bây giờ ${time(now.toISOString())}`}>
              <div className="flex h-11 gap-1">
                {sh.map((s) => {
                  const a = mins(s.planned_start), b = mins(s.planned_end) || 1440
                  const fill = isToday ? Math.max(0, Math.min(100, ((nowM - a) / (b - a)) * 100)) : s.status === "planned" ? 0 : 100
                  return (
                    <div key={s.id} className="relative overflow-hidden rounded-xl bg-[#efedeb]" style={{ flex: b - a }}>
                      <div className="a-growX absolute inset-y-0 left-0 bg-[#f6c6a8]" style={{ width: `${fill}%`, animationDelay: "350ms" }} />
                      <span className="relative flex h-full items-center px-3.5 text-sm font-bold">{s.name}</span>
                    </div>
                  )
                })}
              </div>
              {isToday && nowM >= t0 && nowM <= t1 && (
                <div className="a-fade absolute top-0 -bottom-1.5 w-0.5 -translate-x-px bg-[#1c1917]" style={{ left: `${nowPct}%`, animationDelay: "900ms" }}>
                  <span className="absolute top-0 left-1/2 flex h-6 -translate-x-1/2 items-center rounded-[7px] bg-[#1c1917] px-2 font-mono text-sm font-semibold whitespace-nowrap text-[#fafaf9]">{time(now.toISOString())}</span>
                  <span className="a-pulse absolute -bottom-1 left-1/2 -ml-[5px] size-2.5 rounded-full bg-[#eb9360]" />
                </div>
              )}
              <div className="mt-3 flex justify-between font-mono text-sm text-[#4f4a45]">{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
            </div>
          )}
          <div className="flex flex-col">
            {sh.map((s) => {
              const steps: { label: string; icon: IconType; bg: string; c: string }[] = [
                s.handover_signed ? { label: "Đã ký nhận bàn giao", icon: CheckCircle2, bg: A.okBg, c: A.ok }
                  : s.handover_pending ? { label: "Bàn giao chờ ký", icon: AlarmClock, bg: A.warnBg, c: A.warn }
                  : { label: "Chưa bàn giao", icon: CircleDashed, bg: "#f2f0ee", c: A.sub },
                s.late_return ? { label: "Quá giờ, chưa cân trả", icon: XCircle, bg: A.badBg, c: A.bad }
                  : s.returned ? { label: "Đã cân trả", icon: CheckCircle2, bg: A.okBg, c: A.ok }
                  : { label: "Chưa đến giờ cân trả", icon: CircleDashed, bg: "#f2f0ee", c: A.sub },
              ]
              if (s.sod_violation) steps.push({ label: "Kiêm nhiệm", icon: ShieldAlert, bg: A.badBg, c: A.bad })
              return (
                <div key={s.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-[#efedeb] py-3.5 sm:grid-cols-[minmax(150px,1.1fr)_minmax(0,2fr)_100px]">
                  <div className="flex flex-col gap-0.5"><span className="text-[15px] font-bold">{s.name} <span className="font-medium text-[#4f4a45] tabular">{time(s.planned_start)}-{time(s.planned_end)}</span></span>
                    <span className="text-sm text-[#4f4a45]">Bếp trưởng {s.head_chef ?? "-"}</span></div>
                  <div className="flex flex-wrap gap-2">{steps.map((st) => (
                    <span key={st.label} className="flex h-8 items-center gap-1.5 rounded-full px-[11px] text-sm font-semibold whitespace-nowrap" style={{ background: st.bg, color: st.c }}><st.icon className="size-[17px]" aria-hidden />{st.label}</span>
                  ))}</div>
                  <div className="text-sm text-[#4f4a45] tabular sm:text-right">{s.returned ? money(s.variance_value) : "-"}</div>
                </div>
              )
            })}
          </div>
          {d.sod_shifts.length > 0 && (
            <div className="flex gap-3 rounded-[14px] bg-[#fbefee] px-4 py-3.5">
              <ShieldAlert className="size-[22px] shrink-0 text-[#8f1a1a]" aria-hidden />
              <div className="text-sm leading-normal"><div className="font-bold text-[#8f1a1a]">Ca không đảm bảo phân tách nhiệm vụ (7 ngày)</div>
                {d.sod_shifts.map((s) => <div key={s.id}>{s.name} {dateOnly(s.business_date)}: {s.notes}</div>)}
                <div>Nên tăng kiểm kê đột xuất.</div></div>
            </div>
          )}
        </div>

        <div className={cn(CARD, "a-rise flex min-w-0 flex-[1_1_380px] flex-col gap-[18px] p-6")} style={{ animationDelay: "260ms" }}>
          <BlockTitle sub={`Theo tiền, ngày ${dateOnly(d.day)}`} right={<ViewToggle value={ingView} onChange={setIngView} />}>Nguyên liệu lệch nhiều nhất</BlockTitle>
          <Legend />
          {!d.top_ingredients.length ? <p className="py-6 text-center text-sm text-[#4f4a45]">Chưa có kiểm kê hoặc cân trả nào trong ngày</p> : ingView === "chart" ? (
            <div className="flex flex-col gap-4">
              {d.top_ingredients.map((r, i) => {
                const v = Number(r.value)
                return (
                  <div key={r.ingredient_id} className="a-slide flex flex-col gap-[7px]" style={delay(i, 260, 60)}>
                    <div className="flex justify-between gap-2.5 text-sm"><span><b>{r.ingredient}</b> <span className="text-[#4f4a45]">{v < 0 ? "thừa" : "thiếu"} {qty(Math.abs(r.qty), r.unit)}</span></span><span className="font-bold tabular">{moneyShort(v)}</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#f2f0ee]"><div className="a-growX h-full rounded-full" style={{ width: `${(Math.abs(v) / ingMax) * 100}%`, background: v < 0 ? A.surplus : A.short, animationDelay: `${380 + i * 60}ms` }} /></div>
                  </div>
                )
              })}
            </div>
          ) : (
            <table className="a-fade w-full text-sm tabular">
              <thead><tr className="border-b border-[#e2ded9] text-[#4f4a45]"><th className="pb-2 text-left font-semibold">Nguyên liệu</th><th className="pb-2 text-right font-semibold">Lượng</th><th className="pb-2 text-right font-semibold">Giá trị</th></tr></thead>
              <tbody>{d.top_ingredients.map((r) => (
                <tr key={r.ingredient_id} className="border-b border-[#efedeb]"><td className="py-2.5 font-semibold">{r.ingredient}</td><td className="py-2.5 text-right">{qty(r.qty, r.unit)}</td><td className="py-2.5 text-right">{money(r.value)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className={cn(CARD, "a-rise flex min-w-0 flex-[1.6_1_560px] flex-col gap-4 p-6")} style={{ animationDelay: "300ms" }}>
          <BlockTitle sub="Giá trị chưa giải thích mỗi ngày, mọi nguyên liệu và vị trí" right={<ViewToggle value={trView} onChange={(v) => { setTrView(v); setHover(-1) }} />}>Xu hướng chênh lệch {d.trend.days} ngày</BlockTitle>
          <Legend />
          {trView === "chart" ? (
            <div className="flex flex-col gap-2">
              <div className="flex h-[230px] gap-2.5">
                <div className="relative w-[58px] shrink-0" aria-hidden>
                  {[pos, pos / 2, 0, -neg].filter((_, i) => i < 3 || neg / rng > 0.08).map((v, i) => (
                    <span key={i} className="absolute right-0 -translate-y-1/2 font-mono text-sm whitespace-nowrap text-[#4f4a45]" style={{ top: `${100 - (zero + (v / rng) * 100)}%` }}>{v === 0 ? "0" : moneyShort(v).replace(" đ", "")}</span>
                  ))}
                </div>
                <div className="relative min-w-0 flex-1" onMouseLeave={() => setHover(-1)} role="img" aria-label={`Biểu đồ cột chênh lệch ${series.length} ngày, xem bảng để đọc từng ngày`}>
                  {[pos, pos / 2, 0, -neg].filter((_, i) => i < 3 || neg / rng > 0.08).map((v, i) => (
                    <div key={i} className="absolute inset-x-0 h-px" style={{ top: `${100 - (zero + (v / rng) * 100)}%`, background: v === 0 ? "#a8a29e" : A.line2 }} />
                  ))}
                  <div className="absolute inset-0 flex gap-[3px]">
                    {series.map((s, i) => {
                      const h = (Math.abs(s.v) / rng) * 100, p = s.v >= 0
                      return (
                        <div key={s.day} className="relative min-w-0 flex-1" onMouseEnter={() => setHover(i)}>
                          <div className="a-growY absolute inset-x-0 transition-opacity duration-200"
                            style={{ top: p ? `${100 - zero - h}%` : `${100 - zero}%`, bottom: p ? `${zero}%` : `${zero - h}%`, borderRadius: p ? "4px 4px 1px 1px" : "1px 1px 4px 4px",
                              background: p ? A.short : A.surplus, transformOrigin: p ? "bottom" : "top", opacity: hover === -1 || hover === i ? 1 : 0.35, animationDelay: `${i * 22 + 200}ms` }} />
                        </div>
                      )
                    })}
                  </div>
                  {hover >= 0 && series[hover] && (
                    <div className="pointer-events-none absolute -translate-x-1/2 rounded-[10px] bg-[#1c1917] px-3 py-2 text-sm whitespace-nowrap text-[#fafaf9] shadow-[0_10px_24px_-10px_rgba(0,0,0,.5)] transition-[left,top] duration-200"
                      style={{ left: `${((hover + 0.5) / series.length) * 100}%`, top: `${series[hover].v >= 0 ? 100 - zero - (Math.abs(series[hover].v) / rng) * 100 : 100 - zero}%`, transform: "translate(-50%, calc(-100% - 10px))" }}>
                      <div className="text-[#d6d3d1]">{dateOnly(series[hover].day)}</div>
                      <div className="font-bold tabular">{series[hover].v < 0 ? "Thừa " : "Thiếu "}{money(Math.abs(series[hover].v))}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-[3px] pl-[68px]" aria-hidden>
                {series.map((s, i) => (
                  <span key={s.day} className="min-w-0 flex-1 overflow-visible text-center font-mono text-sm whitespace-nowrap text-[#4f4a45]">
                    {i % 5 === 4 || i === series.length - 1 ? `${s.day.slice(8, 10)}/${s.day.slice(5, 7)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="a-fade max-h-[270px] overflow-y-auto text-sm">
              {[...series].reverse().map((s) => (
                <div key={s.day} className="flex justify-between border-b border-[#efedeb] px-1 py-[9px] tabular"><span>{dateOnly(s.day)}</span><span className="font-semibold">{money(s.v)}</span></div>
              ))}
            </div>
          )}
        </div>

        <div className={cn(CARD, "a-rise flex min-w-0 flex-[1_1_360px] flex-col gap-[18px] p-6")} style={{ animationDelay: "360ms" }}>
          <BlockTitle sub={`${d.trend.days} ngày, chênh lệch tại Bếp gắn với người ký nhận`}>Theo bếp trưởng ca</BlockTitle>
          {!d.trend.by_chef.length && <p className="text-sm text-[#4f4a45]">Chưa có kỳ đo nào trong khoảng này</p>}
          {d.trend.by_chef.map((c, i) => (
            <div key={c.chef} className="a-slide flex items-center gap-3" style={delay(i, 300, 70)}>
              <Initials name={c.chef} size={40} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex justify-between gap-2 text-sm"><span><b>{c.chef}</b> <span className="text-[#4f4a45]">{c.periods} kỳ đo</span></span><span className="font-bold tabular">{moneyShort(c.value)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f2f0ee]"><div className="a-growX h-full rounded-full" style={{ width: `${(Math.abs(c.value) / chefMax) * 100}%`, background: c.value < 0 ? A.surplus : A.short, animationDelay: `${420 + i * 70}ms` }} /></div>
              </div>
            </div>
          ))}
          {d.trend.by_shift.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#efedeb] pt-3.5">
              <div className="text-sm font-semibold text-[#4f4a45]">Theo ca</div>
              {d.trend.by_shift.map((c) => (
                <div key={c.shift} className="grid grid-cols-[80px_1fr_90px] items-center gap-3 text-sm">
                  <span className="font-semibold">{c.shift}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f2f0ee]"><div className="a-growX h-full rounded-full" style={{ width: `${(Math.abs(c.value) / shiftMax) * 100}%`, background: c.value < 0 ? A.surplus : A.short, animationDelay: "500ms" }} /></div>
                  <span className="text-right font-bold tabular">{moneyShort(c.value)}</span>
                </div>
              ))}
            </div>
          )}
          <details className="mt-auto text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[#7c3410]">Xem dạng bảng</summary>
            <table className="w-full tabular">
              <tbody>
                {d.trend.by_chef.map((r) => <tr key={r.chef} className="border-b border-[#efedeb]"><td className="py-2">{r.chef}</td><td className="py-2 text-right">{r.periods} kỳ</td><td className="py-2 text-right">{money(r.value)}</td></tr>)}
                {d.trend.by_shift.map((r) => <tr key={r.shift} className="border-b border-[#efedeb]"><td className="py-2">{r.shift} (theo ca)</td><td /><td className="py-2 text-right">{money(r.value)}</td></tr>)}
              </tbody>
            </table>
          </details>
        </div>
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex gap-4 text-sm text-[#4f4a45]">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[#e34948]" aria-hidden />Thiếu (thất thoát)</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[#2a78d6]" aria-hidden />Thừa</span>
    </div>
  )
}
