import { supabase } from './supabaseClient'
import type { GoodsOrder } from '../types'

export async function createGoodsOrder(payload: Omit<GoodsOrder, 'id' | 'status' | 'created_at'> & { status?: GoodsOrder['status'] }): Promise<GoodsOrder> {
  const { id: _omit, created_at: _omit2, status: _s, ...insertable } = payload as any
  const { data, error } = await supabase
    .from('goods_orders')
    .insert(insertable)
    .select('*')
    .single()
  if (error) throw error
  return data as GoodsOrder
}

export async function listMyGoodsOrders(userId: string): Promise<GoodsOrder[]> {
  const { data, error } = await supabase
    .from('goods_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as GoodsOrder[]
}

