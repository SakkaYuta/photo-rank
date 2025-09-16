import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { FactoryCompare } from '@/components/creator/FactoryCompare';
import type { FactoryComparisonResult } from '@/services/factory-compare.service';

export const FactoryPicker: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFactory, setSelectedFactory] = useState<FactoryComparisonResult | null>(null);

  const handleFactorySelected = (factory: FactoryComparisonResult) => {
    setSelectedFactory(factory);
  };

  const handleConfirmSelection = () => {
    if (!selectedFactory) return;

    // 選択した工場情報を商品作成フローに渡す
    // 実際の実装では、状態管理（Redux/Zustand等）やURL paramsで情報を渡す
    console.log('Selected factory:', selectedFactory);
    
    // 商品作成画面に戻る（選択した工場情報付き）
    navigate('/create-product', { 
      state: { 
        selectedFactory: selectedFactory 
      } 
    });
  };

  const handleBack = () => {
    navigate(-1);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </Button>
        <h1 className="text-2xl font-bold">製造工場の選択</h1>
      </div>

      {/* 選択済み工場の表示 */}
      {selectedFactory && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              選択済み工場
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-green-800">
                    {selectedFactory.name}
                  </h3>
                  <Badge className="bg-green-200 text-green-800 border-0">
                    スコア {selectedFactory.match_score}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <div className="text-sm font-medium text-green-700">販売価格</div>
                    <div className="text-lg font-bold text-green-800">
                      {formatCurrency(selectedFactory.calculated_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-700">納期</div>
                    <div className="text-lg font-bold text-green-800">
                      {selectedFactory.total_delivery_days}日
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-700">評価</div>
                    <div className="text-lg font-bold text-green-800">
                      {selectedFactory.average_rating?.toFixed(1) || 'N/A'} ⭐
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-700">あなたの利益</div>
                    <div className="text-lg font-bold text-green-800">
                      {formatCurrency(selectedFactory.creator_profit)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="ml-4 space-y-2">
                <Button
                  onClick={handleConfirmSelection}
                  className="bg-green-600 hover:bg-green-700"
                >
                  この工場で決定
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedFactory(null)}
                  className="w-full"
                >
                  再選択
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 工場比較コンポーネント */}
      <FactoryCompare
        onFactorySelected={handleFactorySelected}
        initialProductType="tshirt" // デフォルト値、実際は前の画面から渡される
        initialQuantity={1}
      />

      {/* ヘルプ情報 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-800 mb-2">💡 工場選択のヒント</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>マッチングスコア</strong>: 価格・納期・評価を総合した推奨度です</li>
            <li>• <strong>販売価格</strong>: プラットフォーム手数料を含む最終販売価格です</li>
            <li>• <strong>納期</strong>: 注文確定から発送までの日数です</li>
            <li>• <strong>評価</strong>: 過去の注文者からの評価平均です</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};