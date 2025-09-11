import { supabase } from './supabaseClient'
import { acquireWorkLock, releaseWorkLock, createPaymentIntent } from './payment.service'

export type PurchaseFlowResult = {
  status: 'requires_payment' | 'processing' | 'completed' | 'failed'
  clientSecret?: string
  workId?: string
  purchaseId?: string
  error?: string
}

export class PurchaseService {
  async initiatePurchase(workId: string): Promise<PurchaseFlowResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { status: 'failed', error: 'ログインが必要です' }

      const lock = await acquireWorkLock(workId)
      if (!lock.locked) return { status: 'failed', error: '在庫がありません（別の購入手続き中）' }

      const { clientSecret } = await createPaymentIntent(workId)
      if (!clientSecret) {
        await releaseWorkLock(workId)
        return { status: 'failed', error: '決済の準備に失敗しました' }
      }
      return { status: 'requires_payment', clientSecret, workId }
    } catch (e: any) {
      try { await releaseWorkLock(workId) } catch {}
      return { status: 'failed', error: e?.message || '購入処理に失敗しました' }
    }
  }

  async checkPurchaseCompletion(paymentIntentId: string, maxAttempts = 10, intervalMs = 2000): Promise<PurchaseFlowResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await supabase
        .from('purchases')
        .select('id, work_id, status, stripe_payment_intent_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()
      if (data && data.status === 'paid') {
        return { status: 'completed', purchaseId: data.id, workId: data.work_id }
      }
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, intervalMs))
    }
    return { status: 'processing', error: '購入処理の確認がタイムアウトしました' }
  }
}

export const purchaseService = new PurchaseService()

