import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { workIds, userId } = await req.json()

    if (!workIds || !Array.isArray(workIds) || workIds.length === 0) {
      return new Response(
        JSON.stringify({ error: '商品IDが指定されていません' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ユーザーIDが指定されていません' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 商品情報を取得（工場情報を含む）
    const { data: works, error: worksError } = await supabase
      .from('works')
      .select('id, title, price, factory_id')
      .in('id', workIds)

    if (worksError) {
      console.error('Works query error:', worksError)
      return new Response(
        JSON.stringify({ error: '商品情報の取得に失敗しました' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!works || works.length === 0) {
      return new Response(
        JSON.stringify({ error: '指定された商品が見つかりません' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 見つからない商品IDをチェック
    const foundWorkIds = works.map(w => w.id)
    const missingWorkIds = workIds.filter(id => !foundWorkIds.includes(id))
    if (missingWorkIds.length > 0) {
      return new Response(
        JSON.stringify({
          error: `商品が見つかりません: ${missingWorkIds.join(', ')}`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 工場別にグループ化して送料を計算
    const factoryGroups = works.reduce((groups, work) => {
      const factoryId = work.factory_id || 'no-factory'
      if (!groups[factoryId]) {
        groups[factoryId] = []
      }
      groups[factoryId].push(work)
      return groups
    }, {} as Record<string, typeof works>)

    // モック工場送料データ（実際の実装では工場テーブルから取得）
    const getFactoryShippingCost = (factoryId: string): number => {
      const shippingCosts: Record<string, number> = {
        'factory-001': 300,
        'factory-002': 350,
        'factory-003': 280,
        'no-factory': 0
      }
      return shippingCosts[factoryId] || 300 // デフォルト送料
    }

    // 商品小計と送料合計を計算
    const productSubtotal = works.reduce((sum, work) => sum + work.price, 0)
    const shippingTotal = Object.keys(factoryGroups).reduce((sum, factoryId) => {
      return sum + getFactoryShippingCost(factoryId)
    }, 0)
    const totalAmount = productSubtotal + shippingTotal

    if (totalAmount <= 0) {
      return new Response(
        JSON.stringify({ error: '合計金額が無効です' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Stripe PaymentIntentを作成
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'jpy',
      metadata: {
        workIds: JSON.stringify(workIds),
        userId,
        type: 'bulk_purchase',
        productSubtotal: productSubtotal.toString(),
        shippingTotal: shippingTotal.toString(),
        factoryCount: Object.keys(factoryGroups).length.toString()
      },
      payment_method_types: ['card'],
    })

    // 一括購入レコードを作成
    const { error: insertError } = await supabase
      .from('purchases')
      .insert(
        works.map(work => ({
          user_id: userId,
          work_id: work.id,
          amount: work.price,
          status: 'pending',
          stripe_payment_intent_id: paymentIntent.id,
          created_at: new Date().toISOString(),
        }))
      )

    if (insertError) {
      console.error('Purchase insert error:', insertError)
      // PaymentIntentをキャンセル
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id)
      } catch (cancelError) {
        console.error('Failed to cancel payment intent:', cancelError)
      }
      return new Response(
        JSON.stringify({ error: '購入レコードの作成に失敗しました' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        totalAmount,
        productSubtotal,
        shippingTotal,
        itemCount: works.length,
        factoryCount: Object.keys(factoryGroups).length,
        factoryBreakdown: Object.entries(factoryGroups).map(([factoryId, items]) => ({
          factoryId,
          itemCount: items.length,
          subtotal: items.reduce((sum, item) => sum + item.price, 0),
          shippingCost: getFactoryShippingCost(factoryId)
        }))
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Bulk payment intent creation error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '一括決済の準備に失敗しました'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})