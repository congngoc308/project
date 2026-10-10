import { useQuery } from "@tanstack/react-query"
import { BookOpen, History, Leaf, Lock, Pencil, Plus, Trash2, Unlock } from "@/components/icons"
import { useMemo, useState } from "react"

import { useAsk } from "@/components/ask"
import { Empty, GroupBadge, Loading, PageHeader, Section, StatusPill } from "@/components/common"
import { DataTable, type ColumnDef } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { dateTime, money, qty, unit } from "@/lib/format"
import type { Ingredient, MenuItem, RecipeVersion } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

// ---- Món & công thức ----

interface LineDraft {
  ingredient_id: string
  qty: string
  unit: string
  prep_loss_pct: string
  note: string
}

function RecipeEditor({ item, ingredients, onClose }: { item: MenuItem; ingredients: Ingredient[]; onClose: () => void }) {
  const byId = Object.fromEntries(ingredients.map((i) => [String(i.id), i]))
  const [lines, setLines] = useState<LineDraft[]>(
    (item.recipe?.lines ?? []).map((l) => ({ ingredient_id: String(l.ingredient_id), qty: String(Number(l.qty)), unit: l.unit, prep_loss_pct: String(Number(l.prep_loss_pct)), note: l.note })),
  )
  const [reason, setReason] = useState("")
  const [effective, setEffective] = useState("")
  const save = useAction(() => api.post(`/menu-items/${item.id}/recipes`, {
    reason,
    effective_from: effective ? new Date(effective).toISOString() : null,
    lines: lines.filter((l) => l.ingredient_id && Number(l.qty) > 0).map((l) => ({
      ingredient_id: Number(l.ingredient_id), qty: Number(l.qty), unit: l.unit || byId[l.ingredient_id]?.base_unit, prep_loss_pct: Number(l.prep_loss_pct || 0), note: l.note,
    })),
  }), { success: "Đã tạo phiên bản công thức mới", invalidate: [["menu-items"], ["recipes"]], onSuccess: onClose })

  const issue = (l: LineDraft) => {
    const ing = byId[l.ingredient_id]
    if (!ing || !Number(l.qty)) return null
    const factor = l.unit === ing.base_unit || !l.unit ? 1 : Number(ing.conversions.find((c) => c.unit === l.unit)?.factor ?? NaN)
    const loss = Number(l.prep_loss_pct || 0)
    const net = Number(l.qty) * factor
    return { net, issue: net / (1 - loss / 100), unit: ing.base_unit, cost: (net / (1 - loss / 100)) * Number(ing.last_unit_cost) }
  }
  const totalCost = lines.reduce((s, l) => s + (issue(l)?.cost ?? 0), 0)

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Sửa công thức tạo phiên bản mới có ngày hiệu lực; đơn đã bán giữ nguyên phiên bản cũ. Lượng xuất kho = lượng tinh ÷ (1 − tỷ lệ hao hụt sơ chế).
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr><th className="p-2 text-left">Nguyên liệu</th><th className="p-2 text-left">Lượng tinh / phần</th><th className="p-2 text-left">Đơn vị</th><th className="p-2 text-left">Hao hụt sơ chế %</th><th className="p-2 text-right">Xuất kho / phần</th><th className="p-2 text-right">Giá vốn</th><th /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const ing = byId[l.ingredient_id]
              const calc = issue(l)
              const set = (patch: Partial<LineDraft>) => setLines((x) => x.map((y, j) => j === i ? { ...y, ...patch } : y))
              return (
                <tr key={i} className="border-t">
                  <td className="p-1.5">
                    <Select value={l.ingredient_id} onValueChange={(v) => set({ ingredient_id: v, unit: byId[v]?.base_unit ?? "" })}>
                      <SelectTrigger className="w-44" aria-label="Nguyên liệu"><SelectValue placeholder="Chọn" /></SelectTrigger>
                      <SelectContent>{ingredients.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-1.5"><Input className="w-24" inputMode="decimal" value={l.qty} onChange={(e) => set({ qty: e.target.value.replace(",", ".") })} /></td>
                  <td className="p-1.5">
                    <Select value={l.unit} onValueChange={(v) => set({ unit: v })} disabled={!ing}>
                      <SelectTrigger className="w-24" aria-label="Đơn vị"><SelectValue /></SelectTrigger>
                      <SelectContent>{(ing?.units ?? []).map((u) => <SelectItem key={u} value={u}>{unit(u)}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-1.5"><Input className="w-20" inputMode="decimal" value={l.prep_loss_pct} onChange={(e) => set({ prep_loss_pct: e.target.value.replace(",", ".") })} /></td>
                  <td className="p-1.5 text-right font-medium tabular">{calc && Number.isFinite(calc.issue) ? qty(Math.round(calc.issue * 10) / 10, calc.unit) : <span className="text-critical-ink">{ing ? "không quy đổi được" : "-"}</span>}</td>
                  <td className="p-1.5 text-right tabular">{calc && Number.isFinite(calc.cost) ? money(calc.cost) : "-"}</td>
                  <td className="p-1.5"><Button size="icon" variant="ghost" aria-label="Bỏ" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setLines((x) => [...x, { ingredient_id: "", qty: "", unit: "", prep_loss_pct: "0", note: "" }])}><Plus className="size-4" /> Thêm nguyên liệu</Button>
        <span className="text-sm">Giá vốn nguyên liệu / phần: <b>{money(totalCost)}</b> ({Number(item.price) ? Math.round((totalCost / Number(item.price)) * 100) : 0}% giá bán)</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="block space-y-1.5"><span className="text-sm font-medium">Lý do sửa (bắt buộc)</span><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Đo lại định lượng thực tế…" /></label>
        <label className="block space-y-1.5"><span className="text-sm font-medium">Hiệu lực từ (để trống = ngay bây giờ)</span><Input type="datetime-local" value={effective} onChange={(e) => setEffective(e.target.value)} /></label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Đóng</Button>
        <Button disabled={!reason.trim() || !lines.length || save.isPending} onClick={() => save.mutate(undefined)}>Lưu phiên bản mới</Button>
      </DialogFooter>
    </div>
  )
}

export function MenuPage() {
  const ask = useAsk()
  const menu = useQuery({ queryKey: ["menu-items"], queryFn: () => api.get<MenuItem[]>("/menu-items") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [historyOf, setHistoryOf] = useState<MenuItem | null>(null)
  const [itemForm, setItemForm] = useState<Partial<MenuItem> | null>(null)
  const history = useQuery({ queryKey: ["recipes", historyOf?.id], queryFn: () => api.get<RecipeVersion[]>(`/menu-items/${historyOf!.id}/recipes`), enabled: !!historyOf })
  const resell = useAction((id: number) => api.post(`/menu-items/${id}/resell`, { note: "Quản lý mở bán" }), { success: "Đã mở bán lại", invalidate: [["menu-items"], ["menu"]] })
  const lock = useAction((v: { id: number; reason: string }) => api.post("/menu/out-of-dish", { menu_item_id: v.id, reason: v.reason }), { success: "Đã khóa bán", invalidate: [["menu-items"], ["menu"]] })
  const saveItem = useAction(() => itemForm?.id
    ? api.put(`/menu-items/${itemForm.id}`, { code: itemForm.code, name: itemForm.name, category: itemForm.category, price: Number(itemForm.price), status: itemForm.status })
    : api.post("/menu-items", { code: itemForm?.code, name: itemForm?.name, category: itemForm?.category ?? "", price: Number(itemForm?.price ?? 0), status: "selling" }),
  { success: "Đã lưu món", invalidate: [["menu-items"], ["menu"]], onSuccess: () => setItemForm(null) })

  if (menu.isLoading || ings.isLoading) return <Loading />
  return (
    <div className="space-y-4">
      <PageHeader title="Món & công thức" icon={BookOpen} description="Định mức chuẩn của từng món: lượng xuất kho cho một phần (đã cộng hao hụt sơ chế) là con số dùng để trừ kho và so sánh."
        actions={<Button onClick={() => setItemForm({ status: "selling" })}><Plus className="size-4" /> Món mới</Button>} />
      <div className="grid gap-4 xl:grid-cols-2">
        {(menu.data ?? []).map((m) => (
          <Section key={m.id}
            title={<span className="flex items-center gap-2">{m.name} <span className="font-normal text-muted-foreground">{m.code} · {money(m.price)}</span>
              {m.status === "stopped" && <StatusPill tone="neutral">Ngưng bán</StatusPill>}
              {m.locked && <StatusPill tone="bad"><Lock className="size-3" />{m.locks[0]?.reason}</StatusPill>}</span>}
            actions={
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setHistoryOf(m)}><History className="size-4" /> Lịch sử</Button>
                <Button size="sm" variant="ghost" onClick={() => setItemForm(m)}><Pencil className="size-4" /> Món</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Sửa công thức</Button>
                {m.locked ? <Button size="sm" variant="ghost" onClick={() => resell.mutate(m.id)}><Unlock className="size-4" /> Bán lại</Button>
                  : <Button size="sm" variant="ghost" onClick={async () => {
                    const r = await ask.reason({ title: `Khóa bán ${m.name}?`, description: "Chỉ khóa bán, không tác động kho.", presets: ["Hết nguyên liệu", "Hỏng thiết bị", "Ngưng phục vụ"], confirmLabel: "Khóa bán", danger: true })
                    if (r) lock.mutate({ id: m.id, reason: r })
                  }}><Lock className="size-4" /> Khóa bán</Button>}
              </div>
            }
          >
            {m.recipe ? (
              <>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="pb-1 text-left font-normal">Nguyên liệu</th><th className="pb-1 text-right font-normal">Lượng tinh</th><th className="pb-1 text-right font-normal">Hao hụt SC</th><th className="pb-1 text-right font-normal">Xuất kho / phần</th><th className="pb-1 text-right font-normal">Giá vốn</th></tr></thead>
                  <tbody>
                    {m.recipe.lines.map((l) => (
                      <tr key={l.ingredient_id} className="border-t">
                        <td className="py-1">{l.ingredient} <GroupBadge group={l.group} /></td>
                        <td className="py-1 text-right tabular">{Number(l.qty)} {unit(l.unit)}</td>
                        <td className="py-1 text-right tabular">{Number(l.prep_loss_pct)}%</td>
                        <td className="py-1 text-right font-medium tabular">{qty(l.issue_qty_base, l.base_unit)}</td>
                        <td className="py-1 text-right tabular">{money(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-xs text-muted-foreground">Phiên bản v{m.recipe.version_no}, hiệu lực từ {dateTime(m.recipe.effective_from)} · {m.recipe.reason}</div>
              </>
            ) : <Empty>Chưa có công thức</Empty>}
          </Section>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>Phiên bản công thức mới: {editing?.name}</DialogTitle></DialogHeader>
          {editing && <RecipeEditor item={editing} ingredients={ings.data ?? []} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyOf} onOpenChange={(v) => !v && setHistoryOf(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Lịch sử công thức: {historyOf?.name}</DialogTitle></DialogHeader>
          {history.isLoading ? <Loading /> : (
            <ol className="space-y-3">
              {(history.data ?? []).map((v) => (
                <li key={v.id} className={cn("rounded-lg border p-3", v.current && "border-primary")}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">v{v.version_no} {v.current && <StatusPill tone="info">Đang áp dụng</StatusPill>}</span>
                    <span className="text-muted-foreground">hiệu lực {dateTime(v.effective_from)} · {v.created_by_name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Lý do: {v.reason || "-"}</div>
                  <div className="mt-1 text-sm">{v.lines.map((l) => `${l.ingredient} ${qty(l.issue_qty_base, l.base_unit)}`).join(" · ")}</div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemForm} onOpenChange={(v) => !v && setItemForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{itemForm?.id ? "Sửa món" : "Món mới"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm font-medium">Mã</span><Input value={itemForm?.code ?? ""} disabled={!!itemForm?.id} onChange={(e) => setItemForm((f) => ({ ...f, code: e.target.value }))} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Tên món</span><Input value={itemForm?.name ?? ""} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Nhóm món</span><Input value={itemForm?.category ?? ""} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Giá bán (đ)</span><Input inputMode="numeric" value={String(itemForm?.price ?? "")} onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value.replace(/\D/g, "") }))} /></label>
            {itemForm?.id && (
              <Label className="col-span-2 flex items-center gap-2 font-normal">
                <Checkbox checked={itemForm.status === "stopped"} onCheckedChange={(v) => setItemForm((f) => ({ ...f, status: v ? "stopped" : "selling" }))} /> Ngưng bán món này
              </Label>
            )}
          </div>
          <DialogFooter><Button disabled={!itemForm?.code || !itemForm?.name || saveItem.isPending} onClick={() => saveItem.mutate(undefined)}>Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- Nguyên liệu ----

type IngForm = Record<string, string | boolean>

const EMPTY_ING: IngForm = { code: "", name: "", category: "", control_group: "A", base_unit: "g", purchase_unit: "kg", purchase_factor: "1000", last_unit_cost: "0", min_stock: "0", shelf_life_days: "", warn_pct: "", warn_abs: "", must_pct: "", must_abs: "", waste_limit: "", active: true }

export function IngredientsPage() {
  const q = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [form, setForm] = useState<IngForm | null>(null)
  const [convFor, setConvFor] = useState<Ingredient | null>(null)
  const [conv, setConv] = useState({ unit: "", factor: "" })
  const num = (v: string | boolean) => (v === "" || v === undefined ? null : Number(v))
  const save = useAction(() => {
    const f = form!
    const body = {
      code: f.code, name: f.name, category: f.category, control_group: f.control_group, base_unit: f.base_unit, purchase_unit: f.purchase_unit,
      purchase_factor: num(f.purchase_factor), last_unit_cost: Number(f.last_unit_cost || 0), min_stock: Number(f.min_stock || 0),
      shelf_life_days: num(f.shelf_life_days), warn_pct: num(f.warn_pct), warn_abs: num(f.warn_abs), must_pct: num(f.must_pct), must_abs: num(f.must_abs),
      waste_limit: num(f.waste_limit), active: f.active,
    }
    return f.id ? api.put(`/ingredients/${f.id}`, body) : api.post("/ingredients", body)
  }, { success: "Đã lưu nguyên liệu", invalidate: [["ingredients"]], onSuccess: () => setForm(null) })
  const addConv = useAction(() => api.post(`/ingredients/${convFor!.id}/conversions`, { unit: conv.unit, factor: Number(conv.factor) }), {
    success: "Đã lưu quy đổi", invalidate: [["ingredients"]], onSuccess: () => { setConvFor(null); setConv({ unit: "", factor: "" }) },
  })
  const columns = useMemo<ColumnDef<Ingredient, unknown>[]>(() => [
    { accessorKey: "name", header: "Nguyên liệu", cell: ({ row }) => <span className="font-medium">{row.original.name} <span className="text-muted-foreground">{row.original.code}</span></span> },
    { accessorKey: "control_group", header: "Nhóm", cell: ({ row }) => <GroupBadge group={row.original.control_group} /> },
    { id: "units", header: "Đơn vị (cơ sở / mua)", cell: ({ row }) => `${unit(row.original.base_unit)} / ${row.original.purchase_unit}` },
    { accessorKey: "last_unit_cost", header: "Giá nhập gần nhất", meta: { numeric: true }, cell: ({ row }) => `${money(row.original.last_unit_cost)}/${unit(row.original.base_unit)}` },
    { id: "th", header: "Ngưỡng riêng", cell: ({ row }) => row.original.warn_pct || row.original.must_pct ? `${row.original.warn_pct ?? "-"}% / ${row.original.must_pct ?? "-"}%` : <span className="text-muted-foreground">Theo nhóm</span> },
    { accessorKey: "waste_limit", header: "Hạn mức hao hụt / phiếu", meta: { numeric: true }, cell: ({ row }) => row.original.waste_limit ? qty(row.original.waste_limit, row.original.base_unit) : "-" },
    { id: "conv", header: "Quy đổi", cell: ({ row }) => <span className="block min-w-48 max-w-72 text-xs whitespace-normal">{row.original.conversions.map((c) => `1 ${c.unit} = ${Number(c.factor)} ${unit(c.base_unit)}`).join(" · ")}</span> },
    { id: "act", header: "", enableSorting: false, cell: ({ row }) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setConvFor(row.original) }}>+ Quy đổi</Button>
        <Button size="sm" variant="ghost" onClick={(e) => {
          e.stopPropagation()
          const i = row.original
          const pc = i.conversions.find((c) => c.unit === i.purchase_unit)
          setForm({ id: String(i.id), code: i.code, name: i.name, category: i.category, control_group: i.control_group, base_unit: i.base_unit, purchase_unit: i.purchase_unit,
            purchase_factor: pc ? String(Number(pc.factor)) : "", last_unit_cost: String(Number(i.last_unit_cost)), min_stock: String(Number(i.min_stock)),
            shelf_life_days: i.shelf_life_days ? String(i.shelf_life_days) : "", warn_pct: i.warn_pct ? String(Number(i.warn_pct)) : "", warn_abs: i.warn_abs ? String(Number(i.warn_abs)) : "",
            must_pct: i.must_pct ? String(Number(i.must_pct)) : "", must_abs: i.must_abs ? String(Number(i.must_abs)) : "", waste_limit: i.waste_limit ? String(Number(i.waste_limit)) : "", active: i.active })
        }}><Pencil className="size-4" /> Sửa</Button>
      </div>
    ) },
  ], [])
  const field = (k: string, label: string) => (
    <label key={k} className="block space-y-1.5"><span className="text-sm font-medium">{label}</span><Input value={String(form?.[k] ?? "")} onChange={(e) => setForm((f) => ({ ...f!, [k]: e.target.value }))} /></label>
  )
  return (
    <div className="space-y-4">
      <PageHeader title="Nguyên liệu" icon={Leaf} description="Nhóm A (hàng tươi, giá trị cao) đi qua bàn giao ca, ngưỡng chặt; nhóm C (gia vị, hàng khô) chỉ nằm ở Kho, ngưỡng nới. Để trống ngưỡng riêng = dùng ngưỡng của nhóm."
        actions={<Button onClick={() => setForm({ ...EMPTY_ING })}><Plus className="size-4" /> Nguyên liệu mới</Button>} />
      {q.isLoading ? <Loading /> : <DataTable columns={columns} data={q.data ?? []} />}
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Sửa nguyên liệu" : "Nguyên liệu mới"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {field("code", "Mã")}{field("name", "Tên")}{field("category", "Nhóm hàng")}
              <div className="space-y-1.5"><Label>Nhóm kiểm soát</Label>
                <Select value={String(form.control_group)} onValueChange={(v) => setForm((f) => ({ ...f!, control_group: v }))}>
                  <SelectTrigger className="w-full" aria-label="Nhóm kiểm soát"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A">A: hàng tươi</SelectItem><SelectItem value="C">C: gia vị, hàng khô</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Đơn vị cơ sở</Label>
                <Select value={String(form.base_unit)} onValueChange={(v) => setForm((f) => ({ ...f!, base_unit: v }))}>
                  <SelectTrigger className="w-full" aria-label="Đơn vị cơ sở"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="g">g</SelectItem><SelectItem value="ml">ml</SelectItem><SelectItem value="cai">cái</SelectItem></SelectContent>
                </Select>
              </div>
              {field("purchase_unit", "Đơn vị mua")}{field("purchase_factor", "1 đơn vị mua = ? đơn vị cơ sở")}
              {field("last_unit_cost", "Giá nhập gần nhất (đ / đv cơ sở)")}{field("min_stock", "Tồn tối thiểu")}
              {field("shelf_life_days", "Hạn dùng mặc định (ngày)")}{field("waste_limit", "Hạn mức hao hụt / phiếu")}
              {field("warn_pct", "Ngưỡng cảnh báo %")}{field("warn_abs", "Cảnh báo tối thiểu")}{field("must_pct", "Bắt buộc duyệt %")}{field("must_abs", "Bắt buộc tối thiểu")}
              <Label className="flex items-center gap-2 font-normal"><Checkbox checked={!!form.active} onCheckedChange={(v) => setForm((f) => ({ ...f!, active: !!v }))} /> Đang dùng</Label>
            </div>
          )}
          <DialogFooter><Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!convFor} onOpenChange={(v) => !v && setConvFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quy đổi đơn vị cho {convFor?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5"><span className="text-sm font-medium">Đơn vị (bó, thùng, chai…)</span><Input value={conv.unit} onChange={(e) => setConv((c) => ({ ...c, unit: e.target.value }))} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">= ? {convFor && unit(convFor.base_unit)}</span><Input inputMode="decimal" value={conv.factor} onChange={(e) => setConv((c) => ({ ...c, factor: e.target.value }))} /></label>
          </div>
          <DialogFooter><Button disabled={!conv.unit || !(Number(conv.factor) > 0)} onClick={() => addConv.mutate(undefined)}>Lưu quy đổi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
