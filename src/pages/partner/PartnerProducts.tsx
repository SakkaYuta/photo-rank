import { useEffect, useState } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { getPartnerProducts, createFactoryProduct, updateFactoryProduct, deleteFactoryProduct } from '../../services/partner.service'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { Table, Badge, Button, Input, Select, Textarea, Label } from '@/components/ui'
import type { FactoryProduct } from '../../types'
import { Plus, Edit3, Trash2, Eye, EyeOff, Image as ImageIcon } from 'lucide-react'
import { MockupEditor } from '@/components/partner/MockupEditor'
import { useNav } from '@/contexts/NavContext'

type ProductFormData = {
  product_type: string
  base_cost: number
  lead_time_days: number
  min_order_qty: number
  is_active: boolean
  // 追加情報（GoodsItemSelector を網羅）
  display_name: string
  category: string
  description: string
  image_url: string
  production_time: string
  sizes: string // CSV
  colors: string // CSV
  materials: string
  print_area: string
  features: string // CSV
  is_recommended: boolean
  discount_rate: number
  maximum_quantity: number
}

const initialFormData: ProductFormData = {
  product_type: '',
  base_cost: 0,
  lead_time_days: 7,
  min_order_qty: 1,
  is_active: true,
  display_name: '',
  category: '',
  description: '',
  image_url: '',
  production_time: '',
  sizes: '',
  colors: '',
  materials: '',
  print_area: '',
  features: '',
  is_recommended: false,
  discount_rate: 0,
  maximum_quantity: 1000,
}

export function PartnerProducts() {
  const { partner } = usePartnerAuth()
  const { navigate } = useNav()
  const [products, setProducts] = useState<FactoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<FactoryProduct | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [mockupEditorFor, setMockupEditorFor] = useState<string | null>(null)

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
    const opt = (product as any).options || {}
    setFormData({
      product_type: product.product_type,
      base_cost: product.base_cost,
      lead_time_days: product.lead_time_days,
      min_order_qty: (product as any).minimum_quantity ?? 1,
      is_active: product.is_active,
      display_name: opt.display_name || opt.product_name || product.product_type || '',
      category: opt.category || '',
      description: opt.description || '',
      image_url: opt.image_url || opt.image || '',
      production_time: opt.production_time || '',
      sizes: Array.isArray(opt.sizes) ? opt.sizes.join(',') : '',
      colors: Array.isArray(opt.colors) ? opt.colors.join(',') : '',
      materials: opt.materials || '',
      print_area: opt.print_area || opt.printArea || '',
      features: Array.isArray(opt.features) ? opt.features.join(',') : '',
      is_recommended: !!opt.is_recommended,
      discount_rate: typeof opt.discount_rate === 'number' ? opt.discount_rate : 0,
      maximum_quantity: (product as any).maximum_quantity ?? 1000,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partner || submitting) return

    setSubmitting(true)
    try {
      const parseCsv = (v: string) => (v || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      const options = {
        display_name: formData.display_name || formData.product_type,
        category: formData.category || undefined,
        description: formData.description || undefined,
        image_url: formData.image_url || undefined,
        production_time: formData.production_time || undefined,
        sizes: parseCsv(formData.sizes),
        colors: parseCsv(formData.colors),
        materials: formData.materials || undefined,
        print_area: formData.print_area || undefined,
        features: parseCsv(formData.features),
        is_recommended: !!formData.is_recommended,
        discount_rate: Number.isFinite(formData.discount_rate) ? formData.discount_rate : 0,
      }

      if (editingProduct) {
        await updateFactoryProduct(editingProduct.id, {
          product_type: formData.product_type,
          base_cost: formData.base_cost,
          lead_time_days: formData.lead_time_days,
          minimum_quantity: formData.min_order_qty,
          maximum_quantity: Math.max((formData.maximum_quantity || formData.min_order_qty), formData.min_order_qty),
          options,
        } as any)
      } else {
        await createFactoryProduct({
          partner_id: partner.id,
          product_type: formData.product_type,
          base_cost: formData.base_cost,
          lead_time_days: formData.lead_time_days,
          minimum_quantity: formData.min_order_qty,
          maximum_quantity: Math.max((formData.maximum_quantity || formData.min_order_qty), formData.min_order_qty),
          is_active: formData.is_active,
          options,
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
          <h1 className="text-2xl font-bold mb-4 text-gray-900">商品管理</h1>
          <p className="text-gray-600 dark:text-gray-400">
            承認済みパートナーのみアクセスできます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-3xl font-bold text-gray-900">商品管理</h1>

      {/* Tab Navigation */}
      <div className="mb-6 border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => navigate('factory-dashboard')}
            className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            ダッシュボード
          </button>
          <button
            className="py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600"
          >
            商品管理
          </button>
          <button
            onClick={() => navigate('partner-settings')}
            className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            設定
          </button>
        </nav>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">登録済み商品</h2>
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
                          <Button variant="ghost" size="sm" onClick={() => setMockupEditorFor(product.id)} title="モックアップ編集">
                            <ImageIcon className="w-4 h-4" />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">
                {editingProduct ? '商品を編集' : '新しい商品を追加'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
              {/* 基本情報 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="display_name">商品名（表示名）</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="例: スタンダードTシャツ"
                  />
                </div>
                <div>
                  <Label htmlFor="product_type">商品タイプ *</Label>
                  <Input
                    id="product_type"
                    type="text"
                    value={formData.product_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, product_type: e.target.value }))}
                    placeholder="例: tshirt, mug など"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">カテゴリ</Label>
                  <Select id="category" value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="">選択してください</option>
                    <option value="apparel">アパレル</option>
                    <option value="accessories">アクセサリー</option>
                    <option value="display">ディスプレイ</option>
                    <option value="homeware">日用品</option>
                    <option value="digital">デジタル</option>
                    <option value="prints">印刷物</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="image_url">代表画像URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">説明</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="商品の特徴や注意点など"
                  />
                </div>
              </div>

              {/* 価格・数量・期間 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_cost">基本価格（円） *</Label>
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
                  <Label htmlFor="lead_time_days">リードタイム（日） *</Label>
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
                  <Label htmlFor="production_time">製作期間（表示用）</Label>
                  <Input
                    id="production_time"
                    value={formData.production_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, production_time: e.target.value }))}
                    placeholder="例: 7〜10日"
                  />
                </div>
                <div>
                  <Label htmlFor="min_order_qty">最小注文数 *</Label>
                  <Input
                    id="min_order_qty"
                    type="number"
                    value={formData.min_order_qty}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_qty: parseInt(e.target.value) || 1 }))}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maximum_quantity">最大注文数</Label>
                  <Input
                    id="maximum_quantity"
                    type="number"
                    value={formData.maximum_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, maximum_quantity: parseInt(e.target.value) || formData.min_order_qty }))}
                    min={formData.min_order_qty}
                  />
                </div>
              </div>

              {/* バリエーション・仕様 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sizes">サイズ（カンマ区切り）</Label>
                  <Input
                    id="sizes"
                    value={formData.sizes}
                    onChange={(e) => setFormData(prev => ({ ...prev, sizes: e.target.value }))}
                    placeholder="例: XS,S,M,L,XL"
                  />
                </div>
                <div>
                  <Label htmlFor="colors">カラー（カンマ区切り）</Label>
                  <Input
                    id="colors"
                    value={formData.colors}
                    onChange={(e) => setFormData(prev => ({ ...prev, colors: e.target.value }))}
                    placeholder="例: ホワイト,ブラック,ネイビー"
                  />
                </div>
                <div>
                  <Label htmlFor="materials">素材</Label>
                  <Input
                    id="materials"
                    value={formData.materials}
                    onChange={(e) => setFormData(prev => ({ ...prev, materials: e.target.value }))}
                    placeholder="例: 綿100%"
                  />
                </div>
                <div>
                  <Label htmlFor="print_area">印刷可能範囲</Label>
                  <Input
                    id="print_area"
                    value={formData.print_area}
                    onChange={(e) => setFormData(prev => ({ ...prev, print_area: e.target.value }))}
                    placeholder="例: 前面・背面・袖"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="features">特徴（カンマ区切り）</Label>
                  <Input
                    id="features"
                    value={formData.features}
                    onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                    placeholder="例: 防水加工,UV耐性,大容量"
                  />
                </div>
              </div>

              {/* 表示設定 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                  />
                  <Label htmlFor="is_active">有効にする</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_recommended"
                    checked={formData.is_recommended}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_recommended: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                  />
                  <Label htmlFor="is_recommended">おすすめとして表示</Label>
                </div>
                <div>
                  <Label htmlFor="discount_rate">割引率（%）</Label>
                  <Input
                    id="discount_rate"
                    type="number"
                    value={formData.discount_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_rate: parseInt(e.target.value) || 0 }))}
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
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

      {mockupEditorFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <MockupEditor factoryProductId={mockupEditorFor} onClose={() => setMockupEditorFor(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
