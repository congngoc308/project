import { useQuery } from "@tanstack/react-query"
import { Check, FileText, Link2, Scale, ShieldAlert, ShoppingBasket, Trash2, X } from "@/components/icons"
import { useMemo, useState } from "react"

import { HBars } from "@/components/charts"
import { useAsk } from "@/components/ask"
import { Empty, LocationBadge, Loading, PageHeader, Section, StatusPill, TierBadge, FilterTabs } from "@/components/common"
import { DataTable, type ColumnDef } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, qs } from "@/lib/api"
import { dateOnly, dateTime, money, moneyShort, pct, qty, signedQty, time, unit } from "@/lib/format"
import type { Handover, Receipt, ReceiptLine, Shift, Tier, WasteSlip } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { useDateRange } from "@/pages/manager/AvtPage"
import { WASTE_STATUS } from "@/pages/ops/WastePage"

const RECEIPT_STATUS: Record<Receipt["status"], { label: string; tone: "good" | "warn" | "neutral" | "info" }> = {
  draft: { label: "Nháp", tone: "neutral" },
  received: { label: "Đã nhận", tone: "good" },
  pending_approval: { label: "Chờ duyệt", tone: "warn" },
  approved: { label: "Đã duyệt", tone: "info" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
}

export function ReceiptsAdminPage() {
  const [status, setStatus] = useState("pending_approval")
  const q = useQuery({ queryKey: ["receipts", status], queryFn: () => api.get<Receipt[]>(`/receipts${qs({ status: status === "all" ? "" : status })}`) })
  const [view, setView] = useState<Receipt | null>(null)
  const [fix, setFix] = useState<ReceiptLine | null>(null)
  const [fixQty, setFixQty] = useState("")
  const [fixReason, setFixReason] = useState("")
  const approve = useAction((id: number) => api.post<Receipt>(`/receipts/${id}/approve`, { note: "" }), { success: "Đã duyệt phiếu nhập", invalidate: [["receipts"], ["dashboard"]], onSuccess: setView })
  const correct = useAction(() => api.post<Receipt>(`/receipt-lines/${fix!.id}/correct`, { correct_qty: Number(fixQty), reason: fixReason }), {
    success: "Đã tạo điều chỉnh có liên kết tới phiếu gốc", invalidate: [["receipts"]],
    onSuccess: (r) => { setFix(null); setView(r); setFixQty(""); setFixReason("") },
  })
  const columns = useMemo<ColumnDef<Receipt, unknown>[]>(() => [
    { accessorKey: "code", header: "Mã", cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
    { accessorKey: "supplier", header: "Nhà cung cấp" },
    { accessorKey: "received_at", header: "Nhận lúc", cell: ({ row }) => dateTime(row.original.received_at) },
    { accessorKey: "received_by", header: "Thủ kho", cell: ({ row }) => row.original.received_by ?? "-" },
    { id: "lines", header: "Hàng", cell: ({ row }) => <span className="text-xs">{row.original.lines.map((l) => `${l.ingredient} ${Number(l.received_qty ?? l.ordered_qty)} ${l.unit}`).join(" · ")}</span> },
    { id: "status", header: "Trạng thái", cell: ({ row }) => <StatusPill tone={RECEIPT_STATUS[row.original.status].tone}>{RECEIPT_STATUS[row.original.status].label}</StatusPill> },
    { id: "anom", header: "Bất thường", cell: ({ row }) => <span className="text-xs text-warning-ink">{row.original.anomalies.join("; ")}</span> },
  ], [])
  return (
    <div className="space-y-4">
      <PageHeader title="Phiếu nhập" icon={ShoppingBasket} description="Tồn Kho tăng ngay khi thủ kho xác nhận Đã nhận. Phiếu lệch số đặt, lệch đơn giá hoặc lệch lớn so với lịch sử nhập chuyển Chờ duyệt. Sửa sai bằng điều chỉnh có liên kết, không sửa bản gốc." />
      <FilterTabs label="Lọc phiếu theo trạng thái" value={status} onChange={setStatus} options={[{ value: "pending_approval", label: "Chờ duyệt" }, { value: "received", label: "Đã nhận" }, { value: "approved", label: "Đã duyệt" }, { value: "draft", label: "Nháp" }, { value: "all", label: "Tất cả" }]} />
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={q.data ?? []} onRowClick={setView} empty="Không có phiếu" />}
      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>{view?.code} · {view?.supplier}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">Tạo bởi {view.created_by}, nhận {dateTime(view.received_at)} bởi {view.received_by ?? "-"}{view.approved_by && `, duyệt bởi ${view.approved_by}`}</div>
              {view.anomalies.length > 0 && <div className="rounded-lg border border-status-warning/60 bg-status-warning/10 p-2 text-warning-ink">{view.anomalies.join("; ")}</div>}
              <table className="w-full">
                <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Nguyên liệu</th><th className="text-right">Đặt</th><th className="text-right">Nhận</th><th className="text-right">Quy đổi</th><th className="text-right">Đơn giá</th><th className="text-right">Điều chỉnh LK</th><th /></tr></thead>
                <tbody>
                  {view.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="py-1.5">{l.ingredient}{l.diff_reason && <div className="text-xs text-muted-foreground">Lý do lệch: {l.diff_reason}</div>}</td>
                      <td className="text-right tabular">{Number(l.ordered_qty)} {unit(l.unit)}</td>
                      <td className="text-right tabular">{l.received_qty !== null ? `${Number(l.received_qty)} ${unit(l.unit)}` : "-"}</td>
                      <td className="text-right tabular">{qty(l.received_qty_base, l.base_unit)}</td>
                      <td className="text-right tabular">{money(l.unit_price)}</td>
                      <td className="text-right tabular">{Number(l.linked_adjustment) ? signedQty(l.linked_adjustment, l.base_unit) : "-"}</td>
                      <td className="text-right">{l.received_qty !== null && <Button size="sm" variant="ghost" onClick={() => setFix(l)}><Link2 className="size-3.5" /> Điều chỉnh</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {view.invoice_image && <a className="text-paprika-ink underline underline-offset-4 hover:decoration-2" href={`/api/uploads/${view.invoice_image}`} target="_blank" rel="noreferrer">Xem ảnh hóa đơn</a>}
              {view.status === "pending_approval" && <DialogFooter><Button onClick={() => approve.mutate(view.id)}><Check className="size-4" /> Duyệt phiếu</Button></DialogFooter>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!fix} onOpenChange={(v) => !v && setFix(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Điều chỉnh có liên kết: {fix?.ingredient}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Ghi số đúng theo hóa đơn. Hệ thống tạo giao dịch điều chỉnh trỏ tới dòng phiếu gốc; bản gốc giữ nguyên.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm font-medium">Số nhận đúng ({fix && unit(fix.unit)})</span><Input inputMode="decimal" value={fixQty} onChange={(e) => setFixQty(e.target.value.replace(",", "."))} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Lý do</span><Input value={fixReason} onChange={(e) => setFixReason(e.target.value)} /></label>
          </div>
          <DialogFooter><Button disabled={fixQty === "" || !fixReason.trim() || correct.isPending} onClick={() => correct.mutate(undefined)}>Tạo điều chỉnh</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function WasteAdminPage() {
  const ask = useAsk()
  const [status, setStatus] = useState("pending")
  const q = useQuery({ queryKey: ["waste", "admin", status], queryFn: () => api.get<WasteSlip[]>(`/waste${qs({ status: status === "all" ? "" : status })}`) })
  const approve = useAction((id: number) => api.post(`/waste/${id}/approve`), { success: "Đã duyệt", invalidate: [["waste"], ["dashboard"]] })
  const reject = useAction((v: { id: number; note: string }) => api.post(`/waste/${v.id}/reject`, { note: v.note }), { success: "Đã từ chối, đảo lại tồn", invalidate: [["waste"], ["dashboard"]] })
  const columns = useMemo<ColumnDef<WasteSlip, unknown>[]>(() => [
    { accessorKey: "at", header: "Lúc", cell: ({ row }) => dateTime(row.original.at) },
    { accessorKey: "ingredient", header: "Nguyên liệu" },
    { accessorKey: "location", header: "Vị trí", cell: ({ row }) => <LocationBadge location={row.original.location} /> },
    { id: "qty", accessorFn: (r) => Number(r.qty), header: "Lượng", meta: { numeric: true }, cell: ({ row }) => qty(row.original.qty, row.original.unit) },
    { accessorKey: "value", header: "Giá trị", meta: { numeric: true }, cell: ({ row }) => money(row.original.value) },
    { accessorKey: "type_label", header: "Loại", cell: ({ row }) => <span>{row.original.type_label}<div className="text-xs text-muted-foreground">{row.original.reason}</div></span> },
    { accessorKey: "created_by", header: "Người ghi" },
    { id: "status", header: "Trạng thái", cell: ({ row }) => <StatusPill tone={WASTE_STATUS[row.original.status].tone}>{WASTE_STATUS[row.original.status].label}</StatusPill> },
    { id: "act", header: "", enableSorting: false, cell: ({ row }) => row.original.status.startsWith("pending") ? (
      <div className="flex gap-1">
        <Button size="sm" onClick={() => approve.mutate(row.original.id)}><Check className="size-3.5" /> Duyệt</Button>
        <Button size="sm" variant="ghost" aria-label="Từ chối" onClick={async () => {
          const n = await ask.reason({ title: `Từ chối phiếu ${row.original.ingredient}?`, description: "Hao hụt sẽ được đảo lại vào tồn.", presets: ["Không đúng thực tế", "Sai nguyên liệu", "Sai lượng"], confirmLabel: "Từ chối", danger: true })
          if (n) reject.mutate({ id: row.original.id, note: n })
        }}><X className="size-3.5" /> Từ chối</Button>
      </div>
    ) : null },
  ], [approve, reject, ask])
  return (
    <div className="space-y-4">
      <PageHeader title="Phiếu hao hụt" icon={Trash2} description="Hao hụt ghi tại thời điểm xảy ra, có loại và lý do. Trong hạn mức bếp trưởng duyệt, vượt hạn mức quản lý duyệt. Từ chối = đảo lại bằng giao dịch mới." />
      <FilterTabs label="Lọc phiếu theo trạng thái" value={status} onChange={setStatus} options={[{ value: "pending", label: "Chờ duyệt" }, { value: "approved", label: "Đã duyệt" }, { value: "rejected", label: "Từ chối" }, { value: "all", label: "Tất cả" }]} />
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={q.data ?? []} empty="Không có phiếu" />}
    </div>
  )
}

export function ShiftsPage() {
  const shifts = useQuery({ queryKey: ["shifts", 14], queryFn: () => api.get<Shift[]>("/shifts?days=14") })
  const handovers = useQuery({ queryKey: ["handovers"], queryFn: () => api.get<Handover[]>("/handovers") })
  return (
    <div className="space-y-4">
      <PageHeader title="Ca & bàn giao" icon={Scale} description="Kỳ đo nhóm A tại Bếp là một ca: từ lúc bếp trưởng ký nhận bàn giao đến lúc thủ kho cân trả. Chênh lệch ca gắn với người đã ký nhận." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Ca 14 ngày gần nhất">
          {shifts.isLoading ? <Loading /> : (
            <ul className="divide-y text-sm">
              {(shifts.data ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><b>{s.name}</b> {dateOnly(s.business_date)} <span className="text-muted-foreground">{time(s.planned_start)}-{time(s.planned_end)}</span></span>
                  <span className="flex items-center gap-2">
                    {s.head_chef && <span className="text-muted-foreground">{s.head_chef}</span>}
                    {s.sod_violation && <StatusPill tone="bad"><ShieldAlert className="size-3" />Kiêm nhiệm</StatusPill>}
                    <StatusPill tone={s.status === "closed" ? "good" : s.status === "open" ? "info" : "neutral"}>
                      {s.status === "closed" ? `Đã cân trả ${time(s.closed_at)}` : s.status === "open" ? `Mở từ ${time(s.opened_at)}` : "Chưa bàn giao"}
                    </StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Phiếu bàn giao">
          {handovers.isLoading ? <Loading /> : (
            <ul className="divide-y text-sm">
              {(handovers.data ?? []).map((h) => (
                <li key={h.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b>{h.code}</b>, {h.kind === "start" ? "Đầu ca" : "Bổ sung"}, {h.shift.name} {dateOnly(h.shift.business_date)}</span>
                    <span className="flex items-center gap-2">
                      {h.mismatch_attempts > 0 && <StatusPill tone="warn">{h.mismatch_attempts} lần lệch cân</StatusPill>}
                      <StatusPill tone={h.status === "signed" ? "good" : h.status === "pending" ? "warn" : "neutral"}>{h.status === "signed" ? "Đã ký" : h.status === "pending" ? "Chờ ký" : "Đã hủy"}</StatusPill>
                    </span>
                  </div>
                  <div className="text-muted-foreground">Xuất {dateTime(h.issued_at)} bởi {h.issued_by}{h.received_by && ` · ${h.received_by} ký ${time(h.signed_at)}`}</div>
                  <div>{h.lines.map((l) => `${l.ingredient} ${qty(l.issued_qty, l.unit)}${l.received_qty !== null ? ` (bếp cân ${qty(l.received_qty, l.unit)})` : ""}`).join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}

// ---- Báo cáo khác ----

interface WasteReport {
  on_time_value: number
  late_value: number
  by_type: { key: string; value: number }[]
  by_ingredient: { key: string; value: number; qty: number }[]
  by_shift: { key: string; value: number }[]
  by_person: { key: string; value: number }[]
  by_dish: { key: string; value: number }[]
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <Empty>Không có dữ liệu trong kỳ</Empty>
  return (
    <div className="overflow-x-auto surface">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{head.map((h, i) => <th key={h} className={`p-2 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className={`p-2 ${j === 0 ? "" : "text-right tabular"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function ReportsPage() {
  const { from, to, control } = useDateRange(14)
  const p = qs({ date_from: from, date_to: to })
  const waste = useQuery({ queryKey: ["r-waste", p], queryFn: () => api.get<WasteReport>(`/reports/waste${p}`) })
  const shifts = useQuery({ queryKey: ["r-shifts", p], queryFn: () => api.get<{ id: number; business_date: string; name: string; head_chef: string | null; handed_value: number; variance_value: number; worst_tier: Tier; investigations: number; dishes: number; sod_violation: boolean; status: string }[]>(`/reports/shifts${p}`) })
  const counts = useQuery({ queryKey: ["r-counts", p], queryFn: () => api.get<{ code: string; kind: string; location: string; cutoff_at: string; counted_by: string; ingredient: string; unit: string; book_qty: number; counted_qty: number; variance_qty: number; variance_pct: number | null; variance_value: number; tier: Tier }[]>(`/reports/counts${p}`) })
  const receipts = useQuery({ queryKey: ["r-receipts", p], queryFn: () => api.get<{ code: string; supplier: string; received_at: string; ingredient: string; unit: string; ordered_qty: number; received_qty: number; unit_price: number; unit_cost_base: number; base_unit: string; status: string }[]>(`/reports/receipts${p}`) })
  const sales = useQuery({ queryKey: ["r-sales", p], queryFn: () => api.get<{ date: string; shift: string; sold: number; cancel_after_start: number; remade: number; cancel_before_start: number; out_of_stock: number }[]>(`/reports/sales${p}`) })
  const w = waste.data
  return (
    <div className="space-y-4">
      <PageHeader title="Báo cáo khác" icon={FileText} description="Hao hụt theo loại / món / ca / nhân viên, chênh lệch theo ca và bếp trưởng, lịch sử kiểm kê, nhập hàng & đơn giá, số món bán/hủy/làm lại." />
      <div className="surface p-3">{control}</div>
      <Tabs defaultValue="waste">
        <TabsList className="flex-wrap">
          <TabsTrigger value="waste">Hao hụt</TabsTrigger><TabsTrigger value="shifts">Theo ca & bếp trưởng</TabsTrigger>
          <TabsTrigger value="counts">Lịch sử kiểm kê</TabsTrigger><TabsTrigger value="receipts">Nhập hàng & đơn giá</TabsTrigger><TabsTrigger value="sales">Bán / hủy / làm lại</TabsTrigger>
        </TabsList>
        <TabsContent value="waste" className="space-y-4 pt-2">
          {!w ? <Loading /> : (
            <>
              <div className="flex flex-wrap gap-6 text-sm">
                <span>Ghi đúng lúc: <b>{money(w.on_time_value)}</b></span>
                <span>Ghi muộn qua điều tra: <b className="text-critical-ink">{money(w.late_value)}</b></span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Theo loại"><HBars diverging={false} rows={w.by_type.map((r) => ({ key: r.key, label: r.key, value: Number(r.value) }))} format={moneyShort} /></Section>
                <Section title="Theo nguyên liệu"><HBars diverging={false} rows={w.by_ingredient.map((r) => ({ key: r.key, label: r.key, value: Number(r.value) }))} format={moneyShort} /></Section>
                <Section title="Theo nhân viên (người ghi / người chịu trách nhiệm)"><HBars diverging={false} rows={w.by_person.map((r) => ({ key: r.key, label: r.key, value: Number(r.value) }))} format={moneyShort} /></Section>
                <Section title="Theo món (hủy sau chế biến, làm lại)"><HBars diverging={false} rows={w.by_dish.map((r) => ({ key: r.key, label: r.key, value: Number(r.value) }))} format={moneyShort} /></Section>
              </div>
              <Section title="Theo ca"><SimpleTable head={["Ca", "Giá trị"]} rows={w.by_shift.map((r) => [r.key, money(r.value)])} /></Section>
            </>
          )}
        </TabsContent>
        <TabsContent value="shifts" className="pt-2">
          {shifts.isLoading ? <Loading /> : (
            <div className="overflow-x-auto surface">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-2 text-left">Ca</th><th className="p-2 text-left">Bếp trưởng</th><th className="p-2 text-right">Món</th><th className="p-2 text-right">Giá trị bàn giao</th><th className="p-2 text-right">Chênh lệch</th><th className="p-2">Mức</th><th className="p-2 text-right">Phiếu điều tra</th><th className="p-2" /></tr></thead>
                <tbody>{(shifts.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.name} {dateOnly(s.business_date)}</td><td className="p-2">{s.head_chef ?? "-"}</td>
                    <td className="p-2 text-right tabular">{s.dishes}</td><td className="p-2 text-right tabular">{money(s.handed_value)}</td>
                    <td className="p-2 text-right font-medium tabular">{money(s.variance_value)}</td><td className="p-2"><TierBadge tier={s.worst_tier} short /></td>
                    <td className="p-2 text-right tabular">{s.investigations || "-"}</td>
                    <td className="p-2">{s.sod_violation && <StatusPill tone="bad">Kiêm nhiệm</StatusPill>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="counts" className="pt-2">
          <SimpleTable head={["Lúc · phiên", "Nguyên liệu", "Tồn sổ", "Thực đếm", "Chênh lệch", "%", "Giá trị"]}
            rows={(counts.data ?? []).map((c) => [`${dateTime(c.cutoff_at)}, ${c.kind} (${c.location === "bep" ? "Bếp" : "Kho"}), ${c.counted_by}`, c.ingredient, qty(c.book_qty, c.unit), qty(c.counted_qty, c.unit), signedQty(c.variance_qty, c.unit), pct(c.variance_pct), money(c.variance_value)])} />
        </TabsContent>
        <TabsContent value="receipts" className="pt-2">
          <SimpleTable head={["Phiếu", "Nguyên liệu", "Đặt", "Nhận", "Đơn giá", "Giá / đv cơ sở"]}
            rows={(receipts.data ?? []).map((r) => [`${r.code}, ${r.supplier}, ${dateTime(r.received_at)}`, r.ingredient, `${Number(r.ordered_qty)} ${r.unit}`, `${Number(r.received_qty)} ${r.unit}`, money(r.unit_price), `${money(r.unit_cost_base)}/${unit(r.base_unit)}`])} />
        </TabsContent>
        <TabsContent value="sales" className="pt-2">
          <SimpleTable head={["Ngày · ca", "Đã bán", "Hủy trước khi nấu", "Hủy sau khi nấu", "Làm lại", "Hết nguyên liệu"]}
            rows={(sales.data ?? []).map((s) => [`${dateOnly(s.date)} · ${s.shift}`, s.sold, s.cancel_before_start, s.cancel_after_start, s.remade, s.out_of_stock])} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
