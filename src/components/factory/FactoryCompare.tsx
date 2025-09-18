import React, { useMemo, useState } from 'react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Star, Clock, Package, TrendingUp, AlertCircle, CheckCircle, Truck, Award } from 'lucide-react'
import { TrustBadges } from '@/components/common/TrustBadges'

type Factory = {
  id: number
  name: string
  logo: string
  price: number
  leadTime: number
  rating: number
  completedOrders: number
  location: string
  features: string[]
  printMethod: string
  minLot: number
  score: number
  reviews: number
  onTimeRate: number
  defectRate: number
  specialOffer: string | null
}

export const FactoryCompare: React.FC = () => {
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'leadTime' | 'rating'>('score')

  const product = {
    type: 'Tシャツ',
    quantity: 50,
    designUrl: '/sample-design.jpg',
    requiredDate: '2024-11-01',
  }

  const factories: Factory[] = [
    {
      id: 1,
      name: 'スピードプリント東京',
      logo: '🏭',
      price: 1200,
      leadTime: 3,
      rating: 4.8,
      completedOrders: 1250,
      location: '東京都',
      features: ['即日発送可', 'サンプル無料'],
      printMethod: 'DTGプリント',
      minLot: 1,
      score: 95,
      reviews: 234,
      onTimeRate: 98,
      defectRate: 0.5,
      specialOffer: '初回10%OFF',
    },
    {
      id: 2,
      name: '関西プリント工房',
      logo: '🏢',
      price: 980,
      leadTime: 5,
      rating: 4.5,
      completedOrders: 890,
      location: '大阪府',
      features: ['大口割引', '高品質保証'],
      printMethod: 'シルクスクリーン',
      minLot: 10,
      score: 88,
      reviews: 156,
      onTimeRate: 95,
      defectRate: 1.2,
      specialOffer: null,
    },
    {
      id: 3,
      name: 'エコプリント九州',
      logo: '🌱',
      price: 1100,
      leadTime: 7,
      rating: 4.6,
      completedOrders: 567,
      location: '福岡県',
      features: ['環境配慮', 'オーガニック素材'],
      printMethod: '水性インクジェット',
      minLot: 20,
      score: 82,
      reviews: 89,
      onTimeRate: 96,
      defectRate: 0.8,
      specialOffer: '送料無料',
    },
  ]

  const sortedFactories = useMemo(() => {
    return [...factories].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'leadTime':
          return a.leadTime - b.leadTime;
        case 'rating':
          return b.rating - a.rating;
        case 'score':
          return b.score - a.score;
        default:
          return b.score - a.score;
      }
    })
  }, [sortBy])

  const getScoreBreakdown = (factory: Factory) => ({
    price: factory.price <= 1000 ? 100 : Math.max(0, 100 - (factory.price - 1000) / 10),
    speed: Math.max(0, 100 - factory.leadTime * 10),
    quality: Math.min(100, factory.rating * 20),
    reliability: factory.onTimeRate,
  })

  const getRecommendationReason = (factory: Factory) => {
    const reasons: string[] = []
    if (factory.price === Math.min(...factories.map((f) => f.price))) reasons.push('最安値')
    if (factory.leadTime === Math.min(...factories.map((f) => f.leadTime))) reasons.push('最速納期')
    if (factory.rating === Math.max(...factories.map((f) => f.rating))) reasons.push('最高評価')
    if (factory.score === Math.max(...factories.map((f) => f.score))) reasons.push('総合1位')
    return reasons
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">製造パートナーを選択</h2>
          <p className="text-gray-600 mt-1">
            {product.type} × {product.quantity}枚の見積もり比較
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={sortBy === 'score' ? 'primary' : 'secondary'} size="sm" onClick={() => setSortBy('score')}>
            おすすめ順
          </Button>
          <Button variant={sortBy === 'price' ? 'primary' : 'secondary'} size="sm" onClick={() => setSortBy('price')}>
            価格順
          </Button>
          <Button variant={sortBy === 'leadTime' ? 'primary' : 'secondary'} size="sm" onClick={() => setSortBy('leadTime')}>
            納期順
          </Button>
          <Button variant={sortBy === 'rating' ? 'primary' : 'secondary'} size="sm" onClick={() => setSortBy('rating')}>
            評価順
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {sortedFactories.map((factory, index) => {
          const isSelected = selectedFactoryId === factory.id
          const reasons = getRecommendationReason(factory)
          const scoreBreakdown = getScoreBreakdown(factory)
          return (
            <Card key={factory.id} className={`relative transition-all cursor-pointer hover:shadow-large ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50/30' : ''}`}>
              {index === 0 && sortBy === 'score' && (
                <div className="absolute -top-3 left-6">
                  <Badge variant="primary" size="lg">
                    <Award className="w-4 h-4 mr-1" />おすすめ
                  </Badge>
                </div>
              )}
              {factory.specialOffer && (
                <div className="absolute -top-3 right-6">
                  <Badge variant="warning" size="md">{factory.specialOffer}</Badge>
                </div>
              )}

              <div className="grid md:grid-cols-12 gap-6">
                <div className="md:col-span-3">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{factory.logo}</div>
                    <div>
                      <h3 className="font-semibold text-lg jp-text line-clamp-2">{factory.name}</h3>
                      <p className="text-sm text-gray-600 jp-text">{factory.location}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="font-semibold">{factory.rating}</span>
                        <span className="text-sm text-gray-500">({factory.reviews}件)</span>
                      </div>
                      <div className="mt-2">
                        <TrustBadges />
                      </div>
                    </div>
                  </div>
                  {reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {reasons.map((r) => (
                        <Badge key={r} variant="success" size="sm">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-3">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">単価</span>
                      <span className="text-2xl font-bold text-primary-600">¥{factory.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">合計金額</span>
                      <span className="font-semibold">¥{(factory.price * product.quantity).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600"><Clock className="inline w-4 h-4 mr-1" />納期</span>
                      <span className="font-semibold">{factory.leadTime}営業日</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-500" /><span className="text-sm">{factory.printMethod}</span></div>
                    <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-gray-500" /><span className="text-sm">最小ロット: {factory.minLot}枚</span></div>
                    <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-gray-500" /><span className="text-sm">納期遵守率: {factory.onTimeRate}%</span></div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {factory.features.map((f) => (
                        <span key={f} className="text-xs px-2 py-1 bg-gray-100 rounded-md">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 flex flex-col justify-between">
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">総合スコア</span>
                      <span className="text-2xl font-bold text-primary-600">{factory.score}</span>
                    </div>
                    <div className="text-xs space-y-1 text-gray-500">
                      <div className="flex justify-between">
                        <span>価格</span>
                        <div className="w-20 bg-gray-200 rounded-full h-1.5 ml-2 mt-1">
                          <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${scoreBreakdown.price}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>納期</span>
                        <div className="w-20 bg-gray-200 rounded-full h-1.5 ml-2 mt-1">
                          <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${scoreBreakdown.speed}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant={isSelected ? 'primary' : 'secondary'} onClick={() => setSelectedFactoryId(factory.id)}>
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
            </Card>
          )
        })}
      </div>

      {selectedFactoryId && (
        <Card className="bg-primary-50/50 border-2 border-primary-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-primary-900">{factories.find((f) => f.id === selectedFactoryId)?.name}を選択中</h3>
              <p className="text-primary-700 mt-1">合計金額: ¥{(factories.find((f) => f.id === selectedFactoryId)!.price * product.quantity).toLocaleString()} （税込・送料別）</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSelectedFactoryId(null)}>選択を解除</Button>
              <Button variant="primary" size="lg">注文を確定する</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">製造パートナー選択のヒント</p>
            <ul className="list-disc list-inside space-y-1">
              <li>急ぎの場合は「納期順」でソートして最速の工場を選択</li>
              <li>予算重視なら「価格順」で最安値の工場をチェック</li>
              <li>品質重視の場合は評価4.5以上の工場を推奨</li>
              <li>初回注文は少量対応可能な工場でテストすることをおすすめ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FactoryCompare
