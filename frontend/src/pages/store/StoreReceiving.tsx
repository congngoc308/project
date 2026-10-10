import { BasketIcon, CameraIcon, CheckCircleIcon, PackageIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Loading } from "@/components/common"
import { PrimaryAction, ScaleWeigh, viNum } from "@/components/ScaleWeigh"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { dateTime, money, unit } from "@/lib/format"
import type { Ingredient, Receipt } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { Btn, CARD, EmptyCard, Pill, StoreHeader, type StoreTone } from "@/pages/store/parts"

const STATUS: Record<Receipt["status"], [string, StoreTone]> = {
  received: ["Đã nhận", "good"], approved: ["Đã duyệt", "good"], pending_approval: ["Chờ duyệt", "warn"], cancelled: ["Đã hủy", "neutral"], draft: ["Chờ nhận", "neutral"],
}
const REASONS = ["NCC giao thiếu", "Hàng hỏng, trả lại", "NCC giao dư"]

interface DraftLine { ingredient_id: string; unit: string; ordered_qty: string; unit_price: string }
const emptyLine = (): DraftLine => ({ ingredient_id: "", unit: "", ordered_qty: "", unit_price: "" })

export function StoreReceiving() {
  const nav = useNavigate()
  const receipts = useQuery({ queryKey: ["receipts"], queryFn: () => api.get<Receipt[]>("/receipts") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const drafts = (receipts.data ?? []).filter((r) => r.status === "draft")
  const recent = (receipts.data ?? []).filter((r) => r.status !== "draft").slice(0, 5)
  const opened = drafts.find((r) => r.id === openId) ?? (creating ? undefined : drafts[0])

  return (
    <div className="flex flex-col gap-6">
      <StoreHeader icon={BasketIcon} title="Nhập hàng" desc="Khi hàng về, chọn phiếu đang chờ rồi cân / đếm số thực nhận. Tồn Kho tăng ngay khi xác nhận." />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex max-w-[340px] flex-[1_1_280px] flex-col gap-[18px]">
          <Btn kind={creating ? "ink" : "outline"} className="h-14 w-full" onClick={() => { setCreating(true); setOpenId(null) }}>
            <PlusIcon className="size-5" weight="bold" aria-hidden /> Phiếu nhập mới
          </Btn>
          <div className="flex flex-col gap-2.5">
            <div className="text-[15px] font-bold">Chờ nhận hàng ({drafts.length})</div>
            {drafts.map((r) => {
              const on = !creating && opened?.id === r.id
              return (
                <button key={r.id} type="button" onClick={() => { setOpenId(r.id); setCreating(false) }}
                  className={cn("rounded-[18px] bg-[#fdfdfc] px-4 py-3.5 text-left transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5",
                    on ? "shadow-[0_0_0_2px_#1c1917,0_18px_36px_-18px_rgba(41,37,36,.4)]" : "shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.07)]")}>
                  <div className="flex items-center justify-between gap-2"><span className="font-bold">{r.code}</span><Pill tone="neutral">Chờ nhận</Pill></div>
                  <div className="mt-0.5 text-sm font-semibold">{r.supplier}</div>
                  <div className="mt-1 text-[13px] text-[#4f4a45]">{r.lines.map((l) => `${l.ingredient} ${viNum(String(Number(l.ordered_qty)))} ${unit(l.unit)}`).join(", ")}</div>
                </button>
              )
            })}
            {!drafts.length && <div className="rounded-[18px] border-[1.5px] border-dashed border-[#d6d3d1] p-4 text-sm text-[#4f4a45]">Không có phiếu chờ nhận</div>}
          </div>
          {recent.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-bold">Đã nhận gần đây</div>
              <ul className="rounded-[18px] bg-[#fdfdfc] shadow-[0_0_0_1px_rgba(28,25,23,.06)]">
                {recent.map((r, i) => (
                  <li key={r.id} className={cn("flex items-center justify-between gap-2 px-3.5 py-2.5", i > 0 && "border-t border-[#efedeb]")}>
                    <div className="min-w-0 leading-[1.3]"><div className="text-sm font-semibold">{r.code}, {r.supplier}</div><div className="text-[13px] text-[#4f4a45]">{dateTime(r.received_at)}</div></div>
                    <Pill tone={STATUS[r.status][1]} className="flex-none">{STATUS[r.status][0]}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          {receipts.isLoading || ings.isLoading ? <Loading /> : creating ? (
            <NewReceipt ings={ings.data ?? []} onCancel={() => setCreating(false)} onCreated={(r) => { setCreating(false); setOpenId(r.id) }} />
          ) : opened ? (
            <ReceivePanel key={opened.id} r={opened} />
          ) : (
            <EmptyCard icon={PackageIcon} title="Không còn phiếu chờ nhận" text="Hàng về thì chọn phiếu đang chờ ở cột bên trái để cân / đếm, hoặc tạo phiếu nhập mới."
              action={<Btn onClick={() => nav("/van-hanh/hom-nay")}>Về Việc hôm nay</Btn>} />
          )}
        </div>
      </div>
    </div>
  )
}

function ReceivePanel({ r }: { r: Receipt }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(r.lines.map((l) => [String(l.id), String(Number(l.ordered_qty))])))
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [image, setImage] = useState<string | null>(null)
  const upload = useAction((f: File) => api.upload(f), { success: "Đã tải ảnh hóa đơn", onSuccess: (x) => setImage(x.path) })
  const receive = useAction(
    () => api.post<Receipt>(`/receipts/${r.id}/receive`, {
      invoice_image: image,
      lines: r.lines.map((l) => ({ line_id: l.id, received_qty: Number(values[String(l.id)] ?? 0), diff_reason: reasons[String(l.id)] || null })),
    }),
    {
      success: (x) => x.status === "pending_approval" ? `Đã nhận ${x.code}, chuyển Chờ duyệt vì có dòng lệch` : `Đã nhận ${x.code}, tồn Kho tăng ngay`,
      invalidate: [["receipts"]],
    },
  )
  const rows = r.lines.map((l) => ({ key: l.id, label: l.ingredient, unit: l.unit, hint: `Đặt ${viNum(String(Number(l.ordered_qty)))} ${unit(l.unit)}, ${money(l.unit_price)}/${unit(l.unit)}` }))
  const isFilled = (l: Receipt["lines"][number]) => (values[String(l.id)] ?? "") !== ""
  const diff = r.lines.filter((l) => isFilled(l) && Number(values[String(l.id)]) !== Number(l.ordered_qty))
  const all = r.lines.every(isFilled)
  const missing = diff.some((l) => !reasons[String(l.id)]?.trim())

  return (
    <>
      <ScaleWeigh rows={rows} values={values} onChange={setValues} title={`${r.code}, số thực nhận (đã điền sẵn số đặt)`} />
      {diff.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[18px] bg-[#fdf0d2] px-[18px] py-4">
          <div className="text-[15px] font-bold text-[#6b4300]">Số nhận khác số đặt: bắt buộc ghi lý do, phiếu sẽ chuyển Chờ duyệt</div>
          {diff.map((l) => (
            <div key={l.id} className="grid items-center gap-2.5 md:grid-cols-[200px_minmax(0,1fr)]">
              <span className="text-sm font-semibold">{l.ingredient}: {viNum(values[String(l.id)])} / {viNum(String(Number(l.ordered_qty)))} {unit(l.unit)}</span>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((t) => {
                  const on = reasons[String(l.id)] === t
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => setReasons((x) => ({ ...x, [String(l.id)]: t }))}
                      className={cn("h-11 rounded-xl px-3.5 text-sm font-semibold transition-colors", on ? "bg-[#1c1917] text-[#fafaf9]" : "bg-[#fdfdfc] text-[#1c1917]")}>{t}</button>
                  )
                })}
                <Input className="h-11 min-w-40 flex-1 bg-[#fdfdfc]" aria-label={`Lý do khác cho ${l.ingredient}`} placeholder="Lý do khác..."
                  value={REASONS.includes(reasons[String(l.id)] ?? "") ? "" : reasons[String(l.id)] ?? ""}
                  onChange={(e) => setReasons((x) => ({ ...x, [String(l.id)]: e.target.value }))} />
              </div>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-xl border-[1.5px] border-[#d6d3d1] bg-[#fdfdfc] px-4 text-sm font-semibold hover:bg-[#efedeb]">
        {image ? <CheckCircleIcon className="size-5 text-[#004d00]" aria-hidden /> : <CameraIcon className="size-5" aria-hidden />}
        {image ? "Đã có ảnh hóa đơn" : "Chụp / tải ảnh hóa đơn (tùy chọn)"}
        <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
      </label>
      <PrimaryAction ok={all && !missing} busy={receive.isPending} onClick={() => receive.mutate(undefined)}
        label={!all ? "Nhập đủ số thực nhận" : missing ? "Ghi lý do cho dòng lệch" : "Xác nhận đã nhận hàng"} icon={<PackageIcon className="size-6" aria-hidden />} />
    </>
  )
}

function NewReceipt({ ings, onCancel, onCreated }: { ings: Ingredient[]; onCancel: () => void; onCreated: (r: Receipt) => void }) {
  const [supplier, setSupplier] = useState("")
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const byId = Object.fromEntries(ings.map((i) => [String(i.id), i]))
  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const create = useAction(
    () => api.post<Receipt>("/receipts", {
      supplier,
      lines: lines.filter((l) => l.ingredient_id && Number(l.ordered_qty) > 0).map((l) => ({
        ingredient_id: Number(l.ingredient_id), unit: l.unit || byId[l.ingredient_id]?.purchase_unit, ordered_qty: Number(l.ordered_qty), unit_price: Number(l.unit_price || 0),
      })),
    }),
    { success: (r) => `Đã tạo phiếu ${r.code}`, invalidate: [["receipts"]], onSuccess: onCreated },
  )
  const ok = !!supplier.trim() && lines.some((l) => l.ingredient_id && Number(l.ordered_qty) > 0)
  return (
    <div className={cn(CARD, "flex flex-col gap-4 p-6")}>
      <h2 className="m-0 text-2xl font-bold tracking-[-.02em]">Phiếu nhập mới</h2>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Nhà cung cấp</span>
        <Input className="h-12 bg-[#fdfdfc]" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Chợ đầu mối, đại lý..." />
      </label>
      <div className="hidden grid-cols-[2fr_1fr_1fr_1.3fr_48px] gap-2 px-2 text-xs font-semibold text-[#4f4a45] md:grid">
        <span>Nguyên liệu</span><span>Đơn vị</span><span>Số đặt</span><span>Đơn giá / đơn vị</span><span />
      </div>
      {lines.map((l, i) => {
        const ing = byId[l.ingredient_id]
        return (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f5f5f4] p-2 md:grid-cols-[2fr_1fr_1fr_1.3fr_48px]">
            <Select value={l.ingredient_id} onValueChange={(v) => setLine(i, { ingredient_id: v, unit: byId[v]?.purchase_unit ?? "" })}>
              <SelectTrigger className="h-12 w-full" aria-label="Nguyên liệu"><SelectValue placeholder="Nguyên liệu" /></SelectTrigger>
              <SelectContent>{ings.filter((x) => x.active).map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name} (nhóm {x.control_group})</SelectItem>)}</SelectContent>
            </Select>
            <Select value={l.unit} onValueChange={(v) => setLine(i, { unit: v })} disabled={!ing}>
              <SelectTrigger className="h-12 w-full" aria-label="Đơn vị"><SelectValue placeholder="Đơn vị" /></SelectTrigger>
              <SelectContent>{(ing?.units ?? []).map((u) => <SelectItem key={u} value={u}>{unit(u)}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="h-12" inputMode="decimal" aria-label="Số đặt" placeholder="Số đặt" value={l.ordered_qty} onChange={(e) => setLine(i, { ordered_qty: e.target.value.replace(",", ".") })} />
            <Input className="h-12" inputMode="numeric" aria-label="Đơn giá / đơn vị" placeholder="Đơn giá" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value.replace(/\D/g, "") })} />
            <button type="button" aria-label="Bỏ dòng" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="flex size-12 items-center justify-center rounded-xl hover:bg-[#e7e4e1]"><TrashIcon className="size-5" /></button>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2.5">
        <Btn kind="outline" onClick={() => setLines((ls) => [...ls, emptyLine()])}><PlusIcon className="size-5" aria-hidden /> Thêm dòng</Btn>
        <Btn kind="outline" onClick={onCancel}>Quay lại</Btn>
        <Btn className="ml-auto" disabled={!ok || create.isPending} onClick={() => create.mutate(undefined)}>{ok ? "Lưu phiếu, chờ hàng về" : "Nhập nhà cung cấp và ít nhất một dòng"}</Btn>
      </div>
    </div>
  )
}
