const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous'
  });

  // Multerエラー処理
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      details: 'Maximum file size is 50MB',
      code: 'FILE_TOO_LARGE'
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files',
      details: 'Only one file can be uploaded at a time',
      code: 'TOO_MANY_FILES'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      details: 'File field name does not match expected field',
      code: 'UNEXPECTED_FILE_FIELD'
    });
  }

  // 画像処理関連エラー
  if (err.message && err.message.includes('Input file contains unsupported image format')) {
    return res.status(400).json({
      error: 'Unsupported image format',
      details: 'The uploaded file is not a valid image or uses an unsupported format',
      code: 'UNSUPPORTED_IMAGE_FORMAT'
    });
  }

  if (err.message && err.message.includes('Input buffer contains unsupported image format')) {
    return res.status(400).json({
      error: 'Invalid image data',
      details: 'The image data is corrupted or not a valid image',
      code: 'INVALID_IMAGE_DATA'
    });
  }

  // Sharp関連エラー
  if (err.message && err.message.includes('Expected positive integer')) {
    return res.status(400).json({
      error: 'Invalid dimensions',
      details: 'Width and height must be positive integers',
      code: 'INVALID_DIMENSIONS'
    });
  }

  // MIME type検証エラー
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      details: err.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  // JWT認証エラー
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid authentication token',
      details: 'The provided token is malformed or invalid',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication token expired',
      details: 'Please refresh your authentication token',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Rate limiting エラー
  if (err.status === 429 || err.message.includes('Too many requests')) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      details: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.retryAfter || 3600
    });
  }

  // バリデーションエラー
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // 権限エラー
  if (err.status === 403 || err.message.includes('Forbidden')) {
    return res.status(403).json({
      error: 'Access forbidden',
      details: 'You do not have permission to access this resource',
      code: 'ACCESS_FORBIDDEN'
    });
  }

  // ネットワーク/サービスエラー
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service unavailable',
      details: 'External service is temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  // タイムアウトエラー
  if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
    return res.status(504).json({
      error: 'Request timeout',
      details: 'The request took too long to process',
      code: 'REQUEST_TIMEOUT'
    });
  }

  // メモリ不足エラー
  if (err.message && err.message.includes('Cannot allocate memory')) {
    return res.status(507).json({
      error: 'Insufficient storage',
      details: 'Server is temporarily unable to process large images',
      code: 'INSUFFICIENT_STORAGE'
    });
  }

  // SyntaxError (通常はJSON解析エラー)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      details: 'Request body contains invalid JSON',
      code: 'INVALID_JSON'
    });
  }

  // 開発環境でのみスタックトレースを含める
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // デフォルトの内部サーバーエラー
  res.status(err.status || 500).json({
    error: 'Internal server error',
    details: isDevelopment ? err.message : 'An unexpected error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { stack: err.stack }),
    requestId: req.headers['x-request-id'] || 'unknown',
    timestamp: new Date().toISOString()
  });
};

// 404エラーハンドラー
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    details: `The requested endpoint ${req.method} ${req.url} was not found`,
    code: 'NOT_FOUND',
    availableEndpoints: [
      'POST /api/images/resize',
      'POST /api/images/compress', 
      'POST /api/images/watermark',
      'POST /api/images/convert',
      'POST /api/images/metadata',
      'GET /health'
    ]
  });
};

// 非同期エラーキャッチャー
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};