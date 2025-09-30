import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflightResponse } from '../_shared/cors.ts'

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

function randomBase32(length = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => alphabet[b % alphabet.length]).join('')
}

async function getCryptoKey(): Promise<CryptoKey> {
  const key = Deno.env.get('MFA_ENC_KEY') || ''
  if (!key) throw new Error('MFA_ENC_KEY not set')
  const enc = new TextEncoder().encode(key.padEnd(32, '0')).slice(0, 32)
  return crypto.subtle.importKey('raw', enc, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptSecret(secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getCryptoKey()
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))
  const payload = new Uint8Array(iv.length + ct.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(ct), iv.length)
  return btoa(String.fromCharCode(...payload))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  try {
    const auth = req.headers.get('authorization') || ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const token = auth.substring(7)

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const admin = createClient(url, svc, { auth: { persistSession: false } })

    const { data: u } = await userClient.auth.getUser()
    const user = u?.user
    if (!user) return json({ error: 'Unauthorized' }, 401)

    if (req.method === 'GET') {
      // status
      const { data, error } = await admin.from('user_mfa').select('enabled').eq('user_id', user.id).maybeSingle()
      if (error) return json({ error: error.message }, 400)
      return json({ enabled: data?.enabled || false })
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as any
      const action = body?.action as 'provision' | 'enable' | 'disable'
      if (!action) return json({ error: 'action required' }, 400)

      if (action === 'provision') {
        const secret = randomBase32(20)
        const enc = await encryptSecret(secret)
        // upsert encrypted secret
        const { error } = await admin.from('user_mfa').upsert({ user_id: user.id, secret_enc: enc, enabled: false }, { onConflict: 'user_id' })
        if (error) return json({ error: error.message }, 400)
        const otpauth = `otpauth://totp/PhotoRank:${user.email}?secret=${secret}&issuer=PhotoRank`
        return json({ enabled: false, otpauth })
      }
      if (action === 'enable') {
        const { error } = await admin.from('user_mfa').update({ enabled: true }).eq('user_id', user.id)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }
      if (action === 'disable') {
        const { error } = await admin.from('user_mfa').update({ enabled: false }).eq('user_id', user.id)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }
    }

    return json({ error: 'Method Not Allowed' }, 405)
  } catch (e: any) {
    return json({ error: e?.message || 'internal error' }, 500)
  }
})
