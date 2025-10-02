import { supabase } from '../services/supabaseClient';
import type { ManufacturingPartner, FactoryProduct } from '../types/partner.types';

export interface FactoryComparisonRequest {
  product_type: string;
  quantity: number;
  max_delivery_days?: number;
  max_price?: number;
  creator_profit: number; // クリエイターの希望利益
}

export interface FactoryComparisonResult extends ManufacturingPartner {
  available_products: FactoryProduct[];
  calculated_price: number; // 二段階手数料込み販売価格
  total_delivery_days: number;
  match_score: number; // マッチングスコア
  platform_fee: number; // プラットフォーム手数料
  creator_profit: number; // クリエイター利益
}

// 二段階手数料計算
export function calculatePricing(baseCost: number, creatorProfit: number) {
  // 販売価格 = (工場原価 × 1.1 + クリエイター利益) ÷ 0.7
  const salesPrice = (baseCost * 1.1 + creatorProfit) / 0.7;
  
  // 手数料
  const factoryFee = baseCost * 0.1; // 原価手数料10%
  const platformFee = salesPrice * 0.3; // 販売手数料30%
  const totalPlatformFee = factoryFee + (salesPrice * 0.3 - factoryFee);
  
  return {
    salesPrice: Math.round(salesPrice),
    factoryFee: Math.round(factoryFee),
    platformFee: Math.round(totalPlatformFee),
    creatorProfit
  };
}

// マッチングスコア計算（初期版）
export function calculateMatchScore(
  factory: ManufacturingPartner & { available_products: FactoryProduct[] },
  request: FactoryComparisonRequest,
  calculatedPrice: number
): number {
  const product = factory.available_products[0];
  if (!product) return 0;

  // 価格スコア（低いほど良い、0-100）
  const maxReasonablePrice = (product.base_cost * 1.1 + request.creator_profit) / 0.5; // 50%手数料での価格
  const priceScore = Math.min(100, (calculatedPrice / maxReasonablePrice) * 100);
  
  // 納期スコア（短いほど良い、0-100）  
  const deliveryScore = Math.min(100, (product.lead_time_days / 30) * 100);
  
  // 評価スコア（高いほど良い、0-100）
  const ratingScore = ((factory.average_rating || 3) / 5) * 100;
  
  // 重み付き合計
  const score = (priceScore * 0.5) + (deliveryScore * 0.3) + ((100 - ratingScore) * 0.2);
  
  return Math.round(100 - score); // 高いほど良いスコアに変換
}

export class FactoryCompareService {
  // 工場候補を取得・比較
  static async findAvailableFactories(
    request: FactoryComparisonRequest
  ): Promise<FactoryComparisonResult[]> {
    try {
      // 承認済み・アクティブな製造パートナーを取得
      const { data: partners, error: partnersError } = await supabase
        .from('manufacturing_partners')
        .select('*')
        .eq('status', 'approved')

      if (partnersError) throw partnersError;
      if (!partners || partners.length === 0) return [];

      // 各工場の商品（ビュー）をまとめて取得してメモリでフィルタ
      const partnerIds = partners.map((p: any) => p.id)
      const { data: productsAll, error: prodErr } = await supabase
        .from('factory_products_vw')
        .select('id, factory_id, name, base_price_jpy, options, lead_time_days, created_at')
        .in('factory_id', partnerIds)
      if (prodErr) throw prodErr

      // パートナーごとにグループ化 + リクエスト適合でフィルタリング
      const byPartner = new Map<string, any[]>()
      for (const r of productsAll || []) {
        const list = byPartner.get(r.factory_id) || []
        list.push(r)
        byPartner.set(r.factory_id, list)
      }

      const results: FactoryComparisonResult[] = (partners as any[]).map((partner: any) => {
        const rows = byPartner.get(partner.id) || []
        // 粗い製品タイプマッチ: name または options.product_type に request.product_type を含む
        const products: FactoryProduct[] = rows
          .filter((r: any) => {
            const name = (r.name || '').toString().toLowerCase()
            const optType = (r.options?.product_type || '').toString().toLowerCase()
            const want = (request.product_type || '').toLowerCase()
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
            is_active: true,
            options: r.options,
            created_at: r.created_at,
            updated_at: r.created_at,
          }))

        const mainProduct = products[0]
        if (!mainProduct) return null

        if (request.max_delivery_days && mainProduct.lead_time_days > request.max_delivery_days) return null

        const pricing = calculatePricing(mainProduct.base_cost, request.creator_profit)
        if (request.max_price && pricing.salesPrice > request.max_price) return null

        const matchScore = calculateMatchScore(
          { ...partner, available_products: products },
          request,
          pricing.salesPrice
        )

        return {
          ...partner,
          available_products: products,
          calculated_price: pricing.salesPrice,
          total_delivery_days: mainProduct.lead_time_days,
          match_score: matchScore,
          platform_fee: pricing.platformFee,
          creator_profit: request.creator_profit
        } as FactoryComparisonResult
      }).filter(Boolean) as FactoryComparisonResult[]

      // マッチングスコア降順でソート
      return results.sort((a, b) => b.match_score - a.match_score);

    } catch (error) {
      console.error('Factory comparison error:', error);
      throw error;
    }
  }

  // 特定工場の詳細情報取得
  static async getFactoryDetails(partnerId: string): Promise<ManufacturingPartner | null> {
    try {
      const { data, error } = await supabase
        .from('manufacturing_partners')
        .select(`*`)
        .eq('id', partnerId)
        .eq('status', 'approved')
        .single();

      if (error) {
        throw error;
      }

      if (!data) return null
      // 互換：製品は factory_products_vw から取得して付与
      const { data: prows } = await supabase
        .from('factory_products_vw')
        .select('*')
        .eq('factory_id', partnerId)
      return { ...(data as any), factory_products: prows || [] } as any;
    } catch (error) {
      console.error('Get factory details error:', error);
      return null;
    }
  }
}
