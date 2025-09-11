// Skeleton for Supabase Edge Function: acquire-work-lock
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const { workId, userId } = await req.json()
    if (!workId || !userId) return new Response('Bad Request', { status: 400 })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('acquire_work_lock', { p_work_id: workId, p_user_id: userId })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    return new Response(JSON.stringify({ locked: Boolean(data) }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400 })
  }
});
