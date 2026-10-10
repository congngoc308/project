import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { homeFor, useAuth } from "@/lib/auth"
import { useFitZoom } from "@/lib/fitZoom"
import { ManagerLayout } from "@/layouts/ManagerLayout"
import { TabletLayout } from "@/layouts/TabletLayout"
import { LoginPage } from "@/pages/LoginPage"
import { AvtPage } from "@/pages/manager/AvtPage"
import { IngredientsPage, MenuPage } from "@/pages/manager/CatalogPages"
import { AlertsPage } from "@/pages/manager/AlertsPage"
import { CountsAdminPage, StockPage } from "@/pages/manager/ControlPages"
import { DashboardPage } from "@/pages/manager/DashboardPage"
import { ReceiptsAdminPage, ShiftsPage, WasteAdminPage } from "@/pages/manager/DocumentPages"
import { InvestigationDetailPage, InvestigationsPage } from "@/pages/manager/InvestigationPages"
import { ReportsPage } from "@/pages/manager/ReportsPage"
import { AuditPage, DemoClockPage, SettingsPage, TxnsPage, UsersPage } from "@/pages/manager/SystemPages"
import { ChefHandoverPage } from "@/pages/ops/HandoverPages"
import { KitchenPage } from "@/pages/ops/KitchenPage"
import { OrderPage } from "@/pages/ops/OrderPage"
import { TablesPage } from "@/pages/ops/TablesPage"
import { WastePage } from "@/pages/ops/WastePage"
import { StoreCount } from "@/pages/store/StoreCount"
import { StoreHandover } from "@/pages/store/StoreHandover"
import { StoreReceiving } from "@/pages/store/StoreReceiving"
import { StoreReturn } from "@/pages/store/StoreReturn"
import { StoreToday } from "@/pages/store/StoreToday"
import { StoreWaste } from "@/pages/store/StoreWaste"

/** Thủ kho (không làm bếp) ghi hao hụt tại Kho theo màn "Thu Kho v2"; bếp và quản lý giữ màn hao hụt cũ. */
function WasteRoute() {
  const { me } = useAuth()
  const storeOnly = !!me?.roles.includes("storekeeper") && !me.roles.some((r) => r === "kitchen" || r === "head_chef")
  return storeOnly ? <StoreWaste /> : <WastePage />
}

/** Trang vận hành mặc định: quản lý vào thẳng danh sách món của bếp. */
function OpsHome() {
  const { me } = useAuth()
  if (!me) return <Navigate to="/dang-nhap" replace />
  const ops = me.roles.filter((r) => r !== "manager")
  return <Navigate to={ops.length ? homeFor(ops) : "/van-hanh/bep"} replace />
}

/** Landing page tải riêng (kèm thư viện motion), không làm nặng app vận hành. */
const LandingPage = lazy(() => import("@/pages/landing/LandingPage").then((m) => ({ default: m.LandingPage })))

function RootRedirect() {
  const { me, loading } = useAuth()
  if (loading) return null
  return <Navigate to={me ? homeFor(me.roles) : "/dang-nhap"} replace />
}

export default function App() {
  useFitZoom()
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/gioi-thieu" element={<Suspense fallback={null}><LandingPage /></Suspense>} />
      <Route path="/van-hanh" element={<TabletLayout />}>
        <Route index element={<OpsHome />} />
        <Route path="hom-nay" element={<StoreToday />} />
        <Route path="dat-mon" element={<OrderPage />} />
        <Route path="ban" element={<TablesPage />} />
        <Route path="bep" element={<KitchenPage />} />
        <Route path="nhan-ban-giao" element={<ChefHandoverPage />} />
        <Route path="hao-hut" element={<WasteRoute />} />
        <Route path="kho" element={<StoreHandover />} />
        <Route path="can-tra" element={<StoreReturn />} />
        <Route path="nhap-hang" element={<StoreReceiving />} />
        <Route path="kiem-ke" element={<StoreCount />} />
      </Route>
      <Route path="/quan-ly" element={<ManagerLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="avt" element={<AvtPage />} />
        <Route path="dieu-tra" element={<InvestigationsPage />} />
        <Route path="dieu-tra/:id" element={<InvestigationDetailPage />} />
        <Route path="canh-bao" element={<AlertsPage />} />
        <Route path="kiem-ke" element={<CountsAdminPage />} />
        <Route path="ton-kho" element={<StockPage />} />
        <Route path="mon" element={<MenuPage />} />
        <Route path="nguyen-lieu" element={<IngredientsPage />} />
        <Route path="phieu-nhap" element={<ReceiptsAdminPage />} />
        <Route path="hao-hut" element={<WasteAdminPage />} />
        <Route path="ca" element={<ShiftsPage />} />
        <Route path="bao-cao" element={<ReportsPage />} />
        <Route path="so-kho" element={<TxnsPage />} />
        <Route path="nhat-ky" element={<AuditPage />} />
        <Route path="nguoi-dung" element={<UsersPage />} />
        <Route path="cai-dat" element={<SettingsPage />} />
        <Route path="dong-ho" element={<DemoClockPage />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
