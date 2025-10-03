/**
 * Commerce Domain Service
 *
 * Handles all commerce-related operations including:
 * - Orders and order items
 * - Payments and refunds
 * - Shipping and fulfillment
 * - Sales analytics
 */

import { supabase } from '../supabaseClient'
import type { Database } from '@/types/supabase'

type Order = Database['public']['Tables']['orders']['Row']
type OrderInsert = Database['public']['Tables']['orders']['Insert']
type OrderUpdate = Database['public']['Tables']['orders']['Update']
type OrderItem = Database['public']['Tables']['order_items']['Row']
type Refund = Database['public']['Tables']['refunds']['Row']

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

export interface SalesAnalytics {
  totalSales: number
  monthlySales: number
  orderCount: number
  averageOrderValue: number
}

/**
 * Result type for service operations
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Get order by ID with all related items
 */
export async function getOrderWithItems(
  orderId: string
): Promise<Result<OrderWithItems>> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single()

    if (error) throw error
    if (!data) throw new Error('Order not found')

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Get user's order history
 */
export async function getUserOrders(
  userId: string
): Promise<Result<Order[]>> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Create a new order
 */
export async function createOrder(
  order: OrderInsert
): Promise<Result<Order>> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to create order')

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: Order['status']
): Promise<Result<Order>> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Order not found')

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Get sales analytics for a creator
 *
 * Note: This is a simplified implementation until sales_vw compatibility view is created.
 * Joins order_items with orders to get created_at dates.
 */
export async function getCreatorSalesAnalytics(
  creatorId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Result<SalesAnalytics>> {
  try {
    // Get order items with order dates
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        subtotal_excl_tax_jpy,
        subtotal_tax_jpy,
        order_id,
        orders!inner (created_at)
      `)
      .eq('creator_id', creatorId)

    if (error) throw error

    const sales = (data || []).map((item: any) => ({
      subtotal_excl_tax_jpy: item.subtotal_excl_tax_jpy,
      subtotal_tax_jpy: item.subtotal_tax_jpy,
      created_at: item.orders.created_at
    }))

    // Filter by date range if provided
    let filteredSales = sales
    if (startDate) {
      filteredSales = filteredSales.filter((s: any) => new Date(s.created_at) >= startDate)
    }
    if (endDate) {
      filteredSales = filteredSales.filter((s: any) => new Date(s.created_at) <= endDate)
    }

    const totalSales = filteredSales.reduce((sum: number, s: any) => sum + ((s.subtotal_excl_tax_jpy || 0) + (s.subtotal_tax_jpy || 0)), 0)
    const orderCount = filteredSales.length
    const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0

    // Calculate monthly sales (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const monthlySales = filteredSales
      .filter((s: any) => new Date(s.created_at) >= thirtyDaysAgo)
      .reduce((sum: number, s: any) => sum + ((s.subtotal_excl_tax_jpy || 0) + (s.subtotal_tax_jpy || 0)), 0)

    return {
      success: true,
      data: {
        totalSales,
        monthlySales,
        orderCount,
        averageOrderValue
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Get refunds for a payment
 */
export async function getPaymentRefunds(
  paymentId: string
): Promise<Result<Refund[]>> {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Create a refund
 *
 * Note: Using refunds table directly as refund_requests table doesn't exist in current schema.
 */
export async function createRefund(
  paymentId: string,
  stripeRefundId: string | null,
  amount: number,
  reason: string
): Promise<Result<Refund>> {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .insert({
        payment_id: paymentId,
        stripe_refund_id: stripeRefundId,
        amount_jpy: amount,
        reason,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to create refund')

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}
