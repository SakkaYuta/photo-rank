import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { authenticateUser, createServiceRoleClient } from "../_shared/auth.ts"
import { corsHeaders, createCorsResponse, corsPreflightResponse } from "../_shared/cors.ts"
import {
  checkRateLimit,
  logAuditEvent,
  getClientIP,
  getUserAgent,
  createRateLimitResponse
} from "../_shared/rateLimit.ts"

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse()
  }

  try {
    // リクエスト情報取得
    const clientIP = getClientIP(req)
    const userAgent = getUserAgent(req)

    // 認証確認
    const user = await authenticateUser(req)
    if (!user) {
      // 失敗を監査ログに記録
      const supabaseAdmin = createServiceRoleClient()
      await logAuditEvent(supabaseAdmin, {
        action: 'delete_account_attempt',
        resource: 'user_account',
        ip_address: clientIP,
        user_agent: userAgent,
        success: false,
        error_message: 'Authentication failed'
      })

      return createCorsResponse(
        JSON.stringify({ error: '認証が必要です' }),
        401
      )
    }

    // サービスロールクライアント作成
    const supabaseAdmin = createServiceRoleClient()

    // レート制限チェック（1時間に5回まで）
    const rateLimitResult = await checkRateLimit(supabaseAdmin, user.id, {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000, // 1時間
      keyPrefix: 'delete_account'
    })

    if (!rateLimitResult.allowed) {
      // レート制限超過を監査ログに記録
      await logAuditEvent(supabaseAdmin, {
        user_id: user.id,
        action: 'delete_account_rate_limited',
        resource: 'user_account',
        ip_address: clientIP,
        user_agent: userAgent,
        success: false,
        error_message: 'Rate limit exceeded'
      })

      return createRateLimitResponse(rateLimitResult.resetTime)
    }

    // アカウント削除実行（サービスロール権限で）
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Account deletion error:', deleteError)

      // 削除失敗を監査ログに記録
      await logAuditEvent(supabaseAdmin, {
        user_id: user.id,
        action: 'delete_account_failed',
        resource: 'user_account',
        details: { error: deleteError.message },
        ip_address: clientIP,
        user_agent: userAgent,
        success: false,
        error_message: deleteError.message
      })

      return createCorsResponse(
        JSON.stringify({ error: 'アカウント削除に失敗しました' }),
        500
      )
    }

    // 削除成功を監査ログに記録
    await logAuditEvent(supabaseAdmin, {
      user_id: user.id,
      action: 'delete_account_success',
      resource: 'user_account',
      details: { deleted_user_id: user.id },
      ip_address: clientIP,
      user_agent: userAgent,
      success: true
    })

    return createCorsResponse(
      JSON.stringify({ message: 'アカウントが正常に削除されました' }),
      200
    )

  } catch (error) {
    console.error('Delete account function error:', error)

    // 例外エラーを監査ログに記録
    const supabaseAdmin = createServiceRoleClient()
    await logAuditEvent(supabaseAdmin, {
      action: 'delete_account_exception',
      resource: 'user_account',
      details: { error: error.message },
      ip_address: getClientIP(req),
      user_agent: getUserAgent(req),
      success: false,
      error_message: error.message
    })

    return createCorsResponse(
      JSON.stringify({ error: 'サーバーエラーが発生しました' }),
      500
    )
  }
})