import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-[2px] focus-visible:outline-[var(--m3-primary)] focus-visible:outline-offset-2 focus-visible:ring-0 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-[0.38] aria-invalid:border-[var(--m3-error)] aria-invalid:ring-2 aria-invalid:ring-[var(--m3-error)]/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--m3-primary)] text-[var(--m3-on-primary)] border-transparent hover:bg-[#0A4EB8] shadow-sm hover:shadow-md focus-visible:outline-[var(--m3-primary)]",
        outline:
          "border-[var(--m3-outline)] bg-transparent text-[var(--m3-primary)] hover:bg-[rgba(11,87,208,0.08)] aria-expanded:bg-[rgba(11,87,208,0.12)] hover:border-[var(--m3-outline)]",
        secondary:
          "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)] border-transparent hover:bg-[rgba(29,27,32,0.08)]",
        ghost:
          "bg-transparent text-[var(--m3-primary)] border-transparent hover:bg-[rgba(11,87,208,0.08)] aria-expanded:bg-[rgba(11,87,208,0.12)]",
        destructive:
          "bg-[var(--m3-error)] text-[var(--m3-on-error)] border-transparent hover:bg-[#9F0E0E]",
        link: "text-[var(--m3-primary)] underline-offset-4 hover:underline border-transparent bg-transparent",
      },
      size: {
        default:
          "h-10 gap-2 px-6 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 text-[14px] leading-5 tracking-[0.1px]",
        xs: "h-7 gap-1.5 rounded-full px-3 text-xs",
        sm: "h-8 gap-1.5 rounded-full px-4 text-[14px]",
        lg: "h-12 gap-2 px-6 text-[14px]",
        icon: "size-10 rounded-full",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-12 rounded-full",
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
