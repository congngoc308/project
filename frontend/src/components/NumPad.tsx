import { ArrowRight, Delete } from "@/components/icons"

import { cn } from "@/lib/utils"

/** Bàn phím số lớn cho máy tính bảng: nhập số cân nhanh, ít thao tác (mục 9). */
export function NumPad({
  value,
  onChange,
  allowDecimal = true,
  maxLength = 7,
  onEnter,
  enterLabel = "Vào",
  enterDisabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  allowDecimal?: boolean
  maxLength?: number
  /** Có onEnter thì ô góc phải dưới thành phím xác nhận (dùng cho PIN), phím xóa dời sang trái. */
  onEnter?: () => void
  enterLabel?: string
  enterDisabled?: boolean
  className?: string
}) {
  const press = (k: string) => {
    if (k === "enter") return onEnter?.()
    if (k === "del") return onChange(value.slice(0, -1))
    if (k === "clear") return onChange("")
    if (k === ",") {
      if (!allowDecimal || value.includes(".")) return
      return onChange((value || "0") + ".")
    }
    if (value.replace(".", "").length >= maxLength) return
    // Số cân bỏ số 0 ở đầu ("05" thành "5"); mã PIN (không có dấu phẩy) giữ nguyên, "0000" là PIN hợp lệ.
    onChange(allowDecimal && value === "0" ? k : value + k)
  }
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ...(onEnter ? ["del", "0", "enter"] : [allowDecimal ? "," : "clear", "0", "del"])]
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {keys.map((k) => {
        const fn = k === "del" || k === "clear"
        const enter = k === "enter"
        return (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={enter && enterDisabled}
            aria-label={k === "del" ? "Xóa một số" : k === "clear" ? "Xóa hết" : k === "," ? "Dấu thập phân" : enter ? enterLabel : k}
            className={cn(
              "flex h-14 select-none items-center justify-center rounded-xl text-2xl font-semibold tabular",
              "transition-[background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.95] active:bg-ink active:text-ink-foreground",
              enter ? "gap-1.5 bg-primary text-base text-primary-foreground hover:bg-[var(--primary-hover)] disabled:pointer-events-none disabled:bg-secondary disabled:text-muted-foreground"
                : fn ? "bg-secondary text-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]"
                : "border border-border bg-card shadow-[0_1px_2px_rgb(28_25_23/0.06)] hover:shadow-soft",
            )}
          >
            {k === "del" ? <Delete className="size-6" /> : k === "clear" ? <span className="text-base">Xóa</span> : enter ? <>{enterLabel} <ArrowRight className="size-5" aria-hidden /></> : k}
          </button>
        )
      })}
    </div>
  )
}

export function displayNum(v: string): string {
  return v === "" ? "0" : v.replace(".", ",")
}
