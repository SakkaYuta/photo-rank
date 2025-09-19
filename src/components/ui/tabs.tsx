import * as React from 'react'
import { createContext, useContext, useState } from 'react'
import { cn } from '../../lib/cn'

type TabsContextType = { activeTab: string; setActiveTab: (v: string) => void }
const TabsContext = createContext<TabsContextType>({ activeTab: '', setActiveTab: () => {} })

export const Tabs = ({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) => {
  const [activeTab, setActiveTab] = useState(defaultValue)
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

Tabs.List = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'inline-flex h-10 items-center justify-start rounded-lg p-1 gap-1',
      'bg-gray-100 dark:bg-gray-800',
      className
    )}
    {...props}
  />
)

Tabs.Trigger = ({ value, children, className, ...props }: { value: string; children: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { activeTab, setActiveTab } = useContext(TabsContext)
  const isActive = activeTab === value
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
          : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-white/70 dark:hover:bg-gray-700/70',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

Tabs.Content = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => {
  const { activeTab } = useContext(TabsContext)
  if (activeTab !== value) return null
  return <div className={cn('mt-4', className)}>{children}</div>
}

