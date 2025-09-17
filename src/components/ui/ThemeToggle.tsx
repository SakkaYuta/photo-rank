import React, { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../lib/cn'

type Theme = 'light' | 'dark' | 'system'

interface ThemeToggleProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'icon'
  variant?: 'primary' | 'secondary' | 'ghost' | 'link'
  showText?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  size = 'icon',
  variant = 'ghost',
  showText = false
}) => {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as Theme | null

    if (savedTheme) {
      setTheme(savedTheme)
      applyTheme(savedTheme)
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const systemTheme: Theme = prefersDark ? 'dark' : 'light'
      setTheme('system')
      applyTheme('system', systemTheme)
    }
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        applyTheme('system', e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const applyTheme = (newTheme: Theme, systemTheme?: 'light' | 'dark') => {
    const root = document.documentElement

    if (newTheme === 'system') {
      const prefersDark = systemTheme || window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    } else if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const toggleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]

    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    applyTheme(nextTheme)
  }

  // Get current effective theme for icon display
  const getCurrentTheme = (): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme as 'light' | 'dark'
  }

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null
  }

  const currentEffectiveTheme = getCurrentTheme()
  const isDark = currentEffectiveTheme === 'dark'

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'ライト'
      case 'dark': return 'ダーク'
      case 'system': return 'システム'
    }
  }

  const getNextThemeLabel = () => {
    const themes: Theme[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]

    switch (nextTheme) {
      case 'light': return 'ライトモードに切り替え'
      case 'dark': return 'ダークモードに切り替え'
      case 'system': return 'システム設定に切り替え'
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn(
        'transition-all duration-200',
        showText && 'gap-2',
        className
      )}
      title={getNextThemeLabel()}
      aria-label={getNextThemeLabel()}
    >
      {isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
      {showText && (
        <span className="text-sm">
          {getThemeLabel()}
        </span>
      )}
    </Button>
  )
}

// Hook for using theme in other components
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as Theme | null
    setTheme(savedTheme || 'system')
  }, [])

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)

    const root = document.documentElement
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    } else if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const getCurrentTheme = (): 'light' | 'dark' => {
    if (!mounted) return 'light'

    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme as 'light' | 'dark'
  }

  return {
    theme,
    setTheme: updateTheme,
    currentTheme: getCurrentTheme(),
    mounted
  }
}

export default ThemeToggle