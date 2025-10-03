# 🔐 Google認証設定ガイド

**作成日**: 2025-10-03
**目的**: ローカルSupabaseでGoogle OAuth認証を有効化

---

## Google Cloud Console 設定

### 1. Google Cloud Console にアクセス

```
https://console.cloud.google.com/
```

### 2. プロジェクト作成（新規の場合）

1. 左上の「プロジェクトを選択」をクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `photo-rank-auth`）
4. 「作成」をクリック

### 3. OAuth 同意画面の設定

**ナビゲーション**:
```
APIs & Services → OAuth consent screen
```

**設定項目**:
1. **User Type**: External を選択
2. **アプリ名**: `Photo Rank` または任意の名前
3. **ユーザーサポートメール**: 自分のメールアドレス
4. **デベロッパーの連絡先情報**: 自分のメールアドレス
5. 「保存して次へ」をクリック
6. スコープは追加不要
7. テストユーザーに自分のGoogleアカウントを追加（開発用）

### 4. OAuth 2.0 クライアント ID の作成

**ナビゲーション**:
```
APIs & Services → Credentials → CREATE CREDENTIALS → OAuth client ID
```

**設定項目**:
1. **アプリケーションの種類**: ウェブ アプリケーション
2. **名前**: `Photo Rank Local Dev`
3. **承認済みの JavaScript 生成元**:
   ```
   http://localhost:3000
   http://localhost:3001
   http://127.0.0.1:3000
   http://127.0.0.1:3001
   ```

4. **承認済みのリダイレクト URI**:
   ```
   http://127.0.0.1:54321/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   http://localhost:3000/auth/callback
   http://localhost:3001/auth/callback
   ```

5. 「作成」をクリック

### 5. クライアント ID とシークレットをコピー

作成後に表示されるモーダルから:
- **クライアント ID**: `123456789-abc...apps.googleusercontent.com` 形式
- **クライアント シークレット**: `GOCSPX-...` 形式

これらをメモまたはコピーしておく

---

## ローカル環境変数の設定

### 1. Supabase 環境変数ファイル作成

**ファイルパス**: `supabase/.env.local`

**内容**:
```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# Optional: Other auth providers
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
```

### 2. 環境変数を反映

```bash
# Supabaseを再起動
npx supabase stop
npx supabase start
```

---

## 設定確認

### 1. Supabaseステータス確認

```bash
npx supabase status
```

**期待される出力**:
```
✅ GOOGLE_CLIENT_ID が設定されている
✅ GOOGLE_CLIENT_SECRET が設定されている
```

### 2. 開発サーバー起動

```bash
npm run dev
```

### 3. ブラウザでアクセス

```
http://localhost:3001/
```

---

## テスト手順

### 新規登録テスト

1. **「新規登録」ボタンをクリック**
2. **ユーザータイプを選択** (general, creator, factory, organizer)
3. **「Googleで登録」ボタンをクリック**
4. **Google認証画面が表示される**
   - ✅ 成功: Google アカウント選択画面が表示
   - ❌ 失敗: エラーメッセージが表示される

5. **アカウントを選択**
6. **権限確認画面で「許可」をクリック**
7. **リダイレクト確認**
   - `/auth/callback?code=...` にリダイレクト
   - 自動的にトップページに移動
   - ログイン状態になっている

### ブラウザコンソールで確認

**F12キーでコンソールを開く**

```javascript
// Supabaseクライアント取得
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
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

## トラブルシューティング

### エラー: "OAuth callback error"

**原因**: Google Cloud Console の設定が不完全

**確認項目**:
1. OAuth 同意画面が設定されているか
2. 承認済みのリダイレクトURIに以下が登録されているか:
   - `http://127.0.0.1:54321/auth/v1/callback`
   - `http://localhost:54321/auth/v1/callback`
3. クライアントIDとシークレットが正しいか

### エラー: "Invalid redirect URI"

**原因**: リダイレクトURIが登録されていない

**対処**:
Google Cloud Console → OAuth 2.0 クライアント → 承認済みのリダイレクトURI に追加:
```
http://127.0.0.1:54321/auth/v1/callback
http://localhost:54321/auth/v1/callback
```

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

## 次のステップ

### 設定完了後
1. ✅ Google Cloud Console で OAuth クライアント ID を作成
2. ✅ `supabase/.env.local` に環境変数を設定
3. ✅ Supabase を再起動
4. ✅ 開発サーバーを起動
5. ✅ ブラウザでGoogle認証テスト

### テスト成功後
1. ✅ 他のユーザータイプでもテスト
2. ✅ ログアウト → 再ログインをテスト
3. ✅ データベースでユーザー作成を確認

---

**現在の状態**: Google OAuth 設定待ち
**次のアクション**: Google Cloud Console でクライアント ID/シークレットを取得して `supabase/.env.local` に設定
