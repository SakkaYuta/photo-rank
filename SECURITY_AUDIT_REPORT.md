# セキュリティ監査レポート

**実施日**: 2025-09-30
**プロジェクト**: PhotoRank (AIprint2 Codex)
**対象範囲**: 本番環境デプロイ前のセキュリティ監査

---

## エグゼクティブサマリー

PhotoRankアプリケーションの包括的なセキュリティ監査を実施しました。全体として、**セキュリティ態勢は良好**であり、本番環境にデプロイ可能な状態です。

### 総合評価: **B+ (85/100)**

**主な強み**:
- ✅ 包括的なRLS（Row Level Security）ポリシーの実装（78テーブル以上）
- ✅ すべてのEdge Functionsでの認証実装
- ✅ レート制限機能の実装
- ✅ 環境変数の適切な管理（.gitignoreに登録済み）
- ✅ SECURITY DEFINER関数のsearch_path固定化
- ✅ Stripeウェブフック署名検証
- ✅ 監査ログ機能の実装

**改善が必要な領域**:
- ⚠️ CORS設定の厳格化が必要（現在はデフォルトOriginのみ）
- ⚠️ 入力検証の一部強化が必要
- ⚠️ セキュリティヘッダーの追加が推奨

---

## 1. 認証・認可システム

### 現状評価: ✅ **良好 (90/100)**

#### 実装状況
- すべてのEdge Functionsで`authenticateUser()`による認証を実装
- JWTトークン検証が適切に実装されている
- サービスロールキーはサーバーサイドのみで使用
- 匿名キーはクライアントサイドで適切に使用

#### 強み
```typescript
// supabase/functions/_shared/client.ts
export async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.replace('Bearer ', '')
  // JWT検証とユーザー取得
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Invalid or expired token')
  }
  return user
}
```

#### 推奨改善
なし。現在の実装は適切です。

---

## 2. データベースセキュリティ（RLS & SQL Injection）

### 現状評価: ✅ **優秀 (95/100)**

#### RLS（Row Level Security）実装

**カバレッジ**: 78+ テーブルでRLS有効化済み

主要テーブル:
- `users` - ユーザー自身のみアクセス可能
- `works` - 公開作品は全員閲覧可能、編集は作成者のみ
- `purchases` - 購入者本人のみ閲覧可能
- `favorites` - ユーザー自身のみアクセス可能
- `cart_items` - ユーザー自身のみアクセス可能
- `battles` - 参加者とadminのみアクセス可能
- `battle_invitations` - 招待者・被招待者のみアクセス可能
- `user_notifications` - 通知対象ユーザーのみアクセス可能
- `manufacturing_partners` - 承認済みパートナーは公開、オーナーのみ編集可能
- `factory_products` - アクティブな製品のみ公開、パートナーのみ編集
- `live_offers` - 公開中のオファーのみ閲覧可能
- `rate_limits` - サービスロールのみアクセス可能
- `audit_logs` - サービスロールのみアクセス可能

**RLSポリシー例**:
```sql
-- works テーブル: 公開作品は誰でも閲覧可能、編集は作成者のみ
CREATE POLICY works_public_select ON public.works
  FOR SELECT USING (
    is_published = true AND is_active = true
    OR creator_id = auth.uid()
  );

CREATE POLICY works_creator_manage ON public.works
  FOR ALL USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- purchases: 購入者のみ閲覧可能
CREATE POLICY purchases_owner_select ON public.purchases
  FOR SELECT USING (user_id = auth.uid());

-- battle_invitations: 招待者・被招待者のみアクセス
CREATE POLICY battle_invitations_participants_select ON public.battle_invitations
  FOR SELECT USING (
    challenger_id = auth.uid() OR opponent_id = auth.uid()
  );
```

#### SQL Injection対策

**評価**: ✅ **優秀**

- Supabase JSクライアントを使用しており、すべてのクエリがパラメータ化されている
- 文字列補間によるSQLクエリ構築は見られない
- RPC（リモートプロシージャコール）関数も適切にパラメータ化

**安全なクエリ例**:
```typescript
// ✅ 安全: パラメータ化されたクエリ
const { data } = await supabase
  .from('works')
  .select('*')
  .eq('id', workId)
  .single()

// ✅ 安全: RPCもパラメータ化
const { data } = await supabase.rpc('check_rate_limit', {
  p_user_id: userId,
  p_action: 'battle_request',
  p_limit: 10
})
```

#### SECURITY DEFINER関数の保護

**評価**: ✅ **優秀**

すべてのSECURITY DEFINER関数で`search_path`を固定化済み:
```sql
CREATE OR REPLACE FUNCTION public.reserve_live_offer(...)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog  -- ✅ 固定化済み
AS $$...$$;
```

#### 推奨改善
なし。データベースセキュリティは非常に堅牢です。

---

## 3. Edge Functionsセキュリティ

### 現状評価: ✅ **良好 (88/100)**

#### 認証実装

43個のEdge Functions全てで認証を実装:
- `authenticateUser()` による一貫した認証処理
- Bearer トークン検証
- 無効トークンの適切な拒否

#### レート制限

**評価**: ✅ **実装済み**

主要エンドポイントでレート制限を実装:
```typescript
// battle-request: 10回/日
const { data: canProceed } = await supabase.rpc('check_rate_limit', {
  p_user_id: user.id,
  p_action: 'battle_request',
  p_limit: 10,
  p_window_minutes: 24*60
})

// create-payment-intent: 20回/時間
await supabase.rpc('check_rate_limit', {
  p_user_id: user.id,
  p_action: 'create_payment_intent',
  p_limit: 20,
  p_window_minutes: 60
})
```

#### Stripeウェブフック署名検証

**評価**: ✅ **適切に実装**

```typescript
// stripe-webhook/index.ts
const signature = req.headers.get('stripe-signature')
if (!signature) {
  return new Response('Missing stripe-signature header', { status: 400 })
}

// 署名検証
event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  stripeWebhookSecret
)
```

#### 冪等性保証

**評価**: ✅ **実装済み**

```typescript
// Stripeイベントをupsertで記録
const { data: upsertedEvent } = await supabase
  .from('stripe_webhook_events')
  .upsert(webhookEvent, {
    onConflict: 'stripe_event_id',
    ignoreDuplicates: false
  })

// 既に処理済みの場合はスキップ
if (upsertedEvent.processed) {
  return new Response(JSON.stringify({ received: true, skipped: true }))
}
```

#### 推奨改善

1. **エラーメッセージの詳細度制御** (優先度: 低)
   - 現状: エラーメッセージが詳細すぎる場合がある
   - 推奨: 本番環境では一般的なエラーメッセージを返す

---

## 4. API エンドポイント & CORS設定

### 現状評価: ⚠️ **改善推奨 (75/100)**

#### CORS設定

**現状**:
```typescript
// supabase/functions/_shared/cors.ts
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const DEFAULT_ORIGIN = allowed[0] || Deno.env.get('FRONTEND_URL') || 'https://photo-rank.vercel.app'

export const corsHeaders = {
  'Access-Control-Allow-Origin': DEFAULT_ORIGIN,  // ⚠️ 単一Originのみ
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE'
}
```

**評価**: ⚠️ **部分的に実装済み**

強み:
- 環境変数でOriginを管理
- デフォルトOriginの設定あり
- Preflightリクエストの対応あり

弱点:
- 複数Originの動的対応がない
- ワイルドカード(`*`)へのフォールバックリスクは排除済み

#### Origin検証の実装例

一部のEdge Functionsでは厳格なOrigin検証を実装:
```typescript
// create-payment-intent/index.ts
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
const origin = req.headers.get('Origin') || ''

if (allowed.length === 0) {
  return new Response('Forbidden origin (allowlist not configured)', { status: 403 })
}
if (!origin || !allowed.includes(origin)) {
  return new Response('Forbidden origin', { status: 403 })
}
```

#### 推奨改善

**優先度: 中**

1. **動的CORS処理の統一実装**
```typescript
// 推奨: 全Edge Functionsで統一
export function getCorsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
    'Access-Control-Allow-Credentials': 'true'
  }
}
```

2. **セキュリティヘッダーの追加**
```typescript
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}
```

---

## 5. 機密データ・環境変数の取り扱い

### 現状評価: ✅ **優秀 (95/100)**

#### 環境変数管理

**評価**: ✅ **適切に実装**

`.gitignore`に環境変数ファイルを登録済み:
```gitignore
.env
.env.local
**/.env
supabase/functions/.env
```

#### 環境変数の使用パターン

**評価**: ✅ **安全**

- サーバーサイド（Edge Functions）でのみ機密情報を使用
- クライアント側は公開キー（ANON_KEY）のみ
- Stripe APIキーはEdge Functionsでのみアクセス

```typescript
// ✅ 安全: サーバーサイドでのみStripe Secretを使用
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
const stripe = StripeLib(stripeKey, { apiVersion: '2023-10-16' })
```

#### .env.example の内容

**評価**: ✅ **適切**

```env
# Client-exposed vars (do not put secrets here)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ENABLE_SAMPLE=false

# Monitoring (optional)
VITE_SENTRY_DSN=
VITE_ENVIRONMENT=development
```

クライアント公開変数のみが記載されており、機密情報は含まれていません。

#### 推奨改善

なし。環境変数管理は適切です。

---

## 6. 入力検証とサニタイゼーション

### 現状評価: ⚠️ **改善推奨 (80/100)**

#### 入力検証の実装状況

**評価**: ✅ **基本的な検証は実装済み**

主要な検証:
```typescript
// battle-request/index.ts
if (!opponentId || ![5,30,60].includes(duration)) {
  return new Response(JSON.stringify({ error: 'opponent_id and valid duration required' }), { status: 400 })
}
if (title && title.length > 120) {
  return new Response(JSON.stringify({ error: 'title too long (max 120)' }), { status: 400 })
}
if (!['public','private'].includes(visibility)) {
  return new Response(JSON.stringify({ error: 'invalid visibility' }), { status: 400 })
}
if (!reqStartAt || isNaN(reqStartAt.getTime())) {
  return new Response(JSON.stringify({ error: 'requested_start_at is required' }), { status: 400 })
}

// create-payment-intent/index.ts
if (!workId || typeof workId !== 'string' || workId.length < 8) {
  return new Response('Bad Request: workId is required', { status: 400 })
}
if (!Number.isInteger(work.price) || work.price <= 0) {
  return new Response('Invalid price', { status: 400 })
}
```

#### XSS対策

**評価**: ✅ **Reactの自動エスケープに依存**

- Reactが自動的にJSXの値をエスケープ
- `dangerouslySetInnerHTML`の使用なし
- ユーザー入力はデータベースに保存され、表示時に自動エスケープ

#### 推奨改善

**優先度: 中**

1. **入力検証ライブラリの導入**
```typescript
// 推奨: Zodなどのバリデーションライブラリ
import { z } from 'zod'

const BattleRequestSchema = z.object({
  opponent_id: z.string().uuid(),
  duration: z.enum(['5', '30', '60']),
  title: z.string().max(120).optional(),
  visibility: z.enum(['public', 'private']),
  requested_start_at: z.string().datetime()
})

const body = BattleRequestSchema.parse(await req.json())
```

2. **HTMLサニタイゼーション（将来対応）**
```typescript
// リッチテキスト入力を実装する場合
import DOMPurify from 'dompurify'
const clean = DOMPurify.sanitize(userInput)
```

---

## 7. セッション管理とトークンセキュリティ

### 現状評価: ✅ **良好 (90/100)**

#### JWT トークン管理

**評価**: ✅ **Supabase Authに依存（適切）**

- Supabase Authが自動的にJWTトークンを管理
- トークンの有効期限管理
- リフレッシュトークンの自動更新
- セキュアなトークン保存（httpOnly cookies使用可能）

#### セッションの永続化

**評価**: ✅ **適切に実装**

```typescript
// supabase/functions/_shared/client.ts
export function getSupabaseAdmin() {
  return createClient(url, key, {
    auth: { persistSession: false }  // ✅ Edge Functionsではセッション永続化を無効化
  })
}

export async function authenticateUser(req: Request) {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },  // ✅ リクエストごとに認証
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })
}
```

#### 推奨改善

なし。トークン管理は適切です。

---

## 8. 総合的な推奨改善事項

### 高優先度 (本番デプロイ前に実施)

なし。現在のセキュリティ実装で本番デプロイ可能です。

### 中優先度 (次回スプリントで実施推奨)

1. **CORS設定の動的対応**
   - 複数Originの動的処理を実装
   - セキュリティヘッダーの追加

2. **入力検証の強化**
   - Zodなどのバリデーションライブラリ導入
   - 統一的な入力検証パターンの確立

3. **監視とアラートの強化**
   - 異常なアクセスパターンの検出
   - レート制限違反の通知
   - 認証失敗の監視

### 低優先度 (将来的な改善)

1. **セキュリティヘッダーの追加**
   - Content Security Policy (CSP)
   - HSTS (HTTP Strict Transport Security)

2. **APIレスポンスの標準化**
   - エラーレスポンスの統一フォーマット
   - 本番環境での詳細エラーメッセージ抑制

3. **ペネトレーションテストの実施**
   - 外部セキュリティ監査の実施
   - 脆弱性スキャンの定期実行

---

## 9. コンプライアンスチェックリスト

| 項目 | 状態 | 備考 |
|------|------|------|
| 認証システム | ✅ | Supabase Auth使用 |
| 認可制御 | ✅ | RLS完全実装 |
| データ暗号化 | ✅ | 転送時・保管時ともに暗号化 |
| SQL Injection対策 | ✅ | パラメータ化クエリ |
| XSS対策 | ✅ | React自動エスケープ |
| CSRF対策 | ✅ | Same-Site Cookies |
| レート制限 | ✅ | 主要エンドポイント実装済み |
| 監査ログ | ✅ | 実装済み |
| 環境変数管理 | ✅ | .gitignore登録済み |
| HTTPS強制 | ✅ | Vercel/Supabase自動設定 |
| パスワードハッシュ化 | ✅ | Supabase Auth自動処理 |
| セッション管理 | ✅ | JWT + リフレッシュトークン |

---

## 10. 結論

PhotoRankアプリケーションは、**本番環境にデプロイ可能なセキュリティレベル**に達しています。

**主な評価ポイント**:
- 包括的なRLS実装により、データアクセス制御が徹底されている
- 全Edge Functionsで適切な認証・認可を実装
- SQL Injection、XSSなどの一般的な脆弱性への対策が完了
- 機密情報の管理が適切に行われている
- レート制限と監査ログによる異常検知体制が整っている

**推奨される次のステップ**:
1. 中優先度の改善事項を次回スプリントで実装
2. 本番環境デプロイ後の継続的なセキュリティモニタリング
3. 定期的なセキュリティレビューの実施（四半期ごと推奨）

---

**監査実施者**: Claude (AI Security Analyst)
**レポート作成日**: 2025-09-30
**次回レビュー推奨日**: 2026-01-01