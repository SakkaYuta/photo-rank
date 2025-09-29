import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
// @ts-ignore: deno npm compatibility
import Sharp from 'npm:sharp@0.32.6'

const ORIGINAL_BUCKET = 'photos-original'
const PREVIEW_BUCKET = 'photos-watermarked'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_DIMENSION = 8000 // pixels
const RATE_LIMIT_PER_MINUTE = 10 // max uploads per user per minute

async function validateImageInput(buffer: ArrayBuffer, originalMimeType?: string) {
  // Size validation
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(`File too large: ${Math.round(buffer.byteLength / 1024 / 1024)}MB exceeds ${MAX_BYTES / 1024 / 1024}MB limit`)
  }

  // Basic buffer validation
  if (buffer.byteLength < 100) {
    throw new Error('File too small, likely corrupted')
  }

  // Image format validation via Sharp
  const image = Sharp(buffer)
  let meta
  try {
    meta = await image.metadata()
  } catch (e) {
    throw new Error('Invalid image file, cannot read metadata')
  }

  // MIME type validation - check both original and detected
  if (!meta.format || !ALLOWED_MIME.has(`image/${meta.format}`)) {
    throw new Error(`Unsupported image format: ${meta.format}`)
  }

  // Cross-check original MIME if provided
  if (originalMimeType && !ALLOWED_MIME.has(originalMimeType)) {
    throw new Error(`Original MIME type not allowed: ${originalMimeType}`)
  }

  if (!meta.width || !meta.height) {
    throw new Error('Invalid image: unable to determine dimensions')
  }

  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new Error(`Image dimensions too large: ${meta.width}x${meta.height} exceeds ${MAX_DIMENSION}px limit`)
  }

  // Minimum dimension check (avoid 1px tracker images)
  if (meta.width < 32 || meta.height < 32) {
    throw new Error('Image dimensions too small: minimum 32x32 pixels required')
  }

  // Additional security checks
  if (meta.density && meta.density > 600) {
    throw new Error('Image density too high, potential security risk')
  }

  // Check for suspicious metadata
  if (meta.pages && meta.pages > 1) {
    throw new Error('Multi-page images not supported')
  }

  // Memory bomb protection
  const pixelCount = meta.width * meta.height
  if (pixelCount > 100000000) { // 100MP limit
    throw new Error('Image too large: exceeds pixel count limit')
  }

  return { width: meta.width, height: meta.height, format: meta.format }
}

async function processImage(buffer: ArrayBuffer) {
  await validateImageInput(buffer)
  const image = Sharp(buffer)

  // Strip all metadata including EXIF, ICC profiles, etc. & re-encode to WEBP
  const sanitized = await image
    .rotate() // Auto-rotate based on EXIF
    .withMetadata({ exif: undefined, icc: undefined }) // Remove metadata
    .webp({ quality: 90, effort: 6 }) // High quality WebP
    .toBuffer()

  return sanitized
}

async function checkRateLimit(supabase: any, userId: string) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  // Check recent upload attempts (you may need to create an upload_attempts table)
  const { data, error } = await supabase
    .from('upload_attempts')
    .select('count')
    .eq('user_id', userId)
    .gte('created_at', oneMinuteAgo)

  if (error) {
    console.warn('Rate limit check failed:', error.message)
    return false // Allow on error to avoid blocking legitimate users
  }

  const recentAttempts = data?.length || 0
  if (recentAttempts >= RATE_LIMIT_PER_MINUTE) {
    throw new Error(`Rate limit exceeded: maximum ${RATE_LIMIT_PER_MINUTE} uploads per minute`)
  }

  // Log this attempt
  await supabase
    .from('upload_attempts')
    .insert({ user_id: userId, created_at: new Date().toISOString() })

  return true
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

    // Rate limiting check
    await checkRateLimit(supabase, user.id)

    const { path, bucket } = await req.json().catch(() => ({})) as { path?: string; bucket?: string }
    if (!path || typeof path !== 'string') {
      return new Response(JSON.stringify({ error: 'path is required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Validate path format to prevent directory traversal
    if (path.includes('..') || path.includes('\\') || !/^[a-zA-Z0-9/_.-]+$/.test(path)) {
      return new Response(JSON.stringify({ error: 'Invalid path format' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Read from user-content bucket (temporary upload) with optional param (whitelisted)
    const allowedBuckets = new Set(['user-content'])
    const tmpBucket = (bucket && allowedBuckets.has(bucket)) ? bucket : 'user-content'
    const allowedPrefix = `uploads/works/${user.id}/`
    if (!path.startsWith(allowedPrefix)) {
      return new Response(JSON.stringify({ error: 'Forbidden path' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // Download file
    const { data: fileData, error: dlErr } = await supabase.storage.from(tmpBucket).download(path)
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: dlErr?.message || 'download failed' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Comprehensive validation and processing
    const arr = await fileData.arrayBuffer()

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

    // Generate signed URLs for both original and preview (admin bypass RLS)
    const { data: origSignedUrl } = await supabase.storage
      .from(ORIGINAL_BUCKET)
      .createSignedUrl(origStored?.path || '', 3600) // 1 hour expiry

    const { data: prevSignedUrl } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(prevStored?.path || '', 3600) // 1 hour expiry

    // Optionally: delete temp upload
    await supabase.storage.from(tmpBucket).remove([path])

    return new Response(
      JSON.stringify({
        ok: true,
        original: {
          bucket: ORIGINAL_BUCKET,
          path: origStored?.path,
          signedUrl: origSignedUrl?.signedUrl
        },
        preview: {
          bucket: PREVIEW_BUCKET,
          path: prevStored?.path,
          signedUrl: prevSignedUrl?.signedUrl
        }
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  } catch (e: any) {
    // Generate error ID for tracking
    const errorId = crypto.randomUUID()

    // Log full error for monitoring with error ID
    console.error(`[${errorId}] Image processing error:`, {
      message: e?.message,
      stack: e?.stack,
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent'),
      origin: req.headers.get('origin')
    })

    const msg = e?.message || 'internal error'
    let sanitizedMsg = msg
    let code = 500

    // Categorize errors for appropriate response
    if (/auth|forbid|unauth/i.test(msg)) {
      code = 401
      sanitizedMsg = '認証が必要です'
    } else if (/rate limit|too many/i.test(msg)) {
      code = 429
      sanitizedMsg = 'アップロード頻度制限に達しました。しばらく時間を置いてから再試行してください。'
    } else if (/file too large|too small|corrupted/i.test(msg)) {
      code = 400
      sanitizedMsg = 'ファイルサイズが無効です。10MB以下で100バイト以上のファイルを選択してください。'
    } else if (/unsupported.*format|invalid.*format|mime/i.test(msg)) {
      code = 400
      sanitizedMsg = 'サポートされていない画像形式です。JPEG、PNG、WebP形式を使用してください。'
    } else if (/dimensions|pixel|too small.*required/i.test(msg)) {
      code = 400
      sanitizedMsg = '画像サイズが無効です。32x32ピクセル以上、8000x8000ピクセル以下の画像を使用してください。'
    } else if (/invalid.*image|cannot.*read|metadata/i.test(msg)) {
      code = 400
      sanitizedMsg = '画像ファイルが破損しているか無効です。別のファイルを選択してください。'
    } else if (/multi-page|pages/i.test(msg)) {
      code = 400
      sanitizedMsg = '複数ページの画像はサポートされていません。'
    } else {
      // Internal errors - don't leak implementation details
      code = 500
      sanitizedMsg = '画像処理中にエラーが発生しました。時間を置いて再試行してください。'
    }

    return new Response(
      JSON.stringify({
        error: sanitizedMsg,
        errorId: errorId // Include error ID for support purposes
      }),
      { status: code, headers: { 'content-type': 'application/json' } }
    )
  }
})
