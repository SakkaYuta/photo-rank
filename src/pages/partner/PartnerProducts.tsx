import { useEffect, useState } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { getPartnerProducts, createFactoryProduct, updateFactoryProduct, deleteFactoryProduct } from '../../services/partner.service'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import type { FactoryProduct } from '../../types'
import { Plus, Edit3, Trash2, Eye, EyeOff } from 'lucide-react'

type ProductFormData = {
  product_type: string
  base_cost: number
  lead_time_days: number
  min_order_qty: number
  is_active: boolean
}

const initialFormData: ProductFormData = {
  product_type: '',
  base_cost: 0,
  lead_time_days: 7,
  min_order_qty: 1,
  is_active: true
}

export function PartnerProducts() {
  const { partner } = usePartnerAuth()
  const [products, setProducts] = useState<FactoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<FactoryProduct | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!partner) return
    
    fetchProducts()
  }, [partner])

  async function fetchProducts() {
    if (!partner) return
    
    try {
      const data = await getPartnerProducts(partner.id)
      setProducts(data)
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleAddProduct() {
    setEditingProduct(null)
    setFormData(initialFormData)
    setShowForm(true)
  }

  function handleEditProduct(product: FactoryProduct) {
    setEditingProduct(product)
    setFormData({
      product_type: product.product_type,
      base_cost: product.base_cost,
      lead_time_days: product.lead_time_days,
      min_order_qty: product.min_order_qty,
      is_active: product.is_active
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partner || submitting) return

    setSubmitting(true)
    try {
      if (editingProduct) {
        await updateFactoryProduct(editingProduct.id, formData)
      } else {
        await createFactoryProduct({
          ...formData,
          partner_id: partner.id
        })
      }
      
      await fetchProducts()
      setShowForm(false)
      setEditingProduct(null)
      setFormData(initialFormData)
    } catch (error) {
      console.error('Failed to save product:', error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(product: FactoryProduct) {
    if (!confirm('この商品を削除してもよろしいですか？')) return
    
    try {
      await deleteFactoryProduct(product.id)
      await fetchProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
    }
  }

  async function handleToggleActive(product: FactoryProduct) {
    try {
      await updateFactoryProduct(product.id, { 
        is_active: !product.is_active 
      })
      await fetchProducts()
    } catch (error) {
      console.error('Failed to toggle product status:', error)
    }
  }

  if (!partner || partner.status !== 'approved') {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">商品管理</h1>
          <p className="text-gray-600 dark:text-gray-400">
            承認済みパートナーのみアクセスできます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">商品管理</h1>
        <button
          onClick={handleAddProduct}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新しい商品を追加
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Products List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {products.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  まだ商品が登録されていません。新しい商品を追加してください。
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        商品タイプ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        基本価格
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        リードタイム
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        最小注文数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        ステータス
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {product.product_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          ¥{product.base_cost.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.lead_time_days}日
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.min_order_qty}個
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {product.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(product)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title={product.is_active ? '非表示にする' : '表示する'}
                            >
                              {product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="編集"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Product Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold">
                    {editingProduct ? '商品を編集' : '新しい商品を追加'}
                  </h2>
                </div>
                
                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      商品タイプ *
                    </label>
                    <input
                      type="text"
                      value={formData.product_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, product_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="例: アクリルキーホルダー"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      基本価格（円） *
                    </label>
                    <input
                      type="number"
                      value={formData.base_cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_cost: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      min="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      リードタイム（日） *
                    </label>
                    <input
                      type="number"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_time_days: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      最小注文数 *
                    </label>
                    <input
                      type="number"
                      value={formData.min_order_qty}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_order_qty: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      min="1"
                      required
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                      有効にする
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="btn btn-outline"
                      disabled={submitting}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? '保存中...' : editingProduct ? '更新' : '追加'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}