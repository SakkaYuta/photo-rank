import * as React from 'react'
import { cn } from '../../lib/cn'

type DivProps = React.HTMLAttributes<HTMLDivElement>

export const Card = ({ className, ...props }: DivProps & { hoverable?: boolean }) => {
  const { hoverable, ...rest } = props as any
  return (
    <div
      className={cn('bg-white rounded-xl shadow-soft', hoverable && 'hover:shadow-large transition-shadow duration-300', className)}
      {...rest}
    />
  )
}

Card.Header = ({ className, ...props }: DivProps) => (
  <div className={cn('px-6 py-4 border-b border-gray-200', className)} {...props} />
)

Card.Body = ({ className, ...props }: DivProps) => (
  <div className={cn('p-6', className)} {...props} />
)

Card.Footer = ({ className, ...props }: DivProps) => (
  <div className={cn('px-6 py-4 border-t border-gray-200', className)} {...props} />
)

// Export individual components for better compatibility
export const CardHeader = ({ className, ...props }: DivProps) => (
  <div className={cn('px-6 py-4 border-b border-gray-200', className)} {...props} />
)

export const CardContent = ({ className, ...props }: DivProps) => (
  <div className={cn('p-6', className)} {...props} />
)

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
)

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-gray-600', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: DivProps) => (
  <div className={cn('px-6 py-4 border-t border-gray-200', className)} {...props} />
)

