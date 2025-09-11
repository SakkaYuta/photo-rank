import { useMyGoodsOrders } from '../../hooks/useGoods'

export function OrderHistory() {
  const { orders, loading, error } = useMyGoodsOrders()
  if (loading) return <div className="p-4">読み込み中...</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>
  return (
    <div className="p-4">
      <ul className="space-y-3">
        {orders.map(o => (
          <li key={o.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">{o.goods_type} × {o.quantity}</p>
              <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</p>
            </div>
            <div className="text-sm">{o.total_price.toLocaleString()} 円 / {o.status}</div>
          </li>
        ))}
        {orders.length === 0 && <div className="text-gray-500">注文履歴はまだありません。</div>}
      </ul>
    </div>
  )
}

