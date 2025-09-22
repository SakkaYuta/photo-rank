import { supabase } from './supabaseClient'

export type AccountExtra = {
  user_id: string
  gender?: string | null
  birthday?: string | null
  reasons?: Record<string, boolean> | null
  updated_at?: string
}

export const AccountExtraService = {
  async get(): Promise<AccountExtra | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('user_account_extra')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    return (data as AccountExtra) || null
  },

  async upsert(input: Omit<AccountExtra, 'updated_at'>): Promise<AccountExtra> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const payload = { ...input, user_id: user.id }
    const { data, error } = await supabase
      .from('user_account_extra')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw error
    return data as AccountExtra
  }
}

