import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
// @ts-ignore: deno npm compatibility
import Sharp from 'npm:sharp@0.32.6'

async function watermark(buffer: ArrayBuffer, text: string, opacity = 0.35) {
  const image = Sharp(buffer)
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error('invalid image')
  if (width > 8000 || height > 8000) throw new Error('image too large')

  const fontSize = Math.min(width, height) / 8
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" patternUnits="userSpaceOnUse" width="${width/2}" height="${height/2}">
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="${fontSize}" fill="rgba(255,255,255,${opacity})" transform="rotate(45 ${width/4} ${height/4})">SAMPLE</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" opacity="${opacity}" />
    </svg>`

  const out = await image
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer()
  return out
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => ({})) as { asset_id?: string; watermark?: boolean }
    const assetId = body.asset_id
    if (!assetId) {
      return new Response(JSON.stringify({ error: 'asset_id is required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Load asset and verify ownership + policy
    const { data: asset, error: assetErr } = await supabase
      .from('online_assets')
      .select('id, owner_user_id, source_url, provider, policy, status')
      .eq('id', assetId)
      .single()
    if (assetErr) {
      return new Response(JSON.stringify({ error: assetErr.message }), { status: 404, headers: { 'content-type': 'application/json' } })
    }
    if (asset.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // Basic SSRF hardening
    // 1) Require an approved policy for the provider
    if (asset.policy !== 'allow' && asset.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Asset not approved for fetching' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // 2) Parse URL and reject private/loopback/link-local IP literals and non-HTTPS
    let u: URL
    try {
      u = new URL(asset.source_url)
    } catch {
      return new Response(JSON.stringify({ error: 'invalid source_url' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (u.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only https sources are allowed' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const hostname = u.hostname || ''
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
    const isIpv6 = hostname.includes(':')
    const isPrivateV4 = isIpv4 && (
      hostname.startsWith('10.') ||
      hostname.startsWith('127.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('192.168.') ||
      (() => {
        // 172.16.0.0 – 172.31.255.255
        const octets = hostname.split('.').map((n) => parseInt(n, 10))
        return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31
      })()
    )
    const isPrivateV6 = isIpv6 && (
      hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd')
    )
    const isLocalHost = hostname === 'localhost'
    if (isPrivateV4 || isPrivateV6 || isLocalHost) {
      return new Response(JSON.stringify({ error: 'Private or loopback hosts are not allowed' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // 3) Optional: verify provider is explicitly allow-listed in asset_policies
    try {
      const provider = (asset.provider || hostname).toLowerCase()
      const { data: pol } = await supabase
        .from('asset_policies')
        .select('rule')
        .eq('pattern', provider)
        .single()
      if (pol?.rule !== 'allow') {
        return new Response(JSON.stringify({ error: 'Provider is not allow-listed' }), { status: 403, headers: { 'content-type': 'application/json' } })
      }
    } catch (_) {
      // If policy table missing, fail closed
      return new Response(JSON.stringify({ error: 'Policy verification failed' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // Fetch original image from source_url (best-effort)
    const resp = await fetch(asset.source_url, { redirect: 'follow' })
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `failed to fetch source (${resp.status})` }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const contentType = resp.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'source is not an image' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const arrayBuf = await resp.arrayBuffer()

    // Apply watermark
    const outBuf = await watermark(arrayBuf, 'SAMPLE', 0.35)

    // Store to watermarked bucket
    const path = `watermarked/${user.id}/${assetId}_${Date.now()}.png`
    const { data: stored, error: upErr } = await supabase.storage
      .from('photos-watermarked')
      .upload(path, outBuf, { contentType: 'image/png', upsert: false })
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // update asset.preview_path
    await supabase
      .from('online_assets')
      .update({ preview_path: stored.path })
      .eq('id', assetId)

    return new Response(JSON.stringify({ preview_url: stored.path, bucket: 'photos-watermarked' }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
