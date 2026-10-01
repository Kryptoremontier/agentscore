import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// Etap 6b: one primary style everywhere (globals.css .btn-primary — paper fill, ink text, 2px
// corners, ≥ 44px) and an outline secondary in the same shape (.btn-secondary). The rest keep
// their soft shape; every variant shows the accent focus ring.
const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ring-offset-background'
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'btn-primary',
        destructive: `rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 ${RING}`,
        outline: 'btn-secondary',
        secondary: `rounded-md bg-white/10 text-text-primary hover:bg-white/20 ${RING}`,
        ghost: `rounded-md hover:bg-white/10 hover:text-text-primary ${RING}`,
        link: `text-primary underline-offset-4 hover:underline ${RING}`,
      },
      size: {
        default: 'h-11 px-6',
        sm: 'h-9 px-3',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
