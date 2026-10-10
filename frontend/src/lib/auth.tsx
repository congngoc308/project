import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useContext, type ReactNode } from "react"

import { api, ApiError } from "@/lib/api"
import type { Me, Meta, Role } from "@/lib/types"

interface AuthState {
  me: Me | null
  loading: boolean
  refresh: () => Promise<unknown>
  logout: () => Promise<void>
  has: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<Me>("/auth/me")
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    refetchInterval: 60_000,
    retry: false,
  })
  const me = q.data ?? null
  const value: AuthState = {
    me,
    loading: q.isLoading,
    refresh: () => q.refetch(),
    logout: async () => {
      await api.post("/auth/logout")
      qc.clear()
      await q.refetch()
    },
    has: (...roles) => !!me && roles.some((r) => me.roles.includes(r)),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth ngoài AuthProvider")
  return ctx
}

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/meta"), staleTime: 5 * 60_000 })
}

/** Trang mặc định theo vai trò sau khi đăng nhập. */
export function homeFor(roles: Role[]): string {
  if (roles.includes("manager")) return "/quan-ly"
  if (roles.includes("head_chef") || roles.includes("kitchen")) return "/van-hanh/bep"
  if (roles.includes("storekeeper")) return "/van-hanh/hom-nay"
  return "/van-hanh/dat-mon"
}
