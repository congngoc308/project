import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, ClipboardList, Flame, PackageX, RefreshCcw, RotateCcw, X } from "@/components/icons"
import { useState } from "react"

import { useAsk } from "@/components/ask"
import { Empty, Loading, PageHeader, StatusPill, type Tone } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { tableLabel, time } from "@/lib/format"
import type { MenuItem, Order, OrderItem } from "@/lib/types"
import { DISH_PHOTOS } from "@/lib/photos"
import { useAction } from "@/lib/useAction"
import { MenuGrid } from "@/pages/ops/OrderPage"

export const ITEM_TONE: Record<OrderItem["status"], Tone> = {
  waiting: "neutral",
  cooking: "info",
  done: "good",
  out_of_stock: "bad",
  cancelled: "neutral",
  remade: "warn",
}
export const ITEM_LABEL: Record<OrderItem["status"], string> = {
  waiting: "Chờ bếp",
  cooking: "Đang chế biến",
  done: "Hoàn tất",
  out_of_stock: "Hết nguyên liệu",
  cancelled: "Đã hủy",
  remade: "Làm lại",
}
export const ITEM_ICON: Record<OrderItem["status"], typeof Flame> = {
  waiting: CircleDashed,
  cooking: Flame,
  done: CheckCircle2,
  out_of_stock: PackageX,
  cancelled: Ban,
  remade: RotateCcw,
}

export function ItemStatus({ status }: { status: OrderItem["status"] }) {
  const Icon = ITEM_ICON[status]
  return <StatusPill tone={ITEM_TONE[status]}><Icon className="size-3.5" aria-hidden />{ITEM_LABEL[status]}</StatusPill>
}

export function TablesPage() {
  const ask = useAsk()
  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<OrderItem[]>("/server/notifications"), refetchInterval: 20_000 })
  const orders = useQuery({ queryKey: ["orders", "open"], queryFn: () => api.get<Order[]>("/orders?status=open"), refetchInterval: 20_000 })
  const menu = useQuery({ queryKey: ["menu"], queryFn: () => api.get<MenuItem[]>("/menu") })
  const [swap, setSwap] = useState<OrderItem | null>(null)
  const inv = [["notifications"], ["orders"], ["kitchen"]]
  const codeByName = Object.fromEntries((menu.data ?? []).map((m) => [m.name, m.code]))
  const photoOf = (name: string) => DISH_PHOTOS[codeByName[name] ?? ""]?.src

  const cancel = useAction(
    (v: { item: OrderItem; reason: string }) => api.post(`/order-items/${v.item.id}/cancel`, { reason: v.reason }),
    { success: "Đã hủy món", invalidate: inv },
  )
  const doSwap = useAction(
    async (v: { item: OrderItem; menu: MenuItem }) => {
      await api.post(`/order-items/${v.item.id}/cancel`, { reason: `Hết nguyên liệu, khách đổi sang ${v.menu.name}` })
      return api.post(`/orders/${v.item.order_id}/items`, { items: [{ menu_item_id: v.menu.id }] })
    },
    { success: "Đã đổi món và gửi bếp", invalidate: inv, onSuccess: () => setSwap(null) },
  )
  const outList = notes.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Bàn & báo khách" icon={ClipboardList}
        description="Món hết nguyên liệu cần báo khách hiện ở trên cùng. Bên dưới là tình trạng từng món của các bàn đang mở." />

      <section aria-label="Món hết nguyên liệu">
        {notes.isLoading ? <Loading /> : !outList.length ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-status-good/40 bg-status-good/10 px-5 py-4 text-base font-semibold text-good-ink">
            <CheckCircle2 className="size-5" aria-hidden /> Không có món nào cần báo khách
          </div>
        ) : (
          <>
            <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-critical-ink">
              <AlertTriangle className="size-5" aria-hidden /> Cần báo khách ngay ({outList.length})
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {outList.map((n) => (
                <li key={n.id} className="surface overflow-hidden border-l-4 border-l-destructive p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-3xl font-bold">{tableLabel(n.table ?? "")}</span>
                    <span className="text-sm tabular text-muted-foreground">{time(n.ended_at)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {photoOf(n.name) && <img src={photoOf(n.name)} alt="" className="size-14 shrink-0 rounded-xl object-cover grayscale" />}
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{n.name} ×{n.qty}</div>
                      <div className="text-sm font-semibold text-critical-ink">{n.end_reason}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button size="xl" onClick={() => setSwap(n)}><RefreshCcw /> Đổi món</Button>
                    <Button size="xl" variant="outline" onClick={() => cancel.mutate({ item: n, reason: "Hết nguyên liệu, khách hủy món" })}>
                      <X /> Khách hủy
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Đơn đang mở">
        <h2 className="mb-3 text-2xl font-bold">Bàn đang phục vụ <span className="font-sans text-lg font-semibold text-muted-foreground">({orders.data?.length ?? 0})</span></h2>
        {orders.isLoading ? <Loading /> : !orders.data?.length ? <Empty>Chưa có bàn nào đang mở. Đơn mới tạo ở tab “Đặt món”.</Empty> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.data.map((o) => (
              <article key={o.id} className="surface overflow-hidden">
                <header className="flex items-baseline justify-between bg-muted px-4 py-3">
                  <span className="font-display text-2xl font-bold">{tableLabel(o.table ?? "")}</span>
                  <span className="text-xs tabular text-muted-foreground">{o.code}, {time(o.confirmed_at ?? o.opened_at)}</span>
                </header>
                <ul className="divide-y divide-border/70">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
                      <span className={it.status === "cancelled" ? "text-muted-foreground line-through" : "font-medium"}>
                        {it.name} × {it.qty}
                        {it.note && <span className="block text-xs font-normal text-muted-foreground">{it.note}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <ItemStatus status={it.status} />
                        {it.status === "waiting" && (
                          <Button size="lg" variant="ghost" className="text-muted-foreground" aria-label={`Hủy ${it.name}`}
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
                            }}>
                            <X /> Hủy
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!swap} onOpenChange={(v) => !v && setSwap(null)}>
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{tableLabel(swap?.table ?? "")}: đổi “{swap?.name}” sang món khác</DialogTitle>
            <DialogDescription>Món cũ được hủy với lý do hết nguyên liệu, món mới gửi bếp ngay.</DialogDescription>
          </DialogHeader>
          <MenuGrid menu={menu.data ?? []} onPick={(m) => swap && doSwap.mutate({ item: swap, menu: m })} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
