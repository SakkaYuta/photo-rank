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
  async get(): Promise<{ enabled: boolean; secret?: string; otpauth?: string } | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('user_mfa')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data) return { enabled: false }
    return { enabled: data.enabled, secret: data.secret, otpauth: `otpauth://totp/PhotoRank:${user.email}?secret=${data.secret}&issuer=PhotoRank` }
  },

  async provision() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const secret = randomBase32(20)
    const payload = { user_id: user.id, secret, enabled: false }
    const { data, error } = await supabase
      .from('user_mfa')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw error
    return { enabled: data.enabled, secret: data.secret, otpauth: `otpauth://totp/PhotoRank:${user.email}?secret=${data.secret}&issuer=PhotoRank` }
  },

  async enable() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase
      .from('user_mfa')
      .update({ enabled: true })
      .eq('user_id', user.id)
    if (error) throw error
  },

  async disable() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase
      .from('user_mfa')
      .update({ enabled: false })
      .eq('user_id', user.id)
    if (error) throw error
  }
}

