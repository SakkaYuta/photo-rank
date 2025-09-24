import { APP_NAME } from '../../utils/constants'
import { UserMenu } from '../auth/UserMenu'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import RoleSwitcher from '../RoleSwitcher'
import { useUserRole } from '../../hooks/useUserRole'
import { useNav } from '@/contexts/NavContext'

interface HeaderProps {
  currentView?: string
}

export function Header({ currentView }: HeaderProps = {}) {
  const { items } = useCart()
  const { user, userType, isFactory } = useUserRole() // ユーザーの認証状態とタイプを取得
  const count = items.reduce((s, it) => s + it.qty, 0)
  const { navigate } = useNav()

  const handleCartClick = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'cart' } }))
  }

  // PhotoRankロゴ（ヘッダー左）をタップしたら常にPhotoRankページ（merch）へ
  const getHomeView = () => 'merch'

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate('merch')
  }

  // トップページ（merch）でログインしていない場合は右側を非表示
  const shouldHideRightSide = currentView === 'merch' && !user

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
        <a
          href={`#merch`}
          className="text-left text-xl sm:text-2xl font-bold text-gray-900 flex-shrink-0 hover:text-primary-600 transition-colors truncate"
          onClick={handleLogoClick}
          aria-label="ホームへ"
          title="ホームへ"
        >
          {APP_NAME}
        </a>
        {!shouldHideRightSide && (
          <div className="flex items-center gap-3 flex-shrink-0 overflow-visible">
            {/* ログイン済みユーザーのみロール切り替えを表示 */}
            {user && <RoleSwitcher />}
            {user && !isFactory && (
              <button
                className="relative rounded-lg p-2 hover:bg-primary-50 transition-colors group"
                onClick={handleCartClick}
                aria-label="カートを見る"
              >
                <ShoppingCart className="w-5 h-5 text-gray-600 group-hover:text-primary-600 transition-colors" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-xs h-5 min-w-[20px] px-1 font-medium">
                    {count}
                  </span>
                )}
              </button>
            )}
            <UserMenu />
          </div>
        )}
      </div>
    </header>
  )
}
