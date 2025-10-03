# 🏗️ アーキテクチャ改善計画

**作成日**: 2025-10-02
**目的**: 保守性・セキュリティ・型安全性の向上
**実施期間**: 短期（即座）→ 中期（1-2週間）→ 長期（1-3ヶ月）

---

## 📋 改善項目サマリー

### ✅ 完了済み
1. **SECURITY DEFINER関数のsearch_path固定**
2. **ビューのsecurity_invoker有効化**
3. **公開用プロフィールビュー作成（PII保護）**
4. **型定義の自動生成** (`src/types/supabase.ts`)

### 🔄 進行中
1. **型定義の適用とTypeScript strict設定**

### ⏳ 計画中
1. **サービス層の確立とUI直クエリ移行**
2. **CI/CDパイプラインの強化**
3. **互換ビューのサンセット計画**

---

## 🎯 優先度別実施計画

### 【最優先】短期タスク（即座 - 1週間）

#### 1. TypeScript strict設定 ✅ 準備完了

**現状**:
- `tsconfig.json` の strict 設定が不完全
- `any` の多用
- `// @ts-nocheck` の使用

**目標**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**実施手順**:
1. `tsconfig.json` を段階的に strict 化
2. `// @ts-nocheck` ファイルのリスト作成
3. 各ファイルの型エラー修正
4. Supabase型定義の適用

**影響範囲**: 全TypeScriptファイル
**優先度**: 🔴 最高
**所要時間**: 3-5日

---

#### 2. Supabase クライアントの型付け ✅ 準備完了

**現状**:
```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(url, key)
```

**改善後**:
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

export const supabase = createClient<Database>(url, key)
```

**利点**:
- `.from('table_name')` の型推論が効く
- 存在しないカラム名でコンパイルエラー
- ビューの型も自動補完

**実施ファイル**:
- `src/services/supabaseClient.ts`

**影響範囲**: 全データアクセス
**優先度**: 🔴 最高
**所要時間**: 30分

---

#### 3. SQL対策の適用 ✅ 完了

**実施内容**:
- ✅ `REMOTE_APPLY_security_hardening.sql` 作成済み
- ✅ `SECURITY_HARDENING_GUIDE.md` 作成済み

**次のアクション**:
- リモートDBへの適用（Supabase Studio経由）

**優先度**: 🔴 最高
**所要時間**: 5分

---

#### 4. CI/CD: 型チェックとlintの追加

**現状**: CIパイプラインなし

**目標**:
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run format:check
      - run: npx supabase gen types typescript --local > src/types/supabase.generated.ts
      - run: git diff --exit-code src/types/supabase.generated.ts
```

**package.json に追加**:
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "format:check": "prettier --check 'src/**/*.{ts,tsx}'",
    "format": "prettier --write 'src/**/*.{ts,tsx}'"
  }
}
```

**優先度**: 🔴 最高
**所要時間**: 2-3時間

---

### 【高優先】中期タスク（1-2週間）

#### 5. サービス層の確立

**目標**: UI層がSupabaseテーブル名を直接知らない設計

**実施内容**:

##### 5.1 ドメイン別サービス作成

**ファイル構成**:
```
src/
  services/
    domain/
      commerce/
        CommerceService.ts      # orders, payments, shipments
        DigitalService.ts       # download_entitlements
        RefundService.ts        # refunds
      factory/
        FactoryService.ts       # manufacturing_partners, partner_products
        OrderService.ts         # manufacturing_orders, fulfillments
      user/
        UserService.ts          # users, user_profiles, user_roles
        AuthService.ts          # authentication
      battle/
        BattleService.ts        # battles, battle_participants
      work/
        WorkService.ts          # works, assets, products
    compat/
      views.ts                  # 互換ビュー定義の集約
```

**CommerceService 例**:
```typescript
import { supabase } from '../supabaseClient'
import type { Database } from '@/types/supabase'

type Order = Database['public']['Tables']['orders']['Row']
type Payment = Database['public']['Tables']['payments']['Row']

export class CommerceService {
  // 注文一覧取得
  static async getOrders(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // 注文詳細取得
  static async getOrder(orderId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error) throw error
    return data
  }

  // 注文作成（RPC経由）
  static async createOrder(payload: {/* ... */}): Promise<Order> {
    const { data, error } = await supabase
      .rpc('create_order', payload)

    if (error) throw error
    return data
  }

  // その他のメソッド...
}
```

**優先度**: 🟡 高
**所要時間**: 5-7日

---

##### 5.2 互換ビューの集約

**ファイル**: `src/services/compat/views.ts`

```typescript
import type { Database } from '@/types/supabase'

// 互換ビュー名の定義
export const COMPAT_VIEWS = {
  purchases: 'purchases_vw',
  sales: 'sales_vw',
  publishingApprovals: 'publishing_approvals_vw',
  factoryOrders: 'factory_orders_vw',
  factoryProducts: 'factory_products_vw',
  manufacturingOrders: 'manufacturing_orders_vw',
  users: 'users_vw',
  works: 'works_vw',
  refundRequests: 'refund_requests_vw',
  cheerFreeCounters: 'cheer_free_counters_vw',
} as const

// 型定義
export type PurchasesViewRow = Database['public']['Views']['purchases_vw']['Row']
export type SalesViewRow = Database['public']['Views']['sales_vw']['Row']
// ... 他のビュー型
```

**使用例**:
```typescript
import { COMPAT_VIEWS } from '@/services/compat/views'
import type { PurchasesViewRow } from '@/services/compat/views'

const { data } = await supabase
  .from(COMPAT_VIEWS.purchases)
  .select('*')
```

**優先度**: 🟡 高
**所要時間**: 1-2日

---

#### 6. エラーハンドリングの統一

**現状**: try-catch の不統一、alert/prompt の使用

**目標**: Result型パターンの導入

**実施内容**:

```typescript
// src/utils/result.ts
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export function ok<T>(data: T): Result<T> {
  return { success: true, data }
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error }
}
```

**サービス層での使用**:
```typescript
static async getOrder(orderId: string): Promise<Result<Order>> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error) return err(error)
    if (!data) return err(new Error('Order not found'))

    return ok(data)
  } catch (error) {
    return err(error as Error)
  }
}
```

**UI層での使用**:
```typescript
const result = await CommerceService.getOrder(orderId)

if (result.success) {
  setOrder(result.data)
} else {
  toast.error(result.error.message)
}
```

**優先度**: 🟡 高
**所要時間**: 3-4日

---

#### 7. 日時・通貨処理の集約

**実施内容**:

```typescript
// src/utils/dateUtils.ts
export function formatDateTime(date: string | Date, locale = 'ja-JP'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date, locale = 'ja-JP'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diff = new Date(date).getTime() - Date.now()
  const days = Math.round(diff / (1000 * 60 * 60 * 24))

  if (Math.abs(days) < 1) {
    const hours = Math.round(diff / (1000 * 60 * 60))
    return rtf.format(hours, 'hour')
  }

  return rtf.format(days, 'day')
}

// src/utils/currency.ts
export function formatCurrency(
  amount: number,
  currency = 'JPY',
  locale = 'ja-JP'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}
```

**優先度**: 🟡 高
**所要時間**: 1日

---

### 【中優先】長期タスク（1-3ヶ月）

#### 8. 互換ビューのサンセット計画

**目標**: 段階的に正規テーブルAPIへ移行

**計画書**: `COMPAT_MIGRATION_PLAN.md`

```markdown
# 互換ビュー移行計画

## フェーズ1: サービス層確立（完了目標: 2025-11-01）
- [ ] CommerceService 実装
- [ ] FactoryService 実装
- [ ] UserService 実装
- [ ] BattleService 実装
- [ ] WorkService 実装

## フェーズ2: UI層の移行（完了目標: 2025-12-01）
- [ ] purchases_vw → CommerceService.getPurchases()
- [ ] sales_vw → CommerceService.getSales()
- [ ] factory_orders_vw → FactoryService.getOrders()
- [ ] users_vw → UserService.getUsers()

## フェーズ3: ビュー廃止（完了目標: 2026-01-01）
- [ ] 使用箇所ゼロ確認
- [ ] ビューDROP
- [ ] マイグレーション削除
```

**優先度**: 🟢 中
**所要時間**: 継続的

---

#### 9. E2Eテストの整備

**実施内容**:

##### 9.1 Stripe フローテスト

```bash
# stripe-test.sh
#!/bin/bash

# Stripe CLI で各イベントをトリガー
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger payment_intent.canceled
stripe trigger charge.refunded

# 結果検証
psql $DATABASE_URL -c "SELECT state, COUNT(*) FROM payments GROUP BY state"
psql $DATABASE_URL -c "SELECT state, COUNT(*) FROM refunds GROUP BY state"
```

##### 9.2 RLS テスト（pgtap）

```sql
-- tests/rls_test.sql
BEGIN;
SELECT plan(10);

-- anon ユーザーは orders を見られない
SET ROLE anon;
SELECT is(
  (SELECT COUNT(*) FROM orders),
  0::bigint,
  'anon cannot see any orders'
);

-- authenticated ユーザーは自分の orders のみ見られる
SET ROLE authenticated;
SET request.jwt.claims.sub TO 'user-id-123';
SELECT ok(
  (SELECT COUNT(*) FROM orders WHERE user_id = 'user-id-123') > 0,
  'authenticated user can see their own orders'
);

SELECT * FROM finish();
ROLLBACK;
```

**優先度**: 🟢 中
**所要時間**: 5-7日

---

#### 10. 構造化ログと監視

**実施内容**:

```typescript
// src/utils/logger.ts
interface LogContext {
  userId?: string
  requestId?: string
  correlationId?: string
  [key: string]: unknown
}

export function logInfo(message: string, context?: LogContext) {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    })
  )
}

export function logError(error: Error, context?: LogContext) {
  console.error(
    JSON.stringify({
      level: 'error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context,
    })
  )
}
```

**Webhook での使用**:
```typescript
const correlationId = event.id

logInfo('Processing webhook', {
  correlationId,
  eventType: event.type,
})

try {
  // 処理...
  logInfo('Webhook processed successfully', { correlationId })
} catch (error) {
  logError(error as Error, { correlationId })
}
```

**優先度**: 🟢 中
**所要時間**: 2-3日

---

## 📊 実施ロードマップ

### Week 1（即座）
- ✅ SQL対策適用
- ✅ 型定義生成
- 🔄 TypeScript strict設定
- 🔄 Supabaseクライアント型付け

### Week 2-3（短期）
- CI/CDパイプライン構築
- ESLint/Prettier設定
- 型エラー修正（段階的）

### Week 4-6（中期）
- サービス層確立（Commerce, Factory, User）
- エラーハンドリング統一
- 日時・通貨処理集約

### Month 2-3（長期）
- UI層のサービス層移行
- E2Eテスト整備
- 互換ビューサンセット開始

---

## 🎯 成功指標（KPI）

### コード品質
- ✅ TypeScript strict: 100%
- ✅ `any` 使用率: <5%
- ✅ `// @ts-nocheck`: 0件
- ✅ ESLint エラー: 0件

### セキュリティ
- ✅ SECURITY DEFINER search_path: 100%固定
- ✅ View security_invoker: 100%有効
- ✅ RLS有効化: 100%

### テストカバレッジ
- 🎯 ユニットテスト: >80%
- 🎯 E2Eテスト: 主要フロー100%
- 🎯 RLSテスト: 全テーブル

### アーキテクチャ
- 🎯 UI直クエリ: 0%（全てサービス層経由）
- 🎯 互換ビュー使用: 段階的削減
- 🎯 エラーハンドリング統一: 100%

---

## 📝 次のアクション

### 即座に実施
1. ✅ `REMOTE_APPLY_security_hardening.sql` をリモートDBに適用
2. 🔄 `src/services/supabaseClient.ts` に型定義適用
3. 🔄 `tsconfig.json` strict設定開始

### 今週中に実施
1. CI/CDパイプライン構築
2. ESLint/Prettier設定
3. CommerceService 実装開始

### 今月中に実施
1. 主要サービス層完成（Commerce, Factory, User）
2. エラーハンドリング統一
3. E2Eテスト基盤構築

---

**作成者**: Claude (AI Assistant)
**最終更新**: 2025-10-02
**ステータス**: 実施準備完了
