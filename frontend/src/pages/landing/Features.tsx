import { BackspaceIcon, CheckIcon, EyeSlashIcon, LockKeyIcon, MagnifyingGlassIcon, PenNibIcon, ScalesIcon } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { IMG, Reveal } from "@/pages/landing/bits"

/**
 * Năm tính năng, đúng năm ô (Taste Skill: số ô = số nội dung). Ô ảnh cân, ô tối "sổ chỉ ghi thêm",
 * ô paprika có bàn phím PIN bấm thử được, ô ngưỡng hai tầng, ô dài phiếu điều tra kèm ảnh màn thật.
 * Số liệu lấy từ cấu hình mặc định của hệ thống (nhóm A: 2,5% và 25 g, 5% và 50 g; hạn xử lý 48 giờ).
 */
export function Features() {
  return (
    <section id="tinh-nang" aria-labelledby="tinh-nang-title" className="mx-auto max-w-[1320px] scroll-mt-16 px-4 py-24 sm:px-8 md:py-32">
      <Reveal>
        <h2 id="tinh-nang-title" className="m-0 max-w-[18ch] text-4xl leading-[1.05] font-bold tracking-[-.035em] md:text-5xl">
          Số liệu không dựa vào lời khai
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[minmax(250px,auto)] lg:grid-cols-4">
        {/* Đếm mù: ảnh cân thật làm nền, chữ trên lớp phủ tối ở đáy */}
        <Reveal className="relative min-h-[420px] overflow-hidden rounded-[28px] md:col-span-2 lg:row-span-2">
          <img src={`${IMG}/can-bep.webp`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_55%]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(19,17,16,.92)_8%,rgba(19,17,16,.55)_45%,rgba(19,17,16,0)_75%)]" />
          <div className="absolute inset-x-0 bottom-0 p-7 text-[#f3efe9] md:p-9">
            <EyeSlashIcon className="size-8 text-lp-accent" weight="duotone" aria-hidden />
            <h3 className="mt-3 mb-0 text-3xl font-bold tracking-[-.03em] md:text-4xl">Đếm mù</h3>
            <p className="mt-2 mb-0 max-w-[40ch] text-base leading-relaxed text-[#e7e2dc]">
              Màn cân trả và kiểm kê không hiện tồn sổ. Người cân chỉ nhập con số đọc được trên cân.
            </p>
          </div>
        </Reveal>

        {/* Sổ kho chỉ ghi thêm */}
        <Reveal delay={0.05} className="flex flex-col justify-between gap-6 rounded-[28px] bg-lp-deep p-7 text-lp-on-deep">
          <LockKeyIcon className="size-8 text-lp-accent" weight="duotone" aria-hidden />
          <div>
            <h3 className="m-0 text-2xl font-bold tracking-[-.02em]">Sổ kho chỉ ghi thêm</h3>
            <p className="mt-2 mb-3 text-[15px] leading-relaxed text-[#d6d3d1]">Muốn sửa thì ghi bút toán đảo. Database chặn cả quản lý:</p>
            <code className="block rounded-xl bg-white/[.07] px-3 py-2.5 font-mono text-[13px] leading-snug text-[#f3efe9]">
              UPDATE stock_txn ...<br /><span className="text-[#f5b48e]">bị trigger từ chối</span>
            </code>
          </div>
        </Reveal>

        {/* Ký PIN: bấm thử */}
        <Reveal delay={0.1} className="lg:row-span-2">
          <PinDemo />
        </Reveal>

        {/* Ngưỡng hai tầng */}
        <Reveal delay={0.05} className="flex flex-col justify-between gap-5 rounded-[28px] bg-lp-surface p-7 shadow-[0_0_0_1px_var(--lp-line)]">
          <ScalesIcon className="size-8 text-lp-accent-ink" weight="duotone" aria-hidden />
          <div>
            <h3 className="m-0 text-2xl font-bold tracking-[-.02em]">Ngưỡng hai tầng</h3>
            <dl className="m-0 mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-semibold text-lp-muted">Cảnh báo</dt>
                <dd className="m-0 font-display text-3xl font-bold tracking-[-.03em] tabular">2,5%</dd>
                <dd className="m-0 text-sm text-lp-muted">và quá 25 g</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-lp-muted">Phải giải trình</dt>
                <dd className="m-0 font-display text-3xl font-bold tracking-[-.03em] text-lp-accent-ink tabular">5%</dd>
                <dd className="m-0 text-sm text-lp-muted">và quá 50 g</dd>
              </div>
            </dl>
          </div>
        </Reveal>

        {/* Phiếu điều tra: ô dài, ảnh màn thật */}
        <Reveal className="grid overflow-hidden rounded-[28px] bg-lp-surface-2 md:col-span-2 lg:col-span-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col justify-center p-7 md:p-10">
            <MagnifyingGlassIcon className="size-8 text-lp-accent-ink" weight="duotone" aria-hidden />
            <h3 className="mt-3 mb-0 text-3xl font-bold tracking-[-.03em]">Lệch lớn thì có phiếu điều tra</h3>
            <p className="mt-3 mb-0 max-w-[46ch] text-base leading-relaxed text-lp-muted">
              Phiếu tự mở, ghi rõ ca và người ký nhận, kèm gợi ý nguyên nhân có bằng chứng. Quá 48 giờ chưa kết luận thì chuyển sang quá hạn.
            </p>
          </div>
          <div className="relative min-h-[260px] lg:min-h-[340px]">
            <img src={`${IMG}/man-quanly-dieutra.webp`} alt="Màn danh sách phiếu điều tra của quản lý, có hai phiếu đang mở và quá hạn" loading="lazy" decoding="async"
              className="absolute top-8 left-8 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-tl-[18px] object-cover object-[22%_0%] shadow-[0_24px_50px_-24px_rgba(41,37,36,.5),0_0_0_1px_var(--lp-line)] lg:top-10 lg:left-10 lg:h-[calc(100%-2.5rem)] lg:w-[calc(100%-2.5rem)]" />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"]

/** Bàn phím PIN thật (5 số như app): bấm đủ 5 số bất kỳ thì "ký" xong, sau một lúc tự xóa để thử lại. */
function PinDemo() {
  const reduce = useReducedMotion()
  const [pin, setPin] = useState("")
  const done = pin.length === 5
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setPin(""), 2600)
    return () => clearTimeout(t)
  }, [done])
  const press = (k: string) => {
    if (done) return
    if (k === "⌫") setPin((p) => p.slice(0, -1))
    else if (k) setPin((p) => (p.length < 5 ? p + k : p))
  }

  return (
    <div className="flex h-full flex-col gap-5 rounded-[28px] bg-lp-accent p-7 text-lp-on-accent">
      <PenNibIcon className="size-8" weight="duotone" aria-hidden />
      <div>
        <h3 className="m-0 text-2xl font-bold tracking-[-.02em]">Ký nhận bằng PIN</h3>
        <p className="mt-2 mb-0 text-[15px] leading-relaxed">Người nhận hàng tự nhập PIN trên chính máy đang dùng. Bấm thử 5 số bất kỳ.</p>
      </div>
      <div className="mt-auto">
        <div className="flex h-9 items-center justify-center gap-3" role="status" aria-live="polite" aria-label={done ? "Đã ký nhận" : `Đã nhập ${pin.length} trên 5 số`}>
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div key="ok" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-full bg-lp-on-accent px-4 py-1.5 text-sm font-bold text-lp-accent">
                <CheckIcon className="size-4" weight="bold" aria-hidden /> Đã ký nhận
              </motion.div>
            ) : (
              <motion.div key="dots" className="flex gap-3" exit={{ opacity: 0 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.span key={i} animate={{ scale: i < pin.length ? 1.15 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className={cn("size-3.5 rounded-full border-2 border-lp-on-accent", i < pin.length && "bg-lp-on-accent")} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {KEYS.map((k, i) => k ? (
            <button key={i} type="button" onClick={() => press(k)} aria-label={k === "⌫" ? "Xóa một số" : k}
              className="flex h-12 items-center justify-center rounded-full bg-white/35 font-display text-xl font-bold transition-[transform,background-color] duration-150 hover:bg-white/50 active:scale-[.94]">
              {k === "⌫" ? <BackspaceIcon className="size-5" aria-hidden /> : k}
            </button>
          ) : <span key={i} />)}
        </div>
      </div>
    </div>
  )
}
