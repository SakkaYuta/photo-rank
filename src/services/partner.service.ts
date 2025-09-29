import { supabase } from './supabaseClient'
import type { ManufacturingPartner, FactoryProduct, ManufacturingOrder, PartnerReview } from '../types'

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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
  // デモIDは Supabase に存在しないので、明示的にフォールバックのみ
  if (partnerId.startsWith('demo')) {
    return [
      { id: 'prod-1', partner_id: partnerId, product_type: 'tshirt', base_cost: 1500, lead_time_days: 7, minimum_quantity: 1, maximum_quantity: 1000, is_active: true, options: { display_name: 'スタンダードTシャツ' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'prod-2', partner_id: partnerId, product_type: 'mug', base_cost: 800, lead_time_days: 7, minimum_quantity: 1, maximum_quantity: 1000, is_active: true, options: { display_name: 'セラミックマグ' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as any
  }

  // Supabase から取得（優先）。失敗時のみサンプルを返す
  try {
    const { data, error } = await supabase
      .from('factory_products')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as FactoryProduct[]
  } catch (e) {
    console.warn('getPartnerProducts: Supabase fetch failed, falling back if sample enabled', e)
    if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
    .from('factory_products')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data || null) as FactoryProduct | null
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || partnerId.startsWith('demo')) {
    return [
      { id: 'order-1', partner_id: partnerId, status: 'in_production', created_at: new Date().toISOString(), factory_products: { id: 'prod-1', product_type: 'tshirt' }, works: { id: 'demo-work-1', title: '桜の季節', image_url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=300&fit=crop' }, purchases: [{ id: 'demo-order-1', user_id: 'demo-buyer-1', purchased_at: new Date().toISOString() }] },
    ]
  }
  // まずは統合ビューを利用（なければフォールバック）
  const { data: viewRows, error: viewErr } = await supabase
    .from('partner_orders_view')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })

  if (!viewErr && Array.isArray(viewRows)) {
    // ビューの行を既存UI互換の形に整形
    return (viewRows as any[]).map((r) => ({
      id: r.id,
      order_id: r.order_id,
      partner_id: r.partner_id,
      status: r.status,
      created_at: r.created_at,
      assigned_at: r.assigned_at,
      shipped_at: r.shipped_at,
      tracking_number: r.tracking_number,
      factory_products: {
        id: r.factory_product_id,
        product_type: r.product_type,
        product_name: r.product_name,
      },
      works: {
        id: r.work_id,
        title: r.work_title,
        image_url: r.work_image_url,
        creator_id: r.creator_id,
      },
      creator_profile: r.creator_id
        ? { id: r.creator_id, display_name: r.creator_name, avatar_url: r.creator_avatar }
        : null,
      customer_profile: r.customer_id
        ? { id: r.customer_id, display_name: r.customer_name, avatar_url: r.customer_avatar }
        : null,
    }))
  }

  // フォールバック: 旧JOIN戦略（公開プロフィールを後付け）
  const { data, error } = await supabase
    .from('manufacturing_orders')
    .select(`
      *,
      factory_products(
        id,
        product_type
      ),
      works(
        id,
        title,
        image_url,
        creator_id
      ),
      purchases(
        id,
        user_id,
        purchased_at
      )
    `)
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const orders = (data || []) as any[]
  const creatorIds = Array.from(new Set(orders.map(o => o?.works?.creator_id).filter(Boolean)))
  const customerIds = Array.from(new Set(orders.map(o => (o?.purchases?.[0]?.user_id) || o?.creator_user_id).filter(Boolean)))

  const [creatorProfiles, customerProfiles] = await Promise.all([
    creatorIds.length > 0
      ? supabase.from('user_public_profiles').select('id, display_name, avatar_url').in('id', creatorIds)
      : Promise.resolve({ data: [] as any[] }),
    customerIds.length > 0
      ? supabase.from('user_public_profiles').select('id, display_name, avatar_url').in('id', customerIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const creatorMap = new Map((creatorProfiles.data || []).map((p: any) => [p.id, p]))
  const customerMap = new Map((customerProfiles.data || []).map((p: any) => [p.id, p]))

  return orders.map(o => {
    const cId = o?.works?.creator_id
    const custId = (o?.purchases?.[0]?.user_id) || o?.creator_user_id
    return {
      ...o,
      // ビューがない環境向けフォールバックとして product_name を product_type で埋める
      factory_products: o.factory_products ? { ...o.factory_products, product_name: o.factory_products.product_type } : o.factory_products,
      creator_profile: cId ? creatorMap.get(cId) : null,
      customer_profile: custId ? customerMap.get(custId) : null,
    }
  })
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || partnerId.startsWith('demo')) {
    return { activeProducts: 2, totalOrders: 5, pendingOrders: 2, completedOrders: 1, averageRating: 4.3, totalReviews: 12 }
  }
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || partnerId.startsWith('demo')) {
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
      .from('user_public_profiles')
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
