export const APP_NAME = 'PhotoRank'

export const GOODS_TYPES = [
  { id: 'print_s', label: 'フォトプリント (小)', basePrice: 1200 },
  { id: 'print_m', label: 'フォトプリント (中)', basePrice: 2000 },
  { id: 'canvas', label: 'キャンバスパネル', basePrice: 4800 },
  { id: 'frame', label: 'フレーム付き', basePrice: 5800 },
] as const

export const FILTER_TYPES = ['none', 'bw', 'vivid', 'film'] as const
export const FRAME_TYPES = ['none', 'simple', 'modern', 'classic'] as const

export const CURRENCY = 'JPY'

