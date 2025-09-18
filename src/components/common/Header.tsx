import { useState } from 'react'
import { APP_NAME } from '../../utils/constants'
import { UserMenu } from '../auth/UserMenu'
import { ThemeToggle } from '../ui/ThemeToggle'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import CartDrawer from '@/components/cart/CartDrawer'
import RoleSwitcher from '../RoleSwitcher'
import { useUserRole } from '../../hooks/useUserRole'

export function Header() {
  const { items } = useCart()
  const [open, setOpen] = useState(false)
  const { user } = useUserRole() // ユーザーの認証状態を取得
  const count = items.reduce((s, it) => s + it.qty, 0)

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">{APP_NAME}</h1>
        <div className="flex items-center gap-3">
          {/* ログイン済みユーザーのみロール切り替えを表示 */}
          {user && <RoleSwitcher />}
          <button
            className="relative rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-base"
            onClick={() => setOpen(true)}
            aria-label="カートを開く"
          >
            <ShoppingCart className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] h-4 min-w-[16px] px-1">
                {count}
              </span>
            )}
          </button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <CartDrawer isOpen={open} onClose={() => setOpen(false)} />
    </header>
  )
}
