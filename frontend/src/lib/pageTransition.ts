import { useCallback } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Chuyển trang giới thiệu <-> đăng nhập bằng View Transitions API.
 *
 * BrowserRouter cập nhật route trong React.startTransition nên không flush đồng bộ được: lệnh chuyển trang
 * chạy trong startViewTransition, rồi chờ trang đích gắn `data-page` vào DOM (thêm một nhịp ngắn cho các
 * effect, như đổi zoom) mới chụp trạng thái mới. Trong lúc này trình duyệt tạm dừng vẽ nên
 * requestAnimationFrame không chạy: chỉ dùng setTimeout. Trình duyệt không hỗ trợ, hoặc người dùng bật
 * giảm chuyển động, thì chuyển trang bình thường.
 *
 * Phần tử dùng chung giữa hai trang (view-transition-name): "brand" (logo) và "kitchen-photo"
 * (ảnh chảo lửa: khối cuối landing page và nửa trái màn đăng nhập).
 */
export type PageKey = "landing" | "login"

const LANDING_SCROLL = "lp-scroll"

export const preloadLanding = () => import("@/pages/landing/LandingPage")

function waitForPage(page: PageKey, timeout = 1500) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      obs.disconnect()
      clearTimeout(timer)
      setTimeout(resolve, 40)
    }
    const ready = () => !!document.querySelector(`[data-page="${page}"]`)
    const obs = new MutationObserver(() => { if (ready()) finish() })
    const timer = setTimeout(finish, timeout)
    obs.observe(document.body, { childList: true, subtree: true })
    if (ready()) finish()
  })
}

/** Vị trí cuộn của landing page lúc rời đi, để quay lại đúng chỗ. */
export function savedLandingScroll(): number | null {
  try {
    const v = sessionStorage.getItem(LANDING_SCROLL)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

type GoOptions = {
  /** Trang đích, để biết khi nào trang mới đã vẽ xong. */
  page: PageKey
  /** Hướng hiệu ứng: quay lại thì trượt ngược. */
  back?: boolean
  state?: unknown
  /** Ảnh sẽ "bay" sang ảnh cùng tên ở trang đích (gắn tên ngay trước khi chuyển). */
  morph?: HTMLElement | null
}

export function usePageTransition() {
  const navigate = useNavigate()
  return useCallback(async (to: string | number, { page, back, state, morph }: GoOptions) => {
    if (location.pathname === "/gioi-thieu") {
      try { sessionStorage.setItem(LANDING_SCROLL, String(Math.round(window.scrollY))) } catch { /* bộ nhớ phiên bị chặn */ }
    }
    if (page === "landing") await preloadLanding()
    const go = () => (typeof to === "number" ? navigate(to) : navigate(to, { state }))
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduce) {
      void go()
      return
    }
    const html = document.documentElement
    html.dataset.navDir = back ? "back" : "forward"
    if (morph) morph.style.viewTransitionName = "kitchen-photo"
    const t = document.startViewTransition(async () => {
      if (morph) morph.style.viewTransitionName = ""
      void go()
      await waitForPage(page)
    })
    t.finished.finally(() => { delete html.dataset.navDir })
  }, [navigate])
}

/** Chỉ bắt cú bấm chuột trái thường: Ctrl/Cmd/giữa chuột vẫn mở tab mới như link bình thường. */
export function plainClick(e: React.MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
