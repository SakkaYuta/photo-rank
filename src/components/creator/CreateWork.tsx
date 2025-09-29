import { useMemo, useState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select } from '../ui/select'
import { createWork } from '../../services/work.service'
import { defaultImages } from '@/utils/defaultImages'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { getManufacturingPartners } from '@/services/factory.service'
import { getPartnerProducts } from '@/services/partner.service'
import type { ManufacturingPartner, FactoryProduct } from '@/types/partner.types'
import { supabase } from '../../services/supabaseClient'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { processUploadedWorkImage } from '@/services/uploadPipeline.service'

export function CreateWork() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  // 基本情報
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('wallpaper')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number | ''>(1000)
  const [isPrivate, setIsPrivate] = useState(true)
  // 在庫管理
  const [stockQuantity, setStockQuantity] = useState<number | ''>(10)
  const [isDigitalProduct, setIsDigitalProduct] = useState(true)
  // 販売期間（開始・終了）
  const [saleStart, setSaleStart] = useState<string>('')
  const [saleEnd, setSaleEnd] = useState<string>('')

  // タグ
  const [tagInput, setTagInput] = useState('')
  const [showTags, setShowTags] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  // 画像（最大12）
  const [imageInput, setImageInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [multiSubmit, setMultiSubmit] = useState(false)
  // ローカルプレビュー（アップロード前の即時表示用）
  const [localPreviews, setLocalPreviews] = useState<string[]>([])

  // Sections refs for error scrolling
  const titleRef = useRef<HTMLDivElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const imagesRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const legalRef = useRef<HTMLDivElement | null>(null)
  const ipCheckboxRef = useRef<HTMLInputElement | null>(null)
  const factoryRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<HTMLDivElement | null>(null)
  const [triedStep1Next, setTriedStep1Next] = useState(false)
  const [triedStep2Next, setTriedStep2Next] = useState(false)
  const { showToast } = useToast()

  // グッズ化希望のカテゴリ/詳細（サンプル実装）
  const categoryOptions = [
    { key: 'apparel', label: 'アパレル', products: ['Tシャツ','パーカー','ロングスリーブT','スウェット'] },
    { key: 'accessory', label: 'アクセサリー', products: ['ステッカー','キーホルダー','バッジ','アクリルスタンド'] },
    { key: 'display', label: 'ディスプレイ', products: ['ポスター','ポストカード','クリアファイル'] },
    { key: 'daily', label: '日用品', products: ['マグカップ','タンブラー','コースター','トートバッグ','ショルダーバッグ','エコバッグ'] },
    { key: 'digital', label: 'デジタル', products: ['スマホケース','AirPodsケース','スマホスタンド'] },
    { key: 'print', label: '印刷物', products: ['A2','A3','B2'] },
  ] as const
  // カテゴリ選択（従来の enabledFamilies をカテゴリ群として利用）
  const familyOptions = categoryOptions.map(c => c.key)
  const [enabledProductTypes, setEnabledProductTypes] = useState<string[]>([])
  const [showProductDetails, setShowProductDetails] = useState(false)

  // 配送設定（Step2統合のため個別UI削除。重量/サイズ等は未使用のため除去）

  // 取り分はサーバー側算出（UI削除）
  const [enabledFamilies, setEnabledFamilies] = useState<string[]>(categoryOptions.map(c => c.key))
  const [ipConfirmed, setIpConfirmed] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)

  // Step2: 工場依存
  const [factoryId, setFactoryId] = useState('')
  const [productModelId, setProductModelId] = useState('')
  const [sizeOptions, setSizeOptions] = useState('')
  const [colorOptions, setColorOptions] = useState('')
  const [variantStockMode, setVariantStockMode] = useState<'made_to_order'|'stock'>('made_to_order')
  const [material, setMaterial] = useState('')
  const [sizeChart, setSizeChart] = useState('')
  const [careLabels, setCareLabels] = useState('')
  const [tolerance, setTolerance] = useState('アパレル±2〜3cm、バッグ/小物±5%')
  const [shippingProfile, setShippingProfile] = useState('factory-default')
  type SurfaceSpec = { surfaceId: string; widthMm: number | ''; heightMm: number | ''; method: string; assetUrl: string }
  const [printSurfaces, setPrintSurfaces] = useState<SurfaceSpec[]>([])
  const [estimatedCost, setEstimatedCost] = useState<number | ''>('')
  const [estimatedShippingCost, setEstimatedShippingCost] = useState<number | ''>('')
  const feeRate = 0.1
  const finalPricePreview = useMemo(() => {
    const basePrice = typeof price === 'number' ? price : 0
    const cost = Number(estimatedCost || 0)
    const ship = Number(estimatedShippingCost || 0)
    const creatorMargin = 0
    const fee = Math.floor(basePrice * feeRate)
    return { basePrice, cost, ship, fee, creatorMargin, gross: basePrice - cost - ship - fee }
  }, [price, estimatedCost, estimatedShippingCost])

  // ===== 工場カタログ・製品の接続 =====
  const [partners, setPartners] = useState<ManufacturingPartner[]>([])
  const [partnerProducts, setPartnerProducts] = useState<FactoryProduct[]>([])
  const [partnerCategoryMap, setPartnerCategoryMap] = useState<Record<string, string[]>>({})
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmChecks, setConfirmChecks] = useState({ infoAccurate: false, agreeRules: false })

  useEffect(() => {
    // 工場一覧を取得（approved想定）
    getManufacturingPartners('approved')
      .then(setPartners)
      .catch((e) => console.warn('工場一覧の取得に失敗しました', e))
  }, [])

  // 全工場のモデルをプリフェッチし、対応カテゴリを事前算出（並列数を制限）
  useEffect(() => {
    if (!partners || partners.length === 0) return
    let isCancelled = false
    const concurrency = Math.min(4, Math.max(1, Math.floor(navigator?.hardwareConcurrency || 4)))
    const run = async () => {
      try {
        const map: Record<string, string[]> = {}
        let idx = 0
        const worker = async () => {
          while (!isCancelled) {
            const cur = idx++
            if (cur >= partners.length) break
            const partner = partners[cur]
            try {
              const prods = await getPartnerProducts(partner.id)
              const cats = Array.from(new Set((prods || []).map(pp => productTypeToCategory(pp.product_type))))
              map[partner.id] = cats
            } catch (e) {
              // 個別失敗はスキップ
            }
          }
        }
        await Promise.all(Array.from({ length: concurrency }).map(() => worker()))
        if (!isCancelled) setPartnerCategoryMap(map)
      } catch (e) {
        console.warn('モデルのプリフェッチに失敗しました', e)
      }
    }
    run()
    return () => { isCancelled = true }
  }, [partners])

  useEffect(() => {
    if (!factoryId) { setPartnerProducts([]); return }
    getPartnerProducts(factoryId)
      .then((prods) => {
        setPartnerProducts(prods)
      })
      .catch((e) => console.warn('工場の製品取得に失敗しました', e))
  }, [factoryId])

  // Step2: 工場に応じた概算配送コストを自動設定
  useEffect(() => {
    const partner = partners.find(p => p.id === factoryId) as any
    if (!partner || !partner.shipping_info) {
      setEstimatedShippingCost('')
      return
    }
    const s = partner.shipping_info
    if (shippingProfile === 'general' && s?.fee_general_jpy) {
      setEstimatedShippingCost(Number(s.fee_general_jpy) || 0)
    } else if (shippingProfile === 'okinawa' && s?.fee_okinawa_jpy) {
      setEstimatedShippingCost(Number(s.fee_okinawa_jpy) || 0)
    } else {
      // factory-default / weight-based などは0扱い（将来拡張）
      setEstimatedShippingCost('')
    }
  }, [factoryId, shippingProfile, partners])

  // 概算から販売価格を自動提案（粗利がマイナスにならないよう計算）
  useEffect(() => {
    const cost = Number(estimatedCost || 0)
    const ship = Number(estimatedShippingCost || 0)
    const margin = 0
    const denom = 1 - feeRate
    const suggested = Math.max(0, Math.ceil((cost + ship + margin) / (denom || 1)))
    // Step1で価格入力を削除したため、自動提案で上書き
    setPrice(suggested)
  }, [estimatedCost, estimatedShippingCost])

  const productTypeToCategory = (t: string): string => {
    const s = (t || '').toLowerCase()
    if (/(t\s*-?shirt|tee|hood|sweat|long)/.test(s)) return 'アパレル'
    if (/(sticker|key|badge|acrylic)/.test(s)) return 'アクセサリー'
    if (/(poster|card|file|display)/.test(s)) return 'ディスプレイ'
    if (/(mug|tumbler|coaster|bag|tote|shoulder|eco)/.test(s)) return '日用品'
    if (/(phone|smart|airpods|digital)/.test(s)) return 'デジタル'
    if (/(print|a2|a3|b2)/.test(s)) return '印刷物'
    return 'その他'
  }

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { LoginGate, requireAuth } = useRequireAuth()

  const titleLimit = 30
  const descLimit = 200
  const UPLOAD_BUCKET = (import.meta as any).env?.VITE_UPLOAD_BUCKET || (import.meta as any).env?.VITE_SAMPLE_BUCKET || 'user-content'
  const toDateInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const now = new Date()
  const oneYearLater = new Date(now.getTime() + 365*24*60*60*1000)

  // ファイルアップロード機能はクリーンアップで削除

  useEffect(() => {
    if (!productModelId) return
    const selected = partnerProducts.find(p => p.id === productModelId)
    if (selected) {
      setEstimatedCost(selected.base_cost)
      // 工場モデルがテンプレートを持つ場合はそれを優先
      const rawTpl = (selected.options as any)?.print_templates
      if (Array.isArray(rawTpl) && rawTpl.length > 0) {
        const mapped: SurfaceSpec[] = rawTpl.map((it: any, idx: number) => {
          const surfaceId = it.surfaceId || it.surface_id || it.surface || 'front'
          const widthMm = it.widthMm ?? it.width_mm ?? it.width ?? ''
          const heightMm = it.heightMm ?? it.height_mm ?? it.height ?? ''
          const method = it.method || 'DTG'
          // 画像インデックス指定 or URL どちらでも対応
          const imgIdx = typeof it.asset_index === 'number' ? it.asset_index : idx
          const assetUrl = it.assetUrl || (images[imgIdx] || images[0] || '')
          return { surfaceId, widthMm, heightMm, method, assetUrl }
        })
        setPrintSurfaces(mapped)
        return
      }
      // テンプレートが無い場合のフォールバック
      const type = selected.product_type
      let tpl: SurfaceSpec[] = []
      if (type === 'tshirt') {
        tpl = [
          { surfaceId: 'front', widthMm: 300, heightMm: 400, method: 'DTG', assetUrl: images[0] || '' },
          { surfaceId: 'back', widthMm: 300, heightMm: 400, method: 'DTG', assetUrl: images[1] || images[0] || '' },
        ]
      } else if (type === 'mug') {
        tpl = [
          { surfaceId: 'front', widthMm: 80, heightMm: 80, method: '昇華', assetUrl: images[0] || '' },
        ]
      } else if (type === 'sticker') {
        tpl = [
          { surfaceId: 'front', widthMm: 100, heightMm: 100, method: 'UV', assetUrl: images[0] || '' },
        ]
      } else {
        tpl = [ { surfaceId: 'front', widthMm: 200, heightMm: 200, method: 'DTG', assetUrl: images[0] || '' } ]
      }
      setPrintSurfaces(tpl)
    }
  }, [productModelId, partnerProducts, images])

  const onSubmit = async () => {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !requireAuth()) throw new Error('ログインが必要です')
      // 販売期間の自動補完（未入力時は現在〜30日後）＋終了は最大1年後まで
      const startAt = saleStart ? new Date(saleStart) : new Date()
      const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      let endAt = saleEnd ? new Date(saleEnd) : defaultEnd
      const maxEnd = new Date(startAt.getTime() + 365 * 24 * 60 * 60 * 1000)
      if (endAt.getTime() > maxEnd.getTime()) endAt = maxEnd

      let targetImages = images.slice(0, 5)
      if (!multiSubmit && targetImages.length > 1) {
        targetImages = targetImages.slice(0, 1)
      }
      if (targetImages.length === 0) throw new Error('画像を1枚以上アップロードしてください')
      await Promise.all(targetImages.map((imgUrl) => createWork({
        creator_id: user.id,
        title,
        image_url: imgUrl,
        thumbnail_url: imgUrl,
        price: typeof price === 'number' ? price : 0,
        message: description,
        is_published: !isPrivate,
        sale_start_at: startAt.toISOString(),
        sale_end_at: endAt.toISOString(),
        category,
        tags,
        content_url: null,
        images: [imgUrl],
        enabled_families: enabledFamilies, // 従来の互換：カテゴリキー配列
        enabled_categories: enabledFamilies,
        enabled_product_types: enabledProductTypes,
        creator_margin: null,
        product_type: isDigitalProduct ? 'digital' : 'physical',
        stock_quantity: !isDigitalProduct && variantStockMode==='stock' ? (typeof stockQuantity==='number'? stockQuantity: 0) : null,
        variant_stock_mode: !isDigitalProduct ? variantStockMode : 'made_to_order',
        ip_confirmed: ipConfirmed,
        policy_accepted: policyAccepted,
        factory_id: factoryId || null,
        product_model_id: productModelId || null,
        variants: {
          sizes: sizeOptions.split(',').map(s=>s.trim()).filter(Boolean),
          colors: colorOptions.split(',').map(s=>s.trim()).filter(Boolean),
          stock_mode: variantStockMode,
        },
        product_specs: { material, size_chart: sizeChart, care_labels: careLabels, tolerance },
        shipping_profile: shippingProfile,
        print_surfaces: printSurfaces,
        price_breakdown_preview: finalPricePreview,
      } as any)))
      setMessage(isPrivate ? `${targetImages.length}件の作品を下書き保存しました` : `${targetImages.length}件の作品を公開しました`)
      // 簡易リセット（必要に応じて保持）
      setTitle('')
      setDescription('')
      setTags([])
      setImageInput('')
      setSaleStart('')
      setSaleEnd('')
      setStockQuantity(10)
      // 取り分はサーバー側算出
      setImages([])
      setEnabledFamilies([])
      setIpConfirmed(false)
      setPolicyAccepted(false)
      setFactoryId('')
      setProductModelId('')
      setSizeOptions('')
      setColorOptions('')
      setVariantStockMode('made_to_order')
      setMaterial('')
      setSizeChart('')
      setCareLabels('')
      setTolerance('アパレル±2〜3cm、バッグ/小物±5%')
      setShippingProfile('factory-default')
      setPrintSurfaces([])
      setEstimatedCost('')
      setEstimatedShippingCost('')
      setStep(1)
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  // 最終確認用のバリデーション結果
  const startAtFinal = saleStart ? new Date(saleStart) : new Date()
  const endAtFinal = saleEnd ? new Date(saleEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const periodOk = endAtFinal.getTime() <= (startAtFinal.getTime() + 365 * 24 * 60 * 60 * 1000)
  const validations = {
    titleOk: title.trim().length > 0,
    imagesOk: images.length > 0,
    legalOk: ipConfirmed && policyAccepted,
    factoryOk: !!factoryId,
    modelOk: !!productModelId,
    periodOk,
  }

  const titleError = !validations.titleOk
  const imagesError = !validations.imagesOk
  const legalError = !validations.legalOk
  const factoryError = step >= 2 && !validations.factoryOk
  const modelError = step >= 2 && !validations.modelOk

  return (
    <div className="min-h-screen bg-gray-50">
      <LoginGate />

      {/* ヘッダー */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-black">新しい作品をアップロード</h1>
          <p className="text-sm text-gray-600 mt-1">作品情報を入力して出品しましょう</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        {/* ステップ */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <div className={`px-3 py-1 rounded-full ${step===1?'bg-blue-600 text-white':'bg-gray-200 text-gray-800'}`}>1. 出品情報</div>
            <div className={`px-3 py-1 rounded-full ${step===2?'bg-blue-600 text-white':'bg-gray-200 text-gray-800'}`}>2. 工場・仕様</div>
            <div className={`px-3 py-1 rounded-full ${step===3?'bg-blue-600 text-white':'bg-gray-200 text-gray-800'}`}>3. 最終確認</div>
          </div>
        </div>
      {step === 1 && <>
      {/* エラー要約（Step1） */}
      {(triedStep1Next && (!validations.titleOk || !validations.imagesOk || !validations.legalOk)) && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">
          <div className="font-medium mb-1">入力に不備があります。以下を修正してください。</div>
          <ul className="list-disc list-inside text-sm">
            {!validations.titleOk && <li>タイトルを入力してください。</li>}
            {!validations.imagesOk && <li>画像を最低1枚アップロードしてください。</li>}
            {!validations.legalOk && <li>法務確認のチェックを入れてください。</li>}
          </ul>
        </div>
      )}
      {/* タイトル */}
      <section ref={titleRef} className="bg-white rounded-lg shadow-sm border space-y-2 p-6">
        <label className="block">
          <div className="flex items-baseline justify-between gap-2">
            <span className="mb-1 block text-sm font-bold text-black">タイトル
              <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
              {title.trim().length === 0 && <AlertCircle className="inline ml-2 text-red-600 h-4 w-4 align-middle" />}
            </span>
            <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{title.length} /{titleLimit}</span>
          </div>
          <Input
            placeholder="例：美しい風景の写真集"
            value={title}
            maxLength={titleLimit}
            onChange={(e) => setTitle(e.target.value)}
            error={title.trim().length === 0}
          />
          {title.trim().length === 0 && (
            <p className="mt-1 text-xs text-red-600">タイトルは必須です。</p>
          )}
        </label>
      </section>

      {/* カテゴリは固定（UI非表示） */}

      {/* 説明 */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-bold text-black">説明</span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{description.length} /{descLimit}</span>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">
          商品の魅力や重要な情報を簡潔に記入してください。詳しくは「よくある質問」をご確認ください。<br />
          例：忍者すりすりくんの公式デジタル絵本。<br />
          ※説明文はマークダウン記法（最大200文字）。
        </p>
        <Textarea
          placeholder="商品の魅力や仕様、利用条件などを詳しく記載してください"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, descLimit))}
          rows={6}
        />
      </section>

      {/* コンテンツURL: プラットフォーム側で生成するため削除 */}

      {/* 販売期間（必須・未入力時は自動補完、終了は最大1年後まで） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-bold text-black">販売期間
            <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
          </span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">終了日は最大1年後まで。終了後は非表示になります</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">販売開始日時</span>
            <Input type="datetime-local" min={toDateInputValue(now)} value={saleStart} onChange={(e) => setSaleStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">販売終了日時</span>
            <Input type="datetime-local" max={toDateInputValue(oneYearLater)} value={saleEnd} onChange={(e) => setSaleEnd(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">未入力の場合は自動で開始=現在、終了=30日後が設定されます。</p>
      </section>

      {/* タグ（折りたたみ） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="block text-sm font-bold text-black">タグ</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{tags.length} / 10</span>
            <Button type="button" variant="secondary" onClick={() => setShowTags(v => !v)}>{showTags ? '閉じる' : '追加する'}</Button>
          </div>
        </div>
        {showTags && (
          <>
            <div className="flex gap-2">
              <Input
                className="flex-1 min-w-0"
                placeholder="キーワードを追加"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const t = tagInput.trim()
                    if (t && !tags.includes(t) && tags.length < 10) {
                      setTags([...tags, t])
                      setTagInput('')
                    }
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => {
                  const t = tagInput.trim()
                  if (t && !tags.includes(t) && tags.length < 10) {
                    setTags([...tags, t])
                    setTagInput('')
                  }
                }}
              >追加</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                  {t}
                  <button className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* グッズ化トグル: セクションごと削除（リクエスト対応） */}

      {/* 画像（最大5枚、ファイルアップロード） */}
      <section ref={imagesRef} className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-bold text-black">製品の画像
            <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
            {(images.length === 0) && <AlertCircle className="inline ml-2 text-red-600 h-4 w-4 align-middle" />}
          </span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{images.length + localPreviews.length}/5</span>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-black">
            <input type="checkbox" checked={multiSubmit} onChange={(e)=> setMultiSubmit(e.target.checked)} />
            複数出品しますか（選択した画像ごとに個別出品）
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple={multiSubmit}
            disabled={(images.length + localPreviews.length) >= 5 || busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              if (files.length === 0) return
              // クライアント側の安全チェック（MIME/サイズ）
              const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp'])
              const MAX_SIZE = 10 * 1024 * 1024 // 10MB
              const filtered = files.filter(f => {
                if (!ALLOWED.has(f.type)) {
                  showToast({ message: `未対応の形式です: ${f.type || 'unknown'}`, variant: 'warning' })
                  return false
                }
                if (f.size > MAX_SIZE) {
                  showToast({ message: `サイズ上限(10MB)を超えています: ${f.name}`, variant: 'warning' })
                  return false
                }
                return true
              })
              if (filtered.length === 0) { if (e.target) e.target.value = '' ; return }
              const remain = Math.max(0, 5 - (images.length + localPreviews.length))
              if (remain <= 0) {
                showToast({ message: '画像は最大5枚まで追加できます', variant: 'warning' })
                if (e.target) e.target.value = ''
                return
              }
              if (filtered.length > remain) {
                showToast({ message: `残り${remain}枚まで追加できます。超過分は無視されます。`, variant: 'warning' })
              }
              const pick = filtered.slice(0, remain)
              // ローカルプレビューを即時表示
              const newPreviews = pick.map((f) => URL.createObjectURL(f))
              setLocalPreviews((prev) => [...prev, ...newPreviews])
              setBusy(true)
              try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user || !requireAuth()) throw new Error('ログインが必要です')
                const secureUploads: string[] = []
                for (const file of pick) {
                  // Step 1: Upload to temporary location
                  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
                  const tempPath = `uploads/works/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                  const { error: upErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(tempPath, file, { upsert: false, cacheControl: '3600' })
                  if (upErr) throw upErr

                  // Step 2: Process through secure pipeline (sanitize + watermark)
                  const result = await processUploadedWorkImage(tempPath)
                  if (!result.ok || !result.preview?.path) {
                    throw new Error(result.error || 'セキュア処理に失敗しました')
                  }

                  // Step 3: Use watermarked preview URL for display
                  const { data } = supabase.storage.from(result.preview.bucket).getPublicUrl(result.preview.path)
                  secureUploads.push(data.publicUrl)
                }
                setImages(prev => [...prev, ...secureUploads])
              } catch (err: any) {
                setMessage(err?.message || '画像のアップロードに失敗しました')
                showToast({ message: err?.message || '画像のアップロードに失敗しました', variant: 'error' })
              } finally {
                setBusy(false)
                // ローカルプレビューURLを解放してクリア
                try {
                  setLocalPreviews((prev) => {
                    // 今回追加した分だけ削除・解放（他の未完了プレビューは保持）
                    newPreviews.forEach((u) => { try { URL.revokeObjectURL(u) } catch {} })
                    const removeSet = new Set(newPreviews)
                    return prev.filter(u => !removeSet.has(u))
                  })
                } catch {}
                if (e.target) e.target.value = ''
              }
            }}
          />
          {(images.length + localPreviews.length) === 0 && (
            <p className="text-xs text-red-600">画像は最低1枚必要です。</p>
          )}
          {(images.length + localPreviews.length) >= 5 && (
            <p className="text-xs text-red-600">上限の5枚に達しました。新しい画像を追加するには既存の画像を削除してください。</p>
          )}
          <p className="text-xs text-gray-500">最大5枚まで選択できます。同時出品数は選択した枚数分（最大5件）になります。<br />
            ※アップロードされた画像は自動的にサニタイズ処理され、透かし入りプレビューとして表示されます。</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {/* アップロード済み（リモートURL） */}
          {images.map((url, idx) => (
            <div key={`uploaded-${url}-${idx}`} className="rounded-lg border p-2 relative">
              <img src={url} alt={`image-${idx}`} className="h-28 w-full rounded object-cover" />
              {/* 右上の削除ボタン */}
              <button
                type="button"
                aria-label="画像を削除"
                className="absolute top-1 right-1 bg-white/90 hover:bg-white text-gray-700 border border-gray-200 rounded-full p-1 shadow"
                onClick={() => setImages(images.filter((_, i) => i !== idx))}
              >
                ×
              </button>
              {/* 下部の情報行（番号のみ） */}
              <div className="mt-2 flex items-center justify-start text-xs text-gray-900 dark:text-gray-400">
                <span>#{idx + 1}</span>
              </div>
            </div>
          ))}
          {/* アップロード中（ローカルプレビュー） */}
          {localPreviews.map((url, idx) => (
            <div key={`local-${url}-${idx}`} className="rounded-lg border p-2 relative">
              <img src={url} alt={`local-preview-${idx}`} className="h-28 w-full rounded object-cover opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs bg-white/80 px-2 py-1 rounded border">アップロード中...</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">※販売終了後は非表示になります。</p>
      </section>

      {/* ファイルアップロードは削除 */}


      {/* 商品タイプと在庫管理はStep2に統合のため非表示 */}

      {/* 価格入力は削除（自動算出/Step2で参照のみ） */}

      {/* 取り分設定は削除（サーバー側で算出） */}

      {/* 配送設定はStep2に統合のため非表示 */}
      {/* グッズ化可能なアイテム（希望） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-bold text-black">グッズ化可能なアイテム（希望）</span>
        </div>
        {/* カテゴリ（常時表示） */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {categoryOptions.map(cat => (
            <label key={cat.key} className="flex items-center gap-2 text-black">
              <input
                type="checkbox"
                checked={enabledFamilies.includes(cat.key)}
                onChange={(e) => setEnabledFamilies(e.target.checked ? [...enabledFamilies, cat.key] : enabledFamilies.filter(x => x !== cat.key))}
              />
              {cat.label}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">詳細は必要に応じて絞り込めます（未選択時はカテゴリ全般を希望）。</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowProductDetails(v => !v)}>
            {showProductDetails ? '詳細を隠す' : '詳細を絞る'}
          </Button>
        </div>
        {/* 具体的な商品（折りたたみ） */}
        {showProductDetails && (
          <div className="space-y-3 pt-1">
            {categoryOptions.map(cat => (
              <div key={cat.key} className="border-t pt-2">
                <div className="text-xs text-gray-500 mb-1">{cat.label} の詳細</div>
                <div className="flex flex-wrap gap-2">
                  {cat.products.map(p => (
                    <label key={cat.key + ':' + p} className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-1 text-black">
                      <input
                        type="checkbox"
                        checked={enabledProductTypes.includes(p)}
                        onChange={(e) => setEnabledProductTypes(e.target.checked ? [...enabledProductTypes, p] : enabledProductTypes.filter(x => x !== p))}
                        disabled={!enabledFamilies.includes(cat.key)}
                        title={!enabledFamilies.includes(cat.key) ? '先にカテゴリを選択してください' : undefined}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-600">工場選択後にモデル確定時、近いカテゴリ・詳細に基づき提案されます。</p>
      </section>

      {/* 法務確認 */}
      <section ref={legalRef} className={`bg-white rounded-lg shadow-sm border space-y-3 p-6 ${legalError ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
        <span className="block text-sm font-bold text-black">法務確認
          <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
          {!(ipConfirmed && policyAccepted) && <AlertCircle className="inline ml-2 text-red-600 h-4 w-4 align-middle" />}
        </span>
        <label className="flex items-center gap-2 text-sm text-black">
          <input ref={ipCheckboxRef} type="checkbox" checked={ipConfirmed} onChange={(e)=>setIpConfirmed(e.target.checked)} />
          作品が第三者の知的財産権等を侵害しないことを確認しました
        </label>
        <div className="flex items-center gap-2 text-sm text-black">
          <input id="policy-accept" type="checkbox" checked={policyAccepted} onChange={(e)=>setPolicyAccepted(e.target.checked)} />
          <label htmlFor="policy-accept">
            <span className="mr-1">以下に同意します:</span>
            <a href="#terms" className="text-blue-600 underline hover:text-blue-800">利用規約</a>
            <span className="mx-1">・</span>
            <a href="#privacy" className="text-blue-600 underline hover:text-blue-800">プライバシーポリシー</a>
          </label>
        </div>
        {!(ipConfirmed && policyAccepted) && (
          <p className="text-xs text-red-600">法務確認のチェックは必須です。</p>
        )}
      </section>

      {/* 次へ/保存 */}
      <div className="flex justify-between gap-2">
        <Button variant="secondary" disabled>ステップ1</Button>
        <div className="flex gap-2">
          <Button onClick={onSubmit} variant="secondary">下書き保存</Button>
          <Button onClick={() => {
            setTriedStep1Next(true)
            const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (title.trim().length === 0) { showToast({ message: 'タイトルは必須です。', variant: 'error' }); scrollTo(titleRef.current); titleInputRef.current?.focus(); return }
            if (images.length === 0) { showToast({ message: '画像は最低1枚必要です。', variant: 'error' }); scrollTo(imagesRef.current); fileInputRef.current?.focus(); return }
            if (!(ipConfirmed && policyAccepted)) { showToast({ message: '法務確認のチェックは必須です。', variant: 'error' }); scrollTo(legalRef.current); ipCheckboxRef.current?.focus(); return }
            setStep(2)
            setTriedStep1Next(false)
          }}>グッズ設定へ</Button>
        </div>
      </div>
      </>}

      {step === 2 && <>
      {/* エラー要約（Step2） */}
      {(triedStep2Next && (!validations.factoryOk || !validations.modelOk)) && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">
          <div className="font-medium mb-1">入力に不備があります。以下を修正してください。</div>
          <ul className="list-disc list-inside text-sm">
            {!validations.factoryOk && <li>工場を選択してください。</li>}
            {!validations.modelOk && <li>商品タイプ（モデル）を選択してください。</li>}
          </ul>
        </div>
      )}
      {/* 工場選択（カードUI） */}
      <section ref={factoryRef} className={`bg-white rounded-lg shadow-sm border space-y-3 p-6 ${factoryError ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
        <span className="block text-sm font-bold text-black">工場選択
          <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
          {!factoryId && <AlertCircle className="inline ml-2 text-red-600 h-4 w-4 align-middle" />}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {partners.map(p => {
            const selected = p.id === factoryId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { setFactoryId(p.id); setProductModelId('') }}
                className={`text-left rounded-lg border p-4 hover:shadow transition ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-black">{p.name || p.company_name || 'Factory'}</div>
                  {selected && <span className="text-xs text-blue-600">選択中</span>}
                </div>
                <div className="mt-1 text-xs text-gray-600">{p.website_url || p.description || '—'}</div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${p.status==='approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {p.status==='approved' ? '稼働中' : '停止/準備中'}
                  </span>
                  {typeof p.average_rating === 'number' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-800 border-yellow-200">評価 {p.average_rating.toFixed(1)}</span>
                  )}
                  {typeof p.total_orders === 'number' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">実績 {p.total_orders}</span>
                  )}
                </div>
                {Array.isArray(partnerCategoryMap[p.id]) && partnerCategoryMap[p.id].length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {partnerCategoryMap[p.id].map(cat => (
                      <span key={p.id + ':' + cat} className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">{cat}</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {!factoryId && (
          <p className="text-xs text-gray-600">工場を選択してください</p>
        )}
        {factoryId && partnerProducts.length > 0 && (
          <div className="pt-1">
            <div className="text-xs text-gray-600 mb-1">対応カテゴリ</div>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(partnerProducts.map(pp => productTypeToCategory(pp.product_type)))).map(cat => (
                <span key={cat} className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">{cat}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 商品タイプ（モデル） - カードUI */}
      <section ref={modelRef} className={`bg-white rounded-lg shadow-sm border space-y-3 p-6 ${modelError ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
        <span className="block text-sm font-bold text-black">商品タイプ（モデル）
          <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
          {factoryId && !productModelId && <AlertCircle className="inline ml-2 text-red-600 h-4 w-4 align-middle" />}
        </span>
        {factoryId ? (
          partnerProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {partnerProducts.map((prod) => {
                const selected = prod.id === productModelId
                const title = prod.options?.display_name || prod.product_type
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => setProductModelId(prod.id)}
                    className={`text-left rounded-lg border p-4 hover:shadow transition ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={defaultImages.product} alt="model" className="w-14 h-14 rounded object-cover border" />
                      <div className="min-w-0">
                        <div className="font-medium text-black truncate">{title}</div>
                        <div className="text-xs text-gray-600">原価 {prod.base_cost} 円 / リード {prod.lead_time_days} 日</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {productTypeToCategory(prod.product_type)}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-gray-50 text-gray-700 border">{prod.product_type}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-600">この工場には選択可能なモデルがありません</p>
          )
        ) : (
          <p className="text-xs text-gray-600">先に工場を選択してください</p>
        )}
      </section>

      {/* 商品タイプ・在庫設定は受注生産を基本とするためUI削除 */}

      {/* バリエーション（工場選択後に表示） */}
      {factoryId && (
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="block text-sm font-bold text-black">バリエーション（サイズ×カラー）</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">サイズ（例: S,M,L）</span>
            <Input value={sizeOptions} onChange={(e)=> setSizeOptions(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">カラー（例: Black,White）</span>
            <Input value={colorOptions} onChange={(e)=> setColorOptions(e.target.value)} />
          </label>
        </div>
        {/* 在庫モードは上のセクションに移動済み */}
      </section>
      )}

      {/* 商品仕様 */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="block text-sm font-bold text-black">商品仕様</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">素材</span>
            <Input value={material} onChange={(e)=> setMaterial(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">許容差/注意事項</span>
            <Input value={tolerance} onChange={(e)=> setTolerance(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-600">サイズ表</span>
          <Textarea rows={3} value={sizeChart} onChange={(e)=> setSizeChart(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-600">取扱表示</span>
          <Textarea rows={3} value={careLabels} onChange={(e)=> setCareLabels(e.target.value)} />
        </label>
      </section>

      {/* 配送プロファイル（簡易表示に変更） - 工場選択後に表示 */}
      {factoryId && (
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="block text-sm font-bold text-black">配送プロファイル</span>
        <Select value={shippingProfile} onChange={(e)=> setShippingProfile(e.target.value)}>
          <option value="factory-default">工場デフォルト料金</option>
          <option value="weight-based">重量ベース（自動計算）</option>
          {(() => {
            const partner = partners.find(p=>p.id===factoryId)
            const s: any = partner?.shipping_info || null
            const opts: Array<{v:string,l:string}> = []
            if (s?.fee_general_jpy) opts.push({ v: 'general', l: `一般送料: ${s.fee_general_jpy}円（${s?.carrier_name || '指定なし'}）` })
            if (s?.fee_okinawa_jpy) opts.push({ v: 'okinawa', l: `沖縄送料: ${s.fee_okinawa_jpy}円` })
            return opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)
          })()}
        </Select>
        {/* 詳細情報は折りたたみ等で将来対応。JSON生表示は削除 */}
      </section>
      )}

      {/* 印刷仕様 - 工場選択後に表示 */}
      {factoryId && (
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-bold text-black">印刷仕様（面ごと）</span>
          <Button type="button" onClick={()=> setPrintSurfaces([...printSurfaces, { surfaceId: 'front', widthMm: '', heightMm: '', method: 'DTG', assetUrl: images[0] || '' }])}>面を追加</Button>
        </div>
        <div className="space-y-3">
          {printSurfaces.map((ps, idx) => (
            <div key={idx} className="rounded border p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-gray-600">面</span>
                  <Select value={ps.surfaceId} onChange={(e)=>{ const arr=[...printSurfaces]; arr[idx]={...ps, surfaceId: e.target.value}; setPrintSurfaces(arr) }}>
                    <option value="front">前面</option>
                    <option value="back">背面</option>
                    <option value="sleeve">袖</option>
                  </Select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-gray-600">加工方式</span>
                  <Select value={ps.method} onChange={(e)=>{ const arr=[...printSurfaces]; arr[idx]={...ps, method: e.target.value}; setPrintSurfaces(arr) }}>
                    <option>DTG</option>
                    <option>昇華</option>
                    <option>シルク</option>
                    <option>刺繍</option>
                    <option>UV</option>
                  </Select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-gray-600">印刷枠 幅(mm)</span>
                  <Input type="number" value={ps.widthMm as any} onChange={(e)=>{ const arr=[...printSurfaces]; arr[idx]={...ps, widthMm: e.target.value===''?'':Math.max(0, Math.floor(Number(e.target.value)||0))}; setPrintSurfaces(arr) }} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-gray-600">印刷枠 高さ(mm)</span>
                  <Input type="number" value={ps.heightMm as any} onChange={(e)=>{ const arr=[...printSurfaces]; arr[idx]={...ps, heightMm: e.target.value===''?'':Math.max(0, Math.floor(Number(e.target.value)||0))}; setPrintSurfaces(arr) }} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-gray-600">入稿アセットURL</span>
                  <Select value={ps.assetUrl} onChange={(e)=>{ const arr=[...printSurfaces]; arr[idx]={...ps, assetUrl: e.target.value}; setPrintSurfaces(arr) }}>
                    {[...images, ''].map((u, i)=>(<option key={u+String(i)} value={u}>{u ? `画像${i+1}` : '未選択'}</option>))}
                  </Select>
                </label>
              </div>
              <div className="mt-2 text-right"><Button variant="secondary" type="button" onClick={()=> setPrintSurfaces(printSurfaces.filter((_,i)=>i!==idx))}>削除</Button></div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* 価格（概算） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="block text-sm font-bold text-black">価格の最終確認（概算）</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="text-sm p-2 bg-gray-50 rounded">
            <div className="text-xs text-gray-600">工場原価（自動）</div>
            <div className="font-medium">{Number(estimatedCost || 0)} 円</div>
          </div>
          <div className="text-sm p-2 bg-gray-50 rounded">
            <div className="text-xs text-gray-600">配送コスト（自動）</div>
            <div className="font-medium">{Number(estimatedShippingCost || 0)} 円</div>
          </div>
          <div className="text-sm p-2 bg-gray-50 rounded">
            <div>販売価格（自動提案）: {typeof price==='number'? price: 0} 円</div>
            <div>手数料(参考): {Math.floor((typeof price==='number'? price: 0) * feeRate)} 円</div>
          </div>
        </div>
      </section>

      {/* 戻る/次へ */}
      <div className="flex justify-between gap-2">
        <Button variant="secondary" onClick={()=> setStep(1)}>戻る</Button>
        <div className="flex gap-2">
          <Button onClick={() => {
            setTriedStep2Next(true)
            const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (!factoryId) {
              showToast({ message: '工場の選択は必須です。', variant: 'error' });
              scrollTo(factoryRef.current);
              const firstBtn = factoryRef.current?.querySelector('button') as HTMLButtonElement | null
              firstBtn?.focus()
              return
            }
            if (!productModelId) {
              showToast({ message: '商品タイプ（モデル）の選択は必須です。', variant: 'error' });
              scrollTo(modelRef.current);
              const firstBtn = modelRef.current?.querySelector('button') as HTMLButtonElement | null
              firstBtn?.focus()
              return
            }
            setStep(3)
            setTriedStep2Next(false)
          }} disabled={busy}>最終確認へ</Button>
        </div>
      </div>
      </>}

      {step === 3 && (
        <>
          {/* 最終確認 */}
          <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
            <span className="block text-sm font-bold text-black">最終確認</span>
            <div className="text-sm text-gray-800 space-y-2">
              <div><span className="text-gray-500">タイトル:</span> {title}</div>
              <div><span className="text-gray-500">説明:</span> {description}</div>
              <div><span className="text-gray-500">販売期間:</span> {saleStart || '(自動)'} 〜 {saleEnd || '(自動)'}（最大1年）</div>
              <div><span className="text-gray-500">カテゴリ:</span> {enabledFamilies.join(', ') || '—'}</div>
              <div><span className="text-gray-500">画像枚数:</span> {images.length}（同時出品数）</div>
              <div><span className="text-gray-500">工場:</span> {partners.find(p=>p.id===factoryId)?.name || '—'}</div>
              <div><span className="text-gray-500">モデル:</span> {partnerProducts.find(x=>x.id===productModelId)?.options?.display_name || partnerProducts.find(x=>x.id===productModelId)?.product_type || '—'}</div>
              <div><span className="text-gray-500">概算:</span> 原価{Number(estimatedCost||0)}円 / 配送{Number(estimatedShippingCost||0)}円 / 価格{typeof price==='number'? price: 0}円</div>
            </div>
          </section>

          {/* 戻る/保存 */}
          <div className="flex justify-between gap-2">
            <Button variant="secondary" onClick={()=> setStep(2)}>戻る</Button>
            <div className="flex gap-2">
              <Button onClick={onSubmit} variant="secondary">下書き保存</Button>
              <Button onClick={()=> setShowConfirmModal(true)} disabled={busy}>保存</Button>
            </div>
          </div>
        </>
      )}

      {showConfirmModal && (
        <Modal onClose={() => setShowConfirmModal(false)} title="公開前の最終確認">
          <ModalHeader>公開前の最終確認</ModalHeader>
          <ModalBody>
            <div className="space-y-4 text-sm">
              {/* プレビュー */}
              <div>
                <div className="text-xs text-gray-600 mb-1">作成される商品ページ（{images.slice(0,5).length}件）</div>
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0,5).map((u,i)=>(
                    <div key={u+i} className="rounded border p-1">
                      <img src={u} alt={`preview-${i}`} className="w-full h-20 object-cover rounded" />
                      <div className="mt-1 text-[11px] truncate">{title || 'タイトル未設定'}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 必須項目チェックリスト */}
              <div>
                <div className="text-xs text-gray-600 mb-1">必須項目の確認</div>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    {validations.titleOk ? <CheckCircle2 className="text-green-600 h-4 w-4"/> : <XCircle className="text-red-600 h-4 w-4"/>}
                    <span>タイトル</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {validations.imagesOk ? <CheckCircle2 className="text-green-600 h-4 w-4"/> : <XCircle className="text-red-600 h-4 w-4"/>}
                    <span>製品の画像（1枚以上）</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {validations.periodOk ? <CheckCircle2 className="text-green-600 h-4 w-4"/> : <XCircle className="text-red-600 h-4 w-4"/>}
                    <span>販売期間（開始から最大1年以内）</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {validations.legalOk ? <CheckCircle2 className="text-green-600 h-4 w-4"/> : <XCircle className="text-red-600 h-4 w-4"/>}
                    <span>法務確認（2つのチェック）</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {validations.factoryOk ? <CheckCircle2 className="text-green-600 h-4 w-4"/> : <XCircle className="text-red-600 h-4 w-4"/>}
                    <span>工場選択</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {validations.modelOk ? <CheckCircle2 className="text-green-600 h-4 w-4"/> : <XCircle className="text-red-600 h-4 w-4"/>}
                    <span>商品タイプ（モデル）</span>
                  </li>
                </ul>
              </div>
              {/* 注意事項リンク */}
              <div className="text-xs text-gray-600">
                <a href="#terms" className="text-blue-600 underline hover:text-blue-800">利用規約</a>・
                <a href="#privacy" className="text-blue-600 underline hover:text-blue-800">プライバシーポリシー</a>・
                <a href="#faq" className="text-blue-600 underline hover:text-blue-800">よくある質問</a>
              </div>
              {/* 確認チェック */}
              <div className="space-y-3">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={confirmChecks.infoAccurate} onChange={(e)=> setConfirmChecks(v=>({...v, infoAccurate: e.target.checked}))} />
                  <span>入力内容（タイトル/説明/販売期間/画像/工場・モデル）に誤りがないことを確認しました。</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={confirmChecks.agreeRules} onChange={(e)=> setConfirmChecks(v=>({...v, agreeRules: e.target.checked}))} />
                  <span>ガイドライン・利用規約に従い、知的財産権等に問題がないことを確認しました。</span>
                </label>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={()=> setShowConfirmModal(false)}>キャンセル</Button>
              <Button
                onClick={async ()=> {
                  const allOk = Object.values(validations).every(Boolean)
                  if (confirmChecks.infoAccurate && confirmChecks.agreeRules && allOk) {
                    await onSubmit(); setShowConfirmModal(false); setConfirmChecks({infoAccurate:false, agreeRules:false})
                  }
                }}
                disabled={!confirmChecks.infoAccurate || !confirmChecks.agreeRules || !Object.values(validations).every(Boolean)}
              >公開する</Button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* 公開設定（常時） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="mb-1 block text-sm font-bold text-black">公開設定</span>
        <label className="flex items-center gap-2 text-sm text-black">
          <input type="checkbox" checked={isPrivate} onChange={(e)=> setIsPrivate(e.target.checked)} />
          プライベート（チェック時は非公開・下書き）
        </label>
      </section>

      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{message}</div>}
      </main>
    </div>
  )
  // 認証は useRequireAuth の LoginGate で制御
}
