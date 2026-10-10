/**
 * Khung của nhân viên bếp / bếp trưởng theo thiết kế "Nhan vien Bep v3" (Claude Design):
 * thanh bên trắng (logo, tab lớn có số việc, đồng hồ to, ca hiện tại, người dùng, âm báo, đổi người),
 * thông báo nền than góc phải dưới có thanh thời gian, âm báo món mới, bàn phím số và chuyển động FLIP của phiếu.
 */
import { useQuery } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type HTMLAttributes, type ReactNode, type RefObject } from "react"
import { NavLink, useNavigate } from "react-router-dom"

import {
  AlertTriangle, BellRing, CheckCircle2, ChefHat, Delete, LayoutDashboard, Moon, Sun, SunHorizon, UserSwitch, Volume2, VolumeX, type IconType,
} from "@/components/icons"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { api, ApiError } from "@/lib/api"
import { PIN_LEN, useAuth } from "@/lib/auth"
import { fitZoom } from "@/lib/fitZoom"
import { chime, useSound } from "@/lib/sound"
import { useServerNow } from "@/lib/clock"
import { time } from "@/lib/format"
import type { StaffUser } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Bảng màu của thiết kế (chữ phụ #3d3833 trên nền đá đạt 10 : 1; chữ đỏ nhỏ dùng #991b1b để đạt 7 : 1). */
export const K = {
  page: "#f5f4f1",
  ink: "#141210",
  line: "#cdc5ba",
  sub: "#3d3833",
  fire: "#c2410c",
  fireSoft: "#ffedd5",
  fireInk: "#9a3412",
  wait: "#1d4ed8",
  ok: "#15803d",
  bad: "#b91c1c",
  badText: "#991b1b",
}

/** Gắn lớp "kitchen" lên <html> khi đang ở màn bếp (áp cả cho hộp thoại, thông báo). */
export function useKitchenTheme(on: boolean) {
  useEffect(() => {
    if (!on) return
    document.documentElement.classList.add("kitchen")
    return () => document.documentElement.classList.remove("kitchen")
  }, [on])
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

export { chime }

/* ---------- Thông báo ---------- */

export type ToastTone = "new" | "ok" | "bad"
interface KToast { id: number; title: string; sub: string; tone: ToastTone }
let toasts: KToast[] = []
let toastSeq = 0
const toastSubs = new Set<() => void>()
const emitToasts = () => toastSubs.forEach((f) => f())
const subToasts = (cb: () => void) => { toastSubs.add(cb); return () => { toastSubs.delete(cb) } }

/** Thông báo của màn bếp: tối đa 3 cái, tự tắt sau 5,2 giây. */
export function kToast(title: string, sub: string, tone: ToastTone = "ok") {
  const id = ++toastSeq
  toasts = [...toasts.slice(-2), { id, title, sub, tone }]
  emitToasts()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emitToasts()
  }, 5300)
}

const TOAST_TONE: Record<ToastTone, { bg: string; icon: IconType }> = {
  new: { bg: "#fb923c", icon: BellRing },
  ok: { bg: "#7fd3a0", icon: CheckCircle2 },
  bad: { bg: "#f19a8e", icon: AlertTriangle },
}

export function KitchenToasts() {
  const list = useSyncExternalStore(subToasts, () => toasts)
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-6 bottom-6 z-[60] flex flex-col items-end gap-3">
      {list.map((t) => {
        const tone = TOAST_TONE[t.tone]
        return (
          <div key={t.id} className="k-toast relative flex w-[min(420px,calc(100vw-48px))] items-center gap-3.5 overflow-hidden rounded-[20px] bg-[#141210] px-[18px] pt-4 pb-5 text-white shadow-[0_24px_50px_-16px_rgba(0,0,0,.5)]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-[#141210]" style={{ background: tone.bg }}>
              <tone.icon weight="fill" className="size-[26px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-[19px] font-extrabold">{t.title}</div>
              <div className="mt-0.5 text-base text-[#e2dcd2]">{t.sub}</div>
            </div>
            <span aria-hidden className="k-toast-bar absolute bottom-0 left-0 h-[5px] w-full origin-left" style={{ background: tone.bg }} />
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Chuyển động FLIP ---------- */

/**
 * Phiếu đổi chỗ (Chờ nấu sang Đang nấu, sang Vừa ra món) thì trượt từ vị trí cũ tới vị trí mới;
 * đi xa thì nhấc lên theo đường cong. Lần đầu có dữ liệu: các khối [data-stagger] / [data-flip] hiện lần lượt.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, ready: boolean) {
  const prev = useRef<Map<string, { x: number; y: number }> | null>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !ready) return
    const motion = !reduceMotion()
    // Toạ độ đổi về px CSS (trang đang co giãn theo fitZoom) để transform dịch đúng quãng đường.
    const z = fitZoom()
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-flip]"))
    const next = new Map<string, { x: number; y: number }>()
    for (const el of els) {
      const r = el.getBoundingClientRect()
      // Bỏ phần dịch chuyển của animation đang chạy để lấy đúng vị trí bố cục.
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform)
      next.set(el.dataset.flip!, { x: r.left / z - m.m41 + window.scrollX / z, y: r.top / z - m.m42 + window.scrollY / z })
    }
    const old = prev.current
    prev.current = next
    if (!motion) return
    if (!old) {
      root.querySelectorAll<HTMLElement>("[data-stagger],[data-flip]").forEach((el, i) =>
        el.animate([{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }],
          { duration: 560, delay: 60 + Math.min(i, 14) * 50, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }))
      return
    }
    for (const el of els) {
      const o = old.get(el.dataset.flip!), n = next.get(el.dataset.flip!)!
      if (!o) {
        el.animate([{ opacity: 0, transform: "translateY(-20px) scale(.95)" }, { opacity: 1, transform: "none" }], { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" })
        continue
      }
      const dx = o.x - n.x, dy = o.y - n.y
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue
      const far = Math.abs(dx) > 40
      el.animate(far
        ? [
          { transform: `translate(${dx}px,${dy}px)`, zIndex: 5 },
          { transform: `translate(${dx * 0.4}px,${dy * 0.4 - 24}px) scale(1.03) rotate(${dx > 0 ? -1.5 : 1.5}deg)`, zIndex: 5, offset: 0.45 },
          { transform: "none", zIndex: 5 },
        ]
        : [{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }],
      { duration: far ? 720 : 480, easing: "cubic-bezier(.2,.8,.2,1)" })
    }
  })
}

/** Lắc ngang một lần (sai PIN). */
export function shake(el: HTMLElement | null) {
  chime("bad")
  if (!el || reduceMotion()) return
  el.animate([0, -14, 12, -8, 6, -3, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 460, easing: "ease-out" })
}

/* ---------- Thành phần dùng chung ---------- */

/** Lựa chọn kiểu thiết kế: đang chọn nền than chữ trắng, chưa chọn nền trắng viền đá. */
export const pick = (sel: boolean) =>
  sel ? "border-[#141210] bg-[#141210] text-white" : "border-[#cdc5ba] bg-white text-[#141210] hover:border-[#141210]"

/** Số bước tròn: xong thì xanh có dấu tích. */
export function StepDot({ n, done }: { n: number; done: boolean }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white transition-colors duration-300"
      style={{ background: done ? K.ok : K.ink }} aria-label={done ? `Bước ${n} đã xong` : `Bước ${n}`}>
      {done ? "✓" : n}
    </span>
  )
}

/** Bàn phím số 3 cột của thiết kế: 1-9, phím trái (Xóa hoặc dấu phẩy), 0, xóa lùi. */
export function KeyPad({ onKey, left, size = "md" }: { onKey: (k: string) => void; left: "clear" | ","; size?: "md" | "lg" }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", left, "0", "back"]
  return (
    <div className={cn("grid grid-cols-3", size === "lg" ? "gap-3" : "gap-2")}>
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)}
          aria-label={k === "back" ? "Xóa một số" : k === "clear" ? "Xóa hết" : k === "," ? "Dấu thập phân" : k}
          className={cn(
            "flex select-none items-center justify-center border-2 border-[#cdc5ba] bg-white font-display font-bold text-[#141210] transition-[transform,background-color,border-color] duration-150 hover:border-[#141210] active:scale-[.93] active:bg-[#e9e6e1]",
            size === "lg" ? "h-[76px] rounded-[20px] text-[32px]" : "h-[60px] rounded-[14px] text-[26px]",
            k === "clear" && (size === "lg" ? "text-xl" : "text-lg"),
          )}>
          {k === "back" ? <Delete className={size === "lg" ? "size-[34px]" : "size-7"} /> : k === "clear" ? "Xóa" : k}
        </button>
      ))}
    </div>
  )
}

export function PinDots({ n, max = PIN_LEN }: { n: number; max?: number }) {
  return (
    <div role="status" aria-label={`Đã nhập ${n} số PIN`} className="flex h-8 items-center justify-center gap-[18px]">
      {Array.from({ length: Math.max(max, n) }).map((_, i) => (
        <span key={i} className="size-[22px] rounded-full border-[3px] transition-all duration-200 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)]"
          style={{ borderColor: i < n ? K.ink : "#a9a094", background: i < n ? K.ink : "transparent", transform: `scale(${i < n ? 1.15 : 1})` }} />
      ))}
    </div>
  )
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

/* ---------- Thanh bên ---------- */

const DAYS: Record<string, string> = { Sun: "Chủ nhật", Mon: "Thứ Hai", Tue: "Thứ Ba", Wed: "Thứ Tư", Thu: "Thứ Năm", Fri: "Thứ Sáu", Sat: "Thứ Bảy" }
const CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })

function RailClock() {
  const now = useServerNow(10_000)
  const p = Object.fromEntries(CLOCK.formatToParts(now).map((x) => [x.type, x.value]))
  return (
    <>
      <div className="font-display text-[32px] leading-none font-extrabold tabular lg:text-[44px]">{p.hour === "24" ? "00" : p.hour}:{p.minute}</div>
      <div className="mt-1.5 hidden text-base text-[#3d3833] lg:block">{DAYS[p.weekday]}, {p.day}/{p.month}</div>
    </>
  )
}

function ShiftTag() {
  const { me } = useAuth()
  const s = me?.shift
  if (!s) return <span className="mt-2.5 inline-flex rounded-full bg-[#e9e6e1] px-3 py-1 text-[15px] font-bold text-[#3d3833]">Ngoài giờ ca</span>
  const h = Number(time(s.planned_start).slice(0, 2))
  const Icon = h < 11 ? Sun : h < 17 ? SunHorizon : Moon
  const state = s.status === "open" ? null : s.status === "closed" ? "Đã cân trả" : "Chưa nhận bàn giao"
  return (
    <>
      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-3 py-1 text-[15px] font-bold whitespace-nowrap text-[#713f12]">
        <Icon className="size-[18px] shrink-0" aria-hidden />{s.name} {time(s.planned_start)}-{time(s.planned_end)}
      </div>
      {state && <div className="mt-1.5 text-[15px] font-semibold text-[#3d3833]">{state}</div>}
    </>
  )
}

export interface RailTab { to: string; label: string; icon: IconType; count?: number }

/** Huy hiệu "Bếp trưởng ca" (chữ trắng trên cam đậm 7,3 : 1). */
export function ChefBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-[26px] items-center gap-1 rounded-full bg-[#9a3412] px-2.5 text-sm font-extrabold whitespace-nowrap text-white", className)}>
      <ChefHat weight="fill" className="size-4" aria-hidden />Bếp trưởng ca
    </span>
  )
}

export function KitchenRail({ tabs }: { tabs: RailTab[] }) {
  const { me, logout, has } = useAuth()
  const nav = useNavigate()
  const sound = useSound()
  if (!me) return null
  const chef = me.roles.includes("head_chef")
  const otherRoles = me.role_labels.filter((_, i) => me.roles[i] !== "head_chef")
  return (
    <aside className="sticky top-0 flex h-svh w-[92px] shrink-0 flex-col gap-7 overflow-y-auto border-r border-[#cdc5ba] bg-white px-3 py-6 lg:w-[264px] lg:px-4">
      <div className="flex items-center gap-3 px-1.5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#c2410c] text-white"><ChefHat className="size-7" aria-hidden /></div>
        <div className="hidden font-display text-[21px] leading-tight font-extrabold whitespace-nowrap lg:block">Quản lý bếp</div>
      </div>
      <nav aria-label="Chức năng" className="flex flex-col gap-1.5">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} aria-label={t.count ? `${t.label}, ${t.count} việc đang chờ` : t.label}
            className={({ isActive }) => cn(
              "group flex h-[60px] items-center justify-center gap-[18px] rounded-2xl px-3.5 text-[19px] font-bold transition-colors duration-300 active:scale-[.97] lg:justify-start",
              isActive ? "is-on bg-[#141210] text-white" : "text-[#141210] hover:bg-[#f5f4f1]",
            )}>
            {/* Số việc chờ gắn ở góc icon, viền trùng màu nền tab để tách khỏi icon; số đổi thì nảy lên. */}
            <span className="relative flex shrink-0">
              <t.icon className="size-7" aria-hidden />
              {!!t.count && (
                <span key={t.count} aria-hidden
                  className="k-pop absolute -top-[9px] -right-[11px] flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[#9a3412] px-[7px] text-[15px] leading-none font-extrabold text-white tabular shadow-[0_0_0_3px_#ffffff] group-hover:shadow-[0_0_0_3px_#f5f4f1] group-[.is-on]:shadow-[0_0_0_3px_#141210]">
                  {t.count}
                </span>
              )}
            </span>
            <span className="hidden min-w-0 flex-1 truncate lg:block">{t.label}</span>
          </NavLink>
        ))}
        {has("manager") && (
          <NavLink to="/quan-ly" aria-label="Màn quản lý" className="flex h-[52px] items-center justify-center gap-3 rounded-2xl px-3.5 text-[17px] font-bold text-[#9a3412] underline underline-offset-4 hover:bg-[#f5f4f1] lg:justify-start">
            <LayoutDashboard className="size-6 shrink-0" aria-hidden /><span className="hidden lg:block">Màn quản lý</span>
          </NavLink>
        )}
      </nav>
      <div className="flex-1" />
      <div className="px-1.5 text-center lg:text-left">
        <RailClock />
        <div className="hidden lg:block"><ShiftTag /></div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#cdc5ba] pt-5">
        <div className="flex items-center justify-center gap-3 px-1.5 lg:justify-start">
          <span aria-hidden className={cn("flex size-12 shrink-0 items-center justify-center rounded-full font-display text-[19px] font-extrabold",
            chef ? "bg-[#c2410c] text-white" : "bg-[#ffedd5] text-[#9a3412]")}>{initials(me.full_name)}</span>
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-lg leading-tight font-bold">{me.full_name}</div>
            {chef ? (
              <div className="mt-1 flex flex-col items-start gap-[3px]">
                <ChefBadge />
                {otherRoles.length > 0 && <span className="text-sm whitespace-nowrap text-[#3d3833]">{otherRoles.join(", ")}</span>}
              </div>
            ) : <div className="truncate text-[15px] leading-snug text-[#3d3833]">{me.role_labels.join(", ")}</div>}
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <button type="button" onClick={sound.toggle} aria-pressed={sound.on} aria-label={sound.on ? "Âm báo đang bật" : "Âm báo đang tắt"} title={sound.on ? "Âm báo đang bật" : "Âm báo đang tắt"}
            className={cn("flex size-14 shrink-0 items-center justify-center self-center rounded-[14px] border-[1.5px] border-[#cdc5ba] text-[#141210] transition-colors duration-300 active:scale-95", sound.on ? "bg-white" : "bg-[#e9e6e1]")}>
            {sound.on ? <Volume2 className="size-[26px]" aria-hidden /> : <VolumeX className="size-[26px]" aria-hidden />}
          </button>
          <button type="button" aria-label="Đổi người" onClick={async () => { await logout(); nav("/dang-nhap") }}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#cdc5ba] bg-white text-[17px] font-bold whitespace-nowrap text-[#141210] hover:border-[#141210] active:scale-[.97]">
            <UserSwitch className="size-6" aria-hidden /><span className="hidden lg:inline">Đổi người</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

/** Khối trắng bo 26px của thiết kế. */
export function Panel({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[26px] bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,.06)]", className)} {...rest}>{children}</section>
}

/* ---------- Hộp thoại và PIN bếp trưởng ---------- */

/** Khung hộp thoại của màn bếp: ô icon màu, tiêu đề lớn, mô tả, nội dung, hàng nút (Quay lại + nút xác nhận). */
export function KDialog({ open, onClose, onBack, icon: Icon, tone = "fire", title, desc, children, footer }: {
  open: boolean
  onClose: () => void
  /** Nút Quay lại làm gì (mặc định: đóng hộp thoại). */
  onBack?: () => void
  icon: IconType
  tone?: "fire" | "bad"
  title: string
  desc: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent showCloseButton={false}
        className="max-h-[calc(100svh-40px)] max-w-[calc(100%-32px)] gap-0 overflow-y-auto rounded-[28px] bg-white p-6 text-[#141210] shadow-[0_40px_90px_-20px_rgba(0,0,0,.45)] sm:max-w-[720px] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[18px]"
            style={tone === "bad" ? { background: "#fee2e2", color: K.bad } : { background: K.fireSoft, color: K.fireInk }}>
            <Icon className="size-8" aria-hidden />
          </span>
          <div>
            <DialogTitle className="font-display text-[30px] leading-tight font-extrabold text-pretty">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-[17px] leading-normal text-pretty text-[#3d3833]">{desc}</DialogDescription>
          </div>
        </div>
        {children}
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onBack ?? onClose}
            className="h-[60px] rounded-2xl border-2 border-[#bdb4a7] bg-white px-[26px] text-lg font-bold hover:border-[#141210] active:scale-[.97]">Quay lại</button>
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Nút xác nhận của hộp thoại: màu theo hành động, xám khi chưa đủ điều kiện. */
export function KConfirm({ ok, bg = K.fire, onClick, children }: { ok: boolean; bg?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" disabled={!ok} onClick={onClick}
      className="h-[60px] rounded-2xl px-7 text-[19px] font-extrabold text-white transition-colors duration-300 active:scale-[.97] disabled:cursor-not-allowed disabled:!bg-[#e9e6e1] disabled:!text-[#3d3833]"
      style={{ background: bg }}>{children}</button>
  )
}

/** Lý do: chạm chọn lý do có sẵn hoặc gõ lý do khác. */
export function ReasonPicker({ presets, value, onChange }: { presets: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <div className="mt-6 text-lg font-extrabold" id="ly-do">Lý do</div>
      <div className="mt-2.5 flex flex-wrap gap-2.5" role="group" aria-labelledby="ly-do">
        {presets.map((r) => (
          <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}
            className={cn("h-[54px] rounded-full border-2 px-5 text-[17px] font-bold transition-colors duration-200 active:scale-[.96]", pick(value === r))}>{r}</button>
        ))}
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Hoặc nhập lý do khác" aria-label="Lý do khác"
        className="mt-3 h-14 w-full rounded-[14px] border-2 border-[#bdb4a7] bg-white px-4 text-lg text-[#141210] outline-none placeholder:text-[#6b645f] focus:border-[#141210] focus:shadow-[0_0_0_4px_rgba(235,147,96,.35)]" />
    </>
  )
}

/**
 * Bếp trưởng nhập PIN ngay trong hộp thoại. Người đang dùng máy là bếp trưởng thì xác nhận bằng PIN của chính mình;
 * nếu không, mặc định bếp trưởng của ca (có nhiều bếp trưởng thì chạm để đổi). Gõ được bằng bàn phím: số, Backspace, Enter.
 */
export function ChefPin({ error, busy, onSubmit, onEdit, label = "Xác nhận" }: {
  error: unknown
  busy: boolean
  onSubmit: (userId: number, pin: string) => void
  onEdit?: () => void
  label?: string
}) {
  const { me } = useAuth()
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api.get<StaffUser[]>("/auth/staff") })
  const chefs = (staff.data ?? []).filter((u) => u.roles.includes("head_chef"))
  const selfChef = !!me?.roles.includes("head_chef")
  const [chefId, setChefId] = useState<number | null>(null)
  const [pin, setPin] = useState("")
  const dotsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (chefId !== null || !chefs.length) return
    const prefer = [selfChef ? me?.id : undefined, me?.shift?.head_chef_id].find((id) => id && chefs.some((c) => c.id === id))
    setChefId(prefer ?? chefs[0].id)
  }, [chefs, chefId, me, selfChef])
  useEffect(() => {
    if (error) { setPin(""); shake(dotsRef.current) }
  }, [error])
  const chef = chefs.find((c) => c.id === chefId)
  const self = !!chef && chef.id === me?.id
  const submit = (p = pin) => { if (chef && p.length === PIN_LEN && !busy) onSubmit(chef.id, p) }
  const key = (k: string) => {
    onEdit?.()
    // Đủ 5 số là gửi luôn, không cần bấm thêm nút.
    const next = k === "back" ? pin.slice(0, -1) : k === "clear" ? "" : pin.length < PIN_LEN ? pin + k : pin
    setPin(next)
    if (next.length === PIN_LEN && next !== pin) submit(next)
  }
  const keyRef = useRef({ key, submit })
  keyRef.current = { key, submit }
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return
      if (/^\d$/.test(e.key)) keyRef.current.key(e.key)
      else if (e.key === "Backspace") keyRef.current.key("back")
      else if (e.key === "Enter") { e.preventDefault(); keyRef.current.submit() }
    }
    window.addEventListener("keydown", f)
    return () => window.removeEventListener("keydown", f)
  }, [])
  const msg = error instanceof ApiError ? error.message : error ? "Có lỗi xảy ra" : null
  return (
    <div className="mx-auto mt-6 max-w-[340px]">
      {chef ? (
        <div className="flex items-center justify-center gap-3.5">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-[#c2410c] font-display text-[21px] font-extrabold text-white">{initials(chef.full_name)}</span>
          <div>
            <div className="text-[21px] font-extrabold">{chef.full_name}</div>
            <div className="text-base text-[#3d3833]">{self ? "Xác nhận bằng PIN của bạn" : "Bếp trưởng ca nhập PIN"}</div>
          </div>
        </div>
      ) : staff.isLoading ? <p className="text-center text-base text-[#3d3833]">Đang tải…</p> : <p className="text-center text-base text-[#991b1b]">Chưa có tài khoản bếp trưởng</p>}
      {chefs.length > 1 && !selfChef && (
        <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Người xác nhận">
          {chefs.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === chefId} onClick={() => { setChefId(c.id); setPin(""); onEdit?.() }}
              className={cn("h-11 rounded-full border-2 px-4 text-[15px] font-bold", pick(c.id === chefId))}>{c.full_name}</button>
          ))}
        </div>
      )}
      <div ref={dotsRef} className="mt-[18px] mb-1.5"><PinDots n={pin.length} /></div>
      <div role="alert" className="min-h-[26px] text-center text-base font-bold text-[#991b1b]">{msg}</div>
      <div className="mt-1"><KeyPad onKey={key} left="clear" /></div>
      <p className="mt-3 text-center text-[15px] text-[#3d3833]">{busy ? "Đang xác nhận…" : `Nhập đủ ${PIN_LEN} số là ${label.toLowerCase()} luôn`}</p>
    </div>
  )
}
