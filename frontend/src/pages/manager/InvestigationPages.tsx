import { useQuery } from "@tanstack/react-query"
import { AlarmClock, Check, ClipboardCheck, DotOutline, HourglassHigh, HourglassMedium, Plus, SealCheck, type IconType } from "@/components/icons"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  A, CARD, Code, Drawer, EmptyNote, GRID_HEAD, GRID_ROW, HeadStat, Initials, PageHead, Pill, SlideTabs, adminToast, delay,
} from "@/layouts/AdminBits"
import { api } from "@/lib/api"
import { useAuth, useMeta } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { dateOnly, dateTime, money, moneyShort, qty } from "@/lib/format"
import type { Investigation } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

const KIND_LABEL: Record<string, string> = {
  shift_return: "Cân trả cuối ca", periodic: "Kiểm kê định kỳ", spot: "Kiểm kê đột xuất", quick_out: "Báo hết nguyên liệu",
}
const LEVEL: Record<string, [string, string, string]> = {
  "cao": [A.badBg, A.bad, A.critMark],
  "trung bình": [A.warnBg, A.warn, A.warnMark],
  "thấp": [A.line2, A.sub, "#a8a29e"],
}
const COLS = "150px minmax(170px,1.3fr) minmax(150px,1fr) minmax(150px,1fr) 150px 160px 150px"
const loc = (l: string) => (l === "bep" ? "Bếp" : "Kho")

/** Nhãn hạn xử lý: đã kết luận (xanh), quá hạn (đỏ), sắp hạn (vàng), còn lâu (đá). Luôn có icon + chữ. */
function dueOf(v: Investigation, now: Date): { text: string; bg: string; c: string; icon: IconType } {
  if (v.status === "concluded") return { text: `Kết luận ${dateTime(v.concluded_at)}`, bg: A.okBg, c: A.ok, icon: Check }
  const h = Math.round((new Date(v.due_at).getTime() - now.getTime()) / 3_600_000)
  if (v.overdue || h < 0) return { text: `Quá hạn ${Math.max(1, -h)} giờ`, bg: A.badBg, c: A.bad, icon: AlarmClock }
  if (v.due_soon) return { text: `Còn ${Math.max(0, h)} giờ`, bg: A.warnBg, c: A.warn, icon: HourglassMedium }
  return { text: `Còn ${h} giờ`, bg: A.line2, c: A.ink, icon: HourglassHigh }
}
const signed = (q: number, u: string) => `${q > 0 ? "Thiếu" : "Thừa"} ${qty(Math.abs(q), u)}`

/** Phiếu điều tra theo thiết kế "Quan Ly Admin": danh sách hai tab, chi tiết mở trong ngăn trượt phải. */
export function InvestigationsPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const now = useServerNow(60_000)
  const [tab, setTab] = useState<"open" | "concluded">("open")
  const open = useQuery({ queryKey: ["investigations", "open"], queryFn: () => api.get<Investigation[]>("/investigations?status=open") })
  const done = useQuery({ queryKey: ["investigations", "concluded"], queryFn: () => api.get<Investigation[]>("/investigations?status=concluded") })
  const list = (tab === "open" ? open.data : done.data) ?? []
  const openList = open.data ?? []
  const overdue = openList.filter((v) => v.overdue).length
  const soon = openList.filter((v) => v.due_soon && !v.overdue).length
  const openVal = openList.reduce((s, v) => s + Math.abs(Number(v.variance_value)), 0)
  const loading = tab === "open" ? open.isLoading : done.isLoading

  return (
    <div className="flex flex-col gap-[26px]">
      <PageHead title="Phiếu điều tra"
        desc="Chênh lệch vượt ngưỡng phải điều tra sẽ mở một phiếu. Phân bổ nguyên nhân cho đủ lượng lệch rồi kết luận. Tất toán chỉ phân loại lại, tồn kho không đổi."
        right={(
          <div className="flex gap-7">
            <HeadStat label="Quá hạn" value={overdue} color={A.bad} />
            <HeadStat label="Sắp hạn" value={soon} color={A.warn} />
            <HeadStat label="Chờ giải trình" value={moneyShort(openVal)} />
          </div>
        )} />
      <div className="a-rise" style={{ animationDelay: "50ms" }}>
        <SlideTabs label="Lọc phiếu điều tra" value={tab} onChange={setTab}
          options={[{ key: "open", label: `Đang mở (${openList.length})` }, { key: "concluded", label: `Đã kết luận (${done.data?.length ?? 0})` }]} />
      </div>
      <div className={cn(CARD, "a-rise overflow-x-auto")} style={{ animationDelay: "100ms" }}>
        <div className="min-w-[1000px]">
          <div className={GRID_HEAD} style={{ gridTemplateColumns: COLS }}>
            <span>Phiếu</span><span>Nguyên liệu</span><span>Vị trí, ca</span>
            <span>Người chịu trách nhiệm</span><span className="text-right">Chênh lệch</span>
            <span>Đã phân bổ</span><span>Hạn</span>
          </div>
          {loading ? <div className="h-40 animate-pulse" /> : list.map((v, i) => {
            const due = dueOf(v, now)
            const vq = Number(v.variance_qty), settled = Number(v.settled_qty)
            const w = vq ? Math.min(100, Math.round((settled / vq) * 100)) : 0
            const resp = v.responsible ?? (v.location === "kho" ? "Kho (thủ kho)" : "-")
            return (
              <button key={v.id} type="button" onClick={() => nav(`/quan-ly/dieu-tra/${v.id}`)} aria-label={`${v.code} ${v.ingredient.name}`}
                className={cn(GRID_ROW, "a-rise min-h-[72px] cursor-pointer", String(v.id) === id && "bg-[#f7f4f1]")} style={{ gridTemplateColumns: COLS, ...delay(i) }}>
                <Code>{v.code}</Code>
                <span className="flex flex-col gap-0.5"><span className="text-[15px] font-bold">{v.ingredient.name}</span><span className="text-[#4f4a45]">Nhóm {v.ingredient.group}</span></span>
                <span>{loc(v.location)}{v.shift ? `, ${v.shift.name} ${dateOnly(v.shift.business_date).slice(0, 5)}` : ""}</span>
                <span className="flex items-center gap-2">{v.responsible && <Initials name={v.responsible} />}{resp}</span>
                <span className="flex flex-col gap-0.5 text-right">
                  <span className="font-bold" style={{ color: vq > 0 ? A.bad : A.surplusText }}>{signed(vq, v.ingredient.unit)}</span>
                  <span className="text-[#4f4a45]">{money(v.variance_value)}</span>
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="text-[#4f4a45]">{settled ? `${qty(Math.abs(settled), v.ingredient.unit)} / ${qty(Math.abs(vq), v.ingredient.unit)}` : "Chưa phân bổ"}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[#efedeb]"><span className="block h-full rounded-full bg-[#1c1917] transition-[width] duration-700" style={{ width: `${w}%` }} /></span>
                </span>
                <span><Pill bg={due.bg} c={due.c} icon={due.icon} className="h-[30px] px-[11px] text-sm">{due.text}</Pill></span>
              </button>
            )
          })}
          {!loading && !list.length && <EmptyNote>{tab === "open" ? "Không còn phiếu nào đang mở" : "Chưa có phiếu đã kết luận"}</EmptyNote>}
        </div>
      </div>
      <InvestigationDrawer id={id ? Number(id) : null} onClose={() => nav("/quan-ly/dieu-tra")} now={now} />
    </div>
  )
}

/** Đường dẫn /quan-ly/dieu-tra/:id mở danh sách kèm ngăn chi tiết. */
export const InvestigationDetailPage = InvestigationsPage

interface Draft { cause: string; label: string; qty: string; receipt_line_id: string }

function InvestigationDrawer({ id, onClose, now }: { id: number | null; onClose: () => void; now: Date }) {
  const { me } = useAuth()
  const meta = useMeta()
  const q = useQuery({ queryKey: ["investigations", "detail", id], queryFn: () => api.get<Investigation>(`/investigations/${id}`), enabled: id !== null })
  const inv = q.data
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [note, setNote] = useState("")
  const [found, setFound] = useState("")
  const [foundNote, setFoundNote] = useState("")
  useEffect(() => { setDrafts([]); setNote(""); setFound(""); setFoundNote("") }, [id])
  const inval = [["investigations"], ["dashboard"], ["alerts"]]
  const verify = useAction(() => api.post(`/investigations/${id}/verify`, { found_qty: Number(found), note: foundNote }), {
    invalidate: inval, onSuccess: () => { adminToast("Đã ghi kết quả kiểm kê xác nhận"); setFound(""); setFoundNote("") },
  })
  const conclude = useAction(() => api.post(`/investigations/${id}/conclude`, {
    note, allocations: drafts.map((d) => ({ cause: d.cause, qty: Number(d.qty), receipt_line_id: d.receipt_line_id ? Number(d.receipt_line_id) : null, note: "" })),
  }), {
    invalidate: inval,
    onSuccess: () => { adminToast(`Đã kết luận ${inv?.code}. Tồn kho không đổi, ${drafts.length} phần phân bổ đã ghi sổ.`); onClose() },
  })

  const u = inv?.ingredient.unit ?? "g"
  const vq = Number(inv?.variance_qty ?? 0)
  const remaining = vq - Number(inv?.settled_qty ?? 0)
  const allocated = drafts.reduce((s, d) => s + Number(d.qty || 0), 0)
  const left = remaining - allocated
  const full = drafts.length > 0 && Math.abs(left) < 0.0005
  const isOpen = inv?.status === "open"
  const involved = !!(me && inv && (inv.involved_user_ids ?? []).includes(me.id))
  const canConclude = isOpen && !involved && !inv?.needs_verification
  const causeLabel = (k: string) => meta.data?.causes[k] ?? k
  const addCause = (cause: string, label = causeLabel(cause)) => {
    if (Math.abs(left) < 0.0005) return
    setDrafts((d) => [...d, { cause, label, qty: String(Math.round(left * 1000) / 1000), receipt_line_id: "" }])
  }
  const otherCauses = Object.entries(meta.data?.causes ?? {}).filter(([k]) => k !== "bao_het_nham" && !drafts.some((d) => d.cause === k))
  const due = inv ? dueOf(inv, now) : null
  const pctW = remaining ? Math.min(100, Math.round(((vq - remaining + allocated) / vq) * 100)) : 100
  const ready = full && note.trim() && !drafts.some((d) => d.cause === "nhap_sai" && !d.receipt_line_id) && !conclude.isPending

  return (
    <Drawer open={id !== null} onClose={onClose} title={inv ? `${inv.code}: ${inv.ingredient.name}` : "Chi tiết phiếu điều tra"}
      head={inv && due ? <><Code className="text-[15px]">{inv.code}</Code><Pill bg={due.bg} c={due.c} icon={due.icon}>{due.text}</Pill></> : null}
      footer={inv && canConclude ? (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Căn cứ kết luận (bắt buộc): đã đối chiếu hóa đơn, hỏi bếp trưởng ca…" aria-label="Căn cứ kết luận"
            className="h-[46px] rounded-xl border border-[#8a817c] bg-white px-3.5 text-[15px] outline-offset-2 placeholder:text-[#6b645f]" />
          <button type="button" disabled={!ready} onClick={() => conclude.mutate(undefined)}
            className={cn("flex h-[52px] items-center justify-center gap-2 rounded-[14px] text-base font-bold transition-[background-color,color,box-shadow,transform] duration-[400ms] active:scale-[.98]",
              ready ? "bg-[#eb9360] text-[#1c1917] shadow-[0_12px_28px_-12px_rgba(235,147,96,.9)]" : "cursor-not-allowed bg-[#e9e6e3] text-[#4f4a45]")}>
            <SealCheck weight="bold" className="size-5" aria-hidden />{conclude.isPending ? "Đang kết luận…" : "Kết luận và tất toán"}
          </button>
        </>
      ) : undefined}>
      {!inv ? <div className="h-60 animate-pulse rounded-2xl bg-[#f5f3f1]" /> : (
        <>
          <div>
            <h2 className="m-0 font-display text-[32px] leading-[1.05] font-bold tracking-[-.03em]">{inv.ingredient.name} tại {loc(inv.location)}</h2>
            <div className="mt-1.5 text-sm text-[#4f4a45]">
              Nhóm {inv.ingredient.group}{inv.shift ? `, ${inv.shift.name} ${dateOnly(inv.shift.business_date)}` : ""}, chịu trách nhiệm {inv.responsible ?? (inv.location === "kho" ? "Kho (thủ kho)" : "-")}
            </div>
          </div>
          <div className="flex items-end justify-between gap-4 rounded-[18px] bg-[#1c1917] px-[22px] py-5 text-[#fafaf9]">
            <div>
              <div className="text-sm text-[#d6d3d1]">Chênh lệch (dương là thiếu)</div>
              <div className="font-display text-[40px] leading-[1.1] font-bold tracking-[-.04em] text-[#eb9360]">{signed(vq, u)}</div>
            </div>
            <div className="text-right"><div className="text-sm text-[#d6d3d1]">Giá trị</div><div className="text-xl font-bold tabular">{money(inv.variance_value)}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ["Tồn sổ lúc chốt", qty(inv.count?.book_qty, u)],
              ["Thực đếm", qty(inv.count?.counted_qty, u)],
              ["Lý thuyết đã dùng", Number(inv.count?.theoretical_qty ?? 0) ? qty(inv.count?.theoretical_qty, u) : "-"],
              ["Hao hụt đã ghi", Number(inv.count?.recorded_waste_qty ?? 0) ? qty(inv.count?.recorded_waste_qty, u) : "-"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[14px] bg-[#f5f3f1] px-4 py-3.5"><div className="text-sm text-[#4f4a45]">{k}</div><div className="mt-0.5 text-lg font-bold tabular">{v}</div></div>
            ))}
          </div>
          <div className="text-sm leading-normal text-[#4f4a45]">
            Kỳ đo từ {dateTime(inv.count?.period_start)} đến {dateTime(inv.count?.cutoff_at)}. Phát hiện bởi {KIND_LABEL[inv.count?.kind ?? ""] ?? inv.count?.kind} ({inv.count?.code})
            {inv.count?.counted_by ? `, người đếm ${inv.count.counted_by}` : ""}. Đơn giá nhập gần nhất {money(inv.count?.unit_cost)}/{u}.
          </div>

          {!isOpen ? (
            <>
              <AllocBar label={`Đã phân bổ ${qty(Math.abs(Number(inv.settled_qty)), u)} / ${qty(Math.abs(vq), u)}`} right="Đã tất toán" w={100} done />
              {inv.allocations.map((a, i) => (
                <div key={i} className="flex min-h-12 items-center justify-between gap-2.5 rounded-xl bg-[#f5f3f1] px-3.5 text-sm">
                  <span><b>{causeLabel(a.cause)}</b> <span className="text-[#4f4a45] tabular">{qty(Math.abs(a.qty), u)}, {money(a.value)}</span></span>
                  {a.note && <span className="text-[#4f4a45]">{a.note}</span>}
                </div>
              ))}
              <div className="rounded-[14px] bg-[#e9f5e9] p-4 text-sm leading-normal text-[#004d00]">
                <div className="flex items-center gap-1.5 font-bold"><Check weight="bold" className="size-[18px]" aria-hidden />Đã kết luận lúc {dateTime(inv.concluded_at)}{inv.concluded_by ? ` bởi ${inv.concluded_by}` : ""}</div>
                {inv.conclusion_note && <div className="mt-1 text-[#1c1917]">{inv.conclusion_note}</div>}
              </div>
            </>
          ) : (
            <>
              {involved && (
                <div className="rounded-[14px] bg-[#fdf0d2] p-4 text-sm font-semibold text-[#6b4300]">Bạn đã ký nhận / đếm trong ca liên quan nên không được tự kết luận phiếu này.</div>
              )}
              {inv.needs_verification && (
                <div className="flex flex-col gap-3 rounded-2xl p-4 shadow-[0_0_0_1px_#e2ded9]">
                  <div className="flex items-center gap-2 text-[15px] font-bold"><ClipboardCheck className="size-5" aria-hidden />Kiểm kê xác nhận tại Bếp (bắt buộc với phiếu mở từ báo hết)</div>
                  <p className="m-0 text-sm text-[#4f4a45]">Quản lý (không báo trước) cân lại {inv.ingredient.name} tại Bếp. Phần tìm thấy được đảo khỏi chênh lệch; phần còn thiếu xét tiếp như các nguyên nhân khác.</p>
                  <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                    <input inputMode="decimal" value={found} onChange={(e) => setFound(e.target.value.replace(",", "."))} placeholder={`Tìm thấy (${u})`} aria-label="Lượng tìm thấy"
                      className="h-11 rounded-xl border border-[#8a817c] bg-white px-3 text-[15px]" />
                    <input value={foundNote} onChange={(e) => setFoundNote(e.target.value)} placeholder="Ghi chú (vị trí tìm thấy…)" aria-label="Ghi chú kiểm kê xác nhận"
                      className="h-11 rounded-xl border border-[#8a817c] bg-white px-3 text-[15px]" />
                    <button type="button" disabled={found === "" || verify.isPending || involved} onClick={() => verify.mutate(undefined)}
                      className="h-11 rounded-xl bg-[#1c1917] px-4 text-sm font-bold text-[#fafaf9] disabled:bg-[#e9e6e3] disabled:text-[#4f4a45]">Ghi kết quả</button>
                  </div>
                </div>
              )}
              {canConclude && (
                <div className="flex flex-col gap-2.5">
                  <AllocBar label={`Đã phân bổ ${qty(Math.abs(vq - remaining + allocated), u)} / ${qty(Math.abs(vq), u)}`}
                    right={full ? "Đã đủ, có thể kết luận" : `Còn ${qty(Math.abs(left), u)} chưa phân bổ`} w={pctW} done={full} />
                  {drafts.map((d, i) => (
                    <div key={i} className="a-slide flex flex-wrap items-center gap-2.5 rounded-xl bg-[#f5f3f1] py-1.5 pr-1.5 pl-3.5 text-sm">
                      <span className="min-w-[140px] flex-1 font-bold">{d.label}</span>
                      <label className="flex items-center gap-1.5">
                        <input inputMode="decimal" value={d.qty} aria-label={`Lượng phân bổ cho ${d.label}`}
                          onChange={(e) => setDrafts((x) => x.map((y, j) => j === i ? { ...y, qty: e.target.value.replace(",", ".") } : y))}
                          className="h-11 w-28 rounded-[10px] border border-[#8a817c] bg-white px-2.5 text-right text-[15px] tabular" />
                        <span className="text-[#4f4a45]">{u}</span>
                      </label>
                      {d.cause === "nhap_sai" && (
                        <Select value={d.receipt_line_id} onValueChange={(v) => setDrafts((x) => x.map((y, j) => j === i ? { ...y, receipt_line_id: v } : y))}>
                          <SelectTrigger className="h-11 w-full bg-white sm:w-64" aria-label="Dòng phiếu nhập gốc"><SelectValue placeholder="Chọn dòng phiếu nhập gốc" /></SelectTrigger>
                          <SelectContent>{(inv.receipt_lines ?? []).map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.receipt_code}, {r.supplier}, {Number(r.received_qty)} {r.unit} ({dateOnly(r.received_at)})</SelectItem>
                          ))}</SelectContent>
                        </Select>
                      )}
                      <button type="button" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}
                        className="h-11 rounded-[10px] px-3 text-sm font-semibold text-[#4f4a45] hover:bg-[#e9e6e3]">Bỏ</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <h3 className="m-0 font-display text-xl font-bold tracking-[-.02em]">Nguyên nhân gợi ý</h3>
                {(inv.suggestions ?? []).map((sg, i) => {
                  const lv = LEVEL[sg.level] ?? LEVEL["thấp"]
                  const taken = drafts.some((d) => d.cause === sg.cause)
                  const dis = !canConclude || sg.cause === "bao_het_nham" || taken || Math.abs(left) < 0.0005
                  return (
                    <div key={sg.cause} className="a-rise flex flex-col gap-2.5 rounded-2xl p-4 shadow-[0_0_0_1px_#e2ded9]" style={delay(i, 80, 70)}>
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <span className="text-[15px] font-bold">{sg.label}</span>
                        <Pill bg={lv[0]} c={lv[1]}>Khả năng {sg.level}</Pill>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#efedeb]"><div className="a-growX h-full rounded-full" style={{ width: `${Math.round(sg.score * 100)}%`, background: lv[2], animationDelay: `${300 + i * 70}ms` }} /></div>
                      {sg.evidence.map((e, j) => (
                        <div key={j} className="flex gap-2 text-sm leading-[1.45]"><DotOutline weight="bold" className="mt-0.5 size-4 shrink-0 text-[#7c3410]" aria-hidden /><span>{e}</span></div>
                      ))}
                      {canConclude && sg.cause !== "bao_het_nham" && (
                        <button type="button" disabled={dis} onClick={() => addCause(sg.cause, sg.label)}
                          className="flex h-11 items-center gap-2 self-start rounded-xl bg-[#1c1917] px-4 text-sm font-bold whitespace-nowrap text-[#fafaf9] transition-[background-color,transform] active:scale-[.97] disabled:cursor-not-allowed disabled:bg-[#efedeb] disabled:text-[#4f4a45]">
                          {taken ? <Check weight="bold" className="size-4" aria-hidden /> : <Plus weight="bold" className="size-4" aria-hidden />}
                          {taken ? "Đã chọn" : Math.abs(left) < 0.0005 ? "Đã phân bổ đủ" : `Phân bổ ${qty(Math.abs(left), u)}`}
                        </button>
                      )}
                    </div>
                  )
                })}
                {canConclude && otherCauses.length > 0 && Math.abs(left) >= 0.0005 && (
                  <Select value="" onValueChange={(v) => addCause(v)}>
                    <SelectTrigger className="h-11 w-full self-start bg-white sm:w-72" aria-label="Thêm nguyên nhân khác"><SelectValue placeholder="Thêm nguyên nhân khác" /></SelectTrigger>
                    <SelectContent>{otherCauses.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Drawer>
  )
}

function AllocBar({ label, right, w, done }: { label: string; right: string; w: number; done?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between gap-2.5 text-sm"><span className="font-bold">{label}</span><span className="text-[#4f4a45]">{right}</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-[#efedeb]" role="progressbar" aria-label="Tỉ lệ đã phân bổ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={w}>
        <div className="h-full rounded-full transition-[width,background-color] duration-700" style={{ width: `${w}%`, background: done ? "#0ca30c" : A.ink }} />
      </div>
    </div>
  )
}
