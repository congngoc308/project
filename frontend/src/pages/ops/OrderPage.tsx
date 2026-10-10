import { useQuery } from "@tanstack/react-query"
import { Lock, Minus, Plus, Send, Trash2, Utensils } from "@/components/icons"
import { useMemo, useState } from "react"

import { Choice, Empty, Loading, StepLabel } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { money } from "@/lib/format"
import { DISH_PHOTOS } from "@/lib/photos"
import type { MenuItem, Order } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

export const TABLES = [...Array.from({ length: 12 }, (_, i) => `B${i + 1}`), "Mang đi"]
const NOTE_CHIPS = ["Ít cay", "Không hành", "Không rau", "Mang về"]

/** Lưới món: lọc theo nhóm, món tạm hết hiện khóa kèm lý do; counts = số đã chọn trên mỗi món. */
export function MenuGrid({ menu, onPick, counts }: { menu: MenuItem[]; onPick: (m: MenuItem) => void; counts?: Record<number, number> }) {
  const cats = useMemo(() => [...new Set(menu.map((m) => m.category))], [menu])
  const [cat, setCat] = useState<string | null>(null)
  const shown = menu.filter((m) => !cat || m.category === cat)
  return (
    <div>
      {cats.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Nhóm món">
          <Choice className="text-sm" selected={!cat} onClick={() => setCat(null)}>Tất cả</Choice>
          {cats.map((c) => <Choice key={c} className="text-sm" selected={cat === c} onClick={() => setCat(c)}>{c}</Choice>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((m) => {
          const n = counts?.[m.id] ?? 0
          const photo = DISH_PHOTOS[m.code]
          return (
            <button
              key={m.id}
              type="button"
              disabled={!m.sellable}
              onClick={() => onPick(m)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border bg-card text-left",
                "transition-[box-shadow,transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                m.sellable
                  ? "border-border shadow-[0_1px_2px_rgb(28_25_23/0.05)] hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
                  : "cursor-not-allowed border-dashed border-input/60",
                n > 0 && "border-ink shadow-lift ring-2 ring-ink",
              )}
            >
              <span className="relative block aspect-[4/3] overflow-hidden bg-muted">
                {photo ? (
                  <img src={photo.src} alt="" loading="lazy" decoding="async"
                    className={cn("size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      m.sellable ? "group-hover:scale-[1.04]" : "opacity-60 grayscale")} />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground"><Utensils className="size-10" aria-hidden /></span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="flex items-start justify-between gap-2">
                  <span className={cn("font-display text-lg leading-snug font-bold", !m.sellable && "text-muted-foreground")}>{m.name}</span>
                  {n > 0 && (
                    <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 font-display text-sm font-bold text-primary-foreground" aria-label={`Đã chọn ${n}`}>×{n}</span>
                  )}
                </span>
                {m.sellable ? (
                  <span className="text-sm font-semibold tabular text-muted-foreground">{money(m.price)}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-critical-ink">
                    <Lock className="size-4" aria-hidden /> {m.locks[0]?.reason ?? "Tạm hết"}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface CartLine {
  menu_item_id: number
  name: string
  price: number
  qty: number
  note: string
}

export function OrderPage() {
  const menu = useQuery({ queryKey: ["menu"], queryFn: () => api.get<MenuItem[]>("/menu") })
  const open = useQuery({ queryKey: ["orders", "open"], queryFn: () => api.get<Order[]>("/orders?status=open"), refetchInterval: 20_000 })
  const busyTables = new Set((open.data ?? []).map((o) => o.table))
  const [table, setTable] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const send = useAction(
    () => api.post<Order>("/orders", { table_label: table, items: cart.map(({ menu_item_id, qty, note }) => ({ menu_item_id, qty, note })) }),
    {
      success: (o) => `Đã gửi bếp đơn ${o.code} (${o.table})`,
      invalidate: [["orders"], ["kitchen"]],
      onSuccess: () => {
        setCart([])
        setTable(null)
      },
    },
  )

  const add = (m: MenuItem) =>
    setCart((c) => {
      const i = c.findIndex((x) => x.menu_item_id === m.id && !x.note)
      if (i >= 0) return c.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x))
      return [...c, { menu_item_id: m.id, name: m.name, price: Number(m.price), qty: 1, note: "" }]
    })
  const update = (i: number, patch: Partial<CartLine>) => setCart((c) => c.map((y, j) => (j === i ? { ...y, ...patch } : y)))
  const total = cart.reduce((s, x) => s + x.qty * x.price, 0)
  const count = cart.reduce((s, x) => s + x.qty, 0)
  const counts = cart.reduce<Record<number, number>>((acc, x) => ({ ...acc, [x.menu_item_id]: (acc[x.menu_item_id] ?? 0) + x.qty }), {})
  const canSend = !!table && cart.length > 0 && !send.isPending
  const sendLabel = !table ? "Chọn bàn trước" : cart.length === 0 ? "Chưa có món" : "Gửi bếp"

  return (
    <div className="grid gap-5 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
      <div className="space-y-6">
        <section>
          <StepLabel n={1} done={!!table} aside={table && <>Đang chọn <b className="text-foreground">{table === "Mang đi" ? "Mang đi" : `bàn ${table}`}</b></>}>Chọn bàn</StepLabel>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {TABLES.map((t) => (
              <Choice key={t} selected={table === t} className={cn("relative h-14 text-lg font-bold", t === "Mang đi" && "col-span-2 text-base")} onClick={() => setTable(t)}>
                {t}
                {busyTables.has(t) && (
                  <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-primary ring-2 ring-card" aria-label="Bàn đang có đơn" />
                )}
              </Choice>
            ))}
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2.5 rounded-full bg-primary" aria-hidden /> Bàn đang có đơn mở</p>
        </section>
        <section>
          <StepLabel n={2} done={cart.length > 0}>Chạm món để thêm</StepLabel>
          {menu.isLoading ? <Loading /> : <MenuGrid menu={menu.data ?? []} onPick={add} counts={counts} />}
        </section>
      </div>

      <aside className="h-fit overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-stone-900/5 lg:sticky lg:top-44">
        <div className="flex items-baseline justify-between border-b border-dashed border-input/50 px-5 py-4">
          <div className="font-display text-xl font-bold">{table ? (table === "Mang đi" ? "Đơn mang đi" : `Đơn bàn ${table}`) : "Đơn mới"}</div>
          <div className="text-sm tabular text-muted-foreground">{count} món</div>
        </div>
        <div className="p-5">
          {cart.length === 0 ? (
            <Empty icon={Utensils}>Chưa có món. Chạm vào món bên trái để thêm.</Empty>
          ) : (
            <ul className="space-y-3">
              {cart.map((x, i) => (
                <li key={i} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-3">
                      {(() => {
                        const code = menu.data?.find((m) => m.id === x.menu_item_id)?.code
                        const photo = code ? DISH_PHOTOS[code] : undefined
                        return photo ? <img src={photo.src} alt="" className="size-12 shrink-0 rounded-lg object-cover" /> : null
                      })()}
                      <span className="min-w-0">
                      <span className="block font-semibold">{x.name}</span>
                      <span className="block text-xs tabular text-muted-foreground">{money(x.price * x.qty)}</span>
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="size-11" aria-label="Bớt một" onClick={() => update(i, { qty: Math.max(1, x.qty - 1) })}>
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-8 text-center text-lg font-bold tabular">{x.qty}</span>
                      <Button size="icon" variant="outline" className="size-11" aria-label="Thêm một" onClick={() => update(i, { qty: x.qty + 1 })}>
                        <Plus className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-11 text-muted-foreground" aria-label={`Bỏ ${x.name}`} onClick={() => setCart((c) => c.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {NOTE_CHIPS.map((c) => {
                      const on = x.note.split(", ").includes(c)
                      return (
                        <button key={c} type="button" aria-pressed={on}
                          className={cn("min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors", on ? "border-ink bg-ink text-ink-foreground" : "border-border hover:bg-muted")}
                          onClick={() => {
                            const parts = x.note ? x.note.split(", ").filter(Boolean) : []
                            update(i, { note: (on ? parts.filter((p) => p !== c) : [...parts, c]).join(", ") })
                          }}>
                          {c}
                        </button>
                      )
                    })}
                  </div>
                  <Input className="mt-2 h-10" aria-label={`Ghi chú cho ${x.name}`} placeholder="Ghi chú khác…" value={x.note}
                    onChange={(e) => update(i, { note: e.target.value })} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex items-baseline justify-between border-t border-dashed border-input/50 pt-4">
            <span className="text-sm text-muted-foreground">Tạm tính</span>
            <span className="font-display text-2xl font-bold tabular">{money(total)}</span>
          </div>
          <Button size="touch" className="mt-3 hidden w-full lg:flex" disabled={!canSend} onClick={() => send.mutate(undefined)}>
            <Send /> {sendLabel}
          </Button>
        </div>
      </aside>

      {/* Màn hẹp: thanh gửi bếp luôn nằm dưới đáy để không phải cuộn */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-card px-4 py-3 lg:hidden">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">{table ? (table === "Mang đi" ? "Mang đi" : `Bàn ${table}`) : "Chưa chọn bàn"} · {count} món</div>
          <div className="text-lg font-bold tabular">{money(total)}</div>
        </div>
        <Button size="touch" disabled={!canSend} onClick={() => send.mutate(undefined)}><Send /> {sendLabel}</Button>
      </div>
    </div>
  )
}
