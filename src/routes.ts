// Central route registry to ease Router migration
export const allowedViews = [
  'trending','merch','search','collection','favorites','cart','create','myworks','orders','profile','admin','admin-asset-policies','admin-approvals','partner-dashboard','partner-products','partner-orders','partner-settings','factory','factory-order','factory-catalog','factory-item-detail','events','contests','terms','privacy','refunds','commerce','general-dashboard','creator-dashboard','factory-dashboard','organizer-dashboard','organizer-revenue','organizer-support','organizer-leave','organizer-invoice','organizer-guidelines','battle-search','creator-profile','live-battle','account-settings','products-marketplace','goods-item-selector','creator-goods','payment-methods','receipt','faq'
] as const

export type ViewKey = typeof allowedViews[number]

export function isValidView(v: string): v is ViewKey {
  return (allowedViews as readonly string[]).includes(v)
}

// Route meta for auth/role gating
export type RoleKey = 'general' | 'creator' | 'factory' | 'organizer' | 'admin'

export interface RouteMeta {
  requireAuth?: boolean
  roles?: RoleKey[] // if omitted, all roles permitted
  title?: string
  showInNav?: boolean
  navOrder?: number
  icon?: string // lucide-react icon key (mapped in Navigation)
}

export const ROUTES_META: Record<ViewKey, RouteMeta> = {
  // Public landing and browsing
  'merch': { title: 'PhotoRank', showInNav: true, navOrder: 20, icon: 'Home' },
  'trending': {},
  'search': {},
  'collection': {},
  'favorites': {},
  'products-marketplace': { title: '商品を探す', showInNav: true, navOrder: 30, icon: 'Store' },
  'creator-goods': {},
  'battle-search': { title: 'バトル検索', showInNav: true, navOrder: 35, icon: 'Gamepad2' },
  'live-battle': {},
  'terms': {},
  'privacy': {},
  'refunds': {},
  'commerce': {},
  'payment-methods': {},
  'receipt': {},
  'faq': { title: 'よくある質問', showInNav: false, icon: 'HelpCircle' },

  // Auth-required general
  'cart': { requireAuth: true },
  'orders': { requireAuth: true },
  'profile': { requireAuth: true },
  'account-settings': { requireAuth: true },

  // Creator
  'create': { requireAuth: true, roles: ['creator','admin'], title: '作品作成', showInNav: true, navOrder: 40, icon: 'PlusSquare' },
  'myworks': { requireAuth: true, roles: ['creator','admin'], title: 'マイ作品', showInNav: true, navOrder: 50, icon: 'Images' },
  'creator-dashboard': { requireAuth: true, roles: ['creator','admin'], title: 'クリエイター', showInNav: false, navOrder: 10, icon: 'Users' },

  // Factory/Partner
  'factory-dashboard': { requireAuth: true, roles: ['factory','admin'], title: 'パートナー', showInNav: true, navOrder: 10, icon: 'Building2' },
  'partner-dashboard': { requireAuth: true, roles: ['factory','admin'] },
  'partner-products': { requireAuth: true, roles: ['factory','admin'] },
  'partner-orders': { requireAuth: true, roles: ['factory','admin'] },
  'partner-settings': { requireAuth: true, roles: ['factory','admin'] },
  'factory': { requireAuth: true, roles: ['factory','admin'] },
  'factory-order': { requireAuth: true, roles: ['factory','admin'], title: '製造発注', showInNav: true, navOrder: 60, icon: 'Package' },
  'factory-catalog': { requireAuth: true, roles: ['creator','admin','factory'] },
  'factory-item-detail': { requireAuth: true, roles: ['creator','admin','factory'] },

  // Organizer
  'organizer-dashboard': { requireAuth: true, roles: ['organizer','admin'], title: 'オーガナイザー', showInNav: true, navOrder: 10, icon: 'Calendar' },
  'events': { requireAuth: true, roles: ['organizer','admin'], title: 'イベント', showInNav: true, navOrder: 40, icon: 'Calendar' },
  // Organizer subviews
  'organizer-revenue': { requireAuth: true, roles: ['organizer','admin'], title: '売上管理' },
  'organizer-support': { requireAuth: true, roles: ['organizer','admin'], title: 'オーガナイザー窓口' },
  'organizer-leave': { requireAuth: true, roles: ['organizer','admin'], title: '所属解除申請' },
  'organizer-invoice': { requireAuth: true, roles: ['organizer','admin'], title: 'インボイス設定' },
  'organizer-guidelines': { requireAuth: true, roles: ['organizer','admin'], title: '規約・ガイドライン' },
  'contests': { requireAuth: true, roles: ['organizer','admin'], title: 'コンテスト', showInNav: true, navOrder: 50, icon: 'Trophy' },

  // Admin
  'admin': { requireAuth: true, roles: ['admin'], title: '管理', showInNav: true, navOrder: 100, icon: 'Shield' },
  'admin-asset-policies': { requireAuth: true, roles: ['admin'] },
  'admin-approvals': { requireAuth: true, roles: ['admin'] },

  // Goods flow
  'goods-item-selector': { requireAuth: false },

  // Generic dashboards
  'general-dashboard': { requireAuth: true, title: 'ダッシュボード', showInNav: true, navOrder: 15, icon: 'LayoutDashboard' },
  'creator-profile': {},
}

// Default landing per role (used for post-login routing and guard fallbacks)
export const DEFAULT_HOME: Record<RoleKey | 'guest', ViewKey> = {
  general: 'merch',
  creator: 'creator-dashboard',
  factory: 'factory-dashboard',
  organizer: 'organizer-dashboard',
  admin: 'admin',
  guest: 'merch',
}

export function defaultViewFor(role: RoleKey | 'guest'): ViewKey {
  return DEFAULT_HOME[role]
}
