import { ScalesIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { useAsk } from "@/components/ask"
import { Loading } from "@/components/common"
import { allScaleFilled, BlindNote, PrimaryAction, ScaleWeigh, scaleNumbers } from "@/components/ScaleWeigh"
import { api } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { dateOnly, time } from "@/lib/format"
import type { Shift } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { Btn, DoneCard, EmptyCard, ShiftBadge, StoreHeader, Strip } from "@/pages/store/parts"

export function StoreReturn() {
  const nav = useNavigate()
  const ask = useAsk()
  const now = useServerNow(30_000)
  const shifts = useQuery({ queryKey: ["shifts", 2], queryFn: () => api.get<Shift[]>("/shifts?days=2") })
  const open = (shifts.data ?? []).filter((s) => s.status === "open")
  const [shiftId, setShiftId] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => {
    if (shiftId === null && open[0]) setShiftId(open[0].id)
  }, [open, shiftId])
  const form = useQuery({
    queryKey: ["return-form", shiftId],
    queryFn: () => api.get<{ shift: Shift; ingredients: { id: number; name: string; unit: string }[] }>(`/shifts/${shiftId}/return-form`),
    enabled: !!shiftId,
  })
  const [values, setValues] = useState<Record<string, string>>({})
  const submit = useAction(
    () => api.post<{ code: string }>(`/shifts/${shiftId}/return`, { counts: scaleNumbers(values) }),
    { success: "Đã chốt cân trả, ca đã đóng", invalidate: [["shifts"], ["me"], ["handovers"], ["counts"]], onSuccess: (r) => { setDone(r.code); setValues({}); setShiftId(null) } },
  )
  const rows = (form.data?.ingredients ?? []).map((i) => ({ key: i.id, label: i.name, unit: i.unit, hint: "Nhập 0 nếu đã hết" }))
  const ready = allScaleFilled(rows, values)

  return (
    <div className="flex flex-col gap-6">
      <StoreHeader icon={ScalesIcon} title="Cân trả cuối ca" desc="Cân toàn bộ nguyên liệu nhóm A bếp trả lại. Chốt xong thì ca đóng và chênh lệch chuyển cho quản lý." />
      <Strip>
        <ShiftBadge />
        <span className="flex-[1_1_300px] text-sm text-[#4f4a45]">Bếp không làm thao tác này: thủ kho cân toàn bộ nhóm A bếp trả lại.</span>
      </Strip>

      {shifts.isLoading ? <Loading /> : done ? (
        <DoneCard title="Đã chốt cân trả, ca đã đóng" text={`Phiên ${done} đã lưu. Hàng đã nhập lại Kho; chênh lệch của ca do quản lý xem.`}>
          <Btn onClick={() => nav("/van-hanh/hom-nay")}>Về Việc hôm nay</Btn>
          {open.length > 0 && <Btn kind="outline" onClick={() => setDone(null)}>Cân trả ca khác</Btn>}
        </DoneCard>
      ) : !open.length ? (
        <EmptyCard icon={ScalesIcon} title="Chưa có ca mở" text="Cân trả chỉ làm được sau khi bếp trưởng ký nhận bàn giao đầu ca."
          action={<Btn onClick={() => nav("/van-hanh/kho")}>Đi tới Bàn giao</Btn>} />
      ) : (
        <div className="st-flip flex flex-col gap-4">
          {open.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn ca">
              {open.map((s) => {
                const late = new Date(s.planned_end).getTime() <= now.getTime()
                return (
                  <button key={s.id} type="button" aria-pressed={shiftId === s.id} onClick={() => { setShiftId(s.id); setValues({}) }}
                    className={cn("h-12 rounded-xl px-4 text-[15px] font-semibold", shiftId === s.id ? "bg-[#1c1917] text-[#fafaf9]" : "bg-[#fdfdfc] shadow-[0_0_0_1px_rgba(28,25,23,.08)]")}>
                    {s.name} {dateOnly(s.business_date)}, kết thúc {time(s.planned_end)}{late ? ", đến giờ" : ""}
                  </button>
                )
              })}
            </div>
          )}
          <BlindNote title="Cân mù" />
          {form.isLoading ? <Loading /> : rows.length === 0 ? (
            <EmptyCard icon={ScalesIcon} title="Không có hàng nhóm A tại Bếp" text="Ca này chưa nhận bàn giao nguyên liệu nhóm A nào." />
          ) : (
            <>
              <ScaleWeigh rows={rows} values={values} onChange={setValues} title="Số cân bếp trả (nhập 0 nếu đã hết)" />
              <PrimaryAction ok={ready} busy={submit.isPending} icon={<ScalesIcon className="size-6" aria-hidden />}
                label={ready ? "Chốt cân trả & đóng ca" : "Nhập đủ số cân để chốt"}
                onClick={async () => {
                  if (await ask.confirm({ title: "Chốt số cân trả và đóng ca?", description: "Phiên bị khóa sau khi chốt, không sửa được.", confirmLabel: "Chốt & đóng ca" }))
                    submit.mutate(undefined)
                }} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
