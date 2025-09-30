import { useState } from 'react'
import { APP_NAME } from '../../utils/constants'
import { UserMenu } from '../auth/UserMenu'
import { ShoppingCart, Menu, X, Settings, Bell } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import RoleSwitcher from '../RoleSwitcher'
import { useUserRole } from '../../hooks/useUserRole'
import { useNav } from '@/contexts/NavContext'
import { allowedViews as ROUTES, ROUTES_META, type RoleKey } from '@/routes'
import { useEffect } from 'react'
import { listMyNotifications, markNotificationRead } from '@/services/userNotifications.service'
import { supabase } from '@/services/supabaseClient'

interface HeaderProps {
  currentView?: string
}

export function Header({ currentView }: HeaderProps = {}) {
  const { items } = useCart()
  const { user, userType, isFactory } = useUserRole()
  const count = items.reduce((s, it) => s + it.qty, 0)
  const { navigate } = useNav()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // 役割に応じたヘッダーメニュー（モバイルで表示）
  // ヘッダーは useUserRole の userType に忠実に従う（誤った工場優先を避ける）
  const role: RoleKey | 'guest' = user ? ((userType as RoleKey) || 'general') : 'guest'
  let headerMenuItems = (ROUTES as readonly string[])
    .filter((v) => {
      const meta = ROUTES_META[v as keyof typeof ROUTES_META]
      if (!meta?.showInNav) return false
      if (meta.roles && user) {
        return (meta.roles as RoleKey[]).includes(role as RoleKey)
      }
      // Public item: allow for all roles, but if requireAuth and no user, skip
      if (meta?.requireAuth && !user) return false
      return true
    })
    .sort((a, b) => (ROUTES_META[a as keyof typeof ROUTES_META]?.navOrder || 0) - (ROUTES_META[b as keyof typeof ROUTES_META]?.navOrder || 0))
    .map((v) => ({ key: v, title: ROUTES_META[v as keyof typeof ROUTES_META]?.title || v }))

  // 工場製造パートナー（承認済み）の場合は、メニューを工場管理者向けに固定
  if (role === 'factory') {
    headerMenuItems = [
      { key: 'factory-dashboard', title: '工場管理ダッシュボード' },
      { key: 'partner-orders', title: '受注一覧' },
      { key: 'partner-products', title: '商品管理' },
      { key: 'partner-settings', title: '送料・配送設定' },
      { key: 'partner-dashboard', title: 'レポート' },
      { key: 'faq', title: 'ヘルプ' },
    ]
  }
  // オーガナイザーのメニュー構成を固定
  if (role === 'organizer') {
    headerMenuItems = [
      { key: 'organizer-dashboard', title: 'ダッシュボード' },
      { key: 'events', title: 'イベント管理' },
      { key: 'organizer-revenue', title: '売上管理' },
      { key: 'account-settings', title: '銀行口座設定' },
      { key: 'organizer-guidelines', title: '規約・ガイドライン' },
      { key: 'account-settings', title: 'アカウント設定' },
      { key: 'organizer-support', title: 'オーガナイザー窓口' },
      { key: 'organizer-leave', title: '所属管理' },
      { key: 'organizer-invoice', title: 'インボイス設定' },
    ]
  }

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

  const refreshNotifications = async (silent = true) => {
    if (!user) { setNotifications([]); setUnreadCount(0); return }
    if (!silent) setNotifLoading(true)
    try {
      const items = await listMyNotifications(20)
      setNotifications(items)
      setUnreadCount(items.filter((n: any) => !n.read).length)
    } catch {
      // noop
    } finally {
      if (!silent) setNotifLoading(false)
    }
  }

  useEffect(() => { refreshNotifications(true) }, [user?.id])

  // 即時反映: user_notifications のリアルタイム購読
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel(`hdr-notifs-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` }, async () => {
        await refreshNotifications(true)
      })
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [user?.id])

  return (
    <>
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
        <div className="hidden md:flex items-center gap-3 flex-shrink-0 overflow-visible relative">
          {user && (
            <div className="relative">
              <button
                className="relative rounded-lg p-2 hover:bg-primary-50 transition-colors group"
                onClick={async () => { const next = !notifOpen; setNotifOpen(next); if (next) await refreshNotifications(false) }}
                aria-label="通知"
                title="通知"
              >
                <Bell className="w-5 h-5 text-gray-600 group-hover:text-primary-600 transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs h-5 min-w-[20px] px-1 font-medium">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-lg border bg-white shadow-lg z-50">
                  <div className="p-2 border-b flex items-center justify-between">
                    <div className="font-medium text-gray-800">通知</div>
                    <button className="text-sm text-blue-600" onClick={async()=>{ await refreshNotifications(false) }}>再読込</button>
                  </div>
                  {notifLoading ? (
                    <div className="p-4 text-sm text-gray-600">読み込み中...</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">新しい通知はありません</div>
                  ) : (
                    <ul className="divide-y">
                      {notifications.map((n:any) => (
                        <li key={n.id} className={`p-3 ${n.read ? 'bg-white' : 'bg-blue-50'}`}>
                          <button
                            className="text-left w-full"
                            onClick={async () => {
                              try { if (!n.read) await markNotificationRead(n.id) } catch {}
                              setNotifOpen(false)
                              const t = (n.type || '') as string
                              const view = (n.data?.view as string) || ''
                              const bid = (n.data?.battle_id as string) || ''
                              if (view === 'live-battle' && bid) {
                                import('@/utils/navigation').then(m => m.navigate('live-battle', { battle: bid }))
                              } else if (t === 'battle_request' || t === 'battle_accepted' || t === 'battle_declined') {
                                navigate('battle-invitations')
                              } else {
                                navigate('general-dashboard')
                              }
                              setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: true, read_at: new Date().toISOString() } : p))
                              setUnreadCount(c => Math.max(0, c - (n.read ? 0 : 1)))
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{n.title || '通知'}</div>
                                {n.message && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</div>}
                                <div className="text-[11px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                              </div>
                              {!n.read && (
                                <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 mt-1"/>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-primary-50 transition-colors group"
              aria-label="メニュー"
              title="メニュー"
              data-testid="hamburger-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600 group-hover:text-primary-600 transition-colors" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600 group-hover:text-primary-600 transition-colors" />
              )}
            </button>
          )}
          {!user && <UserMenu />}
        </div>

        {/* モバイルメニューボタン */}
        <div className="flex items-center gap-2 md:hidden">
          {/* 未ログイン時はモバイルでもログインボタンを常時表示 */}
          {!user && (
            <div className="md:hidden">
              <UserMenu />
            </div>
          )}
          {user && (
            <button
              className="relative rounded-lg p-2 hover:bg-gray-100 transition-colors"
              onClick={async () => { const next = !notifOpen; setNotifOpen(next); if (next) await refreshNotifications(false) }}
              aria-label="通知"
              title="通知"
            >
              <Bell className="w-6 h-6 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs h-5 min-w-[20px] px-1 font-medium">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
          {user && (
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
          )}
        </div>
      </div>

      {/* メニュー（モバイル＆デスクトップ） */}
      {user && mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-3">

            {user && (
              <div className="pb-3 border-b border-gray-200">
                <RoleSwitcher />
              </div>
            )}

            {user && !isFactory && userType !== 'creator' && userType !== 'organizer' && (
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
            {user && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                onClick={() => { navigate('account-settings'); setMobileMenuOpen(false); }}
              >
                <Settings className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">アカウント設定</span>
              </button>
            )}
            {/* 役割別メニュー項目 */}
            {headerMenuItems.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <nav className="grid grid-cols-1 gap-1">
                  {headerMenuItems.map((it) => (
                    <button
                      key={it.key}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-900"
                      onClick={() => { navigate(it.key as any); setMobileMenuOpen(false) }}
                    >
                      {it.title}
                    </button>
                  ))}
                </nav>
              </div>
            )}
            <div className="pt-3 border-t border-gray-200">
              <UserMenu />
            </div>
          </div>
        </div>
      )}
    </header>
    {notifOpen && user && (
      <div className="md:hidden fixed inset-0 z-50" onClick={()=>setNotifOpen(false)}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[70vh] overflow-auto">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="font-medium">通知</div>
            <button className="text-sm text-blue-600" onClick={async (e)=>{ e.stopPropagation(); await refreshNotifications(false) }}>再読込</button>
          </div>
          {notifLoading ? (
            <div className="p-4 text-sm text-gray-600">読み込み中...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">新しい通知はありません</div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n:any) => (
                <li key={n.id} className={`p-3 ${n.read ? 'bg-white' : 'bg-blue-50'}`} onClick={e=>e.stopPropagation()}>
                  <button
                    className="text-left w-full"
                    onClick={async () => {
                      try { if (!n.read) await markNotificationRead(n.id) } catch {}
                      setNotifOpen(false)
                      const t = (n.type || '') as string
                      const view = (n.data?.view as string) || ''
                      const bid = (n.data?.battle_id as string) || ''
                      if (view === 'live-battle' && bid) {
                        import('@/utils/navigation').then(m => m.navigate('live-battle', { battle: bid }))
                      } else if (t === 'battle_request' || t === 'battle_accepted' || t === 'battle_declined') {
                        navigate('battle-invitations')
                      } else {
                        navigate('general-dashboard')
                      }
                      setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: true, read_at: new Date().toISOString() } : p))
                      setUnreadCount(c => Math.max(0, c - (n.read ? 0 : 1)))
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">{n.title || '通知'}</div>
                    {n.message && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</div>}
                    <div className="text-[11px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )}
    </>
  )
}
