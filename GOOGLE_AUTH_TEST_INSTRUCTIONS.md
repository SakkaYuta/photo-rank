# 🔐 Google認証テスト実施手順

**作成日**: 2025-10-03
**開発サーバー**: http://localhost:3001/
**Supabase**: 本番環境 (ywwgqzgtlipqywjdxqtj)

---

## ✅ 準備完了

### 環境設定
- ✅ 本番Supabaseに接続設定完了
- ✅ 開発サーバー起動完了 (http://localhost:3001/)
- ✅ Google OAuth設定済み（Supabase Dashboard）

---

## 📋 テスト手順

### ステップ1: アプリケーションにアクセス

**ブラウザで開く**:
```
http://localhost:3001/
```

---

### ステップ2: 新規登録テスト

1. **「新規登録」ボタンをクリック**

2. **ユーザータイプを選択**:
   - 一般ユーザー（general）
   - クリエイター（creator）
   - 工場（factory）
   - オーガナイザー（organizer）

3. **「Googleで登録」ボタンをクリック**

4. **Google認証画面で**:
   - アカウントを選択
   - 「許可」をクリック

5. **認証後の動作確認**:
   - `/auth/callback?code=...` にリダイレクト
   - 自動的にトップページに移動
   - ログイン状態になっている

---

### ステップ3: ブラウザコンソールで確認

**F12キーを押してコンソールを開く**

**ユーザー情報確認**:
```javascript
// Supabaseクライアント取得
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  'https://ywwgqzgtlipqywjdxqtj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3d2dxemd0bGlwcXl3amR4cXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc4NTQyMTgsImV4cCI6MjA0MzQzMDIxOH0.yCTiHVk0kTEqo3rJ0FRvXF5g0VqWZ4YqKXm2UoKjP74'
)

// 現在のユーザー確認
const { data: { user } } = await supabase.auth.getUser()
console.log('Logged in user:', user)

// セッション確認
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
```

**期待される出力**:
```javascript
{
  id: "uuid",
  email: "your-email@gmail.com",
  user_metadata: {
    avatar_url: "...",
    email: "...",
    email_verified: true,
    full_name: "...",
    iss: "https://accounts.google.com",
    name: "...",
    picture: "...",
    provider_id: "...",
    sub: "..."
  }
}
```

---

### ステップ4: データベース確認

**Supabase Dashboard**:
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj/editor
```

**SQL Editor で実行**:
```sql
-- 最新ユーザー確認
SELECT
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- プロフィール確認
SELECT * FROM user_profiles
WHERE user_id = (
  SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1
);

-- ロール確認
SELECT * FROM user_roles
WHERE user_id = (
  SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1
);
```

**期待される結果**:
- ✅ `auth.users` に新規ユーザーが作成されている
- ✅ `user_profiles` にプロフィールが作成されている
- ✅ `user_roles` に選択したロールが設定されている（general以外）

---

### ステップ5: ログアウト → 再ログインテスト

1. **ログアウト**:
   - ユーザーアイコンをクリック
   - 「ログアウト」を選択

2. **ログイン**:
   - 「ログイン」ボタンをクリック
   - ユーザータイプを選択（同じまたは異なる）
   - 「Googleでログイン」ボタンをクリック

3. **確認**:
   - Google認証画面でアカウント選択
   - 自動的にログイン
   - プロフィール情報が保持されている

---

## 🐛 トラブルシューティング

### エラー: "OAuth callback error"

**可能性1**: Supabase Dashboard で Google OAuth が無効

**確認**:
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj/auth/providers
```
- Google Provider が「Enabled」か確認

**可能性2**: Google Cloud Console で Redirect URI が未登録

**確認**:
```
Google Cloud Console → APIs & Services → Credentials
```
- 承認済みのリダイレクトURI に以下が登録されているか:
  - `https://ywwgqzgtlipqywjdxqtj.supabase.co/auth/v1/callback`
  - `http://localhost:3001/auth/callback`

---

### エラー: "User profile not created"

**原因**: `user_profiles` テーブルが存在しないか、RLSで拒否されている

**対処**:
```sql
-- テーブル存在確認
SELECT * FROM information_schema.tables
WHERE table_name = 'user_profiles';

-- RLS確認
SELECT rowsecurity FROM pg_tables
WHERE tablename = 'user_profiles';

-- ポリシー確認
SELECT * FROM pg_policies
WHERE tablename = 'user_profiles';
```

---

### エラー: "Invalid redirect URI"

**原因**: ポート番号が異なる（3000 vs 3001）

**対処**:
Google Cloud Console で以下も追加:
- `http://localhost:3001/auth/callback`
- `http://localhost:3000/auth/callback`

---

## ✅ テスト成功の確認項目

### 新規登録
- [ ] Google認証画面が表示される
- [ ] アカウント選択が可能
- [ ] 権限確認画面で「許可」をクリック
- [ ] `/auth/callback?code=...` にリダイレクト
- [ ] トップページに自動的に移動
- [ ] ログイン状態になっている
- [ ] ブラウザコンソールでユーザー情報確認可能
- [ ] `auth.users` にユーザー作成
- [ ] `user_profiles` にプロフィール作成
- [ ] `user_roles` にロール設定（general以外）

### ログイン
- [ ] Google認証画面が表示される
- [ ] 既存アカウントでログイン
- [ ] プロフィール情報が読み込まれる
- [ ] ログイン状態が維持される

### ログアウト・再ログイン
- [ ] ログアウト後、認証状態がクリア
- [ ] 再ログイン時、セッションが復元
- [ ] プロフィール情報が保持されている

---

## 📊 テスト結果記録

### 新規登録テスト

**テスト日時**: __________
**テスト者**: __________

| 項目 | 結果 | メモ |
|------|------|------|
| Google認証画面表示 | ⬜ | |
| アカウント選択 | ⬜ | |
| 認証成功 | ⬜ | |
| コールバック処理 | ⬜ | |
| プロフィール作成 | ⬜ | |
| ロール設定 | ⬜ | |
| リダイレクト | ⬜ | |

### ログインテスト

| 項目 | 結果 | メモ |
|------|------|------|
| Google認証画面表示 | ⬜ | |
| 既存アカウント認証 | ⬜ | |
| プロフィール読み込み | ⬜ | |
| セッション維持 | ⬜ | |

---

## 🎯 次のステップ

### テスト成功時
1. ✅ 結果を記録
2. ✅ 他のユーザータイプでもテスト
3. ✅ エラーハンドリングの改善検討

### テスト失敗時
1. ❌ エラーログをスクリーンショット
2. ❌ ブラウザコンソールのエラー確認
3. ❌ Supabase Dashboard の設定再確認
4. ❌ Google Cloud Console の設定確認

---

**現在の状態**: テスト準備完了
**開発サーバー**: http://localhost:3001/ （本番Supabase接続）
**次のアクション**: ブラウザでGoogle認証テスト実施
