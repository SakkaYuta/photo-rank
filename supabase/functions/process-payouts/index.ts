import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  try {
    // Authenticate user - admin only function
    const user = await authenticateUser(req)
    
    const supabase = getSupabaseAdmin()
    
    // Check if user is admin
    // Check admin privilege strictly by users.role
    const { data: urow, error: uerr } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (uerr || !urow) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    const isAdmin = urow.role === 'admin'
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), { 
        status: 403, 
        headers: { 'content-type': 'application/json' } 
      })
    }

    const today = new Date().toISOString().slice(0, 10)

    // Rate limit for admin payout processing (10/day)
    const { data: canProceed } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'process_payouts',
      p_limit: 10,
      p_window_minutes: 24*60
    })
    if (canProceed === false) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } })
    }

    const { data: payouts, error } = await supabase
      .from('payouts_v31')
      .select('*')
      .eq('scheduled_date', today)
      .eq('status', 'scheduled')

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } })

    const results: any[] = []
    for (const p of payouts ?? []) {
      try {
        if (p.final_payout <= 0) {
          // Skip zero payouts but mark as processed
          await supabase
            .from('payouts_v31')
            .update({ status: 'completed', paid_at: new Date().toISOString(), notes: 'Skipped: amount too low' })
            .eq('id', p.id)
          results.push({ id: p.id, skipped: true, reason: 'Amount below minimum' })
          continue
        }

        // Mark as ready for manual processing
        const transactionId = `manual_${p.recipient_id}_${Date.now()}`
        await supabase
          .from('payouts_v31')
          .update({ 
            status: 'ready_for_transfer', 
            transaction_id: transactionId,
            notes: `Ready for manual bank transfer: ¥${p.final_payout}` 
          })
          .eq('id', p.id)

        results.push({ id: p.id, ok: true, transactionId, amount: p.final_payout, status: 'ready_for_transfer' })
      } catch (e: any) {
        await supabase
          .from('payouts_v31')
          .update({ status: 'failed', notes: e?.message ?? 'processing failed' })
          .eq('id', p.id)
        results.push({ id: p.id, ok: false, error: e?.message })
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length, 
      results,
      message: 'Payouts marked as ready for manual bank transfer'
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (e) {
    console.error('process-payouts error:', e)
    if (e.message.includes('Missing or invalid Authorization') || e.message.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'content-type': 'application/json' } 
      })
    }
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
})
