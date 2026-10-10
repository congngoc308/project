import { useQuery } from "@tanstack/react-query"
import { MicrosoftExcelLogo } from "@/components/icons"
import { useMemo, useState } from "react"

import { Loading } from "@/components/common"
import { A, CARD, EmptyNote, adminToast, GroupChip, Seg, Switch, TierPill, delay } from "@/layouts/AdminBits"
import { api, qs } from "@/lib/api"
import { useMeta } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { isoDay, money, pct, qty, signedQty } from "@/lib/format"
import type { Ingredient, Tier } from "@/lib/types"

interface AvtRow {
  ingredient_id: number
  ingredient: string
  group: "A" | "C"
  unit: string
  location: "kho" | "bep"
  shift_id: number | null
  shift: string | null
  head_chef: string | null
  theoretical: number
  recorded_waste: number
  actual: number
  unexplained: number
  pct: number | null
  value: number
  tier: Tier
  counts: number
  explained: { cause: string; label: string; qty: number; value: number }[]
  pending_qty: number
}

type Preset = "d1" | "d7" | "d30" | "custom"
const PRESETS: { key: Preset; label: string; days: number }[] = [
  { key: "d1", label: "Hôm nay", days: 1 },
  { key: "d7", label: "7 ngày", days: 7 },
  { key: "d30", label: "30 ngày", days: 30 },
]

const DATE_INPUT = "h-11 rounded-xl bg-[#fdfdfc] px-3 text-sm font-semibold tabular shadow-[0_0_0_1px_#8a817c] outline-none focus-visible:shadow-[0_0_0_2px_#1c1917]"

/** Khoảng ngày dùng chung (AvT, Báo cáo): nút phân đoạn Hôm nay / 7 ngày / 30 ngày + chọn ngày tuỳ ý. */
export function useDateRange(defaultDays = 7) {
  const now = useServerNow(60_000)
  const today = isoDay(now)
  const back = (days: number) => isoDay(new Date(now.getTime() - (days - 1) * 86_400_000))
  const [from, setFrom] = useState(() => back(defaultDays))
  const [to, setTo] = useState(today)
  const [preset, setPreset] = useState<Preset>(() => PRESETS.find((p) => p.days === defaultDays)?.key ?? "custom")
  const pickPreset = (k: Preset) => {
    const p = PRESETS.find((x) => x.key === k)
    if (!p) return
    setPreset(k); setTo(today); setFrom(back(p.days))
  }
  const control = (
    <div className="flex flex-wrap items-center gap-2.5">
      <Seg label="Khoảng ngày" options={PRESETS.map((p) => ({ key: p.key, label: p.label }))} value={preset} onChange={pickPreset} />
      <span className="flex items-center gap-2 text-sm font-semibold text-[#4f4a45]">
        <input type="date" className={DATE_INPUT} value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom") }} aria-label="Từ ngày" />
        đến
        <input type="date" className={DATE_INPUT} value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom") }} aria-label="Đến ngày" />
      </span>
    </div>
  )
  return { from, to, control }
}

const COLS = "minmax(170px,1.3fr) 110px 100px 100px 100px 120px 150px 120px 130px minmax(170px,1.2fr)"
const TIER_DOT: Record<Tier, string> = { ok: A.ok, warn: A.warn, must: A.bad }

export function AvtPage() {
  const { from, to, control } = useDateRange(7)
  const [location, setLocation] = useState<"all" | "bep" | "kho">("all")
  const [ingredient, setIngredient] = useState("all")
  const [byShift, setByShift] = useState(false)
  const meta = useMeta()
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const params = { date_from: from, date_to: to, location: location === "all" ? "" : location, ingredient_id: ingredient === "all" ? "" : ingredient, by_shift: byShift }
  const q = useQuery({ queryKey: ["avt", params], queryFn: () => api.get<{ rows: AvtRow[]; total_value: number; total_shortage_value: number }>(`/reports/avt${qs(params)}`) })

  // Ngưỡng % của từng nguyên liệu: riêng của nguyên liệu nếu có, không thì theo nhóm (Cài đặt).
  const thresholdOf = useMemo(() => {
    const byId = new Map((ings.data ?? []).map((i) => [i.id, i]))
    const base = meta.data?.settings.thresholds
    return (r: AvtRow) => {
      const i = byId.get(r.ingredient_id)
      const g = base?.[r.group]
      const w = Number(i?.warn_pct ?? g?.warn_pct ?? (r.group === "A" ? 2.5 : 10))
      const m = Number(i?.must_pct ?? g?.must_pct ?? (r.group === "A" ? 5 : 20))
      return { w, m }
    }
  }, [ings.data, meta.data])

  const rows = useMemo(() => [...(q.data?.rows ?? [])].sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value))), [q.data])
  const mustN = rows.filter((r) => r.tier === "must").length

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <div className="a-rise flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[clamp(34px,3.2vw,46px)] leading-none font-bold tracking-[-.035em]">Báo cáo AvT</h1>
          <p className="mt-3 max-w-[680px] text-[15px] leading-[1.55] text-pretty text-[#4f4a45]">
            Thực tế so với lý thuyết. Lý thuyết bằng định lượng nhân số món đã bán. Chênh lệch chưa giải thích bằng thực tế trừ lý thuyết trừ hao hụt đã ghi, tức tồn sổ trừ tồn kiểm kê.
          </p>
        </div>
        <a href={`/api/reports/avt.xlsx${qs(params)}`} onClick={() => adminToast("Đang xuất AvT ra Excel")}
          className="flex h-[46px] items-center gap-2 rounded-xl bg-[#fdfdfc] px-[18px] text-[15px] font-bold whitespace-nowrap shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.1)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5">
          <MicrosoftExcelLogo weight="duotone" className="size-5" aria-hidden />Xuất Excel
        </a>
      </div>

      <div className="a-rise flex flex-wrap items-center gap-2.5 rounded-[18px] bg-[#fdfdfc] p-2.5 shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.05)]" style={{ animationDelay: "50ms" }}>
        {control}
        <Seg label="Vị trí" value={location} onChange={setLocation}
          options={[{ key: "all", label: "Mọi vị trí" }, { key: "bep", label: "Bếp" }, { key: "kho", label: "Kho" }]} />
        <select value={ingredient} onChange={(e) => setIngredient(e.target.value)} aria-label="Nguyên liệu"
          className="h-11 rounded-xl bg-[#efedeb] px-3 text-sm font-bold outline-none focus-visible:shadow-[0_0_0_2px_#1c1917]">
          <option value="all">Mọi nguyên liệu</option>
          {(ings.data ?? []).map((i) => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
        </select>
        <Switch on={byShift} onChange={setByShift}>Tách theo ca</Switch>
      </div>

      {q.isLoading || !q.data ? <Loading /> : (
        <>
          <div className="a-rise flex flex-wrap gap-4" style={{ animationDelay: "100ms" }}>
            <div className="flex-[1_1_260px] rounded-[22px] bg-[#1c1917] px-6 py-[22px] text-[#fafaf9]">
              <div className="text-sm text-[#d6d3d1]">Tổng giá trị chênh lệch</div>
              <div className="mt-1 font-display text-[42px] font-bold tracking-[-.04em] tabular text-[#eb9360]">{money(q.data.total_value)}</div>
            </div>
            <div className={`flex-[1_1_220px] px-6 py-[22px] ${CARD}`}>
              <div className="text-sm text-[#4f4a45]">Phần thiếu</div>
              <div className="mt-1 font-display text-[42px] font-bold tracking-[-.04em] tabular text-[#8f1a1a]">{money(q.data.total_shortage_value)}</div>
            </div>
            <div className={`flex-[1_1_220px] px-6 py-[22px] ${CARD}`}>
              <div className="text-sm text-[#4f4a45]">Phải điều tra</div>
              <div className="mt-1 font-display text-[42px] font-bold tracking-[-.04em] tabular">
                {mustN} <span className="text-lg tracking-normal text-[#4f4a45]">/ {rows.length} dòng</span>
              </div>
            </div>
          </div>

          <div className={`a-rise overflow-x-auto ${CARD}`} style={{ animationDelay: "150ms" }} aria-busy={q.isFetching} tabIndex={0} aria-label="Bảng AvT, cuộn ngang để xem đủ cột">
            <div className="min-w-[1180px]" role="table" aria-label="Bảng AvT theo nguyên liệu">
              <div role="row" className="grid gap-3.5 border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]" style={{ gridTemplateColumns: COLS }}>
                <span role="columnheader">Nguyên liệu</span><span role="columnheader">Vị trí</span>
                <span role="columnheader" className="text-right">Lý thuyết</span><span role="columnheader" className="text-right">Hao hụt ghi</span>
                <span role="columnheader" className="text-right">Thực tế</span><span role="columnheader" className="text-right">Chưa giải thích</span>
                <span role="columnheader">% so với ngưỡng</span><span role="columnheader" className="text-right">Giá trị</span>
                <span role="columnheader">Mức</span><span role="columnheader">Đã giải trình, chờ</span>
              </div>
              {rows.length === 0 && <EmptyNote>Không có số liệu trong kỳ</EmptyNote>}
              {rows.map((r, i) => {
                const { w, m } = thresholdOf(r)
                const scale = Math.max(m * 2, 1)
                const p = r.pct === null || r.pct === undefined ? null : Number(r.pct)
                const un = Number(r.unexplained)
                const pending = Number(r.pending_qty)
                return (
                  <div key={`${r.ingredient_id}-${r.location}-${r.shift_id ?? "x"}`} role="row"
                    className="a-rise grid min-h-[68px] items-center gap-3.5 border-b border-[#efedeb] px-6 py-3.5 text-sm tabular transition-colors duration-[250ms] hover:bg-[#f7f4f1]"
                    style={{ gridTemplateColumns: COLS, animationDuration: ".55s", ...delay(i) }}>
                    <span role="cell" className="flex items-center gap-2"><span className="text-[15px] font-bold">{r.ingredient}</span><GroupChip group={r.group} /></span>
                    <span role="cell" className="flex flex-col gap-0.5">
                      <span>{r.location === "bep" ? "Bếp" : "Kho"}</span>
                      {byShift && <span className="text-[#4f4a45]">{r.shift ? `${r.shift}${r.head_chef ? `, ${r.head_chef}` : ""}` : "Ngoài ca"}</span>}
                    </span>
                    <span role="cell" className="text-right">{Number(r.theoretical) ? qty(r.theoretical, r.unit) : "-"}</span>
                    <span role="cell" className="text-right">{Number(r.recorded_waste) ? qty(r.recorded_waste, r.unit) : "-"}</span>
                    <span role="cell" className="text-right">{qty(r.actual, r.unit)}</span>
                    <span role="cell" className="text-right font-bold" style={{ color: un < 0 ? A.surplusText : un > 0 ? A.bad : A.ink }}>{signedQty(r.unexplained, r.unit)}</span>
                    <span role="cell" className="flex flex-col gap-1.5">
                      <span className="font-semibold">{p === null ? "Không có lý thuyết" : pct(p)}</span>
                      <span aria-hidden className="relative h-1.5 rounded-full"
                        style={{ background: `linear-gradient(90deg,#e9f5e9 0,#e9f5e9 ${(w / scale) * 100}%,#fdf0d2 ${(w / scale) * 100}%,#fdf0d2 ${(m / scale) * 100}%,#fbe4e4 ${(m / scale) * 100}%)` }}>
                        <span className="absolute top-1/2 -mt-1.5 -ml-1.5 size-3 rounded-full shadow-[0_0_0_2px_#fdfdfc] transition-[left] duration-[800ms] ease-[cubic-bezier(.16,1,.3,1)]"
                          style={{ left: p === null ? "96%" : `${Math.min(97, (Math.abs(p) / scale) * 100)}%`, background: TIER_DOT[r.tier] }} />
                      </span>
                    </span>
                    <span role="cell" className="text-right font-bold">{money(r.value)}</span>
                    <span role="cell"><TierPill tier={r.tier} /></span>
                    <span role="cell" className="flex flex-col gap-0.5 text-sm">
                      {r.explained.map((e) => <span key={e.cause}>{e.label}: {qty(e.qty, r.unit)}, {money(e.value)}</span>)}
                      {pending !== 0 && <span className="font-bold text-[#6b4300]">Chờ giải trình {qty(r.pending_qty, r.unit)}</span>}
                      {!r.explained.length && pending === 0 && <span className="text-[#4f4a45]">-</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

