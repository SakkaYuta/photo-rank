// Skeleton for Supabase Edge Function: release-work-lock
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const { workId } = await req.json()
    if (!workId) return new Response('Bad Request', { status: 400 })
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.rpc('release_work_lock', { p_work_id: workId })
    if (error) return new Response(error.message, { status: 400 })
    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 400 })
  }
});
