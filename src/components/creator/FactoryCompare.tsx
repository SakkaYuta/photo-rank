import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Star, Clock, DollarSign, Award } from 'lucide-react';
import { FactoryCompareService, type FactoryComparisonRequest, type FactoryComparisonResult } from '../../services/factory-compare.service';
import { PricingSlider } from '@/components/common/PricingSlider'
import { TrustBadges } from '@/components/common/TrustBadges'

interface FactoryCompareProps {
  onFactorySelected?: (factory: FactoryComparisonResult) => void;
  initialProductType?: string;
  initialQuantity?: number;
}

export const FactoryCompare: React.FC<FactoryCompareProps> = ({
  onFactorySelected,
  initialProductType = '',
  initialQuantity = 1
}) => {
  const [request, setRequest] = useState<FactoryComparisonRequest>({
    product_type: initialProductType,
    quantity: initialQuantity,
    creator_profit: 1000, // デフォルト1000円
    max_delivery_days: undefined,
    max_price: undefined
  });

  const [results, setResults] = useState<FactoryComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // 商品タイプの選択肢（実際のDBデータに合わせて調整）
  const productTypes = [
    'tshirt', 'hoodie', 'cap', 'mug', 'sticker', 'poster', 
    'tote_bag', 'phone_case', 'keychain', 'badge'
  ];

  const handleSearch = async () => {
    if (!request.product_type || request.quantity <= 0) {
      setError('商品タイプと数量を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const factories = await FactoryCompareService.findAvailableFactories(request);
      setResults(factories);
      
      if (factories.length === 0) {
        setError('条件に合う工場が見つかりませんでした');
      }
    } catch (err) {
      console.error('Factory search error:', err);
      setError('工場の検索中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  // 初期検索（商品タイプが設定されている場合）
  useEffect(() => {
    if (initialProductType) {
      handleSearch();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* 検索フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            工場比較・選択
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>商品タイプ</Label>
              <select
                value={request.product_type}
                onChange={(e) => setRequest(prev => ({ ...prev, product_type: e.target.value }))}
                className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-950 focus:ring-offset-2 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus:ring-blue-300"
              >
                <option value="" disabled>
                  商品を選択
                </option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>数量</Label>
              <Input
                type="number"
                min="1"
                value={request.quantity}
                onChange={(e) => setRequest(prev => ({ 
                  ...prev, 
                  quantity: parseInt(e.target.value) || 1 
                }))}
                placeholder="数量"
              />
            </div>

            <div className="space-y-2">
              <Label>希望利益（円）</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={request.creator_profit}
                onChange={(e) => setRequest(prev => ({ 
                  ...prev, 
                  creator_profit: parseInt(e.target.value) || 0 
                }))}
                placeholder="1000"
              />
            </div>

            <div className="space-y-2">
              <Label>最大納期（日）</Label>
              <Input
                type="number"
                min="1"
                value={request.max_delivery_days || ''}
                onChange={(e) => setRequest(prev => ({ 
                  ...prev, 
                  max_delivery_days: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="制限なし"
              />
            </div>
          </div>

          {/* 数量ガイド（目安） */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">数量の目安（単価イメージ）</div>
            <PricingSlider
              basePrice={Math.max(500, (request.creator_profit || 1000))}
              min={1}
              max={200}
              step={1}
              value={request.quantity}
              onChangeQty={(q) => setRequest(prev => ({ ...prev, quantity: q }))}
              discountCurve={true}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              工場を検索
            </Button>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 検索結果 */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              検索結果（{results.length}件）
            </h3>
            <div className="text-sm text-gray-500">
              マッチングスコア順に表示
            </div>
          </div>

          <div className="grid gap-4">
            {results.map((factory) => (
              <Card key={factory.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold">{factory.name}</h4>
                        <Badge className={`${getScoreColor(factory.match_score)} border-0`}>
                          スコア {factory.match_score}
                        </Badge>
                        {factory.is_featured && (
                          <Badge variant="primary">おすすめ</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {getRatingStars(Math.round(factory.average_rating || 0))}
                        </div>
                        <span className="text-sm text-gray-600">
                          ({factory.average_rating?.toFixed(1) || 'N/A'})
                        </span>
                        <span className="text-sm text-gray-500">
                          • {factory.total_orders || 0}件の実績
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 jp-text">
                        {factory.description || '製造パートナーです'}
                      </p>

                      <TrustBadges />
                    </div>

                    <div className="text-right">
                      <Button
                        onClick={() => onFactorySelected?.(factory)}
                        className="ml-4"
                      >
                        選択
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="text-sm font-medium">販売価格</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(factory.calculated_price)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium">納期</div>
                        <div className="text-lg font-bold text-blue-600">
                          {factory.total_delivery_days}日
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-600">手数料</div>
                      <div className="text-sm text-gray-700">
                        {formatCurrency(factory.platform_fee)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-600">あなたの利益</div>
                      <div className="text-sm font-bold text-green-700">
                        {formatCurrency(factory.creator_profit)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 検索前の状態 */}
      {!loading && results.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>条件を入力して工場を検索してください</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
