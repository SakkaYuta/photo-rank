import { supabase } from '../services/supabaseClient'
import { validateInput, ObjectSchemas } from '../utils/validation'

export type NotificationType = 'order_created' | 'order_updated' | 'order_cancelled' | 'payment_received'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retry'
export type NotificationPriority = 'high' | 'normal' | 'low'

export interface NotificationPayload {
  order_id: string
  order_number: string
  status?: string
  amount?: number
  product_type?: string
  quantity?: number
  user_id?: string
  timestamp?: string
  metadata?: Record<string, string | number | boolean>
}

export interface NotifyPartnerRequest {
  partner_id: string
  notification_type: NotificationType
  payload: NotificationPayload
  priority?: NotificationPriority
}

export interface PartnerNotification {
  id: string
  partner_id: string
  notification_type: NotificationType
  payload: NotificationPayload
  status: NotificationStatus
  attempts: number
  next_retry_at?: string
  sent_at?: string
  response_code?: number
  response_body?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export class NotificationService {
  /**
   * パートナーに通知を送信
   */
  static async notifyPartner(request: NotifyPartnerRequest): Promise<{
    success: boolean
    notification_id?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('notify-partner', {
        body: request
      })

      if (error) {
        throw error
      }

      return data
    } catch (error: any) {
      console.error('Failed to notify partner:', error)
      return {
        success: false,
        error: error?.message || 'Unknown error'
      }
    }
  }

  /**
   * 注文作成通知
   */
  static async notifyOrderCreated(
    partnerId: string,
    orderId: string,
    orderNumber: string,
    amount: number,
    metadata?: Record<string, any>
  ) {
    return this.notifyPartner({
      partner_id: partnerId,
      notification_type: 'order_created',
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        amount,
        metadata
      },
      priority: 'high'
    })
  }

  /**
   * 注文更新通知
   */
  static async notifyOrderUpdated(
    partnerId: string,
    orderId: string,
    orderNumber: string,
    status: string,
    metadata?: Record<string, any>
  ) {
    return this.notifyPartner({
      partner_id: partnerId,
      notification_type: 'order_updated',
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        status,
        metadata
      },
      priority: 'normal'
    })
  }

  /**
   * 注文キャンセル通知
   */
  static async notifyOrderCancelled(
    partnerId: string,
    orderId: string,
    orderNumber: string,
    metadata?: Record<string, any>
  ) {
    return this.notifyPartner({
      partner_id: partnerId,
      notification_type: 'order_cancelled',
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        metadata
      },
      priority: 'high'
    })
  }

  /**
   * 支払い受領通知
   */
  static async notifyPaymentReceived(
    partnerId: string,
    orderId: string,
    orderNumber: string,
    amount: number,
    metadata?: Record<string, any>
  ) {
    return this.notifyPartner({
      partner_id: partnerId,
      notification_type: 'payment_received',
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        amount,
        metadata
      },
      priority: 'normal'
    })
  }

  /**
   * パートナーの通知履歴を取得
   */
  static async getPartnerNotifications(
    partnerId: string,
    limit: number = 50
  ): Promise<PartnerNotification[]> {
    try {
      const { data, error } = await supabase
        .from('partner_notifications')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Failed to get partner notifications:', error)
      return []
    }
  }

  /**
   * 通知の詳細を取得
   */
  static async getNotificationById(notificationId: string): Promise<PartnerNotification | null> {
    try {
      const { data, error } = await supabase
        .from('partner_notifications')
        .select('*')
        .eq('id', notificationId)
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Failed to get notification:', error)
      return null
    }
  }

  /**
   * 失敗した通知を再送信
   */
  static async retryNotification(notificationId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('retry-notification', {
        body: { notification_id: notificationId }
      })

      if (error) {
        throw error
      }

      return data
    } catch (error: any) {
      console.error('Failed to retry notification:', error)
      return {
        success: false,
        error: error?.message || 'Unknown error'
      }
    }
  }

  /**
   * 通知統計を取得
   */
  static async getNotificationStats(partnerId: string): Promise<{
    total: number
    sent: number
    failed: number
    pending: number
    retry: number
  }> {
    try {
      const { data, error } = await supabase
        .from('partner_notifications')
        .select('status')
        .eq('partner_id', partnerId)

      if (error) {
        throw error
      }

      const stats = {
        total: data.length,
        sent: 0,
        failed: 0,
        pending: 0,
        retry: 0
      }

      data.forEach(notification => {
        stats[notification.status as keyof typeof stats]++
      })

      return stats
    } catch (error) {
      console.error('Failed to get notification stats:', error)
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        retry: 0
      }
    }
  }
}
