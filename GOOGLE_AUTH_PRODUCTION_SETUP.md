# 🔐 Google認証設定ガイド（本番環境）

**作成日**: 2025-10-03
**本番URL**: https://photo-rank-beta.vercel.app/
**Supabase URL**: https://nykfvvxvqpcxjjlsnnbx.supabase.co
**目的**: 本番環境（Vercel）でGoogle OAuth認証を有効化

---

## 📋 設定概要

### 必要な設定
1. **Google Cloud Console**: OAuth 2.0クライアント設定
2. **Supabase Production**: Google認証プロバイダー設定
3. **Vercel**: 環境変数設定（必要に応じて）

---

## 1️⃣ Google Cloud Console 設定

### ステップ1: Google Cloud Console にアクセス

```
https://console.cloud.google.com/
```

### ステップ2: プロジェクト選択または作成

- 既存プロジェクトがあればそれを使用
- 新規の場合: プロジェクト名 `photo-rank-production`

### ステップ3: OAuth 同意画面の設定

**ナビゲーション**:
```
APIs & Services → OAuth consent screen
```

**設定項目**:
1. **User Type**:
   - 開発/テスト段階: `External`
   - 本番公開後: `Internal` または `External`（一般公開）
2. **アプリ名**: `PhotoRank`
3. **ユーザーサポートメール**: サポート用メールアドレス
4. **アプリのロゴ** (オプション): アプリアイコン画像
5. **アプリのドメイン**:
   - アプリケーション ホームページ: `https://photo-rank-beta.vercel.app`
   - プライバシーポリシー: `https://photo-rank-beta.vercel.app/privacy` (作成必要)
   - 利用規約: `https://photo-rank-beta.vercel.app/terms` (作成必要)
6. **デベロッパーの連絡先情報**: 開発者メールアドレス
7. 「保存して次へ」

**スコープ設定**:
- デフォルト（`.../auth/userinfo.email`, `.../auth/userinfo.profile`）で十分
- 追加不要

**テストユーザー** (External + 未公開の場合):
- 自分と信頼できるテスターのGoogleアカウントを追加

### ステップ4: OAuth 2.0 クライアント ID の作成

**ナビゲーション**:
```
APIs & Services → Credentials → CREATE CREDENTIALS → OAuth client ID
```

**設定項目**:

1. **アプリケーションの種類**: `ウェブ アプリケーション`

2. **名前**: `PhotoRank Production`

3. **承認済みの JavaScript 生成元**:
   ```
   https://photo-rank-beta.vercel.app
   https://nykfvvxvqpcxjjlsnnbx.supabase.co
   ```

4. **承認済みのリダイレクト URI**:

   **Supabase Production URL** (必須):
   ```
   https://nykfvvxvqpcxjjlsnnbx.supabase.co/auth/v1/callback
   ```

   **Vercel Production URL** (念のため追加):
   ```
   https://photo-rank-beta.vercel.app/auth/callback
   ```

   **カスタムドメイン対応** (将来的に):
   ```
   https://app.photorank.com/auth/callback
   https://your-custom-domain.com/auth/callback
   ```

5. 「作成」をクリック

### ステップ5: 認証情報をコピー

作成完了後のモーダルに表示される:

- **クライアント ID**:
  ```
  123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
  ```

- **クライアント シークレット**:
  ```
  GOCSPX-AbCdEfGhIjKlMnOpQrStUvWx
  ```

⚠️ **重要**: これらは安全に保管してください（パスワードマネージャー推奨）

---

## 2️⃣ Supabase Production 設定

### ステップ1: Supabase Dashboard にアクセス

```
https://supabase.com/dashboard/project/nykfvvxvqpcxjjlsnnbx
```

### ステップ2: 認証設定ページを開く

**ナビゲーション**:
```
Authentication → Providers → Google
```

### ステップ3: Google認証を有効化

1. **Google Enabled**: トグルをONにする

2. **Client ID**: Google Cloud Consoleでコピーした値を貼り付け
   ```
   123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
   ```

3. **Client Secret**: Google Cloud Consoleでコピーした値を貼り付け
   ```
   GOCSPX-AbCdEfGhIjKlMnOpQrStUvWx
   ```

4. **Redirect URL** (確認のみ):
   ```
   https://nykfvvxvqpcxjjlsnnbx.supabase.co/auth/v1/callback
   ```
   この値をGoogle Cloud ConsoleのリダイレクトURIに登録済みか確認

5. 「Save」をクリック

---

## 3️⃣ Vercel 環境変数設定（確認）

Supabase接続情報がVercelに設定されているか確認:

### Vercelダッシュボードで確認

**URL**:
```
https://vercel.com/your-team/photo-rank-beta/settings/environment-variables
```

**必要な環境変数**:

```env
# Supabase Production
VITE_SUPABASE_URL=https://nykfvvxvqpcxjjlsnnbx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth (オプション - Supabaseで管理されるため通常不要)
# VITE_GOOGLE_CLIENT_ID=...
```

⚠️ Google認証情報はSupabaseで管理されるため、Vercelに設定する必要は**ありません**

---

## 4️⃣ 動作確認

### ステップ1: 本番環境にアクセス

```
https://photo-rank-beta.vercel.app/
```

### ステップ2: Googleでログインをテスト

1. ログインページで「Googleでログイン」ボタンをクリック
2. Google OAuth同意画面が表示される
3. アカウントを選択
4. 権限を確認（メール、プロフィール情報）
5. 許可をクリック
6. アプリにリダイレクトされ、ログイン完了

### エラーが出た場合

#### エラー: "redirect_uri_mismatch"

**原因**: Google Cloud ConsoleのリダイレクトURIが一致していない

**修正**:
1. Google Cloud Console → Credentials → OAuth 2.0 Client
2. リダイレクトURIを確認:
   ```
   https://nykfvvxvqpcxjjlsnnbx.supabase.co/auth/v1/callback
   ```
3. 完全一致していることを確認（末尾の `/` に注意）

#### エラー: "access_denied"

**原因**: OAuth同意画面が未承認、またはテストユーザーに含まれていない

**修正**:
1. Google Cloud Console → OAuth consent screen
2. 公開ステータスを確認
3. テストユーザーにメールアドレスを追加

#### エラー: "invalid_client"

**原因**: Client IDまたはClient Secretが間違っている

**修正**:
1. Supabase Dashboard → Authentication → Providers → Google
2. Client IDとClient Secretを再確認
3. Google Cloud Consoleで再生成して更新

---

## 5️⃣ セキュリティ強化（本番運用前）

### 必須設定

1. **HTTPS強制**:
   - Vercelは自動的にHTTPSを強制（完了済み）

2. **OAuth同意画面の公開**:
   - テスト段階から本番公開に移行
   - Google Cloud Console → OAuth consent screen → "PUBLISH APP"

3. **プライバシーポリシーと利用規約**:
   - `/privacy` ページ作成
   - `/terms` ページ作成
   - OAuth同意画面に登録

4. **ドメイン検証**:
   - Google Search Consoleでドメイン所有権を確認
   - 信頼性向上

### 推奨設定

1. **Rate Limiting**:
   - Supabase → Authentication → Rate Limits
   - 不正ログイン試行を制限

2. **Email確認**:
   - Supabase → Authentication → Email Auth
   - "Confirm email" を有効化

3. **MFA（多要素認証）**:
   - 重要なアカウントに対してMFA有効化

---

## 📊 トラブルシューティング

### ログの確認

**Supabase Logs**:
```
Supabase Dashboard → Logs → Auth Logs
```
認証エラーの詳細を確認

**Vercel Logs**:
```
Vercel Dashboard → Deployments → [latest] → Logs
```
デプロイ時のエラーを確認

### よくある問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| リダイレクトエラー | URI不一致 | Google ConsoleとSupabaseのURIを完全一致させる |
| 同意画面が表示されない | Client ID未設定 | Supabaseで認証情報を再確認 |
| ログイン後にエラー | RLSポリシー不足 | users/user_profilesテーブルのRLS確認 |
| メール未取得 | スコープ不足 | OAuth同意画面でemailスコープを確認 |

---

## ✅ チェックリスト

### Google Cloud Console
- [ ] OAuth同意画面設定完了
- [ ] OAuth 2.0クライアント作成完了
- [ ] リダイレクトURI登録完了
- [ ] Client ID・Secretをコピー済み

### Supabase
- [ ] Google認証プロバイダー有効化
- [ ] Client ID設定完了
- [ ] Client Secret設定完了
- [ ] Redirect URL確認済み

### 動作確認
- [ ] 本番環境でGoogleログイン成功
- [ ] ユーザー情報正しく取得
- [ ] エラーログなし

### セキュリティ（本番前）
- [ ] プライバシーポリシー作成
- [ ] 利用規約作成
- [ ] OAuth同意画面公開
- [ ] Rate Limiting設定

---

## 📝 次のステップ

1. **Google Cloud Consoleで設定** → Client ID・Secretを取得
2. **Supabase Dashboardで設定** → 認証プロバイダーに登録
3. **動作確認** → 本番環境でログインテスト
4. **セキュリティ強化** → プライバシーポリシー等を作成

---

**最終更新**: 2025-10-03
**対象環境**: Production (Vercel)
**Supabase Project**: nykfvvxvqpcxjjlsnnbx
