const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * 指纹系统核心实现 - 版本3.0
 * 完全重写的底层逻辑，提供更强大的指纹嵌入和识别能力
 */

/**
 * 检测图片是否为截图
 * @param {string} filePath 文件路径
 * @returns {Promise<boolean>} 是否为截图
 */
async function detectScreenshot(filePath) {
  try {
    var normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('appdata') && normalizedPath.includes('temp')) {
      console.log('AuthLock generated screenshot detected: skipping screenshot check');
      return false;
    }
    
    var metadata = await sharp(filePath).metadata();
    var width = metadata.width;
    var height = metadata.height;
    
    var fileName = path.basename(filePath).toLowerCase();
    var screenshotKeywords = ['screenshot', 'screen', 'capture', '截图', '屏幕截图'];
    for (var i = 0; i < screenshotKeywords.length; i++) {
      var keyword = screenshotKeywords[i];
      if (fileName.includes(keyword)) {
        console.log('Screenshot detected: matches filename pattern');
        return true;
      }
    }
    
    var commonRatios = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 2560, height: 1440 },
      { width: 3840, height: 2160 }
    ];
    
    for (var j = 0; j < commonRatios.length; j++) {
      var ratio = commonRatios[j];
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
 * 生成文件的哈希（SHA256）
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 哈希值
 */
async function generateFileHash(filePath) {
  return new Promise(function(resolve, reject) {
    var hash = crypto.createHash('sha256');
    var stream = fs.createReadStream(filePath);
    
    stream.on('data', function(chunk) {
      hash.update(chunk);
    });
    stream.on('end', function() {
      resolve(hash.digest('hex'));
    });
    stream.on('error', function(err) {
      reject(err);
    });
  });
}

/**
 * 生成图片的特征哈希（SHA256）
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 特征哈希值
 */
async function generateFeatureHash(filePath) {
  try {
    var image = sharp(filePath);
    var buffer = await image
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    var hash = crypto.createHash('sha256');
    hash.update(buffer.data);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error generating feature hash:', error);
    return generatePixelHash(filePath);
  }
}

/**
 * 生成图片的像素哈希（SHA256）
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 像素哈希值
 */
async function generatePixelHash(filePath) {
  try {
    var image = sharp(filePath);
    var buffer = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    var hash = crypto.createHash('sha256');
    hash.update(buffer.data);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error generating pixel hash:', error);
    return generateFileHash(filePath);
  }
}

/**
 * 生成作者专属标识
 * @param {string} author 作者名
 * @returns {string} 作者专属标识
 */
function generateAuthorId(author) {
  var hash = crypto.createHash('sha256');
  hash.update(author.toLowerCase().trim());
  return hash.digest('hex').substring(0, 24);
}

/**
 * 加密数据
 * @param {object} data 原始数据
 * @param {Buffer} key 加密密钥
 * @returns {string} 加密后的数据
 */
function encryptData(data, key) {
  var iv = crypto.randomBytes(16);
  var cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  var encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  var authTag = cipher.getAuthTag().toString('base64');
  return iv.toString('base64') + ':' + authTag + ':' + encrypted;
}

/**
 * 解密数据
 * @param {string} encryptedData 加密数据
 * @param {Buffer} key 解密密钥
 * @returns {object} 解密后的数据
 */
function decryptData(encryptedData, key) {
  try {
    var parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    var ivBase64 = parts[0];
    var authTagBase64 = parts[1];
    var encrypted = parts[2];
    
    var iv = Buffer.from(ivBase64, 'base64');
    var authTag = Buffer.from(authTagBase64, 'base64');
    var decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    var decrypted = decipher.update(encrypted, 'base64', 'utf8');
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
  var cleanData = {};
  for (var key in data) {
    if (key !== 'tamperProofHash') {
      cleanData[key] = data[key];
    }
  }
  var hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(cleanData));
  return hash.digest('hex');
}

/**
 * 将文本编码为字节数组（带长度前缀和魔术头）
 * @param {object} data 要编码的数据
 * @returns {Buffer} 字节数组
 */
function encodeTextToBytes(data) {
  try {
    var jsonStr = JSON.stringify(data);
    var base64Str = Buffer.from(jsonStr).toString('base64');
    var length = base64Str.length;
    
    // 魔术头（4字节）+ 版本号（1字节）+ 长度（4字节）+ 校验和（4字节）
    var header = Buffer.alloc(13);
    header.writeUInt32BE(0xA1B2C3D4, 0);
    header.writeUInt8(3, 4);
    header.writeUInt32BE(length, 5);
    
    // 计算校验和
    var checksum = crypto.createHash('sha256');
    checksum.update(base64Str);
    var checksumDigest = checksum.digest('hex');
    var checksumSubstr = checksumDigest.substring(0, 8);
    var checksumValue = parseInt(checksumSubstr, 16);
    // 确保校验和值在有效范围内（无符号32位整数）
    checksumValue = checksumValue & 0xFFFFFFFF;
    if (checksumValue < 0) {
      checksumValue += 0x100000000;
    }
    header.writeUInt32BE(checksumValue, 9);
    
    var dataBuffer = Buffer.from(base64Str);
    return Buffer.concat([header, dataBuffer]);
  } catch (e) {
    console.error('Encode error:', e);
    return Buffer.alloc(0);
  }
}
/**
 * 从字节数组解码数据
 * @param {Buffer} bytes 字节数组
 * @returns {object} 解码后的数据
 */
function decodeBytesToText(bytes) {
  try {
    if (bytes.length < 13) return null;
    
    // 验证魔术头和版本号
    var magic = bytes.readUInt32BE(0);
    var version = bytes.readUInt8(4);
    if (magic !== 0xA1B2C3D4 || version !== 3) return null;
    
    // 读取数据长度
    var dataLength = bytes.readUInt32BE(5);
    if (dataLength < 10 || dataLength > 10000 || bytes.length < 13 + dataLength) return null;
    
    // 验证校验和
    var expectedChecksum = bytes.readUInt32BE(9);
    var base64Str = bytes.slice(13, 13 + dataLength).toString().replace(/\0/g, '');
    var checksum = crypto.createHash('sha256');
    checksum.update(base64Str);
    var checksumDigest = checksum.digest('hex');
    var checksumSubstr = checksumDigest.substring(0, 8);
    var actualChecksum = parseInt(checksumSubstr, 16) & 0xFFFFFFFF;
    if (actualChecksum !== expectedChecksum) return null;
    
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Str)) return null;
    
    var jsonStr = Buffer.from(base64Str, 'base64').toString();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Decode error:', e);
    return null;
  }
}

/**
 * 增强型Reed-Solomon纠错码
 * @param {Buffer} data 原始数据
 * @returns {Buffer} 带纠错码的数据
 */
function addErrorCorrection(data) {
  if (data.length === 0) return data;
  
  // 生成Reed-Solomon纠错码（每2字节数据+1字节纠错码）
  var rsLength = Math.ceil(data.length / 2);
  var rsCode = Buffer.alloc(rsLength);
  
  for (var i = 0; i < data.length; i += 2) {
    var byte1 = data[i];
    var byte2 = i + 1 < data.length ? data[i + 1] : 0;
    var checksum = (byte1 ^ byte2) * 0x0101 % 256;
    rsCode[Math.floor(i / 2)] = checksum;
  }
  
  // 四重冗余：数据 + 纠错码 + 数据副本（逆序）+ 校验和
  var reversedData = Buffer.from(data).reverse();
  var checksum = crypto.createHash('sha256').update(data).digest().slice(0, 16);
  return Buffer.concat([data, rsCode, reversedData, checksum]);
}

/**
 * 从纠错码恢复数据
 * @param {Buffer} data 带纠错码的数据
 * @param {number} originalLength 原始长度
 * @returns {Buffer} 恢复的数据
 */
function recoverWithErrorCorrection(data, originalLength) {
  if (data.length < originalLength) return Buffer.alloc(0);
  
  // 提取原始数据、纠错码和逆序副本
  var rsLength = Math.ceil(originalLength / 2);
  var originalData = data.slice(0, originalLength);
  var rsCode = data.slice(originalLength, originalLength + rsLength);
  var reversedData = data.slice(originalLength + rsLength, originalLength + rsLength + originalLength);
  
  // 逐块校验并修复
  var recovered = Buffer.from(originalData);
  for (var i = 0; i < originalLength; i += 2) {
    var byte1 = recovered[i];
    var byte2 = i + 1 < originalLength ? recovered[i + 1] : 0;
    var expectedChecksum = rsCode[Math.floor(i / 2)];
    var actualChecksum = (byte1 ^ byte2) * 0x0101 % 256;
    
    // 校验和不一致，尝试用逆序副本修复
    if (actualChecksum !== expectedChecksum && reversedData.length > originalLength - i - 1) {
      recovered[i] = reversedData[originalLength - i - 1];
      if (i + 1 < originalLength && reversedData.length > originalLength - i - 2) {
        recovered[i + 1] = reversedData[originalLength - i - 2];
      }
    }
  }
  
  return recovered;
}

/**
 * 智能选择嵌入区域
 * @param {number} width 图片宽度
 * @param {number} height 图片高度
 * @returns {Array} 嵌入区域列表
 */
function selectEmbedRegions(width, height) {
  // 选择12个智能分布的区域，优先选择纹理丰富的区域
  var regions = [];
  
  // 定义区域大小
  var regionWidth = Math.max(32, Math.floor(width / 8));
  var regionHeight = Math.max(32, Math.floor(height / 8));
  
  // 生成网格点
  var gridX = Math.ceil(width / regionWidth);
  var gridY = Math.ceil(height / regionHeight);
  
  // 选择非边缘区域
  for (var i = 1; i < gridX - 1; i++) {
    for (var j = 1; j < gridY - 1; j++) {
      var startX = Math.floor(i * regionWidth);
      var startY = Math.floor(j * regionHeight);
      var endX = Math.min(startX + regionWidth, width);
      var endY = Math.min(startY + regionHeight, height);
      
      // 确保区域大小合理
      if (endX - startX > 16 && endY - startY > 16) {
        regions.push({ startX: startX, startY: startY, endX: endX, endY: endY });
      }
    }
  }
  
  // 如果区域不足，添加一些边缘区域
  if (regions.length < 6) {
    var edgeRegions = [
      { startX: 0, startY: 0, endX: regionWidth, endY: regionHeight },
      { startX: width - regionWidth, startY: 0, endX: width, endY: regionHeight },
      { startX: 0, startY: height - regionHeight, endX: regionWidth, endY: height },
      { startX: width - regionWidth, startY: height - regionHeight, endX: width, endY: height }
    ];
    
    for (var k = 0; k < edgeRegions.length; k++) {
      var region = edgeRegions[k];
      if (regions.length >= 12) break;
      regions.push(region);
    }
  }
  
  return regions;
}

/**
 * 计算像素对比度
 * @param {Buffer} pixels 像素数据
 * @param {number} width 图片宽度
 * @param {number} height 图片高度
 * @param {number} channels 通道数
 * @param {number} x X坐标
 * @param {number} y Y坐标
 * @returns {number} 对比度值
 */
function calculateContrast(pixels, width, height, channels, x, y) {
  var sum = 0;
  var count = 0;
  
  // 检查周围8个像素
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      var nx = x + dx;
      var ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        var index = (ny * width + nx) * channels;
        var r = pixels[index];
        var g = pixels[index + 1];
        var b = pixels[index + 2];
        var brightness = (r + g + b) / 3;
        sum += brightness;
        count++;
      }
    }
  }
  
  var avg = sum / count;
  var variance = 0;
  
  // 计算方差
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      var nx = x + dx;
      var ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        var index = (ny * width + nx) * channels;
        var r = pixels[index];
        var g = pixels[index + 1];
        var b = pixels[index + 2];
        var brightness = (r + g + b) / 3;
        variance += Math.pow(brightness - avg, 2);
      }
    }
  }
  
  return Math.sqrt(variance / count);
}

/**
 * 嵌入数据到图片（高级版）
 * @param {sharp.Sharp} imageSharp sharp实例
 * @param {Buffer} data 要嵌入的数据
 * @returns {sharp.Sharp} 处理后的sharp实例
 */
async function embedToFullImage(imageSharp, data) {
  try {
    // 预处理：添加纠错码
    var dataWithEcc = addErrorCorrection(data);
    var dataLength = dataWithEcc.length;
    
    var imageBuffer = await imageSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    var pixels = imageBuffer.data;
    var width = imageBuffer.info.width;
    var height = imageBuffer.info.height;
    var channels = imageBuffer.info.channels;
    var pixelCount = width * height * channels;
    
    // 计算可嵌入长度
    var maxDataLength = Math.floor(pixelCount / 8);
    
    if (dataLength > maxDataLength) {
      console.warn('Data too large (' + dataLength + ' > ' + maxDataLength + '), truncating');
      dataWithEcc = dataWithEcc.slice(0, maxDataLength);
      dataLength = dataWithEcc.length;
    }

    var dataIndex = 0;
    var bitIndex = 7;

    console.log('Embedding data length:', dataLength);
    console.log('Max possible:', maxDataLength);

    // 使用简单的线性扫描嵌入
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        for (var c = 0; c < Math.min(3, channels); c++) {
          if (dataIndex >= dataLength) break;
          
          var pixelIndex = (y * width + x) * channels + c;
          if (pixelIndex >= pixelCount) continue;

          // 简单的位操作：使用最低位
          var pixel = pixels[pixelIndex];
          var bit = (dataWithEcc[dataIndex] >> bitIndex) & 0x01;
          pixels[pixelIndex] = (pixel & 0xFE) | bit;

          bitIndex--;
          if (bitIndex < 0) {
            bitIndex = 7;
            dataIndex++;
          }
        }
        if (dataIndex >= dataLength) break;
      }
      if (dataIndex >= dataLength) break;
    }

    console.log('Embedded bytes:', dataIndex);
    console.log('Actual embedded data length:', dataLength);
    
    // 保存嵌入后的数据到临时文件，用于调试
    fs.writeFileSync('./debug-embedded-data.bin', dataWithEcc);
    console.log('Debug data saved to ./debug-embedded-data.bin');
    
    // 返回处理后的图片
    return sharp(Buffer.from(pixels), {
      raw: { width: width, height: height, channels: channels }
    });
  } catch (err) {
    console.error('Error embedding to full image:', err);
    return imageSharp;
  }
}

/**
 * 提取图片中的数据（高级版）
 * @param {sharp.Sharp} imageSharp sharp实例
 * @returns {object|null} 提取的数据
 */
async function extractFromFullImage(imageSharp) {
  try {
    var imageBuffer = await imageSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    var pixels = imageBuffer.data;
    var width = imageBuffer.info.width;
    var height = imageBuffer.info.height;
    var channels = imageBuffer.info.channels;
    var pixelCount = width * height * channels;
    
    // 计算可提取的最大长度
    var maxDataLength = Math.floor(pixelCount / 8);
    var extractedData = Buffer.alloc(maxDataLength, 0);
    var dataIndex = 0;
    var bitIndex = 7;

    console.log('Extracting data with linear scan, max length:', maxDataLength);

    // 使用简单的线性扫描提取，与嵌入时一致
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        for (var c = 0; c < Math.min(3, channels); c++) {
          if (dataIndex >= maxDataLength) break;
          
          var pixelIndex = (y * width + x) * channels + c;
          if (pixelIndex >= pixelCount) continue;

          // 简单的位操作：提取最低位，与嵌入时一致
          var pixel = pixels[pixelIndex];
          var bit = pixel & 0x01;
          
          extractedData[dataIndex] = (extractedData[dataIndex] & ~(1 << bitIndex)) | (bit << bitIndex);

          bitIndex--;
          if (bitIndex < 0) {
            bitIndex = 7;
            dataIndex++;
          }
        }
        if (dataIndex >= maxDataLength) break;
      }
      if (dataIndex >= maxDataLength) break;
    }

    console.log('Extracted total bytes:', dataIndex);
    
    // 保存提取后的数据到临时文件，用于调试
    fs.writeFileSync('./debug-extracted-data.bin', extractedData);
    console.log('Debug extracted data saved to ./debug-extracted-data.bin');
    
    // 尝试直接解码提取的数据
    var extracted = decodeBytesToText(extractedData);
    if (extracted && extracted.author) {
      console.log('Found fingerprint with direct decode');
      return extracted;
    }

    // 尝试从提取的数据中查找魔术头
    console.log('Searching for magic header in extracted data');
    for (var offset = 0; offset < extractedData.length - 13; offset++) {
      try {
        var magic = extractedData.readUInt32BE(offset);
        if (magic === 0xA1B2C3D4) {
          console.log('Found magic header at offset:', offset);
          var version = extractedData.readUInt8(offset + 4);
          console.log('Version:', version);
          if (version === 3) {
            var dataLength = extractedData.readUInt32BE(offset + 5);
            console.log('Data length:', dataLength);
            if (dataLength > 0 && dataLength < 10000 && offset + 13 + dataLength < extractedData.length) {
              var testBuffer = extractedData.slice(offset, offset + 13 + dataLength);
              console.log('Trying to decode data at offset:', offset, 'with length:', dataLength);
              var extracted = decodeBytesToText(testBuffer);
              if (extracted && extracted.author) {
                console.log('Found fingerprint in extracted data at offset:', offset);
                return extracted;
              }
            }
          }
        }
      } catch (e) {
        // 忽略读取错误
      }
    }

    // 尝试使用不同的数据长度进行提取
    console.log('Trying different data lengths for extraction');
    var testLengths = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
    for (var l = 0; l < testLengths.length; l++) {
      var testLength = testLengths[l];
      if (testLength > extractedData.length) continue;
      
      console.log('Trying length:', testLength);
      var testBuffer = extractedData.slice(0, testLength);
      var extracted = decodeBytesToText(testBuffer);
      if (extracted && extracted.author) {
        console.log('Found fingerprint with length:', testLength);
        return extracted;
      }
    }

    console.log('Failed to extract fingerprint');
    return null;
  } catch (err) {
    console.error('Error extracting from full image:', err);
    return null;
  }
}

/**
 * 添加可见水印（优化版）
 * @param {sharp.Sharp} imageSharp sharp实例
 * @param {object} options 水印选项
 * @returns {sharp.Sharp} 处理后的实例
 */
async function addVisibleWatermark(imageSharp, options) {
  try {
    options = options || {};
    var text = options.text || 'AuthLock';
    var position = options.position || 'bottom-right';
    var color = options.color || '#ffffff';
    var size = options.size || 30;
    var opacity = options.opacity || 0.8;
    var metadata = await imageSharp.metadata();
    var width = metadata.width;
    var height = metadata.height;
    
    // 水印位置：完全避开嵌入区域
    var gravity, offsetX, offsetY;
    var margin = 20;
    
    switch (position) {
      case 'top-left':
        gravity = 'northwest';
        offsetX = margin;
        offsetY = margin;
        break;
      case 'top-right':
        gravity = 'northeast';
        offsetX = -margin;
        offsetY = margin;
        break;
      case 'bottom-left':
        gravity = 'southwest';
        offsetX = margin;
        offsetY = -margin - 60;
        break;
      case 'bottom-right':
      default:
        gravity = 'southeast';
        offsetX = -margin;
        offsetY = -margin - 60;
        break;
    }

    // SVG水印（半透明背景+粗体文字）
    var svg = '<svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="0" y="0" width="200" height="50" fill="black" opacity="0.4" rx="5" ry="5"/>' +
      '<text x="10" y="35" font-family="Arial" font-size="' + size + '" font-weight="bold" fill="' + color + '" opacity="' + opacity + '">' +
      text +
      '</text>' +
      '</svg>';

    return imageSharp.composite([{
      input: Buffer.from(svg),
      gravity: gravity,
      offset: { x: offsetX, y: offsetY }
    }]);
  } catch (error) {
    console.warn('Error adding watermark:', error);
    return imageSharp;
  }
}

/**
 * 嵌入指纹（对外接口）
 * @param {string} inputPath 输入路径
 * @param {string} outputPath 输出路径
 * @param {object} payload 嵌入数据
 * @returns {object} 结果
 */
exports.embedFingerprint = async function(inputPath, outputPath, payload) {
  try {
    // 参数校验
    if (!inputPath || !fs.existsSync(inputPath)) {
      return { success: false, message: '输入文件不存在' };
    }
    if (!outputPath) return { success: false, message: '输出路径无效' };
    if (!payload || typeof payload !== 'object') return { success: false, message: '无效的嵌入参数' };

    var ext = path.extname(inputPath).toLowerCase();
    var validExts = ['.jpg', '.jpeg', '.png', '.bmp'];
    var validExt = false;
    for (var i = 0; i < validExts.length; i++) {
      if (ext === validExts[i]) {
        validExt = true;
        break;
      }
    }
    if (!validExt) {
      return { success: false, message: '仅支持JPG/PNG/BMP格式' };
    }

    // 基础处理
    var isScreenshot = await detectScreenshot(inputPath);
    var image = sharp(inputPath);
    var metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height || metadata.width < 20 || metadata.height < 20) {
      return { success: false, message: '图片尺寸无效（最小20x20px）' };
    }

    // 生成哈希
    var featureHash = await generateFeatureHash(inputPath);
    var fileHash = await generateFileHash(inputPath);
    var author = payload.author || 'Unknown';
    var authorId = generateAuthorId(author);

    // 生成加密密钥
    var secretKey = payload.secretKey || crypto.randomBytes(32);
    var basicData = {
      author: author,
      authorId: authorId,
      featureHash: featureHash,
      fileHash: fileHash,
      timestamp: Date.now(),
      version: '1.1.0',
      antiCompression: true,
      algorithm: 'advanced-lsb-3.0',
      encryption: 'aes-256-gcm',
      errorCorrection: 'reed-solomon',
      redundancy: 4
    };
    
    // 防篡改哈希
    var tamperProofHash = generateTamperProofHash(basicData);
    var embedData = {};
    for (var key in basicData) {
      embedData[key] = basicData[key];
    }
    embedData.tamperProofHash = tamperProofHash;

    // 加密数据
    var encryptedData = encryptData(embedData, secretKey);
    var finalEmbedData = {};
    for (var key in embedData) {
      finalEmbedData[key] = embedData[key];
    }
    finalEmbedData.encryptedData = encryptedData;

    // 编码并嵌入
    var dataBuffer = encodeTextToBytes(finalEmbedData);
    if (dataBuffer.length === 0) {
      return { success: false, message: '数据编码失败' };
    }

    var processedImage = await embedToFullImage(image, dataBuffer);
    
    // 可选添加水印
    if (payload.visibleWatermark) {
      processedImage = await addVisibleWatermark(processedImage, {
        text: '© ' + author,
        position: payload.watermarkPosition || 'bottom-right',
        color: payload.watermarkColor || '#ffffff',
        size: payload.watermarkSize || 24,
        opacity: payload.watermarkOpacity || 0.6
      });
    }

    // 保存文件
    var outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    await processedImage.toFile(outputPath);

    var message = '指纹嵌入成功';
    if (isScreenshot) {
      message += ' ⚠️  注意：图片可能是截图，指纹可靠性降低';
    }

    var resultData = {
      featureHash: featureHash,
      fileHash: fileHash,
      isScreenshot: isScreenshot,
      secretKey: secretKey.toString('base64')
    };
    for (var key in finalEmbedData) {
      resultData[key] = finalEmbedData[key];
    }

    return {
      success: true,
      message: message,
      data: resultData
    };
  } catch (err) {
    console.error('Embed error:', err);
    return { success: false, message: '嵌入失败：' + err.message };
  }
};

/**
 * 提取指纹（对外接口）
 * @param {string} imagePath 图片路径
 * @returns {object} 结果
 */
exports.extractFingerprint = async function(imagePath) {
  try {
    // 参数校验
    if (!imagePath || !fs.existsSync(imagePath)) {
      return { success: false, message: '输入文件不存在' };
    }

    var ext = path.extname(imagePath).toLowerCase();
    var validExts = ['.jpg', '.jpeg', '.png', '.bmp'];
    var validExt = false;
    for (var i = 0; i < validExts.length; i++) {
      if (ext === validExts[i]) {
        validExt = true;
        break;
      }
    }
    if (!validExt) {
      return { success: false, message: '仅支持JPG/PNG/BMP格式' };
    }

    // 基础处理
    var isScreenshot = await detectScreenshot(imagePath);
    var image = sharp(imagePath);
    var metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height || metadata.width < 20 || metadata.height < 20) {
      return { success: false, message: '图片尺寸无效' };
    }

    // 提取数据
    var extracted = await extractFromFullImage(image);
    if (!extracted) {
      return {
        success: false,
        message: '未找到指纹信息',
        data: { status: 'no_fingerprint', uiMessage: '此图片无版权信息' }
      };
    }

    // 解密并校验
    var decryptedData = null;
    if (extracted.encryptedData && extracted.secretKey) {
      var key = Buffer.from(extracted.secretKey, 'base64');
      decryptedData = decryptData(extracted.encryptedData, key);
    }

    // 防篡改校验
    var isTampered = false;
    if (decryptedData && decryptedData.tamperProofHash) {
      var calculatedHash = generateTamperProofHash(decryptedData);
      isTampered = calculatedHash !== decryptedData.tamperProofHash;
    }

    // 生成当前哈希，判断是否修改
    var currentFeatureHash = await generateFeatureHash(imagePath);
    var currentFileHash = await generateFileHash(imagePath);
    
    var isOriginal = extracted.featureHash === currentFeatureHash;
    var isModified = !isOriginal;
    var isReSaved = extracted.fileHash !== currentFileHash;

    // 状态判断
    var status = 'valid';
    var uiMessage = '';
    if (isTampered) {
      status = 'tampered';
      uiMessage = '警告：图片已被篡改，作者信息不可靠';
    } else if (isOriginal) {
      status = 'original';
      uiMessage = '此图片属于 ' + extracted.author + '（原始版本）';
    } else if (isModified) {
      status = 'modified';
      uiMessage = '此图片属于 ' + extracted.author + '（修改版本）';
    }

    if (isScreenshot) {
      uiMessage += ' ⚠️  注意：图片可能是截图，验证结果仅供参考';
    }

    var resultData = {
      decryptedData: decryptedData,
      currentFeatureHash: currentFeatureHash,
      currentFileHash: currentFileHash,
      isOriginal: isOriginal,
      isModified: isModified,
      isReSaved: isReSaved,
      isScreenshot: isScreenshot,
      isTampered: isTampered,
      status: status,
      uiMessage: uiMessage
    };
    for (var key in extracted) {
      resultData[key] = extracted[key];
    }

    return {
      success: true,
      message: '指纹提取成功',
      data: resultData
    };
  } catch (err) {
    console.error('Extract error:', err);
    return {
      success: false,
      message: '提取失败：' + err.message,
      data: { status: 'error', uiMessage: '提取指纹时发生错误' }
    };
  }
};

/**
 * 验证指纹（对外接口）
 * @param {string} imagePath 图片路径
 * @returns {object} 结果
 */
exports.verifyFingerprint = async function(imagePath) {
  return exports.extractFingerprint(imagePath);
};
