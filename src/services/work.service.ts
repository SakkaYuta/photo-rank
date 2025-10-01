import { supabase } from './supabaseClient'
import { SAMPLE_WORKS } from '@/sample/worksSamples'
import { isDemoEnabled } from '../utils/demo'

// In-memory store for created sample works (dev/demo only)
const sampleCreatedWorks: Work[] = []
import type { Work, Purchase, Vote } from '../types'

export async function listTrendingWorks(limit = 20): Promise<Work[]> {
  if (isDemoEnabled()) {
    const all = [...sampleCreatedWorks, ...SAMPLE_WORKS]
    return all.slice(0, limit)
  }
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as Work[]
}

export type WorkSearchParams = {
  q?: string
  minPrice?: number
  maxPrice?: number
  factoryId?: string
  limit?: number
}

export async function searchWorks(params: WorkSearchParams): Promise<Work[]> {
  if (isDemoEnabled()) {
    const { q, minPrice, maxPrice, limit = 50 } = params || {}
    let arr = [...sampleCreatedWorks, ...SAMPLE_WORKS]
    if (q && q.trim()) arr = arr.filter(w => w.title.toLowerCase().includes(q.toLowerCase()))
    if (typeof minPrice === 'number') arr = arr.filter(w => w.price >= minPrice)
    if (typeof maxPrice === 'number') arr = arr.filter(w => w.price <= maxPrice)
    return arr.slice(0, limit)
  }
  const { q, minPrice, maxPrice, factoryId, limit = 50 } = params || {}
  let query = supabase
    .from('works')
    .select('*')
    .eq('is_active', true)

  if (q && q.trim()) {
    query = query.ilike('title', `%${q.trim()}%`)
  }
  if (typeof minPrice === 'number') {
    query = query.gte('price', minPrice)
  }
  if (typeof maxPrice === 'number') {
    query = query.lte('price', maxPrice)
  }
  if (factoryId && factoryId.trim()) {
    // DB上にfactory_idがある前提（ない場合はno-op）
    // @ts-ignore - 型定義にない可能性あり
    query = query.eq('factory_id', factoryId.trim())
  }

  query = query.order('created_at', { ascending: false }).limit(limit)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Work[]
}

export async function createWork(payload: Partial<Work>): Promise<Work> {
  if (isDemoEnabled()) {
    const w: Work = {
      id: `demo-created-${Date.now()}`,
      title: payload.title || '新規作品',
      description: (payload as any).description || '',
      creator_id: (payload as any).creator_id || 'demo-user-1',
      price: payload.price || 2000,
      image_url: (payload as any).image_url || 'https://placehold.co/600x400',
      category: (payload as any).category || 'photo',
      tags: (payload as any).tags || [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any
    sampleCreatedWorks.unshift(w)
    return w
  }
  // Map extended fields into top-level columns + metadata(JSONB)
  const {
    // top-level known columns
    title,
    description,
    message,
    creator_id,
    price,
    image_url,
    category,
    tags,
    factory_id,
    sale_start_at,
    sale_end_at,
    // UI-specific fields to be stored into metadata
    // @ts-ignore - present from CreateWork form
    content_url,
    // @ts-ignore
    images,
    // @ts-ignore
    enabled_families,
    // @ts-ignore
    creator_margin,
    // @ts-ignore
    ip_confirmed,
    // @ts-ignore
    policy_accepted,
    // product_model_id / variants / product_specs / shipping_profile は UI仕様変更により送信しない
    // @ts-ignore
    print_surfaces,
    // @ts-ignore
    price_breakdown_preview,
    // @ts-ignore (from UI: is_published)
    is_published,
    ...rest
  } = (payload as any) || {}

  const insertPayload: any = {
    title,
    description: description ?? message ?? null,
    creator_id,
    price,
    image_url,
    category,
    tags,
    factory_id,
    sale_start_at: sale_start_at || null,
    sale_end_at: sale_end_at || null,
    // Map publish flag to existing column
    is_active: typeof is_published === 'boolean' ? Boolean(is_published) : true,
    // Merge extra fields into flexible metadata JSONB
    metadata: {
      ...(rest?.metadata || {}),
      content_url: content_url || null,
      images: images || [],
      image_preview_storage_paths: (rest as any)?.image_preview_storage_paths || [],
      image_original_storage_paths: (rest as any)?.image_original_storage_paths || [],
      enabled_families: enabled_families || [],
      creator_margin: creator_margin || null,
      ip_confirmed: Boolean(ip_confirmed),
      policy_accepted: Boolean(policy_accepted),
      // モデル/バリエーション/商品仕様/配送プロファイルは非推奨につき未保存
      print_surfaces: print_surfaces || null,
      price_breakdown_preview: price_breakdown_preview || null,
    },
  }

  const { data, error } = await supabase
    .from('works')
    .insert(insertPayload)
    .select('*')
    .single()
  if (error) throw error
  return data as Work
}

export async function myWorks(creatorId: string): Promise<Work[]> {
  if (isDemoEnabled()) {
    const all = [...sampleCreatedWorks, ...SAMPLE_WORKS]
    // デモ環境ではデモID（例: demo-creator-...）とサンプルのcreator_idが一致しないため全件表示
    if (!creatorId || creatorId.startsWith('demo-')) return all
    return all.filter(w => w.creator_id === creatorId)
  }
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Work[]
}

export async function purchaseWork(workId: string, price: number): Promise<Purchase> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('purchases')
    .insert({ user_id: user.id, work_id: workId, price })
    .select('*')
    .single()
  if (error) throw error
  return data as Purchase
}

export async function voteWork(workId: string): Promise<Vote> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('votes')
    .insert({ user_id: user.id, work_id: workId })
    .select('*')
    .single()
  if (error) throw error
  return data as Vote
}

export async function myPurchases(userId: string): Promise<(Purchase & { work: Work })[]> {
  if (isDemoEnabled()) {
    return SAMPLE_WORKS.slice(0, 2).map((w, i) => ({
      id: `demo-order-${i+1}`,
      user_id: userId,
      work_id: w.id,
      price: w.price,
      amount: w.price,
      status: 'paid' as any,
      purchased_at: new Date(Date.now() - (i+1)*3600000).toISOString(),
      created_at: new Date(Date.now() - (i+1)*3600000).toISOString(),
      work: w,
    } as any))
  }
  const { data, error } = await supabase
    .from('purchases')
    .select('*, work:works(*)')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false })
  if (error) throw error
  return (data || []) as any
}

export async function listWorksByIds(ids: string[]): Promise<Work[]> {
  if (isDemoEnabled()) {
    const map = new Map([...sampleCreatedWorks, ...SAMPLE_WORKS].map(w => [w.id, w]))
    return ids.map(id => map.get(id)).filter(Boolean) as Work[]
  }
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .in('id', ids)
  if (error) throw error
  // preserve input order
  const map = new Map((data || []).map((w: any) => [w.id, w]))
  return ids.map(id => map.get(id)).filter(Boolean) as Work[]
}
