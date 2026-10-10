import { AlertTriangle, HelpCircle } from "@/components/icons"
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Hộp thoại thay cho window.prompt / window.confirm: nút lớn cho máy tính bảng,
 * có sẵn các lý do hay dùng để chạm chọn thay vì gõ.
 */
interface ConfirmOpts {
  title: string
  description?: ReactNode
  confirmLabel?: string
  danger?: boolean
}
interface ReasonOpts extends ConfirmOpts {
  presets?: string[]
  defaultValue?: string
  placeholder?: string
}
type Pending =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "reason"; opts: ReasonOpts; resolve: (v: string | null) => void }

interface Ask {
  confirm: (o: ConfirmOpts) => Promise<boolean>
  reason: (o: ReasonOpts) => Promise<string | null>
}

const AskContext = createContext<Ask | null>(null)

export function AskProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [text, setText] = useState("")

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ kind: "confirm", opts, resolve })), [])
  const reason = useCallback((opts: ReasonOpts) => new Promise<string | null>((resolve) => {
    setText(opts.defaultValue ?? "")
    setPending({ kind: "reason", opts, resolve })
  }), [])

  const close = (ok: boolean) => {
    const p = pending
    if (!p) return
    if (p.kind === "confirm") p.resolve(ok)
    else p.resolve(ok && text.trim() ? text.trim() : null)
    setPending(null)
  }

  const o = pending?.opts
  const Icon = o?.danger ? AlertTriangle : HelpCircle
  return (
    <AskContext.Provider value={{ confirm, reason }}>
      {children}
      <Dialog open={!!pending} onOpenChange={(v) => !v && close(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Icon className={cn("size-5", o?.danger ? "text-critical-ink" : "text-paprika-ink")} aria-hidden />
              {o?.title}
            </DialogTitle>
            {o?.description && <DialogDescription className="text-sm">{o.description}</DialogDescription>}
          </DialogHeader>
          {pending?.kind === "reason" && (
            <form
              id="ask-form"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim()) close(true)
              }}
            >
              {!!pending.opts.presets?.length && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Lý do hay dùng">
                  {pending.opts.presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setText(p)}
                      className={cn(
                        "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors",
                        text === p ? "border-ink bg-ink text-ink-foreground" : "bg-card hover:bg-muted",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <Input
                autoFocus
                className="h-12"
                aria-label="Lý do"
                value={text}
                placeholder={pending.opts.placeholder ?? "Nhập lý do"}
                onChange={(e) => setText(e.target.value)}
              />
            </form>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="xl" onClick={() => close(false)}>Quay lại</Button>
            <Button
              size="xl"
              variant={o?.danger ? "danger" : "default"}
              type={pending?.kind === "reason" ? "submit" : "button"}
              form={pending?.kind === "reason" ? "ask-form" : undefined}
              disabled={pending?.kind === "reason" && !text.trim()}
              onClick={pending?.kind === "confirm" ? () => close(true) : undefined}
            >
              {o?.confirmLabel ?? "Đồng ý"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AskContext.Provider>
  )
}

export function useAsk(): Ask {
  const ctx = useContext(AskContext)
  if (!ctx) throw new Error("useAsk ngoài AskProvider")
  return ctx
}
