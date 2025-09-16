# 画像処理マイクロサービス Dockerfile
FROM node:18-alpine

# Sharp用のライブラリをインストール（Alpine Linux用）
RUN apk add --no-cache \
    vips-dev \
    pkgconfig \
    build-base \
    python3 \
    make \
    g++

# 作業ディレクトリ設定
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install --only=production && npm cache clean --force

# アプリケーションコードをコピー
COPY src/ ./src/

# 非rootユーザーを作成してセキュリティ向上
RUN addgroup -g 1001 -S nodejs && \
    adduser -S imageprocessor -u 1001

# ファイルの所有者を変更
RUN chown -R imageprocessor:nodejs /app
USER imageprocessor

# ポート公開
EXPOSE 3001

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node src/healthcheck.js

# アプリケーション起動
CMD ["npm", "start"]