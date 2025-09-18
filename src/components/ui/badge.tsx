import * as React from 'react'
import { cn } from '../../lib/cn'

type BadgeVariant =
  | 'pending'
  | 'active'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'

const badgeVariants: Record<BadgeVariant, string> = {
  // Status-like
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
  suspended: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  // Generic
  default: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-700',
  secondary: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 border-secondary-200 dark:border-secondary-700',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
}

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
  size?: 'sm' | 'md' | 'lg'
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className, children, size = 'sm', ...props }) => {
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        badgeVariants[variant] || badgeVariants.default,
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
