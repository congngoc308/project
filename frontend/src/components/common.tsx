import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Inbox, Loader2 } from "@/components/icons"
import type { ComponentProps, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Tier } from "@/lib/types"

/** Tiêu đề màn: tên việc + một câu hướng dẫn "làm gì ở đây". */
export function PageHeader({ title, description, actions, icon: Icon }: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  icon?: typeof Info
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <span className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl bg-paprika-soft text-paprika-ink" aria-hidden>
            <Icon className="size-7" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-bold">{title}</h1>
          {description && <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Nhãn bước có số thứ tự: giúp người dùng biết đang ở bước nào của thao tác. */
export function StepLabel({ n, children, done, aside }: { n: number; children: ReactNode; done?: boolean; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold tabular",
        done ? "bg-primary text-primary-foreground" : "bg-ink text-ink-foreground",
      )}>
        {done ? <CheckCircle2 className="size-4" aria-label="Xong" /> : n}
      </span>
      <span className="font-display text-lg font-bold">{children}</span>
      {aside && <span className="ml-auto text-sm text-muted-foreground">{aside}</span>}
    </div>
  )
}

/** Ô lựa chọn lớn cho màn cảm ứng: đang chọn = nền mực đậm, rõ ràng cả khi nhìn lướt. */
export function Choice({ selected, className, children, ...props }: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3.5 text-base font-semibold",
        "transition-[background-color,box-shadow,transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        selected
          ? "border-ink bg-ink text-ink-foreground shadow-lift"
          : "border-border bg-card shadow-[0_1px_2px_rgb(28_25_23/0.05)] hover:-translate-y-px hover:border-input/50 hover:shadow-soft",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

const TIER_STYLE: Record<Tier, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: "Trong ngưỡng", icon: CheckCircle2, cls: "border-status-good/40 bg-status-good/10 text-good-ink" },
  warn: { label: "Mức cảnh báo", icon: AlertTriangle, cls: "border-status-warning/60 bg-status-warning/15 text-warning-ink" },
  must: { label: "Bắt buộc duyệt", icon: AlertOctagon, cls: "border-status-critical/40 bg-status-critical/10 text-critical-ink" },
}

/** Mức ngưỡng luôn hiển thị icon + nhãn, không dựa vào màu đơn lẻ. */
export function TierBadge({ tier, short }: { tier: Tier | null | undefined; short?: boolean }) {
  if (!tier) return <span className="text-muted-foreground">-</span>
  const s = TIER_STYLE[tier]
  const Icon = s.icon
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      <Icon className="size-3.5" aria-hidden />
      {short ? s.label.split(" ")[0] : s.label}
    </span>
  )
}

const SEVERITY: Record<string, { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: "text-muted-foreground", label: "Thông tin" },
  warn: { icon: AlertTriangle, cls: "text-warning-ink", label: "Cảnh báo" },
  critical: { icon: AlertOctagon, cls: "text-critical-ink", label: "Nghiêm trọng" },
}

export function SeverityIcon({ severity }: { severity: string }) {
  const s = SEVERITY[severity] ?? SEVERITY.info
  const Icon = s.icon
  return <Icon className={cn("size-4 shrink-0", s.cls)} aria-label={s.label} />
}

export type Tone = "good" | "warn" | "bad" | "neutral" | "info"

export const TONE_CLS: Record<Tone, string> = {
  good: "border-status-good/40 bg-status-good/10 text-good-ink",
  warn: "border-status-warning/60 bg-status-warning/15 text-warning-ink",
  bad: "border-status-critical/40 bg-status-critical/10 text-critical-ink",
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-paprika-ink/20 bg-paprika-soft text-paprika-ink",
}

export function StatusPill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONE_CLS[tone], className)}>
      {children}
    </span>
  )
}

/** Hộp thông báo nổi bật (icon + chữ), dùng cho hướng dẫn hoặc cảnh báo trong màn. */
export function Callout({ tone = "info", icon: Icon = Info, title, children, action, className }: {
  tone?: Tone
  icon?: typeof Info
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm", TONE_CLS[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && "mt-0.5", "text-foreground")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

/** Số đếm nhỏ cạnh mục điều hướng: chỉ hiện khi có việc đang chờ. */
export function CountBadge({ n, tone = "bad", className }: { n: number; tone?: "bad" | "neutral" | "light"; className?: string }) {
  if (!n) return null
  return (
    <span
      aria-label={`${n} việc đang chờ`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular",
        tone === "bad" && "bg-destructive text-white",
        tone === "neutral" && "bg-card text-foreground ring-1 ring-border",
        tone === "light" && "bg-card text-ink ring-1 ring-border",
        className,
      )}
    >
      {n}
    </span>
  )
}

export function LocationBadge({ location }: { location: string }) {
  return <Badge variant="outline" className="rounded-full font-medium">{location === "bep" ? "Bếp" : "Kho"}</Badge>
}

export function GroupBadge({ group }: { group: "A" | "C" }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", group === "A" ? "border-paprika-ink/30 bg-paprika-soft text-paprika-ink" : "text-muted-foreground")}>
      Nhóm {group}
    </Badge>
  )
}

/** Đang tải: khung xương có hình gần giống nội dung thật, thay cho vòng quay. */
export function Loading({ label = "Đang tải…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary/70" style={{ opacity: 1 - i * 0.2 }} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Vòng quay nhỏ cho thao tác đang chạy trong nút. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />
}

/** Trạng thái trống: nói rõ vì sao trống và việc tiếp theo nên làm. */
export function Empty({ children, icon: Icon = Inbox, action, className }: {
  children: ReactNode
  icon?: typeof Info
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed border-input/70 bg-card/70 px-5 py-10 text-center text-sm text-muted-foreground", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground" aria-hidden>
        <Icon className="size-6" />
      </span>
      <div className="max-w-sm">{children}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function Section({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-card p-5 shadow-soft ring-1 ring-stone-900/5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium break-words">{children}</div>
    </div>
  )
}

/** Bộ lọc dạng tab (chỉ đổi dữ liệu trong cùng một bảng): nhóm nút có aria-pressed, ô bấm ≥ 44px. */
export function FilterTabs<T extends string>({ value, onChange, options, label }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-secondary/80 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-10 rounded-lg px-4 text-sm font-semibold transition-[background-color,box-shadow] duration-200",
            value === o.value ? "bg-ink text-ink-foreground shadow-soft" : "text-foreground hover:bg-card",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
