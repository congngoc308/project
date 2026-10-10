import { CircleDashed, CircleDot, CircleCheck, Clock, FlaskConical, LogOut } from "@/components/icons"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

import { StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { longClock, time } from "@/lib/format"
import type { Shift } from "@/lib/types"
import { cn } from "@/lib/utils"

function shiftState(shift: Shift) {
  if (shift.status === "open") return { tone: "good" as const, label: "đang mở", icon: CircleDot }
  if (shift.status === "closed") return { tone: "neutral" as const, label: "đã cân trả", icon: CircleCheck }
  return { tone: "warn" as const, label: "chưa nhận bàn giao", icon: CircleDashed }
}

/** Ca hiện tại: tên, giờ dự kiến và trạng thái (icon + chữ). onDark dùng trên thanh tối. */
export function ShiftChip({ shift, onDark }: { shift: Shift | null | undefined; onDark?: boolean }) {
  if (!shift) {
    return onDark
      ? <span className="text-xs text-slate-200">Ngoài giờ ca</span>
      : <StatusPill tone="neutral">Ngoài giờ ca</StatusPill>
  }
  const s = shiftState(shift)
  const text = `${shift.name} ${time(shift.planned_start)}-${time(shift.planned_end)}, ${s.label}`
  if (onDark) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-200">
        <s.icon className={cn("size-3.5", s.tone === "good" ? "text-emerald-400" : s.tone === "warn" ? "text-amber-300" : "text-slate-300")} aria-hidden />
        {text}
      </span>
    )
  }
  return (
    <StatusPill tone={s.tone}>
      <s.icon className="size-3.5" aria-hidden /> {text}
    </StatusPill>
  )
}

/** Link ẩn, hiện khi bấm Tab đầu tiên: nhảy thẳng tới nội dung, bỏ qua thanh điều hướng. */
export function SkipLink() {
  return (
    <a href="#noi-dung"
      className="sr-only z-50 rounded-xl bg-card px-4 py-3 text-base font-semibold text-ink shadow-lift focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
      Bỏ qua tới nội dung
    </a>
  )
}

/** Gắn lớp "ops" lên <html> khi ở màn máy tính bảng: chữ thường 16px, áp cả cho hộp thoại. */
export function useOpsScale() {
  useEffect(() => {
    document.documentElement.classList.add("ops")
    return () => document.documentElement.classList.remove("ops")
  }, [])
}

export function ClockText({ onDark }: { onDark?: boolean }) {
  const now = useServerNow()
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm tabular", onDark ? "text-slate-200" : "text-muted-foreground")}>
      <Clock className="size-4" aria-hidden /> {longClock(now.toISOString())}
    </span>
  )
}

export function DemoBanner() {
  const { me } = useAuth()
  if (!me?.demo_mode || !me.clock_offset) return null
  const h = Math.round(me.clock_offset / 360) / 10
  return (
    <div className="flex items-center justify-center gap-2 bg-[#fde3a7] px-3 py-1.5 text-xs font-semibold text-[#5c3a00]">
      <FlaskConical className="size-3.5" aria-hidden />
      Đang dùng giờ demo (lệch {h > 0 ? "+" : ""}{h.toLocaleString("vi-VN")} giờ so với giờ thật)
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-paprika-soft font-display text-sm font-bold text-paprika-ink", className)} aria-hidden>
      {initials(name)}
    </span>
  )
}

/** Người đang dùng máy + nút đổi người (máy tính bảng dùng chung cả ca). */
export function UserMenu({ onDark }: { onDark?: boolean }) {
  const { me, logout } = useAuth()
  const nav = useNavigate()
  if (!me) return null
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={me.full_name} className={onDark ? "bg-slate-700 text-white" : undefined} />
      <div className="hidden leading-tight sm:block">
        <div className={cn("text-sm font-semibold", onDark && "text-white")}>{me.full_name}</div>
        <div className={cn("text-xs", onDark ? "text-slate-300" : "text-muted-foreground")}>{me.role_labels.join(" · ")}</div>
      </div>
      <Button
        variant="outline"
        size="lg"
        className={cn("ml-1 rounded-xl", onDark && "border-slate-600 bg-transparent text-white hover:bg-slate-800 hover:text-white")}
        onClick={async () => {
          await logout()
          nav("/dang-nhap")
        }}
      >
        <LogOut className="size-5" /> Đổi người
      </Button>
    </div>
  )
}
