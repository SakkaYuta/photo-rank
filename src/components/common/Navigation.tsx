type NavItem = {
  key: string
  label: string
}

export function Navigation({ current, onChange, isAdmin = false, isPartner = false }: { 
  current: string, 
  onChange: (key: string) => void, 
  isAdmin?: boolean,
  isPartner?: boolean
}) {
  const items: NavItem[] = [
    { key: 'trending', label: 'トレンド' },
    { key: 'search', label: 'クリエイター検索' },
    { key: 'collection', label: 'コレクション' },
    { key: 'create', label: '作品作成' },
    { key: 'myworks', label: 'マイ作品' },
    { key: 'orders', label: 'グッズ注文履歴' },
    ...(isAdmin ? [{ key: 'admin', label: '管理' } as NavItem] : []),
    ...(isPartner ? [
      { key: 'partner-dashboard', label: 'パートナー' },
      { key: 'partner-products', label: '商品管理' },
      { key: 'partner-orders', label: '受注管理' }
    ] as NavItem[] : []),
  ]
  return (
    <nav className="sticky top-[53px] z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
      <div className="mx-auto max-w-6xl overflow-x-auto px-2">
        <ul className="flex gap-2 py-2">
          {items.map((it) => (
            <li key={it.key}>
              <button
                className={`btn btn-outline ${current === it.key ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
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
