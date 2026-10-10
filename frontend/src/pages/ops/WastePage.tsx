import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, SealCheck, Trash2, User, X, XCircle } from "@/components/icons"
import { useRef, useState } from "react"

import { Loading } from "@/components/common"
import { chime, K, KConfirm, KDialog, KeyPad, kToast, Panel, pick, ReasonPicker, StepDot, useFlip } from "@/layouts/KitchenBits"
import { api } from "@/lib/api"
import { useAuth, useMeta } from "@/lib/auth"
import { qty, time, unit } from "@/lib/format"
import type { Ingredient, WasteSlip } from "@/lib/types"
import { errorText, useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

export const WASTE_STATUS: Record<WasteSlip["status"], { label: string; tone: "warn" | "good" | "bad" }> = {
  pending_chef: { label: "Chờ bếp trưởng duyệt", tone: "warn" },
  pending_manager: { label: "Chờ quản lý duyệt (vượt hạn mức)", tone: "warn" },
  approved: { label: "Đã duyệt", tone: "good" },
  rejected: { label: "Từ chối", tone: "bad" },
}
/** Màu nhãn phiếu (chữ đạt 7 : 1 trên nền nhạt). */
const SLIP_TONE = { warn: ["#fef3c7", "#713f12"], good: ["#dcfce7", "#14532d"], bad: ["#fee2e2", "#7f1d1d"] } as const

const comma = (v: string) => (v === "" ? "0" : v.replace(".", ","))

/** Ghi hao hụt tại thời điểm xảy ra; bếp trưởng duyệt trong hạn mức. */
export function WastePage() {
  const { has, me } = useAuth()
  const meta = useMeta()
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const mine = useQuery({ queryKey: ["waste"], queryFn: () => api.get<WasteSlip[]>("/waste") })
  const pending = useQuery({ queryKey: ["waste", "pending"], queryFn: () => api.get<WasteSlip[]>("/waste?status=pending"), enabled: has("head_chef", "manager") })
  const [ingId, setIngId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const ing = ings.data?.find((i) => i.id === ingId)
  const fail = (e: unknown) => { chime("bad"); kToast("Không thực hiện được", errorText(e) ?? "Có lỗi xảy ra", "bad") }
  const create = useAction(
    () => api.post<WasteSlip>("/waste", { ingredient_id: ingId, qty: Number(amount), waste_type: type, reason }),
    {
      invalidate: [["waste"]],
      quietError: true,
      onError: fail,
      onSuccess: (s) => {
        chime("ok")
        kToast("Đã ghi hao hụt", `${qty(s.qty, s.unit)} ${s.ingredient.toLowerCase()}: ${WASTE_STATUS[s.status].label}`)
        setAmount(""); setReason(""); setType(null); setIngId(null)
      },
    },
  )
  const approve = useAction((s: WasteSlip) => api.post(`/waste/${s.id}/approve`).then(() => s), {
    invalidate: [["waste"]], quietError: true, onError: fail,
    onSuccess: (s) => { chime("ok"); kToast("Đã duyệt phiếu hao hụt", `${s.ingredient} ${qty(s.qty, s.unit)}, ${s.created_by}`) },
  })
  const reject = useAction((v: { s: WasteSlip; note: string }) => api.post(`/waste/${v.s.id}/reject`, { note: v.note }).then(() => v.s), {
    invalidate: [["waste"]], quietError: true, onError: fail,
    onSuccess: (s) => { setRejecting(null); chime("bad"); kToast("Đã từ chối phiếu", `${s.ingredient} ${qty(s.qty, s.unit)}: hao hụt được đảo lại vào tồn`, "bad") },
  })
  const [rejecting, setRejecting] = useState<WasteSlip | null>(null)
  const [rejectNote, setRejectNote] = useState("")

  const types = meta.data ? meta.data.manual_waste_types.map((k) => ({ key: k, ...meta.data!.waste_types[k] })) : []
  const groups = [...new Set(types.map((t) => t.group))]
  const usable = (ings.data ?? []).filter((i) => i.active)
  const toApprove = (pending.data ?? []).filter((s) => s.created_by !== me?.full_name && (s.status === "pending_chef" || has("manager")))
  const recent = (mine.data ?? []).slice(0, 6)
  const needReason = type === "khac"
  const missing = !ingId ? "Chọn nguyên liệu" : !type ? "Chọn loại hao hụt" : !(Number(amount) > 0) ? "Nhập lượng" : needReason && !reason.trim() ? "Ghi lý do" : null
  const overLimit = ing?.waste_limit != null && Number(amount) > Number(ing.waste_limit)
  const ready = !missing && !create.isPending

  const key = (k: string) => setAmount((a) => {
    if (k === "back") return a.slice(0, -1)
    if (k === ",") return a.includes(".") ? a : (a || "0") + "."
    if (a.replace(".", "").length >= 7) return a
    return (a === "0" ? "" : a) + k
  })

  const pageRef = useRef<HTMLDivElement>(null)
  useFlip(pageRef, !!mine.data)

  return (
    <div ref={pageRef}>
      <div data-stagger>
        <h1 className="font-display text-[36px] leading-tight font-extrabold">Ghi hao hụt</h1>
        <p className="mt-1.5 text-[17px] text-[#3d3833]">Ghi ngay khi xảy ra (rơi, hỏng, cháy…). Hao hụt ghi đúng lúc không bị tính là thất thoát khi cân trả cuối ca.</p>
      </div>
      <div className="mt-[22px] grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-5">
          {has("head_chef", "manager") && (
            <section data-stagger aria-labelledby="cho-duyet" className="rounded-[26px] border-2 border-[#141210] bg-white p-6">
              <div className="flex items-center gap-3">
                <SealCheck className="size-8 shrink-0 text-[#c2410c]" aria-hidden />
                <h2 id="cho-duyet" className="flex-1 text-[22px] font-extrabold">Chờ bạn duyệt</h2>
                <span className="flex h-[38px] min-w-[38px] items-center justify-center rounded-full bg-[#9a3412] px-3 text-lg font-extrabold text-white tabular" aria-label={`${toApprove.length} phiếu`}>{toApprove.length}</span>
              </div>
              <p className="mt-1.5 mb-4 text-[15px] leading-normal text-[#3d3833]">Phiếu trong hạn mức do người khác ghi. Phiếu vượt hạn mức chuyển quản lý; phiếu của bạn không tự duyệt được.</p>
              {pending.isLoading ? <Loading rows={2} /> : toApprove.length ? (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
                  {toApprove.map((s) => (
                    <div key={s.id} data-flip={`p${s.id}`} className="flex flex-col gap-2.5 rounded-[18px] bg-[#f5f4f1] p-4">
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span className="text-[21px] font-extrabold">{s.ingredient} {qty(s.qty, s.unit)}</span>
                        <span className="text-[15px] text-[#3d3833] tabular">{time(s.at)}</span>
                      </div>
                      <div className="text-base leading-snug text-[#3d3833]">{s.type_label}, {s.reason || "không ghi lý do"}</div>
                      <div className="flex items-center gap-2 text-base font-bold"><User className="size-5" aria-hidden />{s.created_by}</div>
                      {s.status === "pending_manager" && (
                        <div className="inline-flex items-center gap-1.5 self-start rounded-xl bg-[#fef3c7] px-2.5 py-1 text-[15px] font-bold text-[#713f12]">
                          <AlertTriangle weight="fill" className="size-4" aria-hidden />Vượt hạn mức, cần quản lý
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" disabled={(s.status === "pending_manager" && !has("manager")) || approve.isPending} onClick={() => approve.mutate(s)}
                          className="flex h-14 items-center justify-center gap-2 rounded-[14px] bg-[#15803d] text-[19px] font-extrabold text-white transition-[filter] hover:brightness-110 active:scale-[.96] disabled:cursor-not-allowed disabled:bg-[#e9e6e1] disabled:text-[#3d3833]">
                          <CheckCircle2 weight="fill" className="size-[22px]" aria-hidden />Duyệt
                        </button>
                        <button type="button" onClick={() => { setRejectNote(""); setRejecting(s) }}
                          className="flex h-14 items-center justify-center gap-2 rounded-[14px] border-2 border-[#cdc5ba] bg-white text-lg font-bold hover:border-[#141210] active:scale-[.96]">
                          <X className="size-5" aria-hidden />Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="rounded-[18px] border-2 border-dashed border-[#b9b0a3] px-5 py-7 text-center text-[17px] text-[#3d3833]">Không có phiếu chờ duyệt</div>}
            </section>
          )}

          <Panel data-stagger>
            <div className="mb-4 flex items-center gap-3"><StepDot n={1} done={!!ingId} /><h2 className="text-[22px] font-extrabold">Nguyên liệu</h2></div>
            {ings.isLoading ? <Loading rows={2} /> : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-5">
                {usable.map((i) => (
                  <button key={i.id} type="button" aria-pressed={ingId === i.id} onClick={() => setIngId(i.id)}
                    className={cn("min-h-16 rounded-2xl border-2 px-2 text-lg font-bold transition-colors duration-200 active:scale-[.96]", pick(ingId === i.id))}>{i.name}</button>
                ))}
              </div>
            )}
            <div className="my-6 h-px bg-[#cdc5ba]" />
            <div className="mb-4 flex items-center gap-3"><StepDot n={2} done={!!type} /><h2 className="text-[22px] font-extrabold">Loại hao hụt</h2></div>
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g} className="grid items-start gap-3 sm:grid-cols-[120px_minmax(0,1fr)]" role="group" aria-label={g}>
                  <div className="text-[15px] font-extrabold tracking-[.04em] text-[#3d3833] uppercase sm:pt-[15px]">{g}</div>
                  <div className="flex flex-wrap gap-2.5">
                    {types.filter((t) => t.group === g).map((t) => (
                      <button key={t.key} type="button" aria-pressed={type === t.key} onClick={() => setType(t.key)}
                        className={cn("h-[54px] rounded-full border-2 px-5 text-[17px] font-bold transition-colors duration-200 active:scale-[.96]", pick(type === t.key))}>{t.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel data-stagger>
            <h2 className="mb-3.5 text-[22px] font-extrabold">Phiếu gần đây</h2>
            {mine.isLoading ? <Loading rows={2} /> : recent.length ? (
              <div className="grid gap-2.5 2xl:grid-cols-2">
                {recent.map((s) => {
                  const st = WASTE_STATUS[s.status], [bg, color] = SLIP_TONE[st.tone]
                  return (
                    <div key={s.id} data-flip={`s${s.id}`} className="flex items-center justify-between gap-2.5 rounded-2xl bg-[#f5f4f1] px-3.5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-extrabold">{s.ingredient} {qty(s.qty, s.unit)}</div>
                        <div className="text-[15px] text-[#3d3833]">{s.type_label}</div>
                      </div>
                      <span className="max-w-[170px] shrink-0 rounded-xl px-3 py-1.5 text-center text-sm leading-tight font-extrabold" style={{ background: bg, color }}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            ) : <p className="rounded-2xl border-2 border-dashed border-[#b9b0a3] px-5 py-6 text-center text-[17px] text-[#3d3833]">Chưa có phiếu hao hụt</p>}
          </Panel>
        </div>

        <Panel data-stagger className="shadow-[0_1px_2px_rgba(28,25,23,.06),0_14px_32px_-18px_rgba(28,25,23,.22)] xl:sticky xl:top-5">
          <div className="mb-1.5 flex items-center gap-3"><StepDot n={3} done={Number(amount) > 0} /><h2 className="text-[22px] font-extrabold">Lượng hao hụt</h2></div>
          <div className="mb-3 ml-12 min-h-[22px] text-[15px] text-[#3d3833]">
            {ing ? <>{ing.name}, đơn vị {unit(ing.base_unit)}{ing.waste_limit ? `, hạn mức một phiếu ${qty(ing.waste_limit, ing.base_unit)}` : ""}</> : "Chọn nguyên liệu trước"}
          </div>
          <div aria-live="polite" className="rounded-2xl bg-[#141210] px-5 py-3 text-right font-display text-5xl leading-[1.15] font-extrabold text-white tabular">
            {comma(amount)} <span className="text-[22px] font-semibold text-[#d6d0c7]">{ing ? unit(ing.base_unit) : ""}</span>
          </div>
          {overLimit && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#fef3c7] px-3 py-2 text-base font-bold text-[#713f12]">
              <AlertTriangle weight="fill" className="size-5 shrink-0" aria-hidden />Vượt hạn mức: phiếu sẽ chờ quản lý duyệt.
            </div>
          )}
          <div className="mt-3"><KeyPad onKey={key} left="," /></div>
          <div className="mt-5 mb-2.5 flex items-center gap-3">
            <StepDot n={4} done={!!reason.trim()} />
            <label htmlFor="ly-do-hao-hut" className="text-[22px] font-extrabold">Lý do</label>
            <span className="ml-auto text-[15px] font-bold" style={{ color: needReason ? K.badText : K.sub }}>{needReason ? "bắt buộc" : "tùy chọn"}</span>
          </div>
          <input id="ly-do-hao-hut" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rơi khi sơ chế, hộp bị hở…"
            className="h-14 w-full rounded-[14px] border-2 border-[#bdb4a7] bg-white px-4 text-lg text-[#141210] outline-none placeholder:text-[#6b645f] focus:border-[#141210] focus:shadow-[0_0_0_4px_rgba(235,147,96,.35)]" />
          <button type="button" disabled={!ready} onClick={() => create.mutate(undefined)}
            className={cn("mt-3.5 flex h-[68px] w-full items-center justify-center gap-2.5 rounded-[18px] text-xl font-extrabold transition-colors duration-300 active:scale-[.98]",
              ready ? "bg-[#c2410c] text-white hover:brightness-110" : "cursor-not-allowed bg-[#e9e6e1] text-[#3d3833]")}>
            <Trash2 className="size-[26px]" aria-hidden /><span className="whitespace-nowrap">{create.isPending ? "Đang ghi…" : missing ?? "Ghi hao hụt ngay"}</span>
          </button>
        </Panel>
      </div>
      {rejecting && (
        <KDialog open onClose={() => setRejecting(null)} icon={XCircle} tone="bad" title={`Từ chối phiếu ${rejecting.ingredient} ${qty(rejecting.qty, rejecting.unit)}?`}
          desc={`Ghi bởi ${rejecting.created_by}. Hao hụt sẽ được đảo lại vào tồn.`}
          footer={<KConfirm ok={!!rejectNote.trim() && !reject.isPending} bg={K.bad} onClick={() => reject.mutate({ s: rejecting, note: rejectNote.trim() })}>Từ chối</KConfirm>}>
          <ReasonPicker presets={["Không đúng thực tế", "Sai nguyên liệu", "Sai lượng"]} value={rejectNote} onChange={setRejectNote} />
        </KDialog>
      )}
    </div>
  )
}
