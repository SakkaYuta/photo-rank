import { CartItem } from '../contexts/CartContext'
import { getPartnerById } from './partner.service'

export type Factory = {
  id: string
  name: string
  shippingCost: number
}

export type FactoryGroup = {
  factoryId: string | null
  factoryName?: string
  items: CartItem[]
  subtotal: number
  shippingCost: number
  total: number
}

export type ShippingCalculation = {
  factoryGroups: FactoryGroup[]
  totalItems: number
  totalSubtotal: number
  totalShipping: number
  grandTotal: number
}

// 従来の簡易モック（フォールバック用途）
const MOCK_FACTORIES: Record<string, Factory> = {
  'factory-001': { id: 'factory-001', name: 'プリントワークス東京', shippingCost: 300 },
  'factory-002': { id: 'factory-002', name: 'フォトスタジオ大阪', shippingCost: 350 },
  'factory-003': { id: 'factory-003', name: 'アートプリント名古屋', shippingCost: 280 },
}

type PartnerShippingInfo = {
  name: string
  fee_general_jpy?: number
  fee_okinawa_jpy?: number
}

const partnerShippingCache = new Map<string, PartnerShippingInfo>()

async function fetchPartnerShipping(partnerId: string): Promise<PartnerShippingInfo | null> {
  if (!partnerId) return null
  if (partnerShippingCache.has(partnerId)) return partnerShippingCache.get(partnerId) as PartnerShippingInfo
  try {
    const p = await getPartnerById(partnerId)
    if (!p) return null
    const s = (p as any).shipping_info || {}
    const info: PartnerShippingInfo = {
      name: p.company_name || p.name,
      fee_general_jpy: typeof s.fee_general_jpy === 'number' ? s.fee_general_jpy : undefined,
      fee_okinawa_jpy: typeof s.fee_okinawa_jpy === 'number' ? s.fee_okinawa_jpy : undefined,
    }
    partnerShippingCache.set(partnerId, info)
    return info
  } catch {
    return null
  }
}

export class ShippingService {
  /**
   * 工場別にカートアイテムをグループ化し、送料を計算
   */
  static calculateShipping(items: CartItem[]): ShippingCalculation {
    // 従来の同期版（モック送料）
    const groupedItems = this.groupItemsByFactory(items)
    const factoryGroups: FactoryGroup[] = Object.entries(groupedItems).map(([factoryId, groupItems]) => {
      const subtotal = groupItems.reduce((sum, item) => sum + (item.price * item.qty), 0)
      const factory = factoryId !== 'null' ? MOCK_FACTORIES[factoryId] : null
      const shippingCost = factory?.shippingCost || 0
      return {
        factoryId: factoryId === 'null' ? null : factoryId,
        factoryName: factory?.name || '不明な工場',
        items: groupItems,
        subtotal,
        shippingCost,
        total: subtotal + shippingCost,
      }
    })
    const totalItems = items.reduce((sum, item) => sum + item.qty, 0)
    const totalSubtotal = factoryGroups.reduce((sum, g) => sum + g.subtotal, 0)
    const totalShipping = factoryGroups.reduce((sum, g) => sum + g.shippingCost, 0)
    return { factoryGroups, totalItems, totalSubtotal, totalShipping, grandTotal: totalSubtotal + totalShipping }
  }

  /**
   * Supabaseの工場設定（shipping_info）を用いて送料を動的計算（推奨）
   * destinationPref に '沖縄' が含まれる場合は沖縄料金を適用
   */
  static async calculateShippingAsync(items: CartItem[], opts?: { destinationPref?: string }): Promise<ShippingCalculation> {
    const groupedItems = this.groupItemsByFactory(items)
    const factoryGroups: FactoryGroup[] = []
    const isOkinawa = !!opts?.destinationPref && opts.destinationPref.includes('沖縄')
    const FALLBACK_GENERAL = 750
    const FALLBACK_OKINAWA = 1980

    for (const [factoryId, groupItems] of Object.entries(groupedItems)) {
      const subtotal = groupItems.reduce((sum, item) => sum + (item.price * item.qty), 0)
      let shippingCost = 0
      let factoryName = '不明な工場'
      if (factoryId !== 'null') {
        const info = await fetchPartnerShipping(factoryId)
        if (info) {
          factoryName = info.name
          const feeGeneral = (typeof info.fee_general_jpy === 'number') ? info.fee_general_jpy : FALLBACK_GENERAL
          const feeOkinawa = (typeof info.fee_okinawa_jpy === 'number') ? info.fee_okinawa_jpy : FALLBACK_OKINAWA
          const fee = isOkinawa ? feeOkinawa : feeGeneral
          shippingCost = fee
        } else {
          // フォールバック: 固定送料（工場設定未入力など）
          shippingCost = isOkinawa ? FALLBACK_OKINAWA : FALLBACK_GENERAL
        }
      }

      factoryGroups.push({
        factoryId: factoryId === 'null' ? null : factoryId,
        factoryName,
        items: groupItems,
        subtotal,
        shippingCost,
        total: subtotal + shippingCost,
      })
    }

    const totalItems = items.reduce((sum, item) => sum + item.qty, 0)
    const totalSubtotal = factoryGroups.reduce((sum, group) => sum + group.subtotal, 0)
    const totalShipping = factoryGroups.reduce((sum, group) => sum + group.shippingCost, 0)
    const grandTotal = totalSubtotal + totalShipping
    return { factoryGroups, totalItems, totalSubtotal, totalShipping, grandTotal }
  }

  /**
   * カートアイテムを工場IDで分類
   */
  private static groupItemsByFactory(items: CartItem[]): Record<string, CartItem[]> {
    return items.reduce((groups, item) => {
      const factoryId = item.factoryId || 'null'
      if (!groups[factoryId]) {
        groups[factoryId] = []
      }
      groups[factoryId].push(item)
      return groups
    }, {} as Record<string, CartItem[]>)
  }

  /**
   * 工場情報を取得（実際のAPIから取得する想定）
   */
  static async getFactory(factoryId: string): Promise<Factory | null> {
    // 実際の実装では、Supabaseから工場情報を取得
    return MOCK_FACTORIES[factoryId] || null
  }

  /**
   * 全工場リストを取得
   */
  static async getAllFactories(): Promise<Factory[]> {
    // 実際の実装では、Supabaseから全工場情報を取得
    return Object.values(MOCK_FACTORIES)
  }

  /**
   * 送料最適化のための推奨アクション
   */
  static getShippingOptimizationSuggestions(calculation: ShippingCalculation): string[] {
    const suggestions: string[] = []

    if (calculation.factoryGroups.length > 3) {
      suggestions.push('3つ以上の工場から商品を選択しています。送料を節約するため、同じ工場の商品をまとめて購入することをお勧めします。')
    }

    const highShippingGroups = calculation.factoryGroups.filter(g => g.shippingCost > 400)
    if (highShippingGroups.length > 0) {
      suggestions.push('一部の工場で送料が高額です。他の工場の類似商品をご検討ください。')
    }

    return suggestions
  }
}
