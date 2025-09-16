// Skeleton for Supabase Edge Function: acquire-work-lock
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  
  try {
    // Authenticate user from request headers
    const user = await authenticateUser(req)
    
    const { workId } = await req.json()
    if (!workId) return new Response('Bad Request: workId is required', { status: 400 })
    
    const supabase = getSupabaseAdmin()
    
    // Rate limit work locks (60/hour)
    const { data: canProceed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'acquire_work_lock',
      p_limit: 60,
      p_window_minutes: 60
    })
    if (canProceed === false) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } })
    }

    const { data, error } = await supabase.rpc('acquire_work_lock', { p_work_id: workId, p_user_id: user.id })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ locked: Boolean(data) }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('acquire-work-lock error:', e)
    if (e.message.includes('Missing or invalid Authorization') || e.message.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
});
