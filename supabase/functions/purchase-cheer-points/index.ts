import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

// Deprecated endpoint: cheer points purchase must go via create-cheer-points-intent + webhook
serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  return new Response(JSON.stringify({ error: 'Deprecated endpoint. Use create-cheer-points-intent.' }), { status: 410, headers: { ...corsHeaders, 'content-type': 'application/json' } })
})
