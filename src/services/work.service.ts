import { supabase } from './supabaseClient'
import type { Work, Purchase, Vote } from '../types'

export async function listTrendingWorks(limit = 20): Promise<Work[]> {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as Work[]
}

export async function createWork(payload: Partial<Work>): Promise<Work> {
  const { data, error } = await supabase
    .from('works')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as Work
}

export async function myWorks(creatorId: string): Promise<Work[]> {
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
  const { data, error } = await supabase
    .from('purchases')
    .select('*, work:works(*)')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false })
  if (error) throw error
  return (data || []) as any
}

