import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

function isValidHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !!u.hostname
  } catch {
    return false
  }
}

function extractProvider(url: string): string | null {
  try {
    const u = new URL(url)
    return u.hostname?.toLowerCase() || null
  } catch {
    return null
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => null) as { url?: string; title?: string; author?: string } | null
    if (!body || !body.url) {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const url = body.url.trim()
    if (!isValidHttpsUrl(url) || url.length > 2048) {
      return new Response(JSON.stringify({ error: 'invalid url' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Rate limit
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action: 'ingest_online_asset',
        p_limit: 30,
        p_window_minutes: 60
      })
      if (canProceed === false) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } })
      }
    } catch (_) {
      // allow if rate limit RPC missing
    }

    const provider = extractProvider(url)
    const content_hash = await sha256Hex(url)

    // Basic policy decision via asset_policies (pattern match by hostname)
    let policy: 'allow'|'deny'|'manual' = 'manual'
    try {
      if (provider) {
        const { data: pol } = await supabase
          .from('asset_policies')
          .select('rule')
          .eq('pattern', provider)
          .single()
        if (pol?.rule === 'allow' || pol?.rule === 'deny' || pol?.rule === 'manual') {
          policy = pol.rule
        }
      }
    } catch (_) {}

    const status = policy === 'allow' ? 'approved' : policy === 'deny' ? 'rejected' : 'pending'

    const { data, error } = await supabase
      .from('online_assets')
      .upsert({
        owner_user_id: user.id,
        source_url: url,
        provider: provider ?? undefined,
        title: body.title ?? null,
        author: body.author ?? null,
        content_hash,
        policy,
        status
      }, { onConflict: 'content_hash' })
      .select('id, status, policy, provider, title, author')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      asset_id: data.id,
      status: data.status,
      policy: data.policy,
      provider: data.provider,
      metadata: { title: data.title, author: data.author }
    }), { headers: { 'content-type': 'application/json' } })

  } catch (e: any) {
    if (e?.message?.includes('Authorization')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

