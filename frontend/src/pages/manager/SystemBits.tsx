/**
 * Mảnh dùng chung cho các màn "Hệ thống" và "Báo cáo khác" (thiết kế "Admin He Thong"):
 * bảng dạng lưới cuộn ngang, phân trang phía máy, ô chọn nền trắng, tab gạch chân, ô số có nút cộng trừ.
 */
import { useEffect, useState, type ReactNode } from "react"

import { ArrowLeft, ArrowRight, Minus, Plus } from "@/components/icons"
import { CARD, RING, EmptyNote } from "@/layouts/AdminBits"
import { cn } from "@/lib/utils"

/** Độ trễ hiện lần lượt, chỉ cho vài chục dòng đầu (dòng sau hiện ngay). */
export const rowDelay = (i: number, step = 40) => ({ animationDelay: `${Math.min(i, 14) * step}ms` })

export type Cell = { t: ReactNode; right?: boolean; strong?: boolean; color?: string; mono?: boolean }

/** Bảng lưới trong thẻ bo 22px: tiêu đề xám, dòng trượt vào từ phải, rê chuột đổi nền. */
export function GridTable({ cols, minW, head, rows, empty = "Không có dữ liệu trong kỳ", label }: {
  cols: string
  minW: number
  head: { t: string; right?: boolean }[]
  rows: { key: string | number; cells: Cell[] }[]
  empty?: string
  label: string
}) {
  return (
    <div className={cn(CARD, "a-rise overflow-x-auto")} role="region" aria-label={label} tabIndex={0}>
      <div role="table" aria-label={label} style={{ minWidth: minW }}>
        <div role="row" className="grid gap-3.5 border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]" style={{ gridTemplateColumns: cols }}>
          {head.map((h, i) => <span role="columnheader" key={i} className={h.right ? "text-right" : ""}>{h.t}</span>)}
        </div>
        {rows.length === 0 ? <EmptyNote>{empty}</EmptyNote> : rows.map((r, i) => (
          <div role="row" key={r.key} style={{ gridTemplateColumns: cols, ...rowDelay(i, 45) }}
            className="a-slide grid min-h-14 items-center gap-3.5 border-b border-[#efedeb] px-6 py-[13px] text-sm tabular transition-colors duration-200 last:border-b-0 hover:bg-[#f7f4f1]">
            {r.cells.map((c, j) => (
              <span role="cell" key={j} className={cn("min-w-0 break-words", c.right && "text-right", c.strong && "font-bold", c.mono && "font-mono")} style={c.color ? { color: c.color } : undefined}>{c.t}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Phân trang phía máy cho danh sách dài (sổ kho 300 dòng, nhật ký 200 dòng). */
export function usePaged<T>(rows: T[], size: number, resetKey: unknown) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [resetKey])
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(page, pages - 1)
  return { slice: rows.slice(p * size, (p + 1) * size), page: p, pages, setPage, total: rows.length, size }
}

export function Pager({ page, pages, setPage, total, size, noun }: { page: number; pages: number; setPage: (p: number) => void; total: number; size: number; noun: string }) {
  if (total <= size) return null
  const from = page * size + 1
  const to = Math.min(total, (page + 1) * size)
  const btn = cn("flex size-11 items-center justify-center rounded-xl bg-[#fdfdfc] transition-transform duration-300 active:scale-95 disabled:opacity-100 disabled:bg-[#efedeb] disabled:shadow-none", RING)
  return (
    <nav aria-label={`Phân trang ${noun}`} className="flex flex-wrap items-center justify-end gap-3 text-sm text-[#4f4a45]">
      <span className="tabular">{from}-{to} / {total} {noun}</span>
      <button type="button" className={btn} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Trang trước"><ArrowLeft weight="bold" className="size-[18px] text-[#1c1917]" /></button>
      <span className="min-w-16 text-center font-bold text-[#1c1917] tabular">Trang {page + 1}/{pages}</span>
      <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Trang sau"><ArrowRight weight="bold" className="size-[18px] text-[#1c1917]" /></button>
    </nav>
  )
}

/** Ô chọn gốc của trình duyệt, khoác kiểu chip trắng của thiết kế. */
export function SelectBox({ label, value, onChange, children, className }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className={cn("h-11 rounded-full bg-[#fdfdfc] pr-9 pl-4 text-sm font-bold text-[#1c1917]", RING, className)}>
      {children}
    </select>
  )
}

/** Tab gạch chân paprika (Hao hụt / Theo ca…). */
export function UnderTabs<T extends string>({ items, value, onChange, label }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="a-rise flex flex-nowrap gap-1 overflow-x-auto border-b border-[#e2ded9] [scrollbar-width:none]" style={{ animationDelay: "50ms" }}>
      {items.map((t) => {
        const on = t.key === value
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
            className={cn("relative h-12 shrink-0 px-3.5 text-[15px] font-bold whitespace-nowrap transition-colors duration-300", on ? "text-[#1c1917]" : "text-[#4f4a45] hover:text-[#1c1917]")}>
            {t.label}
            <span aria-hidden className="absolute right-2.5 -bottom-px left-2.5 h-[3px] rounded-[3px] bg-[#eb9360] transition-transform duration-[450ms] ease-[cubic-bezier(.34,1.4,.64,1)]"
              style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }} />
          </button>
        )
      })}
    </div>
  )
}

/** Ô số có nút trừ / cộng; vẫn gõ trực tiếp được. Viền paprika khi khác giá trị đã lưu. */
export function Stepper({ id, label, value, onChange, step, changed, suffix, minH }: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  step: number
  changed: boolean
  suffix?: string
  minH?: boolean
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText((t) => (Number(t.replace(",", ".")) === value ? t : fmt(value))) }, [value])
  const bump = (d: number) => onChange(Math.max(0, Math.round((value + d) * 10) / 10))
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("text-sm font-semibold", minH && "min-h-10")}>{label}</label>
      <div className="flex h-12 items-center rounded-xl bg-white transition-shadow duration-300"
        style={{ boxShadow: changed ? "0 0 0 2px #eb9360" : "0 0 0 1px #8a817c" }}>
        <button type="button" onClick={() => bump(-step)} aria-label={`Giảm ${label}`} className="flex h-12 w-11 shrink-0 items-center justify-center rounded-l-xl hover:bg-[#f5f3f1]"><Minus weight="bold" className="size-4" /></button>
        <div className="flex h-full min-w-0 flex-1 items-center justify-center font-display text-xl font-bold tabular">
          <input id={id} inputMode="decimal" value={text}
            onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ""); setText(v); onChange(Number(v.replace(",", ".")) || 0) }}
            onBlur={() => setText(fmt(value))}
            style={{ width: `${Math.max(1, text.length) + 0.6}ch` }}
            className="h-full max-w-full min-w-0 bg-transparent text-center outline-none" />
          {suffix && <span aria-hidden>{suffix}</span>}
        </div>
        <button type="button" onClick={() => bump(step)} aria-label={`Tăng ${label}`} className="flex h-12 w-11 shrink-0 items-center justify-center rounded-r-xl hover:bg-[#f5f3f1]"><Plus weight="bold" className="size-4" /></button>
      </div>
    </div>
  )
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace(".", ","))
