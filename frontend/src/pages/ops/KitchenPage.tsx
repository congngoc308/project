import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, Flame, Lock, NotePencil, Package, PenNib, Play, RotateCcw, SealCheck, Unlock, X, XCircle, type IconType,
} from "@/components/icons"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"

import { Loading } from "@/components/common"
import { ChefPin, chime, K, KConfirm, KDialog, kToast, pick, ReasonPicker, useFlip, type ToastTone } from "@/layouts/KitchenBits"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { minutesSince, tableLabel } from "@/lib/format"
import { DISH_PHOTOS } from "@/lib/photos"
import type { MenuItem, OrderItem } from "@/lib/types"
import { errorText, useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { useWork } from "@/lib/work"

const REASONS = {
  cancel: ["Khách đổi ý", "Khách về", "Ra món quá lâu"],
  remake: ["Mặn / nhạt", "Sai món", "Rơi, đổ", "Khách phàn nàn"],
  dish: ["Hỏng thiết bị", "Quá tải", "Không đạt chất lượng"],
}
/** Ngưỡng trễ: quá nửa ngưỡng thì vàng, quá ngưỡng thì đỏ (luôn kèm icon + chữ "trễ"). */
const LATE_MIN = 20
/** Món xong chưa được bưng quá ngần này phút thì báo đỏ (khớp màn phục vụ). */
const SERVE_WARN_MIN = 5

type ChefDlg = { kind: "chef"; chefKind: "cancel" | "remake"; item: OrderItem }
type Dlg = { kind: "cancelWait"; item: OrderItem } | ChefDlg | { kind: "outIng" } | { kind: "outDish" }

/** Thao tác của màn bếp: báo bằng thông báo nền than (lỗi cũng vậy) kèm âm báo. */
function useKAction<V, R = unknown>(fn: (v: V) => Promise<R>, opts: { ok?: (r: R) => [string, string, ToastTone?]; onSuccess?: (r: R) => void; quietError?: boolean } = {}) {
  return useAction(fn, {
    invalidate: [["kitchen"], ["orders"], ["menu"]],
    quietError: true,
    onSuccess: (r) => {
      if (opts.ok) {
        const [title, sub, tone = "ok"] = opts.ok(r)
        chime(tone)
        kToast(title, sub, tone)
      }
      opts.onSuccess?.(r)
    },
    onError: (e) => {
      if (opts.quietError) return
      chime("bad")
      kToast("Không thực hiện được", errorText(e) ?? "Có lỗi xảy ra", "bad")
    },
  })
}

/** Ảnh món theo mã (ảnh nền để giữ khung vuông bo góc); món chưa có ảnh hiện ô đá trống. */
function Photo({ code, size, gray, className }: { code?: string; size: number; gray?: boolean; className?: string }) {
  const p = code ? DISH_PHOTOS[code] : undefined
  return (
    <span aria-hidden className={cn("block shrink-0 bg-[#e9e6e1] bg-cover bg-center", gray && "grayscale", className)}
      style={{ width: size, height: size, backgroundImage: p ? `url(${p.src})` : undefined }} />
  )
}

export function KitchenPage() {
  const { has } = useAuth()
  const work = useWork()
  const now = useServerNow(10_000)
  const items = useQuery({ queryKey: ["kitchen"], queryFn: () => api.get<OrderItem[]>("/kitchen/items"), refetchInterval: 30_000 })
  const menu = useQuery({ queryKey: ["menu"], queryFn: () => api.get<MenuItem[]>("/menu") })
  const outCandidates = useQuery({ queryKey: ["out-ingredients"], queryFn: () => api.get<{ id: number; name: string; unit: string }[]>("/kitchen/out-ingredients") })
  const isChef = has("head_chef")

  const codeById: Record<number, string> = Object.fromEntries((menu.data ?? []).map((m) => [m.id, m.code]))
  const label = (it: OrderItem) => `${tableLabel(it.table ?? "")}, ${it.name} ×${it.qty}`

  // Hộp thoại chung của màn (hủy món chờ, hủy / làm lại có PIN bếp trưởng, báo hết nguyên liệu, báo hết món).
  const [dlg, setDlg] = useState<Dlg | null>(null)
  const [reason, setReason] = useState("")
  const [sel, setSel] = useState<number | null>(null)
  const [used, setUsed] = useState<"full" | "unknown">("full")
  const [step, setStep] = useState<"reason" | "pin">("reason")
  const open = (d: Dlg) => { setDlg(d); setReason(""); setSel(null); setUsed("full"); setStep("reason") }

  const start = useKAction((it: OrderItem) => api.post(`/kitchen/items/${it.id}/start`))
  const done = useKAction((it: OrderItem) => api.post(`/kitchen/items/${it.id}/done`).then(() => it), { ok: (it) => ["Đã ra món", label(it)] })
  const cancelWaiting = useKAction((v: { it: OrderItem; reason: string }) => api.post(`/order-items/${v.it.id}/cancel`, { reason: v.reason }).then(() => v), {
    ok: (v) => ["Đã hủy món", `${tableLabel(v.it.table ?? "")}, ${v.it.name}: ${v.reason}`, "bad"], onSuccess: () => setDlg(null),
  })
  const reportOut = useKAction((id: number) => api.post<{ ingredient: string; locked_menu_items: number[]; moved_items: unknown[]; suggest_supplement: boolean }>(
    "/kitchen/out-of-ingredient", { ingredient_id: id }), {
    ok: (r) => [`Đã báo hết ${r.ingredient.toLowerCase()}`, `Khóa ${r.locked_menu_items.length} món, chuyển ${r.moved_items.length} món đang chờ` +
      (r.suggest_supplement ? ". Kho còn hàng: đã báo thủ kho bàn giao bổ sung" : ""), "bad"],
    onSuccess: () => setDlg(null),
  })
  const dishOut = useKAction((v: { id: number; name: string; reason: string }) => api.post("/menu/out-of-dish", { menu_item_id: v.id, reason: v.reason }).then(() => v), {
    ok: (v) => ["Đã khóa bán món", `${v.name}: ${v.reason}`, "bad"], onSuccess: () => setDlg(null),
  })
  const resell = useKAction((m: MenuItem) => api.post(`/menu-items/${m.id}/resell`, { note: "" }).then(() => m), { ok: (m) => ["Đã mở bán lại", m.name] })
  const chefAct = useKAction(
    (v: { d: ChefDlg; userId: number; pin: string }) =>
      (v.d.chefKind === "cancel"
        ? api.post(`/order-items/${v.d.item.id}/cancel`, { reason, chef_id: v.userId, chef_pin: v.pin, used_mode: used })
        : api.post(`/kitchen/items/${v.d.item.id}/remake`, { reason, chef_id: v.userId, chef_pin: v.pin })).then(() => v.d),
    {
      quietError: true,
      ok: (d) => d.chefKind === "cancel"
        ? ["Đã hủy món", "Phần đã dùng ghi vào hao hụt", "bad"]
        : ["Đã tạo món làm lại", `${tableLabel(d.item.table ?? "")}, ${d.item.name}: ${reason}`],
      onSuccess: () => setDlg(null),
    },
  )

  // Phiếu mới tới sau lần tải đầu: nháy viền ba lần, chuông báo và thông báo "Có món mới".
  const seen = useRef<Set<number> | null>(null)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!items.data) return
    if (seen.current === null) { seen.current = new Set(items.data.map((i) => i.id)); return }
    const nu = items.data.filter((i) => !seen.current!.has(i.id))
    nu.forEach((i) => seen.current!.add(i.id))
    const arrivals = nu.filter((i) => i.status === "waiting")
    if (!arrivals.length) return
    setFresh(new Set(arrivals.map((i) => i.id)))
    const orders = arrivals.filter((i) => !i.remake_of_id)
    if (orders.length) {
      chime("new")
      kToast(orders.length > 1 ? `Có ${orders.length} món mới` : "Có món mới", orders.slice(0, 2).map(label).join("; "), "new")
    }
    const t = window.setTimeout(() => setFresh(new Set()), 3800)
    return () => window.clearTimeout(t)
  }, [items.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const boardRef = useRef<HTMLDivElement>(null)
  useFlip(boardRef, !!items.data)

  const list = items.data ?? []
  const byTime = (k: "confirmed_at" | "started_at") => (a: OrderItem, b: OrderItem) => (a[k] ?? "").localeCompare(b[k] ?? "")
  const waiting = list.filter((i) => i.status === "waiting").sort(byTime("confirmed_at"))
  const cooking = list.filter((i) => i.status === "cooking").sort(byTime("started_at"))
  const out = list.filter((i) => i.status === "out_of_stock")
  const finished = list.filter((i) => i.status === "done").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")).slice(0, 6)
  const locked = (menu.data ?? []).filter((m) => m.locked)
  const minsOf = (it: OrderItem) => minutesSince(it.status === "cooking" ? it.started_at : it.confirmed_at, now)
  const lateCount = [...waiting, ...cooking].filter((i) => minsOf(i) > LATE_MIN).length
  const showHo = isChef && work.handoversToSign > 0
  const showWaste = isChef && work.wasteToApprove > 0

  const card = (it: OrderItem, colBg: string) => {
    const mins = minsOf(it)
    const tone = mins > LATE_MIN ? "bad" : mins > LATE_MIN / 2 ? "warn" : "ok"
    const late = tone === "bad"
    const isCooking = it.status === "cooking"
    const T = { bad: ["#ffffff", K.badText, "#ffffff"], warn: ["#fef3c7", "#713f12", "#fcd34d"], ok: ["#ffffff", K.ink, "#ffffff"] }[tone]
    const TIcon = late ? AlertTriangle : Clock
    return (
      <article key={it.id} data-flip={it.id}
        className={cn("relative overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(28,25,23,.06),0_6px_16px_-8px_rgba(28,25,23,.14)]", late && "k-late", fresh.has(it.id) && "k-fresh")}
        style={{ outline: late ? `3px solid ${K.bad}` : undefined, outlineOffset: -3 }}>
        <header className="flex items-center justify-between gap-2.5 px-4 py-3 transition-colors duration-500" style={{ background: late ? K.bad : isCooking ? K.fire : K.wait }}>
          <span className="font-display text-[26px] leading-none font-extrabold whitespace-nowrap text-white">{tableLabel(it.table ?? "")}</span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-base font-extrabold whitespace-nowrap tabular"
            style={{ background: T[0], color: T[1], borderColor: T[2] }}>
            <TIcon weight={late ? "fill" : "duotone"} className="size-[19px]" aria-hidden />{mins} phút{late ? ", trễ" : ""}
          </span>
        </header>
        {/* Đường đục lỗ của phiếu bếp: nét đứt + hai khoét tròn cùng màu cột */}
        <div aria-hidden className="relative h-0 border-t-2 border-dashed border-[#bdb4a7]">
          <span className="absolute -top-[11px] -left-[11px] size-[22px] rounded-full" style={{ background: colBg }} />
          <span className="absolute -top-[11px] -right-[11px] size-[22px] rounded-full" style={{ background: colBg }} />
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3.5">
            <Photo code={codeById[it.menu_item_id]} size={64} className="rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="text-[22px] leading-tight font-extrabold">{it.name}</div>
              <div className="mt-0.5 text-[15px] text-[#3d3833]">{it.order_code}{it.remake_of_id ? ", làm lại" : ""}</div>
            </div>
            <span aria-label={`Số lượng ${it.qty}`} className="min-w-[60px] shrink-0 rounded-[14px] bg-[#141210] px-3 py-1 text-center font-display text-[30px] leading-[1.15] font-extrabold text-white">×{it.qty}</span>
          </div>
          {it.note && (
            <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-[#fef3c7] px-3.5 py-2 text-lg font-bold text-[#713f12]">
              <NotePencil className="size-[22px] shrink-0" aria-hidden /><span className="sr-only">Ghi chú: </span>{it.note}
            </div>
          )}
          {it.status === "waiting" && (
            <div className="mt-3.5 flex gap-2.5">
              <button type="button" disabled={start.isPending} onClick={() => start.mutate(it)}
                className="flex h-16 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-[#c2410c] text-xl font-extrabold whitespace-nowrap text-white shadow-[inset_0_-4px_0_rgba(28,25,23,.14)] transition-[filter] hover:brightness-110 active:scale-[.97] disabled:opacity-60">
                <Play weight="fill" className="size-[22px]" aria-hidden />Bắt đầu nấu
              </button>
              <button type="button" aria-label={`Hủy ${it.name}`} onClick={() => open({ kind: "cancelWait", item: it })}
                className="flex h-16 w-[88px] items-center justify-center gap-1.5 rounded-2xl border-2 border-[#cdc5ba] bg-white text-[17px] font-bold hover:border-[#141210] active:scale-[.96]">
                <X className="size-5" aria-hidden />Hủy
              </button>
            </div>
          )}
          {isCooking && (
            <>
              <button type="button" disabled={done.isPending} onClick={() => done.mutate(it)}
                className="mt-3.5 flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#15803d] text-xl font-extrabold whitespace-nowrap text-white shadow-[inset_0_-4px_0_rgba(0,0,0,.2)] transition-[filter] hover:brightness-110 active:scale-[.97] disabled:opacity-60">
                <CheckCircle2 weight="fill" className="size-6" aria-hidden />Xong, ra món
              </button>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => open({ kind: "chef", chefKind: "remake", item: it })}
                  className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border-2 border-[#cdc5ba] bg-white text-[17px] font-bold hover:border-[#141210] active:scale-[.96]">
                  <RotateCcw className="size-5" aria-hidden />Làm lại
                </button>
                <button type="button" aria-label={`Hủy ${it.name} đang nấu`} onClick={() => open({ kind: "chef", chefKind: "cancel", item: it })}
                  className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border-2 border-[#cdc5ba] bg-white text-[17px] font-bold hover:border-[#141210] active:scale-[.96]">
                  <Ban className="size-5" aria-hidden />Hủy
                </button>
              </div>
            </>
          )}
        </div>
      </article>
    )
  }

  const cols: { title: string; icon: IconType; color: string; bg: string; list: OrderItem[]; empty: string }[] = [
    { title: "Chờ nấu", icon: CircleDashed, color: K.wait, bg: "#e6edfb", list: waiting, empty: "Không có món chờ. Món mới từ phục vụ sẽ hiện ở đây ngay." },
    { title: "Đang nấu", icon: Flame, color: K.fire, bg: "#fbeadf", list: cooking, empty: "Chưa có món đang nấu" },
  ]

  /** Hộp thoại theo loại (gọi như hàm, không phải component con, để ô nhập không bị dựng lại khi gõ). */
  const dialog = (d: Dlg) => {
    if (d.kind === "cancelWait") {
      return (
        <KDialog open onClose={() => setDlg(null)} icon={XCircle} tone="bad" title={`Hủy ${d.item.name} (${tableLabel(d.item.table ?? "")})?`} desc="Món chưa nấu nên không trừ kho."
          footer={<KConfirm ok={!!reason.trim() && !cancelWaiting.isPending} bg={K.bad} onClick={() => cancelWaiting.mutate({ it: d.item, reason: reason.trim() })}>Hủy món</KConfirm>}>
          <ReasonPicker presets={REASONS.cancel} value={reason} onChange={setReason} />
        </KDialog>
      )
    }
    if (d.kind === "chef") {
      const isC = d.chefKind === "cancel"
      const title = `${isC ? "Hủy món đang nấu" : "Làm lại món"}: ${d.item.name}`
      const close = () => { setDlg(null); chefAct.reset() }
      if (step === "pin") {
        return (
          <KDialog open onClose={close} onBack={() => { setStep("reason"); chefAct.reset() }} icon={isC ? Ban : RotateCcw} title={title}
            desc={`${isC ? "Hủy" : "Làm lại"} ${d.item.name} (${tableLabel(d.item.table ?? "")}): ${reason}`}>
            <ChefPin error={chefAct.error} busy={chefAct.isPending} onEdit={() => { if (chefAct.error) chefAct.reset() }}
              onSubmit={(userId, pin) => chefAct.mutate({ d, userId, pin })} />
          </KDialog>
        )
      }
      return (
        <KDialog open onClose={close} icon={isC ? Ban : RotateCcw} title={title}
          desc={"Nguyên liệu đã rời tồn. " + (isC ? "Phần đã dùng chuyển thành hao hụt “khách hủy sau chế biến”." : "Món gốc chuyển thành hao hụt “làm lại”; món mới trừ kho bình thường.") +
            (isChef ? " Bạn là bếp trưởng ca: xác nhận bằng PIN của bạn." : " Cần bếp trưởng xác nhận bằng PIN.")}
          footer={<KConfirm ok={!!reason.trim()} onClick={() => setStep("pin")}>{isChef ? "Xác nhận bằng PIN của bạn" : "Bếp trưởng xác nhận"}</KConfirm>}>
          <ReasonPicker presets={REASONS[d.chefKind]} value={reason} onChange={setReason} />
          {isC && (
            <>
              <div className="mt-5 text-lg font-extrabold" id="da-dung">Lượng nguyên liệu đã dùng</div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5" role="group" aria-labelledby="da-dung">
                {([["full", "Bằng định lượng"], ["unknown", "Không xác định được"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={used === k} onClick={() => setUsed(k)}
                    className={cn("h-[60px] rounded-2xl border-2 text-lg font-bold transition-colors duration-200", pick(used === k))}>{l}</button>
                ))}
              </div>
            </>
          )}
        </KDialog>
      )
    }
    if (d.kind === "outIng") {
      const name = outCandidates.data?.find((i) => i.id === sel)?.name
      return (
        <KDialog open onClose={() => setDlg(null)} icon={Package} tone="bad" title="Báo hết nguyên liệu"
          desc="Chọn nguyên liệu Bếp đã hết. Các món dùng nó bị khóa bán, món đang chờ chuyển “Hết nguyên liệu”. Hệ thống coi tồn thực tế tại Bếp bằng 0 và tính chênh lệch ngay."
          footer={<KConfirm ok={!!sel && !reportOut.isPending} bg={K.bad} onClick={() => { if (sel) reportOut.mutate(sel) }}>{name ? `Xác nhận Bếp đã hết ${name.toLowerCase()}` : "Chọn nguyên liệu"}</KConfirm>}>
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(outCandidates.data ?? []).map((i) => (
              <button key={i.id} type="button" aria-pressed={sel === i.id} onClick={() => setSel(i.id)}
                className={cn("min-h-[68px] rounded-2xl border-2 px-3.5 py-2 text-left text-lg font-bold transition-colors duration-200 active:scale-[.96]", pick(sel === i.id))}>{i.name}</button>
            ))}
          </div>
        </KDialog>
      )
    }
    const avail = (menu.data ?? []).filter((m) => m.sellable)
    const m = avail.find((x) => x.id === sel)
    return (
      <KDialog open onClose={() => setDlg(null)} icon={Lock} title="Báo hết món (tạm ngưng bán)" desc="Chỉ khóa bán món, không tác động kho (hỏng thiết bị, quá tải…)."
        footer={<KConfirm ok={!!m && !!reason.trim() && !dishOut.isPending} bg={K.ink} onClick={() => { if (m) dishOut.mutate({ id: m.id, name: m.name, reason: reason.trim() }) }}>Khóa bán</KConfirm>}>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {avail.map((x) => (
            <button key={x.id} type="button" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}
              className={cn("flex min-h-[68px] items-center gap-3 rounded-2xl border-2 px-3.5 py-2 text-left text-lg font-bold transition-colors duration-200 active:scale-[.96]", pick(sel === x.id))}>
              <Photo code={x.code} size={48} className="rounded-xl" /><span className="flex-1">{x.name}</span>
            </button>
          ))}
        </div>
        <ReasonPicker presets={REASONS.dish} value={reason} onChange={setReason} />
      </KDialog>
    )
  }

  return (
    <div ref={boardRef}>
      <div data-stagger className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-[36px] leading-tight font-extrabold">Danh sách món</h1>
          <p className="mt-1.5 text-[17px] text-[#3d3833]">Bấm <b className="text-[#141210]">Bắt đầu nấu</b> khi lấy nguyên liệu (kho trừ lúc này), bấm <b className="text-[#141210]">Xong</b> khi ra món.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button type="button" onClick={() => open({ kind: "outDish" })}
            className="flex h-[60px] items-center gap-2.5 rounded-2xl border-2 border-[#bdb4a7] bg-white px-[22px] text-lg font-bold whitespace-nowrap transition-colors hover:border-[#141210] active:scale-[.97]">
            <Lock className="size-[26px]" aria-hidden />Báo hết món
          </button>
          <button type="button" onClick={() => open({ kind: "outIng" })}
            className="flex h-[60px] items-center gap-2.5 rounded-2xl bg-[#b91c1c] px-[22px] text-[19px] font-bold whitespace-nowrap text-white transition-[filter] hover:brightness-110 active:scale-[.97]">
            <Package className="size-[26px]" aria-hidden />Báo hết nguyên liệu
          </button>
        </div>
      </div>

      {/* Việc riêng của bếp trưởng ca: ký bàn giao, duyệt hao hụt */}
      {(showHo || showWaste) && (
        <div data-stagger className="mt-5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
          {showHo && (
            <ChefCall tone="warn" icon={PenNib} to="/van-hanh/nhan-ban-giao" action="Mở để ký"
              title={`${work.handoversToSign} phiếu bàn giao đang chờ bạn cân lại và ký`} sub="Hàng chỉ chuyển sang Bếp sau khi bạn ký nhận bằng PIN." />
          )}
          {showWaste && (
            <ChefCall tone="plain" icon={SealCheck} to="/van-hanh/hao-hut" action="Xem phiếu"
              title={`${work.wasteToApprove} phiếu hao hụt chờ bạn duyệt`} sub="Phiếu trong hạn mức do người khác ghi." />
          )}
        </div>
      )}

      {(lateCount > 0 || locked.length > 0) && (
        <div data-stagger className="mt-5 flex flex-wrap items-center gap-2.5">
          {lateCount > 0 && (
            <div className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[#b91c1c] pr-[18px] pl-2 text-[19px] font-bold whitespace-nowrap text-white">
              <span className="k-blink flex size-[34px] items-center justify-center rounded-full bg-white/20"><AlertTriangle weight="fill" className="size-5" aria-hidden /></span>
              {lateCount} món chờ quá {LATE_MIN} phút
            </div>
          )}
          {locked.length > 0 && (
            <>
              <span className="ml-1.5 inline-flex items-center gap-1.5 text-[17px] font-bold text-[#3d3833]"><Lock className="size-[22px] text-[#b91c1c]" aria-hidden />Đang khóa bán:</span>
              {locked.map((m) => {
                const canResell = has("head_chef", "manager")
                return (
                  <span key={m.id} className={cn("inline-flex min-h-12 items-center gap-2 rounded-full border border-[#cdc5ba] bg-white py-1 pl-1.5 text-[17px] font-bold whitespace-nowrap", canResell ? "pr-1" : "pr-3.5")}>
                    <Photo code={m.code} size={36} gray className="rounded-full" />
                    <span>{m.name}</span>
                    <span className="font-medium text-[#3d3833]">{m.locks[0]?.reason}</span>
                    {canResell && (
                      <button type="button" onClick={() => resell.mutate(m)} aria-label={`Mở bán lại ${m.name}`}
                        className="ml-1 inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-[#141210] bg-white px-3.5 text-[15px] font-extrabold transition-colors duration-200 hover:bg-[#141210] hover:text-white active:scale-95">
                        <Unlock className="size-[18px]" aria-hidden />Bán lại
                      </button>
                    )}
                  </span>
                )
              })}
            </>
          )}
        </div>
      )}

      {items.isLoading ? <div className="mt-6"><Loading /></div> : (
        <div className="mt-[22px] grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cols.map((c) => (
            <section key={c.title} aria-label={c.title} className="rounded-[26px] p-4 transition-colors duration-500 xl:min-h-[560px]" style={{ background: c.bg }}>
              <h2 className="mx-1.5 mt-1 mb-4 flex items-center gap-2.5 text-[22px] font-extrabold">
                <c.icon className="size-7" style={{ color: c.color }} aria-hidden /><span className="flex-1">{c.title}</span>
                <span className="flex h-[38px] min-w-[38px] items-center justify-center rounded-full px-3 text-[19px] font-extrabold text-white tabular" style={{ background: c.color }}>{c.list.length}</span>
              </h2>
              <div className="flex flex-col gap-3.5">
                {c.list.length ? c.list.map((it) => card(it, c.bg)) : (
                  <div className="rounded-[20px] border-2 border-dashed border-[#b9b0a3] px-5 py-10 text-center text-[17px] leading-normal text-[#3d3833]">{c.empty}</div>
                )}
              </div>
            </section>
          ))}

          <section aria-label="Vừa ra món" className="rounded-[26px] bg-[#e3f1e7] p-4 md:col-span-2 xl:col-span-1 xl:min-h-[560px]">
            <h2 className="mx-1.5 mt-1 mb-4 flex items-center gap-2.5 text-[22px] font-extrabold">
              <CheckCircle2 className="size-7 text-[#15803d]" aria-hidden /><span className="flex-1">Vừa ra món</span>
              <span className="text-[15px] font-semibold text-[#3d3833]">30 phút qua</span>
            </h2>
            <div className="flex flex-col gap-2.5">
              {!finished.length && <div className="rounded-[20px] border-2 border-dashed border-[#b9b0a3] px-5 py-10 text-center text-[17px] text-[#3d3833]">Chưa có món ra</div>}
              {finished.map((it) => {
                const m = minutesSince(it.done_at, now)
                return (
                  <div key={it.id} data-flip={it.id} className="flex items-center gap-3 rounded-[18px] bg-white py-2.5 pr-3.5 pl-2.5">
                    <Photo code={codeById[it.menu_item_id]} size={48} className="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="text-lg leading-tight font-extrabold">{it.name} ×{it.qty}</div>
                      <div className="text-[15px] text-[#3d3833]">{tableLabel(it.table ?? "")}, {m < 1 ? "vừa xong" : `xong ${m} phút trước`}</div>
                    </div>
                    {/* Phục vụ bấm "Đã bưng" thì có dấu tích; chưa bưng quá 5 phút thì cảnh báo để bếp nhắc phục vụ. */}
                    {it.served_at ? (
                      <span className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-[#14532d]"><CheckCircle2 weight="fill" className="size-7 text-[#15803d]" aria-hidden />Đã bưng</span>
                    ) : (
                      <span className={cn("flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[15px] font-bold whitespace-nowrap",
                        m >= SERVE_WARN_MIN ? "bg-[#fee2e2] text-[#7f1d1d]" : "bg-[#fef3c7] text-[#713f12]")}>
                        {m >= SERVE_WARN_MIN ? <AlertTriangle weight="fill" className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}Chờ bưng
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {out.length > 0 && (
              <>
                <h3 className="mx-1.5 mt-6 mb-2.5 flex items-center gap-2 text-[17px] font-extrabold text-[#991b1b]"><Package className="size-[22px]" aria-hidden />Hết nguyên liệu, chờ báo khách</h3>
                <div className="flex flex-col gap-2.5">
                  {out.map((it) => (
                    <div key={it.id} data-flip={it.id} className="flex items-center gap-3 rounded-[18px] bg-[#fee2e2] py-2.5 pr-3.5 pl-2.5">
                      <Photo code={codeById[it.menu_item_id]} size={48} gray className="rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="text-lg leading-tight font-extrabold">{it.name} ×{it.qty}</div>
                        <div className="text-[15px] font-bold text-[#7f1d1d]">{tableLabel(it.table ?? "")}{it.end_reason ? `, ${it.end_reason}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {dlg && dialog(dlg)}
    </div>
  )
}

/** Thẻ việc của bếp trưởng: vàng viền vàng (ký bàn giao, nút than) hoặc trắng viền đá (duyệt hao hụt, nút viền). */
function ChefCall({ tone, icon: Icon, title, sub, to, action }: { tone: "warn" | "plain"; icon: IconType; title: ReactNode; sub: string; to: string; action: string }) {
  const warn = tone === "warn"
  return (
    <div className={cn("flex items-center gap-4 rounded-[22px] border-2 py-3.5 pr-3.5 pl-4", warn ? "border-[#fcd34d] bg-[#fef3c7]" : "border-[#cdc5ba] bg-white")}>
      <span className={cn("flex size-[52px] shrink-0 items-center justify-center rounded-2xl", warn ? "bg-white text-[#713f12]" : "bg-[#f5f4f1] text-[#141210]")}>
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[19px] leading-tight font-extrabold">{title}</div>
        <div className={cn("mt-0.5 text-[15px]", warn ? "text-[#713f12]" : "text-[#3d3833]")}>{sub}</div>
      </div>
      <Link to={to} className={cn("inline-flex h-14 shrink-0 items-center rounded-2xl px-5 text-[17px] font-extrabold whitespace-nowrap active:scale-[.97]",
        warn ? "bg-[#141210] text-white hover:bg-[#2a2622]" : "border-2 border-[#141210] bg-white text-[#141210] hover:bg-[#141210] hover:text-white")}>{action}</Link>
    </div>
  )
}
