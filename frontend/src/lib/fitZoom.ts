import { useEffect } from "react"

/**
 * Co giãn cả trang theo bề rộng cửa sổ, lấy khung 1440px của bản thiết kế làm chuẩn: ở zoom trình duyệt 100%,
 * màn nào cũng vừa bề ngang, không thừa khoảng trống và không to quá. Đặt `zoom` lên <html> nên hộp thoại,
 * thông báo (portal) cũng co theo. Dưới 1024px để bố cục responsive tự lo (zoom = 1).
 *
 * Người dùng tự zoom trình duyệt (Ctrl +) vẫn có tác dụng: tỉ lệ outerWidth / innerWidth cho biết mức zoom trang,
 * nên khung chuẩn được tính theo bề rộng ở 100%, không triệt tiêu phần phóng to của người dùng.
 */
const BASE = 1440
const MIN = 0.85
const MAX = 1.35
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]

let current = 1

/** Mức co giãn đang áp dụng; dùng để đổi toạ độ chuột / getBoundingClientRect (đã nhân zoom) sang px CSS. */
export function fitZoom(): number {
  return current
}

function pageZoom(): number {
  const r = window.outerWidth / window.innerWidth
  if (!r || !Number.isFinite(r)) return 1
  const step = STEPS.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a))
  return Math.abs(step - r) < 0.04 ? step : 1
}

function compute(): number {
  const width100 = window.innerWidth * pageZoom()
  // Landing page tự responsive và có phần ghim theo 100dvh: không co giãn (zoom làm lệch đơn vị vh).
  if (window.innerWidth < 1024 || document.documentElement.classList.contains("landing")) return 1
  return Math.round(Math.min(MAX, Math.max(MIN, width100 / BASE)) * 100) / 100
}

function apply() {
  const z = compute()
  if (z === current && document.documentElement.classList.contains("fit")) return
  current = z
  const root = document.documentElement
  root.classList.add("fit")
  root.style.setProperty("zoom", String(z))
  root.style.setProperty("--fit-z", String(z))
}

/** Tính lại ngay (không chờ khung hình): dùng khi vào / rời landing page, kể cả giữa lúc chuyển trang có hiệu ứng. */
export function refitZoom() {
  apply()
}

export function useFitZoom() {
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    }
  }, [])
}
