import { supabase } from './supabaseClient'
import { isDemoEnabled } from '../utils/demo'

export type UserAddress = {
  id: string
  user_id: string
  name: string
  postal_code: string
  prefecture?: string | null
  city?: string | null
  address1: string
  address2?: string | null
  phone?: string | null
  is_default: boolean
  created_at: string
}

export type AddressInput = Omit<UserAddress, 'id' | 'user_id' | 'is_default' | 'created_at'> & { is_default?: boolean }

export const AddressService = {
  async list(): Promise<UserAddress[]> {
    if (isDemoEnabled()) {
      return [{
        id: 'addr-1', user_id: 'demo-user-1', name: '山田太郎', postal_code: '100-0001', prefecture: '東京都', city: '千代田区',
        address1: '千代田1-1', address2: 'XXマンション101', phone: '0312345678', is_default: true, created_at: new Date().toISOString()
      }]
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    return (data || []) as UserAddress[]
  },

  async create(input: AddressInput): Promise<UserAddress | null> {
    if (isDemoEnabled()) {
      return {
        id: 'addr-2', user_id: 'demo-user-1', is_default: Boolean(input.is_default), created_at: new Date().toISOString(),
        name: input.name, postal_code: input.postal_code, prefecture: input.prefecture || null, city: input.city || null,
        address1: input.address1, address2: input.address2 || null, phone: input.phone || null
      }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const payload = { ...input, user_id: user.id, is_default: Boolean(input.is_default) }
    const { data, error } = await supabase
      .from('user_addresses')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as UserAddress
  },

  async update(id: string, input: Partial<AddressInput>): Promise<void> {
    if (isDemoEnabled()) return
    const { error } = await supabase
      .from('user_addresses')
      .update(input)
      .eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    if (isDemoEnabled()) return
    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async setDefault(id: string): Promise<void> {
    if (isDemoEnabled()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const client = supabase
    const { error: clearErr } = await client
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
    if (clearErr) throw clearErr
    const { error } = await client
      .from('user_addresses')
      .update({ is_default: true })
      .eq('id', id)
    if (error) throw error
  },
}
