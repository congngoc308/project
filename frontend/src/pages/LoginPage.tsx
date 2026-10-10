import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ChefHat, KeyRound, Loader2 } from "@/components/icons"
import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"

import { Loading } from "@/components/common"
import { NumPad } from "@/components/NumPad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, useOpsScale } from "@/layouts/TopBits"
import { api, ApiError } from "@/lib/api"
import { homeFor, useAuth } from "@/lib/auth"
import { KITCHEN_PHOTO } from "@/lib/photos"
import type { Me, StaffUser } from "@/lib/types"
import { cn } from "@/lib/utils"

const GROUPS = [
  { title: "Phục vụ", roles: ["server"] },
  { title: "Bếp", roles: ["head_chef", "kitchen"] },
  { title: "Kho", roles: ["storekeeper"] },
  { title: "Quản lý", roles: ["manager"] },
]

export function LoginPage() {
  const { me, refresh } = useAuth()
  const nav = useNavigate()
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api.get<StaffUser[]>("/auth/staff") })
  const [mode, setMode] = useState<"pin" | "password">("pin")
  const [picked, setPicked] = useState<StaffUser | null>(null)
  const [pin, setPin] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useOpsScale()

  if (me) return <Navigate to={homeFor(me.roles)} replace />

  const done = async () => {
    const r = (await refresh()) as { data?: Me | null }
    nav(homeFor(r.data?.roles ?? []), { replace: true })
  }

  const loginPin = async (value: string) => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/pin-login", { user_id: picked.id, pin: value })
      await done()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không đăng nhập được")
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  const loginPassword = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/login", { username, password })
      await done()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không đăng nhập được")
    } finally {
      setBusy(false)
    }
  }

  const pick = (u: StaffUser) => {
    setPicked(u)
    setMode("pin")
    setPin("")
    setError(null)
  }

  const groups = GROUPS.map((g) => ({
    ...g,
    people: (staff.data ?? []).filter((u) => u.roles.some((r) => g.roles.includes(r)) &&
      !(g.title === "Bếp" && u.roles.includes("storekeeper") && !u.roles.includes("head_chef"))),
  })).filter((g) => g.people.length)

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Ảnh bếp thật: trên màn hẹp là dải ảnh phía trên, màn rộng là nửa trái cố định */}
      <aside className="relative h-56 overflow-hidden bg-ink lg:sticky lg:top-0 lg:h-[100dvh]">
        <img src={KITCHEN_PHOTO.src} alt={KITCHEN_PHOTO.alt} className="absolute inset-0 size-full object-cover object-[50%_70%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-stone-950/20" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-6 text-stone-50 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ChefHat className="size-6" aria-hidden />
            </div>
            <span className="font-display text-lg font-bold">Quản lý bếp</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-3xl leading-[1.05] font-bold lg:text-5xl">Quản lý vận hành bếp</h1>
            <p className="mt-3 hidden text-base text-stone-200 lg:block">
              Đặt món, chế biến, bàn giao và kiểm kê trên cùng một hệ thống. Chọn tên và nhập PIN để bắt đầu.
            </p>
            <p className="mt-6 hidden text-xs text-stone-300 lg:block">
              Ảnh: {KITCHEN_PHOTO.author},{" "}
              <a className="underline underline-offset-2" href={KITCHEN_PHOTO.source} target="_blank" rel="noreferrer">{KITCHEN_PHOTO.license}</a>
            </p>
          </div>
        </div>
      </aside>

      <main id="noi-dung" tabIndex={-1} className="flex min-w-0 flex-col px-5 py-8 outline-none sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
          {mode === "password" ? (
            <form
              className="mx-auto w-full max-w-md space-y-5"
              onSubmit={(e) => {
                e.preventDefault()
                void loginPassword()
              }}
            >
              <h2 className="text-3xl font-bold">Đăng nhập quản lý</h2>
              <div className="space-y-2">
                <Label htmlFor="u">Tên đăng nhập</Label>
                <Input id="u" className="h-12" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p">Mật khẩu</Label>
                <Input id="p" className="h-12" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && <p className="text-sm font-semibold text-critical-ink" role="alert">{error}</p>}
              <Button type="submit" size="touch" className="w-full" disabled={busy || !username || !password}>Đăng nhập</Button>
              <Button type="button" variant="link" size="lg" className="w-full" onClick={() => { setMode("pin"); setError(null) }}>
                <ArrowLeft className="size-4" /> Đăng nhập bằng PIN
              </Button>
              <p className="text-center text-sm text-muted-foreground">Dữ liệu demo: quanly / quanly123</p>
            </form>
          ) : picked ? (
            <section className="mx-auto w-full max-w-sm" aria-label="Nhập mã PIN">
              <Button variant="ghost" size="lg" className="-ml-3 mb-4" onClick={() => { setPicked(null); setPin(""); setError(null) }}>
                <ArrowLeft className="size-5" /> Chọn người khác
              </Button>
              <div className="mb-6 flex items-center gap-4">
                <Avatar name={picked.full_name} className="size-14 text-lg" />
                <div className="min-w-0">
                  <h2 className="text-2xl leading-tight font-bold">{picked.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{picked.role_labels.join(", ")}</p>
                </div>
              </div>
              <p className="mb-3 font-semibold">Nhập mã PIN</p>
              <div role="status" className="mb-4 flex h-7 items-center justify-center gap-4" aria-live="polite" aria-label={`Đã nhập ${pin.length} số`}>
                {busy ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                  <span key={i} className={cn("size-4 rounded-full border-2 transition-colors duration-150", i < pin.length ? "border-ink bg-ink" : "border-input")} />
                ))}
              </div>
              {error && <p className="mb-3 text-center text-sm font-semibold text-critical-ink" role="alert">{error}</p>}
              <NumPad
                value={pin}
                allowDecimal={false}
                maxLength={6}
                onChange={(v) => {
                  setPin(v)
                  if (v.length === 4 && !busy) void loginPin(v)
                }}
              />
            </section>
          ) : (
            <section aria-label="Chọn người dùng">
              <h2 className="text-3xl font-bold">Bạn là ai?</h2>
              <p className="mt-1 text-muted-foreground">Chạm vào tên của bạn, sau đó nhập mã PIN.</p>
              {staff.isLoading ? <Loading rows={4} /> : (
                <div className="mt-8 space-y-7">
                  {groups.map((g) => (
                    <div key={g.title}>
                      <h3 className="mb-2.5 font-sans text-sm font-semibold tracking-normal text-muted-foreground">{g.title}</h3>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {g.people.map((u) => (
                          <button
                            key={`${g.title}-${u.id}`}
                            type="button"
                            onClick={() => pick(u)}
                            className="group flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-[0_1px_2px_rgb(28_25_23/0.05)] transition-[box-shadow,transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-input/50 hover:shadow-lift active:scale-[0.98]"
                          >
                            <Avatar name={u.full_name} className="transition-colors group-hover:bg-primary group-hover:text-primary-foreground" />
                            <span className="min-w-0">
                              <span className="block font-semibold leading-snug">{u.full_name}</span>
                              <span className="block text-xs leading-snug text-muted-foreground">{u.role_labels.join(", ")}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="link" size="lg" className="mt-8 -ml-3" onClick={() => { setMode("password"); setError(null) }}>
                <KeyRound className="size-5" /> Quản lý đăng nhập bằng mật khẩu
              </Button>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
