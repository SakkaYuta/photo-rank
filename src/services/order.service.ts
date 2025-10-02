import { supabase } from './supabaseClient'
import { isDemoEnabled } from '../utils/demo'
import type { Purchase, OrderStatus, ShippingProvider } from '../types/work.types'

export class OrderService {
  // 注文履歴取得 (v6: purchases_vw 使用)
  static async getOrderHistory(userId: string): Promise<(Purchase & { work: any })[]> {
    if (isDemoEnabled()) {
      const { SAMPLE_ORDERS } = await import('@/sample/ordersSamples')
      return SAMPLE_ORDERS.map(o => ({ ...o, user_id: userId }))
    }
    // v6: purchases_vw を使用（work_title, work_image_url を含む）
    const { data, error } = await supabase
      .from('purchases_vw')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // v6: work オブジェクトを構築（purchases_vw から）
    return (data || []).map((p: any) => ({
      ...p,
      purchased_at: p.created_at,  // v6では created_at
      work: {
        id: p.work_id,
        title: p.work_title,
        image_url: p.work_image_url,
        thumbnail_url: p.work_image_url,
      }
    }))
  }

  // 注文詳細取得 (v6: purchases_vw 使用)
  static async getOrderDetail(purchaseId: string): Promise<Purchase & { work: any } | null> {
    if (isDemoEnabled()) {
      const { SAMPLE_ORDERS } = await import('@/sample/ordersSamples')
      return SAMPLE_ORDERS.find(o => o.id === purchaseId) || null
    }
    // v6: purchases_vw から取得
    const { data, error } = await supabase
      .from('purchases_vw')
      .select('*')
      .eq('id', purchaseId)
      .single()

    if (error) throw error

    // v6: work オブジェクトを構築
    return data ? {
      ...data,
      purchased_at: data.created_at,
      work: {
        id: data.work_id,
        title: data.work_title,
        image_url: data.work_image_url,
        thumbnail_url: data.work_image_url,
      }
    } : null
  }

  // 注文ステータス履歴取得 (v6: order_status_history は存在しないためモックのみ)
  static async getStatusHistory(purchaseId: string): Promise<OrderStatus[]> {
    if (isDemoEnabled()) {
      const { SAMPLE_STATUS_HISTORY } = await import('@/sample/ordersSamples')
      return SAMPLE_STATUS_HISTORY(purchaseId)
    }
    // v6: order_status_history テーブルは存在しないため、常にモックデータを返す
    // TODO: v6で履歴管理が必要な場合は audit_logs から構築
    console.warn('order_status_history not implemented in v6, using mock data')
    return this.getMockStatusHistory(purchaseId)
  }

  // モックステータス履歴（テーブル未作成時用）
  private static getMockStatusHistory(purchaseId: string): OrderStatus[] {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    return [
      {
        id: `${purchaseId}_1`,
        purchase_id: purchaseId,
        status: 'confirmed',
        message: '注文を受け付けました',
        created_at: twoDaysAgo.toISOString()
      },
      {
        id: `${purchaseId}_2`,
        purchase_id: purchaseId,
        status: 'processing',
        message: '印刷工場で制作中です',
        created_at: yesterday.toISOString()
      },
      {
        id: `${purchaseId}_3`,
        purchase_id: purchaseId,
        status: 'shipped',
        message: '商品を発送しました',
        created_at: now.toISOString()
      }
    ]
  }

  // 追跡番号更新 (v6: shipments テーブル経由)
  static async updateTrackingNumber(purchaseId: string, trackingNumber: string, shippedAt?: string): Promise<void> {
    // v6: purchases_vw は読み取り専用なので、実際には shipments テーブルを更新
    // purchaseId → order_item_id → shipment の解決が必要
    // TODO: v6では shipments.tracking_number を更新する適切な実装が必要
    console.warn('updateTrackingNumber not fully implemented for v6 schema')
    // 暫定: 何もしない（追跡番号更新は工場側で行う想定）
  }

  // 注文ステータス更新 (v6: orders.status 更新)
  static async updateOrderStatus(
    purchaseId: string,
    status: Purchase['status'],
    message?: string
  ): Promise<void> {
    // v6: purchases_vw は読み取り専用、実際には orders.status を更新
    // purchaseId は実際には order.id に相当
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', purchaseId)

    if (orderError) {
      console.warn('Failed to update order status:', orderError)
      throw orderError
    }

    // v6: order_status_history は存在しないため、履歴記録はスキップ
    // TODO: 必要であれば audit_logs に記録
  }

  // 配送業者情報取得
  static async getShippingProviders(): Promise<ShippingProvider[]> {
    // モックデータ（実際の実装では設定テーブルから取得）
    return [
      {
        id: 'yamato',
        name: 'ヤマト運輸',
        tracking_url_template: 'https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number={tracking_number}',
        active: true
      },
      {
        id: 'sagawa',
        name: '佐川急便',
        tracking_url_template: 'https://k2k.sagawa-exp.co.jp/p/sagawa/web/okurijoinput.jsp?ono={tracking_number}',
        active: true
      },
      {
        id: 'jppost',
        name: '日本郵便',
        tracking_url_template: 'https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1={tracking_number}',
        active: true
      }
    ]
  }

  // 追跡URL生成
  static generateTrackingUrl(trackingNumber: string, provider?: string): string | null {
    if (!trackingNumber) return null

    // 追跡番号の形式から配送業者を推定
    const detectedProvider = provider || this.detectShippingProvider(trackingNumber)

    const providers: { [key: string]: string } = {
      yamato: 'https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number={tracking_number}',
      sagawa: 'https://k2k.sagawa-exp.co.jp/p/sagawa/web/okurijoinput.jsp?ono={tracking_number}',
      jppost: 'https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1={tracking_number}'
    }

    const template = providers[detectedProvider]
    return template ? template.replace('{tracking_number}', trackingNumber) : null
  }

  // 追跡番号形式から配送業者推定
  private static detectShippingProvider(trackingNumber: string): string {
    // ヤマト運輸: 数字12桁
    if (/^\d{12}$/.test(trackingNumber)) return 'yamato'

    // 佐川急便: 数字11-12桁
    if (/^\d{11,12}$/.test(trackingNumber)) return 'sagawa'

    // 日本郵便: 英数字13桁（例：1234567890123）
    if (/^[A-Z0-9]{13}$/.test(trackingNumber)) return 'jppost'

    // デフォルトはヤマト運輸
    return 'yamato'
  }

  // 注文ステータスの日本語変換
  static getStatusLabel(status?: string): string {
    const labels: { [key: string]: string } = {
      pending: '注文確認中',
      confirmed: '注文確定',
      processing: '制作中',
      shipped: '発送済み',
      delivered: '配達完了',
      cancelled: 'キャンセル'
    }
    return labels[status || 'pending'] || '不明'
  }

  // ステータスアイコン取得
  static getStatusIcon(status?: string): string {
    const icons: { [key: string]: string } = {
      pending: '⏳',
      confirmed: '✅',
      processing: '🏭',
      shipped: '🚚',
      delivered: '📦',
      cancelled: '❌'
    }
    return icons[status || 'pending'] || '❓'
  }

  // ステータスの進捗パーセンテージ
  static getProgressPercentage(status?: string): number {
    const progress: { [key: string]: number } = {
      pending: 10,
      confirmed: 25,
      processing: 50,
      shipped: 75,
      delivered: 100,
      cancelled: 0
    }
    return progress[status || 'pending'] || 0
  }
}
