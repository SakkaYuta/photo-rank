export type GoodsOrder = {
  id: string
  user_id: string
  work_id: string
  goods_type: string
  quantity: number
  total_price: number
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled' | string
  shipping_address?: Record<string, any> | null
  estimated_delivery?: string | null
  created_at: string
}

export type BattleGoodsOrder = {
  id: string
  user_id: string
  battle_id: string
  creator_id: string
  goods_type: 'battle_sticker' | 'battle_badge' | 'battle_tshirt' | 'battle_photobook' | 'battle_postcard' | 'battle_keychain'
  quantity: number
  total_price: number
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled'
  shipping_address?: Record<string, any> | null
  estimated_delivery?: string | null
  points_added: number
  created_at: string
}

