import { APP_NAME } from '../../utils/constants'
import { UserMenu } from '../auth/UserMenu'
import { ThemeToggle } from '../ui/ThemeToggle'

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">{APP_NAME}</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
