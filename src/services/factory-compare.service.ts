import { supabase } from '../lib/supabase';
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
        .select(`
          *,
          factory_products!inner (
            id,
            product_type,
            base_cost,
            lead_time_days,
            minimum_quantity,
            maximum_quantity,
            is_active
          )
        `)
        .eq('status', 'approved')
        .eq('is_active', true)
        .eq('factory_products.product_type', request.product_type)
        .eq('factory_products.is_active', true)
        .gte('factory_products.maximum_quantity', request.quantity)
        .lte('factory_products.minimum_quantity', request.quantity);

      if (partnersError) {
        throw partnersError;
      }

      if (!partners || partners.length === 0) {
        return [];
      }

      // 各工場の価格計算とマッチングスコア算出
      const results: FactoryComparisonResult[] = partners.map((partner: any) => {
        const products = partner.factory_products as FactoryProduct[];
        const mainProduct = products[0]; // 該当する商品タイプの最初の商品
        
        if (!mainProduct) {
          return null;
        }

        // 納期フィルタリング
        if (request.max_delivery_days && mainProduct.lead_time_days > request.max_delivery_days) {
          return null;
        }

        // 価格計算
        const pricing = calculatePricing(mainProduct.base_cost, request.creator_profit);
        
        // 価格上限フィルタリング
        if (request.max_price && pricing.salesPrice > request.max_price) {
          return null;
        }

        // マッチングスコア計算
        const matchScore = calculateMatchScore(
          { ...partner, available_products: products },
          request,
          pricing.salesPrice
        );

        return {
          ...partner,
          available_products: products,
          calculated_price: pricing.salesPrice,
          total_delivery_days: mainProduct.lead_time_days,
          match_score: matchScore,
          platform_fee: pricing.platformFee,
          creator_profit: request.creator_profit
        };
      }).filter(Boolean) as FactoryComparisonResult[];

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
        .select(`
          *,
          factory_products (*)
        `)
        .eq('id', partnerId)
        .eq('status', 'approved')
        .eq('is_active', true)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Get factory details error:', error);
      return null;
    }
  }
}