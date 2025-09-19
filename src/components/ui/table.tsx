import * as React from 'react'
import { cn } from '../../lib/cn'

type TableProps = React.TableHTMLAttributes<HTMLTableElement>
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>
type RowProps = React.HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean }
type ThProps = React.ThHTMLAttributes<HTMLTableCellElement>
type TdProps = React.TdHTMLAttributes<HTMLTableCellElement>

export const Table = ({ className, ...props }: TableProps) => (
  <div className="w-full overflow-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
)

Table.Header = ({ className, ...props }: SectionProps) => (
  <thead className={cn('border-b border-gray-200', className)} {...props} />
)

Table.Body = ({ className, ...props }: SectionProps) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
)

Table.Row = ({ className, hoverable = true, ...props }: RowProps) => (
  <tr
    className={cn(
      'border-b border-gray-200 transition-colors',
      hoverable && 'hover:bg-gray-50 dark:hover:bg-gray-800',
      className
    )}
    {...props}
  />
)

Table.Head = ({ className, ...props }: ThProps) => (
  <th
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-gray-700',
      'bg-gray-50 [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
)

Table.Cell = ({ className, ...props }: TdProps) => (
  <td className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
)

