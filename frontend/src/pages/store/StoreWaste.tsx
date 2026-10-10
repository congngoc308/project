import { BugIcon, ClockCountdownIcon, DropIcon, ThermometerHotIcon, TrashIcon, type Icon } from "@phosphor-icons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Loading } from "@/components/common"
import { PrimaryAction, ScaleWeigh, scaleNumbers } from "@/components/ScaleWeigh"
import { Input } from "@/components/ui/input"
import { api, ApiError } from "@/lib/api"
import { dateTime, qty } from "@/lib/format"
import type { Ingredient, WasteSlip } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CARD, Pill, StoreHeader, type StoreTone } from "@/pages/store/parts"

/** Lý do hay gặp tại Kho, gắn với loại hao hụt của hệ thống. */
const REASONS: { label: string; type: string; icon: Icon; note?: string }[] = [
  { label: "Hết hạn", type: "het_han", icon: ClockCountdownIcon },
  { label: "Hỏng do bảo quản", type: "hong_bao_quan", icon: ThermometerHotIcon },
  { label: "Đổ vỡ, rơi", type: "do_vo_roi", icon: DropIcon },
  { label: "Côn trùng, chuột", type: "khac", icon: BugIcon, note: "Côn trùng, chuột" },
]
const STATUS: Record<WasteSlip["status"], [string, StoreTone]> = {
  pending_chef: ["Chờ bếp trưởng duyệt", "warn"], pending_manager: ["Chờ quản lý duyệt", "warn"], approved: ["Đã duyệt", "good"], rejected: ["Từ chối", "bad"],
}

export function StoreWaste() {
  const qc = useQueryClient()
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const slips = useQuery({ queryKey: ["waste"], queryFn: () => api.get<WasteSlip[]>("/waste") })
  const mine = (slips.data ?? []).filter((s) => s.location === "kho")
  const [reason, setReason] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  if (ings.isLoading) return <Loading />

  const rows = (ings.data ?? []).filter((i) => i.active).sort((a, b) => a.control_group.localeCompare(b.control_group))
    .map((i) => ({ key: i.id, label: i.name, unit: i.base_unit, hint: `Nhóm ${i.control_group}, để trống nếu không có` }))
  const nums = Object.entries(scaleNumbers(values)).filter(([, v]) => v > 0)
  const r = reason !== null ? REASONS[reason] : null
  const label = !r ? "Chọn lý do hao hụt" : !nums.length ? "Nhập ít nhất một dòng" : `Ghi ${nums.length} phiếu hao hụt, gửi duyệt`

  const save = async () => {
    if (!r) return
    setBusy(true)
    let ok = 0
    for (const [id, q] of nums) {
      try {
        await api.post("/waste", { ingredient_id: Number(id), qty: q, waste_type: r.type, location: "kho", reason: [r.note, note.trim()].filter(Boolean).join(". ") })
        ok++
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Không ghi được hao hụt")
      }
    }
    setBusy(false)
    qc.invalidateQueries({ queryKey: ["waste"] })
    if (ok) {
      toast.success(`Đã ghi ${ok} phiếu hao hụt (${r.label.toLowerCase()}), chờ duyệt`)
      setValues({}); setReason(null); setNote("")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StoreHeader icon={TrashIcon} title="Ghi hao hụt" desc="Ghi nguyên liệu hỏng, hết hạn hoặc rơi đổ tại Kho. Tồn Kho trừ ngay, bếp trưởng duyệt sau (vượt hạn mức thì quản lý duyệt)." />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lý do hao hụt">
        <span className="mr-1.5 text-[15px] font-bold">Lý do</span>
        {REASONS.map((x, i) => (
          <button key={x.label} type="button" aria-pressed={reason === i} onClick={() => setReason(i)}
            className={cn("inline-flex h-[46px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold shadow-[0_0_0_1px_rgba(28,25,23,.08)] transition-[background-color,color,transform] duration-200 active:scale-[.97]",
              reason === i ? "bg-[#1c1917] text-[#fafaf9]" : "bg-[#fdfdfc] text-[#1c1917]")}>
            <x.icon className="size-[19px]" aria-hidden />{x.label}
          </button>
        ))}
        <Input className="ml-1 h-[46px] max-w-xs min-w-48 flex-1 rounded-full bg-[#fdfdfc] px-4" aria-label="Ghi chú thêm" placeholder="Ghi chú thêm (tùy chọn)"
          value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ScaleWeigh rows={rows} values={values} onChange={setValues} title="Lượng hao hụt" />
      <PrimaryAction ok={!!r && nums.length > 0} busy={busy} onClick={save} label={label} icon={<TrashIcon className="size-6" aria-hidden />} />

      <div className={cn(CARD, "px-6 py-5")}>
        <h2 className="mt-0 mb-2 text-xl tracking-[-.02em]">Phiếu gần đây</h2>
        {mine.length ? (
          <ul>
            {mine.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efedeb] py-2.5">
                <span className="min-w-0"><b>{s.ingredient} {qty(s.qty, s.unit)}</b><span className="block text-[13px] text-[#4f4a45]">{s.type_label}{s.reason ? `, ${s.reason}` : ""}, {dateTime(s.at)}</span></span>
                <Pill tone={STATUS[s.status][1]}>{STATUS[s.status][0]}</Pill>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[#4f4a45]">Chưa có phiếu hao hụt.</p>}
      </div>
    </div>
  )
}
