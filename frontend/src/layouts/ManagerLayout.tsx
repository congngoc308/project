import { useQuery } from "@tanstack/react-query"
import {
  AlarmClock,
  BarChart3,
  Bell,
  BookOpen,
  ChefHat,
  ClipboardCheck,
  FileSearch,
  FileText,
  History,
  LayoutDashboard,
  Leaf,
  ListChecks,
  Scale,
  Settings,
  ShoppingBasket,
  Tablet,
  Trash2,
  Users,
  Warehouse,
} from "@/components/icons"
import { NavLink, Navigate, Outlet } from "react-router-dom"

import { CountBadge } from "@/components/common"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { notifyEvent, useServerEvents } from "@/lib/sse"
import type { Alert, Investigation } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ClockText, DemoBanner, ShiftChip, SkipLink, UserMenu } from "@/layouts/TopBits"

type BadgeKey = "alerts" | "inv"

const GROUPS: { title: string; items: { to: string; label: string; icon: typeof Bell; end?: boolean; badge?: BadgeKey }[] }[] = [
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
      { to: "/quan-ly/cai-dat", label: "Cài đặt ngưỡng", icon: Settings },
      { to: "/quan-ly/dong-ho", label: "Đồng hồ demo", icon: AlarmClock },
    ],
  },
]

export function ManagerLayout() {
  const { me, loading, has } = useAuth()
  useServerEvents(!!me, (ev) => me && notifyEvent(ev, me.roles))
  const alerts = useQuery({ queryKey: ["alerts", "open"], queryFn: () => api.get<Alert[]>("/alerts?status=open"), enabled: has("manager") })
  const invs = useQuery({ queryKey: ["investigations", "open"], queryFn: () => api.get<Investigation[]>("/investigations?status=open"), enabled: has("manager") })
  if (loading) return null
  if (!me) return <Navigate to="/dang-nhap" replace />
  if (!has("manager")) return <Navigate to="/van-hanh" replace />
  const critical = (alerts.data ?? []).filter((a) => a.severity === "critical").length
  const overdue = (invs.data ?? []).filter((i) => i.overdue).length
  const badges: Record<BadgeKey, { n: number; urgent: boolean }> = {
    alerts: { n: alerts.data?.length ?? 0, urgent: critical > 0 },
    inv: { n: invs.data?.length ?? 0, urgent: overdue > 0 },
  }

  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-svh w-[17rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(28_25_23/0.12)]">
              <ChefHat className="size-6" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-bold">Quản lý bếp</div>
              <div className="text-xs text-muted-foreground">Định mức, thực tế, giải trình</div>
            </div>
          </div>
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-2 pb-4" aria-label="Màn quản lý">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h2 className="px-3 pb-1.5 font-sans text-xs font-semibold tracking-normal text-muted-foreground">{g.title}</h2>
                <div className="space-y-0.5">
                  {g.items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) =>
                        cn(
                          "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,box-shadow] duration-200",
                          isActive ? "bg-card font-semibold shadow-soft ring-1 ring-stone-900/5" : "font-medium text-foreground/85 hover:bg-muted",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={cn("flex size-8 items-center justify-center rounded-lg transition-colors",
                            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                            <it.icon className="size-5" aria-hidden />
                          </span>
                          <span className="flex-1">{it.label}</span>
                          {it.badge && <CountBadge n={badges[it.badge].n} tone={badges[it.badge].urgent ? "bad" : "neutral"} />}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-3">
            <NavLink to="/van-hanh" className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold shadow-[0_1px_2px_rgb(28_25_23/0.05)] transition-shadow hover:shadow-soft">
              <Tablet className="size-5" aria-hidden /> Mở màn vận hành
            </NavLink>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-page/85 px-5 py-3 backdrop-blur-md lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <ShiftChip shift={me.shift} />
              <ClockText />
            </div>
            <UserMenu />
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-border/70 bg-page px-3 py-2 lg:hidden" aria-label="Màn quản lý">
            {GROUPS.flatMap((g) => g.items).map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => cn("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold",
                  isActive ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-card")}>
                {it.label}
                {it.badge && <CountBadge n={badges[it.badge].n} tone={badges[it.badge].urgent ? "bad" : "neutral"} />}
              </NavLink>
            ))}
          </nav>
          <main id="noi-dung" tabIndex={-1} className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-5 pt-7 pb-12 outline-none lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
