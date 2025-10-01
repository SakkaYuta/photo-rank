// Centralized demo mode gating utility
// Ensures demo/sample features are only available on allowed hosts.

const getEnv = () => (import.meta as any).env || {}

const parseList = (value: string | undefined): string[] => {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const getAllowedDemoHosts = (): string[] => {
  const env = getEnv()
  const fromEnv = parseList(env.VITE_DEMO_ALLOWED_HOSTS)
  // Default to localhost only when not configured
  return fromEnv.length > 0 ? fromEnv : ['localhost', '127.0.0.1', '::1']
}

export const isHostAllowedForDemo = (): boolean => {
  try {
    if (typeof window === 'undefined') return false
    const host = window.location.hostname
    const allowed = getAllowedDemoHosts()
    return allowed.includes(host)
  } catch {
    return false
  }
}

export const isDemoAllowed = (): boolean => {
  // Host must be allowed regardless of any other toggle.
  return isHostAllowedForDemo()
}

export const isDemoEnabled = (): boolean => {
  const env = getEnv()
  // Demo is enabled only if:
  // - Host is explicitly allowed, and
  // - Global demo flag is true
  return isDemoAllowed() && env.VITE_ENABLE_SAMPLE === 'true'
}

export const isBattleDemoEnabled = (): boolean => {
  const env = getEnv()
  return isDemoAllowed() && env.VITE_ENABLE_BATTLE_SAMPLE === 'true'
}

