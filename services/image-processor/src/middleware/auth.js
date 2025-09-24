const jwt = require('jsonwebtoken');
const axios = require('axios');

const authenticateUser = async (req, res, next) => {
  try {
    // Authorization headerをチェック
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid Authorization header',
        details: 'Expected format: Bearer <token>' 
      });
    }

    const token = authHeader.substring(7); // "Bearer "を除去

    if (!token) {
      return res.status(401).json({ 
        error: 'Missing authentication token' 
      });
    }

    // Supabaseでユーザー検証（最優先）
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        const userResponse = await axios.get(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseKey
          },
          timeout: 5000
        });

        if (userResponse.data && userResponse.data.id) {
          req.user = {
            id: userResponse.data.id,
            email: userResponse.data.email,
            isAuthenticated: true
          };
        } else {
          return res.status(401).json({ error: 'User not found in authentication system' });
        }
      } catch (supabaseError) {
        console.error('Supabase authentication error:', supabaseError.message);
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      // Supabase設定がない場合のみ、ローカルJWT検証を許可（明示的に設定された場合）
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('Missing SUPABASE_URL/SUPABASE_ANON_KEY and JWT_SECRET');
        return res.status(500).json({ error: 'Server configuration error' });
      }
      try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = {
          id: decoded.sub || decoded.id,
          ...decoded,
          isAuthenticated: true
        };
      } catch (jwtError) {
        const message = jwtError?.name === 'TokenExpiredError'
          ? 'Token has expired'
          : 'Token verification failed';
        return res.status(401).json({ error: message });
      }
    }

    // Rate limitingのためにユーザーIDをヘッダーに追加
    req.headers['x-user-id'] = req.user.id || req.user.sub;

    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication processing failed',
      details: error.message 
    });
  }
};

// API Key認証（管理者用）
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Missing API key',
        details: 'X-API-Key header is required' 
      });
    }

    const validApiKey = process.env.ADMIN_API_KEY;
    if (!validApiKey) {
      console.error('ADMIN_API_KEY environment variable is not set');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    if (apiKey !== validApiKey) {
      return res.status(401).json({ 
        error: 'Invalid API key' 
      });
    }

    // 管理者権限をリクエストに追加
    req.user = {
      id: 'admin',
      role: 'admin',
      isAdmin: true
    };

    next();

  } catch (error) {
    console.error('API Key authentication error:', error);
    res.status(500).json({ 
      error: 'API Key authentication failed',
      details: error.message 
    });
  }
};

// オプション認証（認証があれば使用、なければ匿名）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 認証情報がない場合は匿名ユーザーとして処理
      req.user = {
        id: 'anonymous',
        role: 'anonymous',
        isAuthenticated: false
      };
      return next();
    }

    // 認証情報がある場合は通常の認証プロセスを実行
    authenticateUser(req, res, next);

  } catch (error) {
    console.error('Optional authentication error:', error);
    // エラーが発生した場合も匿名として処理を続行
    req.user = {
      id: 'anonymous',
      role: 'anonymous',
      isAuthenticated: false
    };
    next();
  }
};

module.exports = {
  authenticateUser,
  authenticateApiKey,
  optionalAuth
};
