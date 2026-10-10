import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SettingsIcon, AlarmClock, FastForward, History, ListChecks, Pencil, Plus, RotateCcw, ScanSearch, Users } from "@/components/icons"
import { useEffect, useMemo, useState } from "react"

import { KV, Loading, PageHeader, Section, StatusPill } from "@/components/common"
import { DataTable, type ColumnDef } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, qs } from "@/lib/api"
import { useAuth, useMeta } from "@/lib/auth"
import { dateTime, longClock, money, signedQty, time } from "@/lib/format"
import type { Ingredient, Role, Settings, StaffUser } from "@/lib/types"
import { useAction } from "@/lib/useAction"

// ---- Nhật ký thao tác ----

interface AuditRow { id: number; at: string; actor: string; action: string; entity: string; entity_id: number | null; before: unknown; after: unknown; note: string | null }

export function AuditPage() {
  const [action, setAction] = useState("")
  const q = useQuery({ queryKey: ["audit", action], queryFn: () => api.get<AuditRow[]>(`/audit${qs({ action })}`) })
  const columns = useMemo<ColumnDef<AuditRow, unknown>[]>(() => [
    { accessorKey: "at", header: "Lúc", cell: ({ row }) => dateTime(row.original.at) },
    { accessorKey: "actor", header: "Người thực hiện" },
    { accessorKey: "action", header: "Thao tác", cell: ({ row }) => <code className="text-xs">{row.original.action}</code> },
    { id: "entity", header: "Đối tượng", cell: ({ row }) => `${row.original.entity}${row.original.entity_id ? ` #${row.original.entity_id}` : ""}` },
    { id: "change", header: "Trước → sau", enableSorting: false, cell: ({ row }) => (
      <div className="max-w-xl space-y-0.5 text-xs">
        {row.original.before != null && <div className="truncate text-muted-foreground" title={JSON.stringify(row.original.before)}>trước: {JSON.stringify(row.original.before)}</div>}
        {row.original.after != null && <div className="truncate" title={JSON.stringify(row.original.after)}>sau: {JSON.stringify(row.original.after)}</div>}
        {row.original.note && <div>ghi chú: {row.original.note}</div>}
      </div>
    ) },
  ], [])
  return (
    <div className="space-y-4">
      <PageHeader title="Nhật ký thao tác" icon={History} description="Chỉ ghi thêm: không ai sửa hoặc xóa được, kể cả quản lý (cơ sở dữ liệu chặn bằng trigger). Mỗi thao tác ghi người thực hiện, thời điểm, giá trị trước và sau." />
      <Input className="max-w-xs" placeholder="Lọc theo thao tác (order, recipe, handover…)" value={action} onChange={(e) => setAction(e.target.value)} />
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={q.data ?? []} />}
    </div>
  )
}

// ---- Sổ giao dịch kho ----

interface TxnRow { id: number; occurred_at: string; type: string; type_label: string; ingredient: string; unit: string; location: string; qty: number; value: number; shift_id: number | null; source_type: string | null; source_id: number | null; ref_txn_id: number | null; waste_type: string | null; late: boolean; cause: string | null; responsible: string | null; created_by: string | null; approved_by: string | null; note: string | null }

export function TxnsPage() {
  const meta = useMeta()
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [ing, setIng] = useState("all")
  const [type, setType] = useState("all")
  const [loc, setLoc] = useState("all")
  const params = { ingredient_id: ing === "all" ? "" : ing, txn_type: type === "all" ? "" : type, location: loc === "all" ? "" : loc }
  const q = useQuery({ queryKey: ["txns", params], queryFn: () => api.get<TxnRow[]>(`/txns${qs(params)}`) })
  const columns = useMemo<ColumnDef<TxnRow, unknown>[]>(() => [
    { accessorKey: "id", header: "#", meta: { numeric: true } },
    { accessorKey: "occurred_at", header: "Lúc", cell: ({ row }) => dateTime(row.original.occurred_at) },
    { accessorKey: "type_label", header: "Loại", cell: ({ row }) => <span>{row.original.type_label}{row.original.late && <StatusPill tone="warn">ghi muộn</StatusPill>}</span> },
    { accessorKey: "ingredient", header: "Nguyên liệu" },
    { accessorKey: "location", header: "Vị trí", cell: ({ row }) => (row.original.location === "bep" ? "Bếp" : "Kho") },
    { accessorKey: "qty", header: "Số lượng", meta: { numeric: true }, cell: ({ row }) => signedQty(row.original.qty, row.original.unit) },
    { accessorKey: "value", header: "Giá trị", meta: { numeric: true }, cell: ({ row }) => money(row.original.value) },
    { id: "src", header: "Chứng từ", cell: ({ row }) => <span className="text-xs">{row.original.source_type ? `${row.original.source_type} #${row.original.source_id}` : "-"}{row.original.ref_txn_id ? ` → gốc #${row.original.ref_txn_id}` : ""}</span> },
    { accessorKey: "created_by", header: "Người tạo" },
    { accessorKey: "approved_by", header: "Người duyệt / ký", cell: ({ row }) => row.original.approved_by ?? "-" },
    { accessorKey: "responsible", header: "Chịu trách nhiệm", cell: ({ row }) => row.original.responsible ?? "-" },
  ], [])
  return (
    <div className="space-y-4">
      <PageHeader title="Sổ giao dịch kho" icon={ListChecks} description="Mọi biến động kho là một giao dịch bất biến. Sửa sai bằng điều chỉnh có liên kết trỏ về bản gốc. 300 giao dịch gần nhất theo bộ lọc." />
      <div className="flex flex-wrap gap-2 surface p-3">
        <Select value={ing} onValueChange={setIng}><SelectTrigger className="w-44" aria-label="Nguyên liệu"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Mọi nguyên liệu</SelectItem>{(ings.data ?? []).map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent></Select>
        <Select value={type} onValueChange={setType}><SelectTrigger className="w-60" aria-label="Loại giao dịch"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Mọi loại giao dịch</SelectItem>{Object.entries(meta.data?.txn_types ?? {}).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <Select value={loc} onValueChange={setLoc}><SelectTrigger className="w-32" aria-label="Vị trí"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Mọi vị trí</SelectItem><SelectItem value="kho">Kho</SelectItem><SelectItem value="bep">Bếp</SelectItem></SelectContent></Select>
      </div>
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={q.data ?? []} />}
    </div>
  )
}

// ---- Người dùng ----

interface UserRow extends StaffUser { active: boolean; has_pin: boolean; has_password: boolean }

export function UsersPage() {
  const meta = useMeta()
  const q = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRow[]>("/users") })
  const [form, setForm] = useState<{ id?: number; username: string; full_name: string; roles: Role[]; pin: string; password: string; active: boolean } | null>(null)
  const save = useAction(() => {
    const body = { username: form!.username, full_name: form!.full_name, roles: form!.roles, pin: form!.pin || null, password: form!.password || null, active: form!.active }
    return form!.id ? api.put(`/users/${form!.id}`, body) : api.post("/users", body)
  }, { success: "Đã lưu người dùng", invalidate: [["users"], ["staff"]], onSuccess: () => setForm(null) })
  const roles = Object.entries(meta.data?.roles ?? {}) as [Role, string][]
  return (
    <div className="space-y-4">
      <PageHeader title="Người dùng & phân quyền" icon={Users} description="Một người có thể kiêm nhiều vai trò; khi đó các ca liên quan được đánh dấu “không đảm bảo phân tách nhiệm vụ”. Nhân viên đăng nhập và ký bằng PIN; quản lý dùng mật khẩu."
        actions={<Button onClick={() => setForm({ username: "", full_name: "", roles: [], pin: "", password: "", active: true })}><Plus className="size-4" /> Người dùng mới</Button>} />
      {q.isLoading ? <Loading /> : (
        <div className="overflow-x-auto surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-2 text-left">Họ tên</th><th className="p-2 text-left">Tên đăng nhập</th><th className="p-2 text-left">Vai trò</th><th className="p-2 text-left">Đăng nhập</th><th className="p-2 text-left">Trạng thái</th><th /></tr></thead>
            <tbody>
              {(q.data ?? []).map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2 font-medium">{u.full_name}</td><td className="p-2">{u.username}</td>
                  <td className="p-2">{u.role_labels.join(", ")} {u.roles.length > 1 && <StatusPill tone="warn">Kiêm nhiệm</StatusPill>}</td>
                  <td className="p-2">{[u.has_pin && "PIN", u.has_password && "Mật khẩu"].filter(Boolean).join(" · ")}</td>
                  <td className="p-2">{u.active ? <StatusPill tone="good">Hoạt động</StatusPill> : <StatusPill tone="neutral">Đã khóa</StatusPill>}</td>
                  <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => setForm({ id: u.id, username: u.username, full_name: u.full_name, roles: u.roles, pin: "", password: "", active: u.active })}><Pencil className="size-4" /> Sửa</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Sửa người dùng" : "Người dùng mới"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className="text-sm font-medium">Tên đăng nhập</span><Input value={form.username} disabled={!!form.id} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
                <label className="block space-y-1.5"><span className="text-sm font-medium">Họ tên</span><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
              </div>
              <div className="space-y-1.5" role="group" aria-labelledby="vai-tro"><Label id="vai-tro">Vai trò</Label>
                <div className="flex flex-wrap gap-3">
                  {roles.map(([k, v]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.roles.includes(k)} onCheckedChange={(c) => setForm({ ...form, roles: c ? [...form.roles, k] : form.roles.filter((r) => r !== k) })} /> {v}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5"><span className="text-sm font-medium">PIN 4-6 số {form.id && "(để trống = giữ nguyên)"}</span><Input inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
                <label className="block space-y-1.5"><span className="text-sm font-medium">Mật khẩu {form.id && "(để trống = giữ nguyên)"}</span><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              </div>
              <Label className="flex items-center gap-2 font-normal"><Checkbox checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: !!c })} /> Đang hoạt động</Label>
            </div>
          )}
          <DialogFooter><Button disabled={!form?.username || !form?.full_name || !form?.roles.length || save.isPending} onClick={() => save.mutate(undefined)}>Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- Cài đặt ngưỡng ----

export function SettingsPage() {
  const meta = useMeta()
  const qc = useQueryClient()
  const [s, setS] = useState<Settings | null>(null)
  useEffect(() => { if (meta.data && !s) setS(structuredClone(meta.data.settings)) }, [meta.data, s])
  const save = useAction(async () => {
    for (const [k, v] of Object.entries(s!)) await api.put(`/settings/${k}`, v)
  }, { success: "Đã lưu cấu hình", onSuccess: () => qc.invalidateQueries({ queryKey: ["meta"] }) })
  if (!s) return <Loading />
  const th = (g: "A" | "C", k: keyof Settings["thresholds"]["A"], label: string) => (
    <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>
      <Input inputMode="decimal" value={String(s.thresholds[g][k])} onChange={(e) => setS({ ...s, thresholds: { ...s.thresholds, [g]: { ...s.thresholds[g], [k]: Number(e.target.value.replace(",", ".")) || 0 } } })} />
    </label>
  )
  const one = (k: Exclude<keyof Settings, "thresholds">, label: string) => (
    <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span><Input inputMode="numeric" value={String(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) || 0 })} /></label>
  )
  return (
    <div className="space-y-4">
      <PageHeader title="Cài đặt ngưỡng & quy trình" icon={SettingsIcon} description="Ngưỡng sai số hai tầng: chỉ coi là vượt khi vượt cả % (so với tiêu hao lý thuyết) và mức tối thiểu tuyệt đối; kỳ không có món bán chỉ xét mức tuyệt đối. Ngưỡng riêng của nguyên liệu đặt ở màn Nguyên liệu."
        actions={<Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>Lưu cấu hình</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {(["A", "C"] as const).map((g) => (
          <Section key={g} title={g === "A" ? "Nhóm A: hàng tươi, giá trị cao" : "Nhóm C: gia vị, hàng khô"}>
            <div className="grid grid-cols-2 gap-3">
              {th(g, "warn_pct", "Mức cảnh báo (%)")}{th(g, "warn_abs", "… và lệch tối thiểu (g/ml/cái)")}
              {th(g, "must_pct", "Bắt buộc duyệt (%)")}{th(g, "must_abs", "… và lệch tối thiểu (g/ml/cái)")}
            </div>
          </Section>
        ))}
      </div>
      <Section title="Quy trình">
        <div className="grid gap-3 md:grid-cols-3">
          {one("investigation_due_hours", "Hạn xử lý phiếu điều tra (giờ)")}
          {one("handover_tolerance", "Dung sai cân khi bàn giao (g)")}
          {one("trend_periods", "Cảnh báo xu hướng sau N kỳ cùng chiều")}
          {one("return_grace_minutes", "Quá giờ cân trả bao nhiêu phút thì cảnh báo")}
          {one("handover_sign_grace_minutes", "Phiếu bàn giao chưa ký sau (phút)")}
          {one("receipt_price_tolerance_pct", "Phiếu nhập lệch đơn giá quá (%)")}
          {one("receipt_history_ratio", "Lệch so với lịch sử nhập (lần)")}
          {one("cancel_anomaly_min", "Hủy / làm lại bất thường từ (lần/ngày)")}
        </div>
      </Section>
    </div>
  )
}

// ---- Đồng hồ demo ----

export function DemoClockPage() {
  const { me, refresh } = useAuth()
  const qc = useQueryClient()
  const clockQ = useQuery({ queryKey: ["demo-clock"], queryFn: () => api.get<{ now: string; offset_seconds: number; demo_mode: boolean }>("/demo/clock") })
  const move = useAction((body: object) => api.post<{ now: string; new_alerts: number }>("/demo/clock", body), {
    success: (r) => `Giờ demo: ${longClock(r.now)} · ${r.new_alerts} cảnh báo mới`,
    onSuccess: () => { void refresh(); qc.invalidateQueries() },
  })
  const scan = useAction(() => api.post<{ new_alerts: number }>("/demo/scan"), { success: (r) => `Đã quét: ${r.new_alerts} cảnh báo mới`, invalidate: [["alerts"], ["dashboard"]] })
  const shift = me?.shift
  const toEnd = shift ? Math.max(1, Math.ceil((new Date(shift.planned_end).getTime() - new Date(clockQ.data?.now ?? Date.now()).getTime()) / 60000) + 35) : 0
  return (
    <div className="space-y-4">
      <PageHeader title="Đồng hồ demo" icon={AlarmClock} description="Tua đồng hồ nghiệp vụ khi trình bày (chỉ ở chế độ demo, chỉ tua tới). Sau mỗi lần tua hệ thống quét cảnh báo ngay: quá giờ chưa cân trả, phiếu điều tra quá hạn…" />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          <KV label="Giờ nghiệp vụ hiện tại">{clockQ.data ? longClock(clockQ.data.now) : "-"}</KV>
          <KV label="Lệch so với giờ thật">{clockQ.data ? `${Math.round(clockQ.data.offset_seconds / 60)} phút` : "-"}</KV>
          <KV label="Ca">{shift ? `${shift.name} ${time(shift.planned_start)}-${time(shift.planned_end)} (${shift.status})` : "Ngoài giờ ca"}</KV>
        </div>
        {!clockQ.data?.demo_mode && <p className="mt-3 text-sm text-critical-ink">Máy chủ không ở chế độ demo (DEMO_MODE=false).</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => move.mutate({ advance_minutes: 15 })}><FastForward className="size-4" /> +15 phút</Button>
          <Button variant="outline" onClick={() => move.mutate({ advance_minutes: 60 })}><FastForward className="size-4" /> +1 giờ</Button>
          {shift && <Button variant="outline" onClick={() => move.mutate({ advance_minutes: toEnd })}><AlarmClock className="size-4" /> Tới quá giờ kết thúc ca (+30 phút)</Button>}
          <Button variant="outline" onClick={() => move.mutate({ advance_minutes: 48 * 60 })}><FastForward className="size-4" /> +48 giờ</Button>
          <Button variant="ghost" onClick={() => move.mutate({ reset: true })}><RotateCcw className="size-4" /> Về giờ thật</Button>
          <Button variant="secondary" onClick={() => scan.mutate(undefined)}><ScanSearch className="size-4" /> Quét cảnh báo ngay</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Lưu ý: “Về giờ thật” có thể làm đồng hồ lùi về trước dữ liệu đã ghi bằng giờ demo; chỉ dùng khi bắt đầu lại từ dữ liệu seed.</p>
      </Section>
    </div>
  )
}
