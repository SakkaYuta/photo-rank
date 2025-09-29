import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Ensure a single Supabase client instance in the browser context to avoid
// duplicate GoTrueClient warnings and undefined behavior.
const g = globalThis as any

export const supabase = g.__supabase__ ?? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'photo-rank-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

if (!g.__supabase__) g.__supabase__ = supabase
