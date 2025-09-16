import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
// @ts-ignore: deno npm compatibility
import Sharp from 'npm:sharp@0.32.6'

async function addWatermarkToImage(imageBuffer: ArrayBuffer, opts: { text: string; opacity: number; position: string }) {
  const image = Sharp(imageBuffer)
  const { width, height } = await image.metadata()
  
  if (!width || !height) {
    throw new Error('Unable to read image dimensions')
  }
  // Dimension guard (prevent resource exhaustion)
  if (width > 8000 || height > 8000) {
    throw new Error('Image dimensions too large (max 8000x8000)')
  }

  // Create watermark SVG
  const fontSize = Math.min(width, height) / 8
  const watermarkSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" patternUnits="userSpaceOnUse" width="${width/2}" height="${height/2}">
          <text x="50%" y="50%" 
                text-anchor="middle" 
                dominant-baseline="middle"
                font-family="Arial, sans-serif" 
                font-size="${fontSize}" 
                font-weight="bold"
                fill="rgba(255,255,255,${opts.opacity})" 
                transform="rotate(45 ${width/4} ${height/4})">
            ${opts.text}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)" opacity="${opts.opacity}"/>
    </svg>`

  // Apply watermark
  const watermarkedBuffer = await image
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        blend: 'over'
      }
    ])
    .png()
    .toBuffer()

  return watermarkedBuffer
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    // Authenticate user
    const user = await authenticateUser(req)
    
    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const watermarkTextRaw = (formData.get('text') as string) ?? 'SAMPLE'
    
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'image is required' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    // Validate image type and size
    if (!imageFile.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'File must be an image' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }
    // Reject oversized uploads (e.g., > 10MB)
    if (typeof imageFile.size === 'number' && imageFile.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), { status: 413, headers: { 'content-type': 'application/json' } })
    }

    // MIME allowlist + simple magic number check
    const ALLOWED_MIMES = ['image/jpeg','image/png','image/webp']
    if (!ALLOWED_MIMES.includes(imageFile.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const head = new Uint8Array(await imageFile.slice(0, 4).arrayBuffer())
    const isJpeg = head[0] === 0xFF && head[1] === 0xD8
    const isPng  = head[0] === 0x89 && head[1] === 0x50
    const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
    if (!(isJpeg || isPng || isWebp)) {
      return new Response(JSON.stringify({ error: 'Invalid file signature' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    const imageBuffer = await imageFile.arrayBuffer()
    // Basic XML escape for SVG text injection safety (correct mapping)
    const xmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    }
    const watermarkText = watermarkTextRaw.replace(/[&<>"']/g, (c) => xmlEscapeMap[c])
    const watermarkedImage = await addWatermarkToImage(imageBuffer, {
      text: watermarkText,
      opacity: 0.4,
      position: 'center'
    })

    const supabase = getSupabaseAdmin()

    // Rate limit (50 per hour)
    const { data: canProceed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'add_watermark',
      p_limit: 50,
      p_window_minutes: 60
    })
    if (canProceed === false) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } })
    }

    const fileName = `watermarked/${user.id}/${Date.now()}.png`
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, watermarkedImage, { 
        contentType: 'image/png', 
        upsert: false 
      })
    
    if (error) throw error

    return new Response(JSON.stringify({ 
      url: data.path, 
      success: true,
      user_id: user.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('add-watermark error:', err)
    if (err.message?.includes('Missing or invalid Authorization') || err.message?.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'content-type': 'application/json' } 
      })
    }
    return new Response(JSON.stringify({ error: err?.message ?? 'unknown error' }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
})

