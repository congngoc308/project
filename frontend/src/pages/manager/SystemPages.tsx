import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import {
  AlarmClock, ArrowRight, CalendarPlus, ChefHat, ClipboardList, CookingPot, CrownSimple, DotsNine, FastForward, Funnel, LockKey,
  LockSimple, Password, RotateCcw, Scan, ShieldAlert, UserPlus, Warehouse, type IconType,
} from "@/components/icons"
import { useAsk } from "@/components/ask"
import { A, Btn, CARD, CARD_HOVER, EmptyNote, Modal, PageHead, Pill, Seg, adminToast, delay } from "@/layouts/AdminBits"
import { api, qs } from "@/lib/api"
import { PIN_LEN, useAuth, useMeta } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { dateTime, longClock, money, signedQty, time } from "@/lib/format"
import type { Ingredient, Role, Settings, StaffUser } from "@/lib/types"
import { useAction } from "@/lib/useAction"
import { cn } from "@/lib/utils"
import { Pager, SelectBox, Stepper, rowDelay, usePaged } from "@/pages/manager/SystemBits"

const initials = (n: string) => {
  const p = n.trim().split(/\s+/)
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase()
}

function Loading() {
  return <div className={cn(CARD, "a-fade h-64 motion-safe:animate-pulse")} role="status" aria-label="Đang tải" />
}

// ---- Nhật ký thao tác ----

interface AuditRow { id: number; at: string; actor: string; action: string; entity: string; entity_id: number | null; before: unknown; after: unknown; note: string | null }
interface UserRow extends StaffUser { active: boolean; has_pin: boolean; has_password: boolean }

/** {a: 1, b: "x"} → "a: 1, b: x" cho dòng trước / sau. */
function brief(v: unknown): string {
  if (v == null) return ""
  if (typeof v !== "object") return String(v)
  if (Array.isArray(v)) return v.map(brief).join(", ")
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${x != null && typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(", ")
}

export function AuditPage() {
  const [input, setInput] = useState("")
  const [action, setAction] = useState("")
  useEffect(() => { const t = window.setTimeout(() => setAction(input.trim()), 300); return () => window.clearTimeout(t) }, [input])
  const q = useQuery({ queryKey: ["audit", action], queryFn: () => api.get<AuditRow[]>(`/audit${qs({ action })}`) })
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRow[]>("/users") })
  const managers = useMemo(() => new Set((users.data ?? []).filter((u) => u.roles.includes("manager")).map((u) => u.full_name)), [users.data])
  const pg = usePaged(q.data ?? [], 40, action)

  return (
    <div className="flex max-w-[1000px] flex-col gap-6 text-[#1c1917]">
      <PageHead title="Nhật ký thao tác"
        desc="Chỉ ghi thêm: không ai sửa hoặc xóa được, kể cả quản lý (cơ sở dữ liệu chặn bằng trigger). Mỗi thao tác ghi người thực hiện, thời điểm, giá trị trước và sau." />
      <label className="a-rise flex h-12 max-w-[420px] items-center gap-2.5 rounded-[14px] bg-[#fdfdfc] px-3.5 shadow-[0_0_0_1px_#8a817c] focus-within:shadow-[0_0_0_2px_#1c1917]" style={{ animationDelay: "50ms" }}>
        <Funnel weight="bold" className="size-[18px] shrink-0 text-[#4f4a45]" aria-hidden />
        <span className="sr-only">Lọc theo thao tác</span>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Lọc theo thao tác (order, recipe, handover)"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none focus-visible:!outline-none" />
      </label>
      {q.isLoading ? <Loading /> : pg.total === 0 ? <div className={CARD}><EmptyNote>Không có thao tác nào khớp bộ lọc</EmptyNote></div> : (
        <>
          <ol className="flex flex-col" aria-label="Các thao tác, mới nhất trước">
            {pg.slice.map((a, i) => {
              const dt = dateTime(a.at).split(" ")
              const sys = a.actor === "Hệ thống"
              const mgr = managers.has(a.actor)
              const before = brief(a.before)
              const after = brief(a.after)
              return (
                <li key={a.id} className="a-rise grid grid-cols-[96px_44px_minmax(0,1fr)] gap-3.5" style={{ animationDuration: ".55s", ...rowDelay(i, 45) }}>
                  <div className="pt-3.5 text-right font-mono text-sm leading-[1.4] text-[#4f4a45]">{dt[0]}<br />{dt[1]}</div>
                  <div className="relative flex justify-center">
                    <span aria-hidden className="absolute top-0 bottom-0 w-0.5 bg-[#e7e4e1]" />
                    <span aria-hidden className="relative mt-2 flex size-10 items-center justify-center rounded-full text-sm font-bold shadow-[0_0_0_4px_#f5f5f4]"
                      style={{ background: sys ? A.ink : mgr ? A.paprikaSoft : A.line2, color: sys ? A.paprika : mgr ? A.paprikaInk : A.ink }}>{sys ? "HT" : initials(a.actor)}</span>
                  </div>
                  <div className="mt-1.5 mb-2.5 flex min-w-0 flex-col gap-2 rounded-2xl bg-[#fdfdfc] px-4 py-3.5 shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.06)] transition-transform duration-[350ms] ease-[cubic-bezier(.16,1,.3,1)] hover:translate-x-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{a.actor}</span>
                      <code className="flex h-[26px] items-center rounded-[7px] bg-[#1c1917] px-2 font-mono text-sm text-[#f3a274]">{a.action}</code>
                      <span className="text-sm text-[#4f4a45]">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ""}</span>
                    </div>
                    {(before || after) && (
                      <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm">
                        {before && (
                          <>
                            <span className="max-w-full rounded-[7px] bg-[#fbe4e4] px-2 py-1 break-all text-[#8f1a1a] line-through"><span className="sr-only">Trước: </span>{before}</span>
                            {after && <ArrowRight weight="bold" className="size-4 shrink-0 text-[#4f4a45]" aria-hidden />}
                          </>
                        )}
                        {after && <span className="max-w-full rounded-[7px] bg-[#e9f5e9] px-2 py-1 break-all text-[#004d00]"><span className="sr-only">Sau: </span>{after}</span>}
                      </div>
                    )}
                    {a.note && <div className="text-sm">Ghi chú: {a.note}</div>}
                  </div>
                </li>
              )
            })}
          </ol>
          <Pager {...pg} noun="thao tác" />
        </>
      )}
    </div>
  )
}

// ---- Sổ giao dịch kho ----

interface TxnRow { id: number; occurred_at: string; type: string; type_label: string; ingredient: string; unit: string; location: string; qty: number; value: number; shift_id: number | null; source_type: string | null; source_id: number | null; ref_txn_id: number | null; waste_type: string | null; late: boolean; cause: string | null; responsible: string | null; created_by: string | null; approved_by: string | null; note: string | null }

/** Nhóm loại giao dịch cho chip lọc; màu ô vuông chỉ để nhận diện, luôn kèm tên loại. */
const TXN_GROUPS: { key: string; label: string; color: string; types: string[] }[] = [
  { key: "in", label: "Nhập kho", color: "#0ca30c", types: ["receipt"] },
  { key: "ho", label: "Bàn giao, trả kho", color: "#1c1917", types: ["handover_out", "handover_in", "return_out", "return_in"] },
  { key: "use", label: "Tiêu hao món", color: "#a8a29e", types: ["consumption", "consumption_reversal", "recipe_variance"] },
  { key: "waste", label: "Hao hụt", color: "#fab219", types: ["waste", "waste_reversal"] },
  { key: "count", label: "Kiểm kê", color: "#d03b3b", types: ["count_adjustment", "pending_variance", "pending_settle", "unexplained_loss"] },
  { key: "adj", label: "Điều chỉnh", color: "#2a78d6", types: ["linked_adjustment"] },
]
const groupOf = (type: string) => TXN_GROUPS.find((g) => g.types.includes(type))

export function TxnsPage() {
  const meta = useMeta()
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const [ing, setIng] = useState("all")
  const [group, setGroup] = useState("all")
  const [type, setType] = useState("all")
  const [loc, setLoc] = useState<"all" | "kho" | "bep">("all")
  const g = TXN_GROUPS.find((x) => x.key === group)
  // Một loại cụ thể, hoặc mọi loại của nhóm (gọi từng loại rồi gộp, giữ 300 giao dịch mới nhất).
  const types = type !== "all" ? [type] : g ? g.types : [""]
  const base = { ingredient_id: ing === "all" ? "" : ing, location: loc === "all" ? "" : loc }
  const qs_ = useQueries({
    queries: types.map((t) => {
      const params = { ...base, txn_type: t }
      return { queryKey: ["txns", params], queryFn: () => api.get<TxnRow[]>(`/txns${qs(params)}`) }
    }),
  })
  const loading = qs_.some((x) => x.isLoading)
  const rows = qs_.length === 1 ? qs_[0].data ?? [] : qs_.flatMap((x) => x.data ?? []).sort((a, b) => b.id - a.id).slice(0, 300)
  const pg = usePaged(rows, 50, `${ing}|${group}|${type}|${loc}`)
  const typeNames = meta.data?.txn_types ?? {}
  const cols = "70px 110px minmax(190px,1.3fr) 130px 60px 110px 120px minmax(170px,1fr) 130px 130px 130px"

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Sổ giao dịch kho"
        desc="Mọi biến động kho là một giao dịch bất biến. Sửa sai bằng điều chỉnh có liên kết trỏ về bản gốc. 300 giao dịch gần nhất theo bộ lọc."
        right={<span className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#1c1917] px-3.5 text-sm font-bold whitespace-nowrap text-[#fafaf9]"><LockKey className="size-[18px] text-[#eb9360]" aria-hidden />Chỉ ghi thêm</span>} />
      <div className="a-rise flex flex-wrap items-center gap-2.5" style={{ animationDelay: "50ms" }}>
        <Seg label="Vị trí" size="md" value={loc} onChange={setLoc} options={[{ key: "all", label: "Mọi vị trí" }, { key: "kho", label: "Kho" }, { key: "bep", label: "Bếp" }]} />
        <div role="group" aria-label="Nhóm giao dịch" className="flex flex-wrap gap-2">
          {[{ key: "all", label: "Mọi loại", color: "" }, ...TXN_GROUPS].map((x) => {
            const on = group === x.key
            return (
              <button key={x.key} type="button" aria-pressed={on} onClick={() => { setGroup(x.key); setType("all") }}
                className={cn("flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold whitespace-nowrap transition-[background-color,color] duration-300 active:scale-[.96]",
                  on ? "bg-[#1c1917] text-[#fafaf9]" : "bg-[#fdfdfc] text-[#1c1917] shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.08)]")}>
                {x.color && <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: x.color, boxShadow: on ? "0 0 0 1px #fafaf9" : undefined }} />}
                {x.label}
              </button>
            )
          })}
        </div>
        <SelectBox label="Loại giao dịch cụ thể" value={type} onChange={(v) => { setType(v); if (v !== "all") setGroup(groupOf(v)?.key ?? "all") }}>
          <option value="all">{g ? `Mọi loại trong nhóm ${g.label}` : "Loại cụ thể"}</option>
          {Object.entries(typeNames).filter(([k]) => !g || g.types.includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectBox>
        <SelectBox label="Nguyên liệu" value={ing} onChange={setIng}>
          <option value="all">Mọi nguyên liệu</option>
          {(ings.data ?? []).map((i) => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
        </SelectBox>
      </div>
      {loading ? <Loading /> : (
        <>
          <div className={cn(CARD, "a-rise overflow-x-auto")} style={{ animationDelay: "100ms", animationDuration: ".8s" }} role="region" aria-label="Sổ giao dịch" tabIndex={0}>
            <div role="table" aria-label="Sổ giao dịch kho" className="min-w-[1260px]">
              <div role="row" className="grid gap-3 border-b border-[#e2ded9] px-6 py-4 text-sm font-semibold text-[#4f4a45]" style={{ gridTemplateColumns: cols }}>
                {["#", "Lúc", "Loại", "Nguyên liệu", "Vị trí", "Số lượng", "Giá trị", "Chứng từ", "Người tạo", "Duyệt, ký", "Chịu trách nhiệm"].map((h, i) => (
                  <span role="columnheader" key={h} className={i === 5 || i === 6 ? "text-right" : ""}>{h}</span>
                ))}
              </div>
              {pg.total === 0 ? <EmptyNote>Không có giao dịch nào khớp bộ lọc</EmptyNote> : pg.slice.map((t, i) => {
                const neg = Number(t.qty) < 0
                return (
                  <div role="row" key={t.id} style={{ gridTemplateColumns: cols, animationDuration: ".45s", ...rowDelay(i, 35) }}
                    className="a-slide grid min-h-14 items-center gap-3 border-b border-[#efedeb] px-6 py-3 text-sm tabular transition-colors duration-200 last:border-b-0 hover:bg-[#f7f4f1]">
                    <span role="cell" className="font-mono text-[#4f4a45]">#{t.id}</span>
                    <span role="cell" className="font-mono">{dateTime(t.occurred_at)}</span>
                    <span role="cell" className="flex flex-wrap items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: groupOf(t.type)?.color ?? "#a8a29e" }} />
                      <span className="font-semibold">{t.type_label}</span>
                      {t.late && <span className="flex h-6 items-center rounded-full bg-[#fdf0d2] px-2 text-sm font-bold whitespace-nowrap text-[#6b4300]">ghi muộn</span>}
                    </span>
                    <span role="cell">{t.ingredient}</span>
                    <span role="cell">{t.location === "bep" ? "Bếp" : "Kho"}</span>
                    <span role="cell" className="text-right font-bold" style={{ color: neg ? A.bad : A.ok }}>{signedQty(t.qty, t.unit)}</span>
                    <span role="cell" className="text-right">{money(t.value)}</span>
                    <span role="cell" className="font-mono text-sm break-words text-[#4f4a45]">{t.source_type ? `${t.source_type} #${t.source_id}` : "-"}{t.ref_txn_id ? ` → gốc #${t.ref_txn_id}` : ""}</span>
                    <span role="cell">{t.created_by ?? "-"}</span>
                    <span role="cell">{t.approved_by ?? "-"}</span>
                    <span role="cell">{t.responsible ?? "-"}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <Pager {...pg} noun="giao dịch" />
        </>
      )}
    </div>
  )
}

// ---- Người dùng ----

const ROLE_ICON: Record<Role, IconType> = { server: ClipboardList, kitchen: CookingPot, head_chef: ChefHat, storekeeper: Warehouse, manager: CrownSimple }
type UForm = { id?: number; username: string; full_name: string; roles: Role[]; pin: string; password: string; active: boolean }
const userBody = (f: UForm) => ({ username: f.username, full_name: f.full_name, roles: f.roles, pin: f.pin || null, password: f.password || null, active: f.active })

export function UsersPage() {
  const meta = useMeta()
  const { me } = useAuth()
  const ask = useAsk()
  const q = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserRow[]>("/users") })
  const [form, setForm] = useState<UForm | null>(null)
  const save = useAction((f: UForm) => (f.id ? api.put(`/users/${f.id}`, userBody(f)) : api.post("/users", userBody(f))).then(() => f), {
    invalidate: [["users"], ["staff"]],
    onSuccess: (f) => { adminToast(`Đã lưu người dùng ${f.full_name.trim()}`); setForm(null) },
  })
  const toggle = useAction((u: UserRow) => api.put(`/users/${u.id}`, { username: u.username, full_name: u.full_name, roles: u.roles, pin: null, password: null, active: !u.active }), {
    invalidate: [["users"], ["staff"]],
  })
  const roleNames = (meta.data?.roles ?? {}) as Record<Role, string>
  const roles = Object.entries(roleNames) as [Role, string][]

  const onToggle = async (u: UserRow) => {
    if (u.active && !(await ask.confirm({ title: `Khóa đăng nhập của ${u.full_name}?`, description: "Người này sẽ không đăng nhập hay ký bằng PIN được cho tới khi mở lại. Lịch sử thao tác vẫn giữ nguyên.", confirmLabel: "Khóa đăng nhập", danger: true }))) return
    toggle.mutate(u, { onSuccess: () => adminToast(`${u.full_name}: ${u.active ? "đã khóa đăng nhập" : "đã mở lại"}`) })
  }

  // Kiểm tra trước khi gửi (khớp máy chủ): PIN đúng PIN_LEN số, mật khẩu từ 6 ký tự, người mới cần PIN hoặc mật khẩu.
  const pinBad = !!form && form.pin.length > 0 && form.pin.length !== PIN_LEN
  const pwBad = !!form && form.password.length > 0 && form.password.length < 6
  const needSecret = !!form && !form.id && !form.pin && !form.password
  const cant = !form || !form.username.trim() || !form.full_name.trim() || !form.roles.length || pinBad || pwBad || needSecret || save.isPending

  return (
    <div className="flex flex-col gap-6 text-[#1c1917]">
      <PageHead title="Người dùng và phân quyền"
        desc="Một người có thể kiêm nhiều vai trò; khi đó các ca liên quan được đánh dấu không đảm bảo phân tách nhiệm vụ. Nhân viên đăng nhập và ký bằng PIN; quản lý dùng mật khẩu."
        right={<Btn kind="accent" icon={UserPlus} className="hover:-translate-y-0.5" onClick={() => setForm({ username: "", full_name: "", roles: [], pin: "", password: "", active: true })}>Người dùng mới</Btn>} />
      {q.isLoading ? <Loading /> : (
        <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]" aria-label="Danh sách người dùng">
          {(q.data ?? []).map((u, i) => {
            const mgr = u.roles.includes("manager")
            const self = u.id === me?.id
            const AuthIcon = u.has_password ? Password : DotsNine
            const auth = [u.has_pin && "PIN", u.has_password && "Mật khẩu"].filter(Boolean).join(", ") || "Chưa đặt PIN, mật khẩu"
            return (
              <li key={u.id} className={cn("a-rise flex flex-col gap-3.5 rounded-[20px] p-5 shadow-[0_1px_2px_rgba(41,37,36,.05),0_6px_20px_-12px_rgba(41,37,36,.16),0_0_0_1px_rgba(28,25,23,.05)]", CARD_HOVER, u.active ? "bg-[#fdfdfc]" : "bg-[#f5f3f1]")}
                style={{ animationDuration: ".6s", ...delay(i, 0, 45) }}>
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-[52px] shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
                    style={{ background: mgr ? A.ink : A.paprikaSoft, color: mgr ? A.paprika : A.paprikaInk }}>{initials(u.full_name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold">{u.full_name}</div>
                    <div className="font-mono text-sm text-[#4f4a45]">{u.username}</div>
                  </div>
                  <button type="button" role="switch" aria-checked={u.active} aria-label={`Cho phép ${u.full_name} đăng nhập`}
                    title={self ? "Không tự khóa tài khoản đang dùng" : u.active ? "Đang hoạt động, bấm để khóa" : "Đã khóa, bấm để mở lại"}
                    disabled={self || toggle.isPending} onClick={() => void onToggle(u)}
                    className="flex h-11 w-12 shrink-0 items-center justify-center rounded-xl disabled:cursor-not-allowed">
                    <span className="relative h-7 w-12 rounded-full transition-colors duration-300" style={{ background: u.active ? A.ink : "#a8a29e" }}>
                      <span className="absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left] duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)]" style={{ left: u.active ? 23 : 3 }} />
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.roles.map((r) => {
                    const I = ROLE_ICON[r]
                    return <span key={r} className="flex h-[30px] items-center gap-1.5 rounded-full bg-[#f2f0ee] px-[11px] text-sm font-semibold whitespace-nowrap"><I className="size-4" aria-hidden />{roleNames[r] ?? r}</span>
                  })}
                  {u.roles.length > 1 && <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-[#fdf0d2] px-[11px] text-sm font-bold whitespace-nowrap text-[#6b4300]"><ShieldAlert weight="bold" className="size-4" aria-hidden />Kiêm nhiệm</span>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#efedeb] pt-3 text-sm">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[#4f4a45]">
                    <AuthIcon className="size-[18px] shrink-0" aria-hidden /><span>{auth}{u.active ? "," : ""}</span>
                    {u.active
                      ? <span className="font-bold" style={{ color: A.ok }}>Hoạt động</span>
                      : <Pill icon={LockSimple} bg={A.line2} c={A.ink}>Đã khóa</Pill>}
                  </span>
                  <button type="button" aria-label={`Sửa ${u.full_name}`} onClick={() => setForm({ id: u.id, username: u.username, full_name: u.full_name, roles: [...u.roles], pin: "", password: "", active: u.active })}
                    className="h-11 shrink-0 rounded-[10px] px-3 text-sm font-bold whitespace-nowrap text-[#7c3410] transition-colors hover:bg-[#fbeae0]">Sửa</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} width={600} title={form?.id ? "Sửa người dùng" : "Người dùng mới"}
        footer={form && (
          <div className="flex w-full justify-end gap-2.5">
            <Btn kind="soft" onClick={() => setForm(null)}>Hủy</Btn>
            <Btn kind="accent" disabled={cant} onClick={() => save.mutate(form)} className="px-[22px]">Lưu</Btn>
          </div>
        )}>
        {form && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Tên đăng nhập
                <input value={form.username} disabled={!!form.id} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off"
                  className={cn("h-[46px] rounded-xl border border-[#8a817c] px-3 text-[15px] font-normal disabled:text-[#1c1917]", form.id ? "bg-[#f2f0ee]" : "bg-white")} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Họ tên
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="off"
                  className="h-[46px] rounded-xl border border-[#8a817c] bg-white px-3 text-[15px] font-normal" />
              </label>
            </div>
            <div className="flex flex-col gap-2" role="group" aria-labelledby="vai-tro">
              <span id="vai-tro" className="text-sm font-semibold">Vai trò</span>
              <div className="flex flex-wrap gap-2">
                {roles.map(([k, v]) => {
                  const on = form.roles.includes(k)
                  const I = ROLE_ICON[k]
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => setForm({ ...form, roles: on ? form.roles.filter((r) => r !== k) : [...form.roles, k] })}
                      className="flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap transition-[background-color,color,transform] duration-[250ms] active:scale-95"
                      style={{ background: on ? A.ink : "#f2f0ee", color: on ? "#fafaf9" : A.ink }}>
                      <I className="size-4" aria-hidden />{v}
                    </button>
                  )
                })}
              </div>
              {form.roles.length > 1 && (
                <span className="a-rise flex items-center gap-1.5 text-sm font-semibold text-[#6b4300]" style={{ animationDuration: ".35s" }}>
                  <ShieldAlert weight="bold" className="size-4 shrink-0" aria-hidden />Kiêm nhiều vai trò: các ca liên quan sẽ bị đánh dấu không đảm bảo phân tách nhiệm vụ
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">PIN {PIN_LEN} số
                <input value={form.pin} inputMode="numeric" autoComplete="off" placeholder={form.id ? "Để trống là giữ nguyên" : ""} aria-invalid={pinBad || undefined}
                  aria-describedby="u-pin-hint"
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, PIN_LEN) })}
                  className="h-[46px] rounded-xl border border-[#8a817c] bg-white px-3 text-[15px] font-normal tracking-[.3em] placeholder:tracking-normal" />
                <span id="u-pin-hint" className={cn("text-sm font-normal", pinBad ? "font-semibold text-[#8f1a1a]" : "text-[#4f4a45]")}>
                  {pinBad ? `Cần đủ ${PIN_LEN} số` : form.id ? "Nhập PIN mới để đặt lại" : "Nhân viên đăng nhập và ký bằng PIN"}
                </span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Mật khẩu
                <input type="password" value={form.password} autoComplete="new-password" placeholder={form.id ? "Để trống là giữ nguyên" : ""} aria-invalid={pwBad || undefined}
                  aria-describedby="u-pw-hint"
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-[46px] rounded-xl border border-[#8a817c] bg-white px-3 text-[15px] font-normal" />
                <span id="u-pw-hint" className={cn("text-sm font-normal", pwBad ? "font-semibold text-[#8f1a1a]" : "text-[#4f4a45]")}>
                  {pwBad ? "Tối thiểu 6 ký tự" : "Quản lý đăng nhập bằng mật khẩu"}
                </span>
              </label>
            </div>
            {needSecret && <p className="m-0 text-sm text-[#4f4a45]">Cần đặt PIN (nhân viên) hoặc mật khẩu (quản lý) cho người dùng mới.</p>}
            {form.id && (
              <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={form.active} disabled={form.id === me?.id} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="size-5 accent-[#1c1917]" />
                Đang hoạt động (cho phép đăng nhập)
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---- Cài đặt ngưỡng ----

type ProcKey = Exclude<keyof Settings, "thresholds">
type ThKey = keyof Settings["thresholds"]["A"]
const PROCS: [ProcKey, string, number][] = [
  ["investigation_due_hours", "Hạn xử lý phiếu điều tra (giờ)", 1],
  ["handover_tolerance", "Dung sai cân khi bàn giao (g)", 5],
  ["trend_periods", "Cảnh báo xu hướng sau N kỳ cùng chiều", 1],
  ["return_grace_minutes", "Quá giờ cân trả bao nhiêu phút thì cảnh báo", 5],
  ["handover_sign_grace_minutes", "Phiếu bàn giao chưa ký sau (phút)", 5],
  ["receipt_price_tolerance_pct", "Phiếu nhập lệch đơn giá quá (%)", 1],
  ["receipt_history_ratio", "Lệch so với lịch sử nhập (lần)", 0.1],
  ["cancel_anomaly_min", "Hủy, làm lại bất thường từ (lần/ngày)", 1],
]
const TH_FIELDS: [ThKey, string, number][] = [
  ["warn_pct", "Mức cảnh báo (%)", 1],
  ["warn_abs", "và lệch tối thiểu (g, ml, cái)", 50],
  ["must_pct", "Bắt buộc duyệt (%)", 1],
  ["must_abs", "và lệch tối thiểu (g, ml, cái)", 50],
]
const norm = (s: Settings): Settings => {
  const n = structuredClone(s)
  for (const g of ["A", "C"] as const) for (const [k] of TH_FIELDS) n.thresholds[g][k] = Number(n.thresholds[g][k])
  for (const [k] of PROCS) n[k] = Number(n[k])
  return n
}

export function SettingsPage() {
  const meta = useMeta()
  const qc = useQueryClient()
  const [s, setS] = useState<Settings | null>(null)
  const [saved, setSaved] = useState<Settings | null>(null)
  useEffect(() => {
    if (meta.data && !s) { const n = norm(meta.data.settings); setS(n); setSaved(structuredClone(n)) }
  }, [meta.data, s])

  const changedKeys = useMemo(() => {
    if (!s || !saved) return [] as (keyof Settings)[]
    return (Object.keys(s) as (keyof Settings)[]).filter((k) => JSON.stringify(s[k]) !== JSON.stringify(saved[k]))
  }, [s, saved])
  let changes = 0
  if (s && saved) {
    for (const g of ["A", "C"] as const) for (const [k] of TH_FIELDS) if (s.thresholds[g][k] !== saved.thresholds[g][k]) changes++
    for (const [k] of PROCS) if (s[k] !== saved[k]) changes++
  }

  const save = useAction(async (cur: Settings) => {
    for (const k of changedKeys) await api.put(`/settings/${k}`, cur[k])
    return cur
  }, {
    onSuccess: (cur) => { setSaved(structuredClone(cur)); void qc.invalidateQueries({ queryKey: ["meta"] }); adminToast("Đã lưu cấu hình ngưỡng và quy trình") },
  })

  if (!s || !saved) return <Loading />
  const setTh = (g: "A" | "C", k: ThKey, v: number) => setS({ ...s, thresholds: { ...s.thresholds, [g]: { ...s.thresholds[g], [k]: v } } })

  return (
    <div className="flex flex-col gap-6 pb-[70px] text-[#1c1917]">
      <PageHead title="Cài đặt ngưỡng và quy trình"
        desc="Ngưỡng sai số hai tầng: chỉ coi là vượt khi vượt cả % (so với tiêu hao lý thuyết) và mức tối thiểu tuyệt đối; kỳ không có món bán chỉ xét mức tuyệt đối. Ngưỡng riêng của nguyên liệu đặt ở màn Nguyên liệu." />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))]">
        {(["A", "C"] as const).map((g, i) => {
          const t = s.thresholds[g]
          const mx = Math.max(1, t.must_pct * 1.6)
          const zOk = Math.min(100, (t.warn_pct / mx) * 100)
          const zWarn = Math.min(100 - zOk, (Math.max(0, t.must_pct - t.warn_pct) / mx) * 100)
          return (
            <section key={g} aria-labelledby={`nhom-${g}`} className={cn(CARD, "a-rise flex flex-col gap-[18px] p-6")} style={delay(i, 60, 70)}>
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex size-11 items-center justify-center rounded-[13px] font-display text-[22px] font-extrabold"
                  style={{ background: g === "A" ? A.paprikaSoft : A.line2, color: g === "A" ? A.paprikaInk : A.sub }}>{g}</span>
                <div>
                  <h3 id={`nhom-${g}`} className="m-0 font-display text-xl font-bold tracking-[-.02em]">Nhóm {g}</h3>
                  <div className="text-sm text-[#4f4a45]">{g === "A" ? "Hàng tươi, giá trị cao" : "Gia vị, hàng khô"}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex h-[34px] overflow-hidden rounded-[10px] text-sm font-bold" role="img"
                  aria-label={`Thang % lệch nhóm ${g}: dưới ${t.warn_pct}% trong ngưỡng, từ ${t.warn_pct}% cảnh báo, từ ${t.must_pct}% phải điều tra`}>
                  <span className="flex items-center overflow-hidden pl-2.5 whitespace-nowrap transition-[width] duration-600 ease-[cubic-bezier(.16,1,.3,1)]" style={{ width: `${zOk}%`, background: A.okBg, color: A.ok }}>Trong ngưỡng</span>
                  <span className="flex items-center overflow-hidden pl-2.5 whitespace-nowrap transition-[width] duration-600 ease-[cubic-bezier(.16,1,.3,1)]" style={{ width: `${zWarn}%`, background: A.warnBg, color: A.warn }}>Cảnh báo</span>
                  <span className="flex flex-1 items-center overflow-hidden pl-2.5 whitespace-nowrap" style={{ background: A.badBg, color: A.bad }}>Phải điều tra</span>
                </div>
                <div aria-hidden className="flex justify-between font-mono text-sm text-[#4f4a45]"><span>0%</span><span>{Math.round(mx)}%</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {TH_FIELDS.map(([k, label, step]) => (
                  <Stepper key={k} id={`th-${g}-${k}`} label={label} value={t[k]} step={step} suffix={k.endsWith("pct") ? "%" : undefined}
                    changed={t[k] !== saved.thresholds[g][k]} onChange={(v) => setTh(g, k, v)} />
                ))}
              </div>
              {t.warn_pct > t.must_pct && <p className="m-0 text-sm font-semibold text-[#8f1a1a]">Mức cảnh báo đang cao hơn mức bắt buộc duyệt.</p>}
            </section>
          )
        })}
      </div>
      <section aria-labelledby="quy-trinh" className={cn(CARD, "a-rise flex flex-col gap-4 p-6")} style={{ animationDelay: "150ms" }}>
        <h3 id="quy-trinh" className="m-0 font-display text-xl font-bold tracking-[-.02em]">Quy trình</h3>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {PROCS.map(([k, label, step]) => (
            <Stepper key={k} id={`proc-${k}`} label={label} value={s[k]} step={step} minH changed={s[k] !== saved[k]} onChange={(v) => setS({ ...s, [k]: v })} />
          ))}
        </div>
      </section>
      {changes > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[45] flex justify-center px-4">
          <div role="region" aria-label="Thay đổi chưa lưu" className="a-rise pointer-events-auto flex items-center gap-3.5 rounded-[18px] bg-[#1c1917] py-2.5 pr-2.5 pl-5 text-[#fafaf9] shadow-[0_24px_50px_-20px_rgba(0,0,0,.6)] on-dark" style={{ animationDuration: ".5s" }}>
            <span className="text-[15px] font-semibold whitespace-nowrap" aria-live="polite">{changes} thay đổi chưa lưu</span>
            <button type="button" onClick={() => setS(structuredClone(saved))} className="h-11 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap text-[#d6d3d1] transition-colors hover:bg-[#2e2926]">Hoàn tác</button>
            <button type="button" disabled={save.isPending} onClick={() => save.mutate(s)} className="h-11 rounded-xl bg-[#eb9360] px-[18px] text-sm font-bold whitespace-nowrap text-[#1c1917] disabled:opacity-100 disabled:bg-[#d6d3d1]">
              {save.isPending ? "Đang lưu…" : "Lưu cấu hình"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Đồng hồ demo ----

const SHIFT_STATUS: Record<string, string> = { planned: "chưa mở", open: "đang mở", closed: "đã đóng" }
const longDate = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })

function offsetText(sec: number): string {
  const m = Math.round(sec / 60)
  if (m === 0) return "Bằng giờ thật"
  const a = Math.abs(m)
  const txt = a >= 60 ? `${(a / 60).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ` : `${a} phút`
  return m > 0 ? `Đã tua thêm ${txt}` : `Chậm hơn ${txt}`
}

export function DemoClockPage() {
  const { me, refresh } = useAuth()
  const qc = useQueryClient()
  const ask = useAsk()
  const now = useServerNow(5_000)
  const clockQ = useQuery({ queryKey: ["demo-clock"], queryFn: () => api.get<{ now: string; offset_seconds: number; demo_mode: boolean }>("/demo/clock") })
  const move = useAction((body: object) => api.post<{ now: string; new_alerts: number }>("/demo/clock", body), {
    onSuccess: (r) => { adminToast(`Giờ demo: ${longClock(r.now)}, ${r.new_alerts} cảnh báo mới`); void refresh(); void qc.invalidateQueries() },
  })
  const scan = useAction(() => api.post<{ new_alerts: number }>("/demo/scan"), {
    invalidate: [["alerts"], ["dashboard"]],
    onSuccess: (r) => adminToast(`Đã quét: ${r.new_alerts} cảnh báo mới`),
  })
  const shift = me?.shift
  const demo = clockQ.data?.demo_mode ?? me?.demo_mode ?? false
  const toEnd = shift ? Math.max(1, Math.ceil((new Date(shift.planned_end).getTime() - now.getTime()) / 60000) + 35) : 0
  const hm = time(now.toISOString())
  const dateTxt = longDate.format(now).replace(/^./, (c) => c.toUpperCase())
  const shiftTxt = shift ? `${shift.name} ${time(shift.planned_start)}-${time(shift.planned_end)}, ${SHIFT_STATUS[shift.status] ?? shift.status}` : "Ngoài giờ ca"
  const busy = move.isPending

  const jumps: { label: string; icon: IconType; body: object; show: boolean }[] = [
    { label: "+15 phút", icon: FastForward, body: { advance_minutes: 15 }, show: true },
    { label: "+1 giờ", icon: FastForward, body: { advance_minutes: 60 }, show: true },
    { label: "Tới quá giờ kết thúc ca (+30 phút)", icon: AlarmClock, body: { advance_minutes: toEnd }, show: !!shift },
    { label: "+48 giờ", icon: CalendarPlus, body: { advance_minutes: 48 * 60 }, show: true },
  ]
  const onReset = async () => {
    if (await ask.confirm({ title: "Đưa đồng hồ về giờ thật?", description: "Đồng hồ có thể lùi về trước dữ liệu đã ghi bằng giờ demo. Chỉ dùng khi bắt đầu lại từ dữ liệu seed.", confirmLabel: "Về giờ thật", danger: true }))
      move.mutate({ reset: true })
  }

  return (
    <div className="flex max-w-[1000px] flex-col gap-6 text-[#1c1917]">
      <PageHead title="Đồng hồ demo"
        desc="Tua đồng hồ nghiệp vụ khi trình bày (chỉ ở chế độ demo, chỉ tua tới). Sau mỗi lần tua hệ thống quét cảnh báo ngay: quá giờ chưa cân trả, phiếu điều tra quá hạn." />
      <section aria-label="Giờ nghiệp vụ" className="on-dark a-rise relative flex flex-col gap-[22px] overflow-hidden rounded-[28px] bg-[#1c1917] p-8 text-[#fafaf9] shadow-[0_28px_50px_-26px_rgba(41,37,36,.6)]" style={{ animationDelay: "50ms", animationDuration: ".8s" }}>
        <div aria-hidden className="pointer-events-none absolute -top-[200px] -right-[160px] size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(235,147,96,.22),rgba(235,147,96,0))]" />
        <div className="relative text-[15px] text-[#d6d3d1]">Giờ nghiệp vụ hiện tại</div>
        <div className="relative flex flex-wrap items-baseline gap-[18px]" aria-live="polite">
          <span key={hm} className="a-pop font-display text-[clamp(72px,9vw,120px)] leading-[.85] font-bold tracking-[-.05em] text-[#eb9360] tabular">{hm}</span>
          <span className="text-xl font-semibold">{dateTxt}</span>
        </div>
        <div className="relative grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <div className="rounded-[14px] bg-[#2e2926] px-4 py-3.5"><div className="text-sm text-[#d6d3d1]">Lệch so với giờ thật</div><div className="mt-0.5 text-lg font-bold">{clockQ.data ? offsetText(clockQ.data.offset_seconds) : "-"}</div></div>
          <div className="rounded-[14px] bg-[#2e2926] px-4 py-3.5"><div className="text-sm text-[#d6d3d1]">Ca</div><div className="mt-0.5 text-lg font-bold">{shiftTxt}</div></div>
          <div className="rounded-[14px] bg-[#2e2926] px-4 py-3.5"><div className="text-sm text-[#d6d3d1]">Chế độ</div>
            <div className="mt-0.5 flex items-center gap-2 text-lg font-bold">
              <span aria-hidden className="size-2 rounded-full" style={{ background: demo ? "#0ca30c" : "#e34948" }} />
              {demo ? "DEMO_MODE bật" : "DEMO_MODE tắt"}
            </div>
          </div>
        </div>
      </section>
      {clockQ.data && !demo && <p className="m-0 text-sm font-semibold text-[#8f1a1a]">Máy chủ không ở chế độ demo (DEMO_MODE=false): không tua được đồng hồ.</p>}
      <div className="a-rise flex flex-wrap gap-2.5" style={{ animationDelay: "120ms", animationDuration: ".8s" }}>
        {jumps.filter((j) => j.show).map((j) => (
          <button key={j.label} type="button" disabled={busy || !demo} onClick={() => move.mutate(j.body)}
            className="flex h-[52px] items-center gap-2 rounded-[14px] bg-[#fdfdfc] px-[18px] text-[15px] font-bold whitespace-nowrap shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.1)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px] hover:shadow-[0_2px_4px_rgba(41,37,36,.06),0_16px_30px_-16px_rgba(41,37,36,.4),0_0_0_1px_rgba(28,25,23,.1)] active:scale-[.97] disabled:pointer-events-none disabled:bg-[#efedeb] disabled:shadow-none">
            <j.icon weight="bold" className="size-[18px]" aria-hidden />{j.label}
          </button>
        ))}
        <button type="button" disabled={scan.isPending} onClick={() => scan.mutate(undefined)}
          className="flex h-[52px] items-center gap-2 rounded-[14px] bg-[#eb9360] px-[18px] text-[15px] font-bold whitespace-nowrap text-[#1c1917] shadow-[0_12px_26px_-12px_rgba(235,147,96,.9)] transition-colors hover:bg-[#f19c6a] disabled:opacity-100">
          <Scan weight="bold" className={cn("size-[18px]", scan.isPending && "motion-safe:animate-spin")} aria-hidden />{scan.isPending ? "Đang quét…" : "Quét cảnh báo ngay"}
        </button>
        <button type="button" disabled={busy || !demo} onClick={() => void onReset()}
          className="flex h-[52px] items-center gap-2 rounded-[14px] px-[18px] text-[15px] font-bold whitespace-nowrap text-[#4f4a45] transition-colors hover:bg-[#efedeb] disabled:pointer-events-none">
          <RotateCcw weight="bold" className="size-[18px]" aria-hidden />Về giờ thật
        </button>
      </div>
      <p className="m-0 text-sm leading-[1.55] text-[#4f4a45]">Lưu ý: Về giờ thật có thể làm đồng hồ lùi về trước dữ liệu đã ghi bằng giờ demo; chỉ dùng khi bắt đầu lại từ dữ liệu seed.</p>
    </div>
  )
}
