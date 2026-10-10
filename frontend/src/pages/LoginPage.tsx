import { useQuery } from "@tanstack/react-query"
import { AlertOctagon, ArrowLeft, ChefHat, Eye, EyeOff, KeyRound, Loader2 } from "@/components/icons"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { Loading } from "@/components/common"
import { NumPad } from "@/components/NumPad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, useOpsScale } from "@/layouts/TopBits"
import { api, ApiError } from "@/lib/api"
import { homeFor, PIN_LEN, useAuth } from "@/lib/auth"
import { plainClick, preloadLanding, usePageTransition } from "@/lib/pageTransition"
import { KITCHEN_PHOTO } from "@/lib/photos"
import type { Me, Role, StaffUser } from "@/lib/types"
import { cn } from "@/lib/utils"

/** base = vai trò chung của nhóm (không nhắc lại trên thẻ); thẻ chỉ ghi vai trò thêm như bếp trưởng, kiêm nhiệm. */
const GROUPS: { title: string; roles: Role[]; base: Role }[] = [
  { title: "Phục vụ, thu ngân", roles: ["server"], base: "server" },
  { title: "Bếp", roles: ["head_chef", "kitchen"], base: "kitchen" },
  { title: "Kho", roles: ["storekeeper"], base: "storekeeper" },
  { title: "Quản lý", roles: ["manager"], base: "manager" },
]

/** "Bếp trưởng ca" giữ nguyên; vai trò thuộc nhóm khác thành "Kiêm nhân viên bếp"… */
function extraRoles(u: StaffUser, base: Role): string[] {
  return u.roles.flatMap((r, i) => {
    if (r === base) return []
    const label = u.role_labels[i] ?? r
    return r === "head_chef" ? [label] : [`Kiêm ${label.toLowerCase()}`]
  })
}

export function LoginPage() {
  const { me, refresh } = useAuth()
  const nav = useNavigate()
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api.get<StaffUser[]>("/auth/staff") })
  const [mode, setMode] = useState<"pin" | "password">("pin")
  const [picked, setPicked] = useState<StaffUser | null>(null)
  const [pin, setPin] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)
  // Đến từ trang giới thiệu bằng "Vào hệ thống với vai trò…": nhóm đó lên đầu và được tô nổi.
  const [params] = useSearchParams()
  const wanted = params.get("nhom")
  const step = mode === "password" ? "password" : picked ? "pin" : "people"
  useOpsScale()

  // Đổi bước thì đưa focus về tiêu đề của bước mới, để bàn phím và trình đọc màn hình không bị lạc.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const done = async () => {
    const r = (await refresh()) as { data?: Me | null }
    nav(homeFor(r.data?.roles ?? []), { replace: true })
  }

  const loginPin = async (value: string) => {
    if (!picked || busy || value.length !== PIN_LEN) return
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/pin-login", { user_id: picked.id, pin: value })
      await done()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không đăng nhập được")
      setPin("")
      setShake((n) => n + 1)
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

  const typePin = (v: string) => {
    setPin(v)
    if (error) setError(null)
    if (v.length === PIN_LEN) void loginPin(v)
  }

  const pick = (u: StaffUser) => {
    setPicked(u)
    setMode("pin")
    setPin("")
    setError(null)
  }

  const back = () => {
    setPicked(null)
    setPin("")
    setError(null)
  }

  // Máy có bàn phím: gõ số, Backspace để xóa, Enter để vào, Esc để chọn người khác.
  useEffect(() => {
    if (step !== "pin") return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || busy) return
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        if (pin.length < PIN_LEN) typePin(pin + e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        typePin(pin.slice(0, -1))
      } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        void loginPin(pin)
      } else if (e.key === "Escape") {
        back()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (me) return <Navigate to={homeFor(me.roles)} replace />

  const groups = GROUPS.map((g) => ({
    ...g,
    people: (staff.data ?? []).filter((u) => u.roles.some((r) => g.roles.includes(r)) &&
      !(g.base === "kitchen" && u.roles.includes("storekeeper") && !u.roles.includes("head_chef"))),
  })).filter((g) => g.people.length).sort((a, b) => Number(b.base === wanted) - Number(a.base === wanted))

  return (
    <div data-page="login" className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Ảnh bếp thật: trên màn hẹp là dải ảnh phía trên, màn rộng là nửa trái cố định */}
      <aside className="on-dark relative h-56 overflow-hidden bg-ink lg:sticky lg:top-0 lg:h-[100dvh]">
        {/* Cùng ảnh với khối cuối trang giới thiệu: khi chuyển trang, ảnh bay từ đó sang (lib/pageTransition.ts) */}
        <img src={KITCHEN_PHOTO.src} alt={KITCHEN_PHOTO.alt} className="absolute inset-0 size-full object-cover object-[50%_70%]" style={{ viewTransitionName: "kitchen-photo" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-stone-950/20" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-6 text-stone-50 lg:p-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3" style={{ viewTransitionName: "brand" }}>
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ChefHat className="size-6" aria-hidden />
              </div>
              <span className="font-display text-lg font-bold">Quản lý bếp</span>
            </div>
            <IntroLink />
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

      <main id="noi-dung" tabIndex={-1} className="flex min-w-0 flex-col px-5 py-8 outline-none sm:px-8 lg:px-10 lg:py-12 xl:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
          {step === "password" ? (
            <form
              className="surface mx-auto w-full max-w-md space-y-5 p-6 sm:p-8"
              aria-labelledby="password-title"
              onSubmit={(e) => {
                e.preventDefault()
                void loginPassword()
              }}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-paprika-soft text-paprika-ink">
                  <KeyRound className="size-6" aria-hidden />
                </span>
                <h2 id="password-title" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">Đăng nhập quản lý</h2>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u">Tên đăng nhập</Label>
                <Input id="u" className="h-12" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p">Mật khẩu</Label>
                <div className="relative">
                  <Input id="p" className="h-12 pr-14" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                  </button>
                </div>
              </div>
              {error && <ErrorLine>{error}</ErrorLine>}
              <Button type="submit" size="touch" className="w-full" disabled={busy || !username || !password}>
                {busy && <Loader2 className="size-5 animate-spin" aria-hidden />} Đăng nhập
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" size="lg" className="-ml-3" onClick={() => { setMode("pin"); setError(null) }}>
                  <ArrowLeft className="size-5" /> Dùng PIN
                </Button>
                <p className="text-sm text-muted-foreground">Demo: quanly / quanly123</p>
              </div>
            </form>
          ) : step === "pin" && picked ? (
            <section className="surface mx-auto w-full max-w-sm p-5 sm:p-6" aria-labelledby="pin-title">
              <Button variant="ghost" size="lg" className="-mt-1 -ml-3 mb-3" onClick={back}>
                <ArrowLeft className="size-5" /> Chọn người khác
              </Button>
              <div className="flex items-center gap-4">
                <Avatar name={picked.full_name} className="size-16 rounded-2xl text-xl" />
                <div className="min-w-0">
                  <h2 id="pin-title" ref={headingRef} tabIndex={-1} className="text-2xl leading-tight font-bold outline-none">{picked.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{picked.role_labels.join(", ")}</p>
                </div>
              </div>

              <div className="mt-6 flex items-baseline justify-between gap-3">
                <p className="font-semibold">Mã PIN</p>
                <p className="text-sm text-muted-foreground">{PIN_LEN} số, đủ số là tự vào</p>
              </div>
              <div
                key={shake}
                role="status"
                aria-live="polite"
                aria-label={busy ? "Đang kiểm tra PIN" : `Đã nhập ${pin.length} số`}
                className={cn("mt-2.5 flex h-14 items-center justify-center gap-2.5", shake > 0 && "pin-shake")}
              >
                {busy ? <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden /> : (
                  Array.from({ length: PIN_LEN }).map((_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={cn(
                        "flex h-14 w-11 items-center justify-center rounded-xl border-2 bg-card transition-colors duration-150",
                        i < pin.length ? "border-ink" : i === pin.length ? "border-dashed border-ink/70" : "border-input/60",
                        error && "border-critical-ink",
                      )}
                    >
                      {i < pin.length && <span className="size-3.5 rounded-full bg-ink" />}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-3 min-h-6">{error && <ErrorLine>{error}</ErrorLine>}</div>

              <NumPad
                className="mt-3 gap-2.5 [&>button]:h-16"
                value={pin}
                allowDecimal={false}
                maxLength={PIN_LEN}
                onChange={typePin}
              />
            </section>
          ) : (
            <section aria-labelledby="people-title" className="mx-auto w-full max-w-[640px]">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <h2 id="people-title" ref={headingRef} tabIndex={-1} className="text-3xl font-bold outline-none">Bạn là ai?</h2>
                  <p className="mt-1 text-muted-foreground">Chạm vào tên của bạn, sau đó nhập mã PIN.</p>
                </div>
                <Button variant="outline" size="lg" className="rounded-xl" onClick={() => { setMode("password"); setError(null) }}>
                  <KeyRound className="size-5" /> Quản lý dùng mật khẩu
                </Button>
              </div>
              {staff.isLoading ? <Loading rows={4} /> : staff.isError ? (
                <div className="mt-8"><ErrorLine>Không tải được danh sách nhân viên. Kiểm tra kết nối rồi tải lại trang.</ErrorLine></div>
              ) : (
                <div className="mt-7 space-y-5">
                  {groups.map((g) => (
                    <div key={g.base} role="group" aria-labelledby={`nhom-${g.base}`}
                      className={cn(g.base === wanted && "-mx-3 rounded-2xl bg-paprika-soft/70 p-3 shadow-[inset_0_0_0_1px_rgb(124_52_16/0.18)]")}>
                      <h3 id={`nhom-${g.base}`} className="mb-2 flex flex-wrap items-baseline gap-2 font-sans text-sm font-bold tracking-[.04em] text-muted-foreground uppercase">
                        {g.title}
                        <span className="tabular font-normal">({g.people.length})</span>
                        {g.base === wanted && <span className="rounded-full bg-paprika-ink px-2 py-0.5 text-xs font-semibold text-white">Vai trò bạn chọn</span>}
                      </h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {g.people.map((u) => {
                          const chef = u.roles.includes("head_chef")
                          // Thẻ gọn: tên + dòng vai trò. Bếp trưởng ghi "Bếp trưởng ca" màu paprika; vai trò kiêm ghi thêm phía sau.
                          const base = u.role_labels[u.roles.indexOf(g.base)] ?? u.role_labels[0]
                          const extra = extraRoles(u, g.base).filter((r) => !chef || r !== u.role_labels[u.roles.indexOf("head_chef")])
                          return (
                            <button
                              key={`${g.base}-${u.id}`}
                              type="button"
                              onClick={() => pick(u)}
                              className="flex min-h-[3.75rem] flex-col justify-center rounded-xl border border-border bg-card px-3.5 py-2 text-left transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-input/60 hover:shadow-soft active:scale-[0.98]"
                            >
                              <span className="block truncate text-[15px] leading-snug font-bold">{u.full_name}</span>
                              <span className="block truncate text-sm leading-snug text-muted-foreground">
                                {chef ? <b className="font-semibold text-paprika-ink">Bếp trưởng ca</b> : base}
                                {extra.length > 0 && `, ${extra.join(", ").toLowerCase()}`}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

/**
 * Về trang giới thiệu. Vừa đi từ đó sang thì lùi lịch sử (trang giới thiệu mở lại đúng chỗ đang đọc),
 * không thì mở trang mới. Rê chuột / focus là tải sẵn trang giới thiệu.
 */
function IntroLink() {
  const go = usePageTransition()
  const fromLanding = (useLocation().state as { from?: string } | null)?.from === "landing"
  return (
    <a
      href="/gioi-thieu"
      onMouseEnter={() => void preloadLanding()}
      onFocus={() => void preloadLanding()}
      onClick={(e) => {
        if (!plainClick(e)) return
        e.preventDefault()
        void go(fromLanding ? -1 : "/gioi-thieu", { page: "landing", back: true })
      }}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-stone-950/55 px-4 text-sm font-semibold text-stone-50 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] backdrop-blur-md transition-colors hover:bg-stone-950/75"
    >
      <ArrowLeft className="size-4" aria-hidden /> Trang giới thiệu
    </a>
  )
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm font-semibold text-critical-ink" role="alert">
      <AlertOctagon className="mt-0.5 size-4 shrink-0" aria-hidden /> {children}
    </p>
  )
}
