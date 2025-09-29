import { useState } from 'react'
import { APP_NAME } from '../../utils/constants'
import { UserMenu } from '../auth/UserMenu'
import { ShoppingCart, Menu, X } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import RoleSwitcher from '../RoleSwitcher'
import { useUserRole } from '../../hooks/useUserRole'
import { useNav } from '@/contexts/NavContext'

interface HeaderProps {
  currentView?: string
}

export function Header({ currentView }: HeaderProps = {}) {
  const { items } = useCart()
  const { user, userType, isFactory } = useUserRole()
  const count = items.reduce((s, it) => s + it.qty, 0)
  const { navigate } = useNav()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleCartClick = () => {
    import('@/utils/navigation').then(m => m.navigate('cart'))
    setMobileMenuOpen(false)
  }


  // PhotoRankロゴ（ヘッダー左）をタップしたら常にPhotoRankページ（merch）へ
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate('merch')
  }

  // 右側の表示は常に維持し、要素ごとに表示可否を制御
  const shouldHideRightSide = false

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <a
          href={`#merch`}
          className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 flex-shrink-0 hover:text-primary-600 transition-colors"
          onClick={handleLogoClick}
          aria-label="ホームへ"
          title="ホームへ"
        >
          {APP_NAME}
        </a>


        {/* デスクトップメニュー */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0 overflow-visible">
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

        {/* モバイルメニューボタン */}
        <div className="flex items-center gap-2 md:hidden">
          {/* 未ログイン時はモバイルでもログインボタンを常時表示 */}
          {!user && (
            <div className="md:hidden">
              <UserMenu />
            </div>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="メニュー"
            title="メニュー"
            data-testid="hamburger-menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-3">

            {user && (
              <div className="pb-3 border-b border-gray-200">
                <RoleSwitcher />
              </div>
            )}
            {user && !isFactory && (
              <button
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={handleCartClick}
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-900">カート</span>
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-xs h-5 min-w-[20px] px-1 font-medium">
                    {count}
                  </span>
                )}
              </button>
            )}
            <div className="pt-3 border-t border-gray-200">
              <UserMenu />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
