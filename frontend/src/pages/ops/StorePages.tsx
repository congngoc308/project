import { useQuery } from "@tanstack/react-query"
import { Camera, CheckCircle2, ClipboardCheck, EyeOff, PackageCheck, Plus, Scale, ShoppingBasket, Trash2 } from "@/components/icons"
import { useEffect, useState } from "react"

import { useAsk } from "@/components/ask"
import { Callout, Choice, Empty, Loading, PageHeader, StatusPill } from "@/components/common"
import { allFilled, toNumbers, WeighList } from "@/components/WeighList"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { dateOnly, dateTime, money, qty, time, unit } from "@/lib/format"
import type { CountSession, Ingredient, Receipt, Shift } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

const BLIND = (
  <Callout icon={EyeOff} title="Cân / đếm mù">
    Màn hình không hiển thị tồn sổ. Nhập đúng số thực tế trên cân hoặc đếm được, kể cả khi bằng 0.
  </Callout>
)

// ---- Cân trả cuối ca ----

export function ReturnPage() {
  const ask = useAsk()
  const now = useServerNow(30_000)
  const shifts = useQuery({ queryKey: ["shifts", 2], queryFn: () => api.get<Shift[]>("/shifts?days=2") })
  const candidates = (shifts.data ?? []).filter((s) => s.status === "open")
  const [shiftId, setShiftId] = useState<number | null>(null)
  useEffect(() => {
    if (shiftId === null && candidates[0]) setShiftId(candidates[0].id)
  }, [candidates, shiftId])
  const form = useQuery({
    queryKey: ["return-form", shiftId],
    queryFn: () => api.get<{ shift: Shift; ingredients: { id: number; name: string; unit: string }[] }>(`/shifts/${shiftId}/return-form`),
    enabled: !!shiftId,
  })
  const [values, setValues] = useState<Record<string, string>>({})
  const [doneCode, setDoneCode] = useState<string | null>(null)
  const submit = useAction(
    () => api.post<{ code: string }>(`/shifts/${shiftId}/return`, { counts: toNumbers(values) }),
    {
      success: "Đã chốt cân trả, ca đã đóng",
      invalidate: [["shifts"], ["me"], ["handovers"]],
      onSuccess: (r) => { setDoneCode(r.code); setValues({}); setShiftId(null) },
    },
  )
  const rows = (form.data?.ingredients ?? []).map((i) => ({ key: i.id, label: i.name, unit: i.unit }))
  const ready = allFilled(rows, values)

  return (
    <div className="space-y-4">
      <PageHeader title="Cân trả cuối ca" icon={Scale}
        description="Thủ kho cân toàn bộ nguyên liệu nhóm A bếp trả lại. Bếp không làm thao tác này (phân tách nhiệm vụ)." />
      {doneCode && (
        <Callout tone="good" icon={CheckCircle2} title={`Đã lưu phiên cân trả ${doneCode}`}>
          Hàng đã nhập lại Kho, ca đã đóng. Chênh lệch của ca do quản lý xem.
        </Callout>
      )}
      {shifts.isLoading ? <Loading /> : !candidates.length ? (
        <Empty icon={CheckCircle2}>Không có ca nào đang mở cần cân trả.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chọn ca">
            {candidates.map((s) => {
              const late = new Date(s.planned_end).getTime() <= now.getTime()
              return (
                <Choice key={s.id} selected={shiftId === s.id} onClick={() => setShiftId(s.id)}>
                  {s.name} {dateOnly(s.business_date)} · kết thúc {time(s.planned_end)}
                  {late && <StatusPill tone="bad" className={cn(shiftId === s.id && "bg-white")}>Đến giờ cân trả</StatusPill>}
                </Choice>
              )
            })}
          </div>
          {BLIND}
          {form.isLoading ? <Loading /> : rows.length === 0 ? <Empty>Ca này không có hàng nhóm A tại Bếp.</Empty> : (
            <>
              <WeighList rows={rows} values={values} onChange={setValues} title="Số cân bếp trả (nhập 0 nếu đã hết)" />
              <Button size="touch" className="w-full" disabled={!ready || submit.isPending}
                onClick={async () => {
                  if (await ask.confirm({ title: "Chốt số cân trả và đóng ca?", description: "Phiên bị khóa sau khi chốt, không sửa được.", confirmLabel: "Chốt & đóng ca" }))
                    submit.mutate(undefined)
                }}>
                <Scale /> {ready ? "Chốt cân trả & đóng ca" : "Nhập đủ số cân để chốt"}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ---- Nhập hàng ----

interface DraftLine {
  ingredient_id: string
  unit: string
  ordered_qty: string
  unit_price: string
}

const RECEIPT_STATUS: Record<Receipt["status"], { label: string; tone: "warn" | "neutral" | "good" }> = {
  received: { label: "Đã nhận", tone: "good" },
  pending_approval: { label: "Chờ duyệt", tone: "warn" },
  approved: { label: "Đã duyệt", tone: "good" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
  draft: { label: "Chờ nhận", tone: "neutral" },
}

export function ReceivingPage() {
  const receipts = useQuery({ queryKey: ["receipts"], queryFn: () => api.get<Receipt[]>("/receipts") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [creating, setCreating] = useState(false)
  const [supplier, setSupplier] = useState("")
  const [lines, setLines] = useState<DraftLine[]>([{ ingredient_id: "", unit: "", ordered_qty: "", unit_price: "" }])
  const [openId, setOpenId] = useState<number | null>(null)
  const byId = Object.fromEntries((ings.data ?? []).map((i) => [String(i.id), i]))

  const create = useAction(
    () => api.post<Receipt>("/receipts", {
      supplier,
      lines: lines.filter((l) => l.ingredient_id && Number(l.ordered_qty) > 0).map((l) => ({
        ingredient_id: Number(l.ingredient_id), unit: l.unit || byId[l.ingredient_id]?.purchase_unit,
        ordered_qty: Number(l.ordered_qty), unit_price: Number(l.unit_price || 0),
      })),
    }),
    {
      success: (r) => `Đã tạo phiếu ${r.code}`,
      invalidate: [["receipts"]],
      onSuccess: (r) => {
        setCreating(false)
        setSupplier("")
        setLines([{ ingredient_id: "", unit: "", ordered_qty: "", unit_price: "" }])
        setOpenId(r.id)
      },
    },
  )
  const drafts = (receipts.data ?? []).filter((r) => r.status === "draft")
  const recent = (receipts.data ?? []).filter((r) => r.status !== "draft").slice(0, 10)
  const opened = drafts.find((r) => r.id === openId)
  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const canSave = !!supplier.trim() && lines.some((l) => l.ingredient_id && Number(l.ordered_qty) > 0)

  return (
    <div>
      <PageHeader title="Nhập hàng" icon={ShoppingBasket}
        description="Tạo phiếu theo đơn đặt, khi hàng về thì cân / đếm số thực nhận. Tồn Kho tăng ngay khi xác nhận." />
      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Button size="touch" className="w-full" onClick={() => { setCreating(true); setOpenId(null) }}>
            <Plus /> Phiếu nhập mới
          </Button>
          <div>
            <h2 className="mb-2 text-base font-semibold">Chờ nhận hàng ({drafts.length})</h2>
            <div className="space-y-2">
              {drafts.length ? drafts.map((r) => (
                <button key={r.id} type="button" onClick={() => { setOpenId(r.id); setCreating(false) }}
                  className={cn("w-full surface p-3 text-left transition-colors hover:bg-muted", openId === r.id && "outline-2 outline-ink")}>
                  <div className="font-semibold">{r.code} · {r.supplier}</div>
                  <div className="text-sm text-muted-foreground">{r.lines.map((l) => `${l.ingredient} ${Number(l.ordered_qty)} ${unit(l.unit)}`).join(" · ")}</div>
                </button>
              )) : <Empty>Không có phiếu chờ nhận</Empty>}
            </div>
          </div>
          {recent.length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold">Đã nhận gần đây</h2>
              <ul className="divide-y surface text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0"><span className="font-medium">{r.code}</span> · {r.supplier}<span className="block text-xs text-muted-foreground">{dateTime(r.received_at)}</span></span>
                    <StatusPill tone={RECEIPT_STATUS[r.status].tone}>{RECEIPT_STATUS[r.status].label}</StatusPill>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          {receipts.isLoading || ings.isLoading ? <Loading /> : creating ? (
            <div className="space-y-4 surface p-4">
              <h2 className="text-lg font-bold">Phiếu nhập mới</h2>
              <div className="space-y-1.5">
                <Label htmlFor="supplier">Nhà cung cấp</Label>
                <Input id="supplier" className="h-12" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Chợ đầu mối, đại lý…" />
              </div>
              <div className="space-y-2">
                <div className="hidden grid-cols-[2fr_1fr_1fr_1.3fr_48px] gap-2 px-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Nguyên liệu</span><span>Đơn vị</span><span>Số đặt</span><span>Đơn giá / đơn vị</span><span />
                </div>
                {lines.map((l, i) => {
                  const ing = byId[l.ingredient_id]
                  return (
                    <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[2fr_1fr_1fr_1.3fr_48px]">
                      <Select value={l.ingredient_id} onValueChange={(v) => setLine(i, { ingredient_id: v, unit: byId[v]?.purchase_unit ?? "" })}>
                        <SelectTrigger className="h-12 w-full" aria-label="Nguyên liệu"><SelectValue placeholder="Nguyên liệu" /></SelectTrigger>
                        <SelectContent>{(ings.data ?? []).filter((x) => x.active).map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name} (nhóm {x.control_group})</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={l.unit} onValueChange={(v) => setLine(i, { unit: v })} disabled={!ing}>
                        <SelectTrigger className="h-12 w-full" aria-label="Đơn vị"><SelectValue placeholder="Đơn vị" /></SelectTrigger>
                        <SelectContent>{(ing?.units ?? []).map((u) => <SelectItem key={u} value={u}>{unit(u)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input className="h-12" inputMode="decimal" aria-label="Số đặt" placeholder="Số đặt" value={l.ordered_qty}
                        onChange={(e) => setLine(i, { ordered_qty: e.target.value.replace(",", ".") })} />
                      <Input className="h-12" inputMode="numeric" aria-label="Đơn giá / đơn vị" placeholder="Đơn giá" value={l.unit_price}
                        onChange={(e) => setLine(i, { unit_price: e.target.value.replace(/\D/g, "") })} />
                      <Button variant="ghost" size="icon" className="size-12" aria-label="Bỏ dòng" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="xl" onClick={() => setLines((ls) => [...ls, { ingredient_id: "", unit: "", ordered_qty: "", unit_price: "" }])}>
                  <Plus /> Thêm dòng
                </Button>
                <Button variant="ghost" size="xl" onClick={() => setCreating(false)}>Quay lại</Button>
                <Button size="xl" className="ml-auto" disabled={!canSave || create.isPending} onClick={() => create.mutate(undefined)}>
                  {canSave ? "Lưu phiếu, chờ hàng về" : "Nhập nhà cung cấp và ít nhất một dòng"}
                </Button>
              </div>
            </div>
          ) : opened ? (
            <ReceivePanel r={opened} onDone={() => setOpenId(null)} />
          ) : (
            <Empty icon={ShoppingBasket} action={<Button size="xl" onClick={() => setCreating(true)}><Plus /> Phiếu nhập mới</Button>}>
              Hàng về thì chọn phiếu đang chờ ở bên trái để cân / đếm, hoặc tạo phiếu nhập mới.
            </Empty>
          )}
        </div>
      </div>
    </div>
  )
}

function ReceivePanel({ r, onDone }: { r: Receipt; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(r.lines.map((l) => [String(l.id), String(Number(l.ordered_qty))])),
  )
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [image, setImage] = useState<string | null>(null)
  const upload = useAction((f: File) => api.upload(f), { success: "Đã tải ảnh hóa đơn", onSuccess: (x) => setImage(x.path) })
  const receive = useAction(
    () => api.post<Receipt>(`/receipts/${r.id}/receive`, {
      invoice_image: image,
      lines: r.lines.map((l) => ({ line_id: l.id, received_qty: Number(values[String(l.id)] ?? 0), diff_reason: reasons[String(l.id)] || null })),
    }),
    {
      success: (x) => x.status === "pending_approval" ? `Đã nhận hàng; phiếu ${x.code} chuyển Chờ duyệt (bất thường)` : `Đã nhận hàng, tồn Kho tăng ngay`,
      invalidate: [["receipts"]],
      onSuccess: onDone,
    },
  )
  const diff = r.lines.filter((l) => values[String(l.id)] !== undefined && Number(values[String(l.id)]) !== Number(l.ordered_qty))
  const missingReason = diff.some((l) => !reasons[String(l.id)]?.trim())
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{r.code} · {r.supplier}: số thực nhận</h2>
      <p className="text-sm text-muted-foreground">Số đặt đã điền sẵn. Chỉ sửa dòng nào nhận khác số đặt.</p>
      <WeighList
        rows={r.lines.map((l) => ({ key: l.id, label: l.ingredient, unit: l.unit, hint: `Đặt ${Number(l.ordered_qty)} ${unit(l.unit)} · ${money(l.unit_price)}/${unit(l.unit)}` }))}
        values={values} onChange={setValues}
      />
      {diff.length > 0 && (
        <div className="space-y-2 rounded-md border border-status-warning/60 bg-status-warning/10 p-3">
          <div className="text-sm font-semibold text-warning-ink">Số nhận khác số đặt: bắt buộc ghi lý do (phiếu sẽ chuyển Chờ duyệt)</div>
          {diff.map((l) => (
            <div key={l.id} className="grid items-center gap-2 md:grid-cols-[200px_1fr]">
              <span className="text-sm font-medium">{l.ingredient}: {Number(values[String(l.id)])} / {Number(l.ordered_qty)} {unit(l.unit)}</span>
              <div className="flex flex-wrap gap-2">
                {["NCC giao thiếu", "Hàng hỏng, trả lại", "NCC giao dư"].map((p) => (
                  <Choice key={p} className="min-h-11 text-sm" selected={reasons[String(l.id)] === p} onClick={() => setReasons((x) => ({ ...x, [String(l.id)]: p }))}>{p}</Choice>
                ))}
                <Input className="h-11 min-w-48 flex-1" aria-label={`Lý do lệch ${l.ingredient}`} placeholder="Lý do khác…" value={reasons[String(l.id)] ?? ""}
                  onChange={(e) => setReasons((x) => ({ ...x, [String(l.id)]: e.target.value }))} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 surface px-3 text-sm font-medium hover:bg-muted">
          {image ? <CheckCircle2 className="size-4 text-paprika-ink" aria-hidden /> : <Camera className="size-4" aria-hidden />}
          {image ? "Đã có ảnh hóa đơn" : "Chụp / tải ảnh hóa đơn (tùy chọn)"}
          <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only"
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </label>
        <Button size="touch" className="ml-auto" disabled={receive.isPending || missingReason} onClick={() => receive.mutate(undefined)}>
          <PackageCheck /> {missingReason ? "Ghi lý do cho dòng lệch" : "Xác nhận đã nhận hàng"}
        </Button>
      </div>
    </div>
  )
}

// ---- Kiểm kê mù (thủ kho) ----

export function CountPage() {
  const ask = useAsk()
  const sessions = useQuery({ queryKey: ["counts", "open"], queryFn: () => api.get<CountSession[]>("/counts?status=open") })
  const [openId, setOpenId] = useState<number | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const create = useAction((group: "A" | "C") => api.post<CountSession>("/counts", { kind: "periodic", location: "kho", group }), {
    success: (s) => `Đã mở phiên ${s.code}`, invalidate: [["counts"]], onSuccess: (s) => { setOpenId(s.id); setValues({}) },
  })
  const submit = useAction(() => api.post(`/counts/${openId}/submit`, { counts: toNumbers(values) }), {
    success: "Đã chốt phiên kiểm kê. Phiên bị khóa; quản lý xem chênh lệch.", invalidate: [["counts"]],
    onSuccess: () => { setOpenId(null); setValues({}) },
  })
  const list = sessions.data ?? []
  const opened = list.find((s) => s.id === openId)
  const rows = (opened?.lines ?? []).map((l) => ({ key: l.ingredient_id, label: l.ingredient, unit: l.unit, hint: `Nhóm ${l.group}` }))
  const ready = allFilled(rows, values)
  return (
    <div>
      <PageHeader title="Kiểm kê" icon={ClipboardCheck}
        description="Nhóm A kiểm kê cuối mỗi ngày, nhóm C theo định kỳ. Đếm mù: không thấy tồn sổ, chỉ nhập số thực đếm." />
      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Button size="touch" className="w-full" disabled={create.isPending} onClick={() => create.mutate("A")}>Kiểm kê cuối ngày nhóm A</Button>
          <Button size="touch" variant="outline" className="w-full" disabled={create.isPending} onClick={() => create.mutate("C")}>Kiểm kê định kỳ nhóm C</Button>
          <h2 className="pt-3 text-base font-semibold">Phiên đang mở ({list.length})</h2>
          {sessions.isLoading ? <Loading /> : list.length ? list.map((s) => (
            <button key={s.id} type="button" onClick={() => { setOpenId(s.id); setValues({}) }}
              className={cn("w-full surface p-3 text-left transition-colors hover:bg-muted", openId === s.id && "outline-2 outline-ink")}>
              <div className="font-semibold">{s.code} · {s.kind_label}</div>
              <div className="text-sm text-muted-foreground">{s.location === "bep" ? "Tại Bếp" : "Tại Kho"} · mở {dateTime(s.opened_at)} bởi {s.created_by}</div>
              <div className="text-sm">{s.lines.length} nguyên liệu</div>
            </button>
          )) : <Empty>Không có phiên kiểm kê đang mở</Empty>}
        </div>
        <div className="space-y-4">
          {opened ? (
            <>
              {BLIND}
              <WeighList rows={rows} values={values} onChange={setValues} title={`${opened.code}: số thực đếm`} />
              <Button size="touch" className="w-full" disabled={!ready || submit.isPending}
                onClick={async () => {
                  if (await ask.confirm({ title: `Chốt phiên ${opened.code}?`, description: "Sau khi chốt không sửa được. Chênh lệch do quản lý xem.", confirmLabel: "Chốt phiên" }))
                    submit.mutate(undefined)
                }}>
                {ready ? "Chốt phiên kiểm kê" : "Nhập đủ số đếm để chốt"}
              </Button>
            </>
          ) : <Empty icon={ClipboardCheck}>Mở phiên kiểm kê mới ở bên trái, hoặc chọn phiên đang mở để nhập số đếm.</Empty>}
        </div>
      </div>
    </div>
  )
}

export function qtyHint(q: number | string, u: string) {
  return qty(q, u)
}
