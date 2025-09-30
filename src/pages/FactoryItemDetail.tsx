import React, { useEffect, useMemo, useState } from 'react'
import { getFactoryProductById, getPartnerById } from '@/services/partner.service'
import { getFactoryProductMockups } from '@/services/factory-mockups.service'
import type { FactoryProduct, ManufacturingPartner } from '@/types/partner.types'
import { defaultImages } from '@/utils/defaultImages'
import { GoodsPreviewCarousel } from '@/components/goods/GoodsPreviewCarousel'
import type { PreviewSlide } from '@/components/goods/GoodsPreviewCarousel'
import { Button } from '@/components/ui/button'
import { ProfileService } from '@/services/profile.service'
import { navigate as navTo } from '@/utils/navigation'

const FactoryItemDetail: React.FC = () => {
  const [productId, setProductId] = useState<string>('')
  const [product, setProduct] = useState<FactoryProduct | null>(null)
  const [partnerId, setPartnerId] = useState<string>('')
  const [partner, setPartner] = useState<ManufacturingPartner | null>(null)
  const [mockups, setMockups] = useState<Array<{ mockupUrl: string; geometry?: any }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = window.location.hash.replace(/^#/, '')
      const qs = raw.split('?')[1]
      const sp = new URLSearchParams(qs)
      const id = sp.get('factoryProductId') || ''
      if (id) setProductId(id)
      const pid = sp.get('partnerId') || ''
      if (pid) setPartnerId(pid)
    } catch {}
  }, [])

  useEffect(() => {
    if (!productId) return
    let canceled = false
    ;(async () => {
      setLoading(true)
      try {
        let p: FactoryProduct | null = null
        try { p = await getFactoryProductById(productId) } catch {}
        if (!p && partnerId) {
          // サンプル/デモ用フォールバック: パートナー商品一覧から同IDを検索
          try {
            const all = await (await import('@/services/partner.service')).getPartnerProducts(partnerId)
            p = (all || []).find((x: any) => x.id === productId) || null
          } catch {}
        }
        if (!p) { if (!canceled) setLoading(false); return }
        if (canceled) return
        setProduct(p)
        try { const m = await getFactoryProductMockups(productId); if (!canceled) setMockups(m.map(x => ({ mockupUrl: (x as any).image_url, geometry: (x as any).geometry }))) } catch {}
        try { const partner = await getPartnerById(p.partner_id); if (!canceled) setPartner(partner) } catch {}
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [productId])

  const title = useMemo(() => product?.options?.display_name || (product?.product_type ?? 'アイテム'), [product])
  const category = useMemo(() => {
    const t = (product?.product_type || '').toLowerCase()
    if (/(t\s*-?shirt|tee|hood|sweat|long)/.test(t)) return 'アパレル'
    if (/(sticker|key|badge|acrylic)/.test(t)) return 'アクセサリー'
    if (/(poster|card|file|display)/.test(t)) return 'ディスプレイ'
    if (/(mug|tumbler|coaster|bag|tote|shoulder|eco)/.test(t)) return '日用品'
    if (/(phone|smart|airpods|digital)/.test(t)) return 'デジタル'
    if (/(print|a2|a3|b2)/.test(t)) return '印刷物'
    return 'その他'
  }, [product?.product_type])

  const slides: PreviewSlide[] = useMemo(() => {
    const imgs = mockups.length > 0 ? mockups.map(m => m.mockupUrl) : [defaultImages.product]
    return imgs.slice(0, 8).map((m, idx) => ({ mockupUrl: m, geometry: mockups[idx]?.geometry }))
  }, [mockups])

  const isSampleMode = () => {
    // deno-lint-ignore no-explicit-any
    if (((import.meta as any).env?.VITE_ENABLE_SAMPLE) === 'true') return true
    try { return typeof window !== 'undefined' && !!localStorage.getItem('demoUser') } catch { return false }
  }

  const opt = (product as any)?.options || {}
  const sizes: string[] | undefined = Array.isArray(opt.sizes) ? opt.sizes : (isSampleMode() ? ['XS','S','M','L','XL'] : undefined)
  const colors: string[] | undefined = Array.isArray(opt.colors) ? opt.colors : (isSampleMode() ? ['ホワイト','ブラック','グレー','ネイビー'] : undefined)
  const materials: string | undefined = opt.materials || (isSampleMode() ? '綿100%' : undefined)
  const printArea: string | undefined = opt.print_area || opt.printArea || (isSampleMode() ? '前面/背面 最大30×30cm（目安）' : undefined)
  const features: string[] = Array.isArray(opt.features) && opt.features.length > 0
    ? opt.features
    : (isSampleMode() ? ['高発色プリント','国内出荷','1枚から対応'] : [])

  const feeRate = 0.10
  const marginRate = 0.20
  const baseCost = Math.max(0, Math.round((product?.base_cost as number) || 0))
  const suggestedRetail = useMemo(() => {
    if (!baseCost) return 0
    const costWithFee = Math.ceil(baseCost * (1 + feeRate))
    return Math.ceil(costWithFee / (1 - marginRate))
  }, [baseCost])

  const shippingInfo: any = partner?.shipping_info || null
  const printTemplates = useMemo(() => {
    if (mockups.length > 0) return mockups.map((m, i) => ({ surface: ['front','back','sleeve'][i] || `surface-${i+1}`, geometry: m.geometry }))
    const tpl = (opt as any)?.print_templates
    if (Array.isArray(tpl) && tpl.length > 0) return tpl
    if (isSampleMode()) return [
      { surface: 'front', geometry: { w: 300, h: 300, unit: 'mm' } },
      { surface: 'back', geometry: { w: 300, h: 300, unit: 'mm' } }
    ]
    return []
  }, [mockups, opt])

  const onChooseFactory = () => {
    if (!product) return
    if (rememberDefault && product.product_type) {
      const key = productTypeToCategoryKey(product.product_type)
      if (key) ProfileService.saveFactoryPreference(key, product.partner_id)
    }
    navTo('create', { factoryId: product.partner_id })
  }

  const productTypeToCategoryKey = (t: string): string | null => {
    const s = (t || '').toLowerCase()
    if (/(t\s*-?shirt|tee|hood|sweat|long)/.test(s)) return 'apparel'
    if (/(sticker|key|badge|acrylic)/.test(s)) return 'accessory'
    if (/(poster|card|file|display)/.test(s)) return 'display'
    if (/(mug|tumbler|coaster|bag|tote|shoulder|eco)/.test(s)) return 'daily'
    if (/(phone|smart|airpods|digital)/.test(s)) return 'digital'
    if (/(print|a2|a3|b2)/.test(s)) return 'print'
    return null
  }

  const [rememberDefault, setRememberDefault] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-black">工場アイテム詳細</h1>
          <p className="text-sm text-gray-600 mt-1">{partner?.name || partner?.company_name || '工場'}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-gray-600">読み込み中...</div>
      ) : !product ? (
        <div className="grid place-items-center py-20 text-gray-600">アイテムが見つかりません</div>
      ) : (
        <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="p-6">
                <GoodsPreviewCarousel size={220} slides={slides} enableSwipe autoplayMs={3500} />
              </div>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-black">{title}</h2>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">{category}</span>
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-gray-50 text-gray-700 border">{product.product_type}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">工場原価:</span> <span className="ml-1 font-medium text-black">¥{product.base_cost.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">リードタイム:</span> <span className="ml-1 font-medium text-black">{product.lead_time_days}日</span></div>
                  <div><span className="text-gray-500">最小注文:</span> <span className="ml-1 font-medium text-black">{product.minimum_quantity}個</span></div>
                  <div><span className="text-gray-500">最大注文:</span> <span className="ml-1 font-medium text-black">{product.maximum_quantity}個</span></div>
                  <div className="col-span-2"><span className="text-gray-500">参考販売価格:</span> <span className="ml-1 font-semibold text-black">¥{suggestedRetail.toLocaleString()}</span><span className="ml-2 text-xs text-gray-500">（原価+手数料10%+想定マージン20%）</span></div>
                </div>
                {product.options?.description && (
                  <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{product.options.description}</p>
                )}
                {features.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-800 mb-2">特徴</h3>
                    <div className="flex flex-wrap gap-1">
                      {features.map((f: string) => (
                        <span key={f} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-6">
                  <Button onClick={onChooseFactory} className="w-full">この工場にする</Button>
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={rememberDefault} onChange={(e)=>setRememberDefault(e.target.checked)} />
                    このカテゴリでは次回もこの工場を使う
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 仕様詳細 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">仕様</h3>
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                {materials && (<><dt className="text-gray-500">素材</dt><dd className="text-black">{materials}</dd></>)}
                {printArea && (<><dt className="text-gray-500">印刷範囲</dt><dd className="text-black">{printArea}</dd></>)}
                <dt className="text-gray-500">商品タイプ</dt><dd className="text-black">{product.product_type}</dd>
                <dt className="text-gray-500">工場</dt><dd className="text-black">{partner?.name || partner?.company_name || product.partner_id}</dd>
              </dl>
              {sizes && (
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">対応サイズ</div>
                  <div className="flex flex-wrap gap-1">
                    {sizes.map(s => <span key={s} className="px-2 py-0.5 bg-gray-50 border rounded text-xs text-black">{s}</span>)}
                  </div>
                </div>
              )}
              {colors && (
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">対応カラー</div>
                  <div className="flex flex-wrap gap-1">
                    {colors.map(c => <span key={c} className="px-2 py-0.5 bg-gray-50 border rounded text-xs text-black">{c}</span>)}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">印刷テンプレート</h3>
              {printTemplates.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {printTemplates.map((t: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between border rounded px-3 py-2">
                      <span className="text-black">{t.surface || t.surfaceId || `面${idx+1}`}</span>
                      {t.geometry && (
                        <span className="text-gray-600 text-xs">{(t.geometry.w||t.geometry.width||'—')}×{(t.geometry.h||t.geometry.height||'—')} {t.geometry.unit || 'mm'}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-600">テンプレート情報は準備中です。</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">配送・リードタイム</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="border rounded p-3">
                  <div className="text-xs text-gray-600">標準リードタイム</div>
                  <div className="text-black font-medium">{product.lead_time_days} 日</div>
                </div>
                <div className="border rounded p-3">
                  <div className="text-xs text-gray-600">送料（一般）</div>
                  <div className="text-black font-medium">{shippingInfo?.fee_general_jpy ? `¥${Number(shippingInfo.fee_general_jpy).toLocaleString()}` : 'カートで計算'}</div>
                </div>
                <div className="border rounded p-3">
                  <div className="text-xs text-gray-600">送料（沖縄）</div>
                  <div className="text-black font-medium">{shippingInfo?.fee_okinawa_jpy ? `¥${Number(shippingInfo.fee_okinawa_jpy).toLocaleString()}` : 'カートで計算'}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">※配送費用や納期は工場・数量・時期により前後します。</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">注意事項</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                <li>印刷位置や色味は画面と実物で差異が生じる場合があります。</li>
                <li>大ロットのご注文や特急対応については別途ご相談ください。</li>
                <li>著作権・商標等の権利侵害となるデザインはお受けできません。</li>
              </ul>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}

export default FactoryItemDetail
