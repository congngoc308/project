import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, AnimatePresence } from "motion/react"
import { useLayoutEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { IMG, useMediaQuery } from "@/pages/landing/bits"

/**
 * "Hành trình 1 kg thịt bò": đúng kịch bản AC-11 của hệ thống (1.000 g bàn giao, 5 suất bò xào × 20 g,
 * cân trả 0 g, lệch 900 g = 225.000 đ, mở phiếu điều tra). Màn rộng: cuộn dọc kéo các bước trượt ngang,
 * số "Sổ nói / Cân nói" đổi theo bước. Màn hẹp hoặc giảm chuyển động: xếp dọc, không ghim.
 */
type Step = {
  verb: string
  title: string
  text: string
  img?: { src: string; alt: string; shot?: boolean; pos?: string }
  book: string
  scale: string
}

const STEPS: Step[] = [
  {
    verb: "Nhập kho", title: "Hàng về, thủ kho cân 1.000 g",
    text: "Phiếu nhập ghi số đặt, số thực nhận và đơn giá 250.000 đ/kg. Tồn Kho tăng ngay khi xác nhận.",
    img: { src: `${IMG}/bo-thai.webp`, alt: "Đĩa thịt bò thái lát mỏng" },
    book: "Kho 1.000 g", scale: "1.000 g",
  },
  {
    verb: "Bàn giao đầu ca", title: "Bếp trưởng cân lại rồi ký PIN",
    text: "Bếp trưởng tự cân lại mà không thấy số thủ kho đã cân. Ký xong, 1.000 g thuộc trách nhiệm của ca.",
    img: { src: `${IMG}/man-thukho-bangiao.webp`, alt: "Màn bàn giao Kho sang Bếp: danh sách nguyên liệu và bàn phím số", shot: true },
    book: "Bếp 1.000 g", scale: "1.000 g",
  },
  {
    verb: "Nấu và bán", title: "5 suất bò xào, mỗi suất 20 g",
    text: "Mỗi lần bấm Bắt đầu nấu, hệ thống trừ đúng định lượng trong công thức. Cả ca dùng theo lý thuyết 100 g.",
    img: { src: `${IMG}/man-bep.webp`, alt: "Màn danh sách món của bếp với ba cột Chờ nấu, Đang nấu, Vừa ra món", shot: true },
    book: "Bếp 900 g", scale: "chưa cân",
  },
  {
    verb: "Cân trả cuối ca", title: "Cân mù: còn 0 g",
    text: "Màn cân trả không hiện tồn sổ. Thủ kho nhập đúng số trên cân, ca đóng lại.",
    img: { src: `${IMG}/can-bep.webp`, alt: "Cân điện tử nhà bếp đang hiện 314 g", pos: "50% 60%" },
    book: "Bếp 900 g", scale: "0 g",
  },
  {
    verb: "Chênh lệch", title: "Thiếu 900 g, tức 225.000 đ",
    text: "Vượt mức bắt buộc giải trình. Phiếu điều tra tự mở, gắn với ca và người đã ký nhận, hạn xử lý 48 giờ.",
    book: "Lệch 900 g", scale: "0 g",
  },
]

const CAUSES = ["Thất thoát trong ca", "Nhập sai", "Hao hụt chưa ghi", "Quá tay", "Công thức sai"]

export function Journey() {
  const reduce = useReducedMotion()
  const wide = useMediaQuery("(min-width: 1024px)")
  return (
    <section id="hanh-trinh" aria-labelledby="hanh-trinh-title" className="scroll-mt-16">
      {wide && !reduce ? <JourneyPan /> : <JourneyStack />}
    </section>
  )
}

function Heading({ className }: { className?: string }) {
  return (
    <h2 id="hanh-trinh-title" className={cn("m-0 text-4xl leading-[1.05] font-bold tracking-[-.035em] md:text-5xl", className)}>
      Hành trình của 1 kg thịt bò
    </h2>
  )
}

function StepVisual({ s, className }: { s: Step; className?: string }) {
  if (!s.img) return <Verdict className={className} />
  return (
    <div className={cn("overflow-hidden bg-lp-surface-2", s.img.shot ? "rounded-[18px] shadow-[0_30px_60px_-30px_rgba(41,37,36,.5),0_0_0_1px_var(--lp-line)]" : "rounded-[28px]", className)}>
      <img src={s.img.src} alt={s.img.alt} loading="lazy" decoding="async" draggable={false}
        className={cn("h-full w-full object-cover", s.img.shot && "object-left-top")} style={{ objectPosition: s.img.pos }} />
    </div>
  )
}

/** Bước cuối không có ảnh: con số lệch là hình. */
function Verdict({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col justify-between gap-6 rounded-[28px] bg-lp-deep p-8 text-lp-on-deep md:p-10", className)}>
      <div>
        <div className="font-display text-[clamp(64px,9vw,128px)] leading-[.9] font-bold tracking-[-.05em] text-lp-accent tabular">-900 g</div>
        <div className="mt-3 font-display text-3xl font-bold tracking-[-.02em] tabular">225.000 đ</div>
      </div>
      <div>
        <div className="mb-3 text-sm font-semibold text-[#d6d3d1]">Hệ thống gợi ý nguyên nhân, quản lý kết luận</div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {CAUSES.map((c, i) => (
            <li key={c} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", i === 0 ? "bg-lp-accent text-lp-on-accent" : "bg-white/10 text-lp-on-deep")}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function JourneyPan() {
  const section = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [dist, setDist] = useState(0)
  const [step, setStep] = useState(0)

  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => setDist(Math.max(0, el.scrollWidth - window.innerWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    return () => { ro.disconnect(); window.removeEventListener("resize", measure) }
  }, [])

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] })
  const x = useTransform(scrollYProgress, (p) => -p * dist)
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const s = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))
    setStep((prev) => (prev === s ? prev : s))
  })
  const cur = STEPS[step]

  return (
    <div ref={section} className="relative" style={{ height: `calc(100dvh + ${dist}px)` }}>
      <div className="sticky top-0 flex h-[100dvh] flex-col overflow-hidden pt-[92px] pb-8">
        <div className="mx-auto flex w-full max-w-[1320px] items-end justify-between gap-8 px-8">
          <Heading />
          {/* Sổ nói / Cân nói: hai con số đổi theo bước, cho thấy chênh lệch sinh ra ở đâu. */}
          <div className="flex shrink-0 gap-8" aria-live="polite">
            <Readout label="Sổ nói" value={cur.book} />
            <Readout label="Cân nói" value={cur.scale} accent={step === STEPS.length - 1} />
          </div>
        </div>
        <div className="mx-auto mt-5 h-[3px] w-full max-w-[1320px] px-8">
          <motion.div className="h-full origin-left rounded-full bg-lp-accent" style={{ scaleX: scrollYProgress }} />
        </div>

        <motion.div ref={track} style={{ x }} className="mt-6 flex min-h-0 flex-1 items-stretch gap-8 pl-[max(2rem,calc((100vw-1320px)/2+2rem))]">
          {STEPS.map((s) => (
            <article key={s.verb} className="grid h-full w-[min(78vw,1080px)] shrink-0 grid-cols-[minmax(0,.9fr)_minmax(0,1.4fr)] items-center gap-10">
              <div>
                <div className="font-display text-lg font-bold text-lp-accent-ink">{s.verb}</div>
                <h3 className="mt-3 mb-0 text-4xl leading-[1.08] font-bold tracking-[-.03em] xl:text-5xl">{s.title}</h3>
                <p className="mt-5 mb-0 max-w-[42ch] text-lg leading-relaxed text-lp-muted">{s.text}</p>
              </div>
              <StepVisual s={s} className="h-full max-h-[min(62vh,640px)] w-full" />
            </article>
          ))}
          {/* Khoảng thở sau bước cuối (scrollWidth không tính padding phải của flex) */}
          <div aria-hidden className="w-[6vw] shrink-0" />
        </motion.div>
      </div>
    </div>
  )
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[150px] text-right">
      <div className="text-sm font-semibold text-lp-muted">{label}</div>
      <div className="relative h-10 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={value} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className={cn("font-display text-[32px] leading-10 font-bold tracking-[-.03em] tabular", accent && "text-lp-accent-ink")}>
            {value}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function JourneyStack() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-8">
      <Heading />
      <ol className="m-0 mt-10 flex list-none flex-col gap-14 p-0">
        {STEPS.map((s, i) => (
          <li key={s.verb} className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <div className="font-display text-lg font-bold text-lp-accent-ink">{i + 1}. {s.verb}</div>
              <h3 className="mt-2 mb-0 text-3xl leading-[1.1] font-bold tracking-[-.03em]">{s.title}</h3>
              <p className="mt-3 mb-0 max-w-[60ch] text-base leading-relaxed text-lp-muted">{s.text}</p>
              <div className="mt-3 text-sm font-semibold tabular">Sổ nói: {s.book}. Cân nói: {s.scale}.</div>
            </div>
            <StepVisual s={s} className={s.img ? "aspect-[16/10] w-full" : "w-full"} />
          </li>
        ))}
      </ol>
    </div>
  )
}
