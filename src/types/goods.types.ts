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

