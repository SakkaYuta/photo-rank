import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async (req) => {
  const authHeader = req.headers.get('authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_locks')
    if (error) {
      console.error('Cleanup failed:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    console.log(`Released ${data} expired locks`)
    return new Response(JSON.stringify({ released: data }), { status: 200 })
  } catch (e) {
    console.error('Unexpected error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
})

