import { useQuery } from "@tanstack/react-query"
import { Bell, Check, ClipboardCheck, Dices, Eye, ShieldAlert, Warehouse } from "@/components/icons"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { useAsk } from "@/components/ask"
import { Empty, GroupBadge, LocationBadge, Loading, PageHeader, Section, SeverityIcon, StatusPill, TierBadge, FilterTabs } from "@/components/common"
import { DataTable, type ColumnDef } from "@/components/DataTable"
import { allFilled, toNumbers, WeighList } from "@/components/WeighList"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { dateTime, money, pct, qty, signedQty } from "@/lib/format"
import type { Alert, CountSession, Ingredient } from "@/lib/types"
import { useAction } from "@/lib/useAction"

// ---- Cảnh báo ----

const ALERT_KIND: Record<string, string> = {
  out_with_book: "Báo hết khi sổ còn hàng",
  variance_must: "Bắt buộc giải trình",
  variance_warn: "Mức cảnh báo",
  trend: "Xu hướng lệch cùng chiều",
  handover_unsigned: "Bàn giao chưa ký",
  handover_mismatch: "Bàn giao lệch cân",
  shift_not_returned: "Chưa cân trả",
  no_handover: "Chưa bàn giao đầu ca",
  no_count: "Chưa kiểm kê",
  investigation_overdue: "Phiếu quá hạn",
  cancel_anomaly: "Hủy / làm lại bất thường",
  negative_book: "Tồn sổ âm",
  receipt_pending: "Phiếu nhập chờ duyệt",
}

export function AlertsPage() {
  const [status, setStatus] = useState("open")
  const q = useQuery({ queryKey: ["alerts", status], queryFn: () => api.get<Alert[]>(`/alerts?status=${status}`) })
  const resolve = useAction((id: number) => api.post(`/alerts/${id}/resolve`), { invalidate: [["alerts"], ["dashboard"]] })
  return (
    <div className="space-y-4">
      <PageHeader title="Cảnh báo" icon={Bell} description="Báo hết khi sổ còn hàng, chênh lệch vượt ngưỡng, quy trình bị bỏ qua, xu hướng lệch cùng chiều, phiếu quá hạn." />
      <FilterTabs label="Lọc cảnh báo" value={status} onChange={setStatus} options={[{ value: "open", label: "Đang mở" }, { value: "resolved", label: "Đã xử lý" }, { value: "all", label: "Tất cả" }]} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty>Không có cảnh báo</Empty> : (
        <ul className="divide-y surface">
          {q.data.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-4 py-3">
              <SeverityIcon severity={a.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  <StatusPill tone="neutral">{ALERT_KIND[a.kind] ?? a.kind}</StatusPill>
                </div>
                {a.body && <div className="mt-0.5 text-sm text-muted-foreground">{a.body}</div>}
                {a.ref_type === "investigation" && <Link to={`/quan-ly/dieu-tra/${a.ref_id}`} className="text-sm text-paprika-ink underline underline-offset-4 hover:decoration-2">Mở phiếu điều tra</Link>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{dateTime(a.at)}</span>
                {a.status === "open" && <Button size="sm" variant="outline" onClick={() => resolve.mutate(a.id)}><Check className="size-3.5" /> Đã xử lý</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Kiểm kê (quản lý) ----

export function CountsAdminPage() {
  const ask = useAsk()
  const q = useQuery({ queryKey: ["counts", "all"], queryFn: () => api.get<CountSession[]>("/counts") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [view, setView] = useState<CountSession | null>(null)
  const [counting, setCounting] = useState<CountSession | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [pick, setPick] = useState<number[]>([])
  const [location, setLocation] = useState<"bep" | "kho">("bep")
  const inv = [["counts"], ["dashboard"], ["investigations"], ["alerts"]]
  const spot = useAction((body: object) => api.post<CountSession>("/counts", { kind: "spot", location, note: "Kiểm kê đột xuất, không báo trước", ...body }), {
    success: (s) => `Đã mở ${s.code}: ${s.lines.map((l) => l.ingredient).join(", ")}`,
    invalidate: inv,
    onSuccess: (s) => { setCounting(s); setValues({}); setPick([]) },
  })
  const submit = useAction(() => api.post<CountSession>(`/counts/${counting!.id}/submit`, { counts: toNumbers(values) }), {
    success: "Đã chốt kiểm kê đột xuất", invalidate: inv, onSuccess: (s) => { setCounting(null); setView(s) },
  })
  const review = useAction((id: number) => api.post<CountSession>(`/counts/${id}/review`), { success: "Đã duyệt phiên", invalidate: inv, onSuccess: setView })
  const correction = useAction((v: { id: number; note: string }) => api.post<CountSession>(`/counts/${v.id}/correction`, { note: v.note }), {
    success: (s) => `Đã tạo phiên điều chỉnh ${s.code}`, invalidate: inv,
  })

  const columns = useMemo<ColumnDef<CountSession, unknown>[]>(() => [
    { accessorKey: "code", header: "Mã", cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
    { accessorKey: "kind_label", header: "Hình thức" },
    { accessorKey: "location", header: "Vị trí", cell: ({ row }) => <LocationBadge location={row.original.location} /> },
    { accessorKey: "cutoff_at", header: "Chốt lúc", cell: ({ row }) => row.original.status === "open" ? <StatusPill tone="warn">Đang mở</StatusPill> : dateTime(row.original.cutoff_at) },
    { accessorKey: "counted_by", header: "Người đếm", cell: ({ row }) => row.original.counted_by ?? "-" },
    { id: "worst", header: "Mức cao nhất", cell: ({ row }) => {
      const tiers = row.original.lines.map((l) => l.tier).filter(Boolean)
      const t = tiers.includes("must") ? "must" : tiers.includes("warn") ? "warn" : tiers.length ? "ok" : null
      return <TierBadge tier={t} />
    } },
    { id: "value", header: "Giá trị lệch", meta: { numeric: true }, accessorFn: (r) => r.lines.reduce((s, l) => s + Number(l.variance_value ?? 0), 0), cell: ({ getValue }) => money(getValue() as number) },
    { accessorKey: "reviewed_by", header: "Duyệt", cell: ({ row }) => row.original.reviewed_by ?? (row.original.kind === "periodic" && row.original.status === "locked" ? <StatusPill tone="warn">Chờ duyệt</StatusPill> : "-") },
  ], [])

  const groupA = (ings.data ?? []).filter((i) => i.control_group === "A")
  const choices = location === "bep" ? groupA : (ings.data ?? [])

  return (
    <div className="space-y-4">
      <PageHeader title="Kiểm kê" icon={ClipboardCheck} description="Kiểm kê mù: người đếm không thấy tồn sổ. Kiểm kê đột xuất do quản lý thực hiện không báo trước, dùng khi nghi ngờ hoặc để xác nhận báo hết nhầm." />
      {counting ? (
        <Section title={`${counting.code}: kiểm kê đột xuất tại ${counting.location === "bep" ? "Bếp" : "Kho"}`}>
          <WeighList rows={counting.lines.map((l) => ({ key: l.ingredient_id, label: l.ingredient, unit: l.unit }))} values={values} onChange={setValues} />
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => setCounting(null)}>Để sau</Button>
            <Button disabled={!allFilled(counting.lines.map((l) => ({ key: l.ingredient_id, label: "", unit: "" })), values) || submit.isPending} onClick={() => submit.mutate(undefined)}>Chốt kiểm kê</Button>
          </div>
        </Section>
      ) : (
        <Section title="Kiểm kê đột xuất">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={location === "bep" ? "default" : "outline"} onClick={() => { setLocation("bep"); setPick([]) }}>Tại Bếp</Button>
            <Button size="sm" variant={location === "kho" ? "default" : "outline"} onClick={() => { setLocation("kho"); setPick([]) }}>Tại Kho</Button>
            <Button size="sm" variant="secondary" onClick={() => spot.mutate({ random_n: 2 })}><Dices className="size-4" /> Hệ thống chọn ngẫu nhiên 2 nguyên liệu nhóm A</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {choices.map((i) => (
              <label key={i.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={pick.includes(i.id)} onCheckedChange={(v) => setPick((p) => v ? [...p, i.id] : p.filter((x) => x !== i.id))} />
                {i.name} <GroupBadge group={i.control_group} />
              </label>
            ))}
          </div>
          <Button className="mt-3" disabled={!pick.length || spot.isPending} onClick={() => spot.mutate({ ingredient_ids: pick })}>Mở phiên kiểm kê đột xuất</Button>
        </Section>
      )}
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={q.data ?? []} onRowClick={setView} />}

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{view?.code}, {view?.kind_label}, {view?.location === "bep" ? "Bếp" : "Kho"}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Người đếm {view.counted_by ?? "-"}, chốt {dateTime(view.cutoff_at)}, {view.shift ? `${view.shift.name}` : "ngoài ca"}{view.note && `, ${view.note}`}</div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr><th className="p-2 text-left">Nguyên liệu</th><th className="p-2 text-right">Lý thuyết kỳ</th><th className="p-2 text-right">Tồn sổ</th><th className="p-2 text-right">Thực đếm</th><th className="p-2 text-right">Chênh lệch</th><th className="p-2 text-right">%</th><th className="p-2 text-right">Giá trị</th><th className="p-2">Mức</th></tr>
                  </thead>
                  <tbody>
                    {view.lines.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">{l.ingredient}</td>
                        <td className="p-2 text-right tabular">{qty(l.theoretical_qty, l.unit)}</td>
                        <td className="p-2 text-right tabular">{qty(l.book_qty, l.unit)}</td>
                        <td className="p-2 text-right tabular">{qty(l.counted_qty, l.unit)}</td>
                        <td className="p-2 text-right font-medium tabular">{signedQty(l.variance_qty, l.unit)}</td>
                        <td className="p-2 text-right tabular">{pct(l.variance_pct)}</td>
                        <td className="p-2 text-right tabular">{money(l.variance_value)}</td>
                        <td className="p-2"><TierBadge tier={l.tier} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                {view.status === "locked" && !view.reviewed_by && <Button onClick={() => review.mutate(view.id)}><Eye className="size-4" /> Duyệt phiên</Button>}
                {view.status === "locked" && (
                  <Button variant="outline" onClick={async () => {
                    const n = await ask.reason({ title: "Tạo phiên điều chỉnh?", description: "Dùng khi phát hiện phiên này đếm sai. Phiên gốc giữ nguyên để truy vết.", placeholder: "Lý do (phát hiện đếm sai…)", confirmLabel: "Tạo phiên" })
                    if (n) correction.mutate({ id: view.id, note: n })
                  }}>
                    Tạo phiên điều chỉnh
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- Tồn sổ ----

interface StockRow {
  id: number; code: string; name: string; group: "A" | "C"; unit: string; kho: number; bep: number; total: number; value: number
  min_stock: number; below_min: boolean; portions: { dish: string; portions: number | null }[]
}

export function StockPage() {
  const q = useQuery({ queryKey: ["stock"], queryFn: () => api.get<{ rows: StockRow[]; cache_mismatch: unknown[] }>("/stock") })
  const [filter, setFilter] = useState("")
  const columns = useMemo<ColumnDef<StockRow, unknown>[]>(() => [
    { accessorKey: "name", header: "Nguyên liệu", cell: ({ row }) => <span className="font-medium">{row.original.name} <GroupBadge group={row.original.group} /></span> },
    { accessorKey: "kho", header: "Tại Kho", meta: { numeric: true }, cell: ({ row }) => qty(row.original.kho, row.original.unit) },
    { accessorKey: "bep", header: "Tại Bếp", meta: { numeric: true }, cell: ({ row }) => qty(row.original.bep, row.original.unit) },
    { accessorKey: "total", header: "Tổng", meta: { numeric: true }, cell: ({ row }) => <b>{qty(row.original.total, row.original.unit)}</b> },
    { accessorKey: "value", header: "Giá trị", meta: { numeric: true }, cell: ({ row }) => money(row.original.value) },
    { id: "min", header: "Tồn tối thiểu", cell: ({ row }) => row.original.below_min ? <StatusPill tone="warn">Dưới {qty(row.original.min_stock, row.original.unit)}</StatusPill> : <span className="text-muted-foreground">{qty(row.original.min_stock, row.original.unit)}</span> },
    { id: "portions", header: "Số phần còn làm được", enableSorting: false, cell: ({ row }) => <span className="text-xs">{row.original.portions.map((p) => `${p.dish}: ${p.portions ?? "-"}`).join(" · ") || "-"}</span> },
  ], [])
  return (
    <div className="space-y-4">
      <PageHeader title="Tồn sổ theo vị trí" icon={Warehouse} description="Số hệ thống tự tính từ sổ giao dịch (chỉ quản lý thấy). Số phần còn làm được = tồn sổ (Kho + Bếp) ÷ định lượng một phần: tham khảo khi bếp báo hết." />
      {q.data && q.data.cache_mismatch.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-status-critical/40 bg-status-critical/5 p-3 text-sm text-critical-ink"><ShieldAlert className="size-4" /> Bản cache tồn lệch với sổ giao dịch ở {q.data.cache_mismatch.length} dòng</div>
      )}
      <Input className="max-w-xs" placeholder="Lọc nguyên liệu…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={(q.data?.rows ?? []).filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))} />}
    </div>
  )
}
