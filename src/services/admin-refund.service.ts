import { supabase } from '@/services/supabaseClient'
import { RateLimit } from '@/services/rate-limit.service'

// v6: state values - 'rejected' は v6 に存在しないため除外
export type RefundRequestStatus = 'requested' | 'processing' | 'processed' | 'failed'

export interface AdminRefundRequestRow {
  id: string
  payment_id: string  // v6: purchase_id → payment_id
  amount_jpy: number  // v6: amount → amount_jpy
  reason?: string | null
  state: RefundRequestStatus  // v6: status → state
  stripe_refund_id?: string | null
  processed_at?: string | null
  created_at: string
  // Joined fields (optional)
  payment?: any
  user?: { id: string; email?: string | null; display_name?: string | null } | null
}

export const AdminRefundService = {
  async listRefundRequests(state?: RefundRequestStatus): Promise<AdminRefundRequestRow[]> {
    // Rate limit: list queries per admin to 60/min
    const { data: { user } } = await supabase.auth.getUser()
    const key = `user:${user?.id || 'anon'}:admin:list-refund`
    const allowed = await RateLimit.allow(key, 60, 60)
    if (!allowed) throw new Error('リクエストが多すぎます。しばらくしてから再度お試しください。')

    // v6: refunds テーブルから直接取得（payment_idでusersを結合）
    let query = supabase
      .from('refunds')
      .select(`
        *,
        payment:payments!inner(id, order_id, orders!inner(user_id, users(id, email)))
      `)
      .order('created_at', { ascending: false })

    if (state) query = query.eq('state', state)

    const { data, error } = await query
    if (error) throw error

    // データ整形: payment.orders.users を user フィールドに展開
    return (data || []).map((r: any) => ({
      ...r,
      user: r?.payment?.orders?.users || null
    })) as any
  },

  async updateStatus(id: string, state: RefundRequestStatus, adminNote?: string) {
    if (!id || typeof id !== 'string') throw new Error('無効なIDです')
    if (!['requested','processing','processed','failed'].includes(state)) throw new Error('無効なステータスです')
    const { data: { user } } = await supabase.auth.getUser()
    const key = `user:${user?.id || 'anon'}:admin:update-refund`
    const allowed = await RateLimit.allow(key, 30, 60)
    if (!allowed) throw new Error('リクエストが多すぎます。しばらくしてから再度お試しください。')

    // v6: refunds テーブルへ直接更新
    const { error } = await supabase
      .from('refunds')
      .update({
        state,  // v6では state をそのまま使用
        reason: adminNote || null,
        processed_at: state === 'processed' ? new Date().toISOString() : null
      })
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
      // Fallback: mark as processed only (no actual payment integration)
      await this.updateStatus(id, 'processed')  // v6: 'refunded' → 'processed'
      return { ok: true, mode: 'db-only' }
    }
  }
}
