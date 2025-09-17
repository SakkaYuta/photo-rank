import { supabase } from '../services/supabaseClient'

export type AdminNotificationSeverity = 'low' | 'normal' | 'high' | 'critical'

export type AdminNotificationType =
  | 'payment_failure'
  | 'partner_approval_needed'
  | 'system_error'
  | 'security_alert'
  | 'performance_warning'
  | 'content_moderation'

export interface AdminNotification {
  id: string
  type: AdminNotificationType
  severity: AdminNotificationSeverity
  title: string
  description?: string
  metadata?: Record<string, any>
  read: boolean
  created_at: string
}

export interface CreateAdminNotificationRequest {
  type: AdminNotificationType
  severity?: AdminNotificationSeverity
  title: string
  description?: string
  metadata?: Record<string, any>
}

export class AdminNotificationService {
  // 管理者通知を作成
  static async createNotification(data: CreateAdminNotificationRequest): Promise<AdminNotification> {
    const { data: notification, error } = await supabase
      .from('admin_notifications')
      .insert({
        type: data.type,
        severity: data.severity || 'normal',
        title: data.title,
        description: data.description,
        metadata: data.metadata
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create admin notification: ${error.message}`)
    }

    return notification
  }

  // 管理者通知を取得
  static async getNotifications(
    limit = 50,
    unreadOnly = false
  ): Promise<AdminNotification[]> {
    let query = supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch admin notifications: ${error.message}`)
    }

    return data || []
  }

  // 通知を既読にマーク
  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`)
    }
  }

  // 複数の通知を既読にマーク
  static async markMultipleAsRead(notificationIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true })
      .in('id', notificationIds)

    if (error) {
      throw new Error(`Failed to mark notifications as read: ${error.message}`)
    }
  }

  // 未読通知数を取得
  static async getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`)
    }

    return count || 0
  }

  // 通知を削除
  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`)
    }
  }

  // 重要度別の統計情報を取得
  static async getStatistics(): Promise<{
    total: number
    unread: number
    by_severity: Record<AdminNotificationSeverity, number>
    by_type: Record<string, number>
  }> {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('severity, type, read')

    if (error) {
      throw new Error(`Failed to get notification statistics: ${error.message}`)
    }

    const stats = {
      total: data?.length || 0,
      unread: 0,
      by_severity: {
        low: 0,
        normal: 0,
        high: 0,
        critical: 0
      } as Record<AdminNotificationSeverity, number>,
      by_type: {} as Record<string, number>
    }

    data?.forEach(notification => {
      if (!notification.read) {
        stats.unread++
      }
      stats.by_severity[notification.severity as AdminNotificationSeverity]++
      stats.by_type[notification.type] = (stats.by_type[notification.type] || 0) + 1
    })

    return stats
  }

  // 便利メソッド: 決済失敗通知
  static async notifyPaymentFailure(
    userId: string,
    workId: string,
    errorMessage: string,
    amount: number
  ): Promise<AdminNotification> {
    return this.createNotification({
      type: 'payment_failure',
      severity: 'high',
      title: '決済エラーが発生しました',
      description: `ユーザー決済が失敗しました: ${errorMessage}`,
      metadata: {
        user_id: userId,
        work_id: workId,
        amount,
        error_message: errorMessage
      }
    })
  }

  // 便利メソッド: パートナー承認要求通知
  static async notifyPartnerApprovalNeeded(
    partnerId: string,
    partnerName: string
  ): Promise<AdminNotification> {
    return this.createNotification({
      type: 'partner_approval_needed',
      severity: 'normal',
      title: '新しいパートナー申請',
      description: `${partnerName}からの製造パートナー申請が承認待ちです`,
      metadata: {
        partner_id: partnerId,
        partner_name: partnerName
      }
    })
  }

  // 便利メソッド: システムエラー通知
  static async notifySystemError(
    component: string,
    errorMessage: string,
    metadata?: Record<string, any>
  ): Promise<AdminNotification> {
    return this.createNotification({
      type: 'system_error',
      severity: 'critical',
      title: 'システムエラーが発生',
      description: `${component}でエラー: ${errorMessage}`,
      metadata: {
        component,
        error_message: errorMessage,
        ...metadata
      }
    })
  }
}
