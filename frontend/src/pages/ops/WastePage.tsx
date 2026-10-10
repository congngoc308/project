import { useQuery } from "@tanstack/react-query"
import { Check, Trash2, X } from "@/components/icons"
import { useState } from "react"

import { useAsk } from "@/components/ask"
import { Choice, Empty, Loading, PageHeader, StatusPill, StepLabel } from "@/components/common"
import { displayNum, NumPad } from "@/components/NumPad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useAuth, useMeta } from "@/lib/auth"
import { dateTime, qty, unit } from "@/lib/format"
import type { Ingredient, WasteSlip } from "@/lib/types"
import { useAction } from "@/lib/useAction"

export const WASTE_STATUS: Record<WasteSlip["status"], { label: string; tone: "warn" | "good" | "bad" }> = {
  pending_chef: { label: "Chờ bếp trưởng duyệt", tone: "warn" },
  pending_manager: { label: "Chờ quản lý duyệt (vượt hạn mức)", tone: "warn" },
  approved: { label: "Đã duyệt", tone: "good" },
  rejected: { label: "Từ chối", tone: "bad" },
}

/** Ghi hao hụt tại thời điểm xảy ra; bếp trưởng duyệt trong hạn mức. */
export function WastePage() {
  const { has, me } = useAuth()
  const ask = useAsk()
  const meta = useMeta()
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const mine = useQuery({ queryKey: ["waste"], queryFn: () => api.get<WasteSlip[]>("/waste") })
  const pending = useQuery({ queryKey: ["waste", "pending"], queryFn: () => api.get<WasteSlip[]>("/waste?status=pending"), enabled: has("head_chef", "manager") })
  const [ingId, setIngId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const ing = ings.data?.find((i) => i.id === ingId)
  const create = useAction(
    () => api.post<WasteSlip>("/waste", { ingredient_id: ingId, qty: Number(amount), waste_type: type, reason }),
    {
      success: (s) => `Đã ghi hao hụt ${qty(s.qty, s.unit)} ${s.ingredient}: ${WASTE_STATUS[s.status].label}`,
      invalidate: [["waste"]],
      onSuccess: () => { setAmount(""); setReason(""); setType(null); setIngId(null) },
    },
  )
  const approve = useAction((id: number) => api.post(`/waste/${id}/approve`), { success: "Đã duyệt", invalidate: [["waste"]] })
  const reject = useAction((v: { id: number; note: string }) => api.post(`/waste/${v.id}/reject`, { note: v.note }), { success: "Đã từ chối, hao hụt được đảo lại", invalidate: [["waste"]] })

  const types = meta.data ? meta.data.manual_waste_types.map((k) => ({ key: k, ...meta.data!.waste_types[k] })) : []
  const groups = [...new Set(types.map((t) => t.group))]
  const usable = (ings.data ?? []).filter((i) => i.active)
  const toApprove = (pending.data ?? []).filter((s) => s.created_by !== me?.full_name && (s.status === "pending_chef" || has("manager")))
  const needReason = type === "khac"
  const missing = !ingId ? "Chọn nguyên liệu" : !type ? "Chọn loại hao hụt" : !(Number(amount) > 0) ? "Nhập lượng" : needReason && !reason.trim() ? "Ghi lý do" : null
  const overLimit = ing?.waste_limit != null && Number(amount) > Number(ing.waste_limit)

  return (
    <div>
      <PageHeader title="Ghi hao hụt" icon={Trash2}
        description="Ghi ngay khi xảy ra (rơi, hỏng, cháy…). Hao hụt ghi đúng lúc không bị tính là thất thoát khi cân trả cuối ca." />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <StepLabel n={1} done={!!ingId}>Nguyên liệu</StepLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {usable.map((i) => (
                <Choice key={i.id} selected={ingId === i.id} onClick={() => setIngId(i.id)}>{i.name}</Choice>
              ))}
            </div>
          </section>
          <section>
            <StepLabel n={2} done={!!type}>Loại hao hụt</StepLabel>
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g}>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
                  <div className="flex flex-wrap gap-2">
                    {types.filter((t) => t.group === g).map((t) => (
                      <Choice key={t.key} className="text-sm" selected={type === t.key} onClick={() => setType(t.key)}>{t.label}</Choice>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5 lg:sticky lg:top-36">
          <div className="surface p-3">
            <StepLabel n={3} done={Number(amount) > 0}>Lượng hao hụt</StepLabel>
            <div className="mb-1 text-sm text-muted-foreground">
              {ing ? <>{ing.name}, đơn vị {unit(ing.base_unit)}{ing.waste_limit ? `, hạn mức một phiếu ${qty(ing.waste_limit, ing.base_unit)}` : ""}</> : "Chọn nguyên liệu trước"}
            </div>
            <div className="on-dark mb-3 rounded-md bg-ink px-3 py-2.5 text-right text-4xl font-bold tabular text-white" aria-live="polite">
              {displayNum(amount)} <span className="text-lg font-normal text-slate-200">{ing ? unit(ing.base_unit) : ""}</span>
            </div>
            {overLimit && <p className="mb-2 text-sm font-medium text-warning-ink">Vượt hạn mức: phiếu sẽ chờ quản lý duyệt.</p>}
            <NumPad value={amount} onChange={setAmount} />
            <div className="mt-4">
              <StepLabel n={4} done={!!reason.trim()} aside={needReason ? <span className="font-medium text-critical-ink">bắt buộc</span> : "tùy chọn"}>Lý do</StepLabel>
              <Input className="h-12" aria-label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rơi khi sơ chế, hộp bị hở…" />
            </div>
            <Button size="touch" className="mt-3 w-full" disabled={!!missing || create.isPending} onClick={() => create.mutate(undefined)}>
              <Trash2 /> {missing ?? "Ghi hao hụt ngay"}
            </Button>
          </div>

          {has("head_chef", "manager") && (
            <div>
              <h2 className="mb-2 text-base font-semibold">Chờ bạn duyệt ({toApprove.length})</h2>
              {pending.isLoading ? <Loading /> : toApprove.length ? (
                <ul className="space-y-2">
                  {toApprove.map((s) => (
                    <li key={s.id} className="surface p-3 text-sm">
                      <div className="flex justify-between gap-2 font-semibold"><span>{s.ingredient} {qty(s.qty, s.unit)}</span><span className="font-normal text-muted-foreground">{dateTime(s.at)}</span></div>
                      <div className="text-muted-foreground">{s.type_label}, {s.reason || "-"}, {s.created_by}</div>
                      {s.status === "pending_manager" && <StatusPill tone="warn" className="mt-1">Vượt hạn mức, cần quản lý</StatusPill>}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button size="xl" onClick={() => approve.mutate(s.id)} disabled={s.status === "pending_manager" && !has("manager")}><Check /> Duyệt</Button>
                        <Button size="xl" variant="outline" onClick={async () => {
                          const n = await ask.reason({ title: `Từ chối phiếu ${s.ingredient} ${qty(s.qty, s.unit)}?`, description: "Hao hụt sẽ được đảo lại vào tồn.", presets: ["Không đúng thực tế", "Sai nguyên liệu", "Sai lượng"], confirmLabel: "Từ chối", danger: true })
                          if (n) reject.mutate({ id: s.id, note: n })
                        }}><X /> Từ chối</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <Empty>Không có phiếu chờ duyệt</Empty>}
            </div>
          )}
          <div>
            <h2 className="mb-2 text-base font-semibold">Phiếu gần đây</h2>
            {(mine.data ?? []).length ? (
              <ul className="divide-y surface">
                {(mine.data ?? []).slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>{s.ingredient} {qty(s.qty, s.unit)}<span className="block text-xs text-muted-foreground">{s.type_label}</span></span>
                    <StatusPill tone={WASTE_STATUS[s.status].tone}>{WASTE_STATUS[s.status].label}</StatusPill>
                  </li>
                ))}
              </ul>
            ) : <Empty>Chưa có phiếu hao hụt</Empty>}
          </div>
        </div>
      </div>
    </div>
  )
}
