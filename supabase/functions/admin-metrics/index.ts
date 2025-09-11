import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async () => {
  const supabase = getSupabaseAdmin()
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const { data: revRows } = await supabase
      .from('purchases')
      .select('price')
      .eq('status', 'paid')
      .gte('purchased_at', todayStart.toISOString())
    const todayRevenue = (revRows || []).reduce((s: number, r: any) => s + (r.price || 0), 0)

    const since = new Date(Date.now() - 24*60*60*1000)
    const { data: events } = await supabase
      .from('webhook_events')
      .select('event_type')
      .gte('created_at', since.toISOString())
    const success = (events || []).filter(e => e.event_type === 'payment_intent.succeeded').length
    const failed = (events || []).filter(e => e.event_type === 'payment_intent.payment_failed').length
    const successRate = success + failed === 0 ? 0 : Math.round((success / (success + failed)) * 100)

    const { count: expiredLocks } = await supabase
      .from('work_availability')
      .select('work_id', { count: 'exact', head: true })
      .lt('locked_until', new Date().toISOString())
      .not('locked_until', 'is', null)

    const { data: recentErrors } = await supabase
      .from('webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    return new Response(JSON.stringify({
      metrics: {
        todayRevenue,
        successRate,
        expiredLocks: expiredLocks || 0,
        recentErrors: recentErrors || [],
      }
    }), { status: 200 })
  } catch (e) {
    console.error('metrics error', e)
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), { status: 500 })
  }
})

