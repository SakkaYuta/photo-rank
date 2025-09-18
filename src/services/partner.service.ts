import { supabase } from './supabaseClient'
import type { ManufacturingPartner, FactoryProduct, ManufacturingOrder, PartnerReview } from '../types'

export async function getCurrentPartnerProfile(): Promise<ManufacturingPartner | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('manufacturing_partners')
    .select('*')
    .eq('owner_user_id', user.id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data as ManufacturingPartner
}

export async function getPartnerProducts(partnerId: string): Promise<FactoryProduct[]> {
  const { data, error } = await supabase
    .from('factory_products')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as FactoryProduct[]
}

export async function createFactoryProduct(product: Omit<FactoryProduct, 'id' | 'created_at' | 'updated_at'>): Promise<FactoryProduct> {
  const { data, error } = await supabase
    .from('factory_products')
    .insert(product)
    .select()
    .single()
  
  if (error) throw error
  return data as FactoryProduct
}

export async function updateFactoryProduct(id: string, updates: Partial<FactoryProduct>): Promise<FactoryProduct> {
  const { data, error } = await supabase
    .from('factory_products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as FactoryProduct
}

export async function deleteFactoryProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('factory_products')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function getPartnerOrders(partnerId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('manufacturing_orders')
    .select(`
      *,
      factory_products(
        id,
        product_name,
        product_type
      ),
      works(
        id,
        title,
        image_url,
        users(
          id,
          display_name,
          avatar_url
        ),
        purchases(
          id,
          user_id,
          purchased_at,
          users(
            id,
            display_name,
            avatar_url
          )
        )
      )
    `)
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return (data || []) as any[]
}

export async function updateOrderStatus(
  id: string, 
  status: ManufacturingOrder['status'], 
  updates?: { tracking_number?: string }
): Promise<ManufacturingOrder> {
  const updateData: any = { 
    status, 
    updated_at: new Date().toISOString() 
  }
  
  if (status === 'shipped') {
    updateData.shipped_at = new Date().toISOString()
  }
  
  if (updates?.tracking_number) {
    updateData.tracking_number = updates.tracking_number
  }
  
  const { data, error } = await supabase
    .from('manufacturing_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as ManufacturingOrder
}

export async function getPartnerStats(partnerId: string) {
  const [ordersResult, productsResult, reviewsResult] = await Promise.all([
    supabase
      .from('manufacturing_orders')
      .select('status')
      .eq('partner_id', partnerId),
    supabase
      .from('factory_products')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('is_active', true),
    supabase
      .from('partner_reviews')
      .select('rating')
      .eq('partner_id', partnerId)
  ])

  if (ordersResult.error) throw ordersResult.error
  if (productsResult.error) throw productsResult.error
  if (reviewsResult.error) throw reviewsResult.error

  const orders = ordersResult.data || []
  const activeProducts = productsResult.data?.length || 0
  const reviews = reviewsResult.data || []

  const totalOrders = orders.length
  const pendingOrders = orders.filter(o => o.status === 'accepted' || o.status === 'in_production').length
  const completedOrders = orders.filter(o => o.status === 'shipped').length

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0

  return {
    activeProducts,
    totalOrders,
    pendingOrders,
    completedOrders,
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length
  }
}

// ===== レビュー関連サービス =====

export async function getPartnerReviews(partnerId: string): Promise<PartnerReview[]> {
  const { data, error } = await supabase
    .from('partner_reviews')
    .select(`
      *,
      users!inner(
        username,
        avatar_url
      )
    `)
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as PartnerReview[]
}

export async function createPartnerReview(review: {
  partner_id: string
  manufacturing_order_id?: string
  rating: number
  comment?: string
}): Promise<PartnerReview> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('認証が必要です')

  const { data, error } = await supabase
    .from('partner_reviews')
    .insert({
      ...review,
      author_user_id: user.id
    })
    .select()
    .single()
  
  if (error) throw error
  return data as PartnerReview
}

export async function updatePartnerReview(
  reviewId: string, 
  updates: { rating?: number; comment?: string }
): Promise<PartnerReview> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('認証が必要です')

  const { data, error } = await supabase
    .from('partner_reviews')
    .update(updates)
    .eq('id', reviewId)
    .eq('author_user_id', user.id) // 自分のレビューのみ編集可能
    .select()
    .single()
  
  if (error) throw error
  return data as PartnerReview
}

export async function deletePartnerReview(reviewId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('認証が必要です')

  const { error } = await supabase
    .from('partner_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('author_user_id', user.id) // 自分のレビューのみ削除可能
  
  if (error) throw error
}

export async function canUserReviewPartner(
  partnerId: string, 
  manufacturingOrderId?: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // そのパートナーとの完了した注文があるかチェック
  const { data: orders, error: ordersError } = await supabase
    .from('manufacturing_orders')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('creator_user_id', user.id)
    .eq('status', 'shipped')

  if (ordersError || !orders?.length) return false

  // 特定の注文に対してレビュー済みでないかチェック
  if (manufacturingOrderId) {
    const { data: existingReview } = await supabase
      .from('partner_reviews')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('author_user_id', user.id)
      .eq('manufacturing_order_id', manufacturingOrderId)
      .maybeSingle()

    return !existingReview
  }

  return true
}
