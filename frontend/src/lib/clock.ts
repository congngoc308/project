import { useEffect, useState } from "react"

import { useAuth } from "@/lib/auth"

/** Giờ nghiệp vụ của máy chủ (có thể là giờ demo), tự chạy giữa các lần làm mới /auth/me. */
export function useServerNow(tickMs = 15_000): Date {
  const { me } = useAuth()
  const [base] = useState(() => ({ client: Date.now() }))
  const [, setTick] = useState(0)
  const [anchor, setAnchor] = useState<{ server: number; client: number } | null>(null)

  useEffect(() => {
    if (me?.now) setAnchor({ server: new Date(me.now).getTime(), client: Date.now() })
  }, [me?.now])
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), tickMs)
    return () => clearInterval(t)
  }, [tickMs])

  if (!anchor) return new Date(base.client)
  return new Date(anchor.server + (Date.now() - anchor.client))
}
