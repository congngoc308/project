import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError } from "@/lib/api"

/** Thao tác ghi: báo thành công / lỗi bằng toast và làm mới các query liên quan. */
export function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: {
    success?: string | ((r: TResult) => string)
    invalidate?: string[][]
    onSuccess?: (r: TResult) => void
    onError?: (e: unknown) => void
    quietError?: boolean
  } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k })
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(r) : opts.success)
      opts.onSuccess?.(r)
    },
    onError: (e) => {
      opts.onError?.(e)
      if (!opts.quietError) toast.error(e instanceof ApiError ? e.message : "Có lỗi xảy ra")
    },
  })
}

export function errorText(e: unknown): string | null {
  if (!e) return null
  return e instanceof ApiError ? e.message : "Có lỗi xảy ra"
}
