import * as React from 'react'
import { forwardRef } from 'react'
// Prefer static import; if module missing fallback to minimal combiner
import { cva as cvaReal } from 'class-variance-authority'
const cva: any = cvaReal || ((base: string, opts: any) => (args: any) => {
  const v = args?.variant ?? opts.defaultVariants?.variant
  const s = args?.size ?? opts.defaultVariants?.size
  const cls = [base, v && opts.variants.variant[v], s && opts.variants.size[s], args?.className]
  return cls.filter(Boolean).join(' ')
})
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 disabled:pointer-events-none disabled:opacity-50 active:scale-95 leading-none',
  {
    variants: {
      variant: {
        // Design system: Printful×SUZURI×Etsy
        primary:
          'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-soft hover:shadow-medium',
        secondary:
          'bg-white text-primary-600 border-2 border-primary-200 hover:bg-primary-50 active:bg-primary-100',
        success:
          'bg-success text-white hover:bg-green-600 active:bg-green-700 shadow-soft hover:shadow-medium',
        danger:
          'bg-error text-white hover:bg-red-600 active:bg-red-700 shadow-soft hover:shadow-medium',
        ghost:
          'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200',
        link:
          'text-primary-600 dark:text-primary-400 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-10 px-4 text-sm font-semibold',
        md: 'h-12 px-6 text-base font-semibold',
        lg: 'h-14 px-8 text-lg font-bold',
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
