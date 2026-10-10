/**
 * Chứng từ của quản lý theo thiết kế "Admin Kho Dinh Muc" (Claude Design): Phiếu nhập, Phiếu hao hụt, Ca và bàn giao.
 * Dữ liệu thật từ /receipts, /waste, /shifts, /reports/shifts, /handovers. Sửa sai luôn là giao dịch mới có liên kết.
 */
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState, type CSSProperties } from "react"

import { useAsk } from "@/components/ask"
import { Loading } from "@/components/common"
import {
  AlertTriangle, Ban, CalendarX, Check, CheckCircle2, FileSearch, HourglassMedium, Info, Knife, Leaf, Link2, NotePencil,
  PackageCheck, RotateCcw, SealCheck, ShieldAlert, ShoppingBasket, Siren, Utensils, Wine, X, type IconType,
} from "@/components/icons"
import { A, Btn, CARD, Code, EmptyNote, FilterPills, HeadStat, Modal, PageHead, Pill, adminToast, delay } from "@/layouts/AdminBits"
import { api } from "@/lib/api"
import { dateOnly, dateTime, longClock, money, num, qty, signedQty, time, unit } from "@/lib/format"
import type { Handover, Receipt, Shift, Tier, WasteSlip } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { WASTE_STATUS } from "@/pages/ops/WastePage"

/** Ô nhập của thiết kế: viền #8a817c (3 : 1 với nền), cao 44px. */
const INPUT = "h-11 rounded-xl border border-[#8a817c] bg-white px-3 text-[15px] font-medium text-[#1c1917] placeholder:text-[#6b645e]"
const dm = (v: string | null | undefined) => (v ? dateOnly(v).slice(0, 5) : "-")
const slideRow = "motion-safe:transition-[max-height,opacity,transform] motion-safe:duration-[450ms] motion-safe:ease-[cubic-bezier(.16,1,.3,1)]"

/* ---------------- Phiếu nhập ---------------- */

const RECEIPT_STATUS: Record<Receipt["status"], { label: string; bg: string; c: string; icon: IconType }> = {
  draft: { label: "Nháp", bg: A.line2, c: A.sub, icon: NotePencil },
  received: { label: "Đã nhận", bg: A.okBg, c: A.ok, icon: PackageCheck },
  pending_approval: { label: "Chờ duyệt", bg: A.warnBg, c: A.warn, icon: HourglassMedium },
  approved: { label: "Đã duyệt", bg: "#e4eefb", c: "#1d4f91", icon: SealCheck },
  cancelled: { label: "Đã hủy", bg: A.line2, c: A.sub, icon: Ban },
}
const R_TABS = [
  { key: "pending_approval", label: "Chờ duyệt" },
  { key: "received", label: "Đã nhận" },
  { key: "approved", label: "Đã duyệt" },
  { key: "draft", label: "Nháp" },
  { key: "all", label: "Tất cả" },
] as const
type RTab = (typeof R_TABS)[number]["key"]

const lineQty = (l: Receipt["lines"][number]) => Number(l.received_qty ?? l.ordered_qty)
const receiptTotal = (r: Receipt) => r.lines.reduce((s, l) => s + lineQty(l) * Number(l.unit_price), 0)

export function ReceiptsAdminPage() {
  const [tab, setTab] = useState<RTab>("pending_approval")
  // Lấy 100 phiếu gần nhất một lần rồi lọc tại chỗ để chip lọc có số đếm.
  const q = useQuery({ queryKey: ["receipts", "all"], queryFn: () => api.get<Receipt[]>("/receipts") })
  const [snap, setSnap] = useState<Receipt | null>(null)
  const view = snap ? (q.data?.find((r) => r.id === snap.id) ?? snap) : null
  const [fixId, setFixId] = useState<number | null>(null)
  const [fixQty, setFixQty] = useState("")
  const [fixReason, setFixReason] = useState("")
  const approve = useAction((id: number) => api.post<Receipt>(`/receipts/${id}/approve`, { note: "" }), {
    invalidate: [["receipts"], ["dashboard"]],
    onSuccess: (r) => { setSnap(r); adminToast(`Đã duyệt ${r.code}`) },
  })
  const correct = useAction(() => api.post<Receipt>(`/receipt-lines/${fixId}/correct`, { correct_qty: Number(fixQty), reason: fixReason.trim() }), {
    invalidate: [["receipts"]],
    onSuccess: (r) => { setSnap(r); setFixId(null); setFixQty(""); setFixReason(""); adminToast("Đã tạo điều chỉnh có liên kết tới phiếu gốc") },
  })
  const all = q.data ?? []
  const count = (k: RTab) => (k === "all" ? all.length : all.filter((r) => r.status === k).length)
  const list = all.filter((r) => tab === "all" || r.status === tab)
  const canFix = fixQty !== "" && Number.isFinite(Number(fixQty)) && !!fixReason.trim() && !correct.isPending
  const open = (r: Receipt) => { setSnap(r); setFixId(null) }

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Phiếu nhập" desc="Tồn Kho tăng ngay khi thủ kho xác nhận Đã nhận. Phiếu lệch số đặt, lệch đơn giá hoặc lệch lớn so với lịch sử nhập chuyển Chờ duyệt. Sửa sai bằng điều chỉnh có liên kết, không sửa bản gốc." />
      <div className="a-rise" style={{ animationDelay: "50ms" }}>
        <FilterPills label="Lọc phiếu theo trạng thái" value={tab} onChange={setTab} items={R_TABS.map((t) => ({ ...t, n: q.data ? count(t.key) : undefined }))} />
      </div>
      {q.isLoading ? <Loading /> : (
        <div className="flex flex-col gap-3">
          {list.map((r, i) => {
            const st = RECEIPT_STATUS[r.status]
            const pending = r.status === "pending_approval"
            return (
              <button key={r.id} type="button" onClick={() => open(r)} style={delay(i, 80, 50)}
                className="a-rise grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] rounded-[20px] bg-[#fdfdfc] px-[22px] py-[18px] text-left shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-12px_rgba(41,37,36,.16),0_0_0_1px_rgba(28,25,23,.05)] transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px] hover:shadow-[0_2px_4px_rgba(41,37,36,.06),0_22px_40px_-22px_rgba(41,37,36,.36),0_0_0_1px_rgba(28,25,23,.06)]">
                <span className="flex size-[52px] items-center justify-center rounded-[15px]" style={{ background: pending ? A.warnBg : "#f2f0ee", color: pending ? A.warn : A.ink }}>
                  <ShoppingBasket weight="duotone" className="size-[26px]" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2.5"><Code>{r.code}</Code><span className="text-base font-bold">{r.supplier}</span></span>
                  <span className="text-sm text-[#4f4a45]">
                    {r.received_at ? `Nhận ${dateTime(r.received_at)} bởi ${r.received_by ?? "-"}` : r.order_date ? `Đặt cho ngày ${dm(r.order_date)}, chưa nhận` : "Chưa nhận"}
                  </span>
                  <span className="text-sm">{r.lines.map((l) => `${l.ingredient} ${num(lineQty(l), 1)} ${unit(l.unit)}`).join(", ")}</span>
                  {r.anomalies.length > 0 && (
                    <span className="flex items-start gap-1.5 text-sm font-semibold text-[#6b4300]"><AlertTriangle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />{r.anomalies.join("; ")}</span>
                  )}
                </span>
                <span className="flex flex-col items-end gap-2">
                  <Pill bg={st.bg} c={st.c} icon={st.icon} className="h-[30px] px-3">{st.label}</Pill>
                  <span className="text-base font-bold tabular">{money(receiptTotal(r))}</span>
                </span>
              </button>
            )
          })}
          {!list.length && <div className={cn(CARD, "a-fade")}><EmptyNote>Không có phiếu</EmptyNote></div>}
        </div>
      )}

      <Modal open={!!view} onClose={() => setSnap(null)} width={900} kicker={view?.code} title={view?.supplier ?? ""}
        meta={view ? `Tạo bởi ${view.created_by}${view.received_at ? `, nhận ${dateTime(view.received_at)} bởi ${view.received_by ?? "-"}` : ""}${view.approved_by ? `, duyệt bởi ${view.approved_by}` : ""}` : undefined}
        footer={view && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-[#4f4a45]">Điều chỉnh tạo giao dịch mới trỏ tới dòng phiếu gốc; bản gốc giữ nguyên.</span>
            <span className="flex flex-wrap gap-2.5">
              {view.invoice_image && (
                <a href={`/api/uploads/${view.invoice_image}`} target="_blank" rel="noreferrer"
                  className="inline-flex h-12 items-center rounded-xl px-4 text-[15px] font-bold text-[#7c3410] underline-offset-4 hover:bg-[#fbeae0] hover:underline">Xem ảnh hóa đơn</a>
              )}
              {view.status === "pending_approval" && <Btn kind="accent" icon={Check} disabled={approve.isPending} onClick={() => approve.mutate(view.id)}>Duyệt phiếu</Btn>}
            </span>
          </div>
        )}>
        {view && (
          <>
            {view.anomalies.length > 0 && (
              <div className="flex gap-2.5 rounded-xl bg-[#fdf0d2] px-3.5 py-3 text-sm font-semibold text-[#6b4300]">
                <AlertTriangle weight="duotone" className="size-5 shrink-0" aria-hidden /><span className="min-w-0 flex-1">{view.anomalies.join("; ")}</span>
              </div>
            )}
            <div className="overflow-x-auto pt-2">
              <div className="min-w-[760px] text-sm tabular">
                <div className="grid grid-cols-[1.4fr_90px_90px_100px_120px_120px_120px] gap-2.5 border-b border-[#e2ded9] py-2.5 font-semibold text-[#4f4a45]">
                  <span>Nguyên liệu</span><span className="text-right">Đặt</span><span className="text-right">Nhận</span><span className="text-right">Quy đổi</span>
                  <span className="text-right">Đơn giá</span><span className="text-right">Điều chỉnh LK</span><span />
                </div>
                {view.lines.map((l) => {
                  const fixing = fixId === l.id
                  return (
                    <div key={l.id} className="flex flex-col border-b border-[#efedeb]">
                      <div className="grid grid-cols-[1.4fr_90px_90px_100px_120px_120px_120px] items-center gap-2.5 py-3">
                        <span className="flex flex-col gap-0.5"><span className="font-bold">{l.ingredient}</span>{l.diff_reason && <span className="text-[#4f4a45]">Lý do lệch: {l.diff_reason}</span>}</span>
                        <span className="text-right">{num(l.ordered_qty, 1)} {unit(l.unit)}</span>
                        <span className="text-right">{l.received_qty !== null ? `${num(l.received_qty, 1)} ${unit(l.unit)}` : "-"}</span>
                        <span className="text-right">{qty(l.received_qty_base, l.base_unit)}</span>
                        <span className="text-right">{money(l.unit_price)}</span>
                        <span className="text-right font-bold">{Number(l.linked_adjustment) ? signedQty(l.linked_adjustment, l.base_unit) : "-"}</span>
                        <span className="text-right">
                          {l.received_qty !== null && (
                            <button type="button" aria-expanded={fixing} onClick={() => { setFixId(fixing ? null : l.id); setFixQty(""); setFixReason("") }}
                              className="inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3 font-bold whitespace-nowrap text-[#7c3410] transition-colors hover:bg-[#fbeae0]">
                              <Link2 weight="bold" className="size-4" aria-hidden />Điều chỉnh
                            </button>
                          )}
                        </span>
                      </div>
                      {fixing && (
                        <div className="a-rise flex flex-wrap items-end gap-2.5 pb-3.5" style={{ animationDuration: ".35s" }}>
                          <label className="flex flex-col gap-1.5 text-sm font-semibold">Số nhận đúng ({unit(l.unit)})
                            <input autoFocus inputMode="decimal" value={fixQty} onChange={(e) => setFixQty(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))} className={cn(INPUT, "w-[140px]")} />
                          </label>
                          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-sm font-semibold">Lý do
                            <input value={fixReason} onChange={(e) => setFixReason(e.target.value)} placeholder="Theo hóa đơn số..." className={INPUT} />
                          </label>
                          <button type="button" disabled={!canFix} onClick={() => correct.mutate(undefined)}
                            className="h-11 rounded-xl bg-[#1c1917] px-4 text-sm font-bold whitespace-nowrap text-[#fafaf9] transition-colors disabled:bg-[#e9e6e3] disabled:text-[#4f4a45]">
                            Tạo điều chỉnh
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

/* ---------------- Phiếu hao hụt ---------------- */

const W_TABS = [
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
  { key: "all", label: "Tất cả" },
] as const
type WTab = (typeof W_TABS)[number]["key"]
const isPending = (s: WasteSlip) => s.status === "pending_chef" || s.status === "pending_manager"
const inTab = (s: WasteSlip, t: WTab) => t === "all" || (t === "pending" ? isPending(s) : s.status === t)
const WASTE_ICON: Record<string, IconType> = {
  do_vo_roi: Wine, lam_lai: RotateCcw, lam_sai_mon: RotateCcw, khach_huy_sau_che_bien: Ban, hong_so_che: Knife,
  het_han: CalendarX, hong_bao_quan: Leaf, dung_noi_bo: Utensils, tang_khach: Utensils, khac: Info,
}
const LOC: Record<string, string> = { kho: "Kho", bep: "Bếp" }
const REJECT_PRESETS = ["Không đúng thực tế", "Sai nguyên liệu", "Sai lượng"]

export function WasteAdminPage() {
  const ask = useAsk()
  const [tab, setTab] = useState<WTab>("pending")
  const q = useQuery({ queryKey: ["waste", "admin", "all"], queryFn: () => api.get<WasteSlip[]>("/waste") })
  const [asking, setAsking] = useState<number | null>(null)
  /** Phiếu vừa xử lý: giữ lại tại chỗ 0,45 giây để thu gọn rồi rời khỏi nhóm đang lọc. */
  const [leaving, setLeaving] = useState<Record<number, boolean>>({})
  const leave = (id: number) => {
    setLeaving((x) => ({ ...x, [id]: true }))
    window.setTimeout(() => setLeaving((x) => { const y = { ...x }; delete y[id]; return y }), 450)
  }
  const approve = useAction((s: WasteSlip) => api.post(`/waste/${s.id}/approve`).then(() => s), {
    invalidate: [["waste"], ["dashboard"]],
    onSuccess: (s) => { leave(s.id); adminToast(`Đã duyệt hao hụt ${s.ingredient} ${qty(s.qty, s.unit)}`) },
  })
  const reject = useAction((v: { s: WasteSlip; note: string }) => api.post(`/waste/${v.s.id}/reject`, { note: v.note }).then(() => v), {
    invalidate: [["waste"], ["dashboard"]],
    onSuccess: (v) => { leave(v.s.id); adminToast(`Đã từ chối hao hụt ${v.s.ingredient}, đảo lại tồn (${v.note})`) },
  })
  const doReject = (s: WasteSlip, note: string) => { setAsking(null); reject.mutate({ s, note }) }
  const other = async (s: WasteSlip) => {
    const n = await ask.reason({ title: `Từ chối phiếu ${s.ingredient}?`, description: "Hao hụt sẽ được đảo lại vào tồn.", presets: REJECT_PRESETS, confirmLabel: "Từ chối", danger: true })
    if (n) doReject(s, n)
  }

  const all = q.data ?? []
  const list = all.filter((s) => inTab(s, tab) || leaving[s.id])
  const pendVal = all.filter(isPending).reduce((a, s) => a + Number(s.value), 0)

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Phiếu hao hụt"
        desc="Hao hụt ghi tại thời điểm xảy ra, có loại và lý do. Trong hạn mức bếp trưởng duyệt, vượt hạn mức quản lý duyệt. Từ chối là đảo lại bằng giao dịch mới."
        right={<HeadStat label="Giá trị chờ duyệt" value={q.data ? money(pendVal) : "-"} />} />
      <div className="a-rise" style={{ animationDelay: "50ms" }}>
        <FilterPills label="Lọc phiếu theo trạng thái" value={tab} onChange={(t) => { setTab(t); setAsking(null) }}
          items={W_TABS.map((t) => ({ ...t, n: q.data ? all.filter((s) => inTab(s, t.key)).length : undefined }))} />
      </div>
      {q.isLoading ? <Loading /> : (
        <div className={cn(CARD, "a-rise overflow-hidden")} style={{ animationDelay: "100ms" }}>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {list.map((s, i) => {
                const lv = !!leaving[s.id]
                const pending = isPending(s)
                const Icon = WASTE_ICON[s.waste_type] ?? FileSearch
                const done = s.status === "approved" || s.status === "rejected"
                return (
                  <div key={s.id} className={cn("flex flex-col overflow-hidden", i > 0 && "border-t border-[#efedeb]", slideRow)}
                    style={{ maxHeight: lv ? 0 : 320, opacity: lv ? 0 : 1, transform: lv ? "translateX(40px)" : "none" }}>
                    <div className="grid grid-cols-[48px_minmax(180px,1.4fr)_minmax(150px,1fr)_120px_minmax(140px,auto)] items-center gap-4 px-[22px] py-4 text-sm">
                      <span className="flex size-12 items-center justify-center rounded-[14px] bg-[#f2f0ee]"><Icon weight="duotone" className="size-6" aria-hidden /></span>
                      <span className="flex flex-col gap-[3px]">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold">{s.ingredient}</span>
                          <span className="font-bold tabular">{qty(s.qty, s.unit)}</span>
                          <span className="text-[#4f4a45]">tại {LOC[s.location] ?? s.location}</span>
                        </span>
                        <span className="text-[#4f4a45]">{s.type_label}{s.reason ? `: ${s.reason}` : ""}</span>
                        {s.status === "pending_manager" && (
                          <span className="flex items-center gap-1.5 font-semibold text-[#6b4300]"><AlertTriangle weight="bold" className="size-4" aria-hidden />Vượt hạn mức, quản lý duyệt</span>
                        )}
                      </span>
                      <span className="flex flex-col gap-[3px]"><span>Ghi bởi {s.created_by}</span><span className="font-mono text-[#4f4a45]">{dateTime(s.at)}</span></span>
                      <span className="text-right text-[15px] font-bold tabular">{money(s.value)}</span>
                      <span className="flex items-center justify-end gap-2">
                        {pending && !lv && (
                          <>
                            <button type="button" aria-expanded={asking === s.id} onClick={() => setAsking(asking === s.id ? null : s.id)} disabled={reject.isPending}
                              className="h-11 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap text-[#8f1a1a] transition-colors hover:bg-[#fbe4e4]">Từ chối</button>
                            <button type="button" onClick={() => approve.mutate(s)} disabled={approve.isPending}
                              className="flex h-11 items-center gap-1.5 rounded-xl bg-[#1c1917] px-4 text-sm font-bold whitespace-nowrap text-[#fafaf9] transition-transform duration-[250ms] active:scale-[.96] disabled:opacity-80">
                              <Check weight="bold" className="size-4" aria-hidden />Duyệt
                            </button>
                          </>
                        )}
                        {done && (
                          <Pill className="h-[30px] px-3" icon={s.status === "approved" ? Check : X}
                            bg={s.status === "approved" ? A.okBg : A.badBg} c={s.status === "approved" ? A.ok : A.bad}>
                            {s.status === "approved" ? "Đã duyệt" : "Đã từ chối"}{s.approved_by ? `, ${s.approved_by}` : ""}
                          </Pill>
                        )}
                        {pending && lv && <span className="sr-only">{WASTE_STATUS[s.status].label}</span>}
                      </span>
                    </div>
                    {asking === s.id && pending && (
                      <div className="a-rise flex flex-wrap items-center gap-2 pr-[22px] pb-4 pl-[86px]" style={{ animationDuration: ".35s" }}>
                        <span className="text-sm font-semibold text-[#4f4a45]">Lý do từ chối, hao hụt sẽ đảo lại vào tồn:</span>
                        {REJECT_PRESETS.map((p) => (
                          <button key={p} type="button" onClick={() => doReject(s, p)}
                            className="h-11 rounded-full bg-[#fbe4e4] px-3.5 text-sm font-bold whitespace-nowrap text-[#8f1a1a] transition-colors hover:bg-[#f6d0d0]">{p}</button>
                        ))}
                        <button type="button" onClick={() => other(s)} className="h-11 rounded-[10px] px-3 text-sm font-bold whitespace-nowrap text-[#8f1a1a] underline-offset-4 hover:underline">Lý do khác</button>
                        <button type="button" onClick={() => setAsking(null)} className="h-11 rounded-[10px] px-3 text-sm font-semibold whitespace-nowrap text-[#4f4a45] hover:bg-[#f2f0ee]">Thôi</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {!list.length && <EmptyNote>Không có phiếu trong nhóm này</EmptyNote>}
        </div>
      )}
    </div>
  )
}

/* ---------------- Ca và bàn giao ---------------- */

interface ShiftReportRow { id: number; variance_value: number | string; worst_tier: Tier; investigations: number }

const HO_STATUS: Record<Handover["status"], { label: string; bg: string; c: string; dot: string; icon: IconType }> = {
  pending: { label: "Chờ ký", bg: A.warnBg, c: A.warn, dot: "#fab219", icon: HourglassMedium },
  signed: { label: "Đã ký", bg: A.okBg, c: A.ok, dot: "#0ca30c", icon: Check },
  cancelled: { label: "Đã hủy", bg: A.line2, c: A.sub, dot: "#a8a29e", icon: Ban },
}
const HO_PAGE = 10

/** Phút trong ngày theo giờ VN của giờ bắt đầu ca (để xếp cột Ca sáng trước Ca chiều). */
const startMinutes = (s: Shift) => { const [h, m] = time(s.planned_start).split(":").map(Number); return h * 60 + m }

export function ShiftsPage() {
  const shifts = useQuery({ queryKey: ["shifts", 7], queryFn: () => api.get<Shift[]>("/shifts?days=7") })
  const report = useQuery({ queryKey: ["r-shifts", "ca-7"], queryFn: () => api.get<ShiftReportRow[]>("/reports/shifts") })
  const handovers = useQuery({ queryKey: ["handovers"], queryFn: () => api.get<Handover[]>("/handovers") })
  const [showAll, setShowAll] = useState(false)

  const byId = useMemo(() => new Map((report.data ?? []).map((r) => [r.id, r])), [report.data])
  const grid = useMemo(() => {
    const list = shifts.data ?? []
    const cols = new Map<string, Shift>()
    for (const s of [...list].sort((a, b) => startMinutes(a) - startMinutes(b))) if (!cols.has(s.name)) cols.set(s.name, s)
    const days = [...new Set(list.map((s) => s.business_date))].sort().reverse()
    return {
      cols: [...cols.values()],
      days: days.map((d) => ({ date: d, cells: [...cols.keys()].map((n) => list.find((s) => s.business_date === d && s.name === n) ?? null) })),
    }
  }, [shifts.data])
  const tmpl = { gridTemplateColumns: `90px repeat(${Math.max(1, grid.cols.length)}, minmax(0,1fr))` } as CSSProperties
  const hos = handovers.data ?? []

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Ca và bàn giao" desc="Kỳ đo nhóm A tại Bếp là một ca: từ lúc bếp trưởng ký nhận bàn giao đến lúc thủ kho cân trả. Chênh lệch ca gắn với người đã ký nhận." />
      <div className="flex flex-wrap items-start gap-4">
        <section className={cn(CARD, "a-rise flex min-w-0 flex-[1.2_1_520px] flex-col gap-3.5 p-6")} style={{ animationDelay: "50ms" }}>
          <h3 className="m-0 font-display text-xl font-bold tracking-[-.02em]">Bảng ca 7 ngày</h3>
          {shifts.isLoading ? <Loading rows={4} /> : (
            <>
              <div className="grid gap-2 text-sm font-semibold text-[#4f4a45]" style={tmpl}>
                <span />{grid.cols.map((c) => <span key={c.name}>{c.name} {time(c.planned_start)}-{time(c.planned_end)}</span>)}
              </div>
              {grid.days.map((dy, i) => (
                <div key={dy.date} className="a-slide grid items-stretch gap-2" style={{ ...tmpl, animationDuration: ".5s", ...delay(i, 60, 50) }}>
                  <span className="flex flex-col justify-center"><span className="text-[15px] font-bold">{dm(dy.date)}</span><span className="text-sm text-[#4f4a45]">{longClock(dy.date).split(" ")[0]}</span></span>
                  {dy.cells.map((s, k) => {
                    if (!s) return <div key={k} className="rounded-xl bg-[#f5f3f1] px-3 py-2.5 text-sm text-[#4f4a45]">-</div>
                    const r = byId.get(s.id)
                    const open = s.status === "open", closed = s.status === "closed"
                    const tier = closed ? r?.worst_tier : undefined
                    const bg = open ? A.paprikaSoft : s.sod_violation ? "#fbefee" : tier === "must" ? "#fdf3f2" : tier === "warn" ? "#fdf8ea" : "#f5f3f1"
                    return (
                      <div key={s.id} className="flex flex-col gap-1 rounded-xl px-3 py-2.5" style={{ background: bg, boxShadow: open ? `0 0 0 2px ${A.paprika}` : "none" }}>
                        <span className="flex items-center justify-between gap-1.5">
                          <span className="text-sm font-bold">{s.head_chef ?? "Chưa có bếp trưởng"}</span>
                          {s.sod_violation && (
                            <span title={s.sod_notes || "Kiêm nhiệm"} className="flex items-center gap-1 text-sm font-bold whitespace-nowrap text-[#8f1a1a]"><ShieldAlert weight="bold" className="size-3.5" aria-hidden />Kiêm nhiệm</span>
                          )}
                        </span>
                        <span className="flex justify-between gap-1.5 text-sm" style={{ color: open ? A.paprikaInk : A.sub }}>
                          <span>{open ? `Đang mở từ ${time(s.opened_at)}` : closed ? `Đã cân trả ${time(s.closed_at)}` : "Chưa bàn giao"}</span>
                          <span className="flex items-center gap-1 font-bold text-[#1c1917] tabular">
                            {tier === "must" && <Siren weight="bold" className="size-3.5 text-[#8f1a1a]" aria-label="Phải điều tra" />}
                            {tier === "warn" && <AlertTriangle weight="bold" className="size-3.5 text-[#6b4300]" aria-label="Cảnh báo" />}
                            {closed && r ? money(r.variance_value) : "-"}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
              <p className="m-0 text-sm text-[#4f4a45]">Số bên phải là giá trị chênh lệch Bếp sau cân trả.</p>
            </>
          )}
        </section>

        <section className={cn(CARD, "a-rise flex min-w-0 flex-[1_1_400px] flex-col gap-1.5 p-6")} style={{ animationDelay: "120ms" }}>
          <h3 className="m-0 mb-2 font-display text-xl font-bold tracking-[-.02em]">Phiếu bàn giao</h3>
          {handovers.isLoading ? <Loading rows={3} /> : !hos.length ? <EmptyNote icon={CheckCircle2}>Chưa có phiếu bàn giao</EmptyNote> : (
            <>
              {(showAll ? hos : hos.slice(0, HO_PAGE)).map((h, i) => {
                const st = HO_STATUS[h.status]
                return (
                  <div key={h.id} className="a-rise relative flex flex-col gap-1.5 border-l-2 border-[#efedeb] py-3.5 pl-6" style={{ animationDuration: ".55s", ...delay(Math.min(i, 10), 100, 60) }}>
                    <span aria-hidden className="absolute top-[18px] -left-[7px] size-3 rounded-full shadow-[0_0_0_3px_#fdfdfc]" style={{ background: st.dot }} />
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <span className="text-[15px] font-bold"><Code>{h.code}</Code> {h.kind === "start" ? "Đầu ca" : "Bổ sung"}, {h.shift.name} {dm(h.shift.business_date)}</span>
                      <span className="flex gap-1.5">
                        {h.mismatch_attempts > 0 && <Pill bg={A.warnBg} c={A.warn} icon={AlertTriangle}>{h.mismatch_attempts} lần lệch cân</Pill>}
                        <Pill bg={st.bg} c={st.c} icon={st.icon}>{st.label}</Pill>
                      </span>
                    </div>
                    <span className="text-sm text-[#4f4a45]">Xuất {dateTime(h.issued_at)} bởi {h.issued_by}{h.received_by ? `, ${h.received_by} ký ${time(h.signed_at)}` : ""}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {h.lines.map((l) => (
                        <span key={l.id} className="flex min-h-[30px] items-center rounded-[9px] bg-[#f5f3f1] px-2.5 text-sm tabular">
                          {l.ingredient} {qty(l.issued_qty, l.unit)}{l.received_qty !== null ? ` (bếp cân ${qty(l.received_qty, l.unit)})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
              {hos.length > HO_PAGE && (
                <button type="button" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}
                  className="mt-2 h-11 self-start rounded-xl bg-[#efedeb] px-4 text-sm font-bold transition-colors hover:bg-[#e7e4e1]">
                  {showAll ? "Thu gọn" : `Xem tất cả ${hos.length} phiếu`}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
