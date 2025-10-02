# Photo-Rank v6.0 データベース移行 完了レポート

**日付**: 2025-10-02
**ステータス**: ✅ 完了（ローカル環境）
**次のステップ**: アプリケーションコード修正 → ステージング検証 → 本番デプロイ

---

## 📊 実施内容サマリー

### ✅ 完了した作業

1. **v6統合スキーマ適用** (`20251002100000_v6_unified_schema.sql`)
   - 40以上のテーブルから正規化された56テーブルへ再設計
   - JPY固定・外税10%・プラットフォーム手数料30%の実装
   - デジタル商品・ライブオファー・バトルポイントシステム実装

2. **設定・ヘルパー関数** (`20251002100001_v6_config_and_helpers.sql`)
   - 税金/手数料計算関数
   - 配送料計算関数
   - 注文集計関数
   - バトルポイント変換関数
   - ライブオファー予約管理関数
   - 自動クリーンアップ関数

3. **セキュリティ強化** (`20251002110000_v6_security_hardening.sql`)
   - 全テーブルRLS有効化（schema_migrations除く）
   - 広域GRANT撤回（anon/authenticatedの全権限削除）
   - 機密テーブルのDeny-Allポリシー
   - 公開コンテンツの適切な閲覧制御
   - 関数への適切な権限付与

4. **互換ビュー作成** (`20251002120000_v6_compatibility_views.sql`)
   - `purchases_vw`: v5の purchases 互換
   - `works_vw`: 作品とアセット結合
   - `factory_products_vw`, `factory_profiles_vw`: 工場関連互換
   - `manufacturing_orders_vw`: 製造オーダー互換
   - `refund_requests_vw`: 返金リクエスト互換
   - `users_vw`: ユーザーとプロフィール結合
   - 互換関数: `complete_purchase_transaction`, `finalize_live_offer_transaction`

5. **ドキュメント整備**
   - `MIGRATION_GUIDE.md`: 包括的な移行ガイド
   - `STRIPE_WEBHOOK_V6_MIGRATION.md`: Stripe Webhook対応ガイド
   - `data-migration-v6.sql`: データ移行スクリプトテンプレート

6. **TypeScript型定義生成**
   - `supabase/types/database.types.ts`: v6スキーマのTypeScript型

---

## 🔐 セキュリティ改善

### Before（v5）
- ❌ 全テーブルに anon/authenticated が全権限（INSERT/UPDATE/DELETE含む）
- ❌ RLS未有効化テーブル多数
- ❌ 機密情報へのアクセス制御なし

### After（v6）
- ✅ schema_migrations 以外の全テーブルでRLS有効化
- ✅ anon/authenticatedの広域権限完全撤回
- ✅ 機密テーブル（Stripe/audit/security関連）はDeny-All
- ✅ 公開コンテンツは適切な条件付き閲覧のみ
- ✅ ユーザー自身のデータのみ管理可能
- ✅ 読み取り専用関数のみ実行権限付与

---

## 💰 料金・手数料システム

### 設定値（確認済み）
```
税率: 1000 bps (10%)
プラットフォーム手数料: 3000 bps (30%)
バトルポイント換算: 1 JPY = 1 point
無料配送閾値: 5000 JPY
デジタルダウンロード: 最大3回、30日間有効
```

### 計算例
```
商品価格（税抜）: 1,000円
消費税（10%）: 100円
合計支払額: 1,100円

プラットフォーム手数料（30%）: 300円（税抜金額から）
クリエイター収益: 700円（税抜金額から）
```

---

## 📋 テーブル構成

### コアドメイン (12テーブル)
- users, user_profiles, user_roles, user_settings, user_notifications
- assets, works, work_assets, work_tags
- categories, tags, addresses

### コマースドメイン (17テーブル)
- products, product_variants, price_history
- carts, cart_items
- orders, order_items, order_addresses
- payments, payment_failures, refunds
- shipments, shipment_items
- live_offers, live_offer_reservations
- digital_variant_assets, download_entitlements, download_tokens

### バトルドメイン (4テーブル)
- battles, battle_participants, battle_invitations
- cheer_tickets

### 製造パートナードメイン (9テーブル)
- manufacturing_partners, partner_users, partner_notifications
- partner_products, partner_product_mockups
- fulfillments, fulfillment_events
- shipping_zones, shipping_zone_members, shipping_rates

### サポートテーブル (10テーブル)
- jp_prefectures (47都道府県)
- system_config
- idempotency_keys
- stripe_webhook_events
- audit_logs, rate_limit_logs
- activity_events
- upload_attempts
- asset_ingestions
- organizer_profiles

### 互換ビュー (7ビュー)
- purchases_vw, works_vw, users_vw
- factory_products_vw, factory_profiles_vw
- manufacturing_orders_vw, refund_requests_vw

---

## ⚠️ 既知の問題と対応必要事項

### 🔴 最優先（アプリが動作しない）

1. **Stripe Webhook の v6 対応**
   - ファイル: `supabase/functions/stripe-webhook/index.ts`
   - 問題:
     * `stripe_webhook_events` の列名不一致（type → event_type, created_at → received_at）
     * 冪等性管理が v5 方式（v6 では idempotency_keys テーブル使用）
     * `purchases` テーブル参照（v6 では orders/order_items/payments）
     * `users.display_name` 参照（v6 では user_profiles.display_name）
     * `cheer_tickets.amount` → `amount_jpy + points`
   - 対応: `STRIPE_WEBHOOK_V6_MIGRATION.md` 参照

2. **アプリケーションコードの購入フロー修正**
   - 対象ファイル:
     * `src/services/refund.service.ts`
     * `src/services/dashboardService.ts`
     * `src/services/partner.service.ts`
   - 問題: `purchases` テーブル直接参照
   - 対応: `purchases_vw` ビュー使用 or 直接 `orders/order_items/payments` JOIN

### 🟡 重要（機能制限がある）

3. **作品画像URL取得**
   - 問題: `works.image_url` → v6 では `works.primary_asset_id → assets.storage_url`
   - 対応: `works_vw` ビュー使用 or JOIN

4. **工場関連テーブル参照**
   - 問題: `factory_products`, `factory_profiles`, `manufacturing_orders` → v6 では名称変更
   - 対応: `factory_*_vw` ビュー使用

5. **ユーザー表示名取得**
   - 問題: `users.display_name` → `user_profiles.display_name`
   - 対応: `users_vw` ビュー使用 or JOIN

### 🟢 推奨（最適化）

6. **データ移行スクリプト実行**
   - ファイル: `supabase/data-migration-v6.sql`
   - 内容: v5 → v6 データ移行のテンプレート
   - 対応: 既存データがある場合、移行スクリプトをカスタマイズして実行

7. **cron ジョブ設定**
   - 必要な定期実行:
     * `cleanup_expired_data()` - 毎日3時（期限切れデータ削除）
     * `release_expired_reservations()` - 5分毎（ライブオファー予約解放）
     * `REFRESH MATERIALIZED VIEW CONCURRENTLY battle_eligibility_mv` - 毎日（※現在未実装）

---

## 📝 次のアクションプラン

### フェーズ1: アプリケーション修正（今すぐ）

1. **Stripe Webhook 修正**
   ```bash
   vi supabase/functions/stripe-webhook/index.ts
   # STRIPE_WEBHOOK_V6_MIGRATION.md の手順に従って修正
   ```

2. **購入フロー修正**
   - `purchases` → `purchases_vw` or `orders/order_items/payments`
   - テスト: ローカル環境で購入フロー動作確認

3. **作品表示修正**
   - `works.image_url` → `works_vw.image_url` or JOIN
   - テスト: 作品一覧・詳細ページの画像表示確認

### フェーズ2: ステージング検証（1-2日後）

1. **ステージング環境へデプロイ**
   ```bash
   # マイグレーション適用
   npx supabase db push --linked

   # TypeScript型同期
   npx supabase gen types typescript --linked > src/types/database.types.ts
   ```

2. **E2Eテスト実施**
   - 購入フロー（通常商品・デジタル商品）
   - バトル参加・応援
   - ライブオファー予約・購入
   - 返金処理

### フェーズ3: 本番デプロイ（1週間後）

1. **メンテナンス時間確保**（2-4時間）
2. **本番DBバックアップ**
3. **マイグレーション実行**
4. **アプリケーションデプロイ**
5. **24時間監視**

---

## 🛠️ ローカル環境での確認コマンド

```bash
# マイグレーション状態確認
npx supabase migration list

# RLS有効状況確認
docker exec supabase_db_photo-rank psql -U postgres -c \
  "SELECT relname, relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND relkind='r'
   ORDER BY relname;"

# 設定値確認
docker exec supabase_db_photo-rank psql -U postgres -c \
  "SELECT * FROM system_config ORDER BY key;"

# テーブル数確認
docker exec supabase_db_photo-rank psql -U postgres -c \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"
```

---

## 📚 参考ドキュメント

1. **MIGRATION_GUIDE.md** - 包括的な移行ガイド
   - 料金・手数料構造の詳細
   - ヘルパー関数リファレンス
   - 4段階の本番デプロイ戦略
   - トラブルシューティング

2. **STRIPE_WEBHOOK_V6_MIGRATION.md** - Stripe Webhook対応
   - v5 → v6 の変更点詳細
   - コード修正例
   - テスト手順

3. **data-migration-v6.sql** - データ移行テンプレート
   - 既存データの v6 スキーマへの移行例
   - 検証クエリ

4. **SCHEMA_REDESIGN.md** - 設計ドキュメント（アーカイブ）
   - 初期設計の経緯

---

## ✅ マイルストーン

- [x] v6 統合スキーマ適用
- [x] セキュリティ強化（RLS + 権限適正化）
- [x] 互換ビュー作成
- [x] TypeScript型定義生成
- [x] ドキュメント整備
- [ ] Stripe Webhook v6 対応
- [ ] アプリケーションコード修正
- [ ] ステージング環境検証
- [ ] 本番環境デプロイ

---

**ローカル環境でのv6データベース移行は完了しました！**
次は、アプリケーションコードの修正とテストを進めてください。

質問や問題があれば、各ドキュメントを参照するか、お気軽にお問い合わせください。
