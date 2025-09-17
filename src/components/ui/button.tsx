import * as React from 'react'
import { forwardRef } from 'react'
// If class-variance-authority is available, use it. Otherwise, fall back to a minimal variant combiner.
let cva: any
try {
  // @ts-ignore
  cva = (await import('class-variance-authority')).cva
} catch {
  cva = (base: string, opts: any) => (args: any) => {
    const v = args?.variant ?? opts.defaultVariants?.variant
    const s = args?.size ?? opts.defaultVariants?.size
    const cls = [base, v && opts.variants.variant[v], s && opts.variants.size[s], args?.className]
    return cls.filter(Boolean).join(' ')
  }
}
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-soft hover:shadow-medium',
        secondary: 'bg-white text-primary-600 border-2 border-primary-200 hover:bg-primary-50',
        success: 'bg-success text-white hover:bg-green-600 shadow-soft',
        danger: 'bg-error text-white hover:bg-red-600 shadow-soft',
        ghost: 'hover:bg-gray-100 hover:text-gray-900',
        link: 'text-primary-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-6',
        lg: 'h-13 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)

Button.displayName = 'Button'

