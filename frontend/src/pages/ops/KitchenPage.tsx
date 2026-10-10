import { useQuery } from "@tanstack/react-query"
import { Ban, CheckCircle2, CircleDashed, Clock, Flame, Lock, PackageX, PenLine, Play, RotateCcw, Soup, Trash2, Unlock, X } from "@/components/icons"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"

import { useAsk } from "@/components/ask"
import { Callout, Choice, Empty, Loading, StatusPill } from "@/components/common"
import { PinDialog } from "@/components/PinDialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { minutesSince, tableLabel } from "@/lib/format"
import { DISH_PHOTOS } from "@/lib/photos"
import type { MenuItem, OrderItem } from "@/lib/types"
import { errorText, useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { useWork } from "@/lib/work"

type ChefAction = { kind: "cancel" | "remake"; item: OrderItem }

const REASONS = {
  cancel: ["Khách đổi ý", "Khách về", "Ra món quá lâu"],
  remake: ["Mặn / nhạt", "Sai món", "Rơi, đổ", "Khách phàn nàn"],
  dish: ["Hỏng thiết bị", "Quá tải", "Không đạt chất lượng"],
}

/** Thời gian chờ: ≤10 phút bình thường, 10–20 phút cần chú ý, >20 phút trễ (icon + chữ, không chỉ màu). */
function Elapsed({ mins }: { mins: number }) {
  const tone = mins > 20 ? "bad" : mins > 10 ? "warn" : "neutral"
  return (
    <StatusPill tone={tone} className="bg-card px-2.5 py-1 text-sm">
      <Clock className="size-4" aria-hidden /> {mins} phút{tone === "bad" ? " · trễ" : ""}
    </StatusPill>
  )
}

export function KitchenPage() {
  const { has } = useAuth()
  const ask = useAsk()
  const work = useWork()
  const now = useServerNow(30_000)
  const items = useQuery({ queryKey: ["kitchen"], queryFn: () => api.get<OrderItem[]>("/kitchen/items"), refetchInterval: 30_000 })
  const menu = useQuery({ queryKey: ["menu"], queryFn: () => api.get<MenuItem[]>("/menu") })
  const outCandidates = useQuery({ queryKey: ["out-ingredients"], queryFn: () => api.get<{ id: number; name: string; unit: string }[]>("/kitchen/out-ingredients") })
  const inv = [["kitchen"], ["orders"], ["menu"]]

  const start = useAction((id: number) => api.post(`/kitchen/items/${id}/start`), { invalidate: inv })
  const done = useAction((id: number) => api.post(`/kitchen/items/${id}/done`), { invalidate: inv })
  const cancelWaiting = useAction((v: { id: number; reason: string }) => api.post(`/order-items/${v.id}/cancel`, { reason: v.reason }),
    { success: "Đã hủy món", invalidate: inv })

  const [chef, setChef] = useState<ChefAction | null>(null)
  const [reason, setReason] = useState("")
  const [usedMode, setUsedMode] = useState<"full" | "unknown">("full")
  const [pinOpen, setPinOpen] = useState(false)
  const chefAct = useAction(
    (v: { userId: number; pin: string }) =>
      chef!.kind === "cancel"
        ? api.post(`/order-items/${chef!.item.id}/cancel`, { reason, chef_id: v.userId, chef_pin: v.pin, used_mode: usedMode })
        : api.post(`/kitchen/items/${chef!.item.id}/remake`, { reason, chef_id: v.userId, chef_pin: v.pin }),
    {
      success: () => (chef?.kind === "cancel" ? "Đã hủy món, phần đã dùng ghi vào hao hụt" : "Đã tạo món làm lại"),
      invalidate: inv,
      quietError: true,
      onSuccess: () => {
        setPinOpen(false)
        setChef(null)
      },
    },
  )

  const [outOpen, setOutOpen] = useState(false)
  const [outId, setOutId] = useState<number | null>(null)
  const reportOut = useAction((id: number) => api.post<{ ingredient: string; locked_menu_items: number[]; moved_items: unknown[]; suggest_supplement: boolean }>(
    "/kitchen/out-of-ingredient", { ingredient_id: id }), {
    success: (r) => `Đã báo hết ${r.ingredient}: khóa ${r.locked_menu_items.length} món, chuyển ${r.moved_items.length} món đang chờ` +
      (r.suggest_supplement ? ". Kho còn hàng: thủ kho đã được báo để bàn giao bổ sung" : ""),
    invalidate: inv,
    onSuccess: () => { setOutOpen(false); setOutId(null) },
  })
  const [dishOpen, setDishOpen] = useState(false)
  const [dishId, setDishId] = useState<number | null>(null)
  const [dishReason, setDishReason] = useState("")
  const dishOut = useAction(() => api.post("/menu/out-of-dish", { menu_item_id: dishId, reason: dishReason }), {
    success: "Đã khóa bán món", invalidate: inv, onSuccess: () => { setDishOpen(false); setDishReason(""); setDishId(null) },
  })
  const resell = useAction((id: number) => api.post(`/menu-items/${id}/resell`, { note: "" }), { success: "Đã mở bán lại", invalidate: inv })

  const list = items.data ?? []
  // Phiếu mới tới sau lần tải đầu: nháy viền hai lần để bếp biết có món mới.
  const seen = useRef<Set<number> | null>(null)
  const fresh = new Set<number>()
  if (items.data) {
    if (seen.current === null) seen.current = new Set(items.data.map((i) => i.id))
    else for (const i of items.data) if (!seen.current.has(i.id)) fresh.add(i.id)
  }
  useEffect(() => {
    if (items.data && seen.current) for (const i of items.data) seen.current.add(i.id)
  }, [items.data])
  const waiting = list.filter((i) => i.status === "waiting")
  const cooking = list.filter((i) => i.status === "cooking")
  const out = list.filter((i) => i.status === "out_of_stock")
  const finished = list.filter((i) => i.status === "done")
  const locked = (menu.data ?? []).filter((m) => m.locked)
  const outName = outCandidates.data?.find((i) => i.id === outId)?.name

  const codeByName = Object.fromEntries((menu.data ?? []).map((m) => [m.name, m.code]))
  const photoOf = (it: OrderItem) => DISH_PHOTOS[codeByName[it.name] ?? ""]?.src

  const card = (it: OrderItem) => {
    const mins = minutesSince(it.started_at ?? it.confirmed_at, now)
    const isCooking = it.status === "cooking"
    return (
      <article key={it.id} className={cn("overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-stone-900/5", fresh.has(it.id) && "ticket-arrive")}>
        <header className={cn("flex items-center justify-between gap-2 px-4 py-3", isCooking ? "bg-primary text-primary-foreground" : "bg-muted")}>
          <span className="font-display text-2xl font-bold">{tableLabel(it.table ?? "")}</span>
          <Elapsed mins={mins} />
        </header>
        {/* Đường đục lỗ của phiếu bếp: nét đứt + hai khoét tròn ở mép */}
        <div className="relative h-0 border-t-2 border-dashed border-input/40 before:absolute before:top-0 before:-left-2.5 before:size-5 before:-translate-y-1/2 before:rounded-full before:bg-page after:absolute after:top-0 after:-right-2.5 after:size-5 after:-translate-y-1/2 after:rounded-full after:bg-page" aria-hidden />
        <div className="px-4 pt-3.5 pb-4">
          <div className="flex items-center gap-3">
            {photoOf(it) && <img src={photoOf(it)} alt="" className="size-14 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="font-display text-2xl leading-tight font-bold">{it.name}</div>
              <div className="text-xs text-muted-foreground">{it.order_code}{it.remake_of_id ? ", món làm lại" : ""}</div>
            </div>
            <span className="shrink-0 rounded-xl bg-ink px-3 py-1 font-display text-2xl font-bold tabular text-ink-foreground" aria-label={`Số lượng ${it.qty}`}>×{it.qty}</span>
          </div>
          {it.note && <div className="mt-3 rounded-xl border border-status-warning/60 bg-status-warning/15 px-3 py-2 text-base font-semibold text-warning-ink">Ghi chú: {it.note}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {it.status === "waiting" && (
              <>
                <Button size="touch" className="flex-1" onClick={() => start.mutate(it.id)} disabled={start.isPending}>
                  <Play /> Bắt đầu nấu
                </Button>
                <Button size="touch" variant="outline" aria-label={`Hủy ${it.name}`} onClick={async () => {
                  const r = await ask.reason({
                    title: `Hủy ${it.name} (${tableLabel(it.table ?? "")})?`,
                    description: "Món chưa nấu nên không trừ kho.",
                    presets: REASONS.cancel, defaultValue: "Khách đổi ý", confirmLabel: "Hủy món", danger: true,
                  })
                  if (r) cancelWaiting.mutate({ id: it.id, reason: r })
                }}><X /> Hủy</Button>
              </>
            )}
            {isCooking && (
              <>
                <Button size="touch" className="flex-1" onClick={() => done.mutate(it.id)} disabled={done.isPending}>
                  <CheckCircle2 /> Xong, ra món
                </Button>
                <Button size="touch" variant="outline" onClick={() => { setChef({ kind: "remake", item: it }); setReason("") }}>
                  <RotateCcw /> Làm lại
                </Button>
                <Button size="touch" variant="outline" onClick={() => { setChef({ kind: "cancel", item: it }); setReason(""); setUsedMode("full") }}>
                  <Ban /> Hủy
                </Button>
              </>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl bg-paprika-soft text-paprika-ink" aria-hidden><Soup className="size-7" /></span>
          <div>
            <h1 className="text-3xl leading-tight font-bold">Danh sách món</h1>
            <p className="mt-1 text-sm text-muted-foreground">Bấm <b>Bắt đầu nấu</b> khi lấy nguyên liệu (kho trừ lúc này), bấm <b>Xong</b> khi ra món.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xl" variant="danger" onClick={() => setOutOpen(true)}><PackageX /> Báo hết nguyên liệu</Button>
          <Button size="xl" variant="outline" onClick={() => setDishOpen(true)}><Lock /> Báo hết món</Button>
        </div>
      </div>

      {has("head_chef") && work.handoversToSign > 0 && (
        <Callout tone="warn" icon={PenLine} title={`${work.handoversToSign} phiếu bàn giao đang chờ bạn cân lại và ký`}
          action={<Button asChild size="xl"><Link to="/van-hanh/nhan-ban-giao">Mở để ký</Link></Button>}>
          Hàng chỉ chuyển sang Bếp sau khi bếp trưởng ký nhận bằng PIN.
        </Callout>
      )}
      {has("head_chef") && work.wasteToApprove > 0 && (
        <Callout tone="info" icon={Trash2} title={`${work.wasteToApprove} phiếu hao hụt chờ bạn duyệt`}
          action={<Button asChild size="xl" variant="outline"><Link to="/van-hanh/hao-hut">Xem phiếu</Link></Button>} />
      )}
      {locked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-soft ring-1 ring-stone-900/5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Lock className="size-4 text-critical-ink" aria-hidden /> Đang khóa bán:</span>
          {locked.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-xl bg-muted py-1 pr-1 pl-3 text-sm font-semibold">
              {m.name}
              {has("head_chef", "manager") && (
                <Button size="lg" variant="outline" onClick={() => resell.mutate(m.id)}>
                  <Unlock className="size-4" /> Bán lại
                </Button>
              )}
            </span>
          ))}
        </div>
      )}

      {items.isLoading ? <Loading /> : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section aria-label="Chờ nấu">
            <h2 className="mb-3 flex items-center gap-2.5 text-2xl font-bold">
              <CircleDashed className="size-6 text-muted-foreground" aria-hidden /> Chờ nấu
              <span className="rounded-full bg-card px-3 font-sans text-base font-bold tabular ring-1 ring-border">{waiting.length}</span>
            </h2>
            <div className="space-y-3">{waiting.length ? waiting.map(card) : <Empty>Không có món chờ. Món mới từ phục vụ sẽ hiện ở đây ngay.</Empty>}</div>
          </section>
          <section aria-label="Đang nấu">
            <h2 className="mb-3 flex items-center gap-2.5 text-2xl font-bold">
              <Flame className="size-6 text-paprika-ink" aria-hidden /> Đang nấu
              <span className="rounded-full bg-primary px-3 font-sans text-base font-bold tabular text-primary-foreground">{cooking.length}</span>
            </h2>
            <div className="space-y-3">{cooking.length ? cooking.map(card) : <Empty icon={Flame}>Chưa có món đang nấu</Empty>}</div>
          </section>
        </div>
      )}

      {(out.length > 0 || finished.length > 0) && (
        <div className="grid gap-4 border-t pt-4 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-critical-ink"><PackageX className="size-4" aria-hidden /> Hết nguyên liệu, chờ phục vụ báo khách</h3>
            <ul className="space-y-1 text-sm">
              {out.map((it) => <li key={it.id}><b>{tableLabel(it.table ?? "")}</b>: {it.name}. <span className="text-critical-ink">{it.end_reason}</span></li>)}
              {!out.length && <li className="text-muted-foreground">Không có</li>}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><CheckCircle2 className="size-4" aria-hidden /> Vừa ra món (30 phút)</h3>
            <div className="flex flex-wrap gap-1.5">
              {finished.map((it) => <StatusPill key={it.id} tone="good">{tableLabel(it.table ?? "")}: {it.name}</StatusPill>)}
            </div>
          </section>
        </div>
      )}

      {/* Hủy / làm lại món đã bắt đầu: bếp trưởng xác nhận bằng PIN (BR-03) */}
      <Dialog open={!!chef && !pinOpen} onOpenChange={(v) => !v && setChef(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{chef?.kind === "cancel" ? "Hủy món đang nấu" : "Làm lại món"}: {chef?.item.name}</DialogTitle>
            <DialogDescription>
              Nguyên liệu đã rời tồn. {chef?.kind === "cancel" ? "Phần đã dùng chuyển thành hao hụt “khách hủy sau chế biến”." : "Món gốc chuyển thành hao hụt “làm lại”; món mới trừ kho bình thường."} Cần bếp trưởng xác nhận bằng PIN.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chef-reason">Lý do</Label>
              <div className="flex flex-wrap gap-2">
                {(chef ? REASONS[chef.kind] : []).map((r) => <Choice key={r} className="min-h-11 text-sm" selected={reason === r} onClick={() => setReason(r)}>{r}</Choice>)}
              </div>
              <Input id="chef-reason" className="h-12" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hoặc nhập lý do khác" />
            </div>
            {chef?.kind === "cancel" && (
              <div className="space-y-2" role="group" aria-labelledby="da-dung">
                <Label id="da-dung">Lượng nguyên liệu đã dùng</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Choice selected={usedMode === "full"} onClick={() => setUsedMode("full")}>Bằng định lượng</Choice>
                  <Choice selected={usedMode === "unknown"} onClick={() => setUsedMode("unknown")}>Không xác định được</Choice>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="xl" onClick={() => setChef(null)}>Quay lại</Button>
            <Button size="xl" disabled={!reason.trim()} onClick={() => setPinOpen(true)}>Bếp trưởng xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PinDialog
        open={pinOpen}
        onOpenChange={(v) => { setPinOpen(v); if (!v) chefAct.reset() }}
        title="Bếp trưởng xác nhận"
        description={`${chef?.kind === "cancel" ? "Hủy" : "Làm lại"} ${chef?.item.name} (${tableLabel(chef?.item.table ?? "")}): ${reason}`}
        busy={chefAct.isPending}
        error={errorText(chefAct.error)}
        onConfirm={(userId, pin) => chefAct.mutate({ userId, pin })}
      />

      <Dialog open={outOpen} onOpenChange={(v) => { setOutOpen(v); if (!v) setOutId(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg"><PackageX className="size-5 text-critical-ink" aria-hidden /> Báo hết nguyên liệu</DialogTitle>
            <DialogDescription>
              Chọn nguyên liệu Bếp đã hết. Các món dùng nó bị khóa bán, món đang chờ chuyển “Hết nguyên liệu”. Hệ thống coi tồn thực tế tại Bếp = 0 và tính chênh lệch ngay.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(outCandidates.data ?? []).map((i) => (
              <Choice key={i.id} className="h-14" selected={outId === i.id} onClick={() => setOutId(i.id)}>{i.name}</Choice>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="xl" onClick={() => setOutOpen(false)}>Quay lại</Button>
            <Button size="xl" variant="danger" disabled={!outId || reportOut.isPending} onClick={() => outId && reportOut.mutate(outId)}>
              {outName ? `Xác nhận Bếp đã hết ${outName}` : "Chọn nguyên liệu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dishOpen} onOpenChange={setDishOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg"><Lock className="size-5" aria-hidden /> Báo hết món (tạm ngưng bán)</DialogTitle>
            <DialogDescription>Chỉ khóa bán món, không tác động kho (hỏng thiết bị, quá tải…).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(menu.data ?? []).filter((m) => m.sellable).map((m) => (
              <Choice key={m.id} selected={dishId === m.id} onClick={() => setDishId(m.id)}>{m.name}</Choice>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dish-reason">Lý do</Label>
            <div className="flex flex-wrap gap-2">
              {REASONS.dish.map((r) => <Choice key={r} className="min-h-11 text-sm" selected={dishReason === r} onClick={() => setDishReason(r)}>{r}</Choice>)}
            </div>
            <Input id="dish-reason" className="h-12" placeholder="Hoặc nhập lý do khác" value={dishReason} onChange={(e) => setDishReason(e.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="xl" onClick={() => setDishOpen(false)}>Quay lại</Button>
            <Button size="xl" disabled={!dishId || !dishReason.trim() || dishOut.isPending} onClick={() => dishOut.mutate(undefined)}>Khóa bán</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
