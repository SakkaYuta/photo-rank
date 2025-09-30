import { supabase } from './supabaseClient'

export async function requestBattle(
  opponentId: string,
  duration: 5|30|60 = 5,
  options?: { title?: string; visibility?: 'public'|'private'; requested_start_at?: string; winner_bonus_amount?: number; description?: string }
): Promise<{ battle_id: string; status: string; duration: number; title?: string; visibility?: string; requested_start_at?: string; winner_bonus_amount?: number }> {
  const { data, error } = await supabase.functions.invoke('battle-request', {
    body: { opponent_id: opponentId, duration, ...(options || {}) }
  })
  if (error) throw error
  return data as any
}

export async function startBattle(battleId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('battle-start', {
    body: { battle_id: battleId }
  })
  if (error) throw error
}

export async function finishBattle(battleId: string, winnerId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('battle-finish', {
    body: { battle_id: battleId, winner_id: winnerId }
  })
  if (error) throw error
}

export async function acceptBattle(battleId: string, reason?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('battle-accept', {
    body: { battle_id: battleId, ...(reason ? { reason } : {}) }
  })
  if (error) throw error
}

export async function declineBattle(battleId: string, reason?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('battle-decline', {
    body: { battle_id: battleId, ...(reason ? { reason } : {}) }
  })
  if (error) throw error
}

export async function purchaseCheerTicket(battleId: string, creatorId: string, options?: Record<string, unknown>): Promise<{ ticket_id: string; amount: number; purchased_at: string }> {
  const { data, error } = await supabase.functions.invoke('cheer-ticket-purchase', {
    body: { battle_id: battleId, creator_id: creatorId, options }
  })
  if (error) throw error
  return data as any
}

export async function getBattleStatus(battleId: string): Promise<{
  battle: { id: string; challenger_id: string; opponent_id: string; duration_minutes: number; start_time?: string; end_time?: string; status: string; winner_id?: string; title?: string; requested_start_at?: string; visibility?: string; description?: string },
  participants?: Record<string, { id: string; display_name?: string; avatar_url?: string }>,
  scores: Record<string, number>,
  totals: { tickets: number; amount: number },
  recent?: Array<{ creator_id: string; amount: number; purchased_at: string }>
}> {
  const { data, error } = await supabase.functions.invoke('battle-status', {
    body: { battle_id: battleId }
  })
  if (error) throw error
  return data as any
}

export async function listBattles(params?: { status?: 'scheduled'|'live'|'finished', duration?: 5|30|60, limit?: number, offset?: number }): Promise<{
  items: Array<{ id: string; challenger_id: string; opponent_id: string; duration_minutes: number; start_time?: string; end_time?: string; status: string; winner_id?: string }>,
  aggregates: Record<string, { tickets: number; amount: number; by_user: Record<string, number> }>,
  participants?: Record<string, { id: string; display_name?: string; avatar_url?: string }>
}> {
  const { data, error } = await supabase.functions.invoke('list-battles', {
    body: { ...(params || {}) }
  })
  if (error) throw error
  return data as any
}

export async function listMyBattleInvitations(): Promise<{ items: any[]; participants: Record<string, any> }> {
  const { data, error } = await supabase.functions.invoke('list-my-battle-invitations', { body: {} })
  if (error) throw error
  return data as any
}

export async function createCheerTicketIntent(battleId: string, creatorId: string): Promise<{ clientSecret: string }> {
  const { data, error } = await supabase.functions.invoke('create-cheer-ticket-intent', {
    body: { battle_id: battleId, creator_id: creatorId }
  })
  if (error) throw error
  const clientSecret = (data as any).clientSecret ?? (data as any).client_secret
  return { clientSecret }
}

export async function purchaseBattleGoods(battleId: string, creatorId: string, goodsType: string, quantity: number = 1): Promise<{ order_id: string; amount: number; purchased_at: string }> {
  const { data, error } = await supabase.functions.invoke('battle-goods-purchase', {
    body: { battle_id: battleId, creator_id: creatorId, goods_type: goodsType, quantity }
  })
  if (error) throw error
  return data as any
}

// 追加ポイント購入（100/1,000/10,000/100,000など）
export async function purchaseCheerPoints(
  battleId: string,
  creatorId: string,
  points: number
): Promise<{ success: boolean; points: number; purchased_at: string }> {
  const { data, error } = await supabase.functions.invoke('purchase-cheer-points', {
    body: { battle_id: battleId, creator_id: creatorId, points }
  })
  if (error) throw error
  return data as any
}
