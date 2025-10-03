// レート制限とセキュリティヘルパー
interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyPrefix: string
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

// Supabaseクライアントを使ったシンプルなレート制限
export async function checkRateLimit(
  supabase: any,
  clientId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.keyPrefix}:${clientId}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // v6 スキーマ: rate_limit_logs はイベント行ベース
    const { count, error: countErr } = await supabase
      .from('rate_limit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('key', key)
      .gte('occurred_at', new Date(windowStart).toISOString())

    if (countErr) throw countErr

    const currentCount = count || 0

    if (currentCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + config.windowMs
      }
    }

    // 新規イベントを書き込む（成功と見なす）
    await supabase
      .from('rate_limit_logs')
      .insert({
        user_id: null, // 呼び出し側でユーザーIDがあれば拡張
        endpoint: config.keyPrefix,
        key,
        occurred_at: new Date().toISOString(),
        status: 200
      })

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - currentCount - 1),
      resetTime: windowStart + config.windowMs
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // エラー時は許可（フェイルオープン）
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    }
  }
}

// 監査ログ記録
export interface AuditLogEntry {
  user_id?: string
  action: string
  resource: string
  details?: Record<string, any>
  ip_address?: string
  user_agent?: string
  success: boolean
  error_message?: string
}

export async function logAuditEvent(
  supabase: any,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        ...entry,
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log audit event:', error)
    // 監査ログの失敗はサイレントに処理（主要な機能をブロックしない）
  }
}

// クライアントIPアドレス取得
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const real = req.headers.get('x-real-ip')
  const remote = req.headers.get('remote-addr')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return real || remote || 'unknown'
}

// User Agentの取得（セキュリティ情報として）
export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'unknown'
}

// レート制限エラーレスポンス
export function createRateLimitResponse(resetTime: number): Response {
  return new Response(
    JSON.stringify({
      error: 'レート制限に達しました。しばらく待ってから再試行してください。',
      resetTime
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString()
      }
    }
  )
}
