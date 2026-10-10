/**
 * Khung riêng của thủ kho theo thiết kế "Thu Kho v2" (Claude Design): menu dọc bên trái có nền tối trượt
 * theo mục đang chọn, thẻ đồng hồ với thanh tiến độ ca, người dùng ở cuối menu.
 * Màn hẹp (< 1024px) gập menu thành dải tab ngang phía trên.
 */
import {
  BasketIcon, ChefHatIcon, ClipboardTextIcon, ListChecksIcon, ScalesIcon, SignOutIcon, SquaresFourIcon, TrashIcon, TruckIcon,
  type Icon,
} from "@phosphor-icons/react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { time } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useWork } from "@/lib/work"
import { DemoBanner } from "@/layouts/TopBits"

export const STORE_ROUTES = ["/van-hanh/hom-nay", "/van-hanh/nhap-hang", "/van-hanh/kho", "/van-hanh/can-tra", "/van-hanh/kiem-ke"]

const DAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]

/** Giờ nghiệp vụ theo múi giờ Việt Nam, tách sẵn từng phần. */
export function vnParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d).map((x) => [x.type, x.value]))
  const local = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }))
  const hh = p.hour === "24" ? "00" : p.hour
  return {
    hh, mm: p.minute, ss: p.second, dd: p.day, mo: p.month, yyyy: p.year,
    weekday: DAYS[local.getDay()],
    hours: Number(hh) + Number(p.minute) / 60 + Number(p.second) / 3600,
  }
}

function hoursOf(iso: string) {
  const p = vnParts(new Date(iso))
  return Number(p.hh) + Number(p.mm) / 60
}

const NAV: { to: string; label: string; icon: Icon; badge?: "receiptsToReceive" | "handoversToSign" | "lateReturns" | "openCounts"; urgent?: boolean }[] = [
  { to: "/van-hanh/hom-nay", label: "Hôm nay", icon: ListChecksIcon },
  { to: "/van-hanh/nhap-hang", label: "Nhập hàng", icon: BasketIcon, badge: "receiptsToReceive" },
  { to: "/van-hanh/kho", label: "Bàn giao", icon: TruckIcon, badge: "handoversToSign" },
  { to: "/van-hanh/can-tra", label: "Cân trả cuối ca", icon: ScalesIcon, badge: "lateReturns", urgent: true },
  { to: "/van-hanh/kiem-ke", label: "Kiểm kê", icon: ClipboardTextIcon, badge: "openCounts" },
  { to: "/van-hanh/hao-hut", label: "Hao hụt", icon: TrashIcon },
]

const card = "rounded-[18px] bg-[#fdfdfc] shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-10px_rgba(41,37,36,.14),0_0_0_1px_rgba(28,25,23,.05)]"

function ShiftClock() {
  const { me } = useAuth()
  const now = useServerNow(1000)
  const p = vnParts(now)
  const s = me?.shift
  const late = !!s && s.status === "open" && now.getTime() >= new Date(s.planned_end).getTime()
  const status = !s ? "Ngoài giờ ca" : s.status === "open" ? (late ? "Đến giờ cân trả" : "Đang mở") : s.status === "closed" ? "Đã đóng" : "Chưa nhận bàn giao"
  const tone = late ? "bg-[#fbe3e3] text-[#8f1a1a]" : s?.status === "open" ? "bg-[#e3f4e3] text-[#004d00]" : s?.status === "closed" ? "bg-[#efedeb] text-[#4f4a45]" : "bg-[#fdf0d2] text-[#6b4300]"
  const pct = s ? Math.max(0, Math.min(100, ((p.hours - hoursOf(s.planned_start)) / (hoursOf(s.planned_end) - hoursOf(s.planned_start))) * 100)) : 0
  return (
    <div className={cn(card, "p-4")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#4f4a45]">{me?.demo_mode && me.clock_offset ? "Giờ demo" : "Bây giờ"}</span>
        <span className="text-[13px] whitespace-nowrap text-[#4f4a45]">{p.weekday} {p.dd}/{p.mo}</span>
      </div>
      <div className="mt-0.5 font-display text-[34px] leading-[1.1] font-bold tracking-[-.03em] tabular">
        {p.hh}:{p.mm}<span className="text-lg font-semibold text-[#4f4a45]">:{p.ss}</span>
      </div>
      <div className="mt-3 flex flex-col items-start gap-1.5 text-[13px]">
        <span className="text-sm font-semibold">{s ? `${s.name} ${time(s.planned_start)}-${time(s.planned_end)}` : "Không có ca"}</span>
        <span className={cn("rounded-full px-[9px] py-0.5 font-semibold whitespace-nowrap", tone)}>{status}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efedeb]" role="progressbar" aria-label="Tiến độ ca" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="h-full rounded-full bg-[#eb9360] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

export function StoreShell() {
  const { me, logout, has } = useAuth()
  const nav = useNavigate()
  const work = useWork()
  const { pathname } = useLocation()
  const idx = NAV.findIndex((n) => n.to === pathname)
  if (!me) return null
  const out = async () => { await logout(); nav("/dang-nhap") }
  return (
    <div className="min-h-svh bg-[#f5f5f4] lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
      <a href="#noi-dung" className="sr-only z-50 rounded-xl bg-card px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Bỏ qua tới nội dung</a>
      {/* Menu dọc (màn rộng) */}
      <aside className="sticky top-0 hidden h-svh flex-col gap-[22px] bg-[#fbfaf9] px-4 py-[22px] shadow-[inset_-1px_0_0_#e2ded9] lg:flex">
        <div className="flex items-center gap-3 px-1.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#eb9360] shadow-[inset_0_-2px_0_rgba(28,25,23,.12)]">
            <ChefHatIcon className="size-[26px] text-[#1c1917]" aria-hidden />
          </div>
          <div className="leading-[1.15]">
            <div className="font-display text-lg font-bold tracking-[-.02em]">Quản lý bếp</div>
            <div className="text-[13px] font-semibold text-[#4f4a45]">Khu Kho</div>
          </div>
        </div>
        <nav aria-label="Chức năng" className="relative flex flex-col gap-1">
          {idx >= 0 && (
            <div aria-hidden className="absolute inset-x-0 h-12 rounded-xl bg-[#1c1917] shadow-[0_2px_4px_rgba(41,37,36,.08),0_14px_28px_-14px_rgba(41,37,36,.5)] transition-[top] duration-500 ease-[cubic-bezier(.34,1.4,.5,1)]"
              style={{ top: idx * 52 }} />
          )}
          {NAV.map((n, i) => {
            const on = i === idx
            const b = n.badge ? work[n.badge] : 0
            return (
              <NavLink key={n.to} to={n.to}
                className={cn("relative flex h-12 items-center gap-3 rounded-xl px-3.5 text-[15px] font-semibold transition-colors duration-300",
                  on ? "text-[#fafaf9]" : "text-[#1c1917] hover:bg-[rgba(28,25,23,.04)]")}>
                <n.icon className="size-[22px]" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {!!b && (
                  <span aria-label={`${b} việc đang chờ`}
                    className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-[7px] text-[13px] font-bold tabular",
                      on ? "bg-[#eb9360] text-[#1c1917]" : n.urgent ? "bg-[#a11d1d] text-white" : "bg-[#e7e4e1] text-[#1c1917]")}>{b}</span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="flex-1" />
        {has("manager") && (
          <NavLink to="/quan-ly" className="flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold underline decoration-[#eb9360] decoration-2 underline-offset-4 hover:bg-[rgba(28,25,23,.04)]">
            <SquaresFourIcon className="size-5" aria-hidden /> Màn quản lý
          </NavLink>
        )}
        <ShiftClock />
        <div className="flex items-center gap-2.5 px-1.5">
          <div aria-hidden className="flex size-10 items-center justify-center rounded-full bg-[#fbeae0] text-sm font-extrabold text-[#7c3410]">{initials(me.full_name)}</div>
          <div className="flex-1 leading-[1.2]">
            <div className="text-[15px] font-bold">{me.full_name}</div>
            <div className="text-[13px] text-[#4f4a45]">{me.role_labels.join(", ")}</div>
          </div>
          <button type="button" aria-label="Đổi người" title="Đổi người" onClick={out}
            className="flex size-11 items-center justify-center rounded-xl hover:bg-[#efedeb]"><SignOutIcon className="size-[22px]" /></button>
        </div>
      </aside>

      {/* Dải tab ngang (màn hẹp) */}
      <header className="sticky top-0 z-20 border-b border-[#e2ded9] bg-[#fbfaf9]/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#eb9360]"><ChefHatIcon className="size-6" aria-hidden /></div>
            <div className="font-display text-lg font-bold">Khu Kho</div>
          </div>
          <button type="button" onClick={out} className="flex h-11 items-center gap-2 rounded-xl border border-[#d6d3d1] px-3 text-sm font-semibold">
            <SignOutIcon className="size-5" aria-hidden /> Đổi người
          </button>
        </div>
        <nav aria-label="Chức năng" className="flex gap-1 overflow-x-auto px-3 py-2.5">
          {NAV.map((n, i) => (
            <NavLink key={n.to} to={n.to}
              className={cn("flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold", i === idx ? "bg-[#1c1917] text-[#fafaf9]" : "text-[#1c1917]")}>
              <n.icon className="size-5" aria-hidden />{n.label}
              {!!(n.badge && work[n.badge]) && <span className="rounded-full bg-[#eb9360] px-1.5 text-xs font-bold text-[#1c1917]">{work[n.badge!]}</span>}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="noi-dung" tabIndex={-1} className="min-w-0 outline-none">
        <DemoBanner />
        <div className="px-4 pt-7 pb-14 sm:px-8 lg:px-11 lg:pt-9">
          <div key={pathname} className="st-in mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
