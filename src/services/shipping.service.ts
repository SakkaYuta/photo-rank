import { CartItem } from '../contexts/CartContext'

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

// モックファクトリーデータ（実際のデータベースから取得する）
const MOCK_FACTORIES: Record<string, Factory> = {
  'factory-001': { id: 'factory-001', name: 'プリントワークス東京', shippingCost: 300 },
  'factory-002': { id: 'factory-002', name: 'フォトスタジオ大阪', shippingCost: 350 },
  'factory-003': { id: 'factory-003', name: 'アートプリント名古屋', shippingCost: 280 },
}

export class ShippingService {
  /**
   * 工場別にカートアイテムをグループ化し、送料を計算
   */
  static calculateShipping(items: CartItem[]): ShippingCalculation {
    // 工場別にアイテムをグループ化
    const groupedItems = this.groupItemsByFactory(items)

    // 各グループの計算
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
        total: subtotal + shippingCost
      }
    })

    // 全体の集計
    const totalItems = items.reduce((sum, item) => sum + item.qty, 0)
    const totalSubtotal = factoryGroups.reduce((sum, group) => sum + group.subtotal, 0)
    const totalShipping = factoryGroups.reduce((sum, group) => sum + group.shippingCost, 0)
    const grandTotal = totalSubtotal + totalShipping

    return {
      factoryGroups,
      totalItems,
      totalSubtotal,
      totalShipping,
      grandTotal
    }
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