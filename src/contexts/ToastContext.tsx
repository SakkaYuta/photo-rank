import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'

type Toast = {
  id: string
  title?: string
  message: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
}

type ToastContextType = {
  showToast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const defaultDur: Record<NonNullable<Toast['variant']>, number> = {
      default: 3000, success: 2500, warning: 3500, error: 6000
    }
    const variant = (t.variant || 'default') as NonNullable<Toast['variant']>
    const toast: Toast = { id, duration: t.duration ?? defaultDur[variant], variant, ...t }
    setToasts(prev => [...prev, toast])
    const timeout = setTimeout(() => remove(id), toast.duration)
    // In case unmounted before timeout, ignore.
    return () => clearTimeout(timeout)
  }, [remove])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container */}
      <div className="fixed top-4 right-4 z-[1000] space-y-2" aria-live="polite" aria-atomic="true" role="region" aria-label="通知">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
            className={[
              'rounded-lg px-4 py-3 shadow-soft text-sm transition-all fade-in',
              'bg-white text-gray-900 border',
              t.variant === 'success' && 'border-green-200 bg-green-50 text-green-800',
              t.variant === 'error' && 'border-red-200 bg-red-50 text-red-800',
              t.variant === 'warning' && 'border-yellow-200 bg-yellow-50 text-yellow-800',
            ].filter(Boolean).join(' ')}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {t.title && <div className="font-semibold mb-0.5">{t.title}</div>}
                <div>{t.message}</div>
              </div>
              <button
                aria-label="通知を閉じる"
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={() => remove(t.id)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
