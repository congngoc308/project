import { useQuery } from "@tanstack/react-query"
import { AlertOctagon, AlertTriangle, Check, Info, type IconType } from "@/components/icons"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { A, CARD, EmptyNote, FilterPills, PageHead, Pill, Seg, adminToast, delay } from "@/layouts/AdminBits"
import { api } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { dateTime } from "@/lib/format"
import type { Alert } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"

const ALERT_KIND: Record<string, string> = {
  out_with_book: "Báo hết khi sổ còn hàng",
  variance_must: "Phải điều tra",
  variance_warn: "Mức cảnh báo",
  trend: "Xu hướng lệch cùng chiều",
  handover_unsigned: "Bàn giao chưa ký",
  handover_mismatch: "Bàn giao lệch cân",
  shift_not_returned: "Chưa cân trả",
  no_handover: "Chưa bàn giao đầu ca",
  no_count: "Chưa kiểm kê",
  investigation_overdue: "Phiếu quá hạn",
  cancel_anomaly: "Hủy / làm lại bất thường",
  negative_book: "Tồn sổ âm",
  receipt_pending: "Phiếu nhập chờ duyệt",
}

const SEV: Record<Alert["severity"], { label: string; bg: string; c: string; icon: IconType }> = {
  critical: { label: "Nghiêm trọng", bg: A.badBg, c: A.bad, icon: AlertOctagon },
  warn: { label: "Cảnh báo", bg: A.warnBg, c: A.warn, icon: AlertTriangle },
  info: { label: "Lưu ý", bg: A.line2, c: A.sub, icon: Info },
}

type Filter = "all" | Alert["severity"]
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })

/** Cảnh báo theo thiết kế "Quan Ly Admin": lọc theo mức, nhóm theo ngày, đánh dấu đã xử lý (dòng trượt đi). */
export function AlertsPage() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = (["critical", "warn", "info"].includes(params.get("muc") ?? "") ? params.get("muc") : "all") as Filter
  const [status, setStatus] = useState<"open" | "resolved">("open")
  const now = useServerNow(60_000)
  const q = useQuery({ queryKey: ["alerts", status], queryFn: () => api.get<Alert[]>(`/alerts?status=${status}`) })
  const [leaving, setLeaving] = useState<Set<number>>(new Set())
  const resolve = useAction((id: number) => api.post(`/alerts/${id}/resolve`), {
    invalidate: [["alerts"], ["dashboard"]],
    onSuccess: () => adminToast("Đã đánh dấu cảnh báo là đã xử lý"),
    onError: () => setLeaving(new Set()),
  })
  const markDone = (id: number) => {
    setLeaving((s) => new Set(s).add(id))
    window.setTimeout(() => resolve.mutate(id), 420)
  }

  const all = q.data ?? []
  const n = (sev: Alert["severity"]) => all.filter((a) => a.severity === sev).length
  const shown = all.filter((a) => filter === "all" || a.severity === filter)
  const today = DAY.format(now), yesterday = DAY.format(new Date(now.getTime() - 86_400_000))
  const groups = [["Hôm nay", (d: string) => d === today], ["Hôm qua", (d: string) => d === yesterday], ["Trước đó", (d: string) => d !== today && d !== yesterday]] as const
  const grouped = groups.map(([title, test]) => ({ title, items: shown.filter((a) => test(DAY.format(new Date(a.at)))) })).filter((g) => g.items.length)

  return (
    <div className="flex max-w-[980px] flex-col gap-[26px]">
      <PageHead title="Cảnh báo"
        desc="Hệ thống tự phát hiện chênh lệch vượt ngưỡng, báo hết khi sổ còn hàng, quy trình bị bỏ qua, xu hướng lệch cùng chiều và phiếu quá hạn. Đánh dấu đã xử lý khi đã có hành động."
        right={<Seg label="Trạng thái cảnh báo" value={status} onChange={setStatus} options={[{ key: "open", label: "Đang mở" }, { key: "resolved", label: "Đã xử lý" }]} />} />
      <div className="a-rise" style={{ animationDelay: "50ms" }}>
        <FilterPills label="Lọc theo mức" value={filter} onChange={(v) => setParams(v === "all" ? {} : { muc: v }, { replace: true })}
          items={[{ key: "all", label: "Tất cả", n: all.length }, { key: "critical", label: "Nghiêm trọng", n: n("critical") }, { key: "warn", label: "Cảnh báo", n: n("warn") },
            ...(n("info") ? [{ key: "info" as const, label: "Lưu ý", n: n("info") }] : [])]} />
      </div>
      {q.isLoading ? <div className={cn(CARD, "h-40 animate-pulse")} /> : !grouped.length ? (
        <div className={cn(CARD, "a-rise")}><EmptyNote>{status === "open" ? "Không có cảnh báo nào trong nhóm này" : "Chưa có cảnh báo đã xử lý"}</EmptyNote></div>
      ) : grouped.map((g, gi) => (
        <section key={g.title} aria-label={g.title} className="a-rise flex flex-col gap-2.5" style={delay(gi, 100, 80)}>
          <h2 className="m-0 text-sm font-bold text-[#4f4a45]">{g.title}</h2>
          <ul className={cn(CARD, "overflow-hidden")}>
            {g.items.map((a) => {
              const s = SEV[a.severity] ?? SEV.warn
              const out = leaving.has(a.id)
              return (
                <li key={a.id} className="grid grid-cols-[42px_1fr] items-start gap-3.5 overflow-hidden border-t border-[#efedeb] first:border-t-0 sm:grid-cols-[42px_1fr_auto]"
                  style={{ maxHeight: out ? 0 : 260, opacity: out ? 0 : 1, transform: out ? "translateX(40px)" : "none", padding: out ? "0 20px" : "16px 20px",
                    transition: "max-height .45s cubic-bezier(.16,1,.3,1), opacity .3s, transform .45s cubic-bezier(.16,1,.3,1), padding .45s" }}>
                  <span className="flex size-[42px] items-center justify-center rounded-xl" style={{ background: s.bg, color: s.c }}><s.icon className="size-[21px]" aria-hidden /></span>
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{a.title}</span>
                      <Pill bg={s.bg} c={s.c}>{s.label}</Pill>
                      {ALERT_KIND[a.kind] && <Pill>{ALERT_KIND[a.kind]}</Pill>}
                    </div>
                    {a.body && <div className="text-sm leading-normal text-[#4f4a45]">{a.body}</div>}
                    <div className="font-mono text-sm text-[#4f4a45]">{dateTime(a.at)}</div>
                  </div>
                  <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                    {a.ref_type === "investigation" && a.ref_id && (
                      <button type="button" onClick={() => nav(`/quan-ly/dieu-tra/${a.ref_id}`)}
                        className="h-11 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap text-[#7c3410] transition-colors hover:bg-[#fbeae0]">Mở phiếu</button>
                    )}
                    {a.status === "open" && (
                      <button type="button" disabled={out} onClick={() => markDone(a.id)}
                        className="flex h-11 items-center gap-1.5 rounded-xl bg-[#f2f0ee] px-3.5 text-sm font-bold whitespace-nowrap transition-[background-color,transform] hover:bg-[#e7e4e1] active:scale-[.96]">
                        <Check weight="bold" className="size-4" aria-hidden />Đã xử lý
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
