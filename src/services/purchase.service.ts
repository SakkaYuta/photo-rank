import { supabase } from './supabaseClient'
import { acquireWorkLock, releaseWorkLock, createPaymentIntent } from './payment.service'

export type PurchaseFlowResult = {
  status: 'requires_payment' | 'processing' | 'completed' | 'failed'
  clientSecret?: string
  workId?: string
  purchaseId?: string
  error?: string
}

export type BulkPurchaseFlowResult = {
  status: 'requires_payment' | 'processing' | 'completed' | 'failed'
  clientSecret?: string
  workIds?: string[]
  purchaseIds?: string[]
  error?: string
  failedItems?: { workId: string; error: string }[]
}

export class PurchaseService {
  // 単一商品購入
  async initiatePurchase(workId: string, addressId?: string): Promise<PurchaseFlowResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { status: 'failed', error: 'ログインが必要です' }

      const lock = await acquireWorkLock(workId)
      if (!lock.locked) return { status: 'failed', error: '在庫がありません（別の購入手続き中）' }

      const { clientSecret } = await createPaymentIntent(workId, addressId)
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
        .from('purchases_vw')
        .select('id, work_id, status, payment_status, stripe_payment_intent_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle()
      if (data && (data as any).payment_status === 'captured') {
        return { status: 'completed', purchaseId: (data as any).id, workId: (data as any).work_id }
      }
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, intervalMs))
    }
    return { status: 'processing', error: '購入処理の確認がタイムアウトしました' }
  }

  // 一括購入
  async initiateBulkPurchase(workIds: string[], addressId?: string): Promise<BulkPurchaseFlowResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { status: 'failed', error: 'ログインが必要です' }

      if (workIds.length === 0) {
        return { status: 'failed', error: '購入する商品が選択されていません' }
      }

      // 一括ロック取得を試行
      const locks = await Promise.allSettled(
        workIds.map(workId => acquireWorkLock(workId))
      )

      const successfulLocks: string[] = []
      const failedItems: { workId: string; error: string }[] = []

      locks.forEach((result, index) => {
        const workId = workIds[index]
        if (result.status === 'fulfilled' && result.value.locked) {
          successfulLocks.push(workId)
        } else {
          const error = result.status === 'rejected'
            ? result.reason?.message || 'ロック取得に失敗しました'
            : '在庫がありません（別の購入手続き中）'
          failedItems.push({ workId, error })
        }
      })

      if (successfulLocks.length === 0) {
        return {
          status: 'failed',
          error: '全ての商品が購入できません',
          failedItems
        }
      }

      try {
        // 一括決済Intent作成
        const { clientSecret } = await this.createBulkPaymentIntent(successfulLocks, addressId)
        if (!clientSecret) {
          // ロック解除
          await Promise.allSettled(
            successfulLocks.map(workId => releaseWorkLock(workId))
          )
          return { status: 'failed', error: '決済の準備に失敗しました' }
        }

        return {
          status: 'requires_payment',
          clientSecret,
          workIds: successfulLocks,
          failedItems: failedItems.length > 0 ? failedItems : undefined
        }
      } catch (e: any) {
        // ロック解除
        await Promise.allSettled(
          successfulLocks.map(workId => releaseWorkLock(workId))
        )
        return { status: 'failed', error: e?.message || '一括決済の準備に失敗しました' }
      }
    } catch (e: any) {
      return { status: 'failed', error: e?.message || '一括購入処理に失敗しました' }
    }
  }

  // 一括決済完了確認
  async checkBulkPurchaseCompletion(paymentIntentId: string, maxAttempts = 10, intervalMs = 2000): Promise<BulkPurchaseFlowResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await supabase
        .from('purchases_vw')
        .select('id, work_id, status, payment_status, stripe_payment_intent_id')
        .eq('stripe_payment_intent_id', paymentIntentId)

      if (data && data.length > 0) {
        const completedItems = (data as any[]).filter((item) => item.payment_status === 'captured')
        if (completedItems.length === (data as any[]).length) {
          return {
            status: 'completed',
            purchaseIds: completedItems.map((item: any) => item.id),
            workIds: completedItems.map((item: any) => item.work_id)
          }
        }
      }
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, intervalMs))
    }
    return { status: 'processing', error: '一括購入処理の確認がタイムアウトしました' }
  }

  // 一括決済Intent作成（内部メソッド）
  private async createBulkPaymentIntent(workIds: string[], addressId?: string) {
    const { data, error } = await supabase.functions.invoke('create-bulk-payment-intent', {
      body: { workIds, userId: (await supabase.auth.getUser()).data.user?.id, addressId },
    })
    if (error) throw error
    const clientSecret = (data as any).clientSecret ?? (data as any).client_secret
    return { clientSecret }
  }

  // 追跡番号自動生成（デモ用）
  static generateMockTrackingNumber(): string {
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `${timestamp}${random}` // 12桁の追跡番号
  }

  // 購入完了後の追跡番号自動設定（デモ用）
  static async setMockTrackingForRecentPurchases(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 追跡番号がない最近の購入を取得
      const { data: purchases } = await supabase
        .from('purchases_vw')
        .select('id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!purchases || purchases.length === 0) return

      // 追跡番号を設定
      for (const purchase of purchases) {
        const trackingNumber = this.generateMockTrackingNumber()
        const shippedAt = new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
        // v6: 追跡番号の直接更新は非対応（shipments 管理）。デモ用のため今回はスキップ。
      }
    } catch (error) {
      console.error('Failed to set mock tracking numbers:', error)
    }
  }
}

export const purchaseService = new PurchaseService()
