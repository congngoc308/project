/** Mảnh giao diện dùng chung cho các màn của thủ kho (thiết kế "Thu Kho v2"). */
import { CheckCircleIcon, type Icon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { time } from "@/lib/format"
import { cn } from "@/lib/utils"

export const CARD = "rounded-[22px] bg-[#fdfdfc] shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-10px_rgba(41,37,36,.14),0_0_0_1px_rgba(28,25,23,.05)]"
export const TONE = {
  good: "bg-[#e3f4e3] text-[#004d00]",
  warn: "bg-[#fdf0d2] text-[#6b4300]",
  bad: "bg-[#fbe3e3] text-[#8f1a1a]",
  neutral: "bg-[#efedeb] text-[#4f4a45]",
} as const
export type StoreTone = keyof typeof TONE

export function StoreHeader({ icon: I, title, desc }: { icon: Icon; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex size-[52px] flex-none items-center justify-center rounded-[14px] bg-[#fbeae0] text-[#7c3410]"><I className="size-7" aria-hidden /></div>
      <div>
        <h1 className="m-0 text-4xl leading-[1.1] font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-1.5 max-w-[720px] text-base text-[#4f4a45]">{desc}</p>
      </div>
    </div>
  )
}

export function Pill({ tone, children, className }: { tone: StoreTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap", TONE[tone], className)}>{children}</span>
}

/** Ca hiện tại + trạng thái, đặt trên dải đầu màn bàn giao / cân trả. */
export function ShiftBadge() {
  const { me } = useAuth()
  const now = useServerNow(30_000)
  const s = me?.shift
  if (!s) return <span className="font-display text-[17px] font-bold">Ngoài giờ ca</span>
  const late = s.status === "open" && now.getTime() >= new Date(s.planned_end).getTime()
  const [tone, label]: [StoreTone, string] = late ? ["bad", "Đến giờ cân trả"] : s.status === "open" ? ["good", "Đang mở"] : s.status === "closed" ? ["neutral", "Đã đóng"] : ["warn", "Chưa nhận bàn giao"]
  return (
    <div className="flex flex-none items-center gap-2.5 whitespace-nowrap">
      <span className="font-display text-[17px] font-bold">{s.name} {time(s.planned_start)}-{time(s.planned_end)}</span>
      <Pill tone={tone}>{label}</Pill>
    </div>
  )
}

export function Strip({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3.5 rounded-[18px] bg-[#fdfdfc] px-5 py-3.5 shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.06)]">
      {children}
    </div>
  )
}

export function EmptyCard({ icon: I, title, text, action }: { icon: Icon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[26px] border-2 border-dashed border-[#d6d3d1] px-8 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-[18px] bg-[#efedeb]"><I className="size-[34px] text-[#4f4a45]" aria-hidden /></div>
      <div className="font-display text-2xl font-bold tracking-[-.02em]">{title}</div>
      <p className="m-0 max-w-[440px] text-[15px] text-[#4f4a45]">{text}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

export function DoneCard({ title, text, items, children }: { title: string; text: string; items?: { label: string; value: string }[]; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-[#fdfdfc] p-8 shadow-[0_1px_2px_rgba(41,37,36,.05),0_18px_36px_-18px_rgba(41,37,36,.32),0_0_0_1px_rgba(28,25,23,.05)]">
      <div className="flex size-16 items-center justify-center rounded-full bg-[#e3f4e3] text-[#004d00]"><CheckCircleIcon className="size-[38px]" aria-hidden /></div>
      <div>
        <div className="font-display text-[30px] font-bold tracking-[-.025em]">{title}</div>
        <p className="mt-1.5 text-base text-[#4f4a45]">{text}</p>
      </div>
      {!!items?.length && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {items.map((d) => (
            <div key={d.label} className="rounded-[14px] bg-[#f5f5f4] px-3.5 py-3">
              <div className="text-[13px] font-semibold text-[#4f4a45]">{d.label}</div>
              <div className="font-display text-[22px] font-bold tabular">{d.value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  )
}

export function Btn({ kind = "primary", className, ...props }: React.ComponentProps<"button"> & { kind?: "primary" | "outline" | "ink" }) {
  return (
    <button type="button" {...props}
      className={cn("inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] px-[22px] text-base font-bold whitespace-nowrap transition-transform duration-200 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60",
        kind === "primary" && "bg-[#eb9360] text-[#1c1917] shadow-[inset_0_-2px_0_rgba(28,25,23,.15)] hover:bg-[#f19c6a]",
        kind === "outline" && "border-[1.5px] border-[#d6d3d1] bg-transparent text-[#1c1917] hover:bg-[#efedeb]",
        kind === "ink" && "bg-[#1c1917] text-[#fafaf9] hover:bg-[#292524]",
        className)} />
  )
}
