// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const imageRoutes = require('./routes/imageRoutes');
const { authenticateUser } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const config = require('./config/config');

// 設定の検証とログ出力
config.validateConfig();
config.logConfig();

const app = express();

// セキュリティ設定
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS設定
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 基本ミドルウェア
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

// Rate limiting（グローバル）
const rateLimiter = new RateLimiterMemory({
  points: 100, // リクエスト数
  duration: 3600, // 1時間（秒）
});

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.round(rejRes.msBeforeNext / 1000) 
    });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'image-processor',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// API routes（認証あり）
app.use('/api', authenticateUser);
app.use('/api/images', imageRoutes);

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// エラーハンドラー
app.use(errorHandler);

// サーバー起動（テスト環境では自動起動しない）
let server;
const start = () => {
  const port = config.PORT || 3001;
  server = app.listen(port, '0.0.0.0', () => {
    console.log(`🖼️  Image Processor Service running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🌐 Environment: ${config.NODE_ENV}`);
  });
  return server;
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  if (!server) process.exit(0);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  if (!server) process.exit(0);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = { app, start };
