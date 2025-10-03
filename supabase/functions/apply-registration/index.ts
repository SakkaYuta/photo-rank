import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'
import { sendEmail } from '../_shared/email.ts'

type ApplicantType = 'manufacturing_partner' | 'organizer'

interface ApplyRequest {
  type: ApplicantType
  applicant_name?: string
  applicant_email?: string
  payload: Record<string, unknown>
}

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, ...(init || {}) })
}

function badRequest(message: string, code: string = 'bad_request') {
  return json({ success: false, error: { code, message } }, { status: 400 })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return badRequest('Method not allowed', 'method_not_allowed')

  let body: ApplyRequest
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const { type, applicant_email, applicant_name, payload } = body || {}
  if (!type || (type !== 'manufacturing_partner' && type !== 'organizer')) {
    return badRequest('Invalid type')
  }
  if (!payload || typeof payload !== 'object') {
    return badRequest('Missing payload')
  }

  const supabase = getSupabaseAdmin()

  // Optional: identify user from JWT if present (best-effort)
  let userId: string | null = null
  try {
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const url = Deno.env.get('SUPABASE_URL')!
      const anon = Deno.env.get('SUPABASE_ANON_KEY')!
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
      const client = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data } = await client.auth.getUser()
      userId = data.user?.id ?? null
    }
  } catch (_) {}

  // Insert application
  const { data: app, error } = await supabase
    .from('registration_applications')
    .insert({
      user_id: userId,
      type,
      applicant_name: applicant_name || (payload['company_name'] as string) || (payload['organization_name'] as string) || null,
      applicant_email: applicant_email || (payload['contact_email'] as string) || null,
      payload,
      status: 'pending'
    })
    .select('*')
    .single()

  if (error) {
    console.error('[apply-registration] insert error', error)
    return json({ success: false, error: { code: 'insert_failed', message: error.message } }, { status: 500 })
  }

  // Send acknowledgement email if env is configured
  try {
    const supportEmail = Deno.env.get('SUPPORT_EMAIL') || Deno.env.get('EMAIL_FROM')
    const to = (applicant_email || (payload['contact_email'] as string)) as string | undefined
    if (to) {
      const subject = `[${type === 'manufacturing_partner' ? '製造パートナー' : 'オーガナイザー'}] 申請を受け付けました（ID: ${app.id}）`
      const text = `${applicant_name || ''} 様\n\n申請を受け付けました。原則14日以内を目安に、登録可否をメールにてご連絡いたします。\n審査状況により前後する場合があります。\n\nお問い合わせ先: ${supportEmail || 'support@example.com'}`
      const html = text.split('\n').map((l) => (l ? `<p>${l}</p>` : '<br/>')).join('')
      await sendEmail({ to, subject, text, html })
    }
  } catch (e) {
    console.warn('[apply-registration] email skipped', e)
  }

  // Also enqueue to outbox for auditing / alternative mailer
  try {
    const to = (applicant_email || (payload['contact_email'] as string)) as string | undefined
    if (to) {
      await supabase.from('email_outbox').insert({
        to_email: to,
        subject: `[受付] 登録申請（ID: ${app.id}）`,
        body_text: `申請を受け付けました。審査結果は14日以内にご連絡します。`,
        status: 'queued'
      })
    }
  } catch (e) {
    console.warn('[apply-registration] outbox skipped', e)
  }

  return json({ success: true, id: app.id })
})

