import { supabase } from './supabaseClient'

export type UserMfa = {
  user_id: string
  secret: string
  enabled: boolean
  updated_at?: string
}

function randomBase32(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let out = ''
  const arr = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i=0;i<length;i++) arr[i] = Math.floor(Math.random()*256)
  }
  for (let i=0;i<length;i++) out += alphabet[arr[i] % alphabet.length]
  return out
}

export const MfaService = {
  async get(): Promise<{ enabled: boolean } | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mfa`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}` }
    })
    if (!res.ok) return { enabled: false }
    const body = await res.json()
    return { enabled: !!body.enabled }
  },

  async provision() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mfa`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'provision' })
    })
    if (!res.ok) throw new Error('Provisioning failed')
    const body = await res.json()
    return { enabled: false, otpauth: body.otpauth as string }
  },

  async enable() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mfa`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'enable' })
    })
    if (!res.ok) throw new Error('Enable failed')
  },

  async disable() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mfa`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'disable' })
    })
    if (!res.ok) throw new Error('Disable failed')
  }
}
