export type EmailPayload = {
  to: string
  subject: string
  html?: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailPayload) {
  const apiKey = Deno.env.get('SENDGRID_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') || Deno.env.get('SENDGRID_SENDER')
  const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Photo-Rank'

  if (!apiKey || !from) {
    console.log('[email] Missing SENDGRID_API_KEY or EMAIL_FROM, skip sending')
    return { skipped: true }
  }

  const payload = {
    personalizations: [ { to: [ { email: to } ] } ],
    from: { email: from, name: fromName },
    subject,
    content: [
      text ? { type: 'text/plain', value: text } : undefined,
      html ? { type: 'text/html', value: html } : undefined,
    ].filter(Boolean)
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[email] sendgrid error', res.status, body)
    return { ok: false, status: res.status, body }
  }
  return { ok: true }
}

