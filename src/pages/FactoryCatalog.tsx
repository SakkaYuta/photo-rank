import React, { useEffect, useState } from 'react'
import { getPartnerById, getPartnerProducts } from '@/services/partner.service'
import type { ManufacturingPartner, FactoryProduct } from '@/types/partner.types'
import { defaultImages } from '@/utils/defaultImages'
import { navigate as navTo } from '@/utils/navigation'

const FactoryCatalog: React.FC = () => {
  const [partnerId, setPartnerId] = useState<string>('')
  const [partner, setPartner] = useState<ManufacturingPartner | null>(null)
  const [products, setProducts] = useState<FactoryProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = window.location.hash.replace(/^#/, '')
      const qs = raw.split('?')[1]
      const sp = new URLSearchParams(qs)
      const pid = sp.get('partnerId') || sp.get('factoryId') || ''
      if (pid) setPartnerId(pid)
    } catch {}
  }, [])

  useEffect(() => {
    if (!partnerId) return
    let canceled = false
    ;(async () => {
      setLoading(true)
      try {
        const [p, items] = await Promise.all([
          getPartnerById(partnerId).catch(() => null),
          getPartnerProducts(partnerId).catch(() => [])
        ])
        if (!canceled) {
          setPartner(p)
          setProducts(items || [])
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [partnerId])

  const toTitle = (prod: FactoryProduct) => prod.options?.display_name || prod.product_type || 'アイテム'
  const toCategory = (t: string) => {
    const s = (t || '').toLowerCase()
    if (/(t\s*-?shirt|tee|hood|sweat|long)/.test(s)) return 'アパレル'
    if (/(sticker|key|badge|acrylic)/.test(s)) return 'アクセサリー'
    if (/(poster|card|file|display)/.test(s)) return 'ディスプレイ'
    if (/(mug|tumbler|coaster|bag|tote|shoulder|eco)/.test(s)) return '日用品'
    if (/(phone|smart|airpods|digital)/.test(s)) return 'デジタル'
    if (/(print|a2|a3|b2)/.test(s)) return '印刷物'
    return 'その他'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-black">工場カタログ</h1>
          <p className="text-sm text-gray-600 mt-1">{partner?.name || partner?.company_name || partnerId}</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <div className="grid place-items-center py-20 text-gray-600">読み込み中...</div>
        ) : products.length === 0 ? (
          <div className="grid place-items-center py-20 text-gray-600">アイテムが見つかりません</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((prod) => (
              <button
                key={prod.id}
                type="button"
                className="text-left rounded-xl border bg-white overflow-hidden hover:shadow transition"
                onClick={() => navTo('factory-item-detail', { factoryProductId: prod.id, partnerId })}
              >
                <div className="h-32 bg-gray-100">
                  <img src={defaultImages.product} alt="prod" className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="font-semibold text-black truncate">{toTitle(prod)}</div>
                  <div className="text-xs text-gray-600 mt-1">原価 {prod.base_cost} 円 / リード {prod.lead_time_days} 日</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {toCategory(prod.product_type)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-gray-50 text-gray-700 border">{prod.product_type}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default FactoryCatalog
