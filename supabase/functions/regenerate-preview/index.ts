import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
// @ts-ignore: deno npm compatibility
import Sharp from 'npm:sharp@0.32.6'

const ORIGINAL_BUCKET = 'photos-original'
const PREVIEW_BUCKET = 'photos-watermarked'

async function addWatermark(buffer: ArrayBuffer) {
  const image = Sharp(buffer)
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error('invalid image')
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
  const out = await image.composite([{ input: Buffer.from(svg), blend: 'over' }]).png().toBuffer()
  return out
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const { original_path, work_id } = await req.json().catch(() => ({})) as { original_path?: string; work_id?: string }
    if (!original_path || typeof original_path !== 'string') {
      return new Response(JSON.stringify({ error: 'original_path is required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    // Ensure caller owns the original
    const allowedPrefix = `originals/${user.id}/`
    if (!original_path.startsWith(allowedPrefix)) {
      return new Response(JSON.stringify({ error: 'Forbidden path' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // Download private original
    const { data: fileData, error: dlErr } = await supabase.storage.from(ORIGINAL_BUCKET).download(original_path)
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: dlErr?.message || 'download failed' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const arrayBuf = await fileData.arrayBuffer()

    // Regenerate watermarked preview
    const watermarked = await addWatermark(arrayBuf)
    const base = original_path.split('/').pop()?.replace(/\.[a-zA-Z0-9]+$/, '') || `${Date.now()}`
    const prevPath = `watermarked/${user.id}/${base}_${Date.now()}.png`
    const { data: stored, error: upErr } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .upload(prevPath, watermarked, { contentType: 'image/png', upsert: false })
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Optionally update works.image_url if work_id provided and owned by user
    if (work_id) {
      const { data: w, error: wErr } = await supabase
        .from('works')
        .select('id, creator_id')
        .eq('id', work_id)
        .single()
      if (!wErr && w?.creator_id === user.id) {
        // public URL helper (we don't have supabaseUrl here; use storage public path reference only)
        // Let client compute public URL; alternatively store storage path in metadata
        await supabase
          .from('works')
          .update({
            // keep image_url unchanged to avoid cache inconsistencies; metadata can track paths
            metadata: {
              preview_regenerated_at: new Date().toISOString(),
              last_preview_path: stored.path,
            } as any
          })
          .eq('id', work_id)
      }
    }

    return new Response(JSON.stringify({ ok: true, preview: { bucket: PREVIEW_BUCKET, path: stored.path } }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (e: any) {
    const msg = e?.message || 'internal error'
    const code = /auth|forbid|unauth/i.test(msg) ? 401 : 500
    return new Response(JSON.stringify({ error: msg }), { status: code, headers: { 'content-type': 'application/json' } })
  }
})

