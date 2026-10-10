import { ArrowRightIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { motion, useReducedMotion } from "motion/react"
import { useSyncExternalStore, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { api } from "@/lib/api"
import { homeFor, useAuth } from "@/lib/auth"
import { plainClick, usePageTransition } from "@/lib/pageTransition"
import type { Role, StaffUser } from "@/lib/types"
import { cn } from "@/lib/utils"

export const GITHUB = "https://github.com/congngoc308/project"
export const IMG = "/img/landing"

/** Khớp media query (màn rộng / giảm chuyển động), đọc lại khi người dùng đổi cỡ cửa sổ. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Khối hiện dần khi cuộn tới: báo cho người đọc biết phần mới bắt đầu. Giảm chuyển động thì hiện ngay. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  )
}

const BTN = "group inline-flex h-14 shrink-0 items-center gap-2.5 rounded-full px-7 text-base font-bold whitespace-nowrap transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] active:scale-[.98]"

/**
 * Đường vào màn đăng nhập từ landing page. Rê chuột / focus là tải sẵn danh sách nhân viên, nên màn đăng
 * nhập hiện tên ngay. Đã đăng nhập rồi thì vào thẳng màn làm việc, không qua màn đăng nhập.
 * `group` (phục vụ, bếp…) đưa nhóm đó lên đầu màn chọn người; `morph` cho ảnh chảo lửa bay sang màn đăng nhập.
 */
export function useEnterLogin() {
  const { me } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const go = usePageTransition()
  const prefetch = () => {
    if (!me) void qc.prefetchQuery({ queryKey: ["staff"], queryFn: () => api.get<StaffUser[]>("/auth/staff"), staleTime: 30_000 })
  }
  const href = (group?: Role) => (me ? homeFor(me.roles) : group ? `/dang-nhap?nhom=${group}` : "/dang-nhap")
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, group?: Role, morph?: HTMLElement | null) => {
    if (!plainClick(e)) return
    e.preventDefault()
    if (me) navigate(homeFor(me.roles))
    else void go(href(group), { page: "login", state: { from: "landing" }, morph })
  }
  return { me, href, prefetch, onClick }
}

/** Nút chính: nền paprika chữ than (7,4 : 1), mũi tên trượt nhẹ khi rê chuột. */
export function EnterButton({ className, morphPhoto }: { className?: string; morphPhoto?: boolean }) {
  const enter = useEnterLogin()
  return (
    <a href={enter.href()} onMouseEnter={enter.prefetch} onFocus={enter.prefetch}
      onClick={(e) => enter.onClick(e, undefined, morphPhoto ? e.currentTarget.closest("section")?.querySelector<HTMLElement>("[data-vt-photo]") : null)}
      className={cn(BTN, "bg-lp-accent text-lp-on-accent shadow-[0_14px_30px_-14px_rgba(124,52,16,.55)] hover:-translate-y-0.5", className)}>
      {enter.me ? "Tiếp tục làm việc" : "Vào hệ thống"}
      <ArrowRightIcon className="size-5 transition-transform duration-300 group-hover:translate-x-1" weight="bold" aria-hidden />
    </a>
  )
}

export function GhostButton({ href, children, className, external }: { href: string; children: ReactNode; className?: string; external?: boolean }) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
      className={cn(BTN, "text-lp-ink shadow-[inset_0_0_0_1.5px_var(--lp-dim)] hover:bg-lp-surface", className)}>
      {children}
    </a>
  )
}
