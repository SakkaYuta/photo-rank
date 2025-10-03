export type ApplicantType = 'manufacturing_partner' | 'organizer'

type Email = {
  to?: string
  subject: string
  text: string
  html: string
}

const typeLabel = (t: ApplicantType) =>
  t === 'manufacturing_partner' ? '製造パートナー（工場・印刷業者）' : 'オーガナイザー'

const appPortalHint =
  'マイページから申請状況をご確認いただけます。ご不明点は本メールにご返信いただくか、サポート窓口までお問い合わせください。'

export function buildAckEmail(params: {
  type: ApplicantType
  applicantName?: string
  applicationId?: string
  supportEmail?: string
  reviewDays?: number
}): Email {
  const {
    type,
    applicantName = '',
    applicationId = '',
    supportEmail = 'support@example.com',
    reviewDays = 14
  } = params
  const label = typeLabel(type)
  const subject = `[${label}] 申請を受け付けました（ID: ${applicationId || '—'}）`
  const lines = [
    `${applicantName} 様`,
    '',
    `${label} の登録申請を受け付けました。`,
    `原則 ${reviewDays} 日以内を目安に、登録可否をメールにてご連絡いたします。`,
    '審査状況により前後する場合があります。追加資料のご提出をお願いすることがあります。',
    '',
    appPortalHint,
    '',
    `本件に関するお問い合わせ先: ${supportEmail}`
  ]
  const text = lines.join('\n')
  const html = lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '<br/>')).join('\n')
  return { subject, text, html }
}

export function buildApprovalEmail(params: {
  type: ApplicantType
  applicantName?: string
  applicationId?: string
  supportEmail?: string
}): Email {
  const { type, applicantName = '', applicationId = '', supportEmail = 'support@example.com' } = params
  const label = typeLabel(type)
  const subject = `[${label}] 登録承認のご連絡（ID: ${applicationId || '—'}）`
  const lines = [
    `${applicantName} 様`,
    '',
    `${label} の登録申請につきまして、審査の結果「承認」となりました。`,
    '管理画面にログインのうえ、初期設定（プロフィール・支払い/振込設定・必要書類の最終アップロード等）を完了してください。',
    '',
    appPortalHint,
    '',
    `本件に関するお問い合わせ先: ${supportEmail}`
  ]
  const text = lines.join('\n')
  const html = lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '<br/>')).join('\n')
  return { subject, text, html }
}

export function buildDenialEmail(params: {
  type: ApplicantType
  applicantName?: string
  applicationId?: string
  supportEmail?: string
  reasonNote?: string
}): Email {
  const { type, applicantName = '', applicationId = '', supportEmail = 'support@example.com', reasonNote } = params
  const label = typeLabel(type)
  const subject = `[${label}] 審査結果のご連絡（ID: ${applicationId || '—'}）`
  const defaultNote =
    '誠に恐れ入りますが、審査の結果、現時点では登録要件を満たしていないと判断いたしました。再申請の可否や要件の詳細については個別の理由開示を行っておりません。'
  const lines = [
    `${applicantName} 様`,
    '',
    `${label} の登録申請につきまして、審査の結果「否認」となりました。`,
    reasonNote || defaultNote,
    '',
    `本件に関するお問い合わせ先: ${supportEmail}`
  ]
  const text = lines.join('\n')
  const html = lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '<br/>')).join('\n')
  return { subject, text, html }
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

