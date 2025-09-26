import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface AuthUser {
  id: string
  email?: string
  role?: string
}

// リクエストからユーザー認証を取得する関数
export async function authenticateUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return null
  }

  try {
    // 通常のSupabaseクライアントで認証確認
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// サービスロールクライアントを作成する関数
export function createServiceRoleClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// 内部用の簡易シークレット検証（Scheduled/内部呼出専用）
export function requireInternalSecret(req: Request): Response | null {
  const required = Deno.env.get('INTERNAL_CRON_SECRET')
  if (!required) return null // 未設定ならチェック無効（環境で有効化）
  const header = req.headers.get('x-internal-auth') || ''
  if (header !== required) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 })
  }
  return null
}
