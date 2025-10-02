import { supabase } from '@/services/supabaseClient'
import { isDemoEnabled } from '@/utils/demo'
import type {
  FactoryProduct,
  ManufacturingOrder,
  ManufacturingPartner,
} from '@/types/partner.types'

// 見積もり型（既存型を拡張）
export interface FactoryQuote {
  partner: ManufacturingPartner
  product: FactoryProduct
  unitPrice: number
  totalAmount: number
  leadTime: number
  isExpress: boolean
  expressSurcharge: number
  score: number
  features: string[]
  specialOffer?: string
}

// スコア計算用の正規化パラメータ
interface ScoreNormalization {
  minPrice: number
  maxPrice: number
  minLeadTime: number
  maxLeadTime: number
}

// ===== API関数 =====

/**
 * 製造パートナー一覧取得（approvedのみ or 指定ステータス）
 */
export const getManufacturingPartners = async (
  status?: 'approved' | 'pending' | 'suspended'
): Promise<ManufacturingPartner[]> => {
  // サンプルモードの簡易パートナー
  if (isDemoEnabled()) {
    const now = new Date().toISOString()
    return [
      { id: 'demo-factory-1', name: 'デモ工場 東京', contact_email: 'tokyo@example.com', status: 'approved', average_rating: 4.6, total_orders: 120, created_at: now, updated_at: now } as any,
      { id: 'demo-factory-2', name: 'デモ工場 大阪', contact_email: 'osaka@example.com', status: 'approved', average_rating: 4.4, total_orders: 95, created_at: now, updated_at: now } as any,
      { id: 'demo-factory-3', name: 'デモ工場 名古屋', contact_email: 'nagoya@example.com', status: 'approved', average_rating: 4.2, total_orders: 60, created_at: now, updated_at: now } as any,
    ]
  }
  // DB定義: v5.0では列名が avg_rating（numeric）/ ratings_count（int）
  // UI型: average_rating / total_orders を使用
  // 並び順は rating 相当の降順（avg_rating を優先。無ければcreated_atで代替）
  try {
    let query = supabase
      .from('manufacturing_partners')
      .select('*')

    if (status) query = query.eq('status', status)

    // avg_rating 列が存在しない環境でも失敗しないよう、orderは後置きでtryする
    let { data, error } = await query.order('avg_rating' as any, { ascending: false })
    if (error) {
      // フォールバック: created_at 降順
      const fallback = await supabase
        .from('manufacturing_partners')
        .select('*')
        .order('created_at', { ascending: false })
      if (fallback.error) throw fallback.error
      data = fallback.data
    }

    return (data || []) as ManufacturingPartner[]
  } catch (error) {
    console.error('Error in getManufacturingPartners:', error)
    throw error
  }
}

/**
 * 見積もり取得（N+1回避：一括取得→メモリ処理）
 */
export const getFactoryQuotes = async (
  productType: string,
  quantity: number,
  requiredDate?: Date
): Promise<FactoryQuote[]> => {
  try {
    // サンプルモードはDB照会を行わず、完全にデモ見積もりを返す
    if (isDemoEnabled()) {
      const now = new Date().toISOString()
      const demoPartners: ManufacturingPartner[] = [
        { id: 'demo-factory-1', name: 'デモ工場 東京', contact_email: 'tokyo@example.com', status: 'approved', average_rating: 4.6, total_orders: 120, created_at: now, updated_at: now } as any,
        { id: 'demo-factory-2', name: 'デモ工場 大阪', contact_email: 'osaka@example.com', status: 'approved', average_rating: 4.4, total_orders: 95, created_at: now, updated_at: now } as any,
        { id: 'demo-factory-3', name: 'デモ工場 名古屋', contact_email: 'nagoya@example.com', status: 'approved', average_rating: 4.2, total_orders: 60, created_at: now, updated_at: now } as any,
      ]
      const quotes = demoPartners.map((partner, idx) => {
        const product: FactoryProduct = {
          id: `demo-prod-${idx+1}`,
          partner_id: partner.id,
          product_type: productType,
          base_cost: productType === 'tshirt' ? 1500 + idx * 50 : productType === 'mug' ? 800 + idx * 30 : 1200 + idx * 40,
          lead_time_days: 5 + idx * 2,
          minimum_quantity: 1,
          maximum_quantity: 1000,
          options: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        }
        const unitPrice = product.base_cost
        const totalAmount = unitPrice * quantity
        const features = ['高発色プリント', '国内出荷']
        return {
          partner,
          product,
          unitPrice,
          totalAmount,
          leadTime: product.lead_time_days,
          isExpress: false,
          expressSurcharge: 0,
          score: 0,
          features,
        } as FactoryQuote
      })
      calculateNormalizedScores(quotes)
      return quotes.sort((a, b) => b.score - a.score)
    }
    // 1) 承認済みパートナーを一括取得
    const partners = await getManufacturingPartners('approved')
    if (partners.length === 0) {
      // パートナーが居ない環境ではサンプルで見積もりを返却
      if (isDemoEnabled()) {
        const now = new Date().toISOString()
        const demoPartners: ManufacturingPartner[] = [
          { id: 'demo-factory-1', name: 'デモ工場 東京', contact_email: 'tokyo@example.com', status: 'approved', average_rating: 4.6, total_orders: 120, created_at: now, updated_at: now } as any,
          { id: 'demo-factory-2', name: 'デモ工場 大阪', contact_email: 'osaka@example.com', status: 'approved', average_rating: 4.4, total_orders: 95, created_at: now, updated_at: now } as any,
        ]
        const quotes = demoPartners.map((partner, idx) => {
          const product: FactoryProduct = {
            id: `demo-prod-${idx+1}`,
            partner_id: partner.id,
            product_type: productType,
            base_cost: productType === 'tshirt' ? 1500 : productType === 'mug' ? 800 : 1200,
            lead_time_days: 5 + idx * 2,
            minimum_quantity: 1,
            maximum_quantity: 1000,
            options: null,
            is_active: true,
            created_at: now,
            updated_at: now,
          }
          const unitPrice = product.base_cost
          const totalAmount = unitPrice * quantity
          const features = ['高発色プリント', '国内出荷']
          return {
            partner,
            product,
            unitPrice,
            totalAmount,
            leadTime: product.lead_time_days,
            isExpress: false,
            expressSurcharge: 0,
            score: 0,
            features,
          } as FactoryQuote
        })
        calculateNormalizedScores(quotes)
        return quotes.sort((a, b) => b.score - a.score)
      }
      return []
    }
    const partnerIds = partners.map((p) => p.id)

    // 2) 対象商品の一括取得
    const { data: productsRows, error } = await supabase
      .from('factory_products_vw')
      .select('id, factory_id, name, base_price_jpy, options, lead_time_days, created_at')
      .in('factory_id', partnerIds)
    if (error) throw error
    // 粗く productType でフィルタ
    let productsData = ((productsRows || [])
      .filter((r: any) => {
        const name = (r.name || '').toString().toLowerCase()
        const optType = (r.options?.product_type || '').toString().toLowerCase()
        const want = (productType || '').toLowerCase()
        return name.includes(want) || optType.includes(want)
      })
      .map((r: any) => ({
        id: r.id,
        partner_id: r.factory_id,
        product_type: r.name,
        base_cost: r.base_price_jpy,
        lead_time_days: r.lead_time_days ?? 7,
        minimum_quantity: 1,
        maximum_quantity: 1000,
        options: r.options,
        is_active: true,
        created_at: r.created_at,
        updated_at: r.created_at,
      })) as FactoryProduct[])
    if (productsData.length === 0) {
      if (isSampleMode()) {
        // パートナーは居るが対象商品が無い → サンプル製品を合成
        const now = new Date().toISOString()
        const synthetic: FactoryProduct[] = partners.map((p, i) => ({
          id: `demo-prod-${i+1}`,
          partner_id: p.id,
          product_type: productType,
          base_cost: productType === 'tshirt' ? 1600 : productType === 'mug' ? 850 : 1300,
          lead_time_days: 7 + i,
          minimum_quantity: 1,
          maximum_quantity: 1000,
          options: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        }))
        productsData = synthetic
      } else {
        return []
      }
    }

    // 3) パートナーIDでグルーピング
    const productsByPartner = (productsData as FactoryProduct[]).reduce(
      (acc, product) => {
        ;(acc[product.partner_id] ||= []).push(product)
        return acc
      },
      {} as Record<string, FactoryProduct[]>
    )

    // 4) 見積り生成
    const quotes: FactoryQuote[] = []
    for (const partner of partners) {
      const partnerProducts = productsByPartner[partner.id] || []
      for (const product of partnerProducts) {
        // 単価: base_cost を使用（段階価格が必要なら将来 options/price_history から拡張）
        let unitPrice = normalizeCurrency(product.base_cost)

        // リードタイム: lead_time_days
        let leadTime = (product.lead_time_days as number) ?? 7

        // 特急: 現行スキーマには express 系列が無いので無効
        const isExpress = false
        const expressSurcharge = 0
        let specialOffer: string | undefined

        // 初回割引などの拡張が必要なら capabilities/options から判定（現行は未実装）

        // requiredDate からの納期判定は isExpress を持たないためスコアのみに影響（現状はロジック無し）

        const totalAmount = Math.round(unitPrice * quantity)
        const features = extractPartnerFeatures(partner, product)

        quotes.push({
          partner,
          product,
          unitPrice,
          totalAmount,
          leadTime,
          isExpress,
          expressSurcharge,
          score: 0, // 後で正規化スコア付与
          features,
          specialOffer,
        })
      }
    }

    // 5) スコア正規化
    calculateNormalizedScores(quotes)

    // 6) スコア降順で返却
    return quotes.sort((a, b) => b.score - a.score)
  } catch (error) {
    console.error('Error in getFactoryQuotes:', error)
    throw error
  }
}

/**
 * 製造発注の作成（Edge Function 経由）
 * - 既存の supabase/functions/manufacturing-order を呼び出し
 * - workId は Edge Function 側で必須。呼び出し元で必ず渡してください。
 */
export const createManufacturingOrder = async (
  orderId: string,
  quote: FactoryQuote,
  quantity: number,
  workId: string,
  options?: { maxPrice?: number; deadlineDays?: number }
): Promise<{ ok: boolean; data?: any; error?: string }> => {
  try {
    if (!workId) return { ok: false, error: 'workId is required' }

    // サンプルモードではEdge Functionを呼ばずに成功レスポンスを返す
    if (isSampleMode()) {
      return {
        ok: true,
        data: {
          id: `demo-mo-${Date.now()}`,
          orderId,
          partner_id: quote.partner.id,
          product_type: quote.product.product_type,
          quantity,
          unit_price: quote.unitPrice,
          total_amount: quote.unitPrice * quantity,
          status: 'submitted',
          created_at: new Date().toISOString(),
        }
      }
    }

    const { data, error } = await supabase.functions.invoke('manufacturing-order', {
      body: {
        orderId,
        productData: {
          product_type: quote.product.product_type,
          quantity,
          max_price: options?.maxPrice ?? Math.round(quote.unitPrice),
          deadline_days: options?.deadlineDays, // 任意
          workId,
        },
      },
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data }
  } catch (e: any) {
    console.error('Error in createManufacturingOrder:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/**
 * 製造発注のステータス更新（既存ステータス体系に準拠）
 */
export const updateOrderStatus = async (
  orderId: string,
  status: ManufacturingOrder['status'],
  additionalData?: Partial<ManufacturingOrder>
): Promise<{ ok: boolean; error?: string }> => {
  try {
    // v6: fulfillments.state を更新
    const updateData: any = { state: status, updated_at: new Date().toISOString() }
    const { error } = await supabase
      .from('fulfillments')
      .update(updateData)
      .eq('id', orderId)
    if (error) throw error

    return { ok: true }
  } catch (e: any) {
    console.error('Error in updateOrderStatus:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/**
 * パートナーレビューの投稿（既存テーブルに合わせる）
 */
export const submitPartnerReview = async (
  partnerId: string,
  rating: number,
  comment?: string,
  manufacturingOrderId?: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return { ok: false, error: 'User not authenticated' }

    const { error } = await supabase
      .from('partner_reviews')
      .insert({
        partner_id: partnerId,
        author_user_id: user.id,
        manufacturing_order_id: manufacturingOrderId ?? null,
        rating,
        comment,
        created_at: new Date().toISOString(),
      })
    if (error) throw error

    // 平均評価の再計算はDB側トリガー/ビューに委譲
    return { ok: true }
  } catch (e: any) {
    console.error('Error in submitPartnerReview:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

// ===== ヘルパー関数 =====

/** 通貨正規化（整数/小数混在時の安全化） */
const normalizeCurrency = (value: number | null | undefined): number => {
  if (!value || !Number.isFinite(value)) return 0
  // base_cost は整数JPY想定だが、将来拡張に備えて丸め
  return Math.round(Number(value))
}

/** 正規化スコアの一括計算 */
const calculateNormalizedScores = (quotes: FactoryQuote[]): void => {
  if (quotes.length === 0) return

  const prices = quotes.map((q) => q.unitPrice)
  const leadTimes = quotes.map((q) => q.leadTime)

  const norm: ScoreNormalization = {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minLeadTime: Math.min(...leadTimes),
    maxLeadTime: Math.max(...leadTimes),
  }

  quotes.forEach((q) => {
    let score = 0

    // 価格（0-30, 安いほど高得点）
    const pr = norm.maxPrice - norm.minPrice
    score += pr > 0 ? 30 * ((norm.maxPrice - q.unitPrice) / pr) : 15

    // 納期（0-25, 早いほど高得点）
    const lr = norm.maxLeadTime - norm.minLeadTime
    score += lr > 0 ? 25 * ((norm.maxLeadTime - q.leadTime) / lr) : 12.5

    // 評価（0-25）: average_rating or avg_rating を参照
    const rating =
      (q.partner as any).average_rating ?? (q.partner as any).avg_rating ?? 0
    const ratingClamped = Math.max(0, Math.min(5, Number(rating) || 0))
    score += (ratingClamped / 5) * 25

    // 実績（0-20）: total_orders が無ければ ratings_count を弱連動として利用
    const totalOrders =
      (q.partner as any).total_orders ?? (q.partner as any).ratings_count ?? 0
    const exp = Math.max(0, Math.min(1, Number(totalOrders) / 1000))
    score += exp * 20

    q.score = Math.round(score)
  })
}

/** パートナー特徴の抽出（商品固有情報を優先） */
const extractPartnerFeatures = (
  partner: ManufacturingPartner,
  product: FactoryProduct
): string[] => {
  const features: string[] = []

  // 納期: 3日以内なら「即日発送可」扱い
  const lead = (product.lead_time_days as number) ?? 7
  if (lead <= 3) features.push('即日発送可')

  // 最小ロット: 1枚から
  const minQty = (product as any).minimum_quantity ?? (product as any).min_order_qty ?? 1
  if (Number(minQty) <= 1) features.push('1枚から対応')

  // 高評価
  const rating = (partner as any).average_rating ?? (partner as any).avg_rating
  if (Number(rating) >= 4.5) features.push('高評価')

  return features
}
// 互換: 既存参照のためのエイリアス
const isSampleMode = (): boolean => isDemoEnabled()
