# PhotoRank 画像処理マイクロサービス

Sharp + Express を使用した高性能画像処理 API サービスです。

## 🚀 Docker で起動

### 1. 環境変数の設定
```bash
# .env ファイルを作成
cp .env.example .env

# 必要な環境変数を設定
nano .env
```

### 2. Docker ビルド & 起動
```bash
# イメージをビルド
docker build -t image-processor .

# コンテナを起動
docker run -p 3001:3001 --env-file .env image-processor

# または docker-compose を使用
docker-compose up
```

### 3. ヘルスチェック
```bash
curl http://localhost:3001/health
```

## 📡 API エンドポイント

### 画像リサイズ
```bash
curl -X POST http://localhost:3001/api/images/resize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@your-image.jpg" \
  -F "width=800" \
  -F "height=600" \
  -F "quality=80"
```

### 画像圧縮
```bash
curl -X POST http://localhost:3001/api/images/compress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@your-image.jpg" \
  -F "quality=70"
```

### 透かし追加
```bash
curl -X POST http://localhost:3001/api/images/watermark \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@your-image.jpg" \
  -F "text=PhotoRank" \
  -F "position=bottom-right"
```

### 形式変換
```bash
curl -X POST http://localhost:3001/api/images/convert \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@your-image.jpg" \
  -F "format=webp" \
  -F "quality=80"
```

### メタデータ取得
```bash
curl -X POST http://localhost:3001/api/images/metadata \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@your-image.jpg"
```

## 🔧 設定

### 必須環境変数
- `JWT_SECRET`: JWT 署名用秘密鍵（最低32文字）
- `SUPABASE_URL`: Supabase プロジェクト URL
- `SUPABASE_ANON_KEY`: Supabase 匿名キー

### オプション設定
- `MAX_FILE_SIZE`: 最大ファイルサイズ（デフォルト: 50MB）
- `RATE_LIMIT_MAX_REQUESTS`: Rate Limit（デフォルト: 100/時間）
- `DEFAULT_QUALITY`: デフォルト画質（デフォルト: 80）

## 🛡️ セキュリティ機能

- JWT 認証
- Rate Limiting
- CORS 設定
- ファイル形式検証
- セキュリティヘッダー（Helmet）
- 非 root ユーザー実行

## 📈 監視

### ヘルスチェック
```bash
# 基本ヘルスチェック
curl http://localhost:3001/health

# 詳細ヘルスチェック
docker exec photorank-image-processor node src/healthcheck.js
```

### ログ監視
```bash
# コンテナログ
docker logs -f photorank-image-processor

# アクセスログ
docker exec photorank-image-processor tail -f /app/logs/access.log
```

## 🔧 開発

### ローカル開発
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm test
```

### Docker 開発
```bash
# 開発用 docker-compose
docker-compose -f docker-compose.dev.yml up
```