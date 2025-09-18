import * as React from 'react'
import { cn } from '../../lib/cn'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[96px] w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm',
          'text-gray-900 dark:text-gray-100',
          'placeholder:text-gray-500 dark:placeholder:text-gray-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-200',
          error && 'border-red-500 dark:border-red-400 focus-visible:ring-red-500 dark:focus-visible:ring-red-400',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
