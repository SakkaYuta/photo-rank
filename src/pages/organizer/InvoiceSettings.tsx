import React, { useState, useEffect } from 'react'
import { supabase } from '@/services/supabaseClient'

const InvoiceSettings: React.FC = () => {
  const [isTaxable, setIsTaxable] = useState<boolean>(false)
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('users').select('metadata').eq('id', user.id).maybeSingle()
        const meta = (data as any)?.metadata || {}
        if (typeof meta.is_taxable_business === 'boolean') setIsTaxable(Boolean(meta.is_taxable_business))
        if (meta.invoice_registration_number) setRegistrationNumber(String(meta.invoice_registration_number))
      } catch {}
    })()
  }, [])

  const onSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')
      // メタデータに格納（スキーマ非依存）
      const { data } = await supabase.from('users').select('metadata').eq('id', user.id).maybeSingle()
      const metadata = { ...(data as any)?.metadata, is_taxable_business: isTaxable, invoice_registration_number: isTaxable ? (registrationNumber || null) : null }
      await supabase.from('users').update({ metadata }).eq('id', user.id)
      alert('インボイス設定を保存しました')
    } catch (e: any) {
      alert(`保存に失敗しました: ${e?.message || ''}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">インボイス設定</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">課税事業者</label>
          <select className="input input-bordered w-full" value={isTaxable ? 'yes' : 'no'} onChange={e=>setIsTaxable(e.target.value==='yes')}>
            <option value="no">免税事業者（インボイス未対応）</option>
            <option value="yes">課税事業者（インボイス対応）</option>
          </select>
        </div>
        {isTaxable && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">適格請求書発行事業者登録番号</label>
            <input className="input input-bordered w-full" value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} placeholder="Tから始まる登録番号（例: T1234567890123）" />
          </div>
        )}
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </div>
        <div className="text-xs text-gray-500">
          参考: <button className="text-blue-600 underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('terms'))}>利用規約</button>
        </div>
      </div>
    </div>
  )
}

export default InvoiceSettings
