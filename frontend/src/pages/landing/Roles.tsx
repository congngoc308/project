import { ArrowRightIcon, ChefHatIcon, ForkKnifeIcon, PackageIcon, PresentationChartIcon, type Icon } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState } from "react"

import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"
import { IMG, Reveal, useEnterLogin } from "@/pages/landing/bits"

/**
 * Mỗi vai trò một màn riêng, ảnh chụp từ chính hệ thống. Màn rộng: dải ảnh co giãn (accordion), bấm
 * một dải để mở; chữ mô tả nằm dưới dải, không đè lên ảnh. Màn hẹp: thẻ xếp dọc.
 */
const ROLES: { name: string; group: Role; icon: Icon; img: string; alt: string; title: string; text: string }[] = [
  {
    name: "Phục vụ", group: "server", icon: ForkKnifeIcon, img: "man-phucvu", alt: "Màn đặt món của phục vụ, nền tím than, ô món có ảnh",
    title: "Đặt món theo bàn, biết ngay món nào hết", text: "Món hết nguyên liệu tự khóa kèm lý do. Bếp làm xong thì máy phục vụ kêu chuông.",
  },
  {
    name: "Bếp", group: "kitchen", icon: ChefHatIcon, img: "man-bep", alt: "Màn danh sách món của bếp với phiếu món theo bàn",
    title: "Phiếu món theo ba cột, trễ là đỏ", text: "Bấm Bắt đầu nấu thì kho trừ theo công thức. Hủy hay làm lại món đang nấu cần PIN bếp trưởng.",
  },
  {
    name: "Thủ kho", group: "storekeeper", icon: PackageIcon, img: "man-thukho-bangiao", alt: "Màn bàn giao Kho sang Bếp của thủ kho với bàn phím số lớn",
    title: "Cân, bàn giao, kiểm kê trên một màn", text: "Bàn phím số lớn, gõ được bằng bàn phím. Cân trả và kiểm kê luôn là cân mù.",
  },
  {
    name: "Quản lý", group: "manager", icon: PresentationChartIcon, img: "man-quanly-tongquan", alt: "Màn tổng quan của quản lý với các việc cần xử lý ngay",
    title: "Thấy ngay việc cần xử lý", text: "Chênh lệch theo tiền, phiếu điều tra quá hạn, cảnh báo xu hướng, báo cáo AvT xuất Excel.",
  },
]

export function Roles() {
  const [active, setActive] = useState(1)
  const reduce = useReducedMotion()
  const r = ROLES[active]
  return (
    <section id="vai-tro" aria-labelledby="vai-tro-title" className="mx-auto max-w-[1320px] scroll-mt-16 px-4 py-24 sm:px-8 md:py-32">
      <Reveal>
        <h2 id="vai-tro-title" className="m-0 max-w-[20ch] text-4xl leading-[1.05] font-bold tracking-[-.035em] md:text-5xl">
          Mỗi vai trò một màn, vừa đủ việc
        </h2>
      </Reveal>

      {/* Màn rộng: dải ảnh co giãn */}
      <div className="mt-12 hidden lg:block">
        <div className="flex h-[min(62vh,600px)] gap-3" role="group" aria-label="Chọn vai trò">
          {ROLES.map((x, i) => {
            const on = i === active
            return (
              <button key={x.name} type="button" aria-pressed={on} onClick={() => setActive(i)}
                className={cn("group relative flex min-w-[112px] basis-0 flex-col overflow-hidden rounded-[28px] text-left transition-[flex-grow,background-color] duration-700 ease-[cubic-bezier(.16,1,.3,1)]",
                  on ? "grow-[7] bg-lp-surface shadow-[0_30px_60px_-34px_rgba(41,37,36,.55),0_0_0_1px_var(--lp-line)]" : "grow bg-lp-surface-2 hover:bg-lp-surface")}>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <img src={`${IMG}/${x.img}.webp`} alt={on ? x.alt : ""} loading="lazy" decoding="async" draggable={false}
                    className={cn("absolute top-0 left-0 h-full w-[min(1100px,72vw)] max-w-none object-cover object-left-top transition-[opacity,filter] duration-700",
                      on ? "opacity-100" : "opacity-70 grayscale group-hover:opacity-90")} />
                </div>
                <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
                  <x.icon className={cn("size-6 shrink-0", on && "text-lp-accent-ink")} weight="duotone" aria-hidden />
                  <span className="text-base font-bold whitespace-nowrap">{x.name}</span>
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-8 min-h-[96px]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={r.name} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="max-w-[62ch]">
              <h3 className="m-0 text-2xl font-bold tracking-[-.02em]">{r.title}</h3>
              <p className="mt-2 mb-0 text-lg leading-relaxed text-lp-muted">{r.text}</p>
              <RoleEnter name={r.name} group={r.group} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Màn hẹp: thẻ dọc */}
      <ul className="m-0 mt-10 grid list-none gap-8 p-0 md:grid-cols-2 lg:hidden">
        {ROLES.map((x) => (
          <li key={x.name}>
            <img src={`${IMG}/${x.img}.webp`} alt={x.alt} loading="lazy" decoding="async"
              className="aspect-[16/10] w-full rounded-[18px] object-cover object-left-top shadow-[0_0_0_1px_var(--lp-line)]" />
            <div className="mt-4 flex items-center gap-2 font-bold text-lp-accent-ink"><x.icon className="size-5" weight="duotone" aria-hidden />{x.name}</div>
            <h3 className="mt-1 mb-0 text-2xl font-bold tracking-[-.02em]">{x.title}</h3>
            <p className="mt-2 mb-0 text-base leading-relaxed text-lp-muted">{x.text}</p>
            <RoleEnter name={x.name} group={x.group} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Vào thẳng màn đăng nhập, nhóm của vai trò này nằm đầu danh sách. Đã đăng nhập thì không hiện. */
function RoleEnter({ name, group }: { name: string; group: Role }) {
  const enter = useEnterLogin()
  if (enter.me) return null
  return (
    <a href={enter.href(group)} onMouseEnter={enter.prefetch} onFocus={enter.prefetch} onClick={(e) => enter.onClick(e, group)}
      className="group/re mt-3 inline-flex min-h-11 items-center gap-2 rounded-full font-bold text-lp-accent-ink underline decoration-2 underline-offset-4">
      Vào hệ thống với vai trò {name}
      <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover/re:translate-x-1" weight="bold" aria-hidden />
    </a>
  )
}
