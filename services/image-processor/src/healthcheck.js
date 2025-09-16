const http = require('http');
const config = require('./config/config');

const performHealthCheck = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: config.PORT,
      path: '/health',
      method: 'GET',
      timeout: config.HEALTH_CHECK.TIMEOUT || 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const healthData = JSON.parse(data);
            
            // ヘルスチェックの詳細検証
            if (healthData.status === 'healthy') {
              console.log('✅ Health check passed');
              console.log(`📊 Service: ${healthData.service}`);
              console.log(`🕐 Uptime: ${Math.round(healthData.uptime)}s`);
              console.log(`💾 Memory: RSS ${Math.round(healthData.memory.rss / 1024 / 1024)}MB`);
              resolve(true);
            } else {
              console.error('❌ Health check failed: Service not healthy');
              console.error('Response:', healthData);
              reject(new Error('Service not healthy'));
            }
          } else {
            console.error(`❌ Health check failed: HTTP ${res.statusCode}`);
            console.error('Response:', data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (parseError) {
          console.error('❌ Health check failed: Invalid response format');
          console.error('Parse error:', parseError.message);
          console.error('Response data:', data);
          reject(new Error('Invalid health check response'));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Health check failed: Connection error');
      console.error('Error:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error(`❌ Health check failed: Timeout after ${options.timeout}ms`);
      req.destroy();
      reject(new Error('Health check timeout'));
    });
    
    req.end();
  });
};

const checkDependencies = async () => {
  const dependencies = {};
  
  try {
    // Sharp ライブラリの確認
    const sharp = require('sharp');
    dependencies.sharp = {
      status: 'healthy',
      version: sharp.versions?.vips || 'unknown'
    };
  } catch (error) {
    dependencies.sharp = {
      status: 'error',
      error: error.message
    };
  }
  
  try {
    // Express の確認
    const express = require('express');
    dependencies.express = {
      status: 'healthy',
      version: process.versions?.node || 'unknown'
    };
  } catch (error) {
    dependencies.express = {
      status: 'error',
      error: error.message
    };
  }
  
  // 環境変数の確認
  dependencies.environment = {
    status: config.JWT_SECRET ? 'healthy' : 'warning',
    jwt_secret: config.JWT_SECRET ? 'configured' : 'missing',
    supabase: config.SUPABASE_URL ? 'configured' : 'not configured',
    node_env: config.NODE_ENV
  };
  
  return dependencies;
};

const runHealthCheck = async () => {
  console.log('🏥 Starting comprehensive health check...');
  
  try {
    // 依存関係チェック
    console.log('📦 Checking dependencies...');
    const dependencies = await checkDependencies();
    
    let dependencyErrors = 0;
    Object.entries(dependencies).forEach(([name, info]) => {
      if (info.status === 'error') {
        console.error(`❌ ${name}: ${info.error}`);
        dependencyErrors++;
      } else if (info.status === 'warning') {
        console.warn(`⚠️ ${name}: ${JSON.stringify(info)}`);
      } else {
        console.log(`✅ ${name}: OK`);
      }
    });
    
    if (dependencyErrors > 0) {
      console.error(`❌ ${dependencyErrors} dependency errors found`);
      process.exit(1);
    }
    
    // サーバーヘルスチェック
    console.log('🌐 Checking server health...');
    await performHealthCheck();
    
    console.log('✅ All health checks passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
};

// Docker ヘルスチェック用の簡易版
const quickHealthCheck = async () => {
  try {
    await performHealthCheck();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

// コマンドライン引数に基づいて実行モードを決定
const args = process.argv.slice(2);
if (args.includes('--quick') || process.env.DOCKER_HEALTHCHECK === 'true') {
  // Dockerヘルスチェック用の簡易版
  quickHealthCheck();
} else {
  // 完全なヘルスチェック
  runHealthCheck();
}