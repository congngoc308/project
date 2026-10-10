import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ChefHat, CheckCircle2, EyeOff, PenLine, PenNib, Plus, Truck } from "@/components/icons"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { useAsk } from "@/components/ask"
import { Callout, Empty, Loading, PageHeader, StatusPill } from "@/components/common"
import { PinDialog } from "@/components/PinDialog"
import { allFilled, toNumbers, WeighList } from "@/components/WeighList"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { dateTime, num, qty, time, unit } from "@/lib/format"
import type { Handover, Ingredient } from "@/lib/types"
import { errorText, useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { ShiftChip } from "@/layouts/TopBits"
import { ChefPin, chime, KDialog, KeyPad, kToast, Panel, useFlip } from "@/layouts/KitchenBits"

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

/** Màn bếp trưởng (thiết kế "Nhan vien Bep v4"): chọn phiếu chờ ký, tự cân lại từng dòng bằng bàn phím số, ký bằng PIN. */
export function ChefHandoverPage() {
  const list = useQuery({ queryKey: ["handovers", "pending"], queryFn: () => api.get<Handover[]>("/handovers?status=pending") })
  const pending = list.data ?? []
  const [openId, setOpenId] = useState<number | null>(null)
  const opened = pending.find((h) => h.id === openId) ?? pending[0]
  const pageRef = useRef<HTMLDivElement>(null)
  useFlip(pageRef, !!list.data)
  return (
    <div ref={pageRef}>
      <div data-stagger>
        <h1 className="font-display text-[36px] leading-tight font-extrabold">Nhận bàn giao</h1>
        <p className="mt-1.5 text-[17px] text-[#3d3833]">Cân lại từng nguyên liệu thủ kho giao, nhập số trên cân rồi ký PIN. Bạn chịu trách nhiệm số hàng này đến khi cân trả cuối ca.</p>
      </div>
      {list.isLoading ? <div className="mt-6"><Loading /></div> : !pending.length ? (
        <div data-stagger className="mt-[22px] flex flex-col items-center gap-2.5 rounded-[26px] border-2 border-dashed border-[#b9b0a3] px-5 py-16 text-[19px] text-[#3d3833]">
          <CheckCircle2 className="size-[52px] text-[#15803d]" aria-hidden />Không có phiếu bàn giao nào chờ bạn ký.
        </div>
      ) : (
        <div className="mt-[22px] grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3" role="list" aria-label="Phiếu chờ ký">
            {pending.map((h) => {
              const on = opened?.id === h.id
              return (
                <button key={h.id} type="button" role="listitem" data-flip={`h${h.id}`} aria-current={on || undefined} onClick={() => setOpenId(h.id)}
                  className={cn("flex flex-col gap-2 rounded-[20px] border-[3px] bg-white px-[18px] py-4 text-left transition-colors duration-200", on ? "border-[#141210]" : "border-[#cdc5ba] hover:border-[#8a817c]")}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[19px] font-extrabold">{h.code}</span>
                    <span className="rounded-full bg-[#fef3c7] px-2.5 py-[3px] text-sm font-extrabold whitespace-nowrap text-[#713f12]">Chờ bếp ký</span>
                  </span>
                  <span className="text-[15px] leading-snug text-[#3d3833]">
                    {h.kind === "start" ? "Đầu ca" : "Bổ sung giữa ca"} · {h.shift.name} {h.shift.business_date.slice(8, 10)}/{h.shift.business_date.slice(5, 7)}
                    <br />Xuất {time(h.issued_at)} bởi {h.issued_by}
                  </span>
                  {/* Phiếu chờ ký không hiện số cân xuất: bếp trưởng cân lại độc lập. */}
                  <span className="text-base font-bold">{h.lines.map((l) => l.ingredient).join(", ")}</span>
                </button>
              )
            })}
          </div>
          {opened && <ChefSign key={opened.id} h={opened} onDone={() => setOpenId(null)} />}
        </div>
      )}
    </div>
  )
}

function ChefSign({ h, onDone }: { h: Handover; onDone: () => void }) {
  const [vals, setVals] = useState<Record<number, string>>({})
  const [row, setRow] = useState<number>(h.lines[0]?.id)
  const [mismatch, setMismatch] = useState<Mismatch[] | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const sign = useAction(
    (v: { userId: number; pin: string }) =>
      api.post(`/handovers/${h.id}/sign`, { signer_id: v.userId, pin: v.pin, received: Object.fromEntries(Object.entries(vals).map(([k, x]) => [k, Number(x)])) }),
    {
      invalidate: [["handovers"], ["me"]],
      quietError: true,
      onSuccess: () => {
        setPinOpen(false)
        chime("ok")
        kToast(`Đã ký nhận ${h.code}`, "Tồn chuyển sang Bếp, gắn với bạn trong ca này")
        onDone()
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409 && Array.isArray(e.data)) {
          const mm = e.data as Mismatch[]
          setPinOpen(false)
          setMismatch(mm)
          if (mm[0]) setRow(mm[0].line_id)
          chime("bad")
          kToast("Chưa ký được", "Số cân lệch quá dung sai, cân lại", "bad")
        }
      },
    },
  )
  const ready = h.lines.every((l) => Number(vals[l.id]) > 0)
  const step = ready ? 3 : 2
  const active = h.lines.find((l) => l.id === row)
  const key = (k: string) => setVals((v) => {
    const cur = v[row] ?? ""
    const next = k === "back" ? cur.slice(0, -1) : k === "clear" ? "" : cur.length < 6 ? (cur === "0" ? "" : cur) + k : cur
    return { ...v, [row]: next }
  })
  const bad = new Set((mismatch ?? []).map((m) => m.line_id))
  return (
    <Panel data-stagger className="shadow-[0_1px_2px_rgba(28,25,23,.06),0_14px_32px_-18px_rgba(28,25,23,.22)]">
      <ol className="mb-[18px] grid grid-cols-3 gap-2" aria-label="Các bước bàn giao">
        {["Thủ kho cân xuất", "Bếp trưởng cân lại", "Ký nhận bằng PIN"].map((label, i) => {
          const n = i + 1, st = n < step ? "done" : n === step ? "now" : "next"
          return (
            <li key={label} aria-current={st === "now" ? "step" : undefined}
              className={cn("flex items-center gap-1.5 rounded-xl border-t-[5px] bg-[#f5f4f1] px-3 py-2.5 text-base transition-colors duration-300",
                st === "done" ? "border-t-[#c2410c] font-semibold text-[#3d3833]" : st === "now" ? "border-t-[#141210] font-extrabold" : "border-t-[#cdc5ba] font-semibold text-[#3d3833]")}>
              {n}. {label}{st === "done" && <CheckCircle2 weight="fill" className="size-[18px] shrink-0 text-[#9a3412]" aria-label="xong" />}
            </li>
          )
        })}
      </ol>
      <div className="flex gap-3.5 rounded-2xl bg-[#f5f4f1] px-4 py-3.5">
        <EyeOff className="size-7 shrink-0" aria-hidden />
        <div>
          <div className="text-lg font-extrabold">Cân lại độc lập</div>
          <div className="mt-0.5 text-base leading-snug text-[#3d3833]">Màn này không hiện số thủ kho đã cân xuất. Đặt từng loại lên cân và nhập đúng số trên cân.</div>
        </div>
      </div>
      {mismatch && (
        <div role="alert" className="mt-3 flex gap-3.5 rounded-2xl bg-[#fee2e2] px-4 py-3.5 text-[#7f1d1d]">
          <AlertTriangle weight="fill" className="size-7 shrink-0 text-[#b91c1c]" aria-hidden />
          <div className="text-base leading-normal">
            <div className="text-lg font-extrabold">Số cân hai bên lệch quá dung sai: cân lại trước khi ký</div>
            <ul className="font-bold">
              {mismatch.map((m) => <li key={m.line_id}>{m.ingredient}: thủ kho xuất {qty(m.issued_qty, m.unit)}, bếp cân {qty(m.received_qty, m.unit)}</li>)}
            </ul>
            <div>Lần ký bị từ chối đã được lưu làm bằng chứng. Nếu kho thật sự thiếu, thủ kho hủy phiếu và cân xuất lại.</div>
          </div>
        </div>
      )}
      <div className="mt-[18px] grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex flex-col gap-2.5">
          <div className="text-[15px] font-extrabold tracking-[.04em] text-[#3d3833] uppercase">Số bếp trưởng cân được</div>
          {h.lines.map((l) => {
            const on = row === l.id, isBad = bad.has(l.id)
            return (
              <button key={l.id} type="button" aria-pressed={on} onClick={() => setRow(l.id)}
                aria-label={`${l.ingredient}: ${vals[l.id] ? qty(vals[l.id], l.unit) : "chưa nhập"}`}
                className={cn("flex min-h-20 items-center gap-3.5 rounded-[18px] border-[3px] py-3 pr-3 pl-[18px] text-left transition-colors duration-200",
                  on ? "border-[#141210] bg-[#fff7ed]" : isBad ? "border-[#b91c1c] bg-white" : "border-[#cdc5ba] bg-white hover:border-[#8a817c]")}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[21px] font-extrabold">{l.ingredient}</span>
                  <span className={cn("text-[15px] font-semibold", isBad ? "text-[#991b1b]" : "text-[#3d3833]")}>{isBad ? "Lệch quá dung sai, cân lại" : "Bếp trưởng tự cân lại"}</span>
                </span>
                <span className="min-w-[160px] rounded-xl bg-[#141210] px-3.5 py-2 text-right font-display text-[30px] font-extrabold text-white tabular">
                  {vals[l.id] ? num(vals[l.id]) : "-"} <span className="text-base font-semibold text-[#d6d0c7]">{unit(l.unit)}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div>
          <div aria-live="polite" className="mb-2 min-h-6 text-base font-bold text-[#3d3833]">{active ? `Đang nhập: ${active.ingredient} (${unit(active.unit)})` : "Chạm vào một dòng để nhập"}</div>
          <KeyPad onKey={key} left="clear" />
        </div>
      </div>
      <button type="button" disabled={!ready} onClick={() => { setMismatch(null); sign.reset(); setPinOpen(true) }}
        className={cn("mt-[18px] flex h-[68px] w-full items-center justify-center gap-2.5 rounded-[18px] text-xl font-extrabold transition-colors duration-300 active:scale-[.98]",
          ready ? "bg-[#c2410c] text-white hover:brightness-110" : "cursor-not-allowed bg-[#e9e6e1] text-[#3d3833]")}>
        <PenNib className="size-[26px]" aria-hidden />{ready ? "Bếp trưởng ký nhận bằng PIN" : "Nhập đủ số cân để ký"}
      </button>
      {pinOpen && (
        <KDialog open onClose={() => { setPinOpen(false); sign.reset() }} icon={PenNib} title={`Ký nhận bàn giao ${h.code}`}
          desc="Ký nhận = chịu trách nhiệm số hàng này trong ca. Chênh lệch khi cân trả cuối ca gắn với người ký.">
          <ChefPin label="Ký nhận" busy={sign.isPending} error={sign.error instanceof ApiError && sign.error.status === 409 ? null : sign.error}
            onEdit={() => { if (sign.error) sign.reset() }} onSubmit={(userId, pin) => sign.mutate({ userId, pin })} />
        </KDialog>
      )}
    </Panel>
  )
}
