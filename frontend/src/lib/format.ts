const TZ = "Asia/Ho_Chi_Minh"
const UNIT: Record<string, string> = { g: "g", ml: "ml", cai: "cái" }

const n0 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 })
const n1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 })

export function num(v: number | string | null | undefined, digits = 0): string {
  if (v === null || v === undefined || v === "") return "-"
  const x = Number(v)
  return (digits ? n1 : n0).format(x)
}

export function money(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "-"
  return `${n0.format(Number(v))} đ`
}

/** Tiền rút gọn cho ô số liệu lớn: 1,2 tr đ / 225 N đ */
export function moneyShort(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "-"
  const x = Number(v)
  const a = Math.abs(x)
  if (a >= 1_000_000) return `${n1.format(x / 1_000_000)} tr đ`
  if (a >= 10_000) return `${n0.format(x / 1000)} N đ`
  return `${n0.format(x)} đ`
}

export function unit(u: string): string {
  return UNIT[u] ?? u
}

export function qty(v: number | string | null | undefined, u: string): string {
  if (v === null || v === undefined) return "-"
  const x = Number(v)
  return `${Number.isInteger(x) ? n0.format(x) : n1.format(x)} ${unit(u)}`
}

export function signedQty(v: number | string | null | undefined, u: string): string {
  if (v === null || v === undefined) return "-"
  const x = Number(v)
  return `${x > 0 ? "+" : ""}${qty(x, u)}`
}

export function pct(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "-"
  const x = Number(v)
  return `${x > 0 ? "+" : ""}${n1.format(x)}%`
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
})
const WEEKDAY: Record<string, string> = { Mon: "T2", Tue: "T3", Wed: "T4", Thu: "T5", Fri: "T6", Sat: "T7", Sun: "CN" }

function parts(v: string | Date) {
  const d = typeof v === "string" ? (v.length === 10 ? new Date(`${v}T00:00:00+07:00`) : new Date(v)) : v
  const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]))
  return { dd: p.day, mm: p.month, yyyy: p.year, HH: p.hour === "24" ? "00" : p.hour, MM: p.minute, wd: WEEKDAY[p.weekday] ?? p.weekday }
}

/** 08/10 21:50 */
export function dateTime(v: string | null | undefined): string {
  if (!v) return "-"
  const p = parts(v)
  return `${p.dd}/${p.mm} ${p.HH}:${p.MM}`
}

export function time(v: string | null | undefined): string {
  if (!v) return "-"
  const p = parts(v)
  return `${p.HH}:${p.MM}`
}

/** 08/10/2026 */
export function dateOnly(v: string | null | undefined): string {
  if (!v) return "-"
  const p = parts(v)
  return `${p.dd}/${p.mm}/${p.yyyy}`
}

/** T6 09/10 · 08:50 */
export function longClock(v: string | null | undefined): string {
  if (!v) return ""
  const p = parts(v)
  return `${p.wd} ${p.dd}/${p.mm} · ${p.HH}:${p.MM}`
}

/** yyyy-mm-dd theo giờ VN */
export function isoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d)
}

export function minutesSince(v: string | null | undefined, now: Date): number {
  if (!v) return 0
  return Math.max(0, Math.round((now.getTime() - new Date(v).getTime()) / 60000))
}

export function tableLabel(t: string): string {
  return t === "Mang đi" ? "Mang đi" : `Bàn ${t}`
}
