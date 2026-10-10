/**
 * Thành phần dùng chung cho màn quản lý theo thiết kế "Quan Ly Admin" (Claude Design):
 * tiêu đề trang lớn, thẻ bo 22px, nút phân đoạn, chip lọc, nhãn mức ngưỡng, ngăn trượt phải, hộp thoại, thông báo nền than.
 * Màu chữ đều đạt 7 : 1 trên nền của nó (chữ phụ #4f4a45 trên #fdfdfc là 8 : 1).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react"

import { Check, CheckCircle2, Siren, AlertTriangle, X, type IconType } from "@/components/icons"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** Bảng màu của thiết kế. */
export const A = {
  ink: "#1c1917",
  page: "#f5f5f4",
  card: "#fdfdfc",
  sub: "#4f4a45",
  line: "#e2ded9",
  line2: "#efedeb",
  soft: "#f5f3f1",
  paprika: "#eb9360",
  paprikaInk: "#7c3410",
  paprikaSoft: "#fbeae0",
  bad: "#8f1a1a",
  badBg: "#fbe4e4",
  warn: "#6b4300",
  warnBg: "#fdf0d2",
  ok: "#004d00",
  okBg: "#e9f5e9",
  critMark: "#d03b3b",
  warnMark: "#fab219",
  short: "#e34948",
  surplus: "#2a78d6",
  surplusText: "#164b8c",
}

/** Bóng của thẻ (thay cho viền xám). */
export const CARD = "rounded-[22px] bg-[#fdfdfc] shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-10px_rgba(41,37,36,.14),0_0_0_1px_rgba(28,25,23,.05)]"
/** Thẻ bấm được: nổi lên khi rê chuột. */
export const CARD_HOVER = "transition-[transform,box-shadow] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(41,37,36,.06),0_22px_40px_-20px_rgba(41,37,36,.36),0_0_0_1px_rgba(28,25,23,.05)]"
/** Viền mảnh cho chip / nút trắng. */
export const RING = "shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.08)]"

/** Độ trễ animation cho phần tử thứ i trong danh sách (hiện lần lượt). */
export const delay = (i: number, base = 120, step = 45): CSSProperties => ({ animationDelay: `${base + Math.min(i, 14) * step}ms` })

/** Tiêu đề trang: dòng nhỏ phía trên (tuỳ chọn), tên trang 46px, mô tả, cụm bên phải (số liệu / nút). */
export function PageHead({ title, desc, kicker, right }: { title: string; desc?: ReactNode; kicker?: ReactNode; right?: ReactNode }) {
  return (
    <div className="a-rise flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {kicker && <div className="mb-2 text-sm font-bold text-[#7c3410]">{kicker}</div>}
        <h1 className="m-0 font-display text-[clamp(34px,3.2vw,46px)] leading-none font-bold tracking-[-.035em]">{title}</h1>
        {desc && <p className="mt-3 max-w-[680px] text-[15px] leading-[1.55] text-pretty text-[#4f4a45]">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

/** Số liệu lớn ở góc tiêu đề trang. */
export function HeadStat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="shrink-0">
      <div className="text-sm whitespace-nowrap text-[#4f4a45]">{label}</div>
      <div className="font-display text-[32px] font-bold tracking-[-.03em] tabular" style={{ color }}>{value}</div>
    </div>
  )
}

/** Tiêu đề khối (h2 / h3) Bricolage. */
export function BlockTitle({ children, sub, as: Tag = "h3", right }: { children: ReactNode; sub?: ReactNode; as?: "h2" | "h3"; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Tag className="m-0 font-display text-xl font-bold tracking-[-.02em]">{children}</Tag>
        {sub && <div className="mt-1 text-sm text-[#4f4a45]">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

/** Nút phân đoạn nền đá, mục đang chọn nền trắng có bóng (lọc khoảng ngày, vị trí, nhóm…). */
export function Seg<T extends string>({ options, value, onChange, label, size = "md" }: {
  options: { key: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
  size?: "sm" | "md"
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-xl bg-[#efedeb] p-1">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            className={cn("rounded-[9px] px-3.5 text-sm font-bold whitespace-nowrap transition-[background-color,box-shadow] duration-300",
              size === "sm" ? "h-9" : "h-11", on ? "bg-[#fdfdfc] shadow-[0_1px_3px_rgba(41,37,36,.18)]" : "hover:bg-white/50")}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Hai hoặc nhiều tab bằng nhau, nền than trượt sang tab đang chọn (Đang mở / Đã kết luận). */
export function SlideTabs<T extends string>({ options, value, onChange, label, width = 160 }: {
  options: { key: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
  width?: number
}) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value))
  return (
    <div role="tablist" aria-label={label} className="relative flex self-start rounded-[14px] bg-[#e9e6e3] p-1">
      <span aria-hidden className="absolute top-1 bottom-1 left-1 rounded-[10px] bg-[#1c1917] shadow-[0_4px_12px_-4px_rgba(28,25,23,.5)] transition-transform duration-[450ms] ease-[cubic-bezier(.34,1.3,.64,1)]"
        style={{ width, transform: `translateX(${idx * width}px)` }} />
      {options.map((o) => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.key)} style={{ width }}
            className={cn("relative h-[42px] text-[15px] font-bold transition-colors duration-300", on ? "text-[#fafaf9]" : "text-[#1c1917]")}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Chuyển Biểu đồ / Bảng (mỗi biểu đồ luôn có chế độ xem bảng). */
export function ViewToggle({ value, onChange }: { value: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <div role="group" aria-label="Kiểu xem" className="relative flex shrink-0 rounded-[11px] bg-[#efedeb] p-[3px]">
      <span aria-hidden className="absolute top-[3px] bottom-[3px] left-[3px] w-[76px] rounded-lg bg-[#fdfdfc] shadow-[0_1px_3px_rgba(41,37,36,.15)] transition-transform duration-[400ms] ease-[cubic-bezier(.34,1.3,.64,1)]"
        style={{ transform: value === "table" ? "translateX(76px)" : "none" }} />
      {(["chart", "table"] as const).map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className="relative h-11 w-[76px] text-sm font-semibold">
          {k === "chart" ? "Biểu đồ" : "Bảng"}
        </button>
      ))}
    </div>
  )
}

/** Chip lọc tròn có số đếm; đang chọn nền than. */
export function FilterPills<T extends string>({ items, value, onChange, label }: {
  items: { key: T; label: string; n?: number }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((f) => {
        const on = f.key === value
        return (
          <button key={f.key} type="button" aria-pressed={on} onClick={() => onChange(f.key)}
            className={cn("flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap transition-[background-color,color,transform] duration-300 active:scale-[.96]",
              on ? "bg-[#1c1917] text-[#fafaf9]" : cn("bg-[#fdfdfc] text-[#1c1917]", RING))}>
            {f.label}{f.n !== undefined && <span className="tabular opacity-85">{f.n}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Công tắc bật / tắt (Tách theo ca…). */
export function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap">
      <span className="relative h-6 w-10 rounded-full transition-colors duration-300" style={{ background: on ? A.ink : "#a8a29e" }}>
        <span className="absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left] duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)]"
          style={{ left: on ? 19 : 3 }} />
      </span>
      {children}
    </button>
  )
}

export type Tier = "ok" | "warn" | "must"
const TIER: Record<Tier, { label: string; bg: string; c: string; icon: IconType }> = {
  ok: { label: "Trong ngưỡng", bg: A.okBg, c: A.ok, icon: Check },
  warn: { label: "Cảnh báo", bg: A.warnBg, c: A.warn, icon: AlertTriangle },
  must: { label: "Phải điều tra", bg: A.badBg, c: A.bad, icon: Siren },
}
/** Nhãn mức ngưỡng: luôn có icon + chữ. */
export function TierPill({ tier, label }: { tier: Tier; label?: string }) {
  const t = TIER[tier]
  return (
    <span className="inline-flex h-7 items-center gap-[5px] rounded-full px-2.5 text-sm font-bold whitespace-nowrap" style={{ background: t.bg, color: t.c }}>
      <t.icon weight="bold" className="size-3.5" aria-hidden />{label ?? t.label}
    </span>
  )
}

/** Nhãn trạng thái tròn chung (màu chữ / nền tuỳ chọn, có thể kèm icon). */
export function Pill({ children, bg = A.line2, c = A.ink, icon: Icon, className }: { children: ReactNode; bg?: string; c?: string; icon?: IconType; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-[5px] rounded-full px-2.5 text-sm font-bold whitespace-nowrap", className)} style={{ background: bg, color: c }}>
      {Icon && <Icon weight="bold" className="size-3.5" aria-hidden />}{children}
    </span>
  )
}

/** Ô vuông nhóm kiểm soát A / C. */
export function GroupChip({ group }: { group: "A" | "C" | string }) {
  const a = group === "A"
  return (
    <span aria-label={`Nhóm ${group}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded-[7px] text-sm font-extrabold"
      style={{ background: a ? A.paprikaSoft : A.line2, color: a ? A.paprikaInk : A.sub }}>{group}</span>
  )
}

/** Mã phiếu / mã chứng từ: chữ đơn cách. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-sm font-semibold", className)}>{children}</span>
}

/** Ảnh đại diện chữ cái. */
export function Initials({ name, size = 30, dark }: { name: string; size?: number; dark?: boolean }) {
  const p = name.trim().split(/\s+/)
  const ini = (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase()
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size < 36 ? 12 : 14, background: dark ? A.paprikaSoft : "#f2f0ee", color: dark ? A.paprikaInk : A.ink }}>{ini}</span>
  )
}

/** Ô trống của danh sách: icon xanh + chữ. */
export function EmptyNote({ children, icon: Icon = CheckCircle2 }: { children: ReactNode; icon?: IconType }) {
  return (
    <div className="a-fade px-6 py-12 text-center text-[15px] text-[#4f4a45]">
      <Icon className="mx-auto mb-2.5 block size-9 text-[#004d00]" aria-hidden />{children}
    </div>
  )
}

/** Hàng tiêu đề và dòng của bảng dạng lưới (truyền gridTemplateColumns qua style). */
export const GRID_HEAD = "grid gap-4 border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]"
export const GRID_ROW = "grid min-h-[64px] w-full items-center gap-4 border-b border-[#efedeb] px-6 py-3.5 text-left text-sm tabular transition-colors duration-200 hover:bg-[#f7f4f1]"

/** Ngăn trượt từ phải (chi tiết phiếu). Dùng Dialog của Radix để giữ focus và đóng bằng Esc. */
export function Drawer({ open, onClose, title, desc, head, children, footer, width = 580 }: {
  open: boolean
  onClose: () => void
  title: string
  desc?: string
  head?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}
        className="!top-0 !right-0 !left-auto flex h-full max-h-none !w-[min(var(--dw),100vw)] !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 rounded-none bg-[#fdfdfc] p-0 text-[#1c1917] shadow-[-30px_0_60px_-30px_rgba(28,25,23,.45)] ring-0 data-open:slide-in-from-right data-closed:slide-out-to-right data-open:zoom-in-100 data-closed:zoom-out-100 sm:!max-w-none"
        style={{ "--dw": `${width}px` } as CSSProperties}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {desc && <DialogDescription className="sr-only">{desc}</DialogDescription>}
        <div className="flex items-center justify-between gap-3 border-b border-[#efedeb] py-4 pr-5 pl-7">
          <div className="flex min-w-0 items-center gap-2.5">{head}</div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-[#f2f0ee]"><X weight="bold" className="size-5" /></button>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-7 pt-6 pb-7">{children}</div>
        {footer && <div className="flex flex-col gap-2.5 border-t border-[#efedeb] bg-[#fdfdfc] px-7 pt-4 pb-5">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}

/** Hộp thoại giữa màn (xem chi tiết phiên kiểm kê, sửa người dùng…). */
export function Modal({ open, onClose, title, kicker, meta, children, footer, width = 920 }: {
  open: boolean
  onClose: () => void
  title: string
  kicker?: ReactNode
  meta?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent showCloseButton={false}
        className="max-h-[calc(100svh-48px)] max-w-[calc(100%-32px)] gap-0 overflow-hidden overflow-y-auto rounded-3xl bg-[#fdfdfc] p-0 text-[#1c1917] shadow-[0_40px_80px_-30px_rgba(28,25,23,.6)] ring-0 sm:max-w-[var(--mw)]"
        style={{ "--mw": `${width}px` } as CSSProperties}>
        <div className="flex items-start justify-between gap-3 px-6 pt-[22px] pb-4">
          <div className="min-w-0 flex-1">
            {kicker && <div className="font-mono text-sm font-semibold text-[#7c3410]">{kicker}</div>}
            <DialogTitle className="mt-1 font-display text-[28px] font-bold tracking-[-.03em]">{title}</DialogTitle>
            {meta ? <DialogDescription className="mt-1.5 text-sm text-[#4f4a45]">{meta}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f0ee]"><X weight="bold" className="size-[18px]" /></button>
        </div>
        <div className="px-6">{children}</div>
        {footer ? <div className="flex flex-wrap gap-2.5 px-6 pt-5 pb-6">{footer}</div> : <div className="h-6" />}
      </DialogContent>
    </Dialog>
  )
}

/** Nút của thiết kế: chính (than), nhấn (paprika), phụ (đá), viền, chữ. Luôn cao ≥ 44px. */
export function Btn({ kind = "primary", icon: Icon, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "accent" | "soft" | "outline" | "ghost" | "danger"
  icon?: IconType
}) {
  const K = {
    primary: "bg-[#1c1917] text-[#fafaf9] hover:bg-[#2e2926]",
    accent: "bg-[#eb9360] text-[#1c1917] shadow-[0_12px_26px_-12px_rgba(235,147,96,.9)] hover:bg-[#f19c6a]",
    soft: "bg-[#efedeb] text-[#1c1917] hover:bg-[#e7e4e1]",
    outline: cn("bg-[#fdfdfc] text-[#1c1917]", RING, "hover:-translate-y-0.5"),
    ghost: "bg-transparent text-[#7c3410] hover:bg-[#fbeae0]",
    danger: "bg-[#a11d1d] text-white hover:bg-[#8f1a1a]",
  }[kind]
  return (
    <button type="button" {...rest}
      className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-xl px-[18px] text-[15px] font-bold whitespace-nowrap transition-[background-color,transform,box-shadow] duration-300 active:scale-[.97] disabled:pointer-events-none disabled:bg-[#e9e6e3] disabled:text-[#4f4a45] disabled:shadow-none", K, className)}>
      {Icon && <Icon weight="bold" className="size-[18px]" aria-hidden />}{children}
    </button>
  )
}

/* ---------- Thông báo nền than ở giữa đáy màn ---------- */

let toastState: { msg: string; k: number } | null = null
const subs = new Set<() => void>()
const sub = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb) } }

/** Thông báo ngắn của màn quản lý (tự tắt sau 3,4 giây). */
export function adminToast(msg: string) {
  const k = Date.now()
  toastState = { msg, k }
  subs.forEach((f) => f())
  window.setTimeout(() => {
    if (toastState?.k === k) { toastState = null; subs.forEach((f) => f()) }
  }, 3400)
}

export function AdminToast() {
  const t = useSyncExternalStore(sub, () => toastState)
  return (
    <div role="status" aria-live="polite">
      {t && (
        <div key={t.k} className="a-toast fixed bottom-7 left-1/2 z-[70] flex max-w-[min(560px,92vw)] items-center gap-2.5 rounded-2xl bg-[#1c1917] px-5 py-3.5 text-[15px] font-semibold text-[#fafaf9] shadow-[0_24px_50px_-20px_rgba(0,0,0,.6)]">
          <CheckCircle2 className="size-[22px] shrink-0 text-[#eb9360]" aria-hidden />{t.msg}
        </div>
      )}
    </div>
  )
}

/** Số đếm chạy lên một lần khi có dữ liệu (1,6 giây, chậm dần). Tắt khi người dùng giảm chuyển động. */
export function useCountUp(target: number, key: unknown = target): number {
  const [t, setT] = useState(1)
  const first = useRef(true)
  useEffect(() => {
    if (!first.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    first.current = false
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1600)
      setT(p === 1 ? 1 : 1 - Math.pow(2, -10 * p))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    setT(0)
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [key])
  return target * t
}
