import { useQuery } from "@tanstack/react-query"
import { ShieldCheck } from "@/components/icons"
import { useEffect, useState, type ReactNode } from "react"

import { NumPad } from "@/components/NumPad"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar } from "@/layouts/TopBits"
import { api } from "@/lib/api"
import type { Role, StaffUser } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Xác nhận bằng PIN của một người có vai trò cho trước (bếp trưởng ký nhận, xác nhận hủy…). */
export function PinDialog({
  open,
  onOpenChange,
  title,
  description,
  role = "head_chef",
  busy,
  error,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: ReactNode
  role?: Role
  busy?: boolean
  error?: string | null
  onConfirm: (userId: number, pin: string) => void
  children?: ReactNode
}) {
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api.get<StaffUser[]>("/auth/staff"), enabled: open })
  const people = (staff.data ?? []).filter((u) => u.roles.includes(role))
  const [userId, setUserId] = useState<number | null>(null)
  const [pin, setPin] = useState("")

  useEffect(() => {
    if (!open) setPin("")
  }, [open])
  useEffect(() => {
    if (error) setPin("")
  }, [error])
  useEffect(() => {
    if (open && userId === null && people.length === 1) setUserId(people[0].id)
  }, [open, people, userId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="size-5 text-paprika-ink" aria-hidden />{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <div>
          <div className="mb-1.5 text-sm font-medium">Người xác nhận</div>
          <div className="grid grid-cols-2 gap-2">
            {people.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={userId === u.id}
                onClick={() => setUserId(u.id)}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-md border px-2.5 text-left text-sm font-semibold transition-colors",
                  userId === u.id ? "border-ink bg-ink text-white" : "hover:bg-muted",
                )}
              >
                <Avatar name={u.full_name} className={cn("size-7 text-xs", userId === u.id && "bg-white/15 text-white")} />
                <span className="truncate">{u.full_name}</span>
              </button>
            ))}
          </div>
        </div>
        <div role="status" className="flex justify-center gap-3 py-1" aria-live="polite" aria-label={`Đã nhập ${pin.length} số PIN`}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={cn("size-3.5 rounded-full border-2", i < pin.length ? "border-ink bg-ink" : "border-input")} />
          ))}
        </div>
        {error && <p className="text-center text-sm font-medium text-critical-ink" role="alert">{error}</p>}
        <NumPad value={pin} onChange={setPin} allowDecimal={false} maxLength={6} />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="xl" onClick={() => onOpenChange(false)}>Quay lại</Button>
          <Button size="xl" disabled={!userId || pin.length < 4 || busy} onClick={() => userId && onConfirm(userId, pin)}>
            {busy ? "Đang xác nhận…" : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
