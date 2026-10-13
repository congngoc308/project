import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Ban, BellRing, Check, CheckCircle2, ClipboardList, RefreshCcw, RotateCcw, X } from "@/components/icons"
import { useState } from "react"

import { useAsk } from "@/components/ask"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NightToasts, useNightToasts } from "@/layouts/NightBits"
import { api } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { minutesSince, tableLabel, time } from "@/lib/format"
import { DISH_PHOTOS } from "@/lib/photos"
import type { MenuItem, Order, OrderItem } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { MenuGrid } from "@/pages/ops/OrderPage"

/** Chip trạng thái món theo thiết kế "Phục Vụ": luôn có icon / hình + chữ, không chỉ dựa vào màu. */
type ChipKey = OrderItem["status"] | "served"
const STATUS: Record<ChipKey, { label: string; cls: string; mark: "wait" | "cook" | "ready" | "served" | "out" | "cancel" | "remake" }> = {
  waiting: { label: "Chờ bếp", cls: "bg-[var(--neutral-tint)] text-[var(--neutral-text)]", mark: "wait" },
  cooking: { label: "Đang nấu", cls: "bg-[var(--coral-tint)] text-[var(--coral-text)]", mark: "cook" },
  done: { label: "Chờ bưng", cls: "n-pulse-lime bg-[var(--lime)] text-[var(--night-ink)]", mark: "ready" },
  served: { label: "Đã bưng", cls: "bg-[var(--good-tint)] text-[var(--good-text)]", mark: "served" },
  out_of_stock: { label: "Hết nguyên liệu", cls: "bg-[var(--pink-tint)] text-[var(--pink-text)]", mark: "out" },
  cancelled: { label: "Đã hủy", cls: "bg-transparent text-[var(--n-muted)]", mark: "cancel" },
  remade: { label: "Làm lại", cls: "bg-[var(--lime-tint)] text-[var(--warn-text)]", mark: "remake" },
}

function StatusChip({ status }: { status: ChipKey }) {
  const s = STATUS[status]
  return (
    <span className={cn("flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-bold whitespace-nowrap transition-all duration-300", s.cls)}>
      {s.mark === "wait" && <span aria-hidden className="n-spin size-3.5 rounded-full border-2 border-dashed border-current" />}
      {s.mark === "cook" && <span aria-hidden className="n-pulse size-[9px] rounded-full bg-[var(--coral)]" />}
      {s.mark === "ready" && <BellRing className="size-4" weight="bold" aria-hidden />}
      {s.mark === "served" && <Check className="size-3.5" weight="bold" aria-hidden />}
      {s.mark === "out" && <AlertTriangle className="size-4" weight="bold" aria-hidden />}
      {s.mark === "cancel" && <Ban className="size-4" aria-hidden />}
      {s.mark === "remake" && <RotateCcw className="size-4" aria-hidden />}
      <span>{s.label}</span>
    </span>
  )
}

/** Món xong mà chưa bưng quá ngần này phút thì thẻ bàn chuyển viền hồng cảnh báo (kèm icon + chữ). */
const SERVE_WARN_MIN = 5

export function TablesPage() {
  const ask = useAsk()
  const { toasts, push } = useNightToasts()
  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<OrderItem[]>("/server/notifications"), refetchInterval: 20_000 })
  const orders = useQuery({ queryKey: ["orders", "open"], queryFn: () => api.get<Order[]>("/orders?status=open"), refetchInterval: 20_000 })
  const menu = useQuery({ queryKey: ["menu"], queryFn: () => api.get<MenuItem[]>("/menu") })
  const ready = useQuery({ queryKey: ["ready"], queryFn: () => api.get<OrderItem[]>("/server/ready"), refetchInterval: 20_000 })
  const now = useServerNow(15_000)
  const [swap, setSwap] = useState<OrderItem | null>(null)
  const inv = [["notifications"], ["orders"], ["kitchen"], ["ready"]]
  const codeByName = Object.fromEntries((menu.data ?? []).map((m) => [m.name, m.code]))
  const photoOf = (name: string) => DISH_PHOTOS[codeByName[name] ?? ""]?.src

  const cancel = useAction(
    (v: { item: OrderItem; reason: string }) => api.post(`/order-items/${v.item.id}/cancel`, { reason: v.reason }),
    { invalidate: inv, onSuccess: () => push("Đã hủy món", "var(--pink)") },
  )
  const doSwap = useAction(
    async (v: { item: OrderItem; menu: MenuItem }) => {
      await api.post(`/order-items/${v.item.id}/cancel`, { reason: `Hết nguyên liệu, khách đổi sang ${v.menu.name}` })
      return api.post(`/orders/${v.item.order_id}/items`, { items: [{ menu_item_id: v.menu.id }] })
    },
    { invalidate: inv, onSuccess: () => { setSwap(null); push("Đã đổi món và gửi bếp", "var(--coral)") } },
  )
  const serve = useAction(
    (v: { items: OrderItem[] }) => api.post("/order-items/served", { item_ids: v.items.map((i) => i.id) }).then(() => v),
    { invalidate: inv, onSuccess: (v) => push(`Đã bưng ra ${tableLabel(v.items[0].table ?? "")}`, "var(--lime)") },
  )
  // Món chờ bưng gộp theo bàn; bàn chờ lâu nhất lên đầu.
  const readyByTable = [...(ready.data ?? []).reduce((m, it) => m.set(it.table, [...(m.get(it.table) ?? []), it]), new Map<string, OrderItem[]>())]
  const outList = notes.data ?? []
  const list = orders.data ?? []

  return (
    <div className="mt-11">
      <div className="n-rise flex items-start gap-5 [animation-delay:.05s]">
        <div aria-hidden className="flex size-[68px] flex-none rotate-6 items-center justify-center rounded-[22px] bg-[var(--lime)] text-[var(--night-ink)]">
          <ClipboardList className="size-[34px]" weight="bold" />
        </div>
        <div>
          <h1 className="m-0 text-[clamp(40px,5vw,60px)] leading-[.95] font-extrabold tracking-[-.04em]">Bàn &amp; báo khách</h1>
          <p className="mt-3.5 max-w-[720px] text-[17px] leading-[1.55] text-[var(--n-muted)]">
            Món bếp đã xong cần mang ra bàn và món hết nguyên liệu cần báo khách hiện ở trên cùng. Bên dưới là tình trạng từng món của các bàn đang mở.
          </p>
        </div>
      </div>

      {readyByTable.length > 0 && (
        <section aria-labelledby="cho-bung" className="n-rise mt-8 [animation-delay:.08s]">
          <h2 id="cho-bung" className="mb-5 flex items-center gap-3 text-[34px] font-extrabold tracking-[-.03em] text-[var(--lime-text)]">
            <BellRing className="size-8" weight="bold" aria-hidden /> Món đã xong, mang ra bàn
            <span className="rounded-full bg-[var(--lime)] px-3.5 py-1 font-display text-xl text-[var(--night-ink)]">{ready.data?.length}</span>
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-5">
            {readyByTable.map(([table, items]) => {
              const wait = minutesSince(items[0].done_at, now)
              const late = wait >= SERVE_WARN_MIN
              return (
                <li key={table} className={cn("overflow-hidden rounded-[28px] border-2 bg-[var(--n-surface)] p-6", late ? "border-[var(--pink-line)]" : "border-[var(--lime-line)]")}>
                  <div className="flex items-end justify-between gap-3">
                    <span className="font-display text-4xl leading-none font-extrabold tracking-[-.03em]">{tableLabel(table)}</span>
                    <span className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold tabular", late ? "bg-[var(--pink-tint)] text-[var(--pink-text)]" : "bg-[var(--lime-tint)] text-[var(--warn-text)]")}>
                      {late && <AlertTriangle className="size-4" weight="bold" aria-hidden />}
                      {wait < 1 ? "Vừa xong" : `Xong ${wait} phút trước`}
                    </span>
                  </div>
                  <ul className="mt-4 flex flex-col gap-2">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3.5 rounded-[18px] bg-[var(--n-inset)] p-2.5">
                        {photoOf(it.name) && <div aria-hidden className="size-14 flex-none rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${photoOf(it.name)})` }} />}
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-bold">{it.name} <span className="font-display font-extrabold text-[var(--coral-text)]">×{it.qty}</span></div>
                          {it.note && <div className="mt-0.5 text-sm text-[var(--n-soft)]">{it.note}</div>}
                        </div>
                        {items.length > 1 && (
                          <button type="button" disabled={serve.isPending} onClick={() => serve.mutate({ items: [it] })} aria-label={`Đã bưng ${it.name}`}
                            className="flex h-11 flex-none items-center gap-1.5 rounded-full border-[1.5px] border-[var(--n-outline)] px-3.5 text-sm font-semibold transition-all duration-200 hover:bg-[var(--n-invert)] hover:text-[var(--n-invert-fg)] disabled:opacity-60">
                            <Check className="size-4" weight="bold" aria-hidden />Đã bưng
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button type="button" disabled={serve.isPending} onClick={() => serve.mutate({ items })}
                    className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] font-display text-lg font-extrabold text-[var(--night-ink)] transition-transform duration-300 n-spring hover:-translate-y-0.5 active:scale-95 disabled:opacity-60">
                    <CheckCircle2 className="size-6" weight="fill" aria-hidden />{items.length > 1 ? `Đã bưng cả ${items.length} món` : "Đã bưng ra bàn"}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-label="Món hết nguyên liệu" className="n-rise mt-8 [animation-delay:.12s]">
        {notes.isLoading ? (
          <div className="h-[76px] animate-pulse rounded-3xl bg-[var(--n-surface)]" />
        ) : !outList.length ? (
          <div className="relative flex items-center gap-3.5 overflow-hidden rounded-3xl border-[1.5px] border-[var(--lime-line)] bg-[var(--lime-tint-2)] px-6 py-5 text-[17px] font-bold text-[var(--warn-text)]">
            <div aria-hidden className="absolute inset-y-0 left-0 w-1/4 bg-[linear-gradient(90deg,rgba(255,216,77,0),var(--lime-tint),rgba(255,216,77,0))] [animation:n-sweep_3.5s_ease-in-out_infinite]" />
            <span aria-hidden className="flex size-[34px] flex-none items-center justify-center rounded-full bg-[var(--lime)] text-[var(--night-ink)]"><Check className="size-[18px]" weight="bold" /></span>
            <span>Không có món nào cần báo khách</span>
          </div>
        ) : (
          <>
            <h2 className="mb-5 flex items-center gap-3 text-[34px] font-extrabold tracking-[-.03em] text-[var(--pink-text)]">
              <AlertTriangle className="size-8" weight="bold" aria-hidden /> Cần báo khách ngay
              <span className="rounded-full bg-[var(--pink)] px-3.5 py-1 font-display text-xl text-[var(--night-ink)]">{outList.length}</span>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-5">
              {outList.map((n, i) => (
                <li key={n.id} className="n-rise overflow-hidden rounded-[28px] border-2 border-[var(--pink-line)] bg-[var(--n-surface)] p-6" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                  <div className="flex items-end justify-between gap-3">
                    <span className="font-display text-4xl leading-none font-extrabold tracking-[-.03em]">{tableLabel(n.table ?? "")}</span>
                    <span className="text-sm text-[var(--n-muted)] tabular">{time(n.ended_at)}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3.5">
                    {photoOf(n.name) && <div aria-hidden className="size-16 flex-none rounded-2xl bg-cover bg-center grayscale" style={{ backgroundImage: `url(${photoOf(n.name)})` }} />}
                    <div className="min-w-0">
                      <div className="text-lg font-bold">{n.name} <span className="font-display font-extrabold text-[var(--coral-text)]">×{n.qty}</span></div>
                      <div className="mt-0.5 text-sm font-semibold text-[var(--pink-text)]">{n.end_reason}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => setSwap(n)}
                      className="flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--coral)] font-display text-lg font-extrabold text-[var(--night-ink)] transition-transform duration-300 n-spring hover:-translate-y-0.5 active:scale-95">
                      <RefreshCcw className="size-5" weight="bold" aria-hidden /> Đổi món
                    </button>
                    <button type="button" onClick={() => cancel.mutate({ item: n, reason: "Hết nguyên liệu, khách hủy món" })}
                      className="flex h-14 items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--n-outline)] text-base font-semibold transition-all duration-200 hover:bg-[var(--n-invert)] hover:text-[var(--n-invert-fg)]">
                      <X className="size-5" weight="bold" aria-hidden /> Khách hủy
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Bàn đang phục vụ">
        <h2 className="n-rise mt-12 mb-5 flex items-center gap-3 text-[34px] font-extrabold tracking-[-.03em] [animation-delay:.18s]">
          <span>Bàn đang phục vụ</span>
          <span className="rounded-full bg-[var(--coral)] px-3.5 py-1 font-display text-xl text-[var(--night-ink)]">{list.length}</span>
        </h2>
        {orders.isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-5">
            {[0, 1].map((i) => <div key={i} className="h-60 animate-pulse rounded-[28px] bg-[var(--n-surface)]" />)}
          </div>
        ) : !list.length ? (
          <div className="rounded-[28px] border-2 border-dashed border-[var(--n-outline-soft)] px-5 py-[60px] text-center text-base text-[var(--n-muted)]">
            Chưa có bàn nào đang mở. Đơn mới tạo ở tab "Đặt món".
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-5">
            {list.map((o, oi) => {
              const live = o.items.filter((it) => it.status !== "cancelled")
              const done = live.filter((it) => it.status === "done").length
              const pct = live.length ? Math.max(4, Math.round((done / live.length) * 100)) : 4
              return (
                <article key={o.id} className="n-rise overflow-hidden rounded-[28px] border border-[var(--n-line)] bg-[var(--n-surface)] transition-transform duration-500 n-spring hover:-translate-y-1"
                  style={{ animationDelay: `${0.22 + oi * 0.08}s` }}>
                  <header className="flex items-end justify-between gap-3 px-6 pt-[22px] pb-4">
                    <span className="font-display text-4xl leading-none font-extrabold tracking-[-.03em]">{tableLabel(o.table ?? "")}</span>
                    <span className="text-right text-[13px] leading-[1.4] text-[var(--n-muted)] tabular">
                      <span className="block">{o.code}</span>
                      <span className="block font-semibold text-[var(--n-text)]">{time(o.confirmed_at ?? o.opened_at)}</span>
                    </span>
                  </header>
                  <div className="mx-6 h-1.5 overflow-hidden rounded-full bg-[var(--n-line)]" role="progressbar" aria-label="Món bếp đã làm xong"
                    aria-valuemin={0} aria-valuemax={live.length} aria-valuenow={done}>
                    <div className="h-full rounded-full bg-[var(--lime)] transition-[width] duration-700 n-spring" style={{ width: `${pct}%` }} />
                  </div>
                  <ul className="flex flex-col px-3 pt-2.5 pb-3.5">
                    {o.items.map((it) => (
                      <li key={it.id} className={cn("flex items-center gap-3 rounded-[18px] p-3 transition-all duration-500",
                        it.status === "done" && "bg-[var(--lime-tint-2)]", it.status === "cancelled" && "opacity-60")}>
                        <div className="min-w-0 flex-1">
                          <div className={cn("text-base font-bold", it.status === "cancelled" && "line-through")}>
                            {it.name} <span className="font-display font-extrabold text-[var(--coral-text)]">×{it.qty}</span>
                          </div>
                          <div className="mt-0.5 text-[13px] text-[var(--n-muted)]">{it.note || "Không ghi chú"}</div>
                        </div>
                        <StatusChip status={it.status === "done" && it.served_at ? "served" : it.status} />
                        {it.status === "waiting" && (
                          <button type="button" aria-label={`Hủy ${it.name}`}
                            onClick={async () => {
                              const reason = await ask.reason({
                                title: `Hủy ${it.name} (${tableLabel(o.table ?? "")})?`,
                                description: "Món chưa nấu nên không ảnh hưởng kho.",
                                presets: ["Khách đổi ý", "Khách về", "Gọi nhầm món"],
                                defaultValue: "Khách đổi ý",
                                confirmLabel: "Hủy món",
                                danger: true,
                              })
                              if (reason) cancel.mutate({ item: it, reason })
                            }}
                            className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-all duration-200 hover:bg-[var(--pink-tint)] hover:text-[var(--pink-text)]">
                            <X className="size-3.5" weight="bold" aria-hidden /><span>Hủy</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <Dialog open={!!swap} onOpenChange={(v) => !v && setSwap(null)}>
        <DialogContent className="max-h-[88svh] overflow-y-auto bg-[var(--n-bg)] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{tableLabel(swap?.table ?? "")}: đổi “{swap?.name}” sang món khác</DialogTitle>
            <DialogDescription>Món cũ được hủy với lý do hết nguyên liệu, món mới gửi bếp ngay.</DialogDescription>
          </DialogHeader>
          <MenuGrid menu={menu.data ?? []} onPick={(m) => swap && !doSwap.isPending && doSwap.mutate({ item: swap, menu: m })}
            onBlocked={(m) => push(`${m.name}: ${m.locks[0]?.reason ?? "Tạm hết"}`, "var(--pink)")} />
        </DialogContent>
      </Dialog>
      <NightToasts toasts={toasts} />
    </div>
  )
}
