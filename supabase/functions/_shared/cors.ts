// CORS設定の共通定義
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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