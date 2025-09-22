import { useEffect, useState } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { getPartnerProducts, createFactoryProduct, updateFactoryProduct, deleteFactoryProduct } from '../../services/partner.service'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { Table, Badge, Button } from '@/components/ui'
import type { FactoryProduct } from '../../types'
import { Plus, Edit3, Trash2, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui'

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
      min_order_qty: (product as any).minimum_quantity ?? 1,
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
        await updateFactoryProduct(editingProduct.id, {
          product_type: formData.product_type,
          base_cost: formData.base_cost,
          lead_time_days: formData.lead_time_days,
          minimum_quantity: formData.min_order_qty,
        } as any)
      } else {
        await createFactoryProduct({
          partner_id: partner.id,
          product_type: formData.product_type,
          base_cost: formData.base_cost,
          lead_time_days: formData.lead_time_days,
          minimum_quantity: formData.min_order_qty,
          maximum_quantity: Math.max(formData.min_order_qty, 1000),
          is_active: formData.is_active,
        } as any)
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
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-3xl font-bold">商品管理</h1>
        <button
          onClick={handleAddProduct}
          className="btn btn-primary flex items-center gap-2 transition-base hover-lift"
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
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>商品タイプ</Table.Head>
                    <Table.Head>基本価格</Table.Head>
                    <Table.Head>リードタイム</Table.Head>
                    <Table.Head>最小注文数</Table.Head>
                    <Table.Head>ステータス</Table.Head>
                    <Table.Head className="text-right">操作</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {products.map((product) => (
                    <Table.Row key={product.id}>
                      <Table.Cell className="font-medium">{product.product_type}</Table.Cell>
                      <Table.Cell>¥{product.base_cost.toLocaleString()}</Table.Cell>
                      <Table.Cell>{product.lead_time_days}日</Table.Cell>
                      <Table.Cell>{(product as any).minimum_quantity ?? 1}個</Table.Cell>
                      <Table.Cell>
                        <Badge variant={product.is_active ? 'success' : 'default'}>
                          {product.is_active ? '有効' : '無効'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleActive(product)} title={product.is_active ? '非表示にする' : '表示する'}>
                            {product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} title="編集">
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(product)} title="削除">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
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
                    <label htmlFor="product_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      商品タイプ *
                    </label>
                    <Input
                      id="product_type"
                      type="text"
                      value={formData.product_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, product_type: e.target.value }))}
                      placeholder="例: アクリルキーホルダー"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="base_cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      基本価格（円） *
                    </label>
                    <Input
                      id="base_cost"
                      type="number"
                      value={formData.base_cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_cost: parseInt(e.target.value) || 0 }))}
                      min={0}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="lead_time_days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      リードタイム（日） *
                    </label>
                    <Input
                      id="lead_time_days"
                      type="number"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_time_days: parseInt(e.target.value) || 1 }))}
                      min={1}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="min_order_qty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      最小注文数 *
                    </label>
                    <Input
                      id="min_order_qty"
                      type="number"
                      value={formData.min_order_qty}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_order_qty: parseInt(e.target.value) || 1 }))}
                      min={1}
                      required
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                      有効にする
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="btn btn-outline transition-base hover-lift"
                      disabled={submitting}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary transition-base hover-lift"
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
