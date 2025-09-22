import type { Purchase } from '@/types'
import { SAMPLE_WORKS } from './worksSamples'

export const SAMPLE_ORDERS: Array<Purchase & { work: any }> = SAMPLE_WORKS.slice(0, 2).map((w, i) => ({
  id: `demo-order-${i+1}`,
  user_id: 'demo-buyer-1',
  work_id: w.id,
  price: w.price,
  amount: w.price,
  status: 'paid' as any,
  purchased_at: new Date(Date.now() - (i+1)*3600000).toISOString(),
  created_at: new Date(Date.now() - (i+1)*3600000).toISOString(),
  tracking_number: i === 0 ? 'TRK-1234567890' : null,
  work: w,
} as any))

export const SAMPLE_STATUS_HISTORY = (orderId: string) => [
  { id: `${orderId}-1`, status: 'paid', created_at: new Date(Date.now() - 3*3600000).toISOString() },
  { id: `${orderId}-2`, status: 'in_production', created_at: new Date(Date.now() - 2*3600000).toISOString() },
  { id: `${orderId}-3`, status: 'shipped', created_at: new Date(Date.now() - 3600000).toISOString() },
] as any

