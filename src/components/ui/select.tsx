import * as React from 'react'
import { cn } from '../../lib/cn'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => (
    <select
      className={cn(
        'flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm',
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
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm',
        'text-gray-900 dark:text-gray-100',
        'placeholder:text-gray-500 dark:placeholder:text-gray-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors duration-200',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
)
SelectTrigger.displayName = 'SelectTrigger'

interface SelectValueProps {
  placeholder?: string
}

const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => (
  <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
)

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-lg border bg-white text-gray-900 shadow-soft',
        'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
)
SelectContent.displayName = 'SelectContent'

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-3 pr-2 text-sm outline-none',
        'focus:bg-gray-100 focus:text-gray-900 dark:focus:bg-gray-700 dark:focus:text-gray-100',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
)
SelectItem.displayName = 'SelectItem'

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
