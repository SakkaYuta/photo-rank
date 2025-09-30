const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Multer設定（メモリストレージ使用）
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB制限
    files: 1 // 1ファイルのみ
  },
  fileFilter: (req, file, cb) => {
    // MIME type validation
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, GIF, and SVG are allowed.'), false);
    }
  }
});

// 画像リサイズエンドポイント
router.post('/resize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { width, height, quality = 80, format = 'jpeg' } = req.body;

    if (!width && !height) {
      return res.status(400).json({ error: 'Width or height must be specified' });
    }

    let sharpInstance = sharp(req.file.buffer);
    
    // リサイズ設定
    const resizeOptions = {};
    if (width) resizeOptions.width = parseInt(width);
    if (height) resizeOptions.height = parseInt(height);
    
    sharpInstance = sharpInstance.resize(resizeOptions);

    // フォーマット変換
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality: parseInt(quality) });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality: parseInt(quality) });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: parseInt(quality) });
        break;
      default:
        return res.status(400).json({ error: 'Unsupported output format' });
    }

    const processedImage = await sharpInstance.toBuffer();
    
    res.set({
      'Content-Type': `image/${format}`,
      'Content-Length': processedImage.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(processedImage);

  } catch (error) {
    console.error('Image resize error:', error);
    res.status(500).json({ 
      error: 'Image processing failed',
      details: error.message 
    });
  }
});

// 画像圧縮エンドポイント
router.post('/compress', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { quality = 70, format } = req.body;
    
    let sharpInstance = sharp(req.file.buffer);
    const metadata = await sharpInstance.metadata();
    
    // 元の形式を維持（format指定がない場合）
    const outputFormat = format || metadata.format;

    switch (outputFormat.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ 
          quality: parseInt(quality),
          mozjpeg: true // より良い圧縮
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ 
          quality: parseInt(quality),
          compressionLevel: 9
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ 
          quality: parseInt(quality),
          effort: 6 // 高品質圧縮
        });
        break;
      default:
        return res.status(400).json({ error: 'Unsupported format for compression' });
    }

    const compressedImage = await sharpInstance.toBuffer();
    
    res.set({
      'Content-Type': `image/${outputFormat}`,
      'Content-Length': compressedImage.length,
      'X-Original-Size': req.file.size,
      'X-Compressed-Size': compressedImage.length,
      'X-Compression-Ratio': ((1 - compressedImage.length / req.file.size) * 100).toFixed(2) + '%'
    });

    res.send(compressedImage);

  } catch (error) {
    console.error('Image compression error:', error);
    res.status(500).json({ 
      error: 'Image compression failed',
      details: error.message 
    });
  }
});

// 透かし追加エンドポイント
router.post('/watermark', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { 
      text = 'PhotoRank', 
      position = 'bottom-right',
      opacity = 0.5,
      fontSize = 48,
      color = '#ffffff'
    } = req.body;

    const image = sharp(req.file.buffer);
    const metadata = await image.metadata();

    // SVG透かしテキストを生成
    const watermarkSvg = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <text 
          x="${position.includes('right') ? metadata.width - 20 : 20}" 
          y="${position.includes('bottom') ? metadata.height - 20 : 50}"
          font-family="Arial" 
          font-size="${fontSize}" 
          fill="${color}" 
          opacity="${opacity}"
          text-anchor="${position.includes('right') ? 'end' : 'start'}"
        >${text}</text>
      </svg>
    `;

    const watermarkBuffer = Buffer.from(watermarkSvg);
    
    const watermarkedImage = await image
      .composite([{ input: watermarkBuffer, top: 0, left: 0 }])
      .toBuffer();

    res.set({
      'Content-Type': `image/${metadata.format}`,
      'Content-Length': watermarkedImage.length
    });

    res.send(watermarkedImage);

  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ 
      error: 'Watermark processing failed',
      details: error.message 
    });
  }
});

// 画像形式変換エンドポイント
router.post('/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { format, quality = 80 } = req.body;

    if (!format) {
      return res.status(400).json({ error: 'Output format must be specified' });
    }

    let sharpInstance = sharp(req.file.buffer);

    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality: parseInt(quality) });
        break;
      case 'png':
        sharpInstance = sharpInstance.png();
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: parseInt(quality) });
        break;
      case 'avif':
        sharpInstance = sharpInstance.avif({ quality: parseInt(quality) });
        break;
      default:
        return res.status(400).json({ error: 'Unsupported output format' });
    }

    const convertedImage = await sharpInstance.toBuffer();
    
    res.set({
      'Content-Type': `image/${format}`,
      'Content-Length': convertedImage.length
    });

    res.send(convertedImage);

  } catch (error) {
    console.error('Format conversion error:', error);
    res.status(500).json({ 
      error: 'Format conversion failed',
      details: error.message 
    });
  }
});

// 画像メタデータ取得エンドポイント
router.post('/metadata', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const image = sharp(req.file.buffer);
    const metadata = await image.metadata();
    
    res.json({
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: req.file.size,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      colorspace: metadata.space,
      density: metadata.density,
      hasProfile: metadata.hasProfile
    });

  } catch (error) {
    console.error('Metadata extraction error:', error);
    res.status(500).json({ 
      error: 'Metadata extraction failed',
      details: error.message 
    });
  }
});

module.exports = router;
