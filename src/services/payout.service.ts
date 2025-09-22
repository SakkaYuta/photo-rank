import { supabase } from './supabaseClient'

export type BankAccount = {
  id: string
  user_id: string
  bank_name: string
  branch_code: string
  account_number: string
  account_type: '普通' | '当座'
  account_holder_kana: string
  created_at: string
  updated_at: string
}

export const PayoutService = {
  async get(): Promise<BankAccount | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as BankAccount) || null
  },

  async upsert(input: Omit<BankAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<BankAccount> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const payload = { ...input, user_id: user.id }
    const { data, error } = await supabase
      .from('user_bank_accounts')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw error
    return data as BankAccount
  }
}

