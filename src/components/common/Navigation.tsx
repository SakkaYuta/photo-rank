type NavItem = {
  key: string
  label: string
}

export function Navigation({ current, onChange, isAdmin = false, isPartner = false, hasProfile = false, userType = 'general' }: {
  current: string,
  onChange: (key: string) => void,
  isAdmin?: boolean,
  isPartner?: boolean,
  hasProfile?: boolean,
  userType?: string
}) {
  // 表示モードのオーバーライド（creator/organizer が一般表示へ切替時）
  const viewOverride = typeof window !== 'undefined' ? localStorage.getItem('view_override') : null
  const effectiveType = viewOverride === 'general' ? 'general' : userType

  // 一般ユーザー表示ではナビゲーション自体を非表示にする
  if (effectiveType === 'general') return null
  // 未登録ユーザー向けの基本ナビゲーション
  const publicItems: NavItem[] = [
    // クリエイターページ仕様変更に伴いトレンド/検索タブを削除
  ]

  // 一般ユーザー向けのナビゲーション
  const generalUserItems: NavItem[] = [
    { key: 'general-dashboard', label: 'ダッシュボード' },
    { key: 'merch', label: 'PhotoRank' },
  ]

  // クリエイター向けのナビゲーション
  const creatorItems: NavItem[] = [
    { key: 'create', label: '作品作成' },
    { key: 'myworks', label: 'マイ作品' },
    // 仕様変更により工場比較/製造発注タブを削除
  ]

  // 工場・印刷業者向けのナビゲーション
  const factoryItems: NavItem[] = [
    { key: 'factory-dashboard', label: 'ダッシュボード' },
    { key: 'partner-orders', label: '受注管理' },
    { key: 'partner-products', label: '商品管理' },
  ]

  // オーガナイザー向けのナビゲーション
  const organizerItems: NavItem[] = [
    { key: 'organizer-dashboard', label: 'ダッシュボード' },
    { key: 'events', label: 'イベント管理' },
    { key: 'contests', label: 'コンテスト管理' },
  ]

  // 管理者・パートナー向けの追加ナビゲーション
  const adminItems: NavItem[] = [
    ...(isAdmin ? [
      { key: 'admin', label: '管理' } as NavItem,
      { key: 'admin-asset-policies', label: 'ポリシー' } as NavItem,
      { key: 'admin-approvals', label: '承認キュー' } as NavItem,
    ] : []),
    ...(isPartner ? [
      { key: 'partner-dashboard', label: 'パートナー' },
      { key: 'partner-products', label: '商品管理' },
      { key: 'partner-orders', label: '受注管理' }
    ] as NavItem[] : []),
  ]

  // ユーザータイプに基づいてナビゲーション項目を選択
  const getUserItems = (): NavItem[] => {
    if (!hasProfile) return []

    switch (effectiveType) {
      case 'creator':
        return creatorItems
      case 'factory':
        return factoryItems
      case 'organizer':
        return organizerItems
      case 'general':
      default:
        return generalUserItems
    }
  }

  // 最終的なナビゲーション項目を構築
  const items: NavItem[] = [
    ...publicItems,
    ...getUserItems(),
    ...adminItems,
  ]

  // 重複タブをキーで排除（例: 工場ユーザーで isPartner=true のときの受注/商品管理）
  const dedupedItems: NavItem[] = []
  const seen = new Set<string>()
  for (const it of items) {
    if (!seen.has(it.key)) {
      dedupedItems.push(it)
      seen.add(it.key)
    }
  }
  return (
    <nav className="sticky top-[53px] z-10 border-b border-gray-200 bg-white shadow-soft">
      <div className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-4">
        <ul className="flex gap-1 sm:gap-2 py-2 min-w-max">
          {dedupedItems
            .filter((it) => {
              // 工場のダッシュボードにいるときはダッシュボードタブを非表示
              if (effectiveType === 'factory' && current === 'factory-dashboard' && it.key === 'factory-dashboard') return false
              return true
            })
            .map((it) => (
            <li key={it.key}>
              <button
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${current === it.key ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'text-gray-700 hover:text-primary-600 hover:bg-primary-50'}`}
                onClick={() => onChange(it.key)}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
