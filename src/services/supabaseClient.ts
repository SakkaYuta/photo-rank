import { createClient } from '@supabase/supabase-js'
import { isDemoEnabled } from '@/utils/demo'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const isSample = isDemoEnabled()

// Ensure a single Supabase client instance in the browser context to avoid
// duplicate GoTrueClient warnings and undefined behavior.
const g = globalThis as any

function createStubClient() {
  const ok = { data: null, error: null }
  const okArr = { data: [] as any[], error: null as any }
  const chain = () => ({
    select: async () => okArr,
    insert: async () => ok,
    update: async () => ok,
    delete: async () => ok,
    eq: function () { return this },
    in: function () { return this },
    ilike: function () { return this },
    gte: function () { return this },
    lte: function () { return this },
    order: function () { return this },
    limit: function () { return this },
    range: function () { return this },
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
  })
  return {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => { throw new Error('Auth disabled in sample mode') },
      updateUser: async () => ({ error: null }),
    },
    storage: {
      from: (_bucket: string) => ({
        getPublicUrl: (_path: string) => ({ data: { publicUrl: '' }, error: null as any }),
      }),
    },
    from: (_: string) => chain(),
    rpc: async () => ok,
    functions: {
      invoke: async () => ({ data: null, error: { message: 'Supabase not configured' } as any }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  } as any
}

const realClient = () => createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storageKey: 'photo-rank-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

const client = (supabaseUrl && supabaseAnonKey) ? realClient() : (isSample ? createStubClient() : null)

if (!client) {
  // Missing env and not in sample mode: fail with clear message, but avoid crashing render synchronously
  console.error('Supabase env is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable demo on allowed hosts.')
}

export const supabase = g.__supabase__ ?? (client || createStubClient())
if (!g.__supabase__) g.__supabase__ = supabase
