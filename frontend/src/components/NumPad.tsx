import { Delete } from "@/components/icons"

import { cn } from "@/lib/utils"

/** Bàn phím số lớn cho máy tính bảng: nhập số cân nhanh, ít thao tác (mục 9). */
export function NumPad({
  value,
  onChange,
  allowDecimal = true,
  maxLength = 7,
  className,
}: {
  value: string
  onChange: (v: string) => void
  allowDecimal?: boolean
  maxLength?: number
  className?: string
}) {
  const press = (k: string) => {
    if (k === "del") return onChange(value.slice(0, -1))
    if (k === "clear") return onChange("")
    if (k === ",") {
      if (!allowDecimal || value.includes(".")) return
      return onChange((value || "0") + ".")
    }
    if (value.replace(".", "").length >= maxLength) return
    onChange(value === "0" ? k : value + k)
  }
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", allowDecimal ? "," : "clear", "0", "del"]
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {keys.map((k) => {
        const fn = k === "del" || k === "clear"
        return (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "del" ? "Xóa một số" : k === "clear" ? "Xóa hết" : k === "," ? "Dấu thập phân" : k}
            className={cn(
              "flex h-14 select-none items-center justify-center rounded-xl text-2xl font-semibold tabular",
              "transition-[background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.95] active:bg-ink active:text-ink-foreground",
              fn ? "bg-secondary text-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]" : "border border-border bg-card shadow-[0_1px_2px_rgb(28_25_23/0.06)] hover:shadow-soft",
            )}
          >
            {k === "del" ? <Delete className="size-6" /> : k === "clear" ? <span className="text-base">Xóa</span> : k}
          </button>
        )
      })}
    </div>
  )
}

export function displayNum(v: string): string {
  return v === "" ? "0" : v.replace(".", ",")
}
