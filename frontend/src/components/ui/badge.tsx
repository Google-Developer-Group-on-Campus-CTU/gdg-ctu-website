import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[8px] border px-3 py-0 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--m3-primary)]/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)] border-transparent",
        secondary:
          "bg-[var(--m3-surface-container-high)] text-[var(--m3-on-surface-variant)] border-[var(--m3-outline-variant)]",
        destructive:
          "bg-[var(--m3-error-container)] text-[var(--m3-on-error-container)] border-transparent",
        outline:
          "border-[var(--m3-outline)] text-[var(--m3-on-surface)] bg-transparent",
        ghost:
          "bg-transparent text-[var(--m3-on-surface-variant)] border-transparent",
        link: "text-[var(--m3-primary)] underline-offset-4 hover:underline border-transparent bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
