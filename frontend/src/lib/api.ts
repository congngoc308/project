export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const type = res.headers.get("content-type") ?? ""
  const payload = type.includes("application/json") ? await res.json() : await res.text()
  if (!res.ok) {
    const detail =
      typeof payload === "object" && payload && "detail" in payload
        ? formatDetail((payload as { detail: unknown }).detail)
        : `Lỗi ${res.status}`
    throw new ApiError(detail, res.status, (payload as { data?: unknown })?.data)
  }
  return payload as T
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    // Lỗi kiểm tra dữ liệu của FastAPI
    return detail.map((d) => (d as { msg?: string }).msg ?? "Dữ liệu không hợp lệ").join("; ")
  }
  return "Có lỗi xảy ra"
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body: unknown = {}) => request<T>("POST", url, body),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  upload: async (file: File): Promise<{ path: string }> => {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/uploads", { method: "POST", body: form, credentials: "include" })
    const payload = await res.json()
    if (!res.ok) throw new ApiError(payload.detail ?? "Tải tệp thất bại", res.status, null)
    return payload
  },
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v))
  }
  const out = s.toString()
  return out ? `?${out}` : ""
}
