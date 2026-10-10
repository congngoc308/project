/**
 * Nhập số cân / số đếm theo thiết kế "Thu Kho v2": danh sách dòng bên trái, màn hình số tối với chữ số cuộn
 * và bàn phím số bên phải. Gõ phím số trên bàn phím máy tính cũng nhập được; Enter / mũi tên để chuyển dòng.
 * Giá trị lưu dạng chuỗi với dấu chấm thập phân (giống WeighList), hiển thị kiểu Việt Nam (1.000,5).
 */
import { BackspaceIcon, CheckIcon, EyeSlashIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import { unit as fmtUnit } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface ScaleRow {
  key: string | number
  label: string
  unit: string
  hint?: ReactNode
}

/** "1000.5" → "1.000,5" */
export function viNum(v: string | undefined): string {
  if (v === undefined || v === "") return ""
  const [i, d] = v.split(".")
  const ii = (i || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return d !== undefined ? `${ii},${d}` : ii
}

const filled = (v: string | undefined) => v !== undefined && v !== ""

export function allScaleFilled(rows: ScaleRow[], values: Record<string, string>) {
  return rows.length > 0 && rows.every((r) => filled(values[String(r.key)]))
}

export function scaleNumbers(values: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]))
}

/** Băng chữ số cuộn: mỗi chữ số là một cột 0-9 trượt tới đúng vị trí. */
function Odometer({ text, dim }: { text: string; dim: boolean }) {
  return (
    <div className={cn("flex font-display text-[60px] leading-none font-bold tabular transition-colors duration-300", dim ? "text-[#a8a29e]" : "text-[#fafaf9]")} aria-hidden>
      {text.split("").map((ch, i) => /\d/.test(ch) ? (
        <span key={i} className="inline-block h-[1em] w-[.62em] overflow-hidden">
          <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(.2,.9,.15,1.05)]" style={{ transform: `translateY(-${ch}em)` }}>
            {"0123456789".split("").map((g) => <span key={g} className="block h-[1em] text-center leading-[1em]">{g}</span>)}
          </span>
        </span>
      ) : (
        <span key={i} className="inline-block h-[1em] w-[.28em] text-center leading-[1em]">{ch}</span>
      ))}
    </div>
  )
}

export function BlindNote({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-[#1c1917] px-[18px] py-3.5 text-[#fafaf9]">
      <EyeSlashIcon className="size-6 flex-none text-[#eb9360]" aria-hidden />
      <div className="text-[15px]"><b>{title}.</b> <span className="text-[#d6d3d1]">Màn hình không hiển thị số trên sổ. Nhập đúng số thực tế trên cân hoặc đếm được, kể cả khi bằng 0.</span></div>
    </div>
  )
}

export function ScaleWeigh({ rows, values, onChange, title, allowDecimal = true }: {
  rows: ScaleRow[]
  values: Record<string, string>
  onChange: (v: Record<string, string>) => void
  title: ReactNode
  allowDecimal?: boolean
}) {
  const [active, setActive] = useState<string | null>(rows[0] ? String(rows[0].key) : null)
  const rowKeys = rows.map((r) => String(r.key)).join("|")
  useEffect(() => {
    if (!rows.some((r) => String(r.key) === active)) setActive(rows[0] ? String(rows[0].key) : null)
  }, [rowKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  const press = useCallback((k: string) => {
    if (!active) return
    let v = values[active] ?? ""
    if (k === "⌫") v = v.slice(0, -1)
    else if (k === ",") { if (!allowDecimal || v.includes(".")) return; v = (v || "0") + "." }
    else if (v === "0") v = k
    else if (v.replace(".", "").length < 7) v += k
    onChange({ ...values, [active]: v })
  }, [active, values, onChange, allowDecimal])

  const move = useCallback((d: number) => {
    const i = rows.findIndex((r) => String(r.key) === active)
    const n = rows[i + d]
    if (n) setActive(String(n.key))
  }, [rows, active])

  // Bàn phím máy tính: bỏ qua khi đang gõ vào ô nhập hoặc khi có hộp thoại mở.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (document.querySelector("[role=dialog]")) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === "," || e.key === ".") press(",")
      else if (e.key === "Backspace") press("⌫")
      else if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); move(1) }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [press, move])

  const n = rows.filter((r) => filled(values[String(r.key)])).length
  const cur = rows.find((r) => String(r.key) === active)
  const dv = cur ? values[String(cur.key)] : ""
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "," : "", "0", "⌫"]

  return (
    <div className="flex flex-wrap items-start gap-[18px]">
      <div className="flex min-w-0 flex-[999_1_300px] flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-base font-bold">{title}</div>
          <div className="text-sm font-semibold text-[#4f4a45] tabular">Đã nhập {n}/{rows.length}</div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e4e1]">
          <div className="h-full rounded-full bg-[#1c1917] transition-[width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: `${rows.length ? (n / rows.length) * 100 : 0}%` }} />
        </div>
        {rows.map((r) => {
          const k = String(r.key)
          const f = filled(values[k])
          const on = k === active
          return (
            <button key={k} type="button" aria-current={on} onClick={() => setActive(k)}
              className={cn("flex min-h-[72px] items-center justify-between gap-3 rounded-[18px] bg-[#fdfdfc] px-[18px] py-3 text-left transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(.34,1.4,.5,1)]",
                on ? "translate-x-1.5 shadow-[0_0_0_2px_#1c1917,0_18px_36px_-18px_rgba(41,37,36,.4)]" : "shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.07)]")}>
              <span className="flex min-w-0 flex-auto items-center gap-3">
                <span className={cn("flex size-7 flex-none items-center justify-center rounded-full text-[#fafaf9] transition-colors duration-300",
                  f ? "bg-[#0c7a0c]" : "shadow-[inset_0_0_0_2px_#a8a29e]")} aria-label={f ? "Đã nhập" : "Chưa nhập"}>
                  <CheckIcon className={cn("size-4 transition-opacity duration-300", f ? "opacity-100" : "opacity-0")} weight="bold" />
                </span>
                <span className="min-w-0 leading-[1.3]">
                  <span className="block text-base font-bold">{r.label}</span>
                  {r.hint && <span className="block text-[13px] text-[#4f4a45]">{r.hint}</span>}
                </span>
              </span>
              <span className={cn("flex-none font-display text-[30px] font-bold tabular", f ? "text-[#1c1917]" : "text-[#4f4a45]")}>
                {f ? viNum(values[k]) : "-"} <span className="font-sans text-[15px] font-medium text-[#4f4a45]">{fmtUnit(r.unit)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="sticky top-6 max-w-[420px] flex-[1_0_320px] rounded-[22px] bg-[#fdfdfc] p-3.5 shadow-[0_1px_2px_rgba(41,37,36,.05),0_18px_36px_-18px_rgba(41,37,36,.32),0_0_0_1px_rgba(28,25,23,.05)]">
        <div className="mx-1 mt-0.5 mb-2 text-sm text-[#4f4a45]">Đang nhập: <b className="text-[#1c1917]">{cur?.label ?? "-"}</b></div>
        <div className="on-dark relative overflow-hidden rounded-2xl bg-[#1c1917] px-[18px] pt-3.5 pb-3 text-[#fafaf9]">
          <div className="text-xs font-bold tracking-[.08em] text-[#d6d3d1]">SỐ ĐANG NHẬP</div>
          <div className="mt-2 flex items-baseline justify-end gap-2" aria-live="polite" aria-label={`${cur?.label ?? ""}: ${viNum(dv) || "0"} ${cur ? fmtUnit(cur.unit) : ""}`}>
            <Odometer text={viNum(dv) || "0"} dim={!dv} />
            <span className="text-xl font-semibold text-[#d6d3d1]">{cur ? fmtUnit(cur.unit) : ""}</span>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {keys.map((k, i) => k === "" ? <span key={i} /> : (
            <button key={k} type="button" onClick={() => press(k)} aria-label={k === "⌫" ? "Xóa một số" : k === "," ? "Dấu thập phân" : k}
              className={cn("flex h-[60px] items-center justify-center rounded-[14px] font-display text-[26px] font-bold shadow-[inset_0_-2px_0_rgba(28,25,23,.08)] transition-[transform,background-color] duration-150 hover:bg-[#e7e4e1] active:scale-[.92] active:bg-[#d6d3d1]",
                k === "⌫" || k === "," ? "bg-[#efedeb]" : "bg-[#f5f5f4]")}>
              {k === "⌫" ? <BackspaceIcon className="size-[26px]" /> : k}
            </button>
          ))}
        </div>
        <p className="mx-1 mt-2.5 text-xs text-[#4f4a45]">Có thể gõ số bằng bàn phím; Enter để sang dòng tiếp theo.</p>
      </div>
    </div>
  )
}

/** Nút hành động chính cuối màn: cam khi làm được, xám kèm lý do khi chưa. */
export function PrimaryAction({ ok, label, icon, onClick, busy }: { ok: boolean; label: string; icon: ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" disabled={!ok || busy} onClick={onClick}
      className={cn("flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl text-lg font-bold transition-[background-color,color,box-shadow,transform] duration-300 active:scale-[.985]",
        ok ? "bg-[#eb9360] text-[#1c1917] shadow-[inset_0_-3px_0_rgba(28,25,23,.15),0_18px_30px_-16px_rgba(235,147,96,.8)] hover:bg-[#f19c6a]" : "cursor-not-allowed bg-[#e7e4e1] text-[#4f4a45]")}>
      {icon}{busy ? "Đang xử lý..." : label}
    </button>
  )
}
