/**
 * Danh mục của quản lý theo thiết kế "Admin Kho Dinh Muc" (Claude Design): Món và công thức, Nguyên liệu.
 * Sửa công thức luôn tạo phiên bản mới có ngày hiệu lực và lý do; đơn đã bán giữ phiên bản cũ.
 */
import { useQuery } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { useAsk } from "@/components/ask"
import { Loading } from "@/components/common"
import { Ban, History, LockSimple, LockSimpleOpen, NotePencil, Pencil, Plus, Trash2, Utensils } from "@/components/icons"
import { A, Btn, CARD, Drawer, EmptyNote, GroupChip, Modal, PageHead, Pill, Seg, Switch, adminToast, delay } from "@/layouts/AdminBits"
import { api } from "@/lib/api"
import { dateTime, money, num, qty, unit } from "@/lib/format"
import { DISH_PHOTOS } from "@/lib/photos"
import type { Ingredient, MenuItem, RecipeVersion } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

/** Ô nhập của thiết kế: viền #8a817c, cao 44px. */
const INPUT = "h-11 rounded-xl border border-[#8a817c] bg-white px-3 text-[15px] font-medium text-[#1c1917] placeholder:text-[#6b645e] disabled:bg-[#efedeb] disabled:text-[#4f4a45]"
const GRID_DISH = "grid grid-cols-[minmax(96px,1.5fr)_72px_60px_88px_84px] gap-2"

/** Tỷ lệ giá vốn / giá bán: từ 45% đỏ, từ 35% vàng, còn lại xanh (luôn kèm số). */
const pctTone = (p: number) => (p >= 45 ? [A.badBg, A.bad] : p >= 35 ? [A.warnBg, A.warn] : [A.okBg, A.ok])
function CostPct({ cost, price }: { cost: number; price: number }) {
  const p = price ? Math.round((cost / price) * 100) : 0
  const [bg, c] = pctTone(p)
  return <Pill bg={bg} c={c} className="transition-colors duration-300">{p}% giá bán</Pill>
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn("flex flex-col gap-1.5 text-sm font-semibold", className)}>{label}{children}</label>
}

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
  }), {
    invalidate: [["menu-items"], ["recipes"]],
    onSuccess: () => { adminToast(`Đã tạo phiên bản công thức mới cho ${item.name}`); onClose() },
  })

  const issue = (l: LineDraft) => {
    const ing = byId[l.ingredient_id]
    if (!ing || !Number(l.qty)) return null
    const factor = l.unit === ing.base_unit || !l.unit ? 1 : Number(ing.conversions.find((c) => c.unit === l.unit)?.factor ?? NaN)
    const loss = Number(l.prep_loss_pct || 0)
    const net = Number(l.qty) * factor
    return { net, issue: net / (1 - loss / 100), unit: ing.base_unit, cost: (net / (1 - loss / 100)) * Number(ing.last_unit_cost) }
  }
  const totalCost = lines.reduce((s, l) => s + (issue(l)?.cost ?? 0), 0)
  const canSave = !!reason.trim() && lines.length > 0 && !save.isPending
  const cols = "grid grid-cols-[minmax(170px,1.4fr)_170px_96px_100px_100px_44px] gap-2.5"

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm leading-[1.55] text-[#4f4a45]">
        Sửa công thức tạo phiên bản mới có ngày hiệu lực; đơn đã bán giữ nguyên phiên bản cũ. Lượng xuất kho bằng lượng tinh chia (1 trừ tỷ lệ hao hụt sơ chế).
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[720px] text-sm tabular">
          <div className={cn(cols, "border-b border-[#e2ded9] py-2 font-semibold text-[#4f4a45]")}>
            <span>Nguyên liệu</span><span>Lượng tinh / phần</span><span>Hao hụt sơ chế %</span><span className="text-right">Xuất kho</span><span className="text-right">Giá vốn</span><span />
          </div>
          {lines.map((l, i) => {
            const ing = byId[l.ingredient_id]
            const calc = issue(l)
            const set = (patch: Partial<LineDraft>) => setLines((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)))
            return (
              <div key={i} className={cn(cols, "items-center border-b border-[#f2f0ee] py-2")}>
                <select aria-label="Nguyên liệu" value={l.ingredient_id} onChange={(e) => set({ ingredient_id: e.target.value, unit: byId[e.target.value]?.base_unit ?? "" })} className={cn(INPUT, "w-full font-bold")}>
                  <option value="" disabled>Chọn nguyên liệu</option>
                  {ingredients.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
                </select>
                <span className="flex items-center gap-1.5">
                  <input aria-label="Lượng tinh" inputMode="decimal" value={l.qty} onChange={(e) => set({ qty: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} className={cn(INPUT, "w-[76px] px-2.5 font-semibold")} />
                  <select aria-label="Đơn vị" value={l.unit} disabled={!ing} onChange={(e) => set({ unit: e.target.value })} className={cn(INPUT, "w-[84px] px-2")}>
                    {!ing && <option value="">-</option>}
                    {(ing?.units ?? []).map((u) => <option key={u} value={u}>{unit(u)}</option>)}
                  </select>
                </span>
                <input aria-label="Hao hụt sơ chế %" inputMode="decimal" value={l.prep_loss_pct} onChange={(e) => set({ prep_loss_pct: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} className={cn(INPUT, "w-[76px] px-2.5 font-semibold")} />
                <span className="text-right font-bold">
                  {calc && Number.isFinite(calc.issue) ? qty(Math.round(calc.issue * 10) / 10, calc.unit) : <span className="text-[#8f1a1a]">{ing ? "không quy đổi được" : "-"}</span>}
                </span>
                <span className="text-right">{calc && Number.isFinite(calc.cost) ? money(calc.cost) : "-"}</span>
                <button type="button" aria-label={`Bỏ ${ing?.name ?? "dòng"}`} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}
                  className="flex size-11 items-center justify-center rounded-xl text-[#8f1a1a] transition-colors hover:bg-[#fbe4e4]"><Trash2 weight="bold" className="size-[18px]" /></button>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Btn kind="outline" icon={Plus} className="h-11 text-sm" onClick={() => setLines((x) => [...x, { ingredient_id: "", qty: "", unit: "", prep_loss_pct: "0", note: "" }])}>Thêm nguyên liệu</Btn>
        <span className="flex items-center gap-2.5 text-[15px]">Giá vốn nguyên liệu mỗi phần <b className="tabular">{money(Math.round(totalCost))}</b><CostPct cost={totalCost} price={Number(item.price)} /></span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <Field label="Lý do sửa (bắt buộc)" className="font-bold">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Đo lại định lượng thực tế" className={cn(INPUT, "h-12 px-3.5")} />
        </Field>
        <Field label="Hiệu lực từ (trống là ngay bây giờ)" className="font-bold">
          <input type="datetime-local" value={effective} onChange={(e) => setEffective(e.target.value)} className={cn(INPUT, "h-12 px-3.5")} />
        </Field>
      </div>
      <div className="flex justify-end gap-2.5">
        <Btn kind="soft" onClick={onClose}>Đóng</Btn>
        <Btn kind="accent" disabled={!canSave} onClick={() => save.mutate(undefined)}>Lưu phiên bản v{(item.recipe?.version_no ?? 0) + 1}</Btn>
      </div>
    </div>
  )
}

const LOCK_PRESETS = ["Hết nguyên liệu", "Hỏng thiết bị", "Ngưng phục vụ"]
type MenuModal = { type: "edit" | "hist" | "lock"; item: MenuItem } | null

export function MenuPage() {
  const ask = useAsk()
  const menu = useQuery({ queryKey: ["menu-items"], queryFn: () => api.get<MenuItem[]>("/menu-items") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [modal, setModal] = useState<MenuModal>(null)
  const [itemForm, setItemForm] = useState<Partial<MenuItem> | null>(null)
  const historyOf = modal?.type === "hist" ? modal.item : null
  const history = useQuery({ queryKey: ["recipes", historyOf?.id], queryFn: () => api.get<RecipeVersion[]>(`/menu-items/${historyOf!.id}/recipes`), enabled: !!historyOf })
  const resell = useAction((m: MenuItem) => api.post(`/menu-items/${m.id}/resell`, { note: "Quản lý mở bán" }).then(() => m), {
    invalidate: [["menu-items"], ["menu"]], onSuccess: (m) => adminToast(`Đã mở bán lại ${m.name}`),
  })
  const lock = useAction((v: { m: MenuItem; reason: string }) => api.post("/menu/out-of-dish", { menu_item_id: v.m.id, reason: v.reason }).then(() => v.m), {
    invalidate: [["menu-items"], ["menu"]], onSuccess: (m) => { setModal(null); adminToast(`Đã khóa bán ${m.name}`) },
  })
  const saveItem = useAction(() => itemForm?.id
    ? api.put(`/menu-items/${itemForm.id}`, { code: itemForm.code, name: itemForm.name, category: itemForm.category, price: Number(itemForm.price), status: itemForm.status })
    : api.post("/menu-items", { code: itemForm?.code, name: itemForm?.name, category: itemForm?.category ?? "", price: Number(itemForm?.price ?? 0), status: "selling" }),
  { invalidate: [["menu-items"], ["menu"]], onSuccess: () => { adminToast(`Đã lưu món ${itemForm?.name ?? ""}`); setItemForm(null) } })

  const lockOther = async (m: MenuItem) => {
    setModal(null)
    const r = await ask.reason({ title: `Khóa bán ${m.name}?`, description: "Chỉ khóa bán, không tác động kho.", presets: LOCK_PRESETS, confirmLabel: "Khóa bán", danger: true })
    if (r) lock.mutate({ m, reason: r })
  }

  if (menu.isLoading || ings.isLoading) return <Loading />
  const kicker = modal?.type === "edit" ? "Phiên bản công thức mới" : modal?.type === "hist" ? "Lịch sử công thức" : "Khóa bán"

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Món và công thức"
        desc="Định mức chuẩn của từng món. Lượng xuất kho cho một phần, đã cộng hao hụt sơ chế, là con số dùng để trừ kho và so sánh."
        right={<Btn kind="accent" icon={Plus} className="hover:-translate-y-0.5" onClick={() => setItemForm({ status: "selling" })}>Món mới</Btn>} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] gap-4">
        {(menu.data ?? []).map((m, i) => {
          const photo = DISH_PHOTOS[m.code]
          const stopped = m.status === "stopped"
          const dim = m.locked || stopped
          const lines = m.recipe?.lines ?? []
          const total = lines.reduce((s, l) => s + Number(l.cost), 0)
          return (
            <article key={m.id} style={delay(i, 60, 60)}
              className="group a-rise flex flex-col overflow-hidden rounded-[22px] bg-[#fdfdfc] shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-12px_rgba(41,37,36,.16),0_0_0_1px_rgba(28,25,23,.05)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(41,37,36,.06),0_26px_44px_-24px_rgba(41,37,36,.4),0_0_0_1px_rgba(28,25,23,.06)]">
              <div className="relative h-[170px] overflow-hidden bg-[#e7e4e1]">
                {photo ? (
                  <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async"
                    className="size-full object-cover transition-[filter,transform] duration-[800ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]"
                    style={{ filter: dim ? "grayscale(1) contrast(.9)" : "none" }} />
                ) : (
                  <span className="flex size-full items-center justify-center text-[#4f4a45]"><Utensils weight="duotone" className="size-12" aria-hidden /></span>
                )}
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-[90px] bg-[linear-gradient(transparent,rgba(28,25,23,.78))]" />
                <div className="absolute right-[18px] bottom-3.5 left-[18px] flex items-end justify-between gap-2.5 text-white">
                  <div className="min-w-0">
                    <div className="font-mono text-[14px] font-semibold opacity-90">{m.code}{m.category ? `, ${m.category}` : ""}</div>
                    <h2 className="m-0 font-display text-2xl font-bold tracking-[-.02em] [text-shadow:0_1px_8px_rgba(0,0,0,.35)]">{m.name}</h2>
                  </div>
                  <div className="text-[17px] font-bold whitespace-nowrap tabular">{money(m.price)}</div>
                </div>
                <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5">
                  {m.locked && (
                    <span className="a-pop flex h-8 items-center gap-1.5 rounded-full bg-[#a11d1d] px-3 text-sm font-bold whitespace-nowrap text-white" style={{ animationDuration: ".4s" }}>
                      <LockSimple weight="bold" className="size-3.5" aria-hidden />{m.locks[0]?.reason || "Đang khóa bán"}
                    </span>
                  )}
                  {stopped && (
                    <span className="flex h-8 items-center gap-1.5 rounded-full bg-[#1c1917] px-3 text-sm font-bold whitespace-nowrap text-[#fafaf9]"><Ban weight="bold" className="size-3.5" aria-hidden />Ngưng bán</span>
                  )}
                </div>
              </div>
              <div className="flex-1 px-[18px] pt-4 pb-1.5 text-sm tabular">
                {m.recipe ? (
                  <>
                    <div className={cn(GRID_DISH, "border-b border-[#e2ded9] pb-2 font-semibold text-[#4f4a45]")}>
                      <span>Nguyên liệu</span><span className="text-right">Lượng tinh</span><span className="text-right">Hao hụt</span><span className="text-right">Xuất kho</span><span className="text-right">Giá vốn</span>
                    </div>
                    {lines.map((l) => (
                      <div key={l.ingredient_id} className={cn(GRID_DISH, "border-b border-[#f2f0ee] py-[9px]")}>
                        <span className="flex min-w-0 items-center gap-1.5"><span className="min-w-0">{l.ingredient}</span><GroupChip group={l.group} /></span>
                        <span className="text-right">{num(l.qty, 1)} {unit(l.unit)}</span>
                        <span className="text-right">{num(l.prep_loss_pct, 1)}%</span>
                        <span className="text-right font-bold">{qty(Math.round(Number(l.issue_qty_base) * 10) / 10, l.base_unit)}</span>
                        <span className="text-right">{money(l.cost)}</span>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 pb-1">
                      <span className="text-[#4f4a45]" title={m.recipe.reason || undefined}>v{m.recipe.version_no}, hiệu lực từ {dateTime(m.recipe.effective_from)}</span>
                      <span className="flex items-center gap-2"><span className="font-bold">{money(Math.round(total))}</span><CostPct cost={total} price={Number(m.price)} /></span>
                    </div>
                  </>
                ) : <EmptyNote icon={NotePencil}>Chưa có công thức</EmptyNote>}
              </div>
              <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-3.5">
                <button type="button" onClick={() => setModal({ type: "edit", item: m })}
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-[#1c1917] px-3.5 text-sm font-bold whitespace-nowrap text-[#fafaf9] transition-colors hover:bg-[#2e2926]">
                  <Pencil weight="bold" className="size-4" aria-hidden />Sửa công thức
                </button>
                <button type="button" onClick={() => setModal({ type: "hist", item: m })}
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-[#f2f0ee] px-3.5 text-sm font-bold whitespace-nowrap transition-colors hover:bg-[#e9e6e3]">
                  <History weight="bold" className="size-4" aria-hidden />Lịch sử
                </button>
                <button type="button" aria-label={`Sửa thông tin món ${m.name}`} title="Sửa thông tin món" onClick={() => setItemForm(m)}
                  className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold whitespace-nowrap transition-colors hover:bg-[#f2f0ee]">
                  <NotePencil weight="bold" className="size-4" aria-hidden />Món
                </button>
                <button type="button" disabled={resell.isPending}
                  onClick={() => (m.locked ? resell.mutate(m) : setModal({ type: "lock", item: m }))}
                  className="ml-auto flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap transition-colors hover:bg-[#f2f0ee]"
                  style={{ color: m.locked ? A.ok : A.bad }}>
                  {m.locked ? <LockSimpleOpen weight="bold" className="size-4" aria-hidden /> : <LockSimple weight="bold" className="size-4" aria-hidden />}
                  {m.locked ? "Bán lại" : "Khóa bán"}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} width={modal?.type === "lock" ? 620 : 860} kicker={<span className="font-sans font-bold">{kicker}</span>} title={modal?.item.name ?? ""}>
        {modal?.type === "edit" && <RecipeEditor item={modal.item} ingredients={ings.data ?? []} onClose={() => setModal(null)} />}
        {modal?.type === "hist" && (history.isLoading ? <Loading rows={2} /> : (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0 pt-1.5">
            {(history.data ?? []).map((v, i) => (
              <li key={v.id} className="a-rise flex flex-col gap-1.5 rounded-2xl p-4" style={{ boxShadow: v.current ? `0 0 0 2px ${A.paprika}` : `0 0 0 1px ${A.line}`, animationDuration: ".5s", ...delay(i, 0, 60) }}>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="flex items-center gap-2"><span className="font-display text-xl font-bold">v{v.version_no}</span>{v.current && <Pill bg={A.paprikaSoft} c={A.paprikaInk}>Đang áp dụng</Pill>}</span>
                  <span className="text-sm text-[#4f4a45]">Hiệu lực {dateTime(v.effective_from)}, {v.created_by_name ?? "-"}</span>
                </div>
                <div className="text-sm text-[#4f4a45]">Lý do: {v.reason || "-"}</div>
                <div className="text-sm tabular">{v.lines.map((l) => `${l.ingredient} ${qty(Math.round(Number(l.issue_qty_base) * 10) / 10, l.base_unit)}`).join(", ")}</div>
              </li>
            ))}
            {!history.data?.length && <EmptyNote icon={NotePencil}>Chưa có phiên bản nào</EmptyNote>}
          </ol>
        ))}
        {modal?.type === "lock" && (
          <div className="flex flex-col gap-3.5">
            <p className="m-0 text-sm text-[#4f4a45]">Chỉ khóa bán, không tác động kho. Chọn lý do:</p>
            <div className="flex flex-wrap gap-2">
              {LOCK_PRESETS.map((p) => (
                <button key={p} type="button" disabled={lock.isPending} onClick={() => lock.mutate({ m: modal.item, reason: p })}
                  className="h-12 rounded-xl bg-[#fbe4e4] px-[18px] text-[15px] font-bold whitespace-nowrap text-[#8f1a1a] transition-transform duration-[250ms] hover:-translate-y-0.5">{p}</button>
              ))}
              <button type="button" onClick={() => lockOther(modal.item)} className="h-12 rounded-xl px-4 text-[15px] font-bold whitespace-nowrap text-[#8f1a1a] underline-offset-4 hover:underline">Lý do khác</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!itemForm} onClose={() => setItemForm(null)} width={620} kicker={<span className="font-sans font-bold">{itemForm?.id ? "Sửa món" : "Món mới"}</span>} title={itemForm?.name || (itemForm?.id ? "Sửa món" : "Món mới")}
        footer={<>
          <Btn kind="soft" onClick={() => setItemForm(null)}>Hủy</Btn>
          <Btn kind="accent" disabled={!itemForm?.code || !itemForm?.name || saveItem.isPending} onClick={() => saveItem.mutate(undefined)}>Lưu món</Btn>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã"><input value={itemForm?.code ?? ""} disabled={!!itemForm?.id} onChange={(e) => setItemForm((f) => ({ ...f, code: e.target.value }))} className={INPUT} /></Field>
          <Field label="Tên món"><input value={itemForm?.name ?? ""} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} className={INPUT} /></Field>
          <Field label="Nhóm món"><input value={itemForm?.category ?? ""} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))} className={INPUT} /></Field>
          <Field label="Giá bán (đ)"><input inputMode="numeric" value={String(itemForm?.price ?? "")} onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value.replace(/\D/g, "") }))} className={INPUT} /></Field>
          {itemForm?.id && (
            <div className="col-span-2 -ml-3.5">
              <Switch on={itemForm.status === "stopped"} onChange={(v) => setItemForm((f) => ({ ...f, status: v ? "stopped" : "selling" }))}>Ngưng bán món này</Switch>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ---- Nguyên liệu ----

type IngForm = Record<string, string | boolean>

const EMPTY_ING: IngForm = { code: "", name: "", category: "", control_group: "A", base_unit: "g", purchase_unit: "kg", purchase_factor: "1000", last_unit_cost: "0", min_stock: "0", shelf_life_days: "", warn_pct: "", warn_abs: "", must_pct: "", must_abs: "", waste_limit: "", active: true }
const ING_COLS = "grid grid-cols-[minmax(180px,1.3fr)_70px_110px_150px_130px_130px_minmax(200px,1.4fr)_190px] gap-3.5"
const FORM_SECTIONS: [string, [string, string, string][]][] = [
  ["Thông tin", [["code", "Mã", "TBT"], ["name", "Tên", "Thịt bò thăn"], ["category", "Nhóm hàng", "Thịt"]]],
  ["Đơn vị và giá", [["purchase_unit", "Đơn vị mua", "kg"], ["purchase_factor", "1 đơn vị mua = ? đơn vị cơ sở", "1000"], ["last_unit_cost", "Giá nhập gần nhất (đ / đv cơ sở)", "0"], ["min_stock", "Tồn tối thiểu", "0"]]],
  ["Ngưỡng riêng và hạn mức", [["warn_pct", "Ngưỡng cảnh báo %", "Theo nhóm"], ["warn_abs", "Cảnh báo tối thiểu", "Theo nhóm"], ["must_pct", "Bắt buộc duyệt %", "Theo nhóm"], ["must_abs", "Bắt buộc tối thiểu", "Theo nhóm"], ["waste_limit", "Hạn mức hao hụt / phiếu", "-"], ["shelf_life_days", "Hạn dùng mặc định (ngày)", "-"]]],
]

export function IngredientsPage() {
  const q = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [grp, setGrp] = useState<"all" | "A" | "C">("all")
  const [form, setForm] = useState<IngForm | null>(null)
  const [convFor, setConvFor] = useState<Ingredient | null>(null)
  const [conv, setConv] = useState({ unit: "", factor: "" })
  const toNum = (v: string | boolean) => (v === "" || v === undefined ? null : Number(v))
  const save = useAction(() => {
    const f = form!
    const body = {
      code: f.code, name: f.name, category: f.category, control_group: f.control_group, base_unit: f.base_unit, purchase_unit: f.purchase_unit,
      purchase_factor: toNum(f.purchase_factor), last_unit_cost: Number(f.last_unit_cost || 0), min_stock: Number(f.min_stock || 0),
      shelf_life_days: toNum(f.shelf_life_days), warn_pct: toNum(f.warn_pct), warn_abs: toNum(f.warn_abs), must_pct: toNum(f.must_pct), must_abs: toNum(f.must_abs),
      waste_limit: toNum(f.waste_limit), active: f.active,
    }
    return f.id ? api.put(`/ingredients/${f.id}`, body) : api.post("/ingredients", body)
  }, { invalidate: [["ingredients"]], onSuccess: () => { adminToast(`Đã lưu ${String(form?.name ?? "nguyên liệu")}`); setForm(null) } })
  const addConv = useAction(() => api.post(`/ingredients/${convFor!.id}/conversions`, { unit: conv.unit, factor: Number(conv.factor) }), {
    invalidate: [["ingredients"]], onSuccess: () => { adminToast(`Đã lưu quy đổi 1 ${conv.unit} cho ${convFor?.name ?? ""}`); setConvFor(null); setConv({ unit: "", factor: "" }) },
  })
  const edit = (i: Ingredient) => {
    const pc = i.conversions.find((c) => c.unit === i.purchase_unit)
    setForm({ id: String(i.id), code: i.code, name: i.name, category: i.category, control_group: i.control_group, base_unit: i.base_unit, purchase_unit: i.purchase_unit,
      purchase_factor: pc ? String(Number(pc.factor)) : "", last_unit_cost: String(Number(i.last_unit_cost)), min_stock: String(Number(i.min_stock)),
      shelf_life_days: i.shelf_life_days ? String(i.shelf_life_days) : "", warn_pct: i.warn_pct ? String(Number(i.warn_pct)) : "", warn_abs: i.warn_abs ? String(Number(i.warn_abs)) : "",
      must_pct: i.must_pct ? String(Number(i.must_pct)) : "", must_abs: i.must_abs ? String(Number(i.must_abs)) : "", waste_limit: i.waste_limit ? String(Number(i.waste_limit)) : "", active: i.active })
  }
  const setF = (k: string, v: string | boolean) => setForm((f) => ({ ...f!, [k]: v }))
  const list = (q.data ?? []).filter((i) => grp === "all" || i.control_group === grp)

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Nguyên liệu"
        desc="Nhóm A (hàng tươi, giá trị cao) đi qua bàn giao ca, ngưỡng chặt. Nhóm C (gia vị, hàng khô) chỉ nằm ở Kho, ngưỡng nới. Để trống ngưỡng riêng là dùng ngưỡng của nhóm."
        right={<Btn kind="accent" icon={Plus} className="hover:-translate-y-0.5" onClick={() => setForm({ ...EMPTY_ING })}>Nguyên liệu mới</Btn>} />
      <div className="a-rise self-start" style={{ animationDelay: "50ms" }}>
        <Seg label="Lọc theo nhóm kiểm soát" value={grp} onChange={setGrp} options={[{ key: "all", label: "Tất cả" }, { key: "A", label: "Nhóm A" }, { key: "C", label: "Nhóm C" }]} />
      </div>
      {q.isLoading ? <Loading /> : (
        <div className={cn(CARD, "a-rise overflow-x-auto")} style={{ animationDelay: "100ms" }}>
          <div className="min-w-[1120px]">
            <div className={cn(ING_COLS, "border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]")}>
              <span>Nguyên liệu</span><span>Nhóm</span><span>Đơn vị</span><span className="text-right">Giá nhập gần nhất</span><span>Ngưỡng riêng</span>
              <span className="text-right">Hạn mức hao hụt</span><span>Quy đổi</span><span />
            </div>
            {list.map((i, k) => {
              const own = !!(i.warn_pct || i.must_pct)
              return (
                <div key={i.id} style={delay(Math.min(k, 20), 60, 35)}
                  className={cn(ING_COLS, "a-rise min-h-[62px] items-center border-b border-[#efedeb] px-6 py-3 text-sm tabular transition-colors duration-[250ms] hover:bg-[#f7f4f1]")}>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2"><span className="text-[15px] font-bold">{i.name}</span>{!i.active && <Pill icon={Ban} bg={A.line2} c={A.sub}>Ngừng dùng</Pill>}</span>
                    <span className="font-mono text-[#4f4a45]">{i.code}</span>
                  </span>
                  <span><GroupChip group={i.control_group} /></span>
                  <span>{unit(i.base_unit)} / {unit(i.purchase_unit)}</span>
                  <span className="text-right font-semibold">{num(i.last_unit_cost, 1)} đ/{unit(i.base_unit)}</span>
                  <span style={{ color: own ? A.ink : A.sub }}>{own ? `${i.warn_pct !== null ? num(i.warn_pct, 1) : "-"}% / ${i.must_pct !== null ? num(i.must_pct, 1) : "-"}%` : "Theo nhóm"}</span>
                  <span className="text-right">{i.waste_limit ? qty(i.waste_limit, i.base_unit) : "-"}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {i.conversions.map((c) => (
                      <span key={c.id} className="flex h-7 items-center rounded-lg bg-[#f5f3f1] px-[9px] whitespace-nowrap">1 {unit(c.unit)} = {num(c.factor, 1)} {unit(c.base_unit)}</span>
                    ))}
                    {!i.conversions.length && <span className="text-[#4f4a45]">-</span>}
                  </span>
                  <span className="flex justify-end gap-1">
                    <button type="button" onClick={() => setConvFor(i)} aria-label={`Thêm quy đổi cho ${i.name}`}
                      className="flex h-11 items-center gap-1 rounded-[10px] px-2.5 font-bold whitespace-nowrap text-[#7c3410] transition-colors hover:bg-[#fbeae0]"><Plus weight="bold" className="size-4" aria-hidden />Quy đổi</button>
                    <button type="button" onClick={() => edit(i)} aria-label={`Sửa ${i.name}`}
                      className="h-11 rounded-[10px] px-3 font-bold whitespace-nowrap text-[#7c3410] transition-colors hover:bg-[#fbeae0]">Sửa</button>
                  </span>
                </div>
              )
            })}
            {!list.length && <EmptyNote>Chưa có nguyên liệu trong nhóm này</EmptyNote>}
          </div>
        </div>
      )}

      <Drawer open={!!form} onClose={() => setForm(null)} width={560} title={form?.id ? `Sửa ${String(form.name)}` : "Nguyên liệu mới"}
        head={<div className="font-display text-2xl font-bold tracking-[-.02em]">{form?.id ? `Sửa ${String(form.name)}` : "Nguyên liệu mới"}</div>}
        footer={
          <div className="flex justify-end gap-2.5">
            <Btn kind="soft" className="h-[50px]" onClick={() => setForm(null)}>Hủy</Btn>
            <Btn kind="accent" className="h-[50px] px-6 shadow-none" disabled={!form?.code || !form?.name || save.isPending} onClick={() => save.mutate(undefined)}>Lưu nguyên liệu</Btn>
          </div>
        }>
        {form && (
          <>
            {FORM_SECTIONS.map(([title, fields], si) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="text-sm font-bold text-[#7c3410]">{title}</div>
                {si === 1 && (
                  <div className="flex flex-col gap-1.5 text-sm font-semibold">Đơn vị cơ sở
                    <Seg label="Đơn vị cơ sở" value={String(form.base_unit)} onChange={(v) => setF("base_unit", v)}
                      options={[{ key: "g", label: "g" }, { key: "ml", label: "ml" }, { key: "cai", label: "cái" }]} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {fields.map(([k, label, ph]) => (
                    <Field key={k} label={label}>
                      <input value={String(form[k] ?? "")} placeholder={ph} inputMode={["code", "name", "category", "purchase_unit"].includes(k) ? undefined : "decimal"}
                        onChange={(e) => setF(k, e.target.value)} className={cn(INPUT, "h-[46px]")} />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2.5">
              <div className="text-sm font-bold text-[#7c3410]">Nhóm kiểm soát</div>
              <div role="group" aria-label="Nhóm kiểm soát" className="grid grid-cols-2 gap-2.5">
                {([["A", "Nhóm A", "Hàng tươi, giá trị cao"], ["C", "Nhóm C", "Gia vị, hàng khô"]] as const).map(([k, t, sub]) => {
                  const on = form.control_group === k
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => setF("control_group", k)}
                      className="flex flex-col items-start gap-1 rounded-[14px] p-3.5 text-left transition-[background-color,color,box-shadow] duration-300"
                      style={{ background: on ? A.ink : A.soft, color: on ? "#fafaf9" : A.ink, boxShadow: on ? "0 10px 22px -12px rgba(28,25,23,.6)" : "none" }}>
                      <span className="text-[15px] font-bold">{t}</span><span className="text-sm">{sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="-ml-3.5"><Switch on={!!form.active} onChange={(v) => setF("active", v)}>Đang dùng</Switch></div>
          </>
        )}
      </Drawer>

      <Modal open={!!convFor} onClose={() => setConvFor(null)} width={560} kicker={<span className="font-sans font-bold">Quy đổi đơn vị</span>} title={convFor?.name ?? ""}
        footer={<>
          <Btn kind="soft" onClick={() => setConvFor(null)}>Hủy</Btn>
          <Btn kind="accent" disabled={!conv.unit || !(Number(conv.factor) > 0) || addConv.isPending} onClick={() => addConv.mutate(undefined)}>Lưu quy đổi</Btn>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Đơn vị (bó, thùng, chai...)"><input value={conv.unit} onChange={(e) => setConv((c) => ({ ...c, unit: e.target.value }))} className={INPUT} /></Field>
          <Field label={`= ? ${convFor ? unit(convFor.base_unit) : ""}`}><input inputMode="decimal" value={conv.factor} onChange={(e) => setConv((c) => ({ ...c, factor: e.target.value.replace(",", ".") }))} className={INPUT} /></Field>
        </div>
      </Modal>
    </div>
  )
}
