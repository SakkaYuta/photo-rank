import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { authenticateUser, getSupabaseAdmin } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

// 管理操作はadminクライアント、ユーザー検証はauthenticateUserで行う
const supabaseAdmin = getSupabaseAdmin()

serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') return corsPreflightResponse()
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Origin allowlist
    const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
    const origin = req.headers.get('Origin') || ''
    if (allowed.length > 0 && origin && !allowed.includes(origin)) {
      return new Response('Forbidden origin', { status: 403, headers: corsHeaders })
    }

    // 認証必須: ユーザーIDはトークンから取得
    const authedUser = await authenticateUser(req)
    const { workIds, addressId } = await req.json()

    // 入力バリデーション
    if (!Array.isArray(workIds) || workIds.length === 0) {
      return new Response(JSON.stringify({ error: '商品IDが指定されていません' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const uuidRe = /^[0-9a-fA-F-]{20,}$/
    const invalid = workIds.find((w: unknown) => typeof w !== 'string' || !uuidRe.test(w))
    if (invalid) {
      return new Response(JSON.stringify({ error: '不正な商品IDが含まれています' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!workIds || !Array.isArray(workIds) || workIds.length === 0) {
      return new Response(JSON.stringify({ error: '商品IDが指定されていません' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // レート制限（例: 20件/時間）
    try {
      const { data: canProceed } = await supabaseAdmin.rpc('check_rate_limit', {
        p_user_id: authedUser.id,
        p_action: 'create_bulk_payment_intent',
        p_limit: 20,
        p_window_minutes: 60,
      })
      if (canProceed === false) {
        return new Response(JSON.stringify({ error: 'レート制限を超えました' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
      }
    } catch (_) {}

    // 商品情報を取得（工場情報を含む）
    const { data: works, error: worksError } = await supabaseAdmin
      .from('works')
      .select('id, title, price, factory_id, creator_id, is_published, is_active')
      .in('id', workIds)

    if (worksError) {
      console.error('Works query error:', worksError)
      return new Response(JSON.stringify({ error: '商品情報の取得に失敗しました' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!works || works.length === 0) {
      return new Response(JSON.stringify({ error: '指定された商品が見つかりません' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    // 認可・妥当性検証
    for (const w of works) {
      if (w.creator_id === authedUser.id) {
        return new Response(JSON.stringify({ error: '自身の作品は購入できません' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const published = (typeof w.is_published === 'boolean' ? w.is_published : false) || (typeof w.is_active === 'boolean' ? w.is_active : false)
      if (!published) {
        return new Response(JSON.stringify({ error: `購入不可の作品が含まれています: ${w.id}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (!Number.isInteger(w.price) || w.price <= 0) {
        return new Response(JSON.stringify({ error: `無効な価格の作品が含まれています: ${w.id}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
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
      return new Response(JSON.stringify({ error: '合計金額が無効です' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Stripe PaymentIntentを作成
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'jpy',
      metadata: {
        workIds: JSON.stringify(workIds),
        userId: authedUser.id,
        type: 'bulk_purchase',
        productSubtotal: productSubtotal.toString(),
        shippingTotal: shippingTotal.toString(),
        factoryCount: Object.keys(factoryGroups).length.toString(),
        address_id: addressId || ''
      },
      payment_method_types: ['card'],
    })

    // 一括購入レコードを作成（adminで作成するが、必ず認証ユーザーを設定）
    const { error: insertError } = await supabaseAdmin
      .from('purchases')
      .insert(
        works.map(work => ({
          user_id: authedUser.id,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Bulk payment intent creation error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '一括決済の準備に失敗しました' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
