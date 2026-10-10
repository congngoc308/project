/**
 * Biểu đồ SVG nhỏ theo skill dataviz: cột mảnh ≤ 24px, đầu bo 4px vuông ở đường gốc, khe 2px,
 * lưới mảnh liền nét, chữ dùng màu chữ (không dùng màu dữ liệu), tooltip khi rê chuột/focus,
 * và luôn có chế độ xem bảng.
 */
import { Table2, BarChart3 } from "@/components/icons"
import { useMemo, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SHORT = "var(--diverge-short)"
const SURPLUS = "var(--diverge-surplus)"

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
}: {
  title: string
  subtitle?: ReactNode
  legend?: ReactNode
  table: ReactNode
  children: ReactNode
  className?: string
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <figure className={cn("rounded-2xl bg-[var(--chart-surface)] p-5 shadow-soft ring-1 ring-stone-900/5", className)}>
      <figcaption className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setAsTable((v) => !v)}>
          {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
          {asTable ? "Biểu đồ" : "Bảng"}
        </Button>
      </figcaption>
      {legend && !asTable && <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{legend}</div>}
      {asTable ? <div className="max-h-80 overflow-auto">{table}</div> : children}
    </figure>
  )
}

export function LegendSwatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  )
}

export const DivergeLegend = () => (
  <>
    <LegendSwatch color={SHORT}>Thiếu (thất thoát)</LegendSwatch>
    <LegendSwatch color={SURPLUS}>Thừa</LegendSwatch>
  </>
)

function niceTicks(maxAbs: number, count = 2): number[] {
  if (maxAbs <= 0) return [0]
  const raw = maxAbs / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = step; v <= maxAbs + step * 0.001; v += step) out.push(v)
  return out
}

/** Cột theo thời gian quanh đường 0: thiếu đi lên (đỏ), thừa đi xuống (xanh). */
export function DivergingColumns({
  data,
  format,
  label,
  height = 180,
}: {
  data: { key: string; value: number }[]
  format: (v: number) => string
  label: (key: string) => string
  height?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const padL = 56
  const padR = 8
  const padT = 8
  const axisH = 22
  const plotH = height - padT - axisH
  const posMax = Math.max(0, ...data.map((d) => d.value))
  const negMax = Math.max(0, ...data.map((d) => -d.value))
  const ticks = niceTicks(Math.max(1, posMax, negMax))
  const step = ticks[0] ?? 1
  // Mỗi phía được chia đủ khoảng theo bước lưới; phía không có dữ liệu không chiếm chỗ.
  const top = posMax > 0 ? Math.ceil(posMax / step) * step : 0
  const bottom = negMax <= 0 ? 0 : negMax >= step * 0.6 ? Math.ceil(negMax / step) * step : Math.max(negMax, top * 0.06)
  const range = Math.max(step, top + bottom)
  const y0 = padT + (top / range) * plotH
  const scale = (v: number) => (v / range) * plotH
  const band = (width - padL - padR) / Math.max(1, data.length)
  const barW = Math.min(24, Math.max(3, band - 2))
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <div ref={wrap} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="group" aria-label="Biểu đồ cột chênh lệch theo ngày">
        {[...ticks.filter((t) => t <= top), ...ticks.filter((t) => t <= bottom).map((t) => -t)].map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y0 - scale(t)} y2={y0 - scale(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padL - 6} y={y0 - scale(t) + 4} textAnchor="end" fontSize={12} fill="var(--chart-muted)" className="tabular">
              {format(t)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={width - padR} y1={y0} y2={y0} stroke="var(--chart-axis)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padL + i * band + (band - barW) / 2
          const h = Math.abs(scale(d.value))
          const r = Math.min(4, h, barW / 2)
          const up = d.value >= 0
          const path = h === 0 ? "" : up
            ? `M${x},${y0} V${y0 - h + r} Q${x},${y0 - h} ${x + r},${y0 - h} H${x + barW - r} Q${x + barW},${y0 - h} ${x + barW},${y0 - h + r} V${y0} Z`
            : `M${x},${y0} V${y0 + h - r} Q${x},${y0 + h} ${x + r},${y0 + h} H${x + barW - r} Q${x + barW},${y0 + h} ${x + barW},${y0 + h - r} V${y0} Z`
          return (
            <g key={d.key}>
              {path && <path d={path} fill={up ? SHORT : SURPLUS} opacity={hover === null || hover === i ? 1 : 0.55} />}
              <rect
                x={padL + i * band}
                y={padT}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${label(d.key)}: ${format(d.value)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
              {i % labelEvery === 0 && (
                <text x={padL + i * band + band / 2} y={height - 6} textAnchor="middle" fontSize={12} fill="var(--chart-muted)">
                  {label(d.key)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((padL + hover * band + band / 2) / width) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="font-semibold tabular">{format(data[hover].value)}</div>
          <div className="text-muted-foreground">{label(data[hover].key)} · {data[hover].value >= 0 ? "thiếu" : "thừa"}</div>
        </div>
      )}
    </div>
  )
}

/** Thanh ngang so sánh độ lớn; diverging = có cả âm và dương quanh đường gốc giữa. */
export function HBars({
  rows,
  format,
  diverging = true,
}: {
  rows: { key: string; label: ReactNode; value: number; sub?: ReactNode }[]
  format: (v: number) => string
  diverging?: boolean
}) {
  const [hover, setHover] = useState<string | null>(null)
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  const hasNeg = diverging && rows.some((r) => r.value < 0)
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const w = (Math.abs(r.value) / maxAbs) * (hasNeg ? 50 : 100)
        const neg = r.value < 0
        return (
          <div
            key={r.key}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
            onPointerEnter={() => setHover(r.key)}
            onPointerLeave={() => setHover(null)}
          >
            <div className="truncate">
              {r.label}
              {r.sub && <div className="truncate text-xs text-muted-foreground">{r.sub}</div>}
            </div>
            <div className="relative h-3">
              {hasNeg && <div className="absolute inset-y-[-3px] left-1/2 w-px bg-[var(--chart-axis)]" />}
              <div
                className="absolute top-0 h-3"
                style={{
                  width: `${w}%`,
                  left: hasNeg ? (neg ? `${50 - w}%` : "50%") : 0,
                  background: neg ? SURPLUS : diverging ? SHORT : "var(--series-1)",
                  borderRadius: neg ? "4px 0 0 4px" : "0 4px 4px 0",
                  opacity: hover === null || hover === r.key ? 1 : 0.55,
                }}
                title={format(r.value)}
              />
            </div>
            <div className="w-24 text-right font-medium tabular">{format(r.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

/** Thanh tỉ lệ một ramp: phần tô = phần đúng lúc, nền = cùng tông nhạt hơn. */
export function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  const p = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-display text-2xl font-bold tabular">{total > 0 ? `${p}%` : "-"}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#cde2fb]">
        <div className="h-2.5 rounded-full bg-[var(--series-1)]" style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "bad" | "warn" | "good" }) {
  return (
    <div className="h-full rounded-2xl bg-card p-5 shadow-soft ring-1 ring-stone-900/5 transition-shadow duration-200 hover:shadow-lift">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-display text-4xl font-bold tabular",
        tone === "bad" && "text-critical-ink", tone === "warn" && "text-warning-ink", tone === "good" && "text-good-ink")}>
        {value}
      </div>
      {hint && <div className="mt-2 text-sm text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function useSorted<T>(rows: T[], key: (r: T) => number) {
  return useMemo(() => [...rows].sort((a, b) => Math.abs(key(b)) - Math.abs(key(a))), [rows, key])
}
