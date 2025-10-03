# 🔐 Google認証 手動テストガイド

**作成日**: 2025-10-03
**開発サーバー**: http://localhost:3000

---

## ⚠️ 現在の状況

### 環境設定
- **ローカル環境**: Supabase Local (`http://127.0.0.1:54321`)
- **Google OAuth**: ローカル環境では動作しない可能性が高い

### Google認証の制限

**ローカルSupabaseの制約**:
1. Google OAuthはローカルSupabaseでは完全にはサポートされていない
2. 認証プロバイダー設定はリモートSupabaseが必要
3. `localhost` は Google の Redirect URI として登録が必要

---

## 🚀 テスト方法（推奨）

### オプション1: 本番Supabaseでテスト（推奨）

**手順**:
1. `.env.local` を一時的に本番設定に変更
   ```env
   VITE_SUPABASE_URL=https://ywwgqzgtlipqywjdxqtj.supabase.co
   VITE_SUPABASE_ANON_KEY=<本番anonキー>
   ```

2. 開発サーバーを再起動
   ```bash
   npm run dev
   ```

3. ブラウザで http://localhost:3000 にアクセス

4. 「新規登録」→「Googleで登録」をクリック

5. Google認証画面が表示されることを確認

---

### オプション2: デプロイ環境でテスト

**Vercel/Netlify等にデプロイ後**:
1. 本番URLにアクセス
2. Google認証をテスト
3. Supabase Dashboard でユーザー作成を確認

---

## 📋 テスト手順（本番Supabase使用時）

### 1. Supabase Dashboard 確認

**URL**: https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj/auth/providers

**確認項目**:
- [x] Google Provider が「Enabled」か
- [x] Client ID が設定されているか
- [x] Client Secret が設定されているか

**もし未設定の場合**:
```
1. Google Cloud Console (https://console.cloud.google.com/)
2. 「APIs & Services」→「Credentials」
3. OAuth 2.0 Client ID を作成
4. Authorized redirect URIs に追加:
   - https://ywwgqzgtlipqywjdxqtj.supabase.co/auth/v1/callback
   - http://localhost:3000/auth/callback (開発用)
5. Client ID と Client Secret をコピー
6. Supabase Dashboard に貼り付け
```

---

### 2. 新規登録テスト

**操作手順**:
```
1. http://localhost:3000 にアクセス
2. 「新規登録」ボタンをクリック
3. ユーザータイプ選択:
   - 一般ユーザー（general）
   - クリエイター（creator）
   - 工場（factory）
   - オーガナイザー（organizer）
4. 「Googleで登録」ボタンをクリック
5. Google認証画面でアカウント選択
6. 「許可」をクリック
7. アプリにリダイレクトされる
```

**期待される動作**:
- ✅ Google OAuth 認証画面が表示される
- ✅ 認証成功後、`/auth/callback?code=...` にリダイレクト
- ✅ 自動的にトップページまたは元の画面に移動
- ✅ ログイン状態になっている

**確認方法**:
```javascript
// ブラウザコンソールで実行
const { data: { user } } = await supabase.auth.getUser()
console.log('Logged in user:', user)
```

---

### 3. データベース確認

**Supabase Dashboard**:
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj/editor
```

**確認クエリ**:
```sql
-- 最新ユーザー確認
SELECT * FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- プロフィール確認
SELECT * FROM user_profiles
WHERE user_id = '<新規作成されたユーザーID>';

-- ロール確認
SELECT * FROM user_roles
WHERE user_id = '<新規作成されたユーザーID>';
```

**期待される結果**:
- ✅ `auth.users` に新規ユーザーが作成されている
- ✅ `user_profiles` にプロフィールが作成されている
- ✅ `user_roles` に選択したロールが設定されている（general以外）

---

### 4. ログインテスト

**操作手順**:
```
1. ログアウト（ユーザーアイコン → 「ログアウト」）
2. 「ログイン」ボタンをクリック
3. ユーザータイプ選択（前回と同じまたは異なる）
4. 「Googleでログイン」ボタンをクリック
5. Google認証画面でアカウント選択
6. アプリにリダイレクトされる
```

**期待される動作**:
- ✅ 既存アカウントで認証される
- ✅ プロフィール情報が読み込まれる
- ✅ ログイン状態が維持される

---

## 🐛 トラブルシューティング

### エラー: "OAuth callback error"

**原因**: ローカルSupabaseを使用している

**対処**:
```
1. .env.local を本番Supabase設定に変更
2. 開発サーバーを再起動
3. 再度テスト
```

---

### エラー: "Invalid redirect URI"

**原因**: Google Cloud Console で Redirect URI が未登録

**対処**:
```
1. Google Cloud Console にアクセス
2. OAuth 2.0 クライアントID を選択
3. 承認済みのリダイレクトURI に追加:
   - http://localhost:3000/auth/callback
   - https://ywwgqzgtlipqywjdxqtj.supabase.co/auth/v1/callback
4. 保存して再度テスト
```

---

### エラー: "User profile not created"

**原因**: `user_profiles` テーブルのRLS制限

**対処**:
```sql
-- RLS確認
SELECT rowsecurity FROM pg_tables
WHERE tablename = 'user_profiles';

-- user_profiles テーブルが存在しない場合、作成
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id),
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ポリシー追加
CREATE POLICY user_profiles_own ON user_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## 📊 テスト結果記録

### 新規登録テスト

| 項目 | 結果 | メモ |
|------|------|------|
| Google認証画面表示 | ⬜ | |
| アカウント選択可能 | ⬜ | |
| 認証成功 | ⬜ | |
| コールバック処理 | ⬜ | |
| プロフィール作成 | ⬜ | |
| ロール設定 | ⬜ | |
| リダイレクト | ⬜ | |

### ログインテスト

| 項目 | 結果 | メモ |
|------|------|------|
| Google認証画面表示 | ⬜ | |
| 既存アカウント認識 | ⬜ | |
| 認証成功 | ⬜ | |
| プロフィール読み込み | ⬜ | |
| ロール更新 | ⬜ | |
| セッション維持 | ⬜ | |

---

## 🎯 次のステップ

### 成功時
1. ✅ テスト結果を記録
2. ✅ 本番環境でも同様にテスト
3. ✅ エラーハンドリングの改善

### 失敗時
1. ❌ エラーログを確認
2. ❌ Supabase設定を再確認
3. ❌ Google Cloud Console設定を確認
4. ❌ コードのデバッグ

---

**現在の環境**: ローカルSupabase（Google OAuth非対応）
**推奨アクション**: 本番Supabase設定に切り替えてテスト
