import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useServerNow } from "@/lib/clock"
import type { CountSession, Handover, OrderItem, Receipt, Shift, WasteSlip } from "@/lib/types"

/**
 * Số việc đang chờ của người đang đăng nhập, dùng cho huy hiệu trên tab và màn "Hôm nay".
 * Dùng chung query key với các màn để SSE làm mới một chỗ là cập nhật mọi nơi.
 */
export function useWork() {
  const { me, has } = useAuth()
  const now = useServerNow(30_000)
  const server = has("server", "manager")
  const chef = has("head_chef", "manager")
  const store = has("storekeeper", "manager")
  const cook = has("kitchen", "head_chef", "manager")

  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<OrderItem[]>("/server/notifications"), enabled: server, refetchInterval: 20_000 })
  const kitchen = useQuery({ queryKey: ["kitchen"], queryFn: () => api.get<OrderItem[]>("/kitchen/items"), enabled: cook, refetchInterval: 30_000 })
  const handovers = useQuery({ queryKey: ["handovers", "pending"], queryFn: () => api.get<Handover[]>("/handovers?status=pending"), enabled: chef || store })
  const waste = useQuery({ queryKey: ["waste", "pending"], queryFn: () => api.get<WasteSlip[]>("/waste?status=pending"), enabled: chef })
  const receipts = useQuery({ queryKey: ["receipts"], queryFn: () => api.get<Receipt[]>("/receipts"), enabled: store })
  const counts = useQuery({ queryKey: ["counts", "open"], queryFn: () => api.get<CountSession[]>("/counts?status=open"), enabled: store })
  const shifts = useQuery({ queryKey: ["shifts", 2], queryFn: () => api.get<Shift[]>("/shifts?days=2"), enabled: store })

  const openShifts = (shifts.data ?? []).filter((s) => s.status === "open")
  const lateReturns = openShifts.filter((s) => new Date(s.planned_end).getTime() <= now.getTime())
  const wasteToApprove = (waste.data ?? []).filter((s) => s.created_by !== me?.full_name && (s.status === "pending_chef" || has("manager")))

  return {
    outOfStockTables: notes.data?.length ?? 0,
    waitingDishes: (kitchen.data ?? []).filter((i) => i.status === "waiting").length,
    handoversToSign: handovers.data?.length ?? 0,
    wasteToApprove: wasteToApprove.length,
    receiptsToReceive: (receipts.data ?? []).filter((r) => r.status === "draft").length,
    openCounts: counts.data?.length ?? 0,
    openShifts,
    lateReturns: lateReturns.length,
    queries: { receipts, counts, shifts, handovers },
  }
}
