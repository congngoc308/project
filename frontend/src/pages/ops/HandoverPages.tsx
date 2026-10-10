import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ChefHat, CheckCircle2, EyeOff, PenLine, Plus, Truck } from "@/components/icons"
import { useState } from "react"
import { toast } from "sonner"

import { useAsk } from "@/components/ask"
import { Callout, Empty, Loading, PageHeader, StatusPill } from "@/components/common"
import { PinDialog } from "@/components/PinDialog"
import { allFilled, toNumbers, WeighList } from "@/components/WeighList"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { dateTime, qty } from "@/lib/format"
import type { Handover, Ingredient } from "@/lib/types"
import { errorText, useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { ShiftChip } from "@/layouts/TopBits"

interface Mismatch {
  line_id: number
  ingredient: string
  issued_qty: number
  received_qty: number
  unit: string
}

/** Thanh tiến trình 3 bước của một lần bàn giao. */
function HandoverSteps({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Thủ kho cân xuất", "Bếp trưởng cân lại", "Ký nhận bằng PIN"]
  return (
    <ol className="mb-4 grid grid-cols-3 gap-1.5" aria-label="Các bước bàn giao">
      {steps.map((s, i) => {
        const n = i + 1
        const state = n < step ? "done" : n === step ? "now" : "next"
        return (
          <li key={s} aria-current={state === "now" ? "step" : undefined}
            className={cn("rounded-md border-t-4 bg-card px-2.5 py-2 text-xs sm:text-sm",
              state === "done" && "border-t-primary text-muted-foreground",
              state === "now" && "border-t-ink font-semibold",
              state === "next" && "border-t-border text-muted-foreground")}>
            <span className="tabular">{n}.</span> {s}
            {state === "done" && <CheckCircle2 className="ml-1 inline size-4 text-paprika-ink" aria-label="xong" />}
          </li>
        )
      })}
    </ol>
  )
}

/** Bếp trưởng cân lại từng nguyên liệu (không thấy số thủ kho cân xuất) rồi ký bằng PIN. */
function SignPanel({ h, onDone }: { h: Handover; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [pinOpen, setPinOpen] = useState(false)
  const [mismatch, setMismatch] = useState<Mismatch[] | null>(null)
  const sign = useAction(
    (v: { userId: number; pin: string }) =>
      api.post(`/handovers/${h.id}/sign`, { signer_id: v.userId, pin: v.pin, received: toNumbers(values) }),
    {
      success: "Đã ký nhận: tồn chuyển sang Bếp, gắn với bếp trưởng ca",
      invalidate: [["handovers"], ["me"]],
      quietError: true,
      onSuccess: () => {
        setPinOpen(false)
        onDone()
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409 && Array.isArray(e.data)) {
          setPinOpen(false)
          setMismatch(e.data as Mismatch[])
        }
      },
    },
  )
  const rows = h.lines.map((l) => ({ key: l.id, label: l.ingredient, unit: l.unit, hint: "Bếp trưởng tự cân lại" }))
  const ready = allFilled(rows, values)
  return (
    <div className="space-y-4">
      <HandoverSteps step={ready ? 3 : 2} />
      <Callout icon={EyeOff} title="Cân lại độc lập">
        Màn này không hiện số thủ kho đã cân xuất. Bếp trưởng đặt từng loại lên cân và nhập đúng số trên cân.
      </Callout>
      {mismatch && (
        <Callout tone="bad" icon={AlertTriangle} title="Số cân hai bên lệch quá dung sai: cân lại trước khi ký">
          <ul className="mt-1 list-disc pl-5">
            {mismatch.map((m) => (
              <li key={m.line_id}>{m.ingredient}: thủ kho xuất {qty(m.issued_qty, m.unit)}, bếp cân {qty(m.received_qty, m.unit)}</li>
            ))}
          </ul>
          <p className="mt-1">Lần ký bị từ chối đã được lưu làm bằng chứng. Nếu kho thật sự thiếu, thủ kho hủy phiếu và cân xuất lại.</p>
        </Callout>
      )}
      <WeighList rows={rows} values={values} onChange={setValues} title="Số bếp trưởng cân được" />
      <Button size="touch" className="w-full" disabled={!ready} onClick={() => { setMismatch(null); setPinOpen(true) }}>
        <PenLine /> {ready ? "Bếp trưởng ký nhận bằng PIN" : "Nhập đủ số cân để ký"}
      </Button>
      <PinDialog
        open={pinOpen}
        onOpenChange={(v) => { setPinOpen(v); if (!v) sign.reset() }}
        title={`Ký nhận bàn giao ${h.code}`}
        description="Ký nhận = chịu trách nhiệm số hàng này trong ca. Chênh lệch khi cân trả cuối ca gắn với người ký."
        busy={sign.isPending}
        error={sign.error instanceof ApiError && sign.error.status !== 409 ? errorText(sign.error) : null}
        onConfirm={(userId, pin) => sign.mutate({ userId, pin })}
      />
    </div>
  )
}

function HandoverCard({ h, active, onOpen }: { h: Handover; active: boolean; onOpen?: () => void }) {
  const status = h.status === "signed" ? { tone: "good" as const, label: "Đã ký" } : h.status === "pending" ? { tone: "warn" as const, label: "Chờ bếp ký" } : { tone: "neutral" as const, label: "Đã hủy" }
  const Tag = onOpen ? "button" : "div"
  return (
    <Tag type={onOpen ? "button" : undefined} onClick={onOpen}
      className={cn("block w-full surface p-3 text-left", onOpen && "transition-colors hover:bg-muted", active && "outline-2 outline-ink")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{h.code} · {h.kind === "start" ? "Đầu ca" : "Bổ sung"}</span>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {h.shift.name} {h.shift.business_date.slice(8, 10)}/{h.shift.business_date.slice(5, 7)} · xuất {dateTime(h.issued_at)} bởi {h.issued_by}
        {h.received_by && ` · ${h.received_by} ký ${dateTime(h.signed_at)}`}
      </div>
      {/* Phiếu chờ ký không hiện số cân xuất: bếp trưởng cân lại độc lập trên cùng máy. */}
      <div className="mt-1 text-sm">{h.lines.map((l) => l.issued_qty !== null && h.status !== "pending" ? `${l.ingredient} ${qty(l.issued_qty, l.unit)}` : l.ingredient).join(" · ")}</div>
    </Tag>
  )
}

/** Màn thủ kho: tạo phiếu bàn giao đầu ca / bổ sung; bếp trưởng ký ngay trên máy này. */
export function StoreHandoverPage() {
  const { me } = useAuth()
  const ask = useAsk()
  const list = useQuery({ queryKey: ["handovers"], queryFn: () => api.get<Handover[]>("/handovers") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const groupA = (ings.data ?? []).filter((i) => i.control_group === "A" && i.active)
  const [creating, setCreating] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<number | null>(null)
  const shiftOpen = me?.shift?.status === "open"
  const kind = shiftOpen ? "supplement" : "start"

  const create = useAction(
    () => api.post<Handover>("/handovers", {
      kind,
      lines: Object.entries(toNumbers(values)).filter(([, q]) => q > 0).map(([id, q]) => ({ ingredient_id: Number(id), qty: q })),
    }),
    {
      success: (h) => `Đã tạo ${h.code}. Đưa máy cho bếp trưởng cân lại và ký.`,
      invalidate: [["handovers"]],
      onSuccess: (h) => { setCreating(false); setValues({}); setOpenId(h.id) },
    },
  )
  const cancel = useAction((id: number) => api.post(`/handovers/${id}/cancel`, { note: "Thủ kho hủy để cân xuất lại" }),
    { success: "Đã hủy phiếu", invalidate: [["handovers"]], onSuccess: () => setOpenId(null) })

  const pending = (list.data ?? []).filter((h) => h.status === "pending")
  const recent = (list.data ?? []).filter((h) => h.status !== "pending").slice(0, 4)
  const opened = pending.find((h) => h.id === openId)
  const hasQty = Object.values(values).some((v) => Number(v) > 0)

  return (
    <div>
      <PageHeader title="Bàn giao Kho → Bếp" icon={Truck}
        description="Thủ kho cân xuất nhóm A, đưa máy cho bếp trưởng cân lại và ký PIN. Chỉ khi ký xong hàng mới chuyển sang Bếp." />
      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <div className="surface p-3">
            <div className="mb-1.5 text-sm text-muted-foreground">Ca hiện tại</div>
            <ShiftChip shift={me?.shift} />
            <Button size="touch" className="mt-3 w-full" onClick={() => { setCreating(true); setOpenId(null) }}>
              <Plus /> {shiftOpen ? "Bàn giao bổ sung giữa ca" : "Bàn giao đầu ca"}
            </Button>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold">Chờ bếp trưởng ký ({pending.length})</h2>
            <div className="space-y-2">
              {pending.length ? pending.map((h) => (
                <HandoverCard key={h.id} h={h} active={openId === h.id} onOpen={() => { setOpenId(h.id); setCreating(false) }} />
              )) : <Empty>Không có phiếu chờ ký</Empty>}
            </div>
          </div>
          {recent.length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold">Gần đây</h2>
              <div className="space-y-2">{recent.map((h) => <HandoverCard key={h.id} h={h} active={false} />)}</div>
            </div>
          )}
        </div>

        <div>
          {list.isLoading || ings.isLoading ? <Loading /> : creating ? (
            <div className="space-y-4">
              <HandoverSteps step={1} />
              <h2 className="text-lg font-bold">{kind === "start" ? "Bàn giao đầu ca" : "Bàn giao bổ sung"}: cân xuất nhóm A</h2>
              <WeighList rows={groupA.map((i) => ({ key: i.id, label: i.name, unit: i.base_unit, hint: "Để trống nếu không xuất" }))}
                values={values} onChange={setValues} title="Số thủ kho cân xuất" />
              <div className="flex gap-2">
                <Button variant="outline" size="touch" onClick={() => setCreating(false)}>Quay lại</Button>
                <Button size="touch" className="flex-1" disabled={!hasQty || create.isPending} onClick={() => create.mutate(undefined)}>
                  <CheckCircle2 /> {hasQty ? "Tạo phiếu, chuyển bếp trưởng ký" : "Nhập ít nhất một nguyên liệu"}
                </Button>
              </div>
            </div>
          ) : opened ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold"><ChefHat className="size-5" aria-hidden /> {opened.code}: đưa máy cho bếp trưởng</h2>
                <Button variant="outline" size="lg" onClick={async () => {
                  if (await ask.confirm({ title: `Hủy phiếu ${opened.code}?`, description: "Dùng khi cần cân xuất lại. Phiếu đã hủy vẫn được lưu để truy vết.", confirmLabel: "Hủy phiếu", danger: true }))
                    cancel.mutate(opened.id)
                }}>Hủy phiếu</Button>
              </div>
              <SignPanel h={opened} onDone={() => { setOpenId(null); toast.success("Bàn giao hoàn tất") }} />
            </div>
          ) : (
            <Empty icon={Truck} action={<Button size="xl" onClick={() => setCreating(true)}><Plus /> {shiftOpen ? "Bàn giao bổ sung" : "Bàn giao đầu ca"}</Button>}>
              Chọn một phiếu đang chờ ký ở bên trái, hoặc tạo phiếu bàn giao mới.
            </Empty>
          )}
        </div>
      </div>
    </div>
  )
}

/** Màn bếp trưởng: ký nhận các phiếu chờ trên thiết bị của mình. */
export function ChefHandoverPage() {
  const list = useQuery({ queryKey: ["handovers", "pending"], queryFn: () => api.get<Handover[]>("/handovers?status=pending") })
  const [openId, setOpenId] = useState<number | null>(null)
  const pending = list.data ?? []
  const opened = pending.find((h) => h.id === openId) ?? pending[0]
  return (
    <div>
      <PageHeader title="Nhận bàn giao" icon={ChefHat}
        description="Cân lại từng nguyên liệu thủ kho giao, nhập số trên cân rồi ký PIN. Bạn chịu trách nhiệm số hàng này đến khi cân trả cuối ca." />
      {list.isLoading ? <Loading /> : !pending.length ? (
        <Empty icon={CheckCircle2}>Không có phiếu bàn giao nào chờ bạn ký.</Empty>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">{pending.map((h) => <HandoverCard key={h.id} h={h} active={opened?.id === h.id} onOpen={() => setOpenId(h.id)} />)}</div>
          {opened && <SignPanel key={opened.id} h={opened} onDone={() => setOpenId(null)} />}
        </div>
      )}
    </div>
  )
}
