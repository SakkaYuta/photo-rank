import { supabase } from './supabaseClient'

export type UserIdentity = {
  id: string
  user_id: string
  last_name: string
  first_name: string
  last_name_kana: string
  first_name_kana: string
  birthday: string // ISO date
  postal_code?: string | null
  prefecture?: string | null
  city?: string | null
  address1?: string | null
  address2?: string | null
  created_at: string
  updated_at: string
}

export const IdentityService = {
  async get(): Promise<UserIdentity | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('user_identities')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as UserIdentity) || null
  },

  async upsert(input: Omit<UserIdentity, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<UserIdentity> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const payload = { ...input, user_id: user.id }
    const { data, error } = await supabase
      .from('user_identities')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw error
    return data as UserIdentity
  }
}

