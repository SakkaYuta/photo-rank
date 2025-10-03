# 🔐 Google認証テスト計画

**作成日**: 2025-10-03
**目的**: Google OAuth 新規登録とログインの動作確認

---

## 📋 前提条件チェック

### 1. Supabase設定確認

**Supabase Dashboard**:
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj/auth/providers
```

**確認項目**:
- ✅ Google OAuth が有効化されているか
- ✅ Client ID が設定されているか
- ✅ Client Secret が設定されているか
- ✅ Authorized redirect URIs に本番URLが登録されているか

**必要な設定**:
```
Authorized redirect URIs:
- https://ywwgqzgtlipqywjdxqtj.supabase.co/auth/v1/callback
- http://localhost:5173/auth/callback （開発環境）
```

---

### 2. アプリケーション設定確認

**環境変数（本番環境）**:
```env
VITE_SUPABASE_URL=https://ywwgqzgtlipqywjdxqtj.supabase.co
VITE_SUPABASE_ANON_KEY=<本番anonキー>
```

**現在の設定（ローカル）**:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ローカルキー>
```

⚠️ **本番テストには本番環境変数が必要**

---

## 🧪 テストシナリオ

### シナリオ1: 新規登録（Googleアカウント）

**手順**:
1. アプリケーションにアクセス
2. 「新規登録」ボタンをクリック
3. ユーザータイプを選択（general/creator/factory/organizer）
4. 「Googleで登録」ボタンをクリック
5. Google認証画面でアカウントを選択
6. 権限確認画面で「許可」をクリック
7. `/auth/callback` にリダイレクト
8. プロフィール設定完了
9. トップページまたは元の画面にリダイレクト

**期待される動作**:
- ✅ Google認証画面が表示される
- ✅ 認証成功後、`/auth/callback?code=...` にリダイレクト
- ✅ `user_profiles` テーブルに新規ユーザーが作成される
- ✅ `user_roles` テーブルに選択したロールが追加される（general以外）
- ✅ 認証状態が維持される

**データベース確認**:
```sql
-- 新規ユーザー確認
SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- プロフィール確認
SELECT * FROM user_profiles WHERE user_id = '<新規ユーザーID>';

-- ロール確認
SELECT * FROM user_roles WHERE user_id = '<新規ユーザーID>';
```

---

### シナリオ2: ログイン（既存Googleアカウント）

**手順**:
1. アプリケーションにアクセス
2. 「ログイン」ボタンをクリック
3. ユーザータイプを選択
4. 「Googleでログイン」ボタンをクリック
5. Google認証画面でアカウントを選択
6. `/auth/callback` にリダイレクト
7. トップページまたは元の画面にリダイレクト

**期待される動作**:
- ✅ Google認証画面が表示される
- ✅ 認証成功後、自動的にログイン
- ✅ 既存の `user_profiles` が読み込まれる
- ✅ ロールが更新される（ユーザータイプ選択時）
- ✅ 認証状態が維持される

---

### シナリオ3: ログアウト → 再ログイン

**手順**:
1. ログイン済み状態
2. 「ログアウト」をクリック
3. 認証状態がクリアされる
4. 「ログイン」から再度Googleログイン

**期待される動作**:
- ✅ ログアウト後、認証状態がクリアされる
- ✅ 再ログイン時、セッションが復元される
- ✅ プロフィール情報が保持されている

---

## 🔍 デバッグポイント

### ブラウザコンソール確認

**チェック項目**:
```javascript
// 認証状態確認
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)

// セッション確認
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)

// ローカルストレージ確認
console.log('pendingUserType:', localStorage.getItem('pendingUserType'))
console.log('postLoginRedirect:', localStorage.getItem('postLoginRedirect'))
```

---

### ネットワークタブ確認

**確認項目**:
1. `/auth/v1/authorize?...` - Google OAuth開始
2. `https://accounts.google.com/...` - Google認証画面
3. `/auth/callback?code=...` - 認証コールバック
4. `/auth/v1/token` - トークン交換
5. `/rest/v1/user_profiles` - プロフィール作成/取得
6. `/rest/v1/user_roles` - ロール設定

---

## 🐛 よくあるエラーと対処

### エラー1: "OAuth callback error"

**原因**:
- Supabase Dashboard で Google OAuth が無効
- Client ID/Secret が未設定
- Redirect URI が登録されていない

**対処**:
```
1. Supabase Dashboard → Authentication → Providers → Google
2. Enabled をオン
3. Client ID と Client Secret を入力
4. Redirect URIs を確認
```

---

### エラー2: "User not found"

**原因**:
- `user_profiles` テーブルにレコードが作成されていない
- RLSポリシーでアクセスが拒否されている

**対処**:
```sql
-- RLS確認
SELECT rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';

-- ポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- 手動でプロフィール作成
INSERT INTO user_profiles (user_id, display_name)
VALUES ('<user_id>', '<display_name>');
```

---

### エラー3: "Invalid redirect URI"

**原因**:
- Google Cloud Console で Redirect URI が登録されていない
- URL のプロトコル（http/https）が一致していない

**対処**:
```
1. Google Cloud Console にアクセス
2. OAuth 2.0 クライアントID の設定
3. 承認済みのリダイレクトURI に追加:
   - https://ywwgqzgtlipqywjdxqtj.supabase.co/auth/v1/callback
   - http://localhost:5173/auth/callback
```

---

### エラー4: "PKCE flow failed"

**原因**:
- コールバックURLのcode パラメータが取得できない
- セッションストレージが無効

**対処**:
```javascript
// PKCE フロー強制
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    flowType: 'pkce'  // 必須
  }
})
```

---

## 📝 テスト実行チェックリスト

### 準備
- [ ] Supabase Dashboard で Google OAuth 有効化確認
- [ ] 本番環境変数の設定確認
- [ ] アプリケーションビルド（`npm run build`）
- [ ] 開発サーバー起動（`npm run dev`）

### 新規登録テスト
- [ ] 「新規登録」画面が表示される
- [ ] ユーザータイプ選択（4種類）
- [ ] 「Googleで登録」ボタンクリック
- [ ] Google認証画面が表示される
- [ ] アカウント選択が可能
- [ ] 権限確認画面で「許可」
- [ ] `/auth/callback` にリダイレクト
- [ ] プロフィール自動作成
- [ ] ロール自動設定
- [ ] トップページにリダイレクト
- [ ] ログイン状態が維持される

### ログインテスト
- [ ] 「ログイン」画面が表示される
- [ ] ユーザータイプ選択
- [ ] 「Googleでログイン」ボタンクリック
- [ ] Google認証画面が表示される
- [ ] 既存アカウントでログイン
- [ ] プロフィール読み込み成功
- [ ] ロール更新成功
- [ ] トップページにリダイレクト

### ログアウト・再ログインテスト
- [ ] 「ログアウト」ボタンクリック
- [ ] 認証状態がクリア
- [ ] 「ログイン」から再度ログイン
- [ ] セッション復元成功
- [ ] プロフィール保持確認

### データベース確認
- [ ] `auth.users` に新規ユーザー作成
- [ ] `user_profiles` にプロフィール作成
- [ ] `user_roles` にロール設定
- [ ] RLSポリシーが正常動作

---

## 🚀 本番環境テスト

### 本番URLでのテスト

**URL**: `https://<your-domain>.com` または Vercel/Netlify URL

**手順**:
1. 本番環境にデプロイ
2. 本番URLにアクセス
3. Google認証テスト実施
4. データベース確認（Supabase Dashboard）

**注意事項**:
- ✅ 本番環境変数が正しく設定されているか
- ✅ Redirect URI が本番URLに設定されているか
- ✅ HTTPSが有効か（必須）

---

## 📊 期待される結果

### 成功時
```
✅ Google認証画面が正常に表示される
✅ 認証後、自動的にコールバック処理される
✅ user_profiles にプロフィールが作成される
✅ user_roles にロールが設定される
✅ 認証状態が維持される
✅ リダイレクトが正常に動作する
```

### 失敗時
```
❌ エラーメッセージが表示される
❌ コールバック処理が失敗する
❌ プロフィールが作成されない
❌ 認証状態が維持されない
```

---

**ステータス**: テスト準備完了
**推奨**: 本番環境変数設定後にテスト実施
