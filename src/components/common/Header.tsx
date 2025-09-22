import { APP_NAME } from '../../utils/constants'
import { UserMenu } from '../auth/UserMenu'
import { ThemeToggle } from '../ui/ThemeToggle'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import RoleSwitcher from '../RoleSwitcher'
import { useUserRole } from '../../hooks/useUserRole'
import { useNav } from '@/contexts/NavContext'

export function Header() {
  const { items } = useCart()
  const { user, userType, isFactory } = useUserRole() // ユーザーの認証状態とタイプを取得
  const count = items.reduce((s, it) => s + it.qty, 0)
  const { navigate } = useNav()

  const handleCartClick = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'cart' } }))
  }

  // ログイン済みユーザーの初期ページを決定
  const getHomeView = () => {
    if (!user) {
      return 'general-dashboard' // 未ログイン時はGeneralDashboard
    }

    // viewOverrideをチェック（localStorageから取得）
    const viewOverride = typeof window !== 'undefined'
      ? localStorage.getItem('view_override')
      : null

    // ログイン済みの場合、ユーザータイプとviewOverrideに応じた初期ページを返す
    switch (userType) {
      case 'creator':
        // viewOverrideが'general'の場合はMerchContentHub、そうでなければCreatorDashboard
        return viewOverride === 'general' ? 'merch' : 'creator-dashboard'
      case 'factory':
        return 'factory-dashboard'
      case 'organizer':
        // viewOverrideが'general'の場合はMerchContentHub、そうでなければOrganizerDashboard
        return viewOverride === 'general' ? 'merch' : 'organizer-dashboard'
      case 'general':
      default:
        return 'general-dashboard'
    }
  }

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const homeView = getHomeView()
    navigate(homeView)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a
          href={`#${getHomeView()}`}
          className="text-left text-xl font-bold text-primary-700 dark:text-primary-400 flex-shrink-0 hover:opacity-80"
          onClick={handleLogoClick}
          aria-label="ホームへ"
          title="ホームへ"
        >
          {APP_NAME}
        </a>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 overflow-visible">
          {/* ログイン済みユーザーのみロール切り替えを表示 */}
          {user && <RoleSwitcher />}
          {!isFactory && (
            <button
              className="relative rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-base"
              onClick={handleCartClick}
              aria-label="カートを見る"
            >
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] h-4 min-w-[16px] px-1">
                  {count}
                </span>
              )}
            </button>
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
