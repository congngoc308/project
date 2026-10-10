import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckSquare, Dices, Eye, EyeOff, LockSimple, Play, RotateCcw, ScanSearch, ShieldAlert, Square } from "@/components/icons"
import { useEffect, useRef, useState } from "react"

import { useAsk } from "@/components/ask"
import { Loading } from "@/components/common"
import { A, Btn, CARD, EmptyNote, GroupChip, HeadStat, Modal, Pill, Seg, TierPill, ViewToggle, adminToast, delay, type Tier } from "@/layouts/AdminBits"
import { api } from "@/lib/api"
import { dateTime, money, moneyShort, pct, qty, signedQty, unit as fmtUnit } from "@/lib/format"
import type { CountSession, Ingredient } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAction } from "@/lib/useAction"

const locName = (l: "kho" | "bep") => (l === "bep" ? "Bếp" : "Kho")

/** Mức cao nhất của một phiên (null khi chưa có số liệu). */
function worstTier(s: CountSession): Tier | null {
  const t = s.lines.map((l) => l.tier).filter(Boolean)
  return t.includes("must") ? "must" : t.includes("warn") ? "warn" : t.length ? "ok" : null
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

// ---- Kiểm kê (quản lý) ----

const S_COLS = "150px minmax(150px,1.2fr) 80px 130px minmax(130px,1fr) 150px 120px 150px"
const L_COLS = "1.3fr repeat(5,1fr) 120px 150px"

export function CountsAdminPage() {
  const ask = useAsk()
  const q = useQuery({ queryKey: ["counts", "all"], queryFn: () => api.get<CountSession[]>("/counts") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [view, setView] = useState<CountSession | null>(null)
  const [counting, setCounting] = useState<CountSession | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [pick, setPick] = useState<number[]>([])
  const [location, setLocation] = useState<"bep" | "kho">("bep")
  const [rolling, setRolling] = useState<number | null>(null)
  const rollT = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearInterval(rollT.current), [])

  const inv = [["counts"], ["dashboard"], ["investigations"], ["alerts"]]
  const spot = useAction((body: object) => api.post<CountSession>("/counts", { kind: "spot", location, note: "Kiểm kê đột xuất, không báo trước", ...body }), {
    invalidate: inv,
    onSuccess: (s) => {
      adminToast(`Đã mở ${s.code}: ${s.lines.map((l) => l.ingredient).join(", ")}`)
      setCounting(s); setValues({}); setPick([])
    },
  })
  const submit = useAction(() => api.post<CountSession>(`/counts/${counting!.id}/submit`, {
    counts: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v.replace(",", "."))])),
  }), {
    invalidate: inv,
    onSuccess: (s) => { adminToast("Đã chốt kiểm kê đột xuất, số liệu đã mở cho quản lý"); setCounting(null); setView(s) },
  })
  const review = useAction((id: number) => api.post<CountSession>(`/counts/${id}/review`), {
    invalidate: inv, onSuccess: (s) => { adminToast(`Đã duyệt phiên ${s.code}`); setView(s) },
  })
  const correction = useAction((v: { id: number; note: string }) => api.post<CountSession>(`/counts/${v.id}/correction`, { note: v.note }), {
    invalidate: inv, onSuccess: (s) => { adminToast(`Đã tạo phiên điều chỉnh ${s.code}. Phiên gốc giữ nguyên để truy vết.`); setView(null) },
  })

  const groupA = (ings.data ?? []).filter((i) => i.control_group === "A" && i.active !== false)
  const choices = location === "bep" ? groupA : (ings.data ?? []).filter((i) => i.active !== false)

  // Xúc xắc: ô sáng chạy qua các nguyên liệu nhóm A rồi hệ thống chọn ngẫu nhiên 2 (máy chủ chọn).
  const roll = () => {
    if (rolling !== null || spot.isPending) return
    if (reduceMotion() || !groupA.length) { spot.mutate({ random_n: 2 }); return }
    let n = 0
    rollT.current = window.setInterval(() => {
      n++
      setRolling(groupA[n % groupA.length].id)
      if (n > 11) {
        window.clearInterval(rollT.current)
        setRolling(null)
        spot.mutate({ random_n: 2 })
      }
    }, 80)
  }

  const filled = !!counting && counting.lines.every((l) => {
    const v = values[String(l.ingredient_id)]
    return v !== undefined && v !== "" && !Number.isNaN(Number(v.replace(",", ".")))
  })

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <div className="a-rise">
        <h1 className="m-0 font-display text-[clamp(34px,3.2vw,46px)] leading-none font-bold tracking-[-.035em]">Kiểm kê</h1>
        <p className="mt-3 max-w-[680px] text-[15px] leading-[1.55] text-pretty text-[#4f4a45]">
          Kiểm kê mù: người đếm không thấy tồn sổ. Kiểm kê đột xuất do quản lý thực hiện không báo trước, dùng khi nghi ngờ hoặc để xác nhận báo hết nhầm.
        </p>
      </div>

      {!counting ? (
        <section aria-label="Kiểm kê đột xuất" className="on-dark a-rise flex flex-col gap-[18px] rounded-[22px] bg-[#1c1917] p-6 text-[#fafaf9]" style={{ animationDelay: "50ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3.5">
            <div className="min-w-0 flex-[1_1_280px]">
              <h3 className="m-0 font-display text-[22px] font-bold tracking-[-.02em]">Kiểm kê đột xuất</h3>
              <div className="mt-1 text-sm text-[#d6d3d1]">Chọn nguyên liệu hoặc để hệ thống chọn ngẫu nhiên</div>
            </div>
            <div role="group" aria-label="Vị trí kiểm kê" className="flex gap-0.5 rounded-xl bg-[#2e2926] p-1">
              {(["bep", "kho"] as const).map((k) => {
                const on = location === k
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => { setLocation(k); setPick([]) }}
                    className={cn("h-11 rounded-[9px] px-4 text-sm font-bold whitespace-nowrap transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-[#eb9360]",
                      on ? "bg-[#fafaf9] text-[#1c1917]" : "text-[#d6d3d1] hover:text-[#fafaf9]")}>
                    Tại {locName(k)}
                  </button>
                )
              })}
            </div>
          </div>
          <div role="group" aria-label="Nguyên liệu kiểm kê" className="flex flex-wrap gap-2">
            {ings.isLoading && <span className="text-sm text-[#d6d3d1]">Đang tải nguyên liệu…</span>}
            {choices.map((i) => {
              const on = pick.includes(i.id)
              const hot = on || rolling === i.id
              const Icon = on ? CheckSquare : Square
              return (
                <button key={i.id} type="button" aria-pressed={on}
                  onClick={() => setPick((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))}
                  className="flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap transition-[background-color,color,transform,box-shadow] duration-300 ease-[cubic-bezier(.34,1.5,.64,1)] focus-visible:outline-2 focus-visible:outline-[#eb9360]"
                  style={{
                    background: hot ? A.paprika : "#2e2926", color: hot ? A.ink : "#e7e5e4",
                    boxShadow: rolling === i.id ? "0 0 0 3px rgba(235,147,96,.4)" : "none", transform: rolling === i.id ? "scale(1.06)" : "none",
                  }}>
                  <Icon weight="bold" className="size-4" aria-hidden />{i.name}<span className="text-sm opacity-80">Nhóm {i.control_group}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={roll} disabled={spot.isPending}
              className="flex h-12 items-center gap-2.5 rounded-xl bg-[#2e2926] px-[18px] text-[15px] font-bold whitespace-nowrap text-[#fafaf9] transition-colors duration-[250ms] hover:bg-[#3a3430] focus-visible:outline-2 focus-visible:outline-[#eb9360] disabled:cursor-wait">
              <Dices weight="duotone" className="size-[22px] text-[#eb9360]" aria-hidden style={{ animation: rolling !== null ? "a-shake .3s infinite" : "none" }} />
              Chọn ngẫu nhiên 2 nguyên liệu nhóm A
            </button>
            <button type="button" disabled={!pick.length || spot.isPending} onClick={() => spot.mutate({ ingredient_ids: pick })}
              className="flex h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-bold whitespace-nowrap transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-[#eb9360] disabled:cursor-not-allowed"
              style={{ background: pick.length ? A.paprika : "#2e2926", color: pick.length ? A.ink : "#d6d3d1" }}>
              <Play weight="bold" className="size-4" aria-hidden />Mở phiên đột xuất ({pick.length})
            </button>
          </div>
        </section>
      ) : (
        <section aria-label={`Đang kiểm kê ${counting.code}`} className="a-pop flex flex-col gap-[18px] rounded-[22px] bg-[#fdfdfc] p-6 shadow-[0_0_0_2px_#eb9360,0_20px_40px_-24px_rgba(235,147,96,.8)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-sm font-semibold text-[#7c3410]">{counting.code}</div>
              <h3 className="mt-1 font-display text-[22px] font-bold tracking-[-.02em]">Đang kiểm kê đột xuất tại {locName(counting.location)}</h3>
            </div>
            <span className="flex items-center gap-1.5 text-sm text-[#4f4a45]"><EyeOff weight="duotone" className="size-[18px]" aria-hidden />Không hiện tồn sổ khi đếm</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {counting.lines.map((l) => {
              const k = String(l.ingredient_id)
              return (
                <label key={l.id} className="flex flex-col gap-2 rounded-2xl bg-[#f5f3f1] p-4">
                  <span className="text-[15px] font-bold">{l.ingredient}</span>
                  <span className="flex items-center gap-2">
                    <input value={values[k] ?? ""} inputMode="decimal" placeholder="0"
                      onChange={(e) => { const v = e.target.value.replace(/[^\d,.]/g, ""); setValues((x) => ({ ...x, [k]: v })) }}
                      className="h-[52px] min-w-0 flex-1 rounded-xl border border-[#8a817c] bg-white px-3.5 font-display text-2xl font-bold tabular outline-none focus-visible:border-[#1c1917] focus-visible:shadow-[0_0_0_2px_#1c1917]" />
                    <span className="text-[15px] font-semibold text-[#4f4a45]">{fmtUnit(l.unit)}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="flex gap-2.5">
            <Btn kind="soft" onClick={() => setCounting(null)}>Để sau</Btn>
            <Btn kind="primary" icon={LockSimple} disabled={!filled || submit.isPending} onClick={() => submit.mutate(undefined)}>Chốt kiểm kê</Btn>
          </div>
        </section>
      )}

      <div className={`a-rise overflow-x-auto ${CARD}`} style={{ animationDelay: "100ms" }}>
        {q.isLoading ? <div className="p-6"><Loading /></div> : (
          <div className="min-w-[1000px]" role="table" aria-label="Các phiên kiểm kê">
            <div role="row" className="grid gap-3.5 border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]" style={{ gridTemplateColumns: S_COLS }}>
              <span role="columnheader">Mã</span><span role="columnheader">Hình thức</span><span role="columnheader">Vị trí</span><span role="columnheader">Chốt lúc</span>
              <span role="columnheader">Người đếm</span><span role="columnheader">Mức cao nhất</span><span role="columnheader" className="text-right">Giá trị lệch</span><span role="columnheader">Duyệt</span>
            </div>
            {(q.data ?? []).length === 0 && <EmptyNote>Chưa có phiên kiểm kê</EmptyNote>}
            {(q.data ?? []).map((s, i) => {
              const t = worstTier(s)
              const val = s.lines.reduce((a, l) => a + Number(l.variance_value ?? 0), 0)
              const pend = !s.reviewed_by && s.kind === "periodic" && s.status === "locked"
              return (
                <button key={s.id} type="button" role="row" onClick={() => setView(s)}
                  className="a-rise grid min-h-[62px] w-full cursor-pointer items-center gap-3.5 border-b border-[#efedeb] bg-transparent px-6 py-3.5 text-left text-sm tabular transition-colors duration-[250ms] hover:bg-[#f7f4f1] focus-visible:bg-[#f7f4f1] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1c1917]"
                  style={{ gridTemplateColumns: S_COLS, animationDuration: ".55s", ...delay(i, 100, 40) }}>
                  <span role="cell" className="font-mono font-semibold">{s.code}</span>
                  <span role="cell" className="font-semibold">{s.kind_label}</span>
                  <span role="cell">{locName(s.location)}</span>
                  <span role="cell">{s.status === "open" ? <Pill bg={A.warnBg} c={A.warn} icon={AlertTriangle}>Đang mở</Pill> : dateTime(s.cutoff_at)}</span>
                  <span role="cell">{s.counted_by ?? "-"}</span>
                  <span role="cell">{t ? <TierPill tier={t} /> : "-"}</span>
                  <span role="cell" className="text-right font-bold">{s.lines.some((l) => l.variance_value !== undefined) ? money(val) : "-"}</span>
                  <span role="cell">{s.reviewed_by ? s.reviewed_by : pend ? <Pill bg={A.warnBg} c={A.warn} icon={Eye}>Chờ duyệt</Pill> : "-"}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={!!view} onClose={() => setView(null)}
        kicker={view?.code}
        title={view ? `${view.kind_label}, ${locName(view.location)}` : ""}
        meta={view ? [
          `Người đếm ${view.counted_by ?? "-"}`,
          view.status === "open" ? "đang mở" : `chốt ${dateTime(view.cutoff_at)}`,
          view.shift ? view.shift.name : "ngoài ca",
          view.reviewed_by ? `đã duyệt bởi ${view.reviewed_by}` : "",
          view.note,
        ].filter(Boolean).join(", ") : undefined}
        footer={view && view.status === "locked" ? (
          <>
            {!view.reviewed_by && <Btn kind="accent" icon={Eye} disabled={review.isPending} onClick={() => review.mutate(view.id)}>Duyệt phiên</Btn>}
            <Btn kind="soft" icon={RotateCcw} disabled={correction.isPending} onClick={async () => {
              const n = await ask.reason({ title: "Tạo phiên điều chỉnh?", description: "Dùng khi phát hiện phiên này đếm sai. Phiên gốc giữ nguyên để truy vết.", placeholder: "Lý do (phát hiện đếm sai…)", confirmLabel: "Tạo phiên" })
              if (n) correction.mutate({ id: view.id, note: n })
            }}>Tạo phiên điều chỉnh</Btn>
          </>
        ) : undefined}>
        {view && (
          <div className="overflow-x-auto">
            <div className="min-w-[760px] text-sm tabular" role="table" aria-label={`Chi tiết ${view.code}`}>
              <div role="row" className="grid gap-2.5 border-b border-[#e2ded9] py-2.5 font-semibold text-[#4f4a45]" style={{ gridTemplateColumns: L_COLS }}>
                <span role="columnheader">Nguyên liệu</span><span role="columnheader" className="text-right">Lý thuyết kỳ</span><span role="columnheader" className="text-right">Tồn sổ</span>
                <span role="columnheader" className="text-right">Thực đếm</span><span role="columnheader" className="text-right">Chênh lệch</span><span role="columnheader" className="text-right">%</span>
                <span role="columnheader" className="text-right">Giá trị</span><span role="columnheader">Mức</span>
              </div>
              {view.lines.map((l, i) => {
                const v = l.variance_qty === undefined || l.variance_qty === null ? null : Number(l.variance_qty)
                return (
                  <div key={l.id} role="row" className="a-slide grid items-center gap-2.5 border-b border-[#efedeb] py-3" style={{ gridTemplateColumns: L_COLS, animationDuration: ".45s", animationDelay: `${i * 50}ms` }}>
                    <span role="cell" className="flex items-center gap-2 font-bold">{l.ingredient}<GroupChip group={l.group} /></span>
                    <span role="cell" className="text-right">{Number(l.theoretical_qty ?? 0) ? qty(l.theoretical_qty, l.unit) : "-"}</span>
                    <span role="cell" className="text-right">{qty(l.book_qty, l.unit)}</span>
                    <span role="cell" className="text-right">{qty(l.counted_qty, l.unit)}</span>
                    <span role="cell" className="text-right font-bold" style={{ color: v === null || v === 0 ? A.ink : v > 0 ? A.bad : A.surplusText }}>{v === 0 ? "0" : signedQty(l.variance_qty, l.unit)}</span>
                    <span role="cell" className="text-right">{pct(l.variance_pct)}</span>
                    <span role="cell" className="text-right">{money(l.variance_value)}</span>
                    <span role="cell">{l.tier ? <TierPill tier={l.tier} /> : "-"}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---- Tồn sổ ----

interface StockRow {
  id: number; code: string; name: string; group: "A" | "C"; unit: string; kho: number; bep: number; total: number; value: number
  min_stock: number; below_min: boolean; portions: { dish: string; portions: number | null }[]
}

const T_COLS = "minmax(180px,1.4fr) 120px 120px 130px 130px 170px minmax(220px,1.6fr)"

export function StockPage() {
  const q = useQuery({ queryKey: ["stock"], queryFn: () => api.get<{ rows: StockRow[]; cache_mismatch: unknown[] }>("/stock") })
  const [filter, setFilter] = useState("")
  const [grp, setGrp] = useState<"all" | "A" | "C">("all")
  const [mode, setMode] = useState<"chart" | "table">("chart")
  const all = q.data?.rows ?? []
  const rows = all.filter((r) => (grp === "all" || r.group === grp) && r.name.toLowerCase().includes(filter.toLowerCase()))
  const totalValue = all.reduce((a, r) => a + Number(r.value), 0)
  const belowN = all.filter((r) => r.below_min).length

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <div className="a-rise flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[clamp(34px,3.2vw,46px)] leading-none font-bold tracking-[-.035em]">Tồn sổ</h1>
          <p className="mt-3 max-w-[680px] text-[15px] leading-[1.55] text-pretty text-[#4f4a45]">
            Số hệ thống tự tính từ sổ giao dịch, chỉ quản lý thấy. Số phần còn làm được bằng tồn sổ Kho cộng Bếp chia định lượng một phần, dùng để tham khảo khi bếp báo hết.
          </p>
        </div>
        <div className="flex gap-7">
          <HeadStat label="Giá trị tồn" value={q.data ? moneyShort(totalValue) : "-"} />
          <HeadStat label="Dưới tối thiểu" value={q.data ? belowN : "-"} color={A.warn} />
        </div>
      </div>

      {q.data && q.data.cache_mismatch.length > 0 && (
        <div role="alert" className="a-rise flex items-center gap-2.5 rounded-2xl bg-[#fbe4e4] px-4 py-3 text-sm font-semibold text-[#8f1a1a]">
          <ShieldAlert weight="bold" className="size-5 shrink-0" aria-hidden />Bản cache tồn lệch với sổ giao dịch ở {q.data.cache_mismatch.length} dòng
        </div>
      )}

      <div className="a-rise flex flex-wrap items-center gap-2.5" style={{ animationDelay: "50ms" }}>
        <label className="flex h-12 min-w-[280px] items-center gap-2.5 rounded-[14px] bg-[#fdfdfc] px-3.5 shadow-[0_0_0_1px_#8a817c] focus-within:shadow-[0_0_0_2px_#1c1917]">
          <ScanSearch weight="bold" className="size-[18px] text-[#4f4a45]" aria-hidden />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc nguyên liệu" aria-label="Lọc nguyên liệu"
            className="flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-[#4f4a45]" />
        </label>
        <Seg label="Nhóm kiểm soát" value={grp} onChange={setGrp}
          options={[{ key: "all", label: "Tất cả" }, { key: "A", label: "Nhóm A" }, { key: "C", label: "Nhóm C" }]} />
        <div className="ml-auto"><ViewToggle value={mode} onChange={setMode} /></div>
      </div>

      {q.isLoading ? <Loading /> : rows.length === 0 ? (
        <div className={CARD}><EmptyNote icon={ScanSearch}>Không có nguyên liệu khớp bộ lọc</EmptyNote></div>
      ) : mode === "chart" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5">
          {rows.map((s, i) => {
            const kho = Number(s.kho), bep = Number(s.bep), tot = Number(s.total), min = Number(s.min_stock)
            const cap = min > 0 ? min * 3 : Math.max(tot, 1)
            const wKho = Math.min(100, (Math.max(kho, 0) / cap) * 100)
            const wBep = Math.min(100 - wKho, (Math.max(bep, 0) / cap) * 100)
            return (
              <div key={s.id}
                className="a-rise flex flex-col gap-3.5 rounded-[20px] bg-[#fdfdfc] p-5 shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-12px_rgba(41,37,36,.16),0_0_0_1px_rgba(28,25,23,.05)] transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px] hover:shadow-[0_2px_4px_rgba(41,37,36,.06),0_22px_40px_-22px_rgba(41,37,36,.36),0_0_0_1px_rgba(28,25,23,.06)]"
                style={{ animationDuration: ".6s", ...delay(i, 80, 40) }}>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2"><span className="text-base font-bold">{s.name}</span><GroupChip group={s.group} /></div>
                  {s.below_min && <Pill bg={A.warnBg} c={A.warn} icon={AlertTriangle}>Dưới tối thiểu</Pill>}
                </div>
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="font-display text-[34px] font-bold tracking-[-.03em] tabular">{qty(s.total, s.unit)}</span>
                  <span className="text-[15px] font-bold tabular">{money(s.value)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div aria-hidden className="relative flex h-2.5 overflow-hidden rounded-full bg-[#f2f0ee]">
                    <span className="a-growX bg-[#1c1917]" style={{ width: `${wKho}%`, animationDelay: `${300 + i * 40}ms` }} />
                    <span className="a-growX bg-[#eb9360]" style={{ width: `${wBep}%`, animationDelay: `${300 + i * 40}ms` }} />
                    {min > 0 && <span className="absolute top-0 bottom-0 w-0.5 bg-[#a11d1d]" style={{ left: "33.3%" }} />}
                  </div>
                  <div className="flex justify-between gap-2 text-sm text-[#4f4a45] tabular">
                    <span>Kho {qty(s.kho, s.unit)}, Bếp {Number(s.bep) ? qty(s.bep, s.unit) : "0"}</span>
                    <span>Tối thiểu {min > 0 ? qty(s.min_stock, s.unit) : "-"}</span>
                  </div>
                </div>
                {s.portions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.portions.map((p) => (
                      <span key={p.dish} className="flex h-[30px] items-center gap-1.5 rounded-[9px] bg-[#f5f3f1] px-2.5 text-sm">
                        <span>{p.dish}</span><span className="font-extrabold tabular">{p.portions === null ? "-" : `${p.portions} phần`}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className={`a-fade overflow-x-auto ${CARD}`}>
          <div className="min-w-[1100px]" role="table" aria-label="Tồn sổ theo vị trí">
            <div role="row" className="grid gap-3.5 border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]" style={{ gridTemplateColumns: T_COLS }}>
              <span role="columnheader">Nguyên liệu</span><span role="columnheader" className="text-right">Tại Kho</span><span role="columnheader" className="text-right">Tại Bếp</span>
              <span role="columnheader" className="text-right">Tổng</span><span role="columnheader" className="text-right">Giá trị</span><span role="columnheader">Tồn tối thiểu</span>
              <span role="columnheader">Số phần còn làm được</span>
            </div>
            {rows.map((s) => (
              <div key={s.id} role="row" className="grid min-h-[60px] items-center gap-3.5 border-b border-[#efedeb] px-6 py-3 text-sm tabular transition-colors duration-200 hover:bg-[#f7f4f1]" style={{ gridTemplateColumns: T_COLS }}>
                <span role="cell" className="flex items-center gap-2 font-bold">{s.name}<GroupChip group={s.group} /></span>
                <span role="cell" className="text-right">{qty(s.kho, s.unit)}</span>
                <span role="cell" className="text-right">{qty(s.bep, s.unit)}</span>
                <span role="cell" className="text-right font-bold">{qty(s.total, s.unit)}</span>
                <span role="cell" className="text-right">{money(s.value)}</span>
                <span role="cell">{s.below_min ? <Pill bg={A.warnBg} c={A.warn} icon={AlertTriangle}>Dưới {qty(s.min_stock, s.unit)}</Pill> : Number(s.min_stock) > 0 ? qty(s.min_stock, s.unit) : "-"}</span>
                <span role="cell">{s.portions.length ? s.portions.map((p) => `${p.dish} ${p.portions ?? "-"}`).join(", ") : "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
