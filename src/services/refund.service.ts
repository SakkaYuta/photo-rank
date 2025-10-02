import { supabase } from '@/services/supabaseClient'

export type RefundRequest = {
  id: string
  payment_id: string  // v6: purchase_id → payment_id
  amount_jpy: number  // v6: amount → amount_jpy
  reason?: string | null
  state: 'requested' | 'processing' | 'processed' | 'failed'  // v6: status → state, refunded → processed
  stripe_refund_id?: string | null
  processed_at?: string | null
  created_at: string
}

export const RefundService = {
  async requestRefund(paymentId: string, amountJpy: number, reason?: string): Promise<RefundRequest> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // v6: refunds テーブルへ直接INSERT
    const { data, error } = await supabase
      .from('refunds')
      .insert({
        payment_id: paymentId,  // v6では payment_id
        amount_jpy: amountJpy,  // v6では amount_jpy
        reason: reason || null,
        state: 'requested'  // v6では state
      })
      .select('*')
      .single()
    if (error) throw error
    return data as RefundRequest
  },

  async listByPayment(paymentId: string): Promise<RefundRequest[]> {
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
}
