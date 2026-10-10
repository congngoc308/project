import { ChefHatIcon, GithubLogoIcon, TerminalWindowIcon } from "@phosphor-icons/react"
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { useNavigationType } from "react-router-dom"

import { refitZoom } from "@/lib/fitZoom"
import { plainClick, savedLandingScroll } from "@/lib/pageTransition"
import { cn } from "@/lib/utils"
import { EnterButton, GhostButton, GITHUB, IMG, Reveal, useEnterLogin } from "@/pages/landing/bits"
import { Features } from "@/pages/landing/Features"
import { Journey } from "@/pages/landing/Journey"
import { Roles } from "@/pages/landing/Roles"

/**
 * Landing page giới thiệu hệ thống (Taste Skill, design-taste-frontend).
 * Design read: landing sản phẩm cho chủ quán / hội đồng chấm đồ án, ngôn ngữ "dụng cụ bếp chuyên nghiệp"
 * cùng thương hiệu với app, chuyển động vừa phải. Dials: DESIGN_VARIANCE 8, MOTION_INTENSITY 7, VISUAL_DENSITY 4.
 * Ảnh: ảnh chụp màn hình thật của hệ thống + ảnh Wikimedia Commons (nguồn ở chân trang).
 */
export function LandingPage() {
  useEffect(() => {
    const html = document.documentElement
    const title = document.title
    html.classList.add("landing")
    // Landing chạy ở tỉ lệ 1, rời trang thì app co giãn như cũ (tính ngay, kể cả giữa lúc chuyển trang).
    refitZoom()
    document.title = "Quản lý bếp: biết từng gam nguyên liệu đi đâu"
    return () => { html.classList.remove("landing"); refitZoom(); document.title = title }
  }, [])

  // Quay lại từ màn đăng nhập (nút Back hoặc "Trang giới thiệu"): về đúng chỗ đang đọc. Đặt lại sau một
  // nhịp vì phần "Hành trình" đo chiều cao xong mới đủ dài.
  const navType = useNavigationType()
  useLayoutEffect(() => {
    const y = navType === "POP" ? savedLandingScroll() : null
    if (y === null) return
    window.scrollTo({ top: y, behavior: "instant" })
    const t = setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 0)
    return () => clearTimeout(t)
  }, [navType])

  return (
    <div data-page="landing" className="min-h-[100dvh] bg-lp-bg font-sans text-lp-ink">
      <a href="#noi-dung" className="sr-only rounded-full bg-lp-surface px-5 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">Bỏ qua tới nội dung</a>
      <Nav />
      <main id="noi-dung" tabIndex={-1} className="outline-none">
        <Hero />
        <Stack />
        <Journey />
        <Manifesto />
        <Features />
        <Roles />
        <RunIt />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

/** Logo; bản trên thanh điều hướng mang tên "brand" để bay sang logo của màn đăng nhập. */
function Logo({ brand }: { brand?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" style={brand ? { viewTransitionName: "brand" } : undefined}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-lp-accent text-lp-on-accent shadow-[inset_0_-2px_0_rgba(28,25,23,.14)]">
        <ChefHatIcon className="size-6" weight="duotone" aria-hidden />
      </span>
      <span className="font-display text-lg font-bold tracking-[-.02em]">Quản lý bếp</span>
    </span>
  )
}

function Nav() {
  const links = [["#hanh-trinh", "Cách hoạt động"], ["#tinh-nang", "Tính năng"], ["#vai-tro", "Vai trò"]]
  return (
    <header className="sticky top-0 z-40 bg-lp-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-8">
        <a href="/gioi-thieu" aria-label="Quản lý bếp, về đầu trang" className="rounded-xl"
          onClick={(e) => { if (plainClick(e)) { e.preventDefault(); window.scrollTo({ top: 0 }) } }}><Logo brand /></a>
        <nav aria-label="Mục trên trang" className="hidden items-center gap-1 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-lp-muted transition-colors hover:bg-lp-surface hover:text-lp-ink">{label}</a>
          ))}
          <a href={GITHUB} target="_blank" rel="noreferrer" className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-lp-muted transition-colors hover:bg-lp-surface hover:text-lp-ink">Mã nguồn</a>
        </nav>
        <EnterButton className="h-11 px-5 text-[15px]" />
      </div>
    </header>
  )
}

const EASE = [0.16, 1, 0.3, 1] as const

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  // Cuộn xuống: ảnh màn hình trôi lên nhanh hơn ảnh bếp, tạo chiều sâu giữa "bếp thật" và "số liệu".
  const shotY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -110])
  const photoScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.08])
  const lines = ["Biết từng gam thịt bò", "đi đâu sau mỗi ca."]

  return (
    <section ref={ref} className="mx-auto grid max-w-[1320px] items-center gap-12 px-4 pt-8 pb-16 sm:px-8 lg:min-h-[calc(100dvh-68px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10 lg:pt-6 lg:pb-20">
      <div>
        <h1 className="m-0 text-[clamp(40px,4.4vw,68px)] leading-[1.04] font-bold tracking-[-.045em]">
          {lines.map((l, i) => (
            <span key={l} className="block overflow-hidden pb-[.08em] lg:whitespace-nowrap">
              <motion.span className="block" initial={reduce ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.05 + i * 0.1, ease: EASE }}>
                {i === 0 ? <>Biết <span className="text-lp-accent-ink">từng gam</span> thịt bò</> : l}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="mt-7 mb-0 max-w-[34ch] text-xl leading-relaxed text-lp-muted">
          So nguyên liệu thực dùng với định mức theo từng ca, từng người. Lệch lớn là phải giải trình.
        </motion.p>
        <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
          className="mt-10 flex flex-wrap gap-3">
          <EnterButton />
          <GhostButton href="#hanh-trinh">Xem cách hoạt động</GhostButton>
        </motion.div>
      </div>

      <div className="relative h-[min(72vw,520px)] lg:h-[min(70vh,640px)]">
        <motion.div initial={reduce ? false : { opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: EASE }}
          className="absolute top-0 right-0 h-[80%] w-[90%] overflow-hidden rounded-[28px] bg-lp-surface-2">
          <motion.img src={`${IMG}/bep-dem.webp`} alt="Gian bếp nhà hàng buổi tối, bếp trưởng đứng sau bàn sơ chế" fetchPriority="high" decoding="async"
            style={{ scale: photoScale }} className="h-full w-full object-cover object-[45%_50%]" />
        </motion.div>
        <motion.div style={{ y: shotY }} className="absolute bottom-0 left-0 w-[74%]">
          <motion.img src={`${IMG}/man-quanly-avt.webp`} alt="Báo cáo AvT của quản lý: lý thuyết, thực tế, chênh lệch theo từng nguyên liệu"
            initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.35, ease: EASE }}
            className="aspect-[16/10] w-full rounded-[18px] object-cover object-left-top shadow-[0_40px_80px_-30px_rgba(41,37,36,.6),0_0_0_1px_var(--lp-line)]" />
        </motion.div>
      </div>
    </section>
  )
}

const LOGOS = [
  ["react", "React"], ["typescript", "TypeScript"], ["vite", "Vite"], ["tailwindcss", "Tailwind CSS"],
  ["python", "Python"], ["fastapi", "FastAPI"], ["sqlalchemy", "SQLAlchemy"], ["postgresql", "PostgreSQL"], ["docker", "Docker"],
]

/** Dải logo công nghệ (marquee duy nhất của trang), tô một màu theo chữ để hợp cả nền sáng lẫn tối. */
function Stack() {
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden || undefined} className="m-0 flex shrink-0 list-none items-center gap-16 p-0 pr-16">
      {LOGOS.map(([slug, name]) => (
        <li key={slug}>
          <span role={hidden ? undefined : "img"} aria-label={hidden ? undefined : name} className="block size-9 bg-lp-muted"
            style={{ mask: `url(${IMG}/logo/${slug}.svg) center / contain no-repeat`, WebkitMask: `url(${IMG}/logo/${slug}.svg) center / contain no-repeat` }} />
        </li>
      ))}
    </ul>
  )
  return (
    <section aria-label="Công nghệ sử dụng" className="border-y border-lp-line py-9">
      <div className="mx-auto flex max-w-[1320px] items-center gap-10 px-4 sm:px-8">
        <p className="m-0 shrink-0 text-[15px] font-semibold text-lp-muted">Xây bằng</p>
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
          <div className="lp-marquee flex w-max">{row()}{row(true)}</div>
        </div>
      </div>
    </section>
  )
}

const MANIFESTO = "Không ai phải tự khai đã dùng bao nhiêu. Thủ kho cân, bếp trưởng cân lại, hệ thống tự so với công thức. Lệch ở ca nào, ai đã ký nhận, đều có tên."

/** Câu tuyên ngôn sáng dần theo nhịp cuộn: người đọc đọc đúng tốc độ mình cuộn. */
function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.5"] })
  const words = MANIFESTO.split(" ")
  const accentFrom = words.length - 3
  return (
    <section aria-label="Nguyên tắc" className="mx-auto max-w-[1320px] px-4 py-28 sm:px-8 md:py-40">
      <p ref={ref} className="m-0 max-w-[24ch] font-display text-[clamp(34px,4.6vw,68px)] leading-[1.08] font-bold tracking-[-.035em]">
        {words.map((w, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} still={!!reduce} accent={i >= accentFrom}>{w}</Word>
        ))}
      </p>
    </section>
  )
}

function Word({ children, progress, range, still, accent }: { children: string; progress: MotionValue<number>; range: [number, number]; still: boolean; accent: boolean }) {
  const opacity = useTransform(progress, range, [0, 1])
  const ink = accent ? "text-lp-accent-ink" : "text-lp-ink"
  if (still) return <><span className={ink}>{children}</span>{" "}</>
  return (
    <>
      <span className="relative inline-block">
        <span className="text-lp-dim">{children}</span>
        <motion.span aria-hidden style={{ opacity }} className={cn("absolute top-0 left-0", ink)}>{children}</motion.span>
      </span>{" "}
    </>
  )
}

/** Chạy thử trên máy: lệnh thật trong README, cùng vài con số có thật của dự án. */
function RunIt() {
  const facts = [
    ["18", "tiêu chí nghiệm thu, tiêu chí nào cũng có test tự động"],
    ["30", "ngày dữ liệu mẫu, 2 ca mỗi ngày, sẵn để trình diễn"],
    ["5", "vai trò: phục vụ, bếp, bếp trưởng, thủ kho, quản lý"],
    ["0", "lệnh sửa hay xóa được phép trên sổ kho"],
  ]
  return (
    <section aria-labelledby="chay-thu-title" className="bg-lp-surface-2">
      <div className="mx-auto grid max-w-[1320px] gap-14 px-4 py-24 sm:px-8 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <Reveal>
          <h2 id="chay-thu-title" className="m-0 text-4xl leading-[1.05] font-bold tracking-[-.035em] md:text-5xl">Chạy trên máy bạn trong vài phút</h2>
          <p className="mt-4 mb-0 max-w-[44ch] text-lg leading-relaxed text-lp-muted">Cần Docker. Hai lệnh dựng hệ thống và nạp 30 ngày dữ liệu mẫu.</p>
          <div className="mt-8 overflow-x-auto rounded-[18px] bg-lp-deep p-5 font-mono text-[14px] leading-7 text-lp-on-deep">
            <div className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-[#d6d3d1]"><TerminalWindowIcon className="size-5" aria-hidden /> Terminal</div>
            <div><span className="text-lp-accent select-none">$ </span>docker compose up -d --build</div>
            <div><span className="text-lp-accent select-none">$ </span>docker compose exec api python -m seed.demo</div>
          </div>
        </Reveal>
        <dl className="m-0 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {facts.map(([n, t], i) => (
            <Reveal key={n} delay={i * 0.06} className="border-t border-lp-line py-7">
              <dt className="font-display text-[clamp(56px,6vw,88px)] leading-none font-bold tracking-[-.05em] tabular">{n}</dt>
              <dd className="m-0 mt-3 max-w-[30ch] text-base leading-relaxed text-lp-muted">{t}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8 md:py-32">
      <div className="on-dark relative overflow-hidden rounded-[28px] bg-[#131110]">
        {/* data-vt-photo: bấm "Vào hệ thống" ở đây thì ảnh này bay sang nửa trái màn đăng nhập (cùng ảnh) */}
        <img data-vt-photo src="/img/bep-lua.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_45%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(19,17,16,.94)_15%,rgba(19,17,16,.7)_55%,rgba(19,17,16,.25))]" />
        <Reveal className="relative px-7 py-16 md:px-14 md:py-24">
          <h2 id="cta-title" className="m-0 max-w-[16ch] text-[clamp(38px,4.8vw,68px)] leading-[1.04] font-bold tracking-[-.04em] text-[#f3efe9]">Bắt đầu từ ca làm việc tiếp theo</h2>
          <p className="mt-5 mb-0 max-w-[40ch] text-lg leading-relaxed text-[#e7e2dc]">Đăng nhập bằng tài khoản demo, chọn vai trò và thử trọn một ca.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <EnterButton morphPhoto />
            <GhostButton href={GITHUB} external className="text-[#f3efe9] shadow-[inset_0_0_0_1.5px_rgba(243,239,233,.7)] hover:bg-white/10">
              <GithubLogoIcon className="size-5" aria-hidden /> Xem mã nguồn
            </GhostButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function FooterEnter() {
  const enter = useEnterLogin()
  return (
    <a href={enter.href()} onMouseEnter={enter.prefetch} onFocus={enter.prefetch} onClick={(e) => enter.onClick(e)}
      className="inline-block rounded-lg py-1.5 hover:text-lp-accent-ink">{enter.me ? "Tiếp tục làm việc" : "Vào hệ thống"}</a>
  )
}

const CREDITS = [
  ["Gian bếp buổi tối", "Takeaway", "CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Chiang_Mai_restaurant_kitchen.JPG"],
  ["Thịt bò thái lát", "J. Samuel Burner", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Raw_beef_slices.jpg"],
  ["Cân điện tử nhà bếp", "Jacek Halicki", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:2023_Elektroniczna_waga_kuchenna.jpg"],
  ["Chảo lửa", "romainguy", "CC BY-SA 2.0", "https://commons.wikimedia.org/wiki/File:Wok_cooking_and_fire_by_romainguy.jpg"],
]

function Footer() {
  return (
    <footer className="border-t border-lp-line">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 mb-0 max-w-[44ch] text-[15px] leading-relaxed text-lp-muted">
            Hệ thống quản lý vận hành bếp: so thực tế với lý thuyết, quy trách nhiệm theo ca, buộc giải trình khi lệch lớn. Đồ án theo bản mô tả v1.5.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px] font-semibold">
            <li><FooterEnter /></li>
            <li><a href={GITHUB} target="_blank" rel="noreferrer" className="inline-block rounded-lg py-1.5 hover:text-lp-accent-ink">Mã nguồn trên GitHub</a></li>
            <li><a href={`${GITHUB}#readme`} target="_blank" rel="noreferrer" className="inline-block rounded-lg py-1.5 hover:text-lp-accent-ink">Hướng dẫn cài đặt</a></li>
          </ul>
          <details className="text-sm text-lp-muted">
            <summary className="rounded-lg py-1.5 text-[15px] font-semibold text-lp-ink">Nguồn ảnh</summary>
            <p className="mt-2 mb-2">Ảnh màn hình chụp từ chính hệ thống. Ảnh chụp lấy từ Wikimedia Commons:</p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {CREDITS.map(([what, who, lic, url]) => (
                <li key={url}><a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-lp-ink">{what}</a>, {who}, {lic}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </footer>
  )
}
