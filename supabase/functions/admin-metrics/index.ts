import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  try {
    // Authenticate user from request headers
    const user = await authenticateUser(req)
    
    const supabase = getSupabaseAdmin()
    
    // Check if user is admin (check user profile)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('display_name, role')
      .eq('user_id', user.id)
      .single()
    
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), { 
        status: 404, 
        headers: { 'content-type': 'application/json' } 
      })
    }
    
    // Check admin privileges (either role is admin or display_name contains 'admin')
    const isAdmin = profile.role === 'admin' || 
                   (profile.display_name && profile.display_name.toLowerCase().includes('admin'))
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), { 
        status: 403, 
        headers: { 'content-type': 'application/json' } 
      })
    }

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
    }), { 
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    console.error('admin-metrics error:', e)
    if (e.message.includes('Missing or invalid Authorization') || e.message.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'content-type': 'application/json' } 
      })
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
})

