export const APP_NAME = 'PhotoRank'

export const GOODS_TYPES = [
  { id: 'print_s', label: 'フォトプリント (小)', basePrice: 1200 },
  { id: 'print_m', label: 'フォトプリント (中)', basePrice: 2000 },
  { id: 'canvas', label: 'キャンバスパネル', basePrice: 4800 },
  { id: 'frame', label: 'フレーム付き', basePrice: 5800 },
] as const

export const BATTLE_GOODS_TYPES = [
  { id: 'battle_sticker', label: '応援ステッカーセット', basePrice: 800, description: '推しクリエイターの専用ステッカー' },
  { id: 'battle_badge', label: 'ファンバッジ', basePrice: 1500, description: 'バトル参加記念の限定バッジ' },
  { id: 'battle_tshirt', label: 'オリジナルTシャツ', basePrice: 3200, description: 'クリエイター名入りオリジナルTシャツ' },
  { id: 'battle_photobook', label: 'ミニフォトブック', basePrice: 2800, description: 'バトル作品を収録したフォトブック' },
  { id: 'battle_postcard', label: 'ポストカードセット', basePrice: 600, description: 'バトル作品のポストカード5枚セット' },
  { id: 'battle_keychain', label: 'アクリルキーホルダー', basePrice: 1200, description: '作品デザインのキーホルダー' },
] as const

export const FILTER_TYPES = ['none', 'bw', 'vivid', 'film'] as const
export const FRAME_TYPES = ['none', 'simple', 'modern', 'classic'] as const

export const CURRENCY = 'JPY'

