import { useMemo, useState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, XCircle, Star, Building2 } from 'lucide-react'
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
import { processUploadedWorkImage } from '@/services/uploadPipeline.service'
import type { ManufacturingPartner, FactoryProduct } from '@/types/partner.types'
import { supabase } from '../../services/supabaseClient'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useUserRole } from '@/hooks/useUserRole'

export function CreateWork() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  // 基本情報
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('wallpaper')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number | ''>(1000)
  const [isPrivate, setIsPrivate] = useState(false)
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
  // クリエイター取り分（任意・円）
  const [creatorMargin, setCreatorMargin] = useState<number | ''>(1000)

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
    const creatorMarginVal = Number(creatorMargin || 0)
    const fee = Math.floor(basePrice * feeRate)
    return { basePrice, cost, ship, fee, creatorMargin: creatorMarginVal, gross: basePrice - cost - ship - fee }
  }, [price, estimatedCost, estimatedShippingCost, creatorMargin])

  // ===== 工場カタログ・製品の接続 =====
  const [partners, setPartners] = useState<ManufacturingPartner[]>([])
  // ストレージパスの保持（メタデータ保存用）
  const [imagePreviewStoragePaths, setImagePreviewStoragePaths] = useState<string[]>([])
  const [imageOriginalStoragePaths, setImageOriginalStoragePaths] = useState<string[]>([])
  const [partnerProducts, setPartnerProducts] = useState<FactoryProduct[]>([])
  const [partnerCategoryMap, setPartnerCategoryMap] = useState<Record<string, string[]>>({})
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmChecks, setConfirmChecks] = useState({ infoAccurate: false, agreeRules: false })
  // おすすめ設定（Step2: 工場・仕様）
  const [useRecommended, setUseRecommended] = useState(true)
  const [showFactorySelector, setShowFactorySelector] = useState(false)

  const applyRecommendedSettings = async () => {
    try {
      // 既に工場がプリファレンス等で設定済みなら上書きしない
      if (factoryId) return
      if (!Array.isArray(partners) || partners.length === 0) return
      // 1) おすすめ工場: 承認済み + 評価/実績が高そうなもの、なければ先頭
      const sorted = [...partners].sort((a: any, b: any) => {
        const ar = (a?.average_rating ?? 0)
        const br = (b?.average_rating ?? 0)
        const ao = (a?.total_orders ?? 0)
        const bo = (b?.total_orders ?? 0)
        return (br - ar) || (bo - ao)
      })
      const recFactory = sorted[0]
      if (!recFactory) return
      setFactoryId(recFactory.id)

      // 2) おすすめモデル: その工場の最初のモデル（display_name優先）
      let prods = partnerProducts
      if (!prods || prods.length === 0) {
        try { prods = await getPartnerProducts(recFactory.id) } catch {}
      }
      if (prods && prods.length > 0) {
        const preferred = [...prods].sort((a: any, b: any) => {
          const an = a?.options?.display_name ? 1 : 0
          const bn = b?.options?.display_name ? 1 : 0
          return (bn - an)
        })[0]
        if (preferred) {
          setProductModelId(preferred.id)
          // 原価などの関連フィールド反映
          setEstimatedCost(preferred.base_cost)
          // カテゴリ/詳細の提案
          const cat = productTypeToCategory(preferred.product_type)
          const keyMap: Record<string,string> = { 'アパレル':'apparel','アクセサリー':'accessory','ディスプレイ':'display','日用品':'daily','デジタル':'digital','印刷物':'print' }
          const familyKey = keyMap[cat] || null
          if (familyKey) {
            setEnabledFamilies(prev => Array.from(new Set([...(prev||[]), familyKey])))
          }
        }
      }

      // 3) 送料プロフィールの推奨
      const s: any = (recFactory as any)?.shipping_info || null
      if (s) {
        setShippingProfile('factory-default')
        if (typeof s.fee_general_jpy === 'number') setEstimatedShippingCost(Number(s.fee_general_jpy))
      }

      // 4) バリエーション・在庫は受注生産で簡易設定
      setVariantStockMode('made_to_order')
      if (!sizeOptions) setSizeOptions('M,L,XL')
      if (!colorOptions) setColorOptions('Black,White')
    } catch (e) {
      console.warn('おすすめ設定の適用に失敗しました', e)
    }
  }

  useEffect(() => {
    if (useRecommended && !factoryId) {
      applyRecommendedSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRecommended, factoryId])

  // パートナー一覧が後から読み込まれる場合にも、おすすめ設定を自動適用
  useEffect(() => {
    if (useRecommended && !factoryId && Array.isArray(partners) && partners.length > 0) {
      applyRecommendedSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners, useRecommended])

  useEffect(() => {
    // 入力の一時保存（再描画や一時的なアンマウント時に消えないように）
    try {
      const raw = localStorage.getItem('cw_state_v1')
      if (raw) {
        const s = JSON.parse(raw)
        if (Array.isArray(s.images)) setImages(s.images)
        if (Array.isArray(s.previewPaths)) setImagePreviewStoragePaths(s.previewPaths)
        if (Array.isArray(s.originalPaths)) setImageOriginalStoragePaths(s.originalPaths)
        if (typeof s.ipConfirmed === 'boolean') setIpConfirmed(s.ipConfirmed)
        if (typeof s.policyAccepted === 'boolean') setPolicyAccepted(s.policyAccepted)
        // 取り分UIは提供しないため復元対象外
      }
    } catch {}
  }, [])

  // 状態の自動保存
  useEffect(() => {
    try {
      const payload = {
        images,
        previewPaths: imagePreviewStoragePaths,
        originalPaths: imageOriginalStoragePaths,
        ipConfirmed,
        policyAccepted,
        creatorMargin,
      }
      localStorage.setItem('cw_state_v1', JSON.stringify(payload))
    } catch {}
  }, [images, imagePreviewStoragePaths, imageOriginalStoragePaths, ipConfirmed, policyAccepted, creatorMargin])

  const clearPersistedState = () => {
    try { localStorage.removeItem('cw_state_v1') } catch {}
  }

  // 工場一覧を取得（approved想定）
  useEffect(() => {
    getManufacturingPartners('approved')
      .then(setPartners)
      .catch((e) => console.warn('工場一覧の取得に失敗しました', e))
  }, [])

  // 既定（カテゴリ別）から工場を自動適用
  useEffect(() => {
    (async () => {
      if (factoryId) return
      try {
        const { ProfileService } = await import('@/services/profile.service')
        const prefs = await ProfileService.getFactoryPreferences()
        for (const key of enabledFamilies) {
          const pid = (prefs as any)?.[key]
          if (pid) {
            setFactoryId(pid)
            setProductModelId('')
            break
          }
        }
      } catch {}
    })()
  }, [enabledFamilies, factoryId])

  // 工場選択ページから戻った時の factoryId 反映
  useEffect(() => {
    const applyFromHash = () => {
      try {
        const raw = window.location.hash.replace(/^#/, '')
        const qs = raw.includes('?') ? raw.split('?')[1] : ''
        const sp = new URLSearchParams(qs)
        const fid = sp.get('factoryId')
        if (fid && fid !== factoryId) {
          setFactoryId(fid)
          setProductModelId('')
          setStep(2)
        }
      } catch {}
    }
    applyFromHash()
    const onHash = () => applyFromHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [factoryId])

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
    const margin = Number(creatorMargin || 0)
    const denom = 1 - feeRate
    const suggested = Math.max(0, Math.ceil((cost + ship + margin) / (denom || 1)))
    // Step1で価格入力を削除したため、自動提案で上書き
    setPrice(suggested)
  }, [estimatedCost, estimatedShippingCost, creatorMargin])

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
  const { userProfile } = useUserRole()

  const titleLimit = 30
  const descLimit = 200
  const UPLOAD_BUCKET = 'user-content'
  const toDateInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const now = new Date()
  const oneYearLater = new Date(now.getTime() + 365*24*60*60*1000)

  // 販売期間レンジピッカー用の状態とハンドラ
  const [rangeOpen, setRangeOpen] = useState(false)
  const [tmpStart, setTmpStart] = useState<string>('')
  const [tmpEnd, setTmpEnd] = useState<string>('')
  const openRangePicker = () => {
    try {
      const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      setTmpStart(saleStart || toDateInputValue(now))
      setTmpEnd(saleEnd || toDateInputValue(defaultEnd))
    } catch {
      setTmpStart(saleStart || '')
      setTmpEnd(saleEnd || '')
    }
    setRangeOpen(true)
  }
  const applyRangePicker = () => {
    if (tmpStart) setSaleStart(tmpStart)
    if (tmpEnd) setSaleEnd(tmpEnd)
    setRangeOpen(false)
  }

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
      const isDemo = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'
      const creatorUid = user?.id || (isDemo ? ((userProfile as any)?.id || 'demo-user-1') : '')
      if (!creatorUid && !isDemo) {
        if (!requireAuth()) throw new Error('ログインが必要です')
      }
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
        creator_id: creatorUid,
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
        // ストレージ内のオリジナル/プレビューパスをメタデータとして保持
        image_preview_storage_paths: imagePreviewStoragePaths,
        image_original_storage_paths: imageOriginalStoragePaths,
        enabled_families: enabledFamilies, // 従来の互換：カテゴリキー配列
        enabled_categories: enabledFamilies,
        enabled_product_types: enabledProductTypes,
        creator_margin: { type: 'fixed', value: Number(creatorMargin || 0) },
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
      const doneMsg = isPrivate ? `${targetImages.length}件の作品を下書き保存しました` : `${targetImages.length}件の作品を公開しました`
      setMessage(doneMsg)
      // 成功トーストで明確に通知 + マイ作品へ遷移
      try { showToast({ message: doneMsg, variant: 'success' }) } catch {}
      // 遷移案内のポップを追加
      try { showToast({ message: isPrivate ? '下書き保存しました。マイ作品に移動中…' : '公開しました。マイ作品に移動中…', variant: 'default' }) } catch {}
      try {
        // 少し待ってから遷移して、トーストが視認できるようにする
        setTimeout(() => {
          import('@/utils/navigation')
            .then(m => m.navigate('myworks'))
            .catch(() => { try { window.location.hash = '#myworks' } catch {} })
        }, 800)
      } catch {
        try { window.location.hash = '#myworks' } catch {}
      }
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
      setImagePreviewStoragePaths([])
      setImageOriginalStoragePaths([])
      clearPersistedState()
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
    // モデル選択は不要仕様に変更
    modelOk: true,
    periodOk,
  }

  const titleError = !validations.titleOk
  const imagesError = !validations.imagesOk
  const legalError = !validations.legalOk
  const factoryError = step >= 2 && !validations.factoryOk
  // const modelError = step >= 2 && !validations.modelOk

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

      {/* おすすめ工場 自動選択 */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-800">最適な工場を自動で選びます（見積スコア基準）</div>
          <Button type="button" variant="secondary" size="sm" onClick={async () => {
            try {
              const fam = enabledFamilies[0] || 'apparel'
              const famToType: Record<string,string> = { apparel: 'tshirt', accessory: 'sticker', display: 'poster', daily: 'mug', digital: 'phonecase', print: 'a3' }
              const pt = famToType[fam] || 'tshirt'
              const { getFactoryQuotes } = await import('@/services/factory.service')
              const quotes = await getFactoryQuotes(pt, 10)
              const best = quotes[0]
              if (best?.partner?.id) {
                setFactoryId(best.partner.id)
                setProductModelId('')
              }
            } catch (e) { console.warn('auto-select factory failed', e) }
          }}>おすすめで選ぶ</Button>
        </div>
      </div>

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
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <span className="text-sm font-bold text-black">販売期間
            <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
          </span>
          <span className="text-xs text-gray-500">終了日は最大1年後まで。終了後は非表示になります</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">販売開始日時</span>
            <Input
              type="datetime-local"
              readOnly
              onClick={(e) => { e.preventDefault(); openRangePicker() }}
              min={toDateInputValue(now)}
              value={saleStart}
              onChange={(e) => setSaleStart(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">販売終了日時</span>
            <Input
              type="datetime-local"
              readOnly
              onClick={(e) => { e.preventDefault(); openRangePicker() }}
              max={toDateInputValue(oneYearLater)}
              value={saleEnd}
              onChange={(e) => setSaleEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">未入力の場合は自動で開始=現在、終了=30日後が設定されます。</p>
      </section>

      {/* 販売期間レンジピッカー（モーダル） */}
      {rangeOpen && (
        <Modal isOpen={true} onClose={() => setRangeOpen(false)}>
          <ModalHeader>販売期間の選択</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs text-gray-600">開始日時</span>
                <Input type="datetime-local" min={toDateInputValue(now)} value={tmpStart} onChange={(e)=> setTmpStart(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-gray-600">終了日時</span>
                <Input type="datetime-local" max={toDateInputValue(oneYearLater)} value={tmpEnd} onChange={(e)=> setTmpEnd(e.target.value)} />
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setRangeOpen(false)}>キャンセル</Button>
            <Button onClick={applyRangePicker}>適用する</Button>
          </ModalFooter>
        </Modal>
      )}

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
                const isDemo = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'
                const uid = user?.id || (isDemo ? ((userProfile as any)?.id || 'demo-user-1') : '')
                const secureUploads: string[] = []
                const previewPaths: string[] = []
                const originalPaths: string[] = []

                if (isDemo && !user) {
                  // デモ環境: アップロードは擬似的にローカルプレビューを採用
                  secureUploads.push(...newPreviews)
                } else {
                  if (!uid) {
                    if (!requireAuth()) throw new Error('ログインが必要です')
                  }
                  for (const file of pick) {
                    // Step 1: Upload to temporary location
                    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
                    const tempPath = `uploads/works/${uid}/${crypto.getRandomValues(new Uint32Array(4)).join('')}.${ext}`
                    const { error: upErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(tempPath, file, { upsert: false, cacheControl: '3600' })
                    if (upErr) throw upErr

                    // Step 2: Process through secure pipeline (sanitize + watermark)
                    const result = await processUploadedWorkImage(tempPath, UPLOAD_BUCKET)
                    if (!result.ok || !result.preview?.signedUrl) {
                      throw new Error(result.error || 'セキュア処理に失敗しました')
                    }

                    // Step 3: Use signed preview URL directly from Edge Function
                    secureUploads.push(result.preview.signedUrl)
                    previewPaths.push(`${result.preview.bucket}/${result.preview.path}`)
                    if (result.original?.bucket && result.original.path) {
                      originalPaths.push(`${result.original.bucket}/${result.original.path}`)
                    }
                  }
                  // ストレージ内パスも保持（作品メタデータ用）
                  setImagePreviewStoragePaths(prev => [...prev, ...previewPaths])
                  setImageOriginalStoragePaths(prev => [...prev, ...originalPaths])
                }
                setImages(prev => [...prev, ...secureUploads])
                // アップロード完了後、対応するローカルプレビューを非表示にする
                setLocalPreviews(prev => prev.filter(u => !secureUploads.includes(u)))
              } catch (err: any) {
                setMessage(err?.message || '画像のアップロードに失敗しました')
                showToast({ message: err?.message || '画像のアップロードに失敗しました', variant: 'error' })
              } finally {
                setBusy(false)
                // ローカルプレビューURLを解放してクリア
                try {
                  const isDemo = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'
                  if (!isDemo) {
                    setLocalPreviews((prev) => {
                      // 今回追加した分だけ削除・解放（他の未完了プレビューは保持）
                      newPreviews.forEach((u) => { try { URL.revokeObjectURL(u) } catch {} })
                      const removeSet = new Set(newPreviews)
                      return prev.filter(u => !removeSet.has(u))
                    })
                  }
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
                onClick={() => {
                  setImages(images.filter((_, i) => i !== idx))
                  setImagePreviewStoragePaths(imagePreviewStoragePaths.filter((_, i) => i !== idx))
                  setImageOriginalStoragePaths(imageOriginalStoragePaths.filter((_, i) => i !== idx))
                  // 画像と同一URLのローカルプレビューが残っていれば除去
                  setLocalPreviews(prev => prev.filter(u => u !== url))
                  try { if (url.startsWith('blob:')) URL.revokeObjectURL(url) } catch {}
                }}
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
      <div className="flex justify-center gap-2">
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
      </>}

      {step === 2 && <>
      {/* おすすめ設定 */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <label className="flex items-start gap-2 text-sm text-black">
            <input type="checkbox" checked={useRecommended} onChange={(e)=> setUseRecommended(e.target.checked)} />
            <span>
              <span className="font-bold">おすすめの設定で進める</span>
              <span className="block text-xs text-gray-600">公式推奨の工場・配送/在庫設定を自動で反映します（後から変更可能）。</span>
            </span>
          </label>
          {useRecommended && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setUseRecommended(false)}>自分でカスタマイズする</Button>
          )}
        </div>
      </section>
      {/* エラー要約（Step2） */}
      {(triedStep2Next && (!validations.factoryOk)) && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">
          <div className="font-medium mb-1">入力に不備があります。以下を修正してください。</div>
          <ul className="list-disc list-inside text-sm">
            {!validations.factoryOk && <li>工場を選択してください。</li>}
          </ul>
        </div>
      )}
      {/* 工場選択（マーケットプレイス風カードUI） */}
      {!useRecommended && (
      <section ref={factoryRef} className={`bg-white rounded-lg shadow-sm border space-y-3 p-6 ${factoryError ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
        <span className="block text-sm font-bold text-black">工場選択
          <span title="この項目は必須です" className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200 text-[10px]">必須</span>
          {!factoryId && <AlertCircle className="inline ml-2 text-red-600 h-4 w-4 align-middle" />}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(p => {
            const selected = p.id === factoryId
            const title = p.name || p.company_name || 'Factory'
            const desc = p.description || p.website_url || '—'
            const rating = typeof p.average_rating === 'number' ? p.average_rating.toFixed(1) : null
            const orders = typeof p.total_orders === 'number' ? p.total_orders : null
            const cats = Array.isArray(partnerCategoryMap[p.id]) ? partnerCategoryMap[p.id] : []
            return (
              <div
                key={p.id}
                className={`group rounded-xl border bg-white overflow-hidden transition hover:shadow ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'}`}
              >
                <div className="h-28 bg-gray-100">
                  <img src={defaultImages.product} alt="factory" className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <h3 className="font-semibold text-black truncate" title={title}>{title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2" title={desc}>{desc}</p>
                    </div>
                    {selected && <span className="text-xs text-blue-600 whitespace-nowrap">選択中</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${p.status==='approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {p.status==='approved' ? '稼働中' : '停止/準備中'}
                    </span>
                    {rating && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-800 border-yellow-200">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {rating}
                      </span>
                    )}
                    {orders !== null && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">
                        実績 {orders}
                      </span>
                    )}
                  </div>
                  {cats.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cats.slice(0, 6).map((cat) => (
                        <span key={p.id + ':' + cat} className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-700 border border-blue-200">{cat}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant={selected ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => {
                        import('@/utils/navigation').then(m => m.navigate('factory-catalog', { partnerId: p.id }))
                      }}
                      className="w-full"
                    >
                      {selected ? '選択中' : '詳細を見る'}
                    </Button>
                  </div>
                </div>
              </div>
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
      )}

      {/* 商品タイプ（モデル） - UI削除 */}

      {/* 商品タイプ・在庫設定は受注生産を基本とするためUI削除 */}

      {/* バリエーション（削除） */}

      {/* 商品仕様（削除） */}

      {/* 配送プロファイル（削除） */}

      {/* 印刷仕様（削除） */}

      {/* 取り分（クリエイター） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="block text-sm font-bold text-black">取り分（クリエイター）</span>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>0 円</span>
              <span>設定値: <span className="font-semibold text-black">{Number(creatorMargin || 0).toLocaleString()} 円</span></span>
              <span>10,000 円</span>
            </div>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={Number(creatorMargin || 0)}
              onChange={(e) => setCreatorMargin(Math.max(0, Math.min(10000, Number(e.target.value || 0))))}
              className="w-full accent-purple-600"
              aria-label="取り分（円）"
            />
          </div>
          <div className="text-xs text-gray-600">
            原価と配送コスト、手数料にこの取り分を加味して販売価格を自動提案します。現在の提案価格: <span className="font-semibold text-black">{typeof price==='number'? price: 0} 円</span>
          </div>
        </div>
      </section>

      {/* 価格（概算） */}
      <section className="bg-white rounded-lg shadow-sm border space-y-3 p-6">
        <span className="block text-sm font-bold text-black">価格の最終確認（概算）</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="text-sm p-2 bg-gray-50 rounded text-gray-900">
            <div className="text-xs text-gray-700">工場原価（自動）</div>
            <div className="font-medium text-black">{Number(estimatedCost || 0)} 円</div>
          </div>
          <div className="text-sm p-2 bg-gray-50 rounded text-gray-900">
            <div className="text-xs text-gray-700">配送コスト（自動）</div>
            <div className="font-medium text-black">{Number(estimatedShippingCost || 0)} 円</div>
          </div>
          <div className="text-sm p-2 bg-gray-50 rounded text-gray-900">
            <div className="text-gray-800">販売価格（自動提案）: <span className="font-semibold text-black">{typeof price==='number'? price: 0} 円</span></div>
            <div className="text-gray-800">手数料(参考): <span className="font-medium text-black">{Math.floor((typeof price==='number'? price: 0) * feeRate)} 円</span></div>
            <div className="text-gray-800">取り分(設定): <span className="font-medium text-black">{Number(creatorMargin || 0)} 円</span></div>
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
        <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="公開前の最終確認">
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
                  {/* モデル選択は不要のため削除 */}
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
                  <span>入力内容（タイトル/説明/販売期間/画像/工場）に誤りがないことを確認しました。</span>
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
