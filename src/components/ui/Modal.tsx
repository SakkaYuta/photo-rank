import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  initialFocusSelector?: string
  initialFocusRef?: React.RefObject<HTMLElement>
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
  initialFocusSelector,
  initialFocusRef
}) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  }
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Simple focus trap within the modal panel
  React.useEffect(() => {
    if (!isOpen) return
    const panel = panelRef.current
    if (!panel) return
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    const preferred =
      initialFocusRef?.current ||
      (initialFocusSelector ? panel.querySelector<HTMLElement>(initialFocusSelector) || undefined : undefined) ||
      panel.querySelector<HTMLElement>('[data-autofocus],[data-close]') ||
      undefined
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (preferred) preferred.focus()
    else if (first) first.focus()
    else panel.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (focusables.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || active === panel) {
          e.preventDefault()
          ;(last || first)?.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          ;(first || last)?.focus()
        }
      }
    }

    panel.addEventListener('keydown', handleKeyDown)
    return () => panel.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full mx-4',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700',
          'rounded-xl shadow-lg',
          'transition-colors duration-200 fade-in',
          sizeClasses[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className={cn(
                'p-1 rounded-md',
                'text-gray-400 dark:text-gray-500',
                'hover:text-gray-600 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
              )}
              aria-label="閉じる"
              data-close
              data-autofocus
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Close button (when no title) */}
        {!title && (
          <button
            onClick={onClose}
            className={cn(
              'absolute top-4 right-4 p-1 rounded-md',
              'text-gray-400 dark:text-gray-500',
              'hover:text-gray-600 dark:hover:text-gray-300',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
            )}
            aria-label="閉じる"
            data-close
            data-autofocus
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div className="p-6 text-gray-700 dark:text-gray-300">
          {children}
        </div>
      </div>
    </div>
  )
}

// Modal parts for composition
export const ModalHeader: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn(
    'px-6 py-4',
    'border-b border-gray-200 dark:border-gray-700',
    'text-gray-900 dark:text-gray-100',
    className
  )}>
    {children}
  </div>
)

export const ModalBody: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn(
    'p-6',
    'text-gray-700 dark:text-gray-300',
    className
  )}>
    {children}
  </div>
)

export const ModalFooter: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn(
    'px-6 py-4',
    'border-t border-gray-200 dark:border-gray-700',
    'text-gray-700 dark:text-gray-300',
    'flex justify-end gap-3',
    className
  )}>
    {children}
  </div>
)

export default Modal
