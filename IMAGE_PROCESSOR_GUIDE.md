# 📸 画像処理サービス 使い方ガイド

**サービスURL**: http://localhost:3002
**ステータス**: ✅ 起動中

---

## 📋 利用可能なエンドポイント

### 1. ヘルスチェック（認証不要）

**URL**: `GET /health`

**例**:
```bash
curl http://localhost:3002/health
```

**レスポンス**:
```json
{
  "status": "healthy",
  "service": "image-processor",
  "version": "1.0.0",
  "uptime": 123.45
}
```

---

### 2. 画像リサイズ（認証必要）

**URL**: `POST /api/images/resize`

**パラメータ**:
- `image`: 画像ファイル（必須）
- `width`: 幅（ピクセル）
- `height`: 高さ（ピクセル）
- `quality`: 品質（1-100、デフォルト: 80）
- `format`: 出力形式（jpeg, png, webp）

**例**:
```bash
curl -X POST http://localhost:3002/api/images/resize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@photo.jpg" \
  -F "width=800" \
  -F "height=600" \
  -F "quality=85" \
  -F "format=jpeg"
```

---

### 3. 画像圧縮（認証必要）

**URL**: `POST /api/images/compress`

**パラメータ**:
- `image`: 画像ファイル（必須）
- `quality`: 圧縮品質（1-100、デフォルト: 70）
- `format`: 出力形式（jpeg, png, webp）

**例**:
```bash
curl -X POST http://localhost:3002/api/images/compress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@photo.jpg" \
  -F "quality=70"
```

---

### 4. 透かし追加（認証必要）

**URL**: `POST /api/images/watermark`

**パラメータ**:
- `image`: 画像ファイル（必須）
- `text`: 透かしテキスト（デフォルト: "PhotoRank"）
- `position`: 位置（bottom-right, top-left, 等）
- `opacity`: 不透明度（0-1、デフォルト: 0.5）
- `fontSize`: フォントサイズ（デフォルト: 48）
- `color`: 色（デフォルト: #ffffff）

**例**:
```bash
curl -X POST http://localhost:3002/api/images/watermark \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@photo.jpg" \
  -F "text=© PhotoRank 2025" \
  -F "position=bottom-right" \
  -F "opacity=0.6"
```

---

### 5. 画像形式変換（認証必要）

**URL**: `POST /api/images/convert`

**パラメータ**:
- `image`: 画像ファイル（必須）
- `format`: 出力形式（jpeg, png, webp, avif）
- `quality`: 品質（1-100、デフォルト: 80）

**例**:
```bash
curl -X POST http://localhost:3002/api/images/convert \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@photo.png" \
  -F "format=webp" \
  -F "quality=85"
```

---

### 6. 画像メタデータ取得（認証必要）

**URL**: `POST /api/images/metadata`

**パラメータ**:
- `image`: 画像ファイル（必須）

**例**:
```bash
curl -X POST http://localhost:3002/api/images/metadata \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@photo.jpg"
```

**レスポンス**:
```json
{
  "width": 1920,
  "height": 1080,
  "format": "jpeg",
  "size": 245678,
  "channels": 3,
  "hasAlpha": false,
  "colorspace": "srgb"
}
```

---

## 🔐 認証について

### JWT トークンの取得

画像処理サービスは JWT 認証を使用します。

**ローカル開発用の簡易トークン生成**:
```bash
# JWT_SECRET を使用してトークンを生成
# 現在の JWT_SECRET: local_dev_jwt_secret_key_minimum_32_characters_required_for_security
```

**Node.jsでトークン生成例**:
```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: 'test-user-id' },
  'local_dev_jwt_secret_key_minimum_32_characters_required_for_security',
  { expiresIn: '24h' }
);

console.log('Token:', token);
```

---

## 📊 サポートされる画像形式

### 入力形式
- JPEG / JPG
- PNG
- WebP
- AVIF

### 出力形式
- JPEG / JPG
- PNG
- WebP
- AVIF（convertのみ）

---

## ⚙️ 設定

### 現在の設定

- **ポート**: 3002
- **最大ファイルサイズ**: 50MB
- **最大画像サイズ**: 4000 x 4000ピクセル
- **デフォルト品質**: 80
- **レート制限**: 100リクエスト/時間
- **CORS 許可オリジン**:
  - http://localhost:3000
  - http://localhost:3001
  - http://127.0.0.1:3000
  - http://127.0.0.1:3001

### 設定ファイル

`services/image-processor/.env` で変更可能

---

## 🐛 トラブルシューティング

### エラー: "Missing or invalid Authorization header"

**原因**: JWT トークンが提供されていない

**対処**: `Authorization: Bearer <token>` ヘッダーを追加

---

### エラー: "Invalid file type"

**原因**: サポートされていない画像形式

**対処**: JPEG, PNG, WebP, AVIF のいずれかを使用

---

### エラー: "File too large"

**原因**: ファイルサイズが50MBを超えている

**対処**: 画像を圧縮するか、`.env` の `MAX_FILE_SIZE` を変更

---

## 🔄 サービスの再起動

```bash
# プロセスを停止
pkill -f "node src/server.js"

# 再起動
cd /Users/yutasakka/aiprint2_codex/photo-rank/services/image-processor
PORT=3002 node src/server.js &
```

---

## ✅ 次のステップ

1. **Reactアプリからの利用**:
   - `vite.config.ts` の proxy 設定を確認
   - 画像アップロード機能の実装

2. **本番環境への展開**:
   - Docker コンテナ化
   - 環境変数の本番設定
   - HTTPS 有効化

3. **セキュリティ強化**:
   - JWT トークンの適切な管理
   - レート制限の調整
   - アクセスログの監視

---

**サービスステータス**: ✅ 正常稼働中（ポート3002）
**最終更新**: 2025-10-03
