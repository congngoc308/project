import { useQuery } from "@tanstack/react-query"
import { Check, Minus, Plus, Send, Trash2, Utensils } from "@/components/icons"
import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react"

import { NightToasts, useNightToasts } from "@/layouts/NightBits"
import { api } from "@/lib/api"
import { fitZoom } from "@/lib/fitZoom"
import { money } from "@/lib/format"
import { DISH_PHOTOS } from "@/lib/photos"
import type { MenuItem, Order } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

export const TABLES = [...Array.from({ length: 12 }, (_, i) => `B${i + 1}`), "Mang đi"]
const NOTE_CHIPS = ["Ít cay", "Không hành", "Không rau", "Mang về"]
const CONFETTI = ["#FF5A3C", "#FFD84D", "#2A78D6", "#FF4F9A"]

const photoOf = (m: Pick<MenuItem, "code">) => DISH_PHOTOS[m.code]?.src
const outReason = (m: MenuItem) => m.locks[0]?.reason ?? "Tạm hết"

/** Tiêu đề bước "01 Chọn bàn" của thiết kế. */
function StepTitle({ n, children, aside }: { n: string; children: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-4">
      <div className="flex items-baseline gap-3.5">
        <span className="font-display text-[15px] font-extrabold text-[var(--coral-text)]" aria-hidden>{n}</span>
        <h2 className="m-0 text-[clamp(26px,3vw,34px)] leading-[1.05] font-extrabold tracking-[-.03em]">{children}</h2>
      </div>
      {aside}
    </div>
  )
}

/**
 * Lưới món của phục vụ: ảnh lớn, giá ở góc, món hết có con dấu và rung khi chạm.
 * Dùng chung cho màn Đặt món và hộp thoại đổi món.
 */
export function MenuGrid({ menu, onPick, onBlocked, counts }: {
  menu: MenuItem[]
  onPick: (m: MenuItem, e: MouseEvent) => void
  onBlocked?: (m: MenuItem) => void
  counts?: Record<number, number>
}) {
  const cats = useMemo(() => ["Tất cả", ...new Set(menu.map((m) => m.category))], [menu])
  const [cat, setCat] = useState("Tất cả")
  const [shake, setShake] = useState<number | null>(null)
  const shown = menu.filter((m) => cat === "Tất cả" || m.category === cat)
  return (
    <div>
      <div className="mb-[22px] flex flex-wrap gap-2.5" role="group" aria-label="Nhóm món">
        {cats.map((c) => {
          const on = c === cat
          return (
            <button key={c} type="button" aria-pressed={on} onClick={() => setCat(c)}
              className={cn("h-12 rounded-full border-[1.5px] px-[22px] text-[15px] font-bold transition-all duration-300 n-spring active:scale-90",
                on ? "scale-105 border-[var(--lime)] bg-[var(--lime)] text-[var(--night-ink)]" : "border-[var(--n-outline-soft)] bg-transparent text-[var(--n-text)] hover:border-[var(--n-outline)]")}>
              {c}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[18px]">
        {shown.map((m, i) => {
          const q = counts?.[m.id] ?? 0
          const img = photoOf(m)
          return (
            <div key={m.id} className="n-rise" style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
              <button
                type="button"
                aria-disabled={!m.sellable}
                aria-label={m.sellable ? `${m.name}, ${money(m.price)}${q ? `, đã chọn ${q}` : ""}` : `${m.name}, ${outReason(m)}`}
                onClick={(e) => {
                  if (!m.sellable) {
                    setShake(m.id)
                    window.setTimeout(() => setShake(null), 460)
                    onBlocked?.(m)
                    return
                  }
                  onPick(m, e)
                }}
                className={cn(
                  "relative block w-full overflow-hidden rounded-[28px] border-2 bg-[var(--n-surface)] text-left transition-[transform,box-shadow,border-color] duration-500 n-spring",
                  m.sellable ? "cursor-pointer hover:-translate-y-1.5 hover:-rotate-1 hover:shadow-[0_24px_50px_-20px_var(--n-shadow)] active:scale-95" : "cursor-not-allowed",
                  q ? "border-[var(--lime-line)]" : "border-transparent",
                  shake === m.id && "n-shake",
                )}
              >
                <span className="block h-[190px] bg-[var(--n-surface-2)] bg-cover bg-center"
                  style={{ backgroundImage: img ? `url(${img})` : undefined, filter: m.sellable ? undefined : "grayscale(1) brightness(.5)" }}>
                  {!img && <span className="flex h-full items-center justify-center text-[var(--n-muted)]"><Utensils className="size-12" aria-hidden /></span>}
                </span>
                {m.sellable && (
                  <span className="absolute top-3.5 left-3.5 rounded-full bg-[var(--n-invert)] px-[13px] py-[7px] font-display text-[15px] font-extrabold whitespace-nowrap text-[var(--n-invert-fg)]">{money(m.price)}</span>
                )}
                {!m.sellable && (
                  <span className="absolute top-[78px] left-1/2 -translate-x-1/2 -rotate-[8deg] bg-[var(--pink)] px-[18px] py-2 font-display text-[19px] font-extrabold tracking-[.04em] whitespace-nowrap text-[var(--night-ink)] uppercase shadow-[0_10px_24px_-8px_rgba(255,79,154,.7)]">
                    {outReason(m)}
                  </span>
                )}
                {q > 0 && (
                  <span key={q} className="n-pop absolute top-3 right-3 flex h-11 min-w-11 items-center justify-center rounded-full bg-[var(--lime)] px-2.5 font-display text-lg font-extrabold text-[var(--night-ink)] shadow-[0_8px_20px_-6px_rgba(255,216,77,.7)]">×{q}</span>
                )}
                <span className="flex items-center justify-between gap-2.5 px-[18px] pt-4 pb-[18px]">
                  <span className="min-w-0">
                    <span className={cn("block font-display text-xl font-bold tracking-[-.01em]", m.sellable ? "text-[var(--n-text)]" : "text-[var(--n-muted)]")}>{m.name}</span>
                    <span className={cn("mt-1 block text-[13px] font-semibold", !m.sellable ? "text-[var(--pink-text)]" : q ? "text-[var(--lime-text)]" : "text-[var(--n-muted)]")}>
                      {!m.sellable ? outReason(m) : q ? `Đã chọn ${q}` : "Chạm để thêm"}
                    </span>
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface CartLine {
  menu_item_id: number
  qty: number
  notes: string[]
  text: string
}

interface Flyer { id: number; x: number; y: number; dx: number; dy: number; img?: string }
interface Bit { id: number; x: number; y: number; vx: number; vy: number; rot: string; c: string; w: number; h: number; round: boolean }

let seq = 0

export function OrderPage() {
  const menu = useQuery({ queryKey: ["menu"], queryFn: () => api.get<MenuItem[]>("/menu") })
  const open = useQuery({ queryKey: ["orders", "open"], queryFn: () => api.get<Order[]>("/orders?status=open"), refetchInterval: 20_000 })
  const busyTables = new Set((open.data ?? []).map((o) => o.table))
  const byId = useMemo(() => Object.fromEntries((menu.data ?? []).map((m) => [m.id, m])), [menu.data])
  const [table, setTable] = useState<string | null>(null)
  // Mỗi bàn một giỏ nháp: đổi qua bàn khác rồi quay lại vẫn còn món đang chọn dở.
  const [carts, setCarts] = useState<Record<string, CartLine[]>>({})
  const cart = table ? carts[table] ?? [] : []
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [bits, setBits] = useState<Bit[]>([])
  const [sent, setSent] = useState(false)
  const [bump, setBump] = useState(0)
  const cartRef = useRef<HTMLDivElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)
  const { toasts, push } = useNightToasts()

  const updCart = (fn: (c: CartLine[]) => CartLine[]) => {
    if (!table) return
    setCarts((all) => ({ ...all, [table]: fn((all[table] ?? []).map((x) => ({ ...x, notes: [...x.notes] }))) }))
  }

  const sendOrder = useAction(
    (v: { table: string; lines: CartLine[] }) => api.post<Order>("/orders", {
      table_label: v.table,
      items: v.lines.map((c) => ({ menu_item_id: c.menu_item_id, qty: c.qty, note: [...c.notes, c.text.trim()].filter(Boolean).join(", ") })),
    }),
    {
      invalidate: [["orders"], ["kitchen"]],
      onSuccess: (o) => {
        setCarts((all) => ({ ...all, [o.table]: [] }))
        setSent(true)
        window.setTimeout(() => setSent(false), 1500)
        push(`Đã gửi bếp đơn ${o.code}, ${o.table === "Mang đi" ? "mang đi" : "bàn " + o.table}`, "var(--coral)")
        const r = sendRef.current?.getBoundingClientRect()
        if (r && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setBits(Array.from({ length: 48 }, (_, i) => ({
            id: ++seq, x: (r.left + r.width / 2) / fitZoom(), y: (r.top + r.height / 2) / fitZoom(),
            vx: (Math.random() - 0.5) * 520, vy: -120 - Math.random() * 320, rot: `${Math.random() * 900 - 450}deg`,
            c: CONFETTI[i % 4], w: 6 + Math.random() * 8, h: 8 + Math.random() * 10, round: Math.random() > 0.6,
          })))
          window.setTimeout(() => setBits([]), 1300)
        }
      },
    },
  )

  const add = (m: MenuItem, e: MouseEvent) => {
    if (!table) {
      push("Chọn bàn trước khi thêm món", "var(--pink)")
      return
    }
    updCart((c) => {
      const f = c.find((x) => x.menu_item_id === m.id)
      if (f) f.qty++
      else c.push({ menu_item_id: m.id, qty: 1, notes: [], text: "" })
      return c
    })
    // Ảnh món bay vào giỏ: phản hồi cho biết món đã được thêm (tắt khi người dùng giảm chuyển động).
    const tr = cartRef.current?.getBoundingClientRect()
    if (!tr || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setBump((b) => b + 1)
    const id = ++seq
    // Toạ độ chuột / khung đã nhân zoom của trang; chia lại để vị trí fixed tính bằng px CSS.
    const z = fitZoom(), x = e.clientX / z, y = e.clientY / z
    setFlyers((f) => [...f, { id, x, y, dx: tr.left / z + 40 - x, dy: tr.top / z + 30 - y, img: photoOf(m) }])
    window.setTimeout(() => { setFlyers((f) => f.filter((x) => x.id !== id)); setBump((b) => b + 1) }, 760)
  }

  const total = cart.reduce((s, c) => s + c.qty * Number(byId[c.menu_item_id]?.price ?? 0), 0)
  const count = cart.reduce((s, c) => s + c.qty, 0)
  const counts = cart.reduce<Record<number, number>>((a, c) => ({ ...a, [c.menu_item_id]: c.qty }), {})
  const canSend = !!table && cart.length > 0 && !sendOrder.isPending
  const sendLabel = sent ? "Đã gửi bếp!" : !table ? "Chọn bàn trước" : cart.length === 0 ? "Chưa có món" : "Gửi bếp"

  return (
    <div className="mt-9 flex flex-wrap items-start gap-9">
      <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-10">
        <section className="n-rise [animation-delay:.12s]" aria-label="Chọn bàn">
          <StepTitle n="01" aside={
            <div className="flex items-center gap-2 text-[13px] text-[var(--n-muted)]">
              <span className="size-2 rounded-full bg-[var(--coral)]" aria-hidden />
              <span className="whitespace-nowrap">Bàn đang có đơn mở</span>
            </div>
          }>Chọn bàn</StepTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5">
            {TABLES.map((t) => {
              const sel = t === table
              const takeaway = t === "Mang đi"
              const chair = sel ? (takeaway ? "var(--night-ink)" : "var(--coral)") : takeaway ? "var(--lime)" : "var(--n-surface-2)"
              const face: CSSProperties = {
                background: sel ? "var(--coral)" : "var(--n-surface)",
                borderColor: sel ? "var(--coral)" : "var(--n-line)",
                boxShadow: sel ? "0 16px 30px -12px var(--coral-glow)" : "none",
              }
              return (
                <button key={t} type="button" aria-pressed={sel}
                  aria-label={`${takeaway ? "Mang đi" : "Bàn " + t}${busyTables.has(t) ? ", đang có đơn" : ""}`}
                  onClick={() => setTable(t)}
                  className={cn("relative h-28 font-display text-2xl font-extrabold tracking-[-.02em] transition-transform duration-500 n-spring hover:-translate-y-[3px] active:scale-[.92]",
                    takeaway && "col-span-2", sel ? "-translate-y-1 -rotate-3 text-[var(--night-ink)]" : "text-[var(--n-text)]")}>
                  {takeaway ? (
                    <span className="absolute inset-1 flex items-center justify-center gap-[18px] rounded-[22px] border-[1.5px] transition-all duration-500 n-spring" style={face}>
                      <span aria-hidden className="relative h-14 w-[46px] flex-none">
                        <span className="absolute top-0 left-[11px] h-[22px] w-6 rounded-t-[14px] border-4 border-b-0" style={{ borderColor: chair }} />
                        <span className="absolute inset-x-0 bottom-0 h-[42px] rounded-[6px_6px_12px_12px]" style={{ background: chair }} />
                      </span>
                      <span>{t}</span>
                    </span>
                  ) : (
                    <>
                      {[["top-1 left-[22%]", "8px 8px 4px 4px"], ["top-1 right-[22%]", "8px 8px 4px 4px"], ["bottom-1 left-[22%]", "4px 4px 8px 8px"], ["bottom-1 right-[22%]", "4px 4px 8px 8px"]].map(([pos, radius]) => (
                        <span key={pos} aria-hidden className={cn("absolute h-3.5 w-[22%] transition-colors duration-300", pos)} style={{ background: chair, borderRadius: radius }} />
                      ))}
                      <span className="absolute inset-x-1 top-[22px] bottom-[22px] flex items-center justify-center rounded-[20px] border-[1.5px] transition-all duration-500 n-spring" style={face}>{t}</span>
                    </>
                  )}
                  {busyTables.has(t) && (
                    <span aria-hidden className="n-pulse absolute top-[30px] right-3.5 size-[9px] rounded-full" style={{ background: sel ? "var(--night-ink)" : "var(--coral)" }} />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <section className="n-rise [animation-delay:.2s]" aria-label="Chọn món">
          <StepTitle n="02">Chạm món để thêm</StepTitle>
          {menu.isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[18px]">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[262px] animate-pulse rounded-[28px] bg-[var(--n-surface)]" />)}
            </div>
          ) : (
            <MenuGrid menu={menu.data ?? []} counts={counts} onPick={add} onBlocked={(m) => push(`${m.name}: ${outReason(m)}`, "var(--pink)")} />
          )}
        </section>
      </div>

      <aside className="n-rise sticky top-6 min-w-[320px] flex-[0_1_420px] [animation-delay:.25s]" aria-label="Đơn đang chọn">
        <div className="relative rounded-[30px] bg-[var(--ticket)] px-6 pt-[26px] pb-6 text-[var(--night-ink)] shadow-[var(--ticket-shadow)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[13px] font-bold tracking-[.08em] text-[var(--cream-muted)] uppercase">{table === "Mang đi" ? "Đơn" : "Đơn bàn"}</div>
              <div ref={cartRef} className={cn("font-display leading-[.9] font-extrabold tracking-[-.05em] text-[#c8361c]", table ? "text-[68px]" : "text-[40px]")}>
                {table ?? "Chưa chọn"}
              </div>
            </div>
            <span key={`${bump}-${table}`} className="n-pop inline-block rounded-full bg-[var(--night-ink)] px-3.5 py-2 text-sm font-bold text-[var(--n-on-ink)]">{count} món</span>
          </div>
          <div aria-hidden className="relative -mx-6 my-[22px] border-t-2 border-dashed border-[rgba(30,21,48,.18)]">
            <span className="absolute -top-[15px] -left-3.5 size-7 rounded-full bg-[var(--n-bg)]" />
            <span className="absolute -top-[15px] -right-3.5 size-7 rounded-full bg-[var(--n-bg)]" />
          </div>
          {cart.length === 0 && (
            <div className="px-2.5 py-[34px] text-center">
              <div className="font-display text-[28px] font-extrabold tracking-[-.02em]">Chưa có món</div>
              <div className="mt-1.5 text-sm text-[var(--cream-muted)]">{table ? "Chạm món bên trái để thêm vào đơn" : "Chọn bàn rồi chạm món để thêm vào đơn"}</div>
            </div>
          )}
          <div className="-mx-1.5 flex max-h-[52vh] flex-col gap-3.5 overflow-auto px-1.5">
            {cart.map((c, idx) => {
              const m = byId[c.menu_item_id]
              if (!m) return null
              const img = photoOf(m)
              return (
                <div key={c.menu_item_id} className="n-rise rounded-[22px] bg-[var(--ticket-item)] p-3.5 shadow-[0_2px_0_rgba(30,21,48,.06)]">
                  <div className="flex items-center gap-3">
                    <div aria-hidden className="size-[58px] flex-none rounded-2xl bg-[var(--n-surface-2)] bg-cover bg-center" style={{ backgroundImage: img ? `url(${img})` : undefined }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold">{m.name}</div>
                      <div className="mt-0.5 text-[13px] text-[var(--cream-muted)]">{money(m.price)}</div>
                    </div>
                    <div className="flex items-center gap-0.5 rounded-full bg-[var(--night-ink)] p-1 text-[var(--n-on-ink)]">
                      <button type="button" aria-label={`Bớt một ${m.name}`} onClick={() => updCart((cc) => { cc[idx].qty--; return cc.filter((x) => x.qty > 0) })}
                        className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-[var(--n-on-ink-hover)]"><Minus className="size-4" weight="bold" /></button>
                      <span className="min-w-[22px] text-center font-display text-lg font-extrabold tabular">{c.qty}</span>
                      <button type="button" aria-label={`Thêm một ${m.name}`} onClick={() => { updCart((cc) => { cc[idx].qty++; return cc }); setBump((b) => b + 1) }}
                        className="flex size-11 items-center justify-center rounded-full bg-[var(--coral)] text-[var(--night-ink)] transition-transform duration-300 n-spring active:scale-[.8]"><Plus className="size-4" weight="bold" /></button>
                    </div>
                    <button type="button" aria-label={`Bỏ ${m.name}`} onClick={() => updCart((cc) => cc.filter((_, j) => j !== idx))}
                      className="flex size-11 items-center justify-center rounded-full text-[#b0362f] transition-all hover:-rotate-[10deg] hover:bg-[#ffe3e0]"><Trash2 className="size-[18px]" /></button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {NOTE_CHIPS.map((n) => {
                      const on = c.notes.includes(n)
                      return (
                        <button key={n} type="button" aria-pressed={on}
                          onClick={() => updCart((cc) => { cc[idx].notes = on ? cc[idx].notes.filter((x) => x !== n) : [...cc[idx].notes, n]; return cc })}
                          className={cn("h-11 rounded-full border-[1.5px] px-[15px] text-sm font-semibold transition-all duration-300 n-spring",
                            on ? "scale-[1.04] border-[var(--night-ink)] bg-[var(--night-ink)] text-[var(--n-on-ink)]" : "border-[rgba(30,21,48,.16)] bg-transparent text-[var(--night-ink)]")}>
                          {n}
                        </button>
                      )
                    })}
                  </div>
                  <input value={c.text} aria-label={`Ghi chú khác cho ${m.name}`} placeholder="Ghi chú khác..."
                    onChange={(e) => { const v = e.target.value; updCart((cc) => { cc[idx].text = v; return cc }) }}
                    className="mt-2.5 h-11 w-full rounded-[14px] border-[1.5px] border-[rgba(30,21,48,.25)] bg-[var(--ticket-input)] px-3.5 text-sm text-[var(--night-ink)] outline-none transition-colors placeholder:text-[#6a5e7a] focus:border-[var(--coral)]" />
                </div>
              )
            })}
          </div>
          <div className="mt-5 flex items-baseline justify-between">
            <span className="font-semibold text-[var(--cream-muted)]">Tạm tính</span>
            <span key={total} className="n-pop inline-block font-display text-[38px] font-extrabold tracking-[-.03em] tabular">{money(total)}</span>
          </div>
          <button ref={sendRef} type="button" disabled={!canSend && !sent} onClick={() => table && canSend && sendOrder.mutate({ table, lines: cart })}
            className="mt-4 flex h-[70px] w-full items-center justify-center gap-3 rounded-[22px] font-display text-[22px] font-extrabold tracking-[-.01em] text-[var(--night-ink)] shadow-[0_16px_30px_-14px_var(--coral-glow)] transition-all duration-500 n-spring hover:-translate-y-[3px] active:scale-[.96] disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{ background: sent ? "var(--lime)" : "var(--coral)", opacity: canSend || sent ? 1 : 0.35 }}>
            {sent ? <Check className="size-6" weight="bold" aria-hidden /> : <Send className="size-[22px]" weight="bold" aria-hidden />}
            <span>{sendOrder.isPending ? "Đang gửi..." : sendLabel}</span>
          </button>
        </div>
      </aside>

      {flyers.map((f) => (
        <div key={f.id} aria-hidden className="pointer-events-none fixed z-[60] [animation:n-flyX_.75s_linear_forwards]"
          style={{ left: f.x - 34, top: f.y - 34, ["--dx" as string]: `${f.dx}px` }}>
          <div className="size-[68px] rounded-full border-[3px] border-[var(--lime)] bg-[var(--n-surface-2)] bg-cover shadow-[0_10px_30px_rgba(0,0,0,.5)] [animation:n-flyY_.75s_cubic-bezier(.45,-0.9,.85,.5)_forwards]"
            style={{ backgroundImage: f.img ? `url(${f.img})` : undefined, ["--dy" as string]: `${f.dy}px` }} />
        </div>
      ))}
      {bits.map((b) => (
        <span key={b.id} aria-hidden className="pointer-events-none fixed z-[60] [animation:n-confetti_1.2s_cubic-bezier(.15,.7,.35,1)_forwards]"
          style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: b.c, borderRadius: b.round ? "50%" : 2,
            ["--x" as string]: `${b.vx}px`, ["--y" as string]: `${b.vy}px`, ["--r" as string]: b.rot }} />
      ))}
      <NightToasts toasts={toasts} />
    </div>
  )
}
