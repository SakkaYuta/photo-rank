import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

const PARTNER_CONFIGS: Record<string, { baseUrl: string; apiKey: string | undefined }> = {
  suzuri: {
    baseUrl: 'https://suzuri.jp/api/v1',
    apiKey: Deno.env.get('SUZURI_API_KEY')
  },
  pixivFactory: {
    baseUrl: 'https://factory.pixiv.net/api/v1',
    apiKey: Deno.env.get('PIXIV_FACTORY_API_KEY')
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    // Authenticate user
    const user = await authenticateUser(req)
    
    const { partner, orderId, productData } = await req.json()
    
    if (!partner || !orderId || !productData) {
      return new Response(JSON.stringify({ error: 'Missing required fields: partner, orderId, productData' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    const cfg = PARTNER_CONFIGS[partner]
    if (!cfg || !cfg.apiKey) {
      return new Response(JSON.stringify({ error: 'Invalid partner or configuration missing' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    const supabase = getSupabaseAdmin()

    // Verify user owns the work being manufactured
    if (productData.workId) {
      const { data: work, error: workError } = await supabase
        .from('works')
        .select('creator_id')
        .eq('id', productData.workId)
        .single()
      
      if (workError || !work) {
        return new Response(JSON.stringify({ error: 'Work not found' }), { 
          status: 404,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (work.creator_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized to order manufacturing for this work' }), { 
          status: 403,
          headers: { 'content-type': 'application/json' }
        })
      }
    }

    const orderResponse = await fetch(`${cfg.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        order_id: orderId, 
        user_id: user.id,
        ...productData 
      })
    })
    
    const result = await orderResponse.json()

    // Log the manufacturing order
    await supabase.from('manufacturing_orders').insert({
      order_id: orderId,
      partner,
      partner_order_id: result?.id ?? null,
      request_payload: { ...productData, user_id: user.id },
      response_payload: result,
      status: orderResponse.ok ? 'submitted' : 'failed'
    })

    return new Response(JSON.stringify({
      success: orderResponse.ok,
      partner_order_id: result?.id,
      ...result
    }), { 
      headers: { 'Content-Type': 'application/json' }, 
      status: orderResponse.status 
    })
  } catch (err: any) {
    console.error('manufacturing-order error:', err)
    if (err.message?.includes('Missing or invalid Authorization') || err.message?.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'content-type': 'application/json' } 
      })
    }
    return new Response(JSON.stringify({ error: err?.message ?? 'unknown error' }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
})

