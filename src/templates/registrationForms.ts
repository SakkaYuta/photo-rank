export type FormField = {
  id: string
  label: string
  placeholder?: string
  required?: boolean
  help?: string
  type?: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'file'
  options?: { value: string; label: string }[]
}

export type FormTemplate = {
  key: 'manufacturing_partner' | 'organizer'
  title: string
  intro: string
  notice: string
  fields: FormField[]
  consent: string
}

export const ManufacturingPartnerApplicationForm: FormTemplate = {
  key: 'manufacturing_partner',
  title: '製造パートナー（工場・印刷業者）登録申請',
  intro:
    '本フォームは工場・印刷業者さま向けの登録申請フォームです。申請内容を基に審査を行い、登録可否をメールでご連絡します。',
  notice:
    '登録は承認制です。申請受付後、原則2週間以内を目安に登録可否をメールで通知いたします（審査状況により前後する場合があります）。必要書類の追加提出をお願いすることがあります。',
  fields: [
    { id: 'company_name', label: '会社名（屋号）', required: true, placeholder: '例）株式会社サンプル工業' },
    { id: 'representative_name', label: 'ご担当者名', required: true, placeholder: '例）製造 太郎' },
    { id: 'contact_email', label: '連絡先メールアドレス', required: true, type: 'email', placeholder: 'sample@example.com' },
    { id: 'contact_phone', label: '連絡先電話番号', required: false, type: 'tel', placeholder: '例）03-1234-5678' },
    { id: 'website_url', label: 'Webサイト/ポートフォリオ', required: false, type: 'url', placeholder: 'https://...' },
    {
      id: 'business_type',
      label: '事業区分',
      required: true,
      type: 'select',
      options: [
        { value: 'printing', label: '印刷' },
        { value: 'apparel', label: 'アパレル' },
        { value: 'goods', label: '雑貨・小物' },
        { value: 'others', label: 'その他' }
      ]
    },
    {
      id: 'capabilities',
      label: '主要対応製品・加工・素材',
      required: true,
      type: 'textarea',
      placeholder: '例）DTF/シルク/インクジェット、コットン/ポリエステル、最大印刷サイズ、対応カラー など'
    },
    {
      id: 'capacity_sla',
      label: '月間処理能力・標準リードタイム',
      required: false,
      type: 'textarea',
      placeholder: '例）月間 2,000件／標準3〜7営業日、繁忙期 10営業日'
    },
    {
      id: 'shipping_zones',
      label: '出荷対応エリア・運送会社',
      required: false,
      type: 'textarea',
      placeholder: '例）国内全国（佐川/ヤマト）、海外は応相談'
    },
    { id: 'tax_id', label: '適格請求書発行事業者登録番号（任意）', required: false, placeholder: '例）T1234567890123' },
    {
      id: 'attachments',
      label: '添付資料（会社概要・価格表・品質基準等）',
      required: false,
      type: 'file',
      help: 'PDF/画像ファイル等。複数ある場合はZIP化してください。'
    },
    { id: 'notes', label: '補足・要望', required: false, type: 'textarea', placeholder: '任意記入' }
  ],
  consent:
    '送信により、当社の利用規約・プライバシーポリシー、ならびに審査の結果に関する個別の理由開示を行わない方針に同意したものとみなします。'
}

export const OrganizerApplicationForm: FormTemplate = {
  key: 'organizer',
  title: 'オーガナイザー登録申請',
  intro:
    '本フォームは事務所・団体・法人等のオーガナイザー向けの登録申請フォームです。申請内容を基に審査を行い、登録可否をメールでご連絡します。',
  notice:
    '登録は承認制です。申請受付後、原則2週間以内を目安に登録可否をメールで通知いたします（審査状況により前後する場合があります）。必要書類の追加提出をお願いすることがあります。',
  fields: [
    { id: 'organization_name', label: '団体名/法人名', required: true, placeholder: '例）株式会社オーガナイズ' },
    { id: 'contact_person', label: 'ご担当者名', required: true, placeholder: '例）管理 次郎' },
    { id: 'contact_email', label: '連絡先メールアドレス', required: true, type: 'email', placeholder: 'org@example.com' },
    { id: 'contact_phone', label: '連絡先電話番号', required: false, type: 'tel', placeholder: '例）03-0000-0000' },
    { id: 'website_url', label: 'Webサイト/活動実績', required: false, type: 'url', placeholder: 'https://...' },
    { id: 'creators_count', label: '所属クリエイター数', required: false, placeholder: '例）25名' },
    {
      id: 'management_policy',
      label: 'クリエイター管理体制・方針',
      required: true,
      type: 'textarea',
      placeholder: '例）制作物確認フロー、コンプライアンス遵守体制、年齢確認手順 など'
    },
    {
      id: 'use_cases',
      label: '想定ユースケース/取り扱い商品',
      required: true,
      type: 'textarea',
      placeholder: '例）イベント物販用、通販用、アパレル中心 など'
    },
    {
      id: 'attachments',
      label: '添付資料（会社概要・実績・規約等）',
      required: false,
      type: 'file',
      help: 'PDF/画像ファイル等。複数ある場合はZIP化してください。'
    },
    { id: 'notes', label: '補足・要望', required: false, type: 'textarea', placeholder: '任意記入' }
  ],
  consent:
    '送信により、当社の利用規約・プライバシーポリシー、ならびに審査の結果に関する個別の理由開示を行わない方針に同意したものとみなします。'
}

export const RegistrationForms = {
  manufacturing_partner: ManufacturingPartnerApplicationForm,
  organizer: OrganizerApplicationForm
}

