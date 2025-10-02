import { supabase } from './supabaseClient'
import type { ManufacturingPartner, FactoryProduct, ManufacturingOrder, PartnerReview } from '../types'
import { isDemoEnabled } from '../utils/demo'

export async function getCurrentPartnerProfile(): Promise<ManufacturingPartner | null> {
  // まずは Supabase の実データを優先
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('manufacturing_partners')
        .select('*')
        .eq('owner_user_id', user.id)
        .single()

      if (!error && data) return data as ManufacturingPartner
      if (error && error.code !== 'PGRST116') throw error
    }
  } catch (e) {
    console.warn('getCurrentPartnerProfile: Supabase fetch failed, falling back if sample enabled', e)
  }

  // サンプルモードのみ、フォールバックのデモパートナーを返す
  if (isDemoEnabled()) {
    return {
      id: 'demo-partner-1',
      name: 'デモ製造パートナー',
      contact_email: 'partner@example.com',
      status: 'approved',
      avg_rating: 4.5,
      ratings_count: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any
  }

  return null
}

export async function getPartnerProducts(partnerId: string): Promise<FactoryProduct[]> {
  // デモID: 許可ホストかつデモ有効時のみフォールバック
  if (partnerId.startsWith('demo')) {
    if (isDemoEnabled()) {
      return [
        { id: 'prod-1', partner_id: partnerId, product_type: 'tshirt', base_cost: 1500, lead_time_days: 7, minimum_quantity: 1, maximum_quantity: 1000, is_active: true, options: { display_name: 'スタンダードTシャツ' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'prod-2', partner_id: partnerId, product_type: 'mug', base_cost: 800, lead_time_days: 7, minimum_quantity: 1, maximum_quantity: 1000, is_active: true, options: { display_name: 'セラミックマグ' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ] as any
    }
    return []
  }

  // Supabase から取得（優先）。失敗時のみサンプルを返す
  try {
    const { data, error } = await supabase
      .from('factory_products_vw')
      .select('id, factory_id, name, base_price_jpy, options, lead_time_days, created_at')
      .eq('factory_id', partnerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const mapped = (data || []).map((r: any) => ({
      id: r.id,
      partner_id: r.factory_id,
      product_type: r.name, // 互換: 表示用途に名称を流用
      base_cost: r.base_price_jpy,
      lead_time_days: r.lead_time_days,
      minimum_quantity: 1,
      maximum_quantity: 1000,
      is_active: true,
      options: r.options,
      created_at: r.created_at,
      updated_at: r.created_at,
    })) as FactoryProduct[]
    return mapped
  } catch (e) {
    console.warn('getPartnerProducts: Supabase fetch failed, falling back if sample enabled', e)
    if (isDemoEnabled()) {
      return [
        { id: 'prod-1', partner_id: partnerId, product_type: 'tshirt', base_cost: 1500, lead_time_days: 7, minimum_quantity: 1, maximum_quantity: 1000, is_active: true, options: { display_name: 'スタンダードTシャツ' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'prod-2', partner_id: partnerId, product_type: 'mug', base_cost: 800, lead_time_days: 7, minimum_quantity: 1, maximum_quantity: 1000, is_active: true, options: { display_name: 'セラミックマグ' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ] as any
    }
    throw e
  }
}

export async function getFactoryProductById(id: string): Promise<FactoryProduct | null> {
  const { data, error } = await supabase
    .from('factory_products_vw')
    .select('id, factory_id, name, base_price_jpy, options, lead_time_days, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r: any = data
  const mapped: FactoryProduct = {
    id: r.id,
    partner_id: r.factory_id,
    product_type: r.name,
    base_cost: r.base_price_jpy,
    lead_time_days: r.lead_time_days,
    minimum_quantity: 1,
    maximum_quantity: 1000,
    is_active: true,
    options: r.options,
    created_at: r.created_at,
    updated_at: r.created_at,
  } as any
  return mapped
}

export async function getPartnerById(partnerId: string): Promise<ManufacturingPartner | null> {
  const { data, error } = await supabase
    .from('manufacturing_partners')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle()
  if (error) throw error
  return (data || null) as ManufacturingPartner | null
}

export async function createFactoryProduct(product: Omit<FactoryProduct, 'id' | 'created_at' | 'updated_at'>): Promise<FactoryProduct> {
  // v6: partner_products にマッピングして作成
  const payload = {
    partner_id: (product as any).partner_id,
    name: product.product_type,
    base_cost_jpy: product.base_cost,
    specs: product.options || {},
    lead_time_days: product.lead_time_days ?? null,
  }
  const { data, error } = await supabase
    .from('partner_products')
    .insert(payload)
    .select('id, partner_id, name, base_cost_jpy, specs, lead_time_days, created_at')
    .single()
  
  if (error) throw error
  const r: any = data
  return {
    id: r.id,
    partner_id: r.partner_id,
    product_type: r.name,
    base_cost: r.base_cost_jpy,
    lead_time_days: r.lead_time_days,
    minimum_quantity: 1,
    maximum_quantity: 1000,
    is_active: true,
    options: r.specs,
    created_at: r.created_at,
    updated_at: r.created_at,
  } as any
}

export async function updateFactoryProduct(id: string, updates: Partial<FactoryProduct>): Promise<FactoryProduct> {
  // v6: partner_products を更新
  const payload: any = {}
  if (updates.product_type !== undefined) payload.name = updates.product_type
  if (updates.base_cost !== undefined) payload.base_cost_jpy = updates.base_cost
  if (updates.options !== undefined) payload.specs = updates.options
  if (updates.lead_time_days !== undefined) payload.lead_time_days = updates.lead_time_days
  const { data, error } = await supabase
    .from('partner_products')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, partner_id, name, base_cost_jpy, specs, lead_time_days, created_at, updated_at')
    .single()
  
  if (error) throw error
  const r: any = data
  return {
    id: r.id,
    partner_id: r.partner_id,
    product_type: r.name,
    base_cost: r.base_cost_jpy,
    lead_time_days: r.lead_time_days,
    minimum_quantity: 1,
    maximum_quantity: 1000,
    is_active: true,
    options: r.specs,
    created_at: r.created_at,
    updated_at: r.updated_at,
  } as any
}

export async function deleteFactoryProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('partner_products')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function getPartnerOrders(partnerId: string): Promise<any[]> {
  if (isDemoEnabled()) {
    return [
      { id: 'order-1', partner_id: partnerId, status: 'in_production', created_at: new Date().toISOString(), factory_products: { id: 'prod-1', product_type: 'tshirt' }, works: { id: 'demo-work-1', title: '桜の季節', image_url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=300&fit=crop' }, purchases: [{ id: 'demo-order-1', user_id: 'demo-buyer-1', purchased_at: new Date().toISOString() }] },
    ]
  }
  // まずは統合ビューを利用（なければフォールバック）
  // v6: manufacturing_orders_vw を利用（簡素情報）
  const { data, error } = await supabase
    .from('manufacturing_orders_vw')
    .select('id, factory_id, status, tracking_number, carrier, shipment_status, created_at, updated_at, order_item_id')
    .eq('factory_id', partnerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data || []) as any[]
}

export async function updateOrderStatus(
  id: string, 
  status: ManufacturingOrder['status'], 
  updates?: { tracking_number?: string }
): Promise<ManufacturingOrder> {
  // v6: fulfillments.state を更新（追跡番号等は shipments 管理のため別途）
  const updateData: any = { 
    state: status, 
    updated_at: new Date().toISOString() 
  }

  const { data, error } = await supabase
    .from('fulfillments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as ManufacturingOrder
}

export async function getPartnerStats(partnerId: string) {
  if (isDemoEnabled()) {
    return { activeProducts: 2, totalOrders: 5, pendingOrders: 2, completedOrders: 1, averageRating: 4.3, totalReviews: 12 }
  }
  const [ordersResult, productsResult, reviewsResult] = await Promise.all([
    supabase
      .from('manufacturing_orders_vw')
      .select('status')
      .eq('factory_id', partnerId),
    supabase
      .from('factory_products_vw')
      .select('id')
      .eq('factory_id', partnerId),
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
  const pendingOrders = orders.filter((o: any) => o.status === 'accepted' || o.status === 'in_production').length
  const completedOrders = orders.filter((o: any) => o.status === 'shipped').length

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum: any, review: any) => sum + review.rating, 0) / reviews.length
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

// ===== パートナー設定の更新 =====
export async function updatePartnerSettings(
  partnerId: string,
  updates: {
    contact_email?: string | null
    webhook_url?: string | null
    company_name?: string | null
    contact_phone?: string | null
    address?: Record<string, any> | null
    website_url?: string | null
    description?: string | null
    capabilities?: Record<string, any> | null
    shipping_info?: Record<string, any> | null
  }
): Promise<ManufacturingPartner> {
  if (isDemoEnabled()) {
    // サンプル環境ではローカルで即時反映する体裁のみ
    return {
      id: partnerId,
      name: 'デモ製造パートナー',
      company_name: updates.company_name || 'デモ工場',
      contact_email: updates.contact_email || 'partner@example.com',
      contact_phone: updates.contact_phone || null as any,
      address: updates.address || null as any,
      website_url: updates.website_url || null as any,
      description: updates.description || null as any,
      capabilities: updates.capabilities || null as any,
      shipping_info: updates.shipping_info || null as any,
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any
  }

  const { data, error } = await supabase
    .from('manufacturing_partners')
    .update({
      contact_email: updates.contact_email ?? null,
      webhook_url: updates.webhook_url ?? null,
      company_name: updates.company_name ?? undefined,
      contact_phone: updates.contact_phone ?? undefined,
      address: (updates.address as any) ?? undefined,
      website_url: updates.website_url ?? undefined,
      description: updates.description ?? undefined,
      capabilities: (updates.capabilities as any) ?? undefined,
      shipping_info: (updates.shipping_info as any) ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', partnerId)
    .select('*')
    .single()

  if (error) throw error
  return data as ManufacturingPartner
}

// ===== レビュー関連サービス =====

export async function getPartnerReviews(partnerId: string): Promise<PartnerReview[]> {
  if (isDemoEnabled()) {
    return [
      { id: 'rev-1', partner_id: partnerId, author_user_id: 'demo-user-1', rating: 5, comment: 'とても素早く対応いただきました！', created_at: new Date().toISOString(), users: { username: 'ユーザーA', avatar_url: undefined } },
    ] as any
  }
  const { data, error } = await supabase
    .from('partner_reviews')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const reviews = (data || []) as any[]
  const authorIds = Array.from(new Set(reviews.map(r => r.author_user_id).filter(Boolean)))
  let profileMap = new Map<string, { display_name: string; avatar_url?: string }>()
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('users_vw')
      .select('id, display_name, avatar_url')
      .in('id', authorIds)
    profileMap = new Map((profiles || []).map((p: any) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]))
  }

  return reviews.map(r => ({
    ...r,
    users: {
      username: profileMap.get(r.author_user_id)?.display_name || 'User',
      avatar_url: profileMap.get(r.author_user_id)?.avatar_url || undefined,
    }
  })) as PartnerReview[]
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
    .from('manufacturing_orders_vw')
    .select('id')
    .eq('factory_id', partnerId)
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
