import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

type ProductConfig = { product_type: 'tshirt'|'mug'|'sticker'; color?: string; size?: string }

function priceFor(config: ProductConfig): number {
  switch (config.product_type) {
    case 'tshirt': return 3000
    case 'mug': return 2000
    case 'sticker': return 800
    default: return 3000
  }
}

function publicUrl(baseUrl: string, bucket: string, path: string): string {
  const u = new URL(baseUrl)
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  return `${u.origin}/storage/v1/object/public/${bucket}/${path}`
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const body = await req.json().catch(() => ({})) as { asset_id?: string; config?: ProductConfig; address_id?: string }
    const { asset_id: assetId, config, address_id: addressId } = body
    if (!assetId || !config || !config.product_type) {
      return new Response(JSON.stringify({ error: 'asset_id and config.product_type required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    const supabase = getSupabaseAdmin()

    // Check ownership and status
    const { data: asset, error: assetErr } = await supabase
      .from('online_assets')
      .select('id, owner_user_id, status, preview_path')
      .eq('id', assetId)
      .single()
    if (assetErr || !asset) return new Response(JSON.stringify({ error: 'asset not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (asset.owner_user_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    if (asset.status !== 'approved') return new Response(JSON.stringify({ error: 'asset not approved' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const amount = priceFor(config)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const imageUrl = asset.preview_path ? publicUrl(supabaseUrl, 'photos-watermarked', asset.preview_path) : ''

    // Prefer products table if available; fallback to works
    let targetId = ''
    let title = `Custom ${config.product_type.toUpperCase()}`
    // Try products
    try {
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .insert({
          creator_id: user.id,
          title,
          description: `Generated from online asset ${assetId}`,
          product_type: config.product_type,
          price: amount,
          platform_fee: 0,
          creator_margin: amount,
          status: 'published'
        })
        .select('id')
        .single()
      if (prodErr || !prod) throw prodErr
      targetId = prod.id
    } catch (_) {
      // Fallback to works (legacy)
      const { data: work, error: insErr } = await supabase
        .from('works')
        .insert({
          title,
          description: `Generated from online asset ${assetId}`,
          creator_id: user.id,
          price: amount,
          image_url: imageUrl,
          is_active: true,
        })
        .select('id')
        .single()
      if (insErr || !work) return new Response(JSON.stringify({ error: 'failed to prepare item' }), { status: 400, headers: { 'content-type': 'application/json' } })
      targetId = work.id
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { 'content-type': 'application/json' } })
    // @ts-ignore Deno npm compat
    const StripeLib = (await import('npm:stripe@12.16.0')).default as any
    const stripe = StripeLib(stripeKey, { apiVersion: '2023-10-16' })

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'jpy',
      metadata: {
        user_id: user.id,
        work_id: targetId,
        type: 'work_purchase',
        source: 'custom_product',
        asset_id: assetId,
        product_type: config.product_type,
        color: config.color || '',
        size: config.size || '',
        address_id: addressId || ''
      },
      description: `Custom product: ${work.title}`,
      automatic_payment_methods: { enabled: true },
    })

    return new Response(JSON.stringify({ clientSecret: intent.client_secret, client_secret: intent.client_secret, workId: targetId }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
