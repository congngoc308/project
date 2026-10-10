/**
 * Âm báo dùng chung cho màn bếp và màn phục vụ: tạo bằng Web Audio (không cần file âm thanh).
 * Trình duyệt chỉ cho phát âm sau một lần chạm, nên AudioContext được mở ở lần chạm đầu tiên.
 * Bật / tắt lưu theo máy (localStorage "kitchen-sound"), mặc định bật.
 */
import { useCallback, useSyncExternalStore } from "react"

let audio: AudioContext | null = null
let soundOn = (() => {
  try { return localStorage.getItem("kitchen-sound") !== "0" } catch { return true }
})()
const soundSubs = new Set<() => void>()
const subSound = (cb: () => void) => { soundSubs.add(cb); return () => { soundSubs.delete(cb) } }

/** Trình duyệt chỉ cho phát âm sau một lần chạm: mở AudioContext ở lần chạm đầu tiên. */
export function unlockAudio() {
  try {
    const A = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audio = audio ?? new A()
    if (audio.state === "suspended") void audio.resume()
  } catch { /* máy không hỗ trợ âm thanh */ }
}

export function chime(kind: "new" | "ok" | "bad") {
  if (!soundOn || !audio) return
  try {
    const ac = audio
    const notes = kind === "new" ? [784, 1047, 1319, 1047, 1319] : kind === "bad" ? [392, 330] : [659, 988]
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.15
      o.type = "sine"
      o.frequency.value = f
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.28, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      o.connect(g)
      g.connect(ac.destination)
      o.start(t)
      o.stop(t + 0.75)
    })
  } catch { /* bỏ qua */ }
}

export function useSound() {
  const on = useSyncExternalStore(subSound, () => soundOn)
  const toggle = useCallback(() => {
    unlockAudio()
    soundOn = !soundOn
    try { localStorage.setItem("kitchen-sound", soundOn ? "1" : "0") } catch { /* chế độ riêng tư */ }
    soundSubs.forEach((f) => f())
    chime("ok")
  }, [])
  return { on, toggle }
}

if (typeof window !== "undefined") window.addEventListener("pointerdown", unlockAudio)
