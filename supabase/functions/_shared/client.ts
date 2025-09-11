// Helper to create Supabase admin client in Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

