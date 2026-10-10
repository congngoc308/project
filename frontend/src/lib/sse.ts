import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { chime } from "@/lib/sound"

interface ServerEvent {
  channel: string
  kind: string
  data: Record<string, unknown>
}

/** Nhóm query cần làm mới theo từng loại sự kiện SSE. */
const INVALIDATE: Record<string, string[][]> = {
  order: [["kitchen"], ["orders"]],
  item: [["kitchen"], ["orders"], ["notifications"], ["ready"]],
  menu: [["menu"], ["kitchen"]],
  out_of_stock: [["kitchen"], ["orders"], ["notifications"], ["menu"]],
  handover: [["handovers"], ["me"]],
  shift: [["me"], ["shifts"]],
  waste: [["waste"]],
  alert: [["dashboard"], ["alerts"]],
  investigation: [["investigations"], ["dashboard"]],
  count: [["counts"], ["dashboard"]],
  receipt: [["receipts"], ["dashboard"]],
}

/** Kết nối SSE một lần cho cả ứng dụng; tự kết nối lại khi rớt mạng. */
export function useServerEvents(enabled: boolean, onEvent?: (e: ServerEvent) => void) {
  const qc = useQueryClient()
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!enabled) return
    const es = new EventSource("/api/events", { withCredentials: true })
    es.onmessage = (msg) => {
      let ev: ServerEvent
      try {
        ev = JSON.parse(msg.data)
      } catch {
        return
      }
      for (const key of INVALIDATE[ev.kind] ?? []) qc.invalidateQueries({ queryKey: key })
      handler.current?.(ev)
    }
    return () => es.close()
  }, [enabled, qc])
}

/** Món xong trong vòng 1,5 giây được gộp theo bàn thành một thông báo, để giờ cao điểm không kêu liên tục. */
let readyBuf: { table: string; dish: string; qty: number }[] = []
let readyTimer: number | undefined
function queueReady(table: string, dish: string, qty: number) {
  readyBuf.push({ table, dish, qty })
  window.clearTimeout(readyTimer)
  readyTimer = window.setTimeout(() => {
    const byTable = new Map<string, string[]>()
    for (const r of readyBuf) byTable.set(r.table, [...(byTable.get(r.table) ?? []), `${r.dish} ×${r.qty}`])
    readyBuf = []
    chime("new")
    for (const [t, dishes] of byTable) {
      toast.success(`${t === "Mang đi" ? t : `Bàn ${t}`}: món đã xong`, {
        description: `${dishes.join(", ")}. Mang ra bàn rồi bấm "Đã bưng" ở tab Bàn & báo khách.`,
        duration: 10_000,
      })
    }
  }, 1500)
}

export function notifyEvent(ev: ServerEvent, roles: string[]) {
  if (ev.channel === "server" && ev.kind === "item" && ev.data.status === "done" && ev.data.table && roles.includes("server")) {
    queueReady(String(ev.data.table), String(ev.data.dish), Number(ev.data.qty ?? 1))
  }
  if (ev.kind === "out_of_stock" && ev.data.table && roles.includes("server")) {
    toast.warning(`Bàn ${ev.data.table}: ${ev.data.dish} hết ${ev.data.ingredient}`, {
      description: "Đổi món hoặc hủy với khách",
      duration: 10_000,
    })
  }
  if (ev.kind === "restock_suggestion" && roles.includes("storekeeper")) {
    toast.info(`Bếp báo hết ${ev.data.ingredient}`, { description: "Kho còn hàng: tạo bàn giao bổ sung" })
  }
  if (ev.kind === "alert" && ev.data.severity === "critical" && roles.includes("manager")) {
    toast.error(String(ev.data.title), { duration: 8000 })
  }
}
