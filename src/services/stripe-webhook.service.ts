import { supabase } from '../services/supabaseClient'
import { AdminNotificationService } from './admin-notification.service'

export interface StripeWebhookEvent {
  id: string
  stripe_event_id: string
  type: string
  payload: Record<string, any>
  processed: boolean
  processed_at?: string
  error?: string
  idempotency_key?: string
  created_at: string
}

export interface PaymentFailure {
  id: string
  user_id?: string
  work_id?: string
  payment_intent_id?: string
  error_code?: string
  error_message?: string
  amount?: number
  created_at: string
}

export class StripeWebhookService {
  // Stripe Webhookイベントを記録
  static async logWebhookEvent(
    stripeEventId: string,
    type: string,
    payload: Record<string, any>,
    idempotencyKey?: string
  ): Promise<StripeWebhookEvent> {
    const { data: event, error } = await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: stripeEventId,
        type,
        payload,
        idempotency_key: idempotencyKey
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to log webhook event: ${error.message}`)
    }

    return event
  }

  // イベントを処理済みにマーク
  static async markEventAsProcessed(
    eventId: string,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      processed: true,
      processed_at: new Date().toISOString()
    }

    if (error) {
      updateData.error = error
    }

    const { error: updateError } = await supabase
      .from('stripe_webhook_events')
      .update(updateData)
      .eq('id', eventId)

    if (updateError) {
      throw new Error(`Failed to mark event as processed: ${updateError.message}`)
    }
  }

  // 未処理のイベントを取得
  static async getUnprocessedEvents(limit = 100): Promise<StripeWebhookEvent[]> {
    const { data, error } = await supabase
      .from('stripe_webhook_events')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch unprocessed events: ${error.message}`)
    }

    return data || []
  }

  // 決済失敗を記録
  static async logPaymentFailure(
    userId?: string,
    workId?: string,
    paymentIntentId?: string,
    errorCode?: string,
    errorMessage?: string,
    amount?: number
  ): Promise<PaymentFailure> {
    const { data: failure, error } = await supabase
      .from('payment_failures')
      .insert({
        user_id: userId,
        work_id: workId,
        payment_intent_id: paymentIntentId,
        error_code: errorCode,
        error_message: errorMessage,
        amount
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to log payment failure: ${error.message}`)
    }

    // 管理者通知を作成
    if (userId && workId && errorMessage && amount) {
      try {
        await AdminNotificationService.notifyPaymentFailure(
          userId,
          workId,
          errorMessage,
          amount
        )
      } catch (notificationError) {
        console.error('Failed to create admin notification for payment failure:', notificationError)
      }
    }

    return failure
  }

  // 決済失敗履歴を取得
  static async getPaymentFailures(
    userId?: string,
    limit = 50
  ): Promise<PaymentFailure[]> {
    let query = supabase
      .from('payment_failures')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch payment failures: ${error.message}`)
    }

    return data || []
  }

  // Stripe Webhookイベントの統計情報
  static async getWebhookStatistics(): Promise<{
    total_events: number
    processed_events: number
    failed_events: number
    by_type: Record<string, number>
    recent_activity: Array<{
      date: string
      count: number
    }>
  }> {
    const { data: events, error } = await supabase
      .from('stripe_webhook_events')
      .select('type, processed, error, created_at')

    if (error) {
      throw new Error(`Failed to fetch webhook statistics: ${error.message}`)
    }

    const stats = {
      total_events: events?.length || 0,
      processed_events: 0,
      failed_events: 0,
      by_type: {} as Record<string, number>,
      recent_activity: [] as Array<{ date: string; count: number }>
    }

    // 日付別のアクティビティを集計するためのマップ
    const dailyActivity = new Map<string, number>()

    events?.forEach(event => {
      if (event.processed) {
        stats.processed_events++
      }
      if (event.error) {
        stats.failed_events++
      }

      // タイプ別の統計
      stats.by_type[event.type] = (stats.by_type[event.type] || 0) + 1

      // 日付別のアクティビティ
      const date = new Date(event.created_at).toISOString().split('T')[0]
      dailyActivity.set(date, (dailyActivity.get(date) || 0) + 1)
    })

    // 最近7日間のアクティビティを配列に変換
    const sortedDates = Array.from(dailyActivity.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, count]) => ({ date, count }))

    stats.recent_activity = sortedDates

    return stats
  }

  // 決済失敗の統計情報
  static async getPaymentFailureStatistics(): Promise<{
    total_failures: number
    by_error_code: Record<string, number>
    total_amount_failed: number
    recent_failures: Array<{
      date: string
      count: number
      amount: number
    }>
  }> {
    const { data: failures, error } = await supabase
      .from('payment_failures')
      .select('error_code, amount, created_at')

    if (error) {
      throw new Error(`Failed to fetch payment failure statistics: ${error.message}`)
    }

    const stats = {
      total_failures: failures?.length || 0,
      by_error_code: {} as Record<string, number>,
      total_amount_failed: 0,
      recent_failures: [] as Array<{ date: string; count: number; amount: number }>
    }

    const dailyFailures = new Map<string, { count: number; amount: number }>()

    failures?.forEach(failure => {
      // エラーコード別の統計
      if (failure.error_code) {
        stats.by_error_code[failure.error_code] = (stats.by_error_code[failure.error_code] || 0) + 1
      }

      // 失敗した金額の合計
      if (failure.amount) {
        stats.total_amount_failed += failure.amount
      }

      // 日付別の失敗
      const date = new Date(failure.created_at).toISOString().split('T')[0]
      const daily = dailyFailures.get(date) || { count: 0, amount: 0 }
      daily.count++
      if (failure.amount) {
        daily.amount += failure.amount
      }
      dailyFailures.set(date, daily)
    })

    // 最近7日間の失敗を配列に変換
    const sortedDates = Array.from(dailyFailures.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, { count, amount }]) => ({ date, count, amount }))

    stats.recent_failures = sortedDates

    return stats
  }

  // 重複チェック: Stripe Event IDが既に存在するかチェック
  static async eventExists(stripeEventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('stripe_webhook_events')
      .select('id')
      .eq('stripe_event_id', stripeEventId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new Error(`Failed to check event existence: ${error.message}`)
    }

    return !!data
  }
}
