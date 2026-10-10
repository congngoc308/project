import { ArrowRight, CheckCircle2, Circle } from "@/components/icons"
import { useEffect, useState, type ReactNode } from "react"

import { displayNum, NumPad } from "@/components/NumPad"
import { Button } from "@/components/ui/button"
import { unit as fmtUnit } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface WeighRow {
  key: string | number
  label: ReactNode
  unit: string
  hint?: ReactNode
}

/** Danh sách nguyên liệu cần cân/đếm: chạm một dòng rồi nhập bằng bàn phím số lớn. */
export function WeighList({
  rows,
  values,
  onChange,
  title,
}: {
  rows: WeighRow[]
  values: Record<string, string>
  onChange: (v: Record<string, string>) => void
  title?: ReactNode
}) {
  const [active, setActive] = useState<string | null>(rows[0] ? String(rows[0].key) : null)
  useEffect(() => {
    if (active === null && rows[0]) setActive(String(rows[0].key))
  }, [rows, active])
  const current = rows.find((r) => String(r.key) === active)
  const filledCount = rows.filter((r) => isFilled(values[String(r.key)])).length
  const idx = rows.findIndex((r) => String(r.key) === active)
  const next = rows[idx + 1]
  return (
    <div className="grid items-start gap-4 md:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          {title && <div className="text-base font-semibold">{title}</div>}
          <div className="ml-auto text-sm tabular text-muted-foreground">Đã nhập {filledCount}/{rows.length}</div>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => {
            const k = String(r.key)
            const filled = isFilled(values[k])
            const on = active === k
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setActive(k)}
                  aria-current={on}
                  className={cn(
                    "flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-[box-shadow,border-color] duration-200",
                    on ? "border-ink shadow-lift ring-1 ring-ink" : "border-border shadow-[0_1px_2px_rgb(28_25_23/0.05)] hover:shadow-soft",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {filled
                      ? <CheckCircle2 weight="fill" className="size-6 shrink-0 text-good-ink" aria-label="Đã nhập" />
                      : <Circle className="size-6 shrink-0 text-input" aria-label="Chưa nhập" />}
                    <span className="min-w-0">
                      <span className="block text-base font-semibold">{r.label}</span>
                      {r.hint && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-display text-3xl font-bold tabular", !filled && "text-muted-foreground")}>
                    {filled ? displayNum(values[k]) : "-"} <span className="text-base font-normal text-muted-foreground">{fmtUnit(r.unit)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {current && (
        <div className="rounded-2xl bg-card p-3.5 shadow-soft ring-1 ring-stone-900/5 md:sticky md:top-40">
          <div className="mb-2 text-sm text-muted-foreground">Đang nhập: <span className="font-semibold text-foreground">{current.label}</span></div>
          <div className="on-dark mb-3 rounded-xl bg-ink px-4 py-3 text-right font-display text-5xl font-bold tabular text-ink-foreground" aria-live="polite">
            {displayNum(values[String(current.key)] ?? "")} <span className="font-sans text-lg font-medium text-stone-300">{fmtUnit(current.unit)}</span>
          </div>
          <NumPad value={values[String(current.key)] ?? ""} onChange={(v) => onChange({ ...values, [String(current.key)]: v })} />
          <Button variant="secondary" size="xl" className="mt-2 w-full" disabled={!next} onClick={() => next && setActive(String(next.key))}>
            {next ? <>Tiếp: {next.label} <ArrowRight className="size-4" /></> : "Đã tới dòng cuối"}
          </Button>
        </div>
      )}
    </div>
  )
}

function isFilled(v: string | undefined) {
  return v !== undefined && v !== ""
}

export function allFilled(rows: WeighRow[], values: Record<string, string>): boolean {
  return rows.every((r) => isFilled(values[String(r.key)]))
}

export function toNumbers(values: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]))
}
