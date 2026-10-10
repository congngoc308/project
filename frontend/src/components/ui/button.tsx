import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none transition-[background-color,box-shadow,transform,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(28_25_23/0.12),0_1px_2px_rgb(28_25_23/0.08)] hover:bg-[var(--primary-hover)] disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none disabled:opacity-100",
        ink: "bg-ink text-ink-foreground shadow-[0_1px_2px_rgb(28_25_23/0.2)] hover:bg-ink/90",
        danger: "bg-destructive text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:bg-destructive/90 disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none disabled:opacity-100",
        outline:
          "border-border bg-card shadow-[0_1px_2px_rgb(28_25_23/0.06)] hover:border-input/60 hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary",
        ghost:
          "font-medium hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-[3px]",
      },
      size: {
        default:
          "h-10 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-8 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 rounded-lg px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xl: "h-12 gap-2 rounded-xl px-4 text-base [&_svg:not([class*='size-'])]:size-5",
        touch: "h-14 gap-2 rounded-xl px-5 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10",
        "icon-xs":
          "size-8 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-9 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
