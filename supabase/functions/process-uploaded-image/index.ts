import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
// @ts-ignore: deno npm compatibility
import Sharp from 'npm:sharp@0.32.6'

const ORIGINAL_BUCKET = 'photos-original'
const PREVIEW_BUCKET = 'photos-watermarked'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function processImage(buffer: ArrayBuffer) {
  const image = Sharp(buffer)
  const meta = await image.metadata()
  if (!meta.width || !meta.height) throw new Error('invalid image')
  if (meta.width > 8000 || meta.height > 8000) throw new Error('image too large')
  // Strip metadata & re-encode to WEBP (lossless-ish quality setting)
  const sanitized = await image.rotate().withMetadata({ exif: undefined }).webp({ quality: 90 }).toBuffer()
  return sanitized
}

async function addWatermark(buffer: Buffer) {
  const base = Sharp(buffer)
  const meta = await base.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const fontSize = Math.min(width, height) / 8
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" patternUnits="userSpaceOnUse" width="${width/2}" height="${height/2}">
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="${fontSize}" fill="rgba(255,255,255,0.35)" transform="rotate(45 ${width/4} ${height/4})">SAMPLE</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" opacity="0.35" />
    </svg>`
  const out = await base.composite([{ input: Buffer.from(svg), blend: 'over' }]).png().toBuffer()
  return out
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const { path } = await req.json().catch(() => ({})) as { path?: string }
    if (!path || typeof path !== 'string') {
      return new Response(JSON.stringify({ error: 'path is required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    // Read from user-content bucket (temporary upload)
    const tmpBucket = 'user-content'
    const allowedPrefix = `uploads/works/${user.id}/`
    if (!path.startsWith(allowedPrefix)) {
      return new Response(JSON.stringify({ error: 'Forbidden path' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // Download file
    const { data: fileData, error: dlErr } = await supabase.storage.from(tmpBucket).download(path)
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: dlErr?.message || 'download failed' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    // Validate size (client-side checked earlier, but enforce again)
    const arr = await fileData.arrayBuffer()
    if (arr.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'file too large' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Process -> webp, strip EXIF
    const sanitized = await processImage(arr)
    const fileBase = `${Date.now()}`
    const origPath = `originals/${user.id}/${fileBase}.webp`

    // Store original (sanitized) in private bucket
    const { data: origStored, error: upOrigErr } = await supabase.storage
      .from(ORIGINAL_BUCKET)
      .upload(origPath, sanitized, { contentType: 'image/webp', upsert: false })
    if (upOrigErr) {
      return new Response(JSON.stringify({ error: upOrigErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Generate watermarked preview
    const watermarked = await addWatermark(Buffer.from(sanitized))
    const prevPath = `watermarked/${user.id}/${fileBase}.png`
    const { data: prevStored, error: upPrevErr } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .upload(prevPath, watermarked, { contentType: 'image/png', upsert: false })
    if (upPrevErr) {
      return new Response(JSON.stringify({ error: upPrevErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Optionally: delete temp upload
    await supabase.storage.from(tmpBucket).remove([path])

    return new Response(
      JSON.stringify({
        ok: true,
        original: { bucket: ORIGINAL_BUCKET, path: origStored?.path },
        preview: { bucket: PREVIEW_BUCKET, path: prevStored?.path }
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  } catch (e: any) {
    const msg = e?.message || 'internal error'
    const code = /auth|forbid|unauth/i.test(msg) ? 401 : 500
    return new Response(JSON.stringify({ error: msg }), { status: code, headers: { 'content-type': 'application/json' } })
  }
})

