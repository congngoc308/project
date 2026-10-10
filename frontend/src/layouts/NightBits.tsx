/**
 * Khung "ban đêm" cho phục vụ bàn, theo thiết kế "Phục Vụ" (Claude Design):
 * dải chữ chạy báo giờ demo, logo nghiêng, viên trạng thái ca, đồng hồ nhấp nháy dấu hai chấm,
 * thẻ người dùng và thanh tab có nền trượt.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"

import { ChefHat, LayoutDashboard, LogOut, type IconType } from "@/components/icons"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { time } from "@/lib/format"
import { cn } from "@/lib/utils"

const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

/** Gắn lớp "night" lên <html> khi đang ở màn phục vụ (áp cả cho hộp thoại, thông báo). */
export function useNightTheme(on: boolean) {
  useEffect(() => {
    if (!on) return
    document.documentElement.classList.add("night")
    return () => document.documentElement.classList.remove("night")
  }, [on])
}

/** Hai đốm sáng mờ trôi chậm phía sau nội dung (lớp cố định, không bắt chuột). */
export function NightGlow() {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed -top-[200px] -left-[120px] size-[620px] rounded-full bg-[radial-gradient(circle,rgba(255,90,60,.22),rgba(255,90,60,0)_65%)] [animation:n-blob_22s_ease-in-out_infinite_alternate]" />
      <div aria-hidden className="pointer-events-none fixed -right-[160px] -bottom-[260px] size-[700px] rounded-full bg-[radial-gradient(circle,rgba(255,216,77,.12),rgba(255,216,77,0)_65%)] [animation:n-blob_28s_ease-in-out_infinite_alternate-reverse]" />
    </>
  )
}

export function NightDemoBanner() {
  const { me } = useAuth()
  if (!me?.demo_mode || !me.clock_offset) return null
  const h = Math.round(me.clock_offset / 360) / 10
  const text = `Đang dùng giờ demo (lệch ${h > 0 ? "+" : ""}${h.toLocaleString("vi-VN")} giờ so với giờ thật)`
  return (
    <div className="relative z-[2] flex h-[34px] items-center overflow-hidden bg-[var(--lime)] text-[13px] font-bold tracking-[.02em] text-[var(--night)]">
      <span className="sr-only">{text}</span>
      <div aria-hidden className="flex gap-12 pl-12 whitespace-nowrap [animation:n-marquee_26s_linear_infinite]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="flex gap-12"><span>{text}</span><span>◆</span></span>
        ))}
      </div>
    </div>
  )
}

function NightClock() {
  const now = useServerNow(1000)
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now).map((x) => [x.type, x.value]))
  const wd = DAYS[new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getDay()]
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[var(--night-2)] px-[18px] py-3 font-semibold tabular">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span>{wd} {p.day}/{p.month}</span>
      <span className="font-display text-lg font-extrabold">
        {p.hour === "24" ? "00" : p.hour}<span className="transition-opacity duration-200" style={{ opacity: now.getSeconds() % 2 ? 0.2 : 1 }}>:</span>{p.minute}
      </span>
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

export function NightHeader() {
  const { me, logout, has } = useAuth()
  const nav = useNavigate()
  if (!me) return null
  const s = me.shift
  const shiftText = s
    ? `${s.name} ${time(s.planned_start)}-${time(s.planned_end)}, ${s.status === "open" ? "đang mở" : s.status === "closed" ? "đã cân trả" : "chưa nhận bàn giao"}`
    : "Ngoài giờ ca"
  return (
    <header className="n-rise flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-4">
        <div className="flex size-[58px] -rotate-[8deg] items-center justify-center rounded-[18px] bg-[var(--coral)] text-[var(--night)] shadow-[0_14px_34px_-10px_rgba(255,90,60,.8)] transition-transform duration-500 n-spring hover:rotate-[8deg] hover:scale-[1.08]">
          <ChefHat className="size-[30px]" weight="bold" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-display text-[26px] leading-none font-extrabold tracking-[-.02em]">Quản lý bếp</div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[rgba(255,90,60,.35)] bg-[rgba(255,90,60,.12)] px-3 py-[5px] text-[13px] font-semibold text-[#ff9a84]">
            <span className={cn("size-2 rounded-full bg-[var(--coral)]", s?.status !== "open" && "n-pulse")} aria-hidden />
            <span className="whitespace-nowrap">{shiftText}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="hidden md:block"><NightClock /></span>
        {has("manager") && (
          <NavLink to="/quan-ly" className="inline-flex h-14 items-center gap-2 rounded-full px-4 font-semibold text-[var(--lime)] underline underline-offset-4 hover:bg-white/5">
            <LayoutDashboard className="size-5" aria-hidden /> Màn quản lý
          </NavLink>
        )}
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[var(--night-2)] py-1.5 pr-[18px] pl-1.5">
          <div className="flex size-11 items-center justify-center rounded-full bg-[var(--lime)] font-display text-base font-extrabold text-[var(--night)]" aria-hidden>{initials(me.full_name)}</div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold">{me.full_name}</span>
            <span className="text-xs text-[#ada3c0]">{me.role_labels.join(" / ")}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => { await logout(); nav("/dang-nhap") }}
          className="flex h-14 items-center gap-2 rounded-full border-[1.5px] border-[rgba(255,246,236,.25)] bg-transparent px-[22px] font-semibold text-[var(--cream)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--cream)] hover:text-[var(--night)]"
        >
          <LogOut className="size-[18px]" weight="bold" aria-hidden />
          <span className="whitespace-nowrap">Đổi người</span>
        </button>
      </div>
    </header>
  )
}

export interface NightTab {
  to: string
  label: string
  icon: IconType
  badge?: number
}

/** Thanh tab dạng viên thuốc; khi ≤ 3 tab, nền trắng kem trượt theo tab đang chọn. */
export function NightTabs({ tabs, activeIndex }: { tabs: NightTab[]; activeIndex: number }) {
  const slide = tabs.length <= 3
  return (
    <nav aria-label="Chức năng" className="n-rise relative mt-7 inline-flex max-w-full flex-wrap rounded-full border border-white/10 bg-[var(--night-2)] p-1.5 [animation-delay:.08s]">
      {slide && activeIndex >= 0 && (
        <div aria-hidden className="absolute top-1.5 left-1.5 h-14 w-[220px] rounded-full bg-[var(--cream)] transition-transform duration-500 n-spring"
          style={{ transform: `translateX(${activeIndex * 220}px)` }} />
      )}
      {tabs.map((t, i) => {
        const on = i === activeIndex
        return (
          <NavLink key={t.to} to={t.to}
            className={cn(
              "relative flex h-14 items-center justify-center gap-2.5 rounded-full px-5 text-base font-bold transition-colors duration-300",
              slide ? "w-[220px]" : on && "bg-[var(--cream)]",
              on ? "text-[var(--night)]" : "text-[#ada3c0] hover:text-[var(--cream)]",
            )}>
            <t.icon className="size-5" weight="bold" aria-hidden />
            <span className="whitespace-nowrap">{t.label}</span>
            {!!t.badge && (
              <span className="n-pulse-lime flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--lime)] px-[7px] text-[13px] font-extrabold text-[var(--night)]" aria-label={`${t.badge} việc đang chờ`}>{t.badge}</span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function NightPage({ children }: { children: ReactNode }) {
  return <div className="relative min-h-svh overflow-x-hidden bg-[var(--night)] text-[var(--cream)]">{children}</div>
}

export interface NightToast {
  id: number
  text: string
  color: string
}

let toastSeq = 0

/** Thông báo ngắn dạng viên thuốc ở đáy màn hình (tự tắt sau 2,8 giây, tối đa 3 cái). */
export function useNightToasts() {
  const [toasts, setToasts] = useState<NightToast[]>([])
  const push = useCallback((text: string, color = "var(--lime)") => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, text, color }].slice(-3))
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])
  return { toasts, push }
}

export function NightToasts({ toasts }: { toasts: NightToast[] }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-7 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2.5">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-full bg-[var(--cream)] py-3.5 pr-[22px] pl-3.5 text-[15px] font-bold text-[var(--night)] shadow-[0_20px_40px_-12px_rgba(0,0,0,.7)] [animation:n-toast_.55s_cubic-bezier(.34,1.56,.64,1)_both]">
          <span aria-hidden className="size-7 flex-none rounded-full" style={{ background: t.color }} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
