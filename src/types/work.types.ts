export type Work = {
  id: string
  creator_id: string
  event_id?: string | null
  title: string
  image_url: string
  thumbnail_url?: string | null
  price: number
  description?: string | null
  message?: string | null
  filter_type?: string | null
  frame_type?: string | null
  is_published: boolean
  created_at: string
  updated_at?: string
  factory_id?: string | null
}

export type Purchase = {
  id: string
  user_id: string
  work_id: string
  price: number
  purchased_at: string
  status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  tracking_number?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  stripe_payment_intent_id?: string | null
  amount?: number
  created_at?: string
}

export type OrderStatus = {
  id: string
  purchase_id: string
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  message?: string | null
  created_at: string
}

export type ShippingProvider = {
  id: string
  name: string
  tracking_url_template: string // e.g., "https://track.yamato.com/{tracking_number}"
  active: boolean
}

export type Vote = {
  id: string
  user_id: string
  work_id: string
  created_at: string
}
