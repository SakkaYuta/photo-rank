import { supabase } from '@/services/supabaseClient'
import { RateLimit } from '@/services/rate-limit.service'

export type RefundRequestStatus = 'requested' | 'processing' | 'refunded' | 'rejected' | 'failed'

export interface AdminRefundRequestRow {
  id: string
  purchase_id: string
  user_id: string
  amount: number
  reason?: string | null
  status: RefundRequestStatus
  created_at: string
  updated_at: string
  // Joined fields (optional)
  purchase?: any
  user?: { id: string; email?: string | null; display_name?: string | null } | null
}

export const AdminRefundService = {
  async listRefundRequests(status?: RefundRequestStatus): Promise<AdminRefundRequestRow[]> {
    // Rate limit: list queries per admin to 60/min
    const { data: { user } } = await supabase.auth.getUser()
    const key = `user:${user?.id || 'anon'}:admin:list-refund`
    const allowed = await RateLimit.allow(key, 60, 60)
    if (!allowed) throw new Error('リクエストが多すぎます。しばらくしてから再度お試しください。')
    let query = supabase
      .from('refund_requests')
      .select(`*, purchase:purchases(*), user:users(id,email,display_name)`) // usersにFKがあるため安全にJOIN
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return (data || []) as any
  },

  async updateStatus(id: string, status: RefundRequestStatus, adminNote?: string) {
    if (!id || typeof id !== 'string') throw new Error('無効なIDです')
    if (!['requested','processing','refunded','rejected','failed'].includes(status)) throw new Error('無効なステータスです')
    const { data: { user } } = await supabase.auth.getUser()
    const key = `user:${user?.id || 'anon'}:admin:update-refund`
    const allowed = await RateLimit.allow(key, 30, 60)
    if (!allowed) throw new Error('リクエストが多すぎます。しばらくしてから再度お試しください。')
    const payload: any = { status }
    if (adminNote) payload.admin_note = adminNote
    const { error } = await supabase
      .from('refund_requests')
      .update(payload)
      .eq('id', id)
    if (error) throw error
  },

  async executeRefund(id: string) {
    if (!id || typeof id !== 'string') throw new Error('無効なIDです')
    const { data: { user } } = await supabase.auth.getUser()
    const key = `user:${user?.id || 'anon'}:admin:execute-refund`
    const allowed = await RateLimit.allow(key, 10, 60)
    if (!allowed) throw new Error('操作が制限されました。時間をおいて再度お試しください。')
    // If an Edge Function exists, try to call it first
    try {
      const inv = await supabase.functions.invoke('execute-refund', { body: { refundRequestId: id } })
      if ((inv as any).error) throw (inv as any).error
      return inv.data
    } catch {
      // Fallback: mark as refunded only (no actual payment integration)
      await this.updateStatus(id, 'refunded')
      return { ok: true, mode: 'db-only' }
    }
  }
}
