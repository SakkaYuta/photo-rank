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
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 shadow-soft hover:shadow-medium',
        secondary: 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border-2 border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-gray-700',
        success: 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 shadow-soft',
        danger: 'bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 shadow-soft',
        ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 text-gray-700 dark:text-gray-300',
        link: 'text-primary-600 dark:text-primary-400 underline-offset-4 hover:underline',
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
