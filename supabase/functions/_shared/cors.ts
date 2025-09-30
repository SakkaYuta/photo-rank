// CORS設定の共通定義
// Prefer explicit origins via env; avoid wildcard fallbacks in production
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// 最低限のデフォルト（環境未設定時も'*'は避ける）
const DEFAULT_ORIGIN = allowed[0] || Deno.env.get('FRONTEND_URL') || 'https://photo-rank.vercel.app'

export const corsHeaders = {
  'Access-Control-Allow-Origin': DEFAULT_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE'
}

// CORS preflight対応のヘルパー関数
export function createCorsResponse(body?: string, status: number = 200, additionalHeaders?: Record<string, string>) {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json', ...additionalHeaders }
  return new Response(body || JSON.stringify({ success: true }), { status, headers })
}

// CORS preflight用レスポンス
export function corsPreflightResponse() {
  return new Response('ok', { headers: corsHeaders })
}
