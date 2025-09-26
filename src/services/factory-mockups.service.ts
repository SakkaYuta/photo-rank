import { supabase } from '@/services/supabaseClient'

export type FactoryProductMockup = {
  id: string
  factory_product_id: string
  label?: string | null
  image_url: string
  geometry?: any | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export async function getFactoryProductMockups(factoryProductId: string): Promise<FactoryProductMockup[]> {
  const { data, error } = await supabase
    .from('factory_product_mockups')
    .select('*')
    .eq('factory_product_id', factoryProductId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data || []) as FactoryProductMockup[]
}

export async function createFactoryProductMockup(input: Omit<FactoryProductMockup, 'id' | 'created_at' | 'updated_at'>): Promise<FactoryProductMockup> {
  const { data, error } = await supabase
    .from('factory_product_mockups')
    .insert({
      factory_product_id: input.factory_product_id,
      label: input.label ?? null,
      image_url: input.image_url,
      geometry: input.geometry ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FactoryProductMockup
}

export async function updateFactoryProductMockup(id: string, patch: Partial<Omit<FactoryProductMockup, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase
    .from('factory_product_mockups')
    .update({ ...patch })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFactoryProductMockup(id: string): Promise<void> {
  const { error } = await supabase
    .from('factory_product_mockups')
    .delete()
    .eq('id', id)
  if (error) throw error
}

