import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  const environment = (import.meta.env.VITE_ENVIRONMENT as string | undefined) || 'development'
  if (!dsn || environment === 'development') return

  Sentry.init({
    dsn,
    environment,
    integrations: [],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  })
}

export function logError(err: unknown, context?: Record<string, any>) {
  const error = err instanceof Error ? err : new Error(String(err))
  // eslint-disable-next-line no-console
  console.error(error)
  try {
    Sentry.captureException(error, { extra: context })
  } catch {}
}

