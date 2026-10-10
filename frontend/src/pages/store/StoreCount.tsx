import { ClipboardTextIcon, LockKeyIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { useAsk } from "@/components/ask"
import { Loading } from "@/components/common"
import { allScaleFilled, BlindNote, PrimaryAction, ScaleWeigh, scaleNumbers } from "@/components/ScaleWeigh"
import { api } from "@/lib/api"
import { dateTime } from "@/lib/format"
import type { CountSession } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { Btn, DoneCard, EmptyCard, StoreHeader } from "@/pages/store/parts"

export function StoreCount() {
  const ask = useAsk()
  const sessions = useQuery({ queryKey: ["counts", "open"], queryFn: () => api.get<CountSession[]>("/counts?status=open") })
  const locked = useQuery({ queryKey: ["counts", "locked"], queryFn: () => api.get<CountSession[]>("/counts?status=locked") })
  const [openId, setOpenId] = useState<number | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [done, setDone] = useState<string | null>(null)
  const list = (sessions.data ?? []).filter((s) => s.location === "kho")
  const opened = list.find((s) => s.id === openId) ?? list[0]
  const history = (locked.data ?? []).filter((s) => s.location === "kho" && s.kind !== "shift_return").slice(0, 4)

  const create = useAction((group: "A" | "C") => api.post<CountSession>("/counts", { kind: "periodic", location: "kho", group }), {
    success: (s) => `Đã mở phiên ${s.code}`, invalidate: [["counts"]], onSuccess: (s) => { setOpenId(s.id); setValues({}); setDone(null) },
  })
  const submit = useAction(() => api.post(`/counts/${opened!.id}/submit`, { counts: scaleNumbers(values) }), {
    success: "Đã chốt phiên kiểm kê, phiên bị khóa", invalidate: [["counts"]],
    onSuccess: () => { setDone(opened!.code); setOpenId(null); setValues({}) },
  })
  const rows = (opened?.lines ?? []).map((l) => ({ key: l.ingredient_id, label: l.ingredient, unit: l.unit, hint: `Nhóm ${l.group}` }))
  const ready = allScaleFilled(rows, values)

  return (
    <div className="flex flex-col gap-6">
      <StoreHeader icon={ClipboardTextIcon} title="Kiểm kê" desc="Nhóm A kiểm kê cuối mỗi ngày, nhóm C theo định kỳ. Đếm mù: không thấy tồn sổ, chỉ nhập số thực đếm." />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex max-w-[340px] flex-[1_1_280px] flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5">
            <Btn className="h-14 w-full" disabled={create.isPending} onClick={() => create.mutate("A")}>Kiểm kê cuối ngày nhóm A</Btn>
            <Btn kind="outline" className="h-14 w-full bg-[#fdfdfc]" disabled={create.isPending} onClick={() => create.mutate("C")}>Kiểm kê định kỳ nhóm C</Btn>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[15px] font-bold">Phiên đang mở</div>
            {sessions.isLoading ? <Loading rows={1} /> : list.length ? list.map((s) => (
              <button key={s.id} type="button" onClick={() => { setOpenId(s.id); setValues({}); setDone(null) }}
                className={cn("rounded-2xl bg-[#fdfdfc] px-4 py-3.5 text-left",
                  opened?.id === s.id && !done ? "shadow-[0_0_0_2px_#1c1917]" : "shadow-[0_0_0_1px_rgba(28,25,23,.08)]")}>
                <div className="font-bold">{s.code}, {s.kind_label}</div>
                <div className="text-[13px] text-[#4f4a45]">Tại Kho, mở {dateTime(s.opened_at)} bởi {s.created_by}, {s.lines.length} nguyên liệu</div>
              </button>
            )) : <div className="rounded-2xl border-[1.5px] border-dashed border-[#d6d3d1] p-3.5 text-sm text-[#4f4a45]">Không có phiên đang mở</div>}
          </div>
          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-bold">Đã chốt</div>
              {history.map((c) => (
                <div key={c.id} className="rounded-2xl bg-[#fdfdfc] px-3.5 py-3 shadow-[0_0_0_1px_rgba(28,25,23,.06)]">
                  <div className="text-sm font-bold">{c.code}, {c.kind_label}</div>
                  <div className="text-[13px] text-[#4f4a45]">{dateTime(c.cutoff_at)}, {c.counted_by ?? c.created_by}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          {done ? (
            <DoneCard title={`Đã chốt ${done}`} text="Phiên bị khóa, không sửa được. Chênh lệch giữa số đếm và sổ do quản lý xem.">
              <Btn onClick={() => setDone(null)}>Tiếp tục</Btn>
            </DoneCard>
          ) : opened ? (
            <div key={opened.id} className="st-flip flex flex-col gap-4">
              <BlindNote title="Đếm mù" />
              <ScaleWeigh rows={rows} values={values} onChange={setValues} title={`${opened.code}: số thực đếm`} />
              <PrimaryAction ok={ready} busy={submit.isPending} icon={<LockKeyIcon className="size-6" aria-hidden />}
                label={ready ? "Chốt phiên kiểm kê" : "Nhập đủ số đếm để chốt"}
                onClick={async () => {
                  if (await ask.confirm({ title: `Chốt phiên ${opened.code}?`, description: "Sau khi chốt không sửa được. Chênh lệch do quản lý xem.", confirmLabel: "Chốt phiên" }))
                    submit.mutate(undefined)
                }} />
            </div>
          ) : (
            <EmptyCard icon={ClipboardTextIcon} title="Chưa mở phiên kiểm kê" text="Mở phiên mới ở cột bên trái. Màn đếm không hiển thị tồn sổ."
              action={<Btn disabled={create.isPending} onClick={() => create.mutate("A")}>Kiểm kê cuối ngày nhóm A</Btn>} />
          )}
        </div>
      </div>
    </div>
  )
}
