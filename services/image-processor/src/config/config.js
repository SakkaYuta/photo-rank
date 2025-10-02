const config = {
  // サーバー設定
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // CORS設定
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) :
    ['http://localhost:3000', 'http://localhost:3001', 'https://photo-rank.vercel.app'],
  
  // JWT認証設定
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // Supabase設定
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // API Key設定
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  
  // 画像処理設定
  IMAGE_SETTINGS: {
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    MAX_WIDTH: parseInt(process.env.MAX_WIDTH) || 4000,
    MAX_HEIGHT: parseInt(process.env.MAX_HEIGHT) || 4000,
    // Keep formats in sync with routes/imageRoutes.js fileFilter
    ALLOWED_FORMATS: ['jpeg', 'jpg', 'png', 'webp', 'avif'],
    DEFAULT_QUALITY: parseInt(process.env.DEFAULT_QUALITY) || 80,
    WATERMARK_SETTINGS: {
      DEFAULT_TEXT: process.env.WATERMARK_TEXT || 'PhotoRank',
      DEFAULT_OPACITY: parseFloat(process.env.WATERMARK_OPACITY) || 0.5,
      DEFAULT_FONT_SIZE: parseInt(process.env.WATERMARK_FONT_SIZE) || 48,
      DEFAULT_COLOR: process.env.WATERMARK_COLOR || '#ffffff'
    }
  },
  
  // Rate Limiting設定
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1時間
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    SKIP_SUCCESSFUL_REQUESTS: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    SKIP_FAILED_REQUESTS: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },
  
  // セキュリティ設定
  SECURITY: {
    ENABLE_HTTPS_ONLY: process.env.ENABLE_HTTPS_ONLY === 'true',
    CONTENT_SECURITY_POLICY: process.env.CSP_ENABLED !== 'false',
    TRUST_PROXY: process.env.TRUST_PROXY === 'true',
    HELMET_OPTIONS: {
      crossOriginResourcePolicy: { 
        policy: process.env.CORP_POLICY || 'cross-origin' 
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", process.env.SUPABASE_URL].filter(Boolean)
        }
      }
    }
  },
  
  // ログ設定
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FORMAT: process.env.LOG_FORMAT || 'combined',
    ENABLE_ACCESS_LOG: process.env.ENABLE_ACCESS_LOG !== 'false',
    ENABLE_ERROR_LOG: process.env.ENABLE_ERROR_LOG !== 'false'
  },
  
  // パフォーマンス設定
  PERFORMANCE: {
    ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION !== 'false',
    COMPRESSION_LEVEL: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    KEEP_ALIVE_TIMEOUT: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000,
    HEADERS_TIMEOUT: parseInt(process.env.HEADERS_TIMEOUT) || 60000
  },
  
  // ヘルスチェック設定
  HEALTH_CHECK: {
    TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 3000,
    INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    START_PERIOD: parseInt(process.env.HEALTH_CHECK_START_PERIOD) || 5000,
    RETRIES: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3
  },
  
  // エラー処理設定
  ERROR_HANDLING: {
    INCLUDE_STACK_TRACE: process.env.NODE_ENV === 'development',
    REPORT_ERRORS: process.env.REPORT_ERRORS === 'true',
    ERROR_WEBHOOK_URL: process.env.ERROR_WEBHOOK_URL
  }
};

// 設定検証
const validateConfig = () => {
  const errors = [];
  
  // 必須設定のチェック
  if (!config.JWT_SECRET) {
    errors.push('JWT_SECRET environment variable is required');
  }
  
  if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }
  
  if (!config.SUPABASE_URL) {
    console.warn('SUPABASE_URL not provided - Supabase integration will be disabled');
  }
  
  if (!config.SUPABASE_ANON_KEY && config.SUPABASE_URL) {
    console.warn('SUPABASE_ANON_KEY not provided - Supabase authentication will be limited');
  }
  
  // ポート番号の検証
  if (isNaN(config.PORT) || config.PORT < 1 || config.PORT > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }
  
  // 画像設定の検証
  if (config.IMAGE_SETTINGS.MAX_FILE_SIZE < 1024 * 1024) {
    console.warn('MAX_FILE_SIZE is less than 1MB - this may be too restrictive');
  }
  
  if (config.IMAGE_SETTINGS.MAX_WIDTH < 100 || config.IMAGE_SETTINGS.MAX_HEIGHT < 100) {
    errors.push('MAX_WIDTH and MAX_HEIGHT must be at least 100 pixels');
  }
  
  if (config.IMAGE_SETTINGS.DEFAULT_QUALITY < 1 || config.IMAGE_SETTINGS.DEFAULT_QUALITY > 100) {
    errors.push('DEFAULT_QUALITY must be between 1 and 100');
  }
  
  // Rate limiting設定の検証
  if (config.RATE_LIMIT.WINDOW_MS < 60000) {
    console.warn('RATE_LIMIT_WINDOW_MS is less than 1 minute - this may be too restrictive');
  }
  
  if (config.RATE_LIMIT.MAX_REQUESTS < 1) {
    errors.push('RATE_LIMIT_MAX_REQUESTS must be at least 1');
  }
  
  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Invalid configuration');
  }
  
  console.log('✅ Configuration validation passed');
  return true;
};

// 開発環境での設定表示
const logConfig = () => {
  if (config.NODE_ENV === 'development') {
    console.log('🔧 Configuration loaded:');
    console.log(`  - Environment: ${config.NODE_ENV}`);
    console.log(`  - Port: ${config.PORT}`);
    console.log(`  - Allowed Origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
    console.log(`  - JWT Secret: ${config.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Supabase URL: ${config.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Max File Size: ${Math.round(config.IMAGE_SETTINGS.MAX_FILE_SIZE / 1024 / 1024)}MB`);
    console.log(`  - Rate Limit: ${config.RATE_LIMIT.MAX_REQUESTS} requests per ${config.RATE_LIMIT.WINDOW_MS / 1000}s`);
  }
};

module.exports = {
  ...config,
  validateConfig,
  logConfig
};
