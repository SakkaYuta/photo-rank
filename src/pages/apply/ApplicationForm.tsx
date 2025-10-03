import React, { useState } from 'react'
import type { FormTemplate, FormField } from '@/templates/registrationForms'
import { supabase } from '@/services/supabaseClient'

type Props = {
  template: FormTemplate
  applicantType: 'manufacturing_partner' | 'organizer'
}

export default function ApplicationForm({ template, applicantType }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, any>>({})

  const onChange = (id: string, v: any) => setValues((prev) => ({ ...prev, [id]: v }))

  const renderField = (f: FormField) => {
    const common = {
      id: f.id,
      name: f.id,
      placeholder: f.placeholder,
      required: f.required,
      className: 'input input-bordered w-full'
    } as any

    return (
      <div key={f.id} className="space-y-1">
        <label htmlFor={f.id} className="block text-sm font-medium text-gray-900">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
        {(!f.type || f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'url') && (
          <input type={f.type || 'text'} {...common} value={values[f.id] || ''} onChange={(e) => onChange(f.id, e.target.value)} />
        )}
        {f.type === 'textarea' && (
          <textarea {...common} rows={4} value={values[f.id] || ''} onChange={(e) => onChange(f.id, e.target.value)} />
        )}
        {f.type === 'select' && (
          <select {...common} value={values[f.id] || ''} onChange={(e) => onChange(f.id, e.target.value)}>
            <option value="" disabled>選択してください</option>
            {(f.options || []).map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
        )}
        {f.type === 'file' && (
          <input type="file" {...common} onChange={(e) => onChange(f.id, (e.target as HTMLInputElement).files?.[0]?.name || '')} />
        )}
        {f.help && <p className="text-xs text-gray-500">{f.help}</p>}
      </div>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSubmittedId(null)
    try {
      const applicant_name = (values['company_name'] || values['organization_name'] || values['representative_name'] || '') as string
      const applicant_email = (values['contact_email'] || '') as string
      const { data, error } = await supabase.functions.invoke('apply-registration', {
        body: {
          type: applicantType,
          applicant_name,
          applicant_email,
          payload: values,
        }
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error?.message || '申請に失敗しました')
      setSubmittedId(data.id)
    } catch (err: any) {
      setError(err?.message || '送信時にエラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">申請を受け付けました</h1>
        <p className="text-gray-700 mb-4">申請ID: <span className="font-mono">{submittedId}</span></p>
        <p className="text-gray-700">原則2週間以内を目安に、登録可否をメールでご連絡します。審査状況により前後する場合があります。</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{template.title}</h1>
      <p className="text-gray-700 mb-2">{template.intro}</p>
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-3 text-sm mb-5">{template.notice}</div>
      <form onSubmit={onSubmit} className="space-y-4">
        {template.fields.map(renderField)}
        <div className="text-xs text-gray-600">{template.consent}</div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? '送信中...' : '申請を送信する'}
        </button>
      </form>
    </div>
  )
}

