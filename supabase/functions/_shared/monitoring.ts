const SENTRY_DSN = Deno.env.get('SENTRY_DSN')
const ENVIRONMENT = Deno.env.get('ENVIRONMENT') || 'development'

type SentryEvent = {
  level: 'error' | 'warning' | 'info'
  message: string
  exception?: { type: string; value: string; stacktrace?: string }
  extra?: Record<string, any>
  tags?: Record<string, string>
  timestamp: number
  environment: string
}

export async function sendToSentry(error: Error, context?: Record<string, any>) {
  if (!SENTRY_DSN || ENVIRONMENT === 'development') {
    console.error('Sentry (not sent):', error, context)
    return
  }
  const event: SentryEvent = {
    level: 'error',
    message: error.message,
    exception: { type: error.name, value: error.message, stacktrace: error.stack },
    extra: context,
    tags: { function: context?.function || 'unknown', environment: ENVIRONMENT },
    timestamp: Date.now() / 1000,
    environment: ENVIRONMENT,
  }
  try {
    await fetch(SENTRY_DSN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': 'Sentry sentry_version=7' },
      body: JSON.stringify(event),
    })
  } catch (e) {
    console.error('Sentry send error:', e)
  }
}

export async function logWebhookError(error: Error, meta?: { eventType?: string; eventId?: string; payload?: unknown }) {
  await sendToSentry(error, {
    function: 'stripe-webhook',
    webhook_event_type: meta?.eventType,
    webhook_event_id: meta?.eventId,
    payload_sample: meta?.payload ? JSON.stringify(meta.payload).slice(0, 1000) : undefined,
  })
}

