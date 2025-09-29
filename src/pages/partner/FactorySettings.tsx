import React, { useEffect, useState } from 'react'
import { usePartnerAuth } from '@/hooks/usePartnerAuth'
import { getPartnerProducts, updatePartnerSettings } from '@/services/partner.service'
import { useNav } from '@/contexts/NavContext'

const FactorySettings: React.FC = () => {
  const { partner, loading } = usePartnerAuth()
  const { navigate } = useNav()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [notificationEmail, setNotificationEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [addressRaw, setAddressRaw] = useState('')
  const [description, setDescription] = useState('')
  const [capSizes, setCapSizes] = useState('')
  const [capColors, setCapColors] = useState('')
  const [capMaterials, setCapMaterials] = useState('')
  const [capPrintMethods, setCapPrintMethods] = useState('')
  // 配送情報（購入ページ表示用）
  const [shipMethodTitle, setShipMethodTitle] = useState('')
  const [shipPerOrderNote, setShipPerOrderNote] = useState('')
  const [shipCarrierName, setShipCarrierName] = useState('')
  const [shipFeeGeneral, setShipFeeGeneral] = useState<string>('')
  const [shipFeeOkinawa, setShipFeeOkinawa] = useState<string>('')
  const [shipEtaText, setShipEtaText] = useState('')
  const [shipCautions, setShipCautions] = useState('')
  const [splitTitle, setSplitTitle] = useState('')
  const [splitDesc, setSplitDesc] = useState('')
  const [splitCautions, setSplitCautions] = useState('')
  // 簡易バリデーション
  const [emailValid, setEmailValid] = useState(true)
  const [websiteValid, setWebsiteValid] = useState(true)
  const [webhookValid, setWebhookValid] = useState(true)
  const [phoneValid, setPhoneValid] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const sample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  useEffect(() => {
    (async () => {
      if (partner?.id) {
        const ps = await getPartnerProducts(partner.id)
        setProducts(ps || [])
      } else if (sample) {
        setProducts([
          { id: 'prod-1', product_type: 'tshirt', base_cost: 1500, options: { display_name: 'スタンダードTシャツ' } },
          { id: 'prod-2', product_type: 'mug', base_cost: 800, options: { display_name: 'セラミックマグ' } },
        ] as any)
      }
      // 初期値（パートナー最新状態に合わせる）
      setWebhookUrl(((partner as any)?.webhook_url) || 'https://example.com/webhook')
      setNotificationEmail(partner?.contact_email || 'partner@example.com')
      setCompanyName(partner?.company_name || '')
      setContactPhone((partner as any)?.contact_phone || '')
      setWebsiteUrl((partner as any)?.website_url || '')
      setDescription((partner as any)?.description || '')
      try {
        const addr = (partner as any)?.address
        if (addr) setAddressRaw(addr.raw || '')
      } catch {}
      try {
        const caps = (partner as any)?.capabilities || {}
        if (Array.isArray(caps.sizes)) setCapSizes(caps.sizes.join(','))
        if (Array.isArray(caps.colors)) setCapColors(caps.colors.join(','))
        if (Array.isArray(caps.materials)) setCapMaterials(caps.materials.join(','))
        if (Array.isArray(caps.print_methods)) setCapPrintMethods(caps.print_methods.join(','))
      } catch {}
      try {
        const s = (partner as any)?.shipping_info || {}
        if (s.method_title) setShipMethodTitle(s.method_title)
        if (s.per_order_note) setShipPerOrderNote(s.per_order_note)
        if (s.carrier_name) setShipCarrierName(s.carrier_name)
        if (typeof s.fee_general_jpy === 'number') setShipFeeGeneral(String(s.fee_general_jpy))
        if (typeof s.fee_okinawa_jpy === 'number') setShipFeeOkinawa(String(s.fee_okinawa_jpy))
        if (s.eta_text) setShipEtaText(s.eta_text)
        if (Array.isArray(s.cautions)) setShipCautions((s.cautions as string[]).join('\n'))
        if (s.split_title) setSplitTitle(s.split_title)
        if (s.split_desc) setSplitDesc(s.split_desc)
        if (Array.isArray(s.split_cautions)) setSplitCautions((s.split_cautions as string[]).join('\n'))
      } catch {}
    })()
  }, [partner])

  // パートナー情報がリアルタイムで更新された場合、メール欄へ即時反映
  useEffect(() => {
    if (partner?.contact_email) {
      setNotificationEmail(partner.contact_email)
    }
  }, [partner?.contact_email])

  const onSave = async () => {
    // 入力チェック
    const isEmail = (v: string) => !v || /.+@.+\..+/.test(v)
    const isUrl = (v: string) => {
      if (!v) return true
      try { new URL(v); return true } catch { return false }
    }
    const isPhone = (v: string) => !v || /^[0-9+\-()\s]{5,}$/.test(v)

    const ev = isEmail(notificationEmail)
    const wsv = isUrl(websiteUrl)
    const whv = isUrl(webhookUrl)
    const pv = isPhone(contactPhone)
    setEmailValid(ev); setWebsiteValid(wsv); setWebhookValid(whv); setPhoneValid(pv)
    if (!ev || !wsv || !whv || !pv) {
      alert('入力内容をご確認ください（メール/URL/電話番号の形式に誤りがあります）')
      return
    }

    setSaving(true)
    try {
      if (sample) {
        alert('（サンプル）設定を保存しました')
        return
      }
      if (!partner?.id) {
        alert('パートナー情報が見つかりません')
        return
      }

      const parseCsv = (v: string) => (v || '').split(',').map(s => s.trim()).filter(Boolean)
      const capabilities = {
        sizes: parseCsv(capSizes),
        colors: parseCsv(capColors),
        materials: parseCsv(capMaterials),
        print_methods: parseCsv(capPrintMethods),
      }
      // 空配列のみなら capabilities は null 扱い
      const emptyCaps = Object.values(capabilities).every((arr: any) => !arr || (Array.isArray(arr) && arr.length === 0))

      // 配送情報の整形
      const parseLines = (v: string) => (v || '')
        .split(/\r?\n/)
        .map(s => s.replace(/^\s*[・\-\*]\s*/, '').trim())
        .filter(Boolean)
      const shipping_info = {
        method_title: shipMethodTitle || '宅配便',
        per_order_note: shipPerOrderNote || '1つの注文番号ごとに送料が発生いたします。',
        carrier_name: shipCarrierName || '佐川急便株式会社',
        fee_general_jpy: shipFeeGeneral ? parseInt(shipFeeGeneral) : undefined,
        fee_okinawa_jpy: shipFeeOkinawa ? parseInt(shipFeeOkinawa) : undefined,
        eta_text: shipEtaText || '出荷日の翌日以降～ ※地域により変動',
        cautions: parseLines(shipCautions),
        split_title: splitTitle || '分納について',
        split_desc: splitDesc || '',
        split_cautions: parseLines(splitCautions),
      }

      await updatePartnerSettings(partner.id, {
        contact_email: notificationEmail || null,
        webhook_url: webhookUrl || null,
        company_name: companyName || null,
        contact_phone: contactPhone || null,
        website_url: websiteUrl || null,
        address: addressRaw ? { raw: addressRaw } : null,
        description: description || null,
        capabilities: emptyCaps ? null : (capabilities as any),
        shipping_info,
      })

      alert('設定を保存しました')
    } catch (e: any) {
      console.error('FactorySettings save error:', e)
      alert(`設定の保存に失敗しました。\n${e?.message || ''}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6">読み込み中...</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">工場設定</h1>

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
            onClick={() => navigate('partner-products')}
            className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            商品管理
          </button>
          <button
            className="py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600"
          >
            設定
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* 基本情報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-900 mb-1">工場名（読み取り）</label>
            <input className="input input-bordered w-full" value={partner?.name || 'デモ製造パートナー'} readOnly />
          </div>
          <div>
            <label className="block text-sm text-gray-900 mb-1">会社名（company_name）</label>
            <input className="input input-bordered w-full" value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="例: 株式会社フォトプリント" />
          </div>
          <div>
            <label className="block text-sm text-gray-900 mb-1">電話番号</label>
            <input className="input input-bordered w-full" value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="例: 03-1234-5678" />
          </div>
          <div>
            <label className="block text-sm text-gray-900 mb-1">WebサイトURL</label>
            <input className="input input-bordered w-full" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
          </div>
        </div>

        {/* 連絡先/連携 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-900 mb-1">通知メール</label>
            <input className="input input-bordered w-full" value={notificationEmail} onChange={e=>setNotificationEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-900 mb-1">Webhook URL</label>
            <input className="input input-bordered w-full" value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-gray-900 mt-1">注文作成/更新時に通知します（Stripe決済/製造連携用）</p>
          </div>
        </div>

        {/* 住所/説明 */}
        <div>
          <label className="block text-sm text-gray-900 mb-1">住所</label>
          <textarea className="textarea textarea-bordered w-full min-h-[80px]" value={addressRaw} onChange={e=>setAddressRaw(e.target.value)} placeholder="例: 〒100-0001 東京都千代田区千代田1-1" />
          <p className="text-xs text-gray-500 mt-1">簡易入力です。保存時は内部的にJSON（{`{ raw: "..." }`}）として保存します。</p>
          <label className="block text-sm text-gray-900 mb-1 mt-4">会社説明</label>
          <textarea className="textarea textarea-bordered w-full min-h-[80px]" value={description} onChange={e=>setDescription(e.target.value)} placeholder="例: アパレル製品を中心に短納期で対応可能です。" />
        </div>

      {/* 対応可能な仕様（capabilities） */}
      <div>
          <label className="block text-sm text-gray-900 mb-2">対応可能な仕様</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">サイズ（カンマ区切り）</label>
              <input className="input input-bordered w-full" value={capSizes} onChange={e=>setCapSizes(e.target.value)} placeholder="例: XS,S,M,L,XL" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">カラー（カンマ区切り）</label>
              <input className="input input-bordered w-full" value={capColors} onChange={e=>setCapColors(e.target.value)} placeholder="例: ホワイト,ブラック,ネイビー" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">素材（カンマ区切り）</label>
              <input className="input input-bordered w-full" value={capMaterials} onChange={e=>setCapMaterials(e.target.value)} placeholder="例: 綿100%,ポリエステル" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">印刷方式（カンマ区切り）</label>
              <input className="input input-bordered w-full" value={capPrintMethods} onChange={e=>setCapPrintMethods(e.target.value)} placeholder="例: DTG,シルク,昇華転写" />
            </div>
          </div>
      </div>

      {/* 商品のお届けについて（購入ページ表示用） */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">商品のお届けについて（購入ページに表示）</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">配送方法の見出し</label>
            <input className="input input-bordered w-full" value={shipMethodTitle} onChange={e=>setShipMethodTitle(e.target.value)} placeholder="例: 宅配便" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">配送会社</label>
            <input className="input input-bordered w-full" value={shipCarrierName} onChange={e=>setShipCarrierName(e.target.value)} placeholder="例: 佐川急便株式会社" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">送料に関する注記</label>
            <input className="input input-bordered w-full" value={shipPerOrderNote} onChange={e=>setShipPerOrderNote(e.target.value)} placeholder="例: 1つの注文番号ごとに送料が発生いたします。" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">送料（全国・沖縄以外、税込）</label>
            <input className="input input-bordered w-full" type="number" min={0} value={shipFeeGeneral} onChange={e=>setShipFeeGeneral(e.target.value)} placeholder="例: 750" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">送料（沖縄県、税込）</label>
            <input className="input input-bordered w-full" type="number" min={0} value={shipFeeOkinawa} onChange={e=>setShipFeeOkinawa(e.target.value)} placeholder="例: 1980" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">到着目安（テキスト）</label>
            <input className="input input-bordered w-full" value={shipEtaText} onChange={e=>setShipEtaText(e.target.value)} placeholder="例: 出荷日の翌日以降～ ※地域により変動" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">注意事項（1行につき1項目）</label>
            <textarea className="textarea textarea-bordered w-full min-h-[120px]" value={shipCautions} onChange={e=>setShipCautions(e.target.value)} placeholder={"・到着は目安です...\n・お届け先が離島の場合は..."} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">分納について（見出し）</label>
            <input className="input input-bordered w-full" value={splitTitle} onChange={e=>setSplitTitle(e.target.value)} placeholder="分納について" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">分納の説明</label>
            <textarea className="textarea textarea-bordered w-full min-h-[80px]" value={splitDesc} onChange={e=>setSplitDesc(e.target.value)} placeholder="複数種類のアイテムをまとめてご注文いただく際..." />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">分納に関する注意（1行につき1項目）</label>
            <textarea className="textarea textarea-bordered w-full min-h-[100px]" value={splitCautions} onChange={e=>setSplitCautions(e.target.value)} placeholder={"・諸状況により、異なる配送会社でのお届けになる場合があります。\n・同梱出荷は対応できません。"} />
          </div>
        </div>
      </div>

        {/* 有効商品 */}
        <div>
          <label className="block text-sm text-gray-900 mb-2">有効な商品種別</label>
          <div className="flex flex-wrap gap-2">
            {products.map(p => (
              <span
                key={p.id}
                className="badge badge-outline text-gray-900"
              >
                {(p as any).options?.display_name || p.product_type}
              </span>
            ))}
            {products.length === 0 && <span className="text-sm text-gray-900">商品が見つかりません</span>}
          </div>
        </div>

        <div className="flex justify-end">
          <button className={`btn btn-primary ${(!emailValid || !websiteValid || !webhookValid || !phoneValid) ? 'btn-disabled opacity-70' : ''}`} onClick={onSave} disabled={saving || !emailValid || !websiteValid || !webhookValid || !phoneValid}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

export default FactorySettings
