import { supabase } from './supabaseClient'
import { SAMPLE_WORKS } from '@/sample/worksSamples'

// In-memory store for created sample works (dev/demo only)
const sampleCreatedWorks: Work[] = []
import type { Work, Purchase, Vote } from '../types'

export async function listTrendingWorks(limit = 20): Promise<Work[]> {
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
    const all = [...sampleCreatedWorks, ...SAMPLE_WORKS]
    return all.slice(0, limit)
  }
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('is_published', true)
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
    .eq('is_published', true)

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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
  const { data, error } = await supabase
    .from('works')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as Work
}

export async function myWorks(creatorId: string): Promise<Work[]> {
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
    const all = [...sampleCreatedWorks, ...SAMPLE_WORKS]
    return all.filter(w => !creatorId || w.creator_id === creatorId)
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
  if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
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
