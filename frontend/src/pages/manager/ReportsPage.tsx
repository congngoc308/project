import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { ShieldAlert } from "@/components/icons"
import { A, CARD, EmptyNote, PageHead, Seg, TierPill, ViewToggle, delay } from "@/layouts/AdminBits"
import { api, qs } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { dateOnly, dateTime, isoDay, money, moneyShort, pct, qty, signedQty, unit } from "@/lib/format"
import type { Tier } from "@/lib/types"
import { cn } from "@/lib/utils"
import { GridTable, UnderTabs, type Cell } from "@/pages/manager/SystemBits"

interface KV { key: string; value: number | string }
interface WasteReport {
  on_time_value: number | string
  late_value: number | string
  by_type: KV[]
  by_ingredient: (KV & { qty: number })[]
  by_shift: KV[]
  by_person: KV[]
  by_dish: KV[]
}
interface ShiftRow { id: number; business_date: string; name: string; head_chef: string | null; handed_value: number; variance_value: number; worst_tier: Tier; investigations: number; dishes: number; sod_violation: boolean; status: string }
interface CountRow { code: string; kind: string; location: string; cutoff_at: string; counted_by: string; ingredient: string; unit: string; book_qty: number; counted_qty: number; variance_qty: number; variance_pct: number | null; variance_value: number; tier: Tier }
interface ReceiptRow { code: string; supplier: string; received_at: string; ingredient: string; unit: string; ordered_qty: number; received_qty: number; unit_price: number; unit_cost_base: number; base_unit: string; status: string }
interface SalesRow { date: string; shift: string; sold: number; cancel_after_start: number; remade: number; cancel_before_start: number; out_of_stock: number }

type RangeKey = "d7" | "d14" | "d30" | "custom"
type TabKey = "waste" | "shifts" | "counts" | "receipts" | "sales"
const DAYS: Record<Exclude<RangeKey, "custom">, number> = { d7: 7, d14: 14, d30: 30 }
const TABS: { key: TabKey; label: string }[] = [
  { key: "waste", label: "Hao hụt" },
  { key: "shifts", label: "Theo ca và bếp trưởng" },
  { key: "counts", label: "Lịch sử kiểm kê" },
  { key: "receipts", label: "Nhập hàng và đơn giá" },
  { key: "sales", label: "Bán, hủy, làm lại" },
]
/** Biểu đồ chỉ vẽ bấy nhiêu dòng lớn nhất; chế độ Bảng hiện đủ. */
const TOP = 8

function DateBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-11 rounded-xl bg-[#fdfdfc] px-3 text-[15px] font-semibold tabular shadow-[0_0_0_1px_#8a817c]" />
    </label>
  )
}

export function ReportsPage() {
  const now = useServerNow(60_000)
  const today = isoDay(now)
  const [range, setRange] = useState<RangeKey>("d14")
  const [custom, setCustom] = useState(() => ({ from: isoDay(new Date(now.getTime() - 13 * 86_400_000)), to: today }))
  const [tab, setTab] = useState<TabKey>("waste")
  const [view, setView] = useState<"chart" | "table">("chart")

  const from = range === "custom" ? custom.from : isoDay(new Date(now.getTime() - (DAYS[range] - 1) * 86_400_000))
  const to = range === "custom" ? custom.to : today
  const p = qs({ date_from: from, date_to: to })
  const waste = useQuery({ queryKey: ["r-waste", p], queryFn: () => api.get<WasteReport>(`/reports/waste${p}`), enabled: tab === "waste" })
  const shifts = useQuery({ queryKey: ["r-shifts", p], queryFn: () => api.get<ShiftRow[]>(`/reports/shifts${p}`), enabled: tab === "shifts" })
  const counts = useQuery({ queryKey: ["r-counts", p], queryFn: () => api.get<CountRow[]>(`/reports/counts${p}`), enabled: tab === "counts" })
  const receipts = useQuery({ queryKey: ["r-receipts", p], queryFn: () => api.get<ReceiptRow[]>(`/reports/receipts${p}`), enabled: tab === "receipts" })
  const sales = useQuery({ queryKey: ["r-sales", p], queryFn: () => api.get<SalesRow[]>(`/reports/sales${p}`), enabled: tab === "sales" })

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Báo cáo khác"
        desc="Hao hụt theo loại, món, ca và nhân viên; chênh lệch theo ca và bếp trưởng; lịch sử kiểm kê; nhập hàng và đơn giá; số món bán, hủy, làm lại."
        right={
          <div className="flex flex-wrap items-end gap-3">
            {range === "custom" && (
              <div className="a-pop flex gap-2">
                <DateBox label="Từ ngày" value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
                <DateBox label="Đến ngày" value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
              </div>
            )}
            <Seg label="Khoảng thời gian" value={range} onChange={setRange}
              options={[{ key: "d7", label: "7 ngày" }, { key: "d14", label: "14 ngày" }, { key: "d30", label: "30 ngày" }, { key: "custom", label: "Tùy chọn" }]} />
          </div>
        } />
      <UnderTabs label="Loại báo cáo" items={TABS} value={tab} onChange={setTab} />

      {tab === "waste" && <WasteTab w={waste.data} loading={waste.isLoading} view={view} setView={setView} />}

      {tab === "shifts" && (shifts.isLoading ? <Skeleton /> : (
        <GridTable label="Chênh lệch theo ca và bếp trưởng" minW={980}
          cols="minmax(150px,1.2fr) minmax(140px,1fr) 70px 140px 130px 150px 110px 120px"
          head={[{ t: "Ca" }, { t: "Bếp trưởng" }, { t: "Món", right: true }, { t: "Giá trị bàn giao", right: true }, { t: "Chênh lệch", right: true }, { t: "Mức" }, { t: "Phiếu điều tra", right: true }, { t: "" }]}
          rows={(shifts.data ?? []).map((s) => ({
            key: s.id,
            cells: [
              { t: `${s.name} ${dateOnly(s.business_date).slice(0, 5)}`, strong: true },
              { t: s.head_chef ?? "-" },
              { t: s.dishes, right: true },
              { t: money(s.handed_value), right: true },
              { t: money(s.variance_value), right: true, strong: true },
              { t: <TierPill tier={s.worst_tier} /> },
              { t: s.investigations || "-", right: true },
              { t: s.sod_violation ? <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: A.bad }}><ShieldAlert weight="bold" className="size-4" aria-hidden />Kiêm nhiệm</span> : "" },
            ] as Cell[],
          }))} />
      ))}

      {tab === "counts" && (counts.isLoading ? <Skeleton /> : (
        <GridTable label="Lịch sử kiểm kê" minW={1020}
          cols="minmax(240px,1.6fr) minmax(120px,1fr) 100px 100px 110px 80px 120px"
          head={[{ t: "Lúc, phiên" }, { t: "Nguyên liệu" }, { t: "Tồn sổ", right: true }, { t: "Thực đếm", right: true }, { t: "Chênh lệch", right: true }, { t: "%", right: true }, { t: "Giá trị", right: true }]}
          rows={(counts.data ?? []).map((c, i) => ({
            key: `${c.code}-${c.ingredient}-${i}`,
            cells: [
              { t: `${dateTime(c.cutoff_at)}, ${c.kind} (${c.location === "bep" ? "Bếp" : "Kho"}), ${c.counted_by}`, strong: true },
              { t: c.ingredient },
              { t: qty(c.book_qty, c.unit), right: true },
              { t: qty(c.counted_qty, c.unit), right: true },
              { t: signedQty(c.variance_qty, c.unit), right: true, strong: true },
              { t: pct(c.variance_pct), right: true },
              { t: money(c.variance_value), right: true },
            ],
          }))} />
      ))}

      {tab === "receipts" && (receipts.isLoading ? <Skeleton /> : (
        <GridTable label="Nhập hàng và đơn giá" minW={980}
          cols="minmax(260px,1.6fr) minmax(120px,1fr) 100px 100px 120px 140px"
          head={[{ t: "Phiếu" }, { t: "Nguyên liệu" }, { t: "Đặt", right: true }, { t: "Nhận", right: true }, { t: "Đơn giá", right: true }, { t: "Giá / đv cơ sở", right: true }]}
          rows={(receipts.data ?? []).map((r, i) => ({
            key: `${r.code}-${r.ingredient}-${i}`,
            cells: [
              { t: `${r.code}, ${r.supplier}, ${dateTime(r.received_at)}`, strong: true },
              { t: r.ingredient },
              { t: `${Number(r.ordered_qty).toLocaleString("vi-VN")} ${unit(r.unit)}`, right: true },
              { t: `${Number(r.received_qty).toLocaleString("vi-VN")} ${unit(r.unit)}`, right: true },
              { t: money(r.unit_price), right: true },
              { t: `${money(r.unit_cost_base)}/${unit(r.base_unit)}`, right: true },
            ],
          }))} />
      ))}

      {tab === "sales" && (sales.isLoading ? <Skeleton /> : (
        <GridTable label="Bán, hủy, làm lại" minW={880}
          cols="minmax(170px,1.3fr) 100px 150px 150px 100px 150px"
          head={[{ t: "Ngày, ca" }, { t: "Đã bán", right: true }, { t: "Hủy trước khi nấu", right: true }, { t: "Hủy sau khi nấu", right: true }, { t: "Làm lại", right: true }, { t: "Hết nguyên liệu", right: true }]}
          rows={(sales.data ?? []).map((s) => ({
            key: `${s.date}-${s.shift}`,
            cells: [
              { t: `${dateOnly(s.date).slice(0, 5)}, ${s.shift}`, strong: true },
              { t: s.sold, right: true },
              { t: s.cancel_before_start, right: true },
              { t: s.cancel_after_start, right: true },
              { t: s.remade, right: true },
              { t: s.out_of_stock, right: true },
            ],
          }))} />
      ))}
    </div>
  )
}

function Skeleton() {
  return <div className={cn(CARD, "a-fade h-64 motion-safe:animate-pulse")} role="status" aria-label="Đang tải" />
}

function WasteTab({ w, loading, view, setView }: { w: WasteReport | undefined; loading: boolean; view: "chart" | "table"; setView: (v: "chart" | "table") => void }) {
  if (loading || !w) return <Skeleton />
  const charts: { title: string; rows: KV[] }[] = [
    { title: "Theo loại", rows: w.by_type },
    { title: "Theo nguyên liệu", rows: w.by_ingredient },
    { title: "Theo nhân viên (người ghi, người chịu trách nhiệm)", rows: w.by_person },
    { title: "Theo món (hủy sau chế biến, làm lại)", rows: w.by_dish },
    { title: "Theo ca", rows: w.by_shift },
  ]
  // Một thang chung cho mọi biểu đồ (cùng đơn vị tiền) để so được giữa các khối.
  const max = Math.max(1, ...charts.flatMap((c) => c.rows.slice(0, TOP).map((r) => Number(r.value))))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div className="a-rise flex-[1_1_260px] rounded-[22px] bg-[#1c1917] px-6 py-[22px] text-[#fafaf9]">
          <div className="text-sm text-[#d6d3d1]">Ghi đúng lúc</div>
          <div className="mt-1 font-display text-[40px] font-bold tracking-[-.04em] text-[#eb9360] tabular">{money(w.on_time_value)}</div>
        </div>
        <div className={cn(CARD, "a-rise flex-[1_1_260px] px-6 py-[22px]")} style={{ animationDelay: "60ms" }}>
          <div className="text-sm text-[#4f4a45]">Ghi muộn qua điều tra</div>
          <div className="mt-1 font-display text-[40px] font-bold tracking-[-.04em] tabular" style={{ color: A.bad }}>{money(w.late_value)}</div>
        </div>
        <div className="flex flex-[0_0_auto] items-end"><ViewToggle value={view} onChange={setView} /></div>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        {charts.map((ch, i) => (
          <section key={ch.title} aria-label={ch.title} className={cn(CARD, "a-rise flex flex-col gap-3.5 p-[22px]")} style={delay(i, 80, 70)}>
            <h3 className="m-0 font-display text-[19px] font-bold tracking-[-.02em]">{ch.title}</h3>
            {ch.rows.length === 0 ? <EmptyNote>Không có hao hụt trong kỳ</EmptyNote> : view === "chart" ? (
              <>
                {ch.rows.slice(0, TOP).map((r, j) => (
                  <div key={r.key} className="grid items-center gap-3 text-sm [grid-template-columns:minmax(120px,1fr)_2fr_90px]">
                    <span className="font-semibold">{r.key}</span>
                    <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-[#f2f0ee]">
                      <span className="a-growX block h-full rounded-full bg-[#1c1917] transition-[width] duration-600"
                        style={{ width: `${(Number(r.value) / max) * 100}%`, animationDelay: `${250 + i * 70 + j * 50}ms` }} />
                    </span>
                    <span className="text-right font-bold tabular">{moneyShort(r.value)}</span>
                  </div>
                ))}
                {ch.rows.length > TOP && <div className="text-sm text-[#4f4a45]">Và {ch.rows.length - TOP} mục nhỏ hơn, xem đủ ở chế độ Bảng.</div>}
              </>
            ) : (
              <table className="w-full text-sm tabular">
                <caption className="sr-only">{ch.title}</caption>
                <thead><tr className="border-b border-[#e2ded9] text-[#4f4a45]"><th scope="col" className="py-2 text-left font-semibold">Mục</th><th scope="col" className="py-2 text-right font-semibold">Giá trị</th></tr></thead>
                <tbody>{ch.rows.map((r) => (
                  <tr key={r.key} className="border-b border-[#efedeb] last:border-b-0"><th scope="row" className="py-2.5 text-left font-semibold">{r.key}</th><td className="py-2.5 text-right font-bold">{money(r.value)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
