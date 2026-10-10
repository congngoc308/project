import { useQuery } from "@tanstack/react-query"
import {
  AlarmClock, BarChart3, Bell, BellRing, BookOpen, CaretDoubleLeft, ChefHat, ChevronRightIcon, ClipboardCheck, Clock, FileSearch, FileText, History,
  LayoutDashboard, Leaf, ListChecks, LogOut, Scale, ScanSearch, ShoppingBasket, SidebarSimple, SlidersHorizontal, Trash2, Users, Warehouse, type IconType,
} from "@/components/icons"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { AdminToast, Initials } from "@/layouts/AdminBits"
import { DemoBanner, SkipLink } from "@/layouts/TopBits"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import { time } from "@/lib/format"
import { notifyEvent, useServerEvents } from "@/lib/sse"
import type { Alert, Investigation } from "@/lib/types"
import { cn } from "@/lib/utils"

type BadgeKey = "alerts" | "inv"
interface NavItem { to: string; label: string; icon: IconType; end?: boolean; badge?: BadgeKey }

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Theo dõi & giải trình",
    items: [
      { to: "/quan-ly", label: "Tổng quan", icon: LayoutDashboard, end: true },
      { to: "/quan-ly/dieu-tra", label: "Phiếu điều tra", icon: FileSearch, badge: "inv" },
      { to: "/quan-ly/canh-bao", label: "Cảnh báo", icon: Bell, badge: "alerts" },
      { to: "/quan-ly/avt", label: "Báo cáo AvT", icon: BarChart3 },
      { to: "/quan-ly/kiem-ke", label: "Kiểm kê", icon: ClipboardCheck },
    ],
  },
  {
    title: "Kho & định mức",
    items: [
      { to: "/quan-ly/ton-kho", label: "Tồn sổ", icon: Warehouse },
      { to: "/quan-ly/phieu-nhap", label: "Phiếu nhập", icon: ShoppingBasket },
      { to: "/quan-ly/hao-hut", label: "Hao hụt", icon: Trash2 },
      { to: "/quan-ly/ca", label: "Ca & bàn giao", icon: Scale },
      { to: "/quan-ly/mon", label: "Món & công thức", icon: BookOpen },
      { to: "/quan-ly/nguyen-lieu", label: "Nguyên liệu", icon: Leaf },
    ],
  },
  {
    title: "Báo cáo & hệ thống",
    items: [
      { to: "/quan-ly/bao-cao", label: "Báo cáo khác", icon: FileText },
      { to: "/quan-ly/so-kho", label: "Sổ giao dịch kho", icon: ListChecks },
      { to: "/quan-ly/nhat-ky", label: "Nhật ký thao tác", icon: History },
      { to: "/quan-ly/nguoi-dung", label: "Người dùng", icon: Users },
      { to: "/quan-ly/cai-dat", label: "Cài đặt ngưỡng", icon: SlidersHorizontal },
      { to: "/quan-ly/dong-ho", label: "Đồng hồ demo", icon: AlarmClock },
    ],
  },
]
const ALL_ITEMS = GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })))

/** Mục điều hướng ứng với đường dẫn hiện tại ("Tổng quan" chỉ khớp đúng, mục khác khớp cả trang con). */
function currentItem(pathname: string) {
  return ALL_ITEMS.filter((it) => (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/")))
    .sort((a, b) => b.to.length - a.to.length)[0] ?? ALL_ITEMS[0]
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase()
const WD: Record<string, string> = { Sun: "CN", Mon: "T2", Tue: "T3", Wed: "T4", Thu: "T5", Fri: "T6", Sat: "T7" }
const CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })

function useWide(min: number) {
  const q = `(min-width: ${min}px)`
  const [ok, setOk] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setOk(m.matches)
    m.addEventListener("change", f)
    return () => m.removeEventListener("change", f)
  }, [q])
  return ok
}

/**
 * Khung màn quản lý theo thiết kế "Quan Ly Admin": thanh bên tối thu gọn được (ô sáng trượt theo mục đang chọn),
 * thanh trên có đường dẫn, ca hiện tại, đồng hồ, bảng lệnh Ctrl K, chuông cảnh báo, người dùng.
 */
export function ManagerLayout() {
  const { me, loading, has, logout } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  useServerEvents(!!me, (ev) => me && notifyEvent(ev, me.roles))
  const alerts = useQuery({ queryKey: ["alerts", "open"], queryFn: () => api.get<Alert[]>("/alerts?status=open"), enabled: has("manager") })
  const invs = useQuery({ queryKey: ["investigations", "open"], queryFn: () => api.get<Investigation[]>("/investigations?status=open"), enabled: has("manager") })
  const now = useServerNow(15_000)
  const wide = useWide(1024)
  const [collapsedPref, setCollapsedPref] = useState(() => { try { return localStorage.getItem("admin-sidebar") === "0" } catch { return false } })
  const collapsed = collapsedPref || !wide
  const toggleSide = () => setCollapsedPref((c) => {
    try { localStorage.setItem("admin-sidebar", c ? "1" : "0") } catch { /* chế độ riêng tư */ }
    return !c
  })
  const [palette, setPalette] = useState(false)

  // Ô sáng trượt theo mục đang chọn: đo bằng offsetTop (không bị zoom trang làm lệch).
  const navRef = useRef<HTMLElement>(null)
  const [indTop, setIndTop] = useState<number | null>(null)
  useLayoutEffect(() => {
    const navEl = navRef.current
    let el: HTMLElement | null = navEl?.querySelector<HTMLElement>('[aria-current="page"]') ?? null
    if (!navEl || !el) return setIndTop(null)
    // Cộng dồn offsetTop tới thanh nav (mục nằm trong khối nhóm có position: relative).
    let top = 0
    while (el && el !== navEl) { top += el.offsetTop; el = el.offsetParent as HTMLElement | null }
    setIndTop(top)
  }, [pathname, collapsed, me])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p) }
    }
    window.addEventListener("keydown", f)
    return () => window.removeEventListener("keydown", f)
  }, [])

  if (loading) return null
  if (!me) return <Navigate to="/dang-nhap" replace />
  if (!has("manager")) return <Navigate to="/van-hanh" replace />

  const openInvs = invs.data ?? []
  const openAlerts = alerts.data ?? []
  const critical = openAlerts.filter((a) => a.severity === "critical").length
  const overdue = openInvs.filter((i) => i.overdue).length
  const badges: Record<BadgeKey, { n: number; urgent: boolean }> = {
    alerts: { n: openAlerts.length, urgent: critical > 0 },
    inv: { n: openInvs.length, urgent: overdue > 0 },
  }
  const cur = currentItem(pathname)
  const p = Object.fromEntries(CLOCK.formatToParts(now).map((x) => [x.type, x.value]))
  const clockTxt = `${WD[p.weekday] ?? ""} ${p.day}/${p.month}, ${p.hour === "24" ? "00" : p.hour}:${p.minute}`
  const s = me.shift
  const shiftState = !s ? "" : s.status === "open" ? "đang mở" : s.status === "closed" ? "đã cân trả" : "chưa nhận bàn giao"
  const shiftTxt = s ? `${s.name} ${time(s.planned_start)}-${time(s.planned_end)}, ${shiftState}` : "Ngoài giờ ca"

  return (
    <div className="flex min-h-svh bg-[#f5f5f4] text-[#1c1917]">
      <SkipLink />
      <aside className="sticky top-0 z-30 flex h-svh shrink-0 flex-col overflow-hidden bg-[#1c1917] text-[#fafaf9] transition-[width] duration-[550ms] ease-[cubic-bezier(.16,1,.3,1)]"
        style={{ width: collapsed ? 76 : 272 }}>
        <div className="flex min-h-[84px] items-center gap-3 px-4 pt-5 pb-[18px]">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-[#eb9360] text-[#1c1917] shadow-[inset_0_-2px_0_rgba(28,25,23,.18)]"><ChefHat className="size-[26px]" aria-hidden /></div>
          <div className={cn("whitespace-nowrap transition-opacity duration-300", collapsed && "pointer-events-none opacity-0")} aria-hidden={collapsed}>
            <div className="font-display text-[19px] font-bold tracking-[-.02em]">Quản lý bếp</div>
            <div className="text-sm text-[#b5afaa]">Định mức, thực tế, giải trình</div>
          </div>
        </div>
        <nav ref={navRef} aria-label="Màn quản lý" className="relative flex flex-1 flex-col gap-[18px] overflow-x-hidden overflow-y-auto px-4 pt-1 pb-4 [scrollbar-width:none]">
          {indTop !== null && (
            <div aria-hidden className="pointer-events-none absolute right-4 left-4 h-11 rounded-xl bg-[#2e2926] shadow-[inset_0_0_0_1px_rgba(255,255,255,.07),0_6px_16px_-8px_rgba(0,0,0,.6)] transition-[top] duration-[550ms] ease-[cubic-bezier(.34,1.4,.64,1)]"
              style={{ top: indTop }} />
          )}
          {GROUPS.map((g) => (
            <div key={g.title} className="relative flex flex-col gap-0.5">
              <div className={cn("flex h-7 items-center px-2.5 text-sm font-semibold whitespace-nowrap text-[#b5afaa] transition-opacity duration-300", collapsed && "opacity-0")} aria-hidden={collapsed}>{g.title}</div>
              {g.items.map((it) => {
                const b = it.badge ? badges[it.badge] : null
                return (
                  <NavLink key={it.to} to={it.to} end={it.end} title={collapsed ? it.label : undefined} aria-label={collapsed ? (b?.n ? `${it.label}, ${b.n}` : it.label) : undefined}
                    className={({ isActive }) => cn("group relative flex h-11 items-center gap-3 rounded-xl px-1.5 text-[15px] whitespace-nowrap transition-[color,background-color] duration-[250ms]",
                      isActive ? "font-bold text-[#fafaf9]" : "font-medium text-[#d6d3d1] hover:bg-white/[.035] hover:text-[#fafaf9]")}>
                    {({ isActive }) => (
                      <>
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[9px] transition-[background-color,color] duration-[400ms]",
                          isActive ? "bg-[#eb9360] text-[#1c1917]" : "text-[#b5afaa]")}>
                          <it.icon className="size-5" aria-hidden />
                        </span>
                        <span className={cn("flex-1 transition-opacity duration-[250ms]", collapsed && "opacity-0")}>{it.label}</span>
                        {!!b?.n && (
                          <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-full px-[7px] text-sm font-bold whitespace-nowrap text-white tabular", collapsed ? "absolute top-0.5 left-[26px]" : "static")}
                            style={{ background: b.urgent ? "#a11d1d" : "#44403c" }} aria-hidden={collapsed}>{b.n}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-2 border-t border-white/[.07] px-4 pt-3 pb-[18px]">
          {wide && (
            <button type="button" onClick={toggleSide} aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!collapsed}
              className="flex h-11 items-center gap-3 rounded-xl px-1.5 text-[15px] font-medium whitespace-nowrap text-[#b5afaa] transition-colors hover:bg-white/[.06] hover:text-[#fafaf9]">
              <span className="flex size-8 shrink-0 items-center justify-center transition-transform duration-[550ms] ease-[cubic-bezier(.16,1,.3,1)]" style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
                <CaretDoubleLeft weight="bold" className="size-[18px]" aria-hidden />
              </span>
              <span className={cn("transition-opacity duration-[250ms]", collapsed && "opacity-0")}>Thu gọn</span>
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <header className="sticky top-0 z-20 flex flex-nowrap items-center gap-3 border-b border-[rgba(226,222,217,.8)] bg-[rgba(245,245,244,.82)] px-5 py-3 backdrop-blur-[14px] xl:px-8">
          <div className="flex min-w-0 flex-auto items-center gap-2 overflow-hidden text-sm whitespace-nowrap text-[#4f4a45]">
            <span className="hidden xl:inline">{cur.group}</span>
            <ChevronRightIcon weight="bold" className="hidden size-3 xl:inline" aria-hidden />
            <span className="shrink-0 font-bold text-[#1c1917]">{cur.label}</span>
          </div>
          <div className="flex h-10 shrink-0 items-center gap-2.5 rounded-full bg-[#fbeae0] pr-3.5 pl-3 text-sm font-semibold whitespace-nowrap text-[#7c3410]" title={shiftTxt}>
            <span className="a-pulse size-2 rounded-full bg-[#eb9360]" aria-hidden />
            <span className="hidden xl:inline">{shiftTxt}</span>
            <span className="xl:hidden">{s ? `${s.name}, ${shiftState}` : shiftTxt}</span>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-[#4f4a45] tabular md:flex"><Clock className="size-[18px]" aria-hidden />{clockTxt}</div>
          <button type="button" onClick={() => setPalette(true)} aria-label="Tìm màn, phiếu, thao tác (Ctrl K)"
            className="flex h-11 shrink-0 items-center gap-2.5 rounded-[14px] bg-[#fdfdfc] pr-2 pl-3.5 text-sm whitespace-nowrap text-[#4f4a45] shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.07)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(41,37,36,.06),0_10px_24px_-12px_rgba(41,37,36,.3),0_0_0_1px_rgba(28,25,23,.1)]">
            <ScanSearch weight="bold" className="size-4" aria-hidden />
            <span className="hidden flex-1 text-left 2xl:inline">Tìm màn, phiếu, thao tác</span>
            <kbd className="rounded-[7px] bg-[#efedeb] px-[7px] py-1 font-mono text-sm font-semibold text-[#1c1917]">Ctrl K</kbd>
          </button>
          <NavLink to="/quan-ly/canh-bao" aria-label={`Cảnh báo, ${openAlerts.length} đang mở`}
            className="relative flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#fdfdfc] shadow-[0_1px_2px_rgba(41,37,36,.05),0_0_0_1px_rgba(28,25,23,.07)] transition-transform duration-300 hover:-translate-y-px">
            <Bell className="size-[21px]" aria-hidden />
            {openAlerts.length > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#a11d1d] px-1.5 text-sm font-bold whitespace-nowrap text-white shadow-[0_0_0_2px_#f5f5f4]">{openAlerts.length}</span>
            )}
          </NavLink>
          <div className="flex shrink-0 items-center gap-2.5 pl-1">
            <Initials name={me.full_name} size={40} dark />
            <div className="hidden leading-tight whitespace-nowrap xl:block">
              <div className="text-sm font-bold">{me.full_name}</div>
              <div className="text-sm text-[#4f4a45]">{me.role_labels.join(", ")}</div>
            </div>
            <button type="button" onClick={async () => { await logout(); nav("/dang-nhap") }} aria-label="Đổi người" title="Đổi người"
              className="flex size-11 items-center justify-center rounded-[14px] text-[#4f4a45] transition-colors hover:bg-[#efedeb] hover:text-[#1c1917]">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </header>
        <main id="noi-dung" tabIndex={-1} className="mx-auto w-full max-w-[1480px] min-w-0 flex-1 px-5 pt-[34px] pb-[72px] outline-none xl:px-9">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} invs={openInvs} collapsed={collapsedPref} onToggleSide={wide ? toggleSide : undefined} />
      <AdminToast />
    </div>
  )
}

/** Bảng lệnh Ctrl K: tìm màn, phiếu điều tra đang mở, thao tác nhanh (không phân biệt dấu). */
function CommandPalette({ open, onClose, invs, collapsed, onToggleSide }: {
  open: boolean
  onClose: () => void
  invs: Investigation[]
  collapsed: boolean
  onToggleSide?: () => void
}) {
  const nav = useNavigate()
  const [q, setQ] = useState("")
  const [idx, setIdx] = useState(0)
  useEffect(() => { if (open) { setQ(""); setIdx(0) } }, [open])
  const items = useMemo(() => {
    const go = (to: string) => () => { nav(to); onClose() }
    const all: { key: string; label: string; icon: IconType; group: string; run: () => void }[] = [
      ...ALL_ITEMS.map((it) => ({ key: it.to, label: it.label, icon: it.icon, group: "Màn", run: go(it.to) })),
      ...invs.map((v) => ({ key: `inv-${v.id}`, label: `${v.code} ${v.ingredient.name} tại ${v.location === "bep" ? "Bếp" : "Kho"}`, icon: FileSearch, group: "Phiếu điều tra", run: go(`/quan-ly/dieu-tra/${v.id}`) })),
      { key: "crit", label: "Xem cảnh báo nghiêm trọng", icon: BellRing, group: "Thao tác", run: go("/quan-ly/canh-bao?muc=critical") },
      ...(onToggleSide ? [{ key: "side", label: collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên", icon: SidebarSimple, group: "Thao tác", run: () => { onToggleSide(); onClose() } }] : []),
    ]
    const k = norm(q.trim())
    return k ? all.filter((it) => norm(`${it.label} ${it.group}`).includes(k)) : all
  }, [q, invs, collapsed, onToggleSide, nav, onClose])
  const sel = Math.min(idx, Math.max(items.length - 1, 0))
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" })
  }, [sel])
  const onKey = (e: ReactKeyboardEvent) => {
    const n = Math.max(items.length, 1)
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (Math.min(i, n - 1) + 1) % n) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (Math.min(i, n - 1) - 1 + n) % n) }
    else if (e.key === "Enter") { e.preventDefault(); items[sel]?.run() }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent showCloseButton={false} onKeyDown={onKey}
        className="!top-[13%] w-[min(640px,92vw)] max-w-none !-translate-y-0 gap-0 overflow-hidden rounded-[20px] bg-[#fdfdfc] p-0 text-[#1c1917] shadow-[0_40px_80px_-30px_rgba(28,25,23,.6),0_0_0_1px_rgba(28,25,23,.08)] ring-0 sm:max-w-none">
        <DialogTitle className="sr-only">Bảng lệnh</DialogTitle>
        <DialogDescription className="sr-only">Gõ tên màn, mã phiếu hoặc thao tác; mũi tên để chọn, Enter để mở.</DialogDescription>
        <div className="flex h-[60px] items-center gap-3 border-b border-[#efedeb] px-[18px]">
          <ScanSearch weight="bold" className="size-[19px] text-[#4f4a45]" aria-hidden />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0) }} placeholder="Gõ tên màn, mã phiếu hoặc thao tác" aria-label="Tìm kiếm"
            role="combobox" aria-expanded aria-controls="lenh-ds" aria-activedescendant={items[sel] ? `lenh-${items[sel].key}` : undefined}
            className="h-full flex-1 border-0 bg-transparent text-base outline-none placeholder:text-[#6b645f]" />
          <kbd className="rounded-[7px] bg-[#efedeb] px-[7px] py-1 font-mono text-sm font-semibold">Esc</kbd>
        </div>
        <div ref={listRef} id="lenh-ds" role="listbox" aria-label="Kết quả" className="max-h-[380px] overflow-y-auto p-2">
          {items.map((it, i) => {
            const on = i === sel
            return (
              <button key={it.key} id={`lenh-${it.key}`} data-i={i} type="button" role="option" aria-selected={on} onClick={it.run} onMouseEnter={() => setIdx(i)}
                className={cn("flex h-[50px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] whitespace-nowrap transition-colors duration-150", on && "bg-[#f3efeb]")}>
                <span className={cn("flex size-8 items-center justify-center rounded-[9px] transition-colors duration-200", on ? "bg-[#eb9360]" : "bg-[#f2f0ee]")}><it.icon className="size-[18px]" aria-hidden /></span>
                <span className="flex-1 truncate font-semibold">{it.label}</span>
                <span className="text-sm text-[#4f4a45]">{it.group}</span>
              </button>
            )
          })}
          {!items.length && <div className="p-7 text-center text-[15px] text-[#4f4a45]">Không tìm thấy kết quả</div>}
        </div>
        <div className="flex gap-[18px] border-t border-[#efedeb] px-[18px] py-3 text-sm text-[#4f4a45]"><span>↑ ↓ để chọn</span><span>Enter để mở</span><span>Esc để đóng</span></div>
      </DialogContent>
    </Dialog>
  )
}
