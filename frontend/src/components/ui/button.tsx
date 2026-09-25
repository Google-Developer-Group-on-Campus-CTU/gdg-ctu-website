import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// M3 button hierarchy (docs/admin-material3-design.md §4.2).
// Filled = one primary per view · Tonal (secondary) = secondary action ·
// Outlined = neutral/cancel · Text (ghost) = tertiary/row actions ·
// Elevated = rare floating-over-content · Destructive (filled error) =
// dialog confirm ONLY, never standalone. Dense 40px (size default) is the
// project extension for toolbar-inline buttons — hit area stays 48x48 via
// ::after expansion. M3 medium 56px (size lg) for primary form/page actions.
// State layers (color-mix) only — no hover-elevation. Disabled opacity 0.38.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full border text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-[3px] focus-visible:outline-[var(--m3-primary)] focus-visible:outline-offset-2 focus-visible:ring-0 active:not-aria-[haspopup]:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-[0.38] aria-invalid:border-[var(--m3-error)] aria-invalid:ring-2 aria-invalid:ring-[var(--m3-error)]/20 after:absolute after:-inset-1 after:rounded-full after:content-[''] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--m3-primary)] text-[var(--m3-on-primary)] border-transparent hover:bg-[color-mix(in_srgb,var(--m3-primary)_92%,var(--m3-on-primary))] focus-visible:outline-[var(--m3-primary)]",
        outline:
          "border-[var(--m3-outline)] bg-transparent text-[var(--m3-on-surface)] hover:bg-[color-mix(in_srgb,var(--m3-primary)_8%,transparent)] aria-expanded:bg-[color-mix(in_srgb,var(--m3-primary)_12%,transparent)] hover:border-[var(--m3-outline)]",
        secondary:
          "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)] border-transparent hover:bg-[color-mix(in_srgb,var(--m3-secondary-container)_92%,var(--m3-on-secondary-container))]",
        ghost:
          "bg-transparent text-[var(--m3-primary)] border-transparent hover:bg-[color-mix(in_srgb,var(--m3-primary)_8%,transparent)] aria-expanded:bg-[color-mix(in_srgb,var(--m3-primary)_12%,transparent)]",
        elevated:
          "bg-[var(--m3-surface-container-low)] text-[var(--m3-primary)] border-transparent shadow-[var(--m3-elevation-1)] hover:bg-[color-mix(in_srgb,var(--m3-surface-container-low)_92%,var(--m3-primary))]",
        destructive:
          "bg-[var(--m3-error)] text-[var(--m3-on-error)] border-transparent hover:bg-[color-mix(in_srgb,var(--m3-error)_92%,var(--m3-on-error))]",
        link: "text-[var(--m3-primary)] underline-offset-4 hover:underline border-transparent bg-transparent after:content-none",
      },
      size: {
        default:
          "h-10 gap-2 px-6 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 text-[14px] leading-5 tracking-[0.1px]",
        xs: "h-7 gap-1.5 rounded-full px-3 text-xs after:content-none",
        sm: "h-8 gap-1.5 rounded-full px-4 text-[14px]",
        lg: "h-14 gap-2 px-6 text-[14px]",
        icon: "size-10 rounded-full",
        "icon-xs": "size-7 rounded-full after:-inset-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-full after:-inset-2",
        "icon-lg": "size-12 rounded-full after:content-none",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
