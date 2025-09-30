import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'
// @ts-ignore: deno npm compatibility
import Sharp from 'npm:sharp@0.32.6'

type Overlay = {
  mode?: 'text'|'image'
  text?: string
  image_path?: string
  position?: 'top-left'|'top-right'|'bottom-left'|'bottom-right'
  color?: string
  opacity?: number
  style?: 'script'|'sans'|'serif'
}

function compositeSvg(width: number, height: number, overlay: Overlay) {
  const pos = overlay.position || 'bottom-right'
  const margin = Math.round(Math.min(width, height) * 0.04)
  const fontSize = Math.round(Math.min(width, height) * 0.08)
  let x = margin, y = height - margin
  if (pos.includes('right')) x = width - margin
  if (pos.includes('top')) y = margin
  const anchor = pos.includes('right') ? 'end' : 'start'
  const color = overlay.color || '#ffffff'
  const opacity = overlay.opacity ?? 0.7
  const family = overlay.style === 'serif' ? 'Times New Roman' : overlay.style === 'script' ? 'Brush Script MT' : 'Arial'
  const text = overlay.text || 'Signed'
  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${fontSize}" fill="${color}" opacity="${opacity}" stroke="#000" stroke-width="${Math.max(1, Math.round(fontSize/20))}" paint-order="stroke">${text}</text>
  </svg>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as { original_path?: string; overlay?: Overlay }
    const originalPath = body?.original_path || ''
    const overlay = body?.overlay || { mode: 'text', text: 'SIGNED', position: 'bottom-right', opacity: 0.7 }
    if (!originalPath) return new Response(JSON.stringify({ error: 'original_path required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Ownership: ensure path belongs to caller: originals/{uid}/...
    const allowedPrefix = `originals/${user.id}/`
    if (!originalPath.startsWith(allowedPrefix)) {
      return new Response(JSON.stringify({ error: 'forbidden path' }), { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    // download original
    const { data: fileData, error: dlErr } = await supabase.storage.from('photos-original').download(originalPath)
    if (dlErr || !fileData) return new Response(JSON.stringify({ error: dlErr?.message || 'download failed' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    const arr = await fileData.arrayBuffer()

    // generate variant with overlay
    const base = Sharp(arr)
    const meta = await base.metadata()
    if (!meta.width || !meta.height) return new Response(JSON.stringify({ error: 'invalid image' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    let compositeBuffers: Buffer[] = []
    if (overlay.mode === 'image' && overlay.image_path) {
      // fetch overlay image from storage (public or same bucket)
      const { data: ov } = await supabase.storage.from('user-content').download(overlay.image_path)
      if (ov) compositeBuffers.push(Buffer.from(await ov.arrayBuffer()))
    } else {
      const svg = compositeSvg(meta.width, meta.height, overlay)
      compositeBuffers.push(Buffer.from(svg))
    }

    let img = base
    for (const buf of compositeBuffers) {
      img = img.composite([{ input: buf, gravity: overlay.position?.replace('-', '') as any || 'southeast' }])
    }
    const variantBuf = await img.webp({ quality: 95 }).toBuffer()
    const previewBuf = await Sharp(variantBuf).png().toBuffer()

    const time = Date.now()
    const variantOrigPath = `variants/${user.id}/${time}.webp`
    const variantPrevPath = `variants/${user.id}/${time}.png`

    const up1 = await supabase.storage.from('photos-original').upload(variantOrigPath, variantBuf, { contentType: 'image/webp', upsert: false })
    if (up1.error) return new Response(JSON.stringify({ error: up1.error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    const up2 = await supabase.storage.from('photos-watermarked').upload(variantPrevPath, previewBuf, { contentType: 'image/png', upsert: false })
    if (up2.error) return new Response(JSON.stringify({ error: up2.error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    return new Response(JSON.stringify({ ok: true, variant_original_path: up1.data?.path, variant_preview_path: up2.data?.path }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Unauthorized')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
