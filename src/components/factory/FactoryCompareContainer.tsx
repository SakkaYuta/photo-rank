import React, { useState } from 'react'
import { useFactoryQuotes, useManufacturingOrder } from '@/hooks/useFactoryQuotes'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, Clock, Star, TrendingUp, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface FactoryCompareContainerProps {
  productType: string
  quantity: number
  workId: string
  orderId?: string
  requiredDate?: Date
  onOrderComplete?: (order: any) => void
}

const getPartnerLocation = (partner: any): string => {
  // partner.types.ts には location は無い。address から簡易表示
  if (partner?.address?.prefecture) return partner.address.prefecture
  if (partner?.address?.city) return partner.address.city
  return ''
}

export const FactoryCompareContainer: React.FC<FactoryCompareContainerProps> = ({
  productType,
  quantity,
  workId,
  orderId,
  requiredDate,
  onOrderComplete,
}) => {
  const { quotes, loading, error, selectedQuote, setSelectedQuote } = useFactoryQuotes(
    productType,
    quantity,
    requiredDate
  )
  const { placeOrder, processing } = useManufacturingOrder()
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'leadTime' | 'rating'>('score')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const sortedQuotes = [...quotes].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.unitPrice - b.unitPrice
      case 'leadTime':
        return a.leadTime - b.leadTime
      case 'rating': {
        const arA = (a.partner as any).average_rating ?? (a.partner as any).avg_rating ?? 0
        const arB = (b.partner as any).average_rating ?? (b.partner as any).avg_rating ?? 0
        return arB - arA
      }
      case 'score':
      default:
        return b.score - a.score
    }
  })

  const handleConfirmOrder = async () => {
    if (!selectedQuote || !orderId) return
    try {
      const order = await placeOrder(orderId, selectedQuote, quantity, workId, {
        maxPrice: Math.round(selectedQuote.unitPrice * 1.1),
      })
      setShowConfirmModal(false)
      onOrderComplete?.(order)
    } catch (_) {
      // エラーは placeOrder 内でログ済み
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-3 text-gray-600">製造パートナーを検索中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">エラーが発生しました</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.reload()}
              className="mt-3"
            >
              再読み込み
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (quotes.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">製造パートナーが見つかりません</h3>
        <p className="text-gray-600 mt-2">条件を変更して再度お試しください</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">製造パートナーを選択</h2>
          <p className="text-gray-600 mt-1">
            {productType} × {quantity}枚の見積もり（{quotes.length}社）
          </p>
        </div>
        <div className="flex gap-2">
          {(['score', 'price', 'leadTime', 'rating'] as const).map((key) => (
            <Button
              key={key}
              variant={sortBy === key ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSortBy(key)}
            >
              {key === 'score' && 'おすすめ順'}
              {key === 'price' && '価格順'}
              {key === 'leadTime' && '納期順'}
              {key === 'rating' && '評価順'}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sortedQuotes.map((quote, index) => {
          const isSelected = selectedQuote?.partner.id === quote.partner.id
          const isRecommended = index === 0 && sortBy === 'score'
          const averageRating =
            (quote.partner as any).average_rating ?? (quote.partner as any).avg_rating
          const ratingsCount = (quote.partner as any).ratings_count ?? 0

          return (
            <Card
              key={`${quote.partner.id}-${quote.product.id}`}
              hoverable
              className={`relative cursor-pointer transition-base ${
                isSelected ? 'ring-2 ring-primary-500 bg-primary-50/30' : ''
              }`}
              onClick={() => setSelectedQuote(quote)}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-6">
                  <Badge variant="primary" size="lg">
                    <Star className="w-4 h-4 mr-1 fill-current" />おすすめ
                  </Badge>
                </div>
              )}
              {quote.specialOffer && (
                <div className="absolute -top-3 right-6">
                  <Badge variant="warning" size="md">{quote.specialOffer}</Badge>
                </div>
              )}

              <div className="p-6">
                <div className="grid md:grid-cols-4 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg jp-text line-clamp-2">{quote.partner.name}</h3>
                    <p className="text-sm text-gray-600 jp-text">{getPartnerLocation(quote.partner)}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="font-semibold">{averageRating?.toFixed?.(1) ?? 'N/A'}</span>
                      <span className="text-sm text-gray-500">({ratingsCount}件)</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {quote.features.slice(0, 3).map((feature) => (
                        <span key={feature} className="text-xs px-2 py-1 bg-gray-100 rounded">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="transition-base">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">単価</span>
                        <span className="text-xl font-bold text-primary-600">¥{quote.unitPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">合計</span>
                        <span className="font-semibold">¥{quote.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{quote.leadTime}営業日</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{quote.product.product_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">スコア: {quote.score}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      variant={isSelected ? 'primary' : 'secondary'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedQuote(quote)
                      }}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />選択中
                        </>
                      ) : (
                        'この工場を選択'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {selectedQuote && (
        <Card className="bg-primary-50/50 border-2 border-primary-200">
          <div className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-primary-900">
                  {selectedQuote.partner.name}を選択中
                </h3>
                <p className="text-primary-700 mt-1">
                  合計金額: ¥{selectedQuote.totalAmount.toLocaleString()}（納期: {selectedQuote.leadTime}
                  営業日）
                </p>
              </div>
              <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setSelectedQuote(null)}>
              選択を解除
            </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={processing || !orderId}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />処理中...
                    </>
                  ) : (
                    '注文を確定する'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {showConfirmModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">注文を確定しますか？</h3>
              <div className="space-y-2 mb-6">
                <p>製造パートナー: {selectedQuote.partner.name}</p>
                <p>数量: {quantity}枚</p>
                <p>合計金額: ¥{selectedQuote.totalAmount.toLocaleString()}</p>
                <p>納期: {selectedQuote.leadTime}営業日</p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setShowConfirmModal(false)} disabled={processing}>
                  キャンセル
                </Button>
                <Button variant="primary" onClick={handleConfirmOrder} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />処理中...
                    </>
                  ) : (
                    '確定する'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default FactoryCompareContainer
