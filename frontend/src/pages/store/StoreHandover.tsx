import { ArrowRightIcon, ChefHatIcon, PenNibIcon, ScalesIcon, TruckIcon, WarningOctagonIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { useAsk } from "@/components/ask"
import { Loading } from "@/components/common"
import { PinDialog } from "@/components/PinDialog"
import { allScaleFilled, BlindNote, PrimaryAction, ScaleWeigh, scaleNumbers, viNum } from "@/components/ScaleWeigh"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { qty, time, unit } from "@/lib/format"
import type { Handover, Ingredient } from "@/lib/types"
import { errorText, useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { Btn, DoneCard, ShiftBadge, StoreHeader, Strip } from "@/pages/store/parts"

type Stage = "issue" | "pass" | "chef" | "done"
interface Mismatch { line_id: number; ingredient: string; issued_qty: number; received_qty: number; unit: string }

/** Ba bước của một lần bàn giao, nối bằng một thanh tiến độ. */
function HandSteps({ at }: { at: number }) {
  const steps = ["Thủ kho cân xuất", "Bếp trưởng cân lại", "Ký nhận bằng PIN"]
  return (
    <ol className="relative grid min-w-0 flex-[1_1_520px] grid-cols-3 gap-2" aria-label="Các bước bàn giao">
      <div aria-hidden className="absolute top-[17px] right-1/3 left-[18px] h-0.5 bg-[#e7e4e1]">
        <div className="h-full bg-[#eb9360] transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: `${(Math.min(at, 2) / 2) * 100}%` }} />
      </div>
      {steps.map((s, i) => {
        const st = i < at ? "done" : i === at ? "now" : "next"
        return (
          <li key={s} aria-current={st === "now" ? "step" : undefined} className="relative flex min-w-0 items-center gap-2.5">
            <span className={cn("flex size-9 flex-none items-center justify-center rounded-full text-sm font-extrabold shadow-[0_0_0_4px_#fdfdfc] transition-colors duration-500",
              st === "done" ? "bg-[#eb9360] text-[#1c1917]" : st === "now" ? "bg-[#1c1917] text-[#fafaf9]" : "bg-[#e7e4e1] text-[#1c1917]")}>
              {st === "done" ? "✓" : i + 1}
            </span>
            <span className={cn("bg-[#fdfdfc] pr-1.5 text-sm leading-[1.25] font-bold whitespace-nowrap", st === "next" ? "text-[#4f4a45]" : "text-[#1c1917]")}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function StoreHandover() {
  const { me } = useAuth()
  const nav = useNavigate()
  const ask = useAsk()
  const list = useQuery({ queryKey: ["handovers"], queryFn: () => api.get<Handover[]>("/handovers") })
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const groupA = (ings.data ?? []).filter((i) => i.control_group === "A" && i.active)
  const [stage, setStage] = useState<Stage | null>(null)
  const [hid, setHid] = useState<number | null>(null)
  const [issueVals, setIssueVals] = useState<Record<string, string>>({})
  const [chefVals, setChefVals] = useState<Record<string, string>>({})
  const [mismatch, setMismatch] = useState<Mismatch[] | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [signed, setSigned] = useState<Handover | null>(null)
  const shiftOpen = me?.shift?.status === "open"
  const pending = (list.data ?? []).filter((h) => h.status === "pending")
  const current = (list.data ?? []).find((h) => h.id === hid) ?? null

  // Mở màn: nếu đang có phiếu chờ ký thì tiếp tục phiếu đó, không thì bắt đầu cân xuất.
  useEffect(() => {
    if (stage !== null || !list.data) return
    if (pending[0]) { setHid(pending[0].id); setStage("pass") } else setStage("issue")
  }, [list.data, stage]) // eslint-disable-line react-hooks/exhaustive-deps
  // Phiếu đang xử lý không còn chờ ký (đã ký / đã hủy ở máy khác): quay về bước cân xuất.
  // Phiếu vừa tạo chưa có trong danh sách cũ thì chờ tải lại xong mới xét.
  useEffect(() => {
    if ((stage !== "pass" && stage !== "chef") || !list.data) return
    const h = list.data.find((x) => x.id === hid)
    if (h ? h.status !== "pending" : !list.isFetching) { setHid(null); setStage("issue") }
  }, [list.data, list.isFetching, stage, hid])

  const create = useAction(
    () => api.post<Handover>("/handovers", {
      kind: shiftOpen ? "supplement" : "start",
      lines: Object.entries(scaleNumbers(issueVals)).filter(([, q]) => q > 0).map(([id, q]) => ({ ingredient_id: Number(id), qty: q })),
    }),
    {
      success: (h) => `Đã tạo ${h.code}. Đưa máy cho bếp trưởng cân lại và ký.`,
      invalidate: [["handovers"]],
      onSuccess: (h) => { setHid(h.id); setIssueVals({}); setStage("pass") },
    },
  )
  const cancel = useAction((id: number) => api.post(`/handovers/${id}/cancel`, { note: "Thủ kho hủy để cân xuất lại" }), {
    success: "Đã hủy phiếu", invalidate: [["handovers"]], onSuccess: () => { setHid(null); setStage("issue") },
  })
  const sign = useAction(
    (v: { userId: number; pin: string }) => api.post<Handover>(`/handovers/${hid}/sign`, { signer_id: v.userId, pin: v.pin, received: scaleNumbers(chefVals) }),
    {
      success: "Đã ký nhận: tồn chuyển sang Bếp, gắn với bếp trưởng ca",
      invalidate: [["handovers"], ["me"]],
      quietError: true,
      onSuccess: (h) => { setPinOpen(false); setSigned(h); setStage("done") },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409 && Array.isArray(e.data)) { setPinOpen(false); setMismatch(e.data as Mismatch[]) }
      },
    },
  )

  if (list.isLoading || ings.isLoading || stage === null) return <Loading />
  const issueRows = groupA.map((i) => ({ key: i.id, label: i.name, unit: i.base_unit, hint: "Để trống nếu không xuất" }))
  const chefRows = (current?.lines ?? []).map((l) => ({ key: l.id, label: l.ingredient, unit: l.unit, hint: "Bếp trưởng tự cân lại, không thấy số thủ kho" }))
  const hasIssue = Object.values(issueVals).some((v) => Number(v) > 0)
  const chefReady = allScaleFilled(chefRows, chefVals)
  const stepAt = stage === "issue" ? 0 : stage === "pass" ? 1 : stage === "chef" ? (chefReady ? 2 : 1) : 3

  return (
    <div className="flex flex-col gap-6">
      <StoreHeader icon={TruckIcon} title="Bàn giao Kho → Bếp" desc="Thủ kho cân xuất nhóm A, đưa máy cho bếp trưởng cân lại và ký PIN. Chỉ khi ký xong hàng mới chuyển sang Bếp." />
      <Strip>
        <ShiftBadge />
        <HandSteps at={stepAt} />
      </Strip>

      <div key={stage} className="st-flip flex flex-col gap-4">
        {stage === "issue" && (
          <>
            <ScaleWeigh rows={issueRows} values={issueVals} onChange={setIssueVals}
              title={`${shiftOpen ? "Bàn giao bổ sung" : "Bàn giao đầu ca"}: số thủ kho cân xuất`} />
            <PrimaryAction ok={hasIssue} busy={create.isPending} onClick={() => create.mutate(undefined)}
              label={hasIssue ? "Tạo phiếu, chuyển bếp trưởng ký" : "Nhập ít nhất một nguyên liệu"} icon={<ArrowRightIcon className="size-6" aria-hidden />} />
          </>
        )}

        {stage === "pass" && current && (
          <div className="on-dark flex flex-col items-center gap-4 rounded-[26px] bg-[#1c1917] px-8 py-14 text-center text-[#fafaf9] shadow-[0_30px_60px_-30px_rgba(41,37,36,.6)]">
            <div className="relative size-24">
              <div aria-hidden className="st-ping absolute inset-4 rounded-full bg-[#eb9360]" />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#eb9360] text-[#1c1917]"><ChefHatIcon className="size-[50px]" aria-hidden /></div>
            </div>
            <div className="text-[15px] font-semibold text-[#f3c4a6]">{current.code} đã tạo, {current.lines.length} nguyên liệu</div>
            <div className="font-display text-[40px] leading-[1.1] font-bold tracking-[-.03em]">Đưa máy cho bếp trưởng</div>
            <p className="m-0 max-w-[460px] text-base text-[#d6d3d1]">Số thủ kho cân xuất đã được ẩn. Bếp trưởng đặt từng loại lên cân, nhập đúng số trên cân rồi ký bằng mã PIN.</p>
            <button type="button" onClick={() => { setChefVals({}); setMismatch(null); setStage("chef") }}
              className="mt-2 inline-flex h-[60px] items-center gap-2.5 rounded-2xl bg-[#eb9360] px-7 text-lg font-bold text-[#1c1917] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[.97]">
              <ScalesIcon className="size-[22px]" aria-hidden /> Tôi là bếp trưởng, bắt đầu cân lại
            </button>
            <button type="button" className="h-11 rounded-xl px-4 text-sm font-semibold text-[#d6d3d1] underline underline-offset-4 hover:text-[#fafaf9]"
              onClick={async () => {
                if (await ask.confirm({ title: `Hủy phiếu ${current.code}?`, description: "Dùng khi cần cân xuất lại. Phiếu đã hủy vẫn được lưu để truy vết.", confirmLabel: "Hủy phiếu", danger: true }))
                  cancel.mutate(current.id)
              }}>Thủ kho hủy phiếu để cân xuất lại</button>
          </div>
        )}

        {stage === "chef" && current && (
          <>
            {mismatch && (
              <div className="flex gap-3 rounded-[18px] bg-[#fbe3e3] px-[18px] py-4 text-[#8f1a1a]" role="alert">
                <WarningOctagonIcon className="size-[26px] flex-none" aria-hidden />
                <div>
                  <div className="font-bold">Số cân hai bên lệch quá dung sai: cân lại trước khi ký</div>
                  {mismatch.map((m) => <div key={m.line_id} className="text-sm">{m.ingredient}: thủ kho xuất {qty(m.issued_qty, m.unit)}, bếp cân {qty(m.received_qty, m.unit)}</div>)}
                  <div className="mt-1 text-sm">Lần ký bị từ chối đã được lưu làm bằng chứng.</div>
                </div>
              </div>
            )}
            <BlindNote title="Cân lại độc lập" />
            <ScaleWeigh rows={chefRows} values={chefVals} onChange={(v) => { setChefVals(v); setMismatch(null) }} title="Số bếp trưởng cân được" />
            <PrimaryAction ok={chefReady} onClick={() => setPinOpen(true)}
              label={chefReady ? "Bếp trưởng ký nhận bằng PIN" : "Nhập đủ số cân để ký"} icon={<PenNibIcon className="size-6" aria-hidden />} />
            <PinDialog
              open={pinOpen}
              onOpenChange={(v) => { setPinOpen(v); if (!v) sign.reset() }}
              title={`Ký nhận bàn giao ${current.code}`}
              description="Ký nhận là chịu trách nhiệm số hàng này trong ca. Chênh lệch khi cân trả cuối ca gắn với người ký."
              busy={sign.isPending}
              error={sign.error instanceof ApiError && sign.error.status !== 409 ? errorText(sign.error) : null}
              onConfirm={(userId, pin) => sign.mutate({ userId, pin })}
            />
          </>
        )}

        {stage === "done" && (
          <DoneCard title="Bàn giao hoàn tất"
            text={`${signed?.code ?? current?.code ?? ""} được ${signed?.received_by ?? "bếp trưởng"} ký nhận lúc ${time(signed?.signed_at)}. Tồn đã chuyển sang Bếp, gắn với bếp trưởng ca.`}
            items={(signed?.lines ?? current?.lines ?? []).map((l) => ({ label: l.ingredient, value: `${viNum(String(Number(l.received_qty ?? chefVals[String(l.id)] ?? 0)))} ${unit(l.unit)}` }))}>
            <Btn onClick={() => { setSigned(null); setHid(null); setStage("issue") }}>Bàn giao bổ sung giữa ca</Btn>
            <Btn kind="outline" onClick={() => nav("/van-hanh/hom-nay")}>Về Việc hôm nay</Btn>
          </DoneCard>
        )}
      </div>
    </div>
  )
}
