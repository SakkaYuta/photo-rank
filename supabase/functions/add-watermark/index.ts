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
    const watermarkText = formData.get('text') as string ?? 'SAMPLE'
    
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'image is required' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    // Validate image type
    if (!imageFile.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'File must be an image' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    const imageBuffer = await imageFile.arrayBuffer()
    const watermarkedImage = await addWatermarkToImage(imageBuffer, {
      text: watermarkText,
      opacity: 0.4,
      position: 'center'
    })

    const supabase = getSupabaseAdmin()

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

