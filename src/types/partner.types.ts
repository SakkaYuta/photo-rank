export type ManufacturingPartner = {
  id: string
  name: string
  company_name?: string | null
  contact_email: string
  contact_phone?: string | null
  address?: Record<string, any> | null
  website_url?: string | null
  description?: string | null
  capabilities?: Record<string, any> | null
  status: 'pending' | 'approved' | 'suspended'
  avg_rating: number
  ratings_count: number
  created_at: string
  updated_at: string
}

export type FactoryProduct = {
  id: string
  partner_id: string
  product_type: string
  base_cost: number
  lead_time_days: number
  min_order_qty: number
  options?: Record<string, any> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ManufacturingOrder = {
  id: string
  order_id: string
  partner_id: string
  request_payload: Record<string, any>
  response_payload?: Record<string, any> | null
  status: 'submitted' | 'accepted' | 'in_production' | 'shipped' | 'cancelled' | 'failed'
  assigned_at?: string | null
  shipped_at?: string | null
  tracking_number?: string | null
  creator_user_id: string
  work_id?: string | null
  created_at: string
  updated_at: string
}

export type PartnerReview = {
  id: string
  partner_id: string
  author_user_id: string
  manufacturing_order_id?: string | null
  rating: number
  comment?: string | null
  created_at: string
}