import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function buildCorsHeaders(origin: string | null) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
  const hdr: Record<string,string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
  }
  if (origin && allowed.includes(origin)) hdr['Access-Control-Allow-Origin'] = origin
  return hdr
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin')
    return new Response('ok', { headers: buildCorsHeaders(origin) })
  }

  try {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin')
    const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
    if (allowed.length === 0 || !origin || !allowed.includes(origin)) {
      return new Response('Forbidden origin', { status: 403, headers: buildCorsHeaders(origin) })
    }
    const filePath = url.pathname.replace('/download-proxy/', '')

    if (!filePath) {
      return new Response('File path required', { status: 400, headers: buildCorsHeaders(origin) })
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response('Authorization required', { status: 401, headers: buildCorsHeaders(origin) })
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    })

    // Create admin client for storage access
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Authentication failed', { status: 401, headers: buildCorsHeaders(origin) })
    }

    // Extract bucket and file path
    const pathParts = filePath.split('/')
    if (pathParts.length < 2) {
      return new Response('Invalid file path format', { status: 400, headers: buildCorsHeaders(origin) })
    }

    const bucket = pathParts[0]
    const fileName = pathParts.slice(1).join('/')

    // Authorization logic based on bucket and path
    let authorized = false

    if (bucket === 'photos-original') {
      // Only allow access to own files in photos-original
      const userIdFromPath = fileName.split('/')[1]
      authorized = userIdFromPath === user.id
    } else if (bucket === 'user-content') {
      // Allow access to specific prefixes in user-content
      authorized = fileName.startsWith('defaults/') ||
                   fileName.startsWith('samples/') ||
                   fileName.startsWith('avatars/') ||
                   fileName.startsWith(`users/${user.id}/`)
    } else if (bucket === 'photos-watermarked') {
      // Public access to watermarked photos
      authorized = true
    }

    if (!authorized) {
      return new Response('Access denied to this file', { status: 403, headers: buildCorsHeaders(origin) })
    }

    // Download file using admin client
    const { data, error } = await adminSupabase.storage
      .from(bucket)
      .download(fileName)

    if (error) {
      console.error('Storage download error:', error)
      return new Response(`File download failed: ${error.message}`, { status: 404, headers: buildCorsHeaders(origin) })
    }

    if (!data) {
      return new Response('File not found', { status: 404, headers: corsHeaders })
    }

    // Get file info for proper headers
    const { data: fileInfo } = await adminSupabase.storage
      .from(bucket)
      .list(fileName.split('/').slice(0, -1).join('/'), {
        search: fileName.split('/').pop()
      })

    const file = fileInfo?.find(f => f.name === fileName.split('/').pop())
    const contentType = file?.metadata?.mimetype || 'application/octet-stream'

    // Return file with appropriate headers
    const hdr = buildCorsHeaders(origin)
    hdr['Content-Type'] = contentType
    hdr['Content-Disposition'] = `attachment; filename="${fileName.split('/').pop()}"`
    hdr['Cache-Control'] = 'private, max-age=3600'
    return new Response(data, { headers: hdr })

  } catch (error) {
    console.error('Download proxy error:', error)
    const origin = req.headers.get('Origin')
    return new Response(`Internal server error: ${error.message}`, { status: 500, headers: buildCorsHeaders(origin) })
  }
})
