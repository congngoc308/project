import { ChefHat, ClipboardList, LayoutDashboard, ListTodo, PackageCheck, Scale, ShoppingBasket, Soup, Trash2, Truck, Utensils } from "@/components/icons"
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom"

import { CountBadge } from "@/components/common"
import { useAuth } from "@/lib/auth"
import { notifyEvent, useServerEvents } from "@/lib/sse"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWork } from "@/lib/work"
import { ClockText, DemoBanner, ShiftChip, SkipLink, UserMenu, useOpsScale } from "@/layouts/TopBits"
import { NightDemoBanner, NightGlow, NightHeader, NightPage, NightTabs, useNightTheme } from "@/layouts/NightBits"
import { KitchenRail, KitchenToasts, useKitchenTheme } from "@/layouts/KitchenBits"
import { STORE_ROUTES, StoreShell } from "@/layouts/StoreBits"

/** Màn của phục vụ bàn dùng giao diện "ban đêm" theo thiết kế "Phục Vụ". */
const NIGHT_ROUTES = ["/van-hanh/dat-mon", "/van-hanh/ban"]
/** Màn của nhân viên bếp / bếp trưởng dùng thanh bên trắng theo thiết kế "Nhan vien Bep v3". */
const KITCHEN_ROUTES = ["/van-hanh/bep", "/van-hanh/hao-hut", "/van-hanh/nhan-ban-giao"]

type WorkKey = keyof Omit<ReturnType<typeof useWork>, "openShifts" | "queries">

const TABS: { to: string; label: string; icon: typeof Soup; roles: Role[]; badge?: WorkKey; quiet?: boolean }[] = [
  { to: "/van-hanh/hom-nay", label: "Hôm nay", icon: ListTodo, roles: ["storekeeper"] },
  { to: "/van-hanh/dat-mon", label: "Đặt món", icon: Utensils, roles: ["server", "manager"] },
  { to: "/van-hanh/ban", label: "Bàn & báo khách", icon: ClipboardList, roles: ["server", "manager"], badge: "tablesToAttend" },
  { to: "/van-hanh/bep", label: "Danh sách món", icon: Soup, roles: ["kitchen", "head_chef", "manager"], badge: "waitingDishes", quiet: true },
  { to: "/van-hanh/nhan-ban-giao", label: "Nhận bàn giao", icon: Scale, roles: ["head_chef"], badge: "handoversToSign" },
  { to: "/van-hanh/nhap-hang", label: "Nhập hàng", icon: ShoppingBasket, roles: ["storekeeper", "manager"], badge: "receiptsToReceive", quiet: true },
  { to: "/van-hanh/kho", label: "Bàn giao", icon: Truck, roles: ["storekeeper", "manager"], badge: "handoversToSign", quiet: true },
  { to: "/van-hanh/can-tra", label: "Cân trả cuối ca", icon: Scale, roles: ["storekeeper", "manager"], badge: "lateReturns" },
  { to: "/van-hanh/kiem-ke", label: "Kiểm kê", icon: PackageCheck, roles: ["storekeeper", "manager"], badge: "openCounts", quiet: true },
  { to: "/van-hanh/hao-hut", label: "Hao hụt", icon: Trash2, roles: ["kitchen", "head_chef", "storekeeper", "manager"], badge: "wasteToApprove" },
]

/** Bố cục máy tính bảng cho phục vụ, bếp, thủ kho: chỉ hiện các việc của vai trò, tab lớn có số việc chờ. */
export function TabletLayout() {
  const { me, loading, has } = useAuth()
  useServerEvents(!!me, (ev) => me && notifyEvent(ev, me.roles))
  const work = useWork()
  const { pathname } = useLocation()
  const night = NIGHT_ROUTES.includes(pathname)
  const kitchen = KITCHEN_ROUTES.includes(pathname) && !!me?.roles.some((r) => r === "kitchen" || r === "head_chef")
  /** Màn của thủ kho dùng thanh bên theo thiết kế "Thu Kho v2"; hao hụt chỉ theo khi người dùng không làm bếp. */
  const store = STORE_ROUTES.includes(pathname) || (pathname === "/van-hanh/hao-hut" && !kitchen && !!me?.roles.includes("storekeeper"))
  useOpsScale()
  useNightTheme(night)
  useKitchenTheme(kitchen)
  if (loading) return null
  if (!me) return <Navigate to="/dang-nhap" replace />
  const tabs = TABS.filter((t) => t.roles.some((r) => me.roles.includes(r)))
  if (night) {
    return (
      <NightPage>
        <SkipLink />
        <NightGlow />
        <NightDemoBanner />
        <div className="relative z-[2] mx-auto max-w-[1720px] px-4 pt-7 pb-[120px] sm:px-10">
          <NightHeader />
          <NightTabs
            activeIndex={tabs.findIndex((t) => t.to === pathname)}
            tabs={tabs.map((t) => ({ to: t.to, label: t.label, icon: t.icon, badge: t.badge && !t.quiet ? work[t.badge] : undefined }))}
          />
          <main id="noi-dung" tabIndex={-1} className="outline-none">
            <Outlet />
          </main>
        </div>
      </NightPage>
    )
  }
  if (store) return <StoreShell />
  if (kitchen) {
    return (
      <div className="flex min-h-svh items-start bg-[#f5f4f1] text-[#141210]">
        <SkipLink />
        <KitchenRail tabs={tabs.map((t) => ({ to: t.to, label: t.label, icon: t.icon, count: t.badge ? work[t.badge] : undefined }))} />
        <div className="min-w-0 flex-1">
          <DemoBanner />
          <main id="noi-dung" tabIndex={-1} className="px-5 pt-7 pb-10 outline-none lg:px-8">
            <Outlet />
          </main>
        </div>
        <KitchenToasts />
      </div>
    )
  }
  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <DemoBanner />
      <header className="sticky top-0 z-20 border-b border-border/70 bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 pt-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(28_25_23/0.12)]">
              <ChefHat className="size-6" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-bold">Quản lý bếp</div>
              <ShiftChip shift={me.shift} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden lg:inline-flex"><ClockText /></span>
            {has("manager") && (
              <NavLink to="/quan-ly" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold underline decoration-primary decoration-2 underline-offset-4 hover:bg-card">
                <LayoutDashboard className="size-5" aria-hidden /> Màn quản lý
              </NavLink>
            )}
            <UserMenu />
          </div>
        </div>
        <nav className="mx-auto w-full max-w-[1400px] px-4 py-3 sm:px-5" aria-label="Chức năng">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-secondary/80 p-1 sm:inline-flex">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-base font-semibold transition-[background-color,box-shadow,color] duration-200",
                    isActive ? "bg-ink text-ink-foreground shadow-lift" : "text-foreground hover:bg-card",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <t.icon className="size-6" aria-hidden /> {t.label}
                    {t.badge && <CountBadge n={work[t.badge]} tone={isActive ? "light" : t.quiet ? "neutral" : "bad"} />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main id="noi-dung" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-10 outline-none sm:px-5">
        <Outlet />
      </main>
      {/* Màn bếp / hao hụt mở bằng vai trò khác (quản lý, thủ kho) vẫn báo bằng thông báo của màn bếp. */}
      <KitchenToasts />
    </div>
  )
}
