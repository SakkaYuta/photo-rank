import React, { useState, useEffect } from 'react'
import { supabase } from '@/services/supabaseClient'

const InvoiceSettings: React.FC = () => {
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      // 実装メモ: 現状はユーザープロファイルから読み込む想定のプレースホルダー
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('users').select('invoice_registration_number').eq('id', user.id).maybeSingle()
        if ((data as any)?.invoice_registration_number) setRegistrationNumber((data as any).invoice_registration_number)
      } catch {}
    })()
  }, [])

  const onSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')
      await supabase.from('users').update({ invoice_registration_number: registrationNumber || null }).eq('id', user.id)
      alert('インボイス設定を保存しました')
    } catch (e: any) {
      alert(`保存に失敗しました: ${e?.message || ''}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">インボイス設定</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <p className="text-gray-700">適格請求書発行事業者登録番号（例: T1234567890123）を登録できます。</p>
        <input className="input input-bordered w-full" value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} placeholder="Tから始まる登録番号" />
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

