// Skeleton for Supabase Edge Function: release-work-lock
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
    
    // Check if user owns the work or has locked it
    const { data: lock, error: lockError } = await supabase
      .from('work_availability')
      .select('locked_by_user_id, work_id')
      .eq('work_id', workId)
      .single()
    
    if (lockError && lockError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers: { 'content-type': 'application/json' } })
    }
    
    // Check if user has the right to release this lock
    const { data: work, error: workError } = await supabase
      .from('works')
      .select('creator_id')
      .eq('id', workId)
      .single()
    
    if (workError || !work) {
      return new Response(JSON.stringify({ error: 'Work not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }
    
    // User can release lock if they:
    // 1. Own the work (creator)
    // 2. Are the one who locked it
    const canRelease = work.creator_id === user.id || (lock && lock.locked_by_user_id === user.id)
    
    if (!canRelease) {
      return new Response(JSON.stringify({ error: 'Unauthorized to release this lock' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }
    
    const { error } = await supabase.rpc('release_work_lock', { p_work_id: workId })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('release-work-lock error:', e)
    if (e.message.includes('Missing or invalid Authorization') || e.message.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
});
