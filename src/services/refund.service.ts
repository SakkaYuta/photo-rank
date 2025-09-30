import { supabase } from '@/services/supabaseClient'

export type RefundRequest = {
  id: string
  purchase_id: string
  user_id: string
  amount: number
  reason?: string | null
  status: 'requested' | 'processing' | 'refunded' | 'rejected' | 'failed'
  created_at: string
  updated_at: string
}

export const RefundService = {
  async requestRefund(purchaseId: string, amount: number, reason?: string): Promise<RefundRequest> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    // 1) 返金申請を作成
    const { data, error } = await supabase
      .from('refund_requests')
      .insert({ purchase_id: purchaseId, user_id: user.id, amount, reason: reason || null })
      .select('*')
      .single()
    if (error) throw error
    // 2) 購入レコードに返金申請の可視化を反映（ベストエフォート）
    try {
      await supabase
        .from('purchases')
        .update({ refund_status: 'requested', refund_requested_at: new Date().toISOString() })
        .eq('id', purchaseId)
    } catch (_) {}
    return data as RefundRequest
  },

  async listByPurchase(purchaseId: string): Promise<RefundRequest[]> {
    const { data, error } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('purchase_id', purchaseId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
}
