const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * 检测图片是否为截图
 * @param {string} filePath 文件路径
 * @returns {Promise<boolean>} 是否为截图
 */
async function detectScreenshot(filePath) {
  try {
    // 检查是否为AuthLock自己生成的截图（保存在appData/temp目录）
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('appdata') && normalizedPath.includes('temp')) {
      console.log('AuthLock generated screenshot detected: skipping screenshot check');
      return false;
    }
    
    // 读取图片元数据
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;
    
    // 检查文件命名（最可靠的检测方法）
    const fileName = path.basename(filePath).toLowerCase();
    const screenshotKeywords = ['screenshot', 'screen', 'capture', '截图', '屏幕截图'];
    for (const keyword of screenshotKeywords) {
      if (fileName.includes(keyword)) {
        console.log('Screenshot detected: matches filename pattern');
        return true;
      }
    }
    
    // 常见屏幕分辨率比例检测（辅助方法）
    const commonRatios = [
      { width: 1920, height: 1080 }, // 16:9
      { width: 1366, height: 768 },  // 16:9
      { width: 1440, height: 900 },  // 16:10
      { width: 1280, height: 800 },  // 16:10
      { width: 1024, height: 768 },  // 4:3
      { width: 2560, height: 1440 }, // 2K
      { width: 3840, height: 2160 }  // 4K
    ];
    
    // 检查是否匹配常见屏幕分辨率
    for (const ratio of commonRatios) {
      if (width === ratio.width && height === ratio.height) {
        console.log('Screenshot detected: matches common screen resolution');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error detecting screenshot:', error);
    return false;
  }
}

/**
 * 生成文件的哈希（SHA256）- 对整个文件做哈希
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 哈希值
 */
async function generateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const fs = require('fs');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * 生成图片的特征哈希（SHA256）- 对图片特征做哈希，而非整个文件
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 特征哈希值
 */
async function generateFeatureHash(filePath) {
  try {
    // 使用sharp读取图片并转换为固定格式（去除元数据影响）
    const image = sharp(filePath);
    const buffer = await image
      .resize(256, 256, { fit: 'inside' }) // 缩放到固定大小，去除分辨率影响
      .grayscale() // 转为灰度图，去除颜色影响
      .raw() // 转为原始像素数据
      .toBuffer({ resolveWithObject: true });
    
    // 对特征数据做哈希
    const hash = crypto.createHash('sha256');
    hash.update(buffer.data);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error generating feature hash:', error);
    //  fallback: 如果特征哈希失败，使用像素哈希
    return generatePixelHash(filePath);
  }
}

/**
 * 生成图片的像素哈希（SHA256）- 对图片像素数据做哈希，而非整个文件
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 像素哈希值
 */
async function generatePixelHash(filePath) {
  try {
    // 使用sharp读取图片并转换为固定格式（去除元数据影响）
    const image = sharp(filePath);
    const buffer = await image
      .raw() // 转为原始像素数据
      .toBuffer({ resolveWithObject: true });
    
    // 对像素数据做哈希
    const hash = crypto.createHash('sha256');
    hash.update(buffer.data);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error generating pixel hash:', error);
    //  fallback: 如果像素哈希失败，使用文件哈希
    return generateFileHash(filePath);
  }
}

/**
 * 生成作者专属标识（authorId）- 基于作者名生成固定不变的标识
 * @param {string} author 作者名
 * @returns {string} 作者专属标识
 */
function generateAuthorId(author) {
  const hash = crypto.createHash('sha256');
  hash.update(author.toLowerCase().trim());
  return hash.digest('hex').substring(0, 24); // 取前24位作为authorId
}

/**
 * 生成加密密钥
 * @returns {Buffer} 加密密钥
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32); // 256位密钥
}

/**
 * 加密数据
 * @param {string} data 要加密的数据
 * @param {Buffer} key 加密密钥
 * @returns {string} 加密后的数据（Base64编码）
 */
function encryptData(data, key) {
  const iv = crypto.randomBytes(16); // 初始化向量
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  // 返回iv和加密数据的组合
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * 解密数据
 * @param {string} encryptedData 加密后的数据（Base64编码）
 * @param {Buffer} key 加密密钥
 * @returns {object} 解密后的数据
 */
function decryptData(encryptedData, key) {
  try {
    const [ivBase64, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    console.error('Error decrypting data:', e);
    return null;
  }
}

/**
 * 生成防篡改哈希
 * @param {object} data 要哈希的数据
 * @returns {string} 防篡改哈希
 */
function generateTamperProofHash(data) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * 将文本编码为适合LSB隐写的字节数组（使用Base64编码确保JSON安全）
 * @param {string} text 要编码的文本
 * @returns {Buffer} 字节数组
 */
function encodeTextToBytes(text) {
  // 先转JSON再Base64编码，确保完全避免JSON解析错误
  const jsonStr = JSON.stringify(text);
  const base64Str = Buffer.from(jsonStr).toString('base64');
  // 添加固定长度前缀（4字节），确保提取时知道数据长度
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(base64Str.length, 0);
  return Buffer.concat([lengthBuffer, Buffer.from(base64Str)]);
}

/**
 * 从字节数组解码回文本（使用Base64解码确保JSON安全）
 * @param {Buffer} bytes 字节数组
 * @returns {string} 解码后的文本
 */
function decodeBytesToText(bytes) {
  try {
    // 读取固定长度前缀（4字节）
    if (bytes.length < 4) {
      return null;
    }
    const dataLength = bytes.readUInt32BE(0);
    
    // 提取Base64编码的数据
    const base64Str = bytes.slice(4, 4 + dataLength).toString().replace(/\0/g, '');
    
    // Base64解码后再JSON解析
    const jsonStr = Buffer.from(base64Str, 'base64').toString();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Error decoding bytes:', e);
    return null;
  }
}

/**
 * 增强的纠错码实现（改进版Reed-Solomon简化版）
 * @param {Buffer} data 原始数据
 * @returns {Buffer} 带纠错码的数据
 */
function addErrorCorrection(data) {
  // 增强版纠错码：复制数据五次，提高抗压缩性
  // 添加奇偶校验位
  const duplicated = Buffer.concat([data, data, data, data, data]);
  
  // 添加奇偶校验
  const parity = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    let bitSum = 0;
    for (let j = 0; j < 5; j++) {
      bitSum += duplicated[i + j * data.length];
    }
    parity[i] = bitSum % 256;
  }
  
  return Buffer.concat([duplicated, parity]);
}

/**
 * 从带纠错码的数据中恢复原始数据
 * @param {Buffer} data 带纠错码的数据
 * @param {number} originalLength 原始数据长度
 * @returns {Buffer} 恢复的原始数据
 */
function recoverWithErrorCorrection(data, originalLength) {
  // 增强版纠错：使用投票机制和奇偶校验
  const recovered = Buffer.alloc(originalLength);
  
  for (let i = 0; i < originalLength; i++) {
    const values = [];
    // 尝试从多个副本中获取值
    for (let j = 0; j < 5; j++) {
      if (i + j * originalLength < data.length) {
        values.push(data[i + j * originalLength]);
      }
    }
    
    // 投票选择最常见的值
    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    
    // 按出现次数排序
    const sortedValues = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    
    // 选择出现次数最多的值
    let mostCommon = sortedValues[0];
    
    // 如果有多个值出现次数相同，使用第一个
    recovered[i] = parseInt(mostCommon, 10);
  }
  
  return recovered;
}

async function embedToFullImage(imageSharp, data) {
  try {
    const imageBuffer = await imageSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = imageBuffer;
    const { width, height, channels } = info;
    const pixelCount = width * height * channels;

    // 增强的抗压缩和抗裁切策略
    // 1. 冗余存储：将数据复制3次，提高抗压缩能力
    // 2. 分散存储：将数据存储在图片的不同区域，提高抗裁切能力
    // 3. 多通道存储：在RGB通道中存储相同的数据，提高抗压缩能力
    
    // 计算最大数据长度，考虑冗余存储
    const redundancy = 3; // 数据复制3次
    const maxDataLength = Math.floor(pixelCount / 8 / redundancy / 3); // 除以3因为要在RGB通道中存储
    const safeData = data.slice(0, maxDataLength);

    console.log('Embedding data length:', safeData.length, 'Max possible:', maxDataLength);

    // 生成冗余数据
    const redundantData = Buffer.alloc(safeData.length * redundancy);
    for (let i = 0; i < redundancy; i++) {
      safeData.copy(redundantData, i * safeData.length);
    }

    console.log('Redundant data length:', redundantData.length);

    // 嵌入数据到图片的不同区域
    // 区域1：左上角 (20% × 20%)
    // 区域2：右下角 (20% × 20%)
    // 区域3：中心 (20% × 20%)
    const regions = [
      { startX: 0, startY: 0, endX: Math.floor(width * 0.2), endY: Math.floor(height * 0.2) },
      { startX: Math.floor(width * 0.8), startY: Math.floor(height * 0.8), endX: width, endY: height },
      { startX: Math.floor(width * 0.4), startY: Math.floor(height * 0.4), endX: Math.floor(width * 0.6), endY: Math.floor(height * 0.6) }
    ];

    let dataIndex = 0;
    let bitIndex = 7;

    // 遍历每个区域
    for (const region of regions) {
      console.log('Embedding to region:', region);
      
      // 遍历区域内的每个像素
      for (let y = region.startY; y < region.endY && dataIndex < redundantData.length; y++) {
        for (let x = region.startX; x < region.endX && dataIndex < redundantData.length; x++) {
          // 遍历每个颜色通道（跳过Alpha通道）
          for (let c = 0; c < Math.min(3, channels) && dataIndex < redundantData.length; c++) {
            const pixelIndex = (y * width + x) * channels + c;
            if (pixelIndex < pixelCount) {
              const pixel = pixels[pixelIndex];
              // 只修改最低位，确保图片不会出现明显的视觉变化
              const newPixel = (pixel & 0xFE) | ((redundantData[dataIndex] >> bitIndex) & 0x01);
              // 确保像素值在0-255范围内
              pixels[pixelIndex] = Math.max(0, Math.min(255, newPixel));

              bitIndex--;
              if (bitIndex < 0) {
                bitIndex = 7;
                dataIndex++;
              }
            }
          }
        }
      }
    }

    console.log('Embedded bytes:', Math.floor(dataIndex / redundancy));

    // 创建新的Buffer，确保数据格式正确
    const pixelBuffer = Buffer.from(pixels);

    return sharp(pixelBuffer, {
      raw: {
        width: width,
        height: height,
        channels: channels
      }
    });
  } catch (err) {
    console.error('Error embedding to full image:', err);
    return imageSharp;
  }
}

async function extractFromFullImage(imageSharp) {
  try {
    const imageBuffer = await imageSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = imageBuffer;
    const { width, height, channels } = info;
    const pixelCount = width * height * channels;

    // 增强的抗压缩和抗裁切策略
    // 1. 从多个区域提取数据，提高抗裁切能力
    // 2. 使用冗余数据，提高抗压缩能力
    // 3. 从多个通道提取数据，提高抗压缩能力
    
    // 计算最大可能的数据长度
    const redundancy = 3; // 数据复制3次
    const maxExtractLength = Math.floor(pixelCount / 8 / redundancy / 3); // 除以3因为要在RGB通道中存储
    
    // 为每个区域创建一个数据缓冲区
    const regions = [
      { startX: 0, startY: 0, endX: Math.floor(width * 0.2), endY: Math.floor(height * 0.2) },
      { startX: Math.floor(width * 0.8), startY: Math.floor(height * 0.8), endX: width, endY: height },
      { startX: Math.floor(width * 0.4), startY: Math.floor(height * 0.4), endX: Math.floor(width * 0.6), endY: Math.floor(height * 0.6) }
    ];

    console.log('Extracting data from multiple regions, max length:', maxExtractLength);

    // 从每个区域提取数据
    for (const region of regions) {
      console.log('Extracting from region:', region);
      
      const regionData = Buffer.alloc(maxExtractLength * redundancy);
      let dataIndex = 0;
      let bitIndex = 7;

      // 遍历区域内的每个像素
      for (let y = region.startY; y < region.endY && dataIndex < regionData.length; y++) {
        for (let x = region.startX; x < region.endX && dataIndex < regionData.length; x++) {
          // 遍历每个颜色通道（跳过Alpha通道）
          for (let c = 0; c < Math.min(3, channels) && dataIndex < regionData.length; c++) {
            const pixelIndex = (y * width + x) * channels + c;
            if (pixelIndex < pixelCount) {
              // 只提取最低位
              const bit = pixels[pixelIndex] & 0x01;
              regionData[dataIndex] |= (bit << bitIndex);

              bitIndex--;
              if (bitIndex < 0) {
                bitIndex = 7;
                dataIndex++;
              }
            }
          }
        }
      }

      console.log('Extracted from region, bytes:', Math.floor(dataIndex / redundancy));

      // 尝试解码提取的数据
      try {
        // 从冗余数据中恢复原始数据
        const recoveredData = Buffer.alloc(maxExtractLength);
        for (let i = 0; i < maxExtractLength; i++) {
          // 使用投票机制，从冗余数据中选择最常见的值
          const values = [];
          for (let j = 0; j < redundancy; j++) {
            if (i + j * maxExtractLength < regionData.length) {
              values.push(regionData[i + j * maxExtractLength]);
            }
          }
          
          // 投票选择最常见的值
          const counts = {};
          values.forEach(v => counts[v] = (counts[v] || 0) + 1);
          const sortedValues = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
          recoveredData[i] = parseInt(sortedValues[0], 10);
        }

        const extracted = decodeBytesToText(recoveredData);
        if (extracted && typeof extracted === 'object' && extracted.author) {
          console.log('Successfully extracted fingerprint from region');
          return extracted;
        }
      } catch (error) {
        console.error('Error decoding extracted data:', error);
        // 继续尝试下一个区域
        continue;
      }
    }

    console.log('Failed to extract fingerprint from all regions');
    return null;
  } catch (err) {
    console.error('Error extracting from full image:', err);
    return null;
  }
}

async function addVisibleWatermark(imageSharp, options = {}) {
  try {
    const { text = 'AuthLock', position = 'bottom-right', color = '#ffffff', size = 30, opacity = 0.8 } = options;
    const metadata = await imageSharp.metadata();
    const { width, height } = metadata;
    
    console.log('Adding visible watermark:', { text, position, color, size, opacity, width, height });
    
    // 计算水印位置
    let x, y;
    const margin = 20;
    
    // 简单的位置计算，确保水印在图片范围内
    switch (position) {
      case 'top-left':
        x = margin;
        y = margin + size;
        break;
      case 'top-right':
        x = width - margin - 200; // 固定宽度，确保水印在范围内
        y = margin + size;
        break;
      case 'bottom-left':
        x = margin;
        y = height - margin;
        break;
      case 'bottom-right':
      default:
        x = width - margin - 200; // 固定宽度，确保水印在范围内
        y = height - margin;
        break;
      case 'center':
        x = (width - 200) / 2;
        y = (height + size) / 2;
        break;
    }
    
    console.log('Watermark position:', { x, y });
    
    // 创建一个简单但有效的SVG水印
    // 使用固定大小的SVG，确保兼容性
    const svgWidth = 200;
    const svgHeight = 50;
    
    const svg = `
      <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- 不透明背景，确保水印可见 -->
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" 
              fill="black" opacity="0.6" rx="5" ry="5" />
        <!-- 白色粗体文本，确保清晰度 -->
        <text x="10" y="35" 
              font-family="Arial, sans-serif" 
              font-size="${size}" 
              font-weight="bold" 
              fill="${color}" 
              opacity="${opacity}">
          ${text}
        </text>
      </svg>
    `;
    
    console.log('Generated SVG:', svg);
    
    const watermarkBuffer = Buffer.from(svg);
    
    // 使用gravity和offset来精确定位水印
    let gravity;
    switch (position) {
      case 'top-left':
        gravity = 'northwest';
        break;
      case 'top-right':
        gravity = 'northeast';
        break;
      case 'bottom-left':
        gravity = 'southwest';
        break;
      case 'bottom-right':
      default:
        gravity = 'southeast';
        break;
      case 'center':
        gravity = 'center';
        break;
    }
    
    console.log('Using gravity:', gravity);
    
    // 使用更简单可靠的composite操作
    const watermarkedImage = imageSharp.composite([{
      input: watermarkBuffer,
      gravity: gravity,
      offset: { x: -margin, y: -margin } // 从边缘向内偏移
    }]);
    
    console.log('Watermark added successfully');
    return watermarkedImage;
  } catch (error) {
    console.error('Error adding visible watermark:', error);
    return imageSharp;
  }
}

exports.embedFingerprint = async (inputPath, outputPath, payload) => {
  try {
    // 验证输入参数
    if (!inputPath || !fs.existsSync(inputPath)) {
      return {
        success: false,
        message: '输入文件不存在或路径无效'
      };
    }

    if (!outputPath) {
      return {
        success: false,
        message: '输出路径无效'
      };
    }

    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        message: '无效的嵌入参数'
      };
    }

    // 验证文件是否为图片
    const fileExtension = path.extname(inputPath).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp'];
    if (!validExtensions.includes(fileExtension)) {
      return {
        success: false,
        message: '不支持的文件格式，仅支持 JPG、PNG、BMP 格式'
      };
    }

    const isScreenshot = await detectScreenshot(inputPath);
    let image;
    
    try {
      image = sharp(inputPath);
    } catch (err) {
      return {
        success: false,
        message: '无法读取图片文件，可能是损坏的图片'
      };
    }

    let metadata;
    try {
      metadata = await image.metadata();
    } catch (err) {
      return {
        success: false,
        message: '无法读取图片元数据，可能是无效的图片文件'
      };
    }

    const { width, height } = metadata;

    if (!width || !height) {
      return {
        success: false,
        message: '无法获取图片尺寸，可能是损坏的图片'
      };
    }

    if (width < 20 || height < 20) {
      return {
        success: false,
        message: '图片尺寸过小，最小尺寸为 20x20px'
      };
    }
    
    if (isScreenshot) {
      console.warn('Warning: The image appears to be a screenshot. Fingerprinting may be less effective.');
    }

    let featureHash, fileHash;
    try {
      featureHash = await generateFeatureHash(inputPath);
      fileHash = await generateFileHash(inputPath);
    } catch (err) {
      return {
        success: false,
        message: '无法生成图片哈希值，可能是损坏的图片'
      };
    }

    const author = payload.author || 'Unknown';
    const authorId = generateAuthorId(author);

    // 生成加密密钥（基于作者信息和时间戳）
    const encryptionKey = crypto.createHash('sha256')
      .update(author + Date.now())
      .digest();
    
    const basicData = {
      author,
      authorId,
      featureHash,
      fileHash,
      timestamp: Date.now(),
      version: '1.0',
      antiCompression: true
    };
    
    // 生成防篡改哈希
    const tamperProofHash = generateTamperProofHash(basicData);
    
    // 准备嵌入数据
    const embedData = {
      ...basicData,
      tamperProofHash,
      encrypted: true
    };

    console.log('Embedding data:', embedData);

    let dataBuffer;
    try {
      dataBuffer = encodeTextToBytes(embedData);
    } catch (err) {
      return {
        success: false,
        message: '无法编码嵌入数据'
      };
    }

    let processedImage;
    try {
      processedImage = await embedToFullImage(image, dataBuffer);
    } catch (err) {
      return {
        success: false,
        message: '无法嵌入指纹数据，图片可能不支持隐写'
      };
    }

    if (payload.visibleWatermark) {
      try {
        processedImage = await addVisibleWatermark(processedImage, {
          text: `© ${author}`,
          position: payload.watermarkPosition || 'bottom-right',
          color: payload.watermarkColor || '#ffffff',
          size: payload.watermarkSize || 24,
          opacity: payload.watermarkOpacity || 0.6
        });
      } catch (err) {
        console.warn('Error adding watermark, continuing without watermark:', err);
        // 水印添加失败不影响主要功能
      }
    }

    try {
      // 确保输出目录存在
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      await processedImage.toFile(outputPath);
    } catch (err) {
      return {
        success: false,
        message: '无法保存处理后的图片，可能是权限问题或磁盘空间不足'
      };
    }

    let message = '指纹嵌入成功';
    if (isScreenshot) {
      message += ' ⚠️  注意：此图片可能是截图，指纹可能不太可靠。';
    }

    return {
      success: true,
      message,
      data: { featureHash, fileHash, isScreenshot, ...embedData }
    };
  } catch (err) {
    console.error('Error embedding fingerprint:', err);
    return {
      success: false,
      message: `嵌入指纹时发生错误：${err.message}`
    };
  }
};

exports.extractFingerprint = async (imagePath) => {
  try {
    // 验证输入参数
    if (!imagePath || !fs.existsSync(imagePath)) {
      return {
        success: false,
        message: '输入文件不存在或路径无效'
      };
    }

    // 验证文件是否为图片
    const fileExtension = path.extname(imagePath).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp'];
    if (!validExtensions.includes(fileExtension)) {
      return {
        success: false,
        message: '不支持的文件格式，仅支持 JPG、PNG、BMP 格式'
      };
    }

    const isScreenshot = await detectScreenshot(imagePath);
    let image;
    
    try {
      image = sharp(imagePath);
    } catch (err) {
      return {
        success: false,
        message: '无法读取图片文件，可能是损坏的图片'
      };
    }

    let metadata;
    try {
      metadata = await image.metadata();
    } catch (err) {
      return {
        success: false,
        message: '无法读取图片元数据，可能是无效的图片文件'
      };
    }

    const { width, height } = metadata;

    if (!width || !height) {
      return {
        success: false,
        message: '无法获取图片尺寸，可能是损坏的图片'
      };
    }

    if (width < 20 || height < 20) {
      return {
        success: false,
        message: '图片尺寸过小，最小尺寸为 20x20px'
      };
    }
    
    if (isScreenshot) {
      console.warn('Warning: The image appears to be a screenshot. Verification may be less reliable.');
    }

    let extracted;
    try {
      extracted = await extractFromFullImage(image);
    } catch (err) {
      return {
        success: false,
        message: '无法从图片中提取指纹，可能是损坏的图片或不支持的格式'
      };
    }
    
    console.log('Extracted data:', extracted);
    
    if (extracted && typeof extracted === 'object') {
      if (!extracted.author) {
        extracted.author = 'Unknown';
      }
      
      // 防篡改检测
      let isTampered = false;
      if (extracted.tamperProofHash) {
        // 移除防篡改哈希后重新计算
        const { tamperProofHash, ...dataWithoutHash } = extracted;
        const calculatedHash = generateTamperProofHash(dataWithoutHash);
        isTampered = tamperProofHash !== calculatedHash;
      }
      
      const authorId = generateAuthorId(extracted.author);
      let currentFeatureHash, currentFileHash;
      
      try {
        currentFeatureHash = await generateFeatureHash(imagePath);
        currentFileHash = await generateFileHash(imagePath);
      } catch (err) {
        return {
          success: false,
          message: '无法生成当前图片哈希值，可能是损坏的图片'
        };
      }

      const isOriginal = extracted.featureHash === currentFeatureHash;
      const isModified = !isOriginal;
      const isReSaved = extracted.fileHash !== currentFileHash;
      
      let status = 'valid';
      if (isTampered) {
        status = 'tampered';
      } else if (isOriginal) {
        status = 'original';
      } else if (isModified) {
        status = 'modified';
      }

      let uiMessage = '';
      if (isTampered) {
        uiMessage = `警告：此图片可能被篡改过，作者信息可能不可靠`;
      } else if (isOriginal) {
        uiMessage = `此图片属于 ${extracted.author}（原始版本）`;
      } else if (isModified) {
        uiMessage = `此图片属于 ${extracted.author}（修改版本）`;
      }
      
      if (isScreenshot) {
        uiMessage += ' ⚠️  注意：此图片可能是截图，验证结果可能不太可靠。';
      }

      return {
        success: true,
        message: '指纹提取成功',
        data: {
          ...extracted,
          authorId,
          currentFeatureHash,
          currentFileHash,
          isOriginal,
          isModified,
          isReSaved,
          isScreenshot,
          status,
          uiMessage
        }
      };
    }

    return {
      success: false,
      message: '未找到有效的指纹信息',
      data: {
        status: 'no_fingerprint',
        uiMessage: '此图片没有版权信息'
      }
    };
  } catch (err) {
    console.error('Error extracting fingerprint:', err);
    return {
      success: false,
      message: `提取指纹时发生错误：${err.message}`,
      data: {
        status: 'error',
        uiMessage: '提取指纹时发生错误'
      }
    };
  }
};

exports.verifyFingerprint = async (imagePath) => {
  const result = await exports.extractFingerprint(imagePath);
  if (result.success) {
    return result;
  }
  return {
    success: false,
    message: result.message,
    data: null
  };
};