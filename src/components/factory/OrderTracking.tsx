import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, Package, Truck } from 'lucide-react'
import { supabase } from '@/services/supabaseClient'

export const OrderTracking = ({ orderId }: { orderId: string }) => {
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase
        .from('manufacturing_orders')
        .select(`*, manufacturing_partners(name), factory_products(product_type)`) // product_name 列は未定義のため product_type を表示
        .eq('id', orderId)
        .maybeSingle()
      setOrder(data)
      setLoading(false)
    }
    fetchOrder()

    const subscription = supabase
      .channel('order_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'manufacturing_orders', filter: `id=eq.${orderId}` },
        (payload: any) => setOrder((cur: any) => ({ ...(cur || {}), ...(payload.new as any) }))
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [orderId])

  if (loading) return <div>読み込み中...</div>
  if (!order) return <div>注文が見つかりません</div>

  const steps = [
    { status: 'submitted', label: '発注受付', icon: Circle, completed: true },
    {
      status: 'accepted',
      label: '製造確認',
      icon: CheckCircle,
      completed: ['accepted', 'in_production', 'shipped'].includes(order.status),
    },
    {
      status: 'in_production',
      label: '製造中',
      icon: Package,
      completed: ['in_production', 'shipped'].includes(order.status),
    },
    { status: 'shipped', label: '発送完了', icon: Truck, completed: order.status === 'shipped' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <Card.Header>
          <h2 className="text-xl font-bold">注文追跡</h2>
          <p className="text-sm text-gray-600 mt-1">注文ID: {order.order_id}</p>
        </Card.Header>
        <Card.Body>
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {steps.map((step, index) => (
                <div key={step.status} className="flex-1 relative">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${step.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                      <step.icon className="w-5 h-5" />
                    </div>
                    <span className={`text-sm mt-2 ${step.completed ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{step.label}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`absolute top-5 left-1/2 w-full h-0.5 ${steps[index + 1].completed ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">製造情報</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-600">製造パートナー</dt>
                  <dd className="font-medium">{order.manufacturing_partners?.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">商品タイプ</dt>
                  <dd className="font-medium">{order.factory_products?.product_type}</dd>
                </div>
                {order.tracking_number && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">追跡番号</dt>
                    <dd className="font-medium">{order.tracking_number}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="font-semibold mb-3">配送情報</h3>
              {order.shipped_at ? (
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">発送日</dt>
                    <dd className="font-medium">{new Date(order.shipped_at).toLocaleDateString()}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-gray-500">配送情報はまだありません</p>
              )}
            </div>
          </div>

          {order.status === 'shipped' && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 mb-3">商品を受け取りましたか？製造パートナーを評価してください</p>
              <Badge variant="primary">評価する</Badge>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}

export default OrderTracking
