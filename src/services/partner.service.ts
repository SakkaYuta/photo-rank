import { supabase } from './supabaseClient'
import type { ManufacturingPartner, FactoryProduct, ManufacturingOrder } from '../types'

export async function getCurrentPartnerProfile(): Promise<ManufacturingPartner | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('manufacturing_partners')
    .select('*')
    .eq('owner_user_id', user.id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data as ManufacturingPartner
}

export async function getPartnerProducts(partnerId: string): Promise<FactoryProduct[]> {
  const { data, error } = await supabase
    .from('factory_products')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as FactoryProduct[]
}

export async function createFactoryProduct(product: Omit<FactoryProduct, 'id' | 'created_at' | 'updated_at'>): Promise<FactoryProduct> {
  const { data, error } = await supabase
    .from('factory_products')
    .insert(product)
    .select()
    .single()
  
  if (error) throw error
  return data as FactoryProduct
}

export async function updateFactoryProduct(id: string, updates: Partial<FactoryProduct>): Promise<FactoryProduct> {
  const { data, error } = await supabase
    .from('factory_products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as FactoryProduct
}

export async function deleteFactoryProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('factory_products')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function getPartnerOrders(partnerId: string): Promise<ManufacturingOrder[]> {
  const { data, error } = await supabase
    .from('manufacturing_orders')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as ManufacturingOrder[]
}

export async function updateOrderStatus(
  id: string, 
  status: ManufacturingOrder['status'], 
  updates?: { tracking_number?: string }
): Promise<ManufacturingOrder> {
  const updateData: any = { 
    status, 
    updated_at: new Date().toISOString() 
  }
  
  if (status === 'shipped') {
    updateData.shipped_at = new Date().toISOString()
  }
  
  if (updates?.tracking_number) {
    updateData.tracking_number = updates.tracking_number
  }
  
  const { data, error } = await supabase
    .from('manufacturing_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as ManufacturingOrder
}

export async function getPartnerStats(partnerId: string) {
  const [ordersResult, productsResult] = await Promise.all([
    supabase
      .from('manufacturing_orders')
      .select('status')
      .eq('partner_id', partnerId),
    supabase
      .from('factory_products')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
  ])

  if (ordersResult.error) throw ordersResult.error
  if (productsResult.error) throw productsResult.error

  const orders = ordersResult.data || []
  const activeProducts = productsResult.data?.length || 0

  const totalOrders = orders.length
  const pendingOrders = orders.filter(o => o.status === 'accepted' || o.status === 'in_production').length
  const completedOrders = orders.filter(o => o.status === 'shipped').length

  return {
    activeProducts,
    totalOrders,
    pendingOrders,
    completedOrders
  }
}
