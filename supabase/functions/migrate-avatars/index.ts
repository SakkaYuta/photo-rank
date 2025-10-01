import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { requireInternalSecret } from '../_shared/auth.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

type UserRow = { id: string; avatar_url: string | null }

function extractUserContentPath(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url)
    // Expected: /storage/v1/object/public/<bucket>/<path>
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (!m) return null
    const bucket = m[1]
    const path = decodeURIComponent(m[2])
    return { bucket, path }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  // Internal secret required (must be configured and provided)
  const requiredSecret = Deno.env.get('INTERNAL_CRON_SECRET') || ''
  if (!requiredSecret) {
    return new Response(JSON.stringify({ error: 'internal secret not configured' }), { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
  const secretError = requireInternalSecret(req)
  if (secretError) return secretError

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    // optional cleanup flag in body
    let cleanup = false
    try {
      const body = await req.json()
      cleanup = Boolean(body?.cleanup)
    } catch {}

    // fetch users with avatar_url pointing to user-content bucket
    const { data: users, error: qErr } = await supabase
      .from('users')
      .select('id, avatar_url')
      .not('avatar_url', 'is', null)
      .ilike('avatar_url', '%/storage/v1/object/public/user-content/%')
      .limit(20000)
    if (qErr) throw qErr

    const rows = (users || []) as UserRow[]
    let migrated = 0
    let skipped = 0
    const errors: Array<{ id: string; reason: string }> = []

    for (const row of rows) {
      const url = row.avatar_url!
      const parsed = extractUserContentPath(url)
      if (!parsed || parsed.bucket !== 'user-content' || !parsed.path.startsWith('avatars/')) {
        skipped++
        continue
      }
      const srcPath = parsed.path
      const dstPath = parsed.path // keep same relative path under public-assets

      try {
        // Download from user-content
        const dl = await supabase.storage.from('user-content').download(srcPath)
        if (dl.error) throw dl.error
        const blob = dl.data
        if (!blob) throw new Error('download returned empty data')

        // Upload to public-assets (upsert true so it can be re-run safely)
        const up = await supabase.storage.from('public-assets').upload(dstPath, blob, { upsert: true, contentType: blob.type || undefined })
        if (up.error) throw up.error

        // Get new public URL
        const pub = supabase.storage.from('public-assets').getPublicUrl(dstPath)
        const newUrl = pub.data.publicUrl
        if (!newUrl) throw new Error('failed to get public url')

        // Update users.avatar_url
        const upd = await supabase
          .from('users')
          .update({ avatar_url: newUrl })
          .eq('id', row.id)
        if (upd.error) throw upd.error

        migrated++

        // Optionally delete original object after successful migration
        if (cleanup) {
          const del = await supabase.storage.from('user-content').remove([srcPath])
          if (del.error) {
            errors.push({ id: row.id, reason: `cleanup_failed: ${del.error.message}` })
          }
        }
      } catch (e: any) {
        errors.push({ id: row.id, reason: e?.message || String(e) })
      }
    }

    return new Response(JSON.stringify({ total: rows.length, migrated, skipped, errorsCount: errors.length, errors }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
