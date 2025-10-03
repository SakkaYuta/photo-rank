export const NAV_EVENT = 'navigate'

export type NavParams = Record<string, string | number | boolean>

export function viewToHash(view: string, params?: NavParams): string {
  if (!params || Object.keys(params).length === 0) return view
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
  return `${view}?${qs.toString()}`
}

export function parseHash(): { view: string; params: Record<string, string> } {
  try {
    const raw = window.location.hash.replace(/^#/, '')
    const [view, query] = raw.split('?')
    const params: Record<string, string> = {}
    if (query) {
      const sp = new URLSearchParams(query)
      sp.forEach((v, k) => (params[k] = v))
    }
    return { view: view || '', params }
  } catch {
    return { view: '', params: {} }
  }
}

export function navigate(view: string, params?: NavParams) {
  try {
    const hash = viewToHash(view, params)
    // ページをリロードして状態をリセット
    window.location.href = `/#${hash}`
  } catch {
    // フォールバック: ハッシュのみ変更
    try {
      window.location.hash = viewToHash(view, params)
    } catch {}
  }
  try {
    window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { view, ...(params || {}) } }))
  } catch {}
}

