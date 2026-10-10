import { useQuery } from "@tanstack/react-query"
import { AlertOctagon, AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, FileSearch, Info, Plus, Trash2 } from "@/components/icons"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { Empty, KV, LocationBadge, Loading, PageHeader, Section, StatusPill, FilterTabs } from "@/components/common"
import { DataTable, type ColumnDef } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useAuth, useMeta } from "@/lib/auth"
import { dateOnly, dateTime, money, pct, qty, signedQty } from "@/lib/format"
import type { Investigation } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

const KIND_LABEL: Record<string, string> = {
  shift_return: "Cân trả cuối ca", periodic: "Kiểm kê định kỳ", spot: "Kiểm kê đột xuất", quick_out: "Báo hết nguyên liệu",
}

function InvStatus({ inv }: { inv: Investigation }) {
  if (inv.status === "concluded") return <StatusPill tone="good"><CheckCircle2 className="size-3.5" />Đã kết luận</StatusPill>
  if (inv.overdue) return <StatusPill tone="bad">Quá hạn</StatusPill>
  if (inv.due_soon) return <StatusPill tone="warn">Sắp hạn</StatusPill>
  return <StatusPill tone="info">Đang mở</StatusPill>
}

export function InvestigationsPage() {
  const [tab, setTab] = useState("open")
  const nav = useNavigate()
  const q = useQuery({ queryKey: ["investigations", tab], queryFn: () => api.get<Investigation[]>(`/investigations?status=${tab === "all" ? "" : tab}`) })
  const columns = useMemo<ColumnDef<Investigation, unknown>[]>(() => [
    { accessorKey: "code", header: "Mã", cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
    { id: "ing", accessorFn: (r) => r.ingredient.name, header: "Nguyên liệu" },
    { accessorKey: "location", header: "Vị trí", cell: ({ row }) => <LocationBadge location={row.original.location} /> },
    { id: "shift", accessorFn: (r) => r.shift?.name ?? "", header: "Ca", cell: ({ row }) => row.original.shift ? `${row.original.shift.name} ${dateOnly(row.original.shift.business_date)}` : "-" },
    { accessorKey: "responsible", header: "Người ký nhận ca", cell: ({ row }) => row.original.responsible ?? (row.original.location === "kho" ? "Kho (thủ kho)" : "-") },
    { id: "qty", accessorFn: (r) => Number(r.variance_qty), header: "Chênh lệch", meta: { numeric: true }, cell: ({ row }) => signedQty(row.original.variance_qty, row.original.ingredient.unit) },
    { id: "value", accessorFn: (r) => Math.abs(Number(r.variance_value)), header: "Giá trị", meta: { numeric: true }, cell: ({ row }) => <b>{money(row.original.variance_value)}</b> },
    { accessorKey: "due_at", header: "Hạn xử lý", cell: ({ row }) => dateTime(row.original.due_at) },
    { id: "status", header: "Trạng thái", cell: ({ row }) => <InvStatus inv={row.original} /> },
  ], [])
  return (
    <div className="space-y-4">
      <PageHeader title="Phiếu điều tra" icon={FileSearch} description="Chênh lệch vượt mức bắt buộc duyệt tự mở phiếu. Hệ thống chỉ gợi ý nguyên nhân kèm dữ liệu kiểm chứng; quản lý kết luận và duyệt." />
      <FilterTabs label="Lọc phiếu điều tra" value={tab} onChange={setTab} options={[{ value: "open", label: "Đang mở" }, { value: "overdue", label: "Quá hạn" }, { value: "due_soon", label: "Sắp hạn" }, { value: "concluded", label: "Đã kết luận" }, { value: "all", label: "Tất cả" }]} />
      {q.isLoading ? <Loading /> : (
        <DataTable columns={columns} data={q.data ?? []} onRowClick={(r) => nav(`/quan-ly/dieu-tra/${r.id}`)}
          initialSort={[{ id: "value", desc: true }]} empty="Không có phiếu" />
      )}
    </div>
  )
}

interface AllocDraft {
  cause: string
  qty: string
  receipt_line_id: string
  note: string
}

export function InvestigationDetailPage() {
  const { id } = useParams()
  const { me } = useAuth()
  const meta = useMeta()
  const q = useQuery({ queryKey: ["investigations", "detail", id], queryFn: () => api.get<Investigation>(`/investigations/${id}`) })
  const inv = q.data
  const inval = [["investigations"], ["dashboard"], ["alerts"]]
  const [found, setFound] = useState("")
  const [foundNote, setFoundNote] = useState("")
  const verify = useAction(() => api.post(`/investigations/${id}/verify`, { found_qty: Number(found), note: foundNote }), {
    success: "Đã ghi kết quả kiểm kê xác nhận", invalidate: inval,
  })
  const [allocs, setAllocs] = useState<AllocDraft[]>([])
  const [note, setNote] = useState("")
  const conclude = useAction(() => api.post(`/investigations/${id}/conclude`, {
    note, allocations: allocs.map((a) => ({ cause: a.cause, qty: Number(a.qty), receipt_line_id: a.receipt_line_id ? Number(a.receipt_line_id) : null, note: a.note })),
  }), { success: "Đã kết luận và tất toán phiếu", invalidate: inval })

  if (q.isLoading || !inv) return <Loading />
  const u = inv.ingredient.unit
  const remaining = Number(inv.variance_qty) - Number(inv.settled_qty)
  const allocated = allocs.reduce((s, a) => s + Number(a.qty || 0), 0)
  const involved = me ? (inv.involved_user_ids ?? []).includes(me.id) : false
  const causes = Object.entries(meta.data?.causes ?? {}).filter(([k]) => k !== "bao_het_nham")
  const addCause = (cause: string) =>
    setAllocs((a) => [...a, { cause, qty: a.length ? "" : String(remaining), receipt_line_id: "", note: "" }])

  return (
    <div className="space-y-4">
      <Link to="/quan-ly/dieu-tra" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Phiếu điều tra</Link>
      <PageHeader
        title={`${inv.code}: ${inv.ingredient.name} ${Number(inv.variance_qty) > 0 ? "thiếu" : "thừa"} ${qty(Math.abs(Number(inv.variance_qty)), u)}`}
        description={<>Giá trị {money(inv.variance_value)}, mở {dateTime(inv.opened_at)}, hạn {dateTime(inv.due_at)}</>}
        actions={<InvStatus inv={inv} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Lý thuyết (theo món đã bán)", value: qty(inv.count?.theoretical_qty, u) },
          { label: "Hao hụt đã ghi đúng lúc", value: qty(inv.count?.recorded_waste_qty, u) },
          { label: "Tồn sổ → thực đếm", value: `${qty(inv.count?.book_qty, u)} → ${qty(inv.count?.counted_qty, u)}` },
          { label: "Chênh lệch chưa giải thích", value: `${signedQty(inv.variance_qty, u)} · ${money(inv.variance_value)}`, strong: true },
        ].map((x) => (
          <div key={x.label} className={cn("surface p-4", x.strong && "border-l-4 border-l-destructive")}>
            <div className="text-xs text-muted-foreground">{x.label}</div>
            <div className={cn("mt-1 text-xl font-bold tabular", x.strong && "text-critical-ink")}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Section title="Số liệu kỳ đo">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KV label="Vị trí"><LocationBadge location={inv.location} /></KV>
            <KV label="Ca">{inv.shift ? `${inv.shift.name} ${dateOnly(inv.shift.business_date)}` : "-"}</KV>
            <KV label="Người ký nhận ca">{inv.responsible ?? "-"}</KV>
            <KV label="Phát hiện bởi">{KIND_LABEL[inv.count?.kind ?? ""] ?? inv.count?.kind} ({inv.count?.code})</KV>
            <KV label="Người đếm / cân">{inv.count?.counted_by ?? "-"}</KV>
            <KV label="Kỳ đo">{dateTime(inv.count?.period_start)} → {dateTime(inv.count?.cutoff_at)}</KV>
            <KV label="Lý thuyết (đã bán)">{qty(inv.count?.theoretical_qty, u)}</KV>
            <KV label="Hao hụt đã ghi">{qty(inv.count?.recorded_waste_qty, u)}</KV>
            <KV label="Tồn sổ lúc chốt">{qty(inv.count?.book_qty, u)}</KV>
            <KV label="Thực đếm">{qty(inv.count?.counted_qty, u)}</KV>
            <KV label="Tỷ lệ so với lý thuyết">{inv.count?.variance_pct != null ? pct(inv.count.variance_pct) : "chỉ xét ngưỡng tuyệt đối"}</KV>
            <KV label="Đơn giá nhập gần nhất">{money(inv.count?.unit_cost)}/{u}</KV>
          </div>
          {inv.allocations.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="mb-2 text-sm font-semibold">Đã tất toán</div>
              <ul className="space-y-1 text-sm">
                {inv.allocations.map((a, i) => (
                  <li key={i}>{meta.data?.causes[a.cause] ?? a.cause}: <b>{qty(a.qty, u)}</b> ({money(a.value)}) {a.note && <span className="text-muted-foreground">- {a.note}</span>}</li>
                ))}
              </ul>
              {inv.conclusion_note && <p className="mt-2 text-sm"><span className="text-muted-foreground">Kết luận của {inv.concluded_by}:</span> {inv.conclusion_note}</p>}
            </div>
          )}
        </Section>

        <Section title="Nguyên nhân gợi ý (sắp theo mức khả nghi)">
          <ol className="space-y-3">
            {(inv.suggestions ?? []).map((s, idx) => (
              <li key={s.cause} className={cn("rounded-2xl border border-border p-4", s.level === "cao" && "border-l-4 border-l-destructive")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular">{idx + 1}</span>
                    {s.label}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={s.level === "cao" ? "bad" : s.level === "trung bình" ? "warn" : "neutral"}>
                      {s.level === "cao" ? <AlertOctagon className="size-3.5" aria-hidden /> : s.level === "trung bình" ? <AlertTriangle className="size-3.5" aria-hidden /> : <Info className="size-3.5" aria-hidden />}
                      Khả nghi {s.level}
                    </StatusPill>
                    <StatusPill tone="neutral">{s.support === "auto" ? "Tự động" : s.support === "required" ? "Bắt buộc kiểm" : "Thủ công"}</StatusPill>
                    {inv.status === "open" && s.cause !== "bao_het_nham" && (
                      <Button size="sm" variant="outline" onClick={() => addCause(s.cause)}><Plus className="size-3.5" />Chọn nguyên nhân này</Button>
                    )}
                  </span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {s.evidence.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {inv.status === "open" && (
        <div className={cn("grid items-start gap-4", inv.needs_verification && "xl:grid-cols-2")}>
          {inv.needs_verification && (
            <Section title={<span className="flex items-center gap-2"><ClipboardCheck className="size-4" /> Kiểm kê xác nhận tại Bếp (bắt buộc với phiếu mở từ báo hết)</span>}>
              <p className="mb-3 text-sm text-muted-foreground">Quản lý (không báo trước) cân lại {inv.ingredient.name} tại Bếp. Phần tìm thấy được đảo khỏi chênh lệch; phần còn thiếu xét tiếp như các nguyên nhân khác.</p>
              <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
                <Input inputMode="decimal" placeholder={`Tìm thấy (${u})`} value={found} onChange={(e) => setFound(e.target.value.replace(",", "."))} />
                <Input placeholder="Ghi chú (vị trí tìm thấy…)" value={foundNote} onChange={(e) => setFoundNote(e.target.value)} />
                <Button disabled={found === "" || verify.isPending || involved} onClick={() => verify.mutate(undefined)}>Ghi kết quả</Button>
              </div>
            </Section>
          )}
          <Section title="Kết luận & tất toán">
            {involved ? (
              <Empty>Bạn đã ký nhận / đếm trong ca liên quan nên không được tự kết luận phiếu này.</Empty>
            ) : inv.needs_verification ? (
              <Empty>Cần kiểm kê xác nhận trước khi kết luận.</Empty>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Phân bổ phần chưa tất toán <b className="text-foreground">{qty(remaining, u)}</b> cho một hoặc nhiều nguyên nhân. Nhập sai / kiểm kê sai thành điều chỉnh có liên kết (không tính hao hụt); công thức sai ghi “sai định mức”; còn lại thành hao hụt ghi muộn gắn với ca.
                </p>
                {allocs.map((a, i) => (
                  <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1.4fr_110px_1fr_auto]">
                    <Select value={a.cause} onValueChange={(v) => setAllocs((x) => x.map((y, j) => j === i ? { ...y, cause: v } : y))}>
                      <SelectTrigger className="w-full" aria-label="Nguyên nhân"><SelectValue /></SelectTrigger>
                      <SelectContent>{causes.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input inputMode="decimal" value={a.qty} placeholder={u} onChange={(e) => setAllocs((x) => x.map((y, j) => j === i ? { ...y, qty: e.target.value.replace(",", ".") } : y))} />
                    {a.cause === "nhap_sai" ? (
                      <Select value={a.receipt_line_id} onValueChange={(v) => setAllocs((x) => x.map((y, j) => j === i ? { ...y, receipt_line_id: v } : y))}>
                        <SelectTrigger className="w-full" aria-label="Dòng phiếu nhập gốc"><SelectValue placeholder="Dòng phiếu nhập gốc" /></SelectTrigger>
                        <SelectContent>{(inv.receipt_lines ?? []).map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.receipt_code}, {r.supplier}, {Number(r.received_qty)} {r.unit} ({dateOnly(r.received_at)})</SelectItem>
                        ))}</SelectContent>
                      </Select>
                    ) : (
                      <Input placeholder="Ghi chú phần này" value={a.note} onChange={(e) => setAllocs((x) => x.map((y, j) => j === i ? { ...y, note: e.target.value } : y))} />
                    )}
                    <Button size="icon" variant="ghost" aria-label="Bỏ" onClick={() => setAllocs((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addCause("khong_xac_dinh")}><Plus className="size-4" /> Thêm nguyên nhân</Button>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Đã phân bổ <b className="tabular">{qty(allocated, u)}</b> / {qty(remaining, u)}</span>
                    {Math.abs(allocated - remaining) > 0.0005 && allocs.length > 0
                      ? <span className="inline-flex items-center gap-1 font-medium text-critical-ink"><AlertTriangle className="size-4" aria-hidden /> phải bằng nhau</span>
                      : allocs.length > 0 && <span className="inline-flex items-center gap-1 font-medium text-good-ink"><CheckCircle2 className="size-4" aria-hidden /> đủ</span>}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, remaining ? allocated / remaining : 0) * 100)}>
                    <div className={cn("h-full rounded-full", allocated > remaining + 0.0005 ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, remaining ? (allocated / remaining) * 100 : 0)}%` }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="can-cu">Căn cứ kết luận</Label>
                  <Textarea id="can-cu" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Đã đối chiếu hóa đơn, hỏi bếp trưởng ca…" />
                </div>
                <Button size="xl" disabled={!allocs.length || !note.trim() || Math.abs(allocated - remaining) > 0.0005 || conclude.isPending ||
                  allocs.some((a) => a.cause === "nhap_sai" && !a.receipt_line_id)}
                  onClick={() => conclude.mutate(undefined)}>
                  Kết luận & duyệt
                </Button>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
