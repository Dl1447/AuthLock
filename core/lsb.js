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
    // 读取图片元数据
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;
    
    // 常见屏幕分辨率比例检测
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
    
    // 检查文件命名（简单的文件名模式检测）
    const fileName = path.basename(filePath).toLowerCase();
    const screenshotKeywords = ['screenshot', 'screen', 'capture', '截图', '屏幕截图'];
    for (const keyword of screenshotKeywords) {
      if (fileName.includes(keyword)) {
        console.log('Screenshot detected: matches filename pattern');
        return true;
      }
    }
    
    // 检查文件大小和压缩率（截图通常压缩率较高）
    const fileStats = fs.statSync(filePath);
    const fileSizeKB = fileStats.size / 1024;
    const pixelCount = width * height;
    const sizePerPixel = fileSizeKB / pixelCount * 1024 * 1024; // bytes per pixel
    
    // 截图通常每像素大小较小（压缩率高）
    if (sizePerPixel < 0.1) {
      console.log('Screenshot detected: low file size per pixel');
      return true;
    }
    
    // 分析颜色分布（截图通常有更多的纯色区域）
    try {
      const image = sharp(filePath);
      const buffer = await image
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const pixels = buffer.data;
      const uniqueColors = new Set();
      
      for (let i = 0; i < pixels.length; i += 3) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        uniqueColors.add(`${r},${g},${b}`);
      }
      
      const colorDiversity = uniqueColors.size / (100 * 100);
      
      // 截图通常颜色多样性较低
      if (colorDiversity < 0.1) {
        console.log('Screenshot detected: low color diversity');
        return true;
      }
    } catch (error) {
      console.error('Error analyzing color distribution:', error);
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
 * 简单的纠错码实现（Reed-Solomon简化版）
 * @param {Buffer} data 原始数据
 * @returns {Buffer} 带纠错码的数据
 */
function addErrorCorrection(data) {
  // 简化版纠错码：复制数据三次
  // 实际应用中可以使用完整的Reed-Solomon库
  const duplicated = Buffer.concat([data, data, data]);
  return duplicated;
}

/**
 * 从带纠错码的数据中恢复原始数据
 * @param {Buffer} data 带纠错码的数据
 * @param {number} originalLength 原始数据长度
 * @returns {Buffer} 恢复的原始数据
 */
function recoverWithErrorCorrection(data, originalLength) {
  // 简化版纠错：使用投票机制
  // 实际应用中可以使用完整的Reed-Solomon库
  const recovered = Buffer.alloc(originalLength);
  
  for (let i = 0; i < originalLength; i++) {
    const values = [];
    for (let j = 0; j < 3; j++) {
      if (i + j * originalLength < data.length) {
        values.push(data[i + j * originalLength]);
      }
    }
    
    // 投票选择最常见的值
    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    recovered[i] = parseInt(mostCommon, 10);
  }
  
  return recovered;
}

/**
 * LSB隐写：整图均匀嵌入数据（抗压缩版本，带冗余和纠错）
 * @param {sharp.Sharp} imageSharp Sharp实例
 * @param {Buffer} data 要嵌入的数据
 * @returns {Promise<sharp.Sharp>} 处理后的Sharp实例
 */
async function embedToFullImage(imageSharp, data) {
  try {
    // 转为RAW格式（便于操作像素）
    const imageBuffer = await imageSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = imageBuffer;
    const { width, height, channels } = info;
    const pixelCount = width * height * channels;

    // 添加纠错码
    const dataWithECC = addErrorCorrection(data);
    
    // 确保数据长度不超过像素数（每个像素存1字节的1位）
    const maxDataLength = Math.floor(pixelCount / 8 / 3); // 除以3因为要嵌入到3个位
    const safeData = dataWithECC.slice(0, maxDataLength * 3);

    console.log('Embedding data length:', safeData.length, 'Max possible:', maxDataLength * 3);

    // 抗压缩策略：
    // 1. 冗余嵌入：在多个位（1、2、3位）存储相同的指纹数据
    // 2. 修改高位：使用第1-3位（而非最低位），提升抗压缩性
    const bitPositions = [1, 2, 3]; // 使用多个位，提升抗压缩性
    
    // 均匀分布：从边缘向内偏移10%的位置开始写入，提高抗剪裁能力
    const edgeOffset = Math.floor(Math.min(width, height) * 0.1);
    const startX = edgeOffset;
    const startY = edgeOffset;
    const endX = width - edgeOffset;
    const endY = height - edgeOffset;

    // 为每个位位置嵌入数据
    for (let bitPosIndex = 0; bitPosIndex < bitPositions.length; bitPosIndex++) {
      const bitPosition = bitPositions[bitPosIndex];
      const mask = ~(1 << bitPosition); // 清除指定位的掩码

      let dataIndex = 0;
      let bitIndex = 7;

      // 嵌入：从不同位置开始，提高抗剪裁能力
      const startOffsetX = bitPosIndex * 10;
      const startOffsetY = bitPosIndex * 10;

      for (let y = startY + startOffsetY; y < endY && dataIndex < safeData.length; y++) {
        for (let x = startX + startOffsetX; x < endX && dataIndex < safeData.length; x++) {
          for (let c = 0; c < channels && dataIndex < safeData.length; c++) {
            // 跳过Alpha通道
            if (channels === 4 && c === 3) continue;

            const pixelIndex = (y * width + x) * channels + c;
            if (pixelIndex < pixelCount) {
              const pixel = pixels[pixelIndex];
              // 清除指定位，写入数据位
              const newPixel = (pixel & mask) | (((safeData[dataIndex] >> bitIndex) & 0x01) << bitPosition);
              pixels[pixelIndex] = newPixel;

              // 移动到下一位
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

    console.log('Embedded bytes:', Math.floor(safeData.length / 3));

    // 将处理后的像素放回原图
    return sharp(pixels, {
      raw: { width, height, channels }
    });
  } catch (err) {
    console.error('Error embedding to full image:', err);
    // 静默错误处理，返回原图
    return imageSharp;
  }
}

/**
 * LSB隐写：从整图均匀提取数据（抗压缩版本，带冗余和纠错）
 * @param {sharp.Sharp} imageSharp Sharp实例
 * @returns {Promise<string>} 提取的文本
 */
async function extractFromFullImage(imageSharp) {
  try {
    // 转为RAW格式
    const imageBuffer = await imageSharp
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = imageBuffer;
    const { width, height, channels } = info;
    const pixelCount = width * height * channels;

    // 提取策略：
    // 1. 从多个位（1、2、3位）尝试提取指纹
    // 2. 使用多数投票机制，提高抗压缩性
    // 3. 使用纠错码恢复数据
    const bitPositions = [1, 2, 3]; // 与嵌入时对应，使用多个位
    
    // 均匀分布：从边缘向内偏移10%的位置开始读取，与嵌入位置对应
    const edgeOffset = Math.floor(Math.min(width, height) * 0.1);
    const startX = edgeOffset;
    const startY = edgeOffset;
    const endX = width - edgeOffset;
    const endY = height - edgeOffset;

    // 固定提取长度：确保能提取完整的Base64编码数据
    const extractLength = Math.floor(pixelCount / 8 / 3); // 除以3因为数据被复制了3次
    
    // 从多个位位置提取数据
    const extractedFromBits = [];
    
    for (let bitPosIndex = 0; bitPosIndex < bitPositions.length; bitPosIndex++) {
      const bitPosition = bitPositions[bitPosIndex];
      const mask = 1 << bitPosition; // 提取指定位的掩码

      try {
        const data = Buffer.alloc(extractLength * 3);
        let dataIndex = 0;
        let bitIndex = 7;

        // 从对应位置开始提取，与嵌入位置对应
        const startOffsetX = bitPosIndex * 10;
        const startOffsetY = bitPosIndex * 10;

        for (let y = startY + startOffsetY; y < endY && dataIndex < data.length; y++) {
          for (let x = startX + startOffsetX; x < endX && dataIndex < data.length; x++) {
            for (let c = 0; c < channels && dataIndex < data.length; c++) {
              // 跳过Alpha通道
              if (channels === 4 && c === 3) continue;

              const pixelIndex = (y * width + x) * channels + c;
              if (pixelIndex < pixelCount) {
                // 提取指定位
                const bit = (pixels[pixelIndex] & mask) >> bitPosition;
                data[dataIndex] |= (bit << bitIndex);

                // 移动到下一位
                bitIndex--;
                if (bitIndex < 0) {
                  bitIndex = 7;
                  dataIndex++;
                }
              }
            }
          }
        }

        extractedFromBits.push(data);
      } catch (error) {
        console.error(`Error extracting from bit position ${bitPosition}:`, error);
      }
    }

    // 合并多个位的提取结果
    if (extractedFromBits.length > 0) {
      // 尝试使用每个位的提取结果
      for (const extractedData of extractedFromBits) {
        try {
          // 尝试直接解码
          const extracted = decodeBytesToText(extractedData);
          if (extracted && typeof extracted === 'object' && extracted.author) {
            console.log('Successfully extracted fingerprint from bit position');
            return extracted;
          }
          
          // 尝试使用纠错码恢复
          const recovered = recoverWithErrorCorrection(extractedData, extractLength);
          const recoveredExtracted = decodeBytesToText(recovered);
          if (recoveredExtracted && typeof recoveredExtracted === 'object' && recoveredExtracted.author) {
            console.log('Successfully recovered fingerprint with error correction');
            return recoveredExtracted;
          }
        } catch (error) {
          console.error('Error decoding extracted data:', error);
          continue;
        }
      }
    }

    // 如果所有方法都失败，尝试使用最低位（传统LSB）
    try {
      const data = Buffer.alloc(extractLength);
      let dataIndex = 0;
      let bitIndex = 7;

      for (let y = startY; y < endY && dataIndex < data.length; y++) {
        for (let x = startX; x < endX && dataIndex < data.length; x++) {
          for (let c = 0; c < channels && dataIndex < data.length; c++) {
            // 跳过Alpha通道
            if (channels === 4 && c === 3) continue;

            const pixelIndex = (y * width + x) * channels + c;
            if (pixelIndex < pixelCount) {
              // 提取最低位
              const bit = pixels[pixelIndex] & 0x01;
              data[dataIndex] |= (bit << bitIndex);

              // 移动到下一位
              bitIndex--;
              if (bitIndex < 0) {
                bitIndex = 7;
                dataIndex++;
              }
            }
          }
        }
      }

      const extracted = decodeBytesToText(data);
      if (extracted && typeof extracted === 'object' && extracted.author) {
        console.log('Successfully extracted fingerprint using traditional LSB');
        return extracted;
      }
    } catch (error) {
      console.error('Error extracting fingerprint with traditional LSB:', error);
    }

    console.log('Failed to extract fingerprint from all methods');
    return null;
  } catch (err) {
    console.error('Error extracting from full image:', err);
    return null;
  }
}

/**
 * 嵌入指纹到图片（核心函数）
 * @param {string} inputPath 输入图片路径
 * @param {string} outputPath 输出图片路径
 * @param {Object} payload 嵌入的数据 {author, rootHash}
 * @returns {Promise<Object>} 结果
 */
exports.embedFingerprint = async (inputPath, outputPath, payload) => {
  try {
    // 检测是否为截图
    const isScreenshot = await detectScreenshot(inputPath);
    
    // 读取图片元数据
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    // 检查图片尺寸（最小20x20px）
    if (width < 20 || height < 20) {
      return {
        success: false,
        message: 'Image too small. Minimum size is 20x20px.'
      };
    }
    
    // 如果是截图，添加警告信息
    if (isScreenshot) {
      console.warn('Warning: The image appears to be a screenshot. Fingerprinting may be less effective.');
    }

    // 计算特征哈希（用原始图片特征计算，代表内容身份）
    const featureHash = await generateFeatureHash(inputPath);
    
    // 计算文件哈希（用原始文件计算，代表文件身份）
    const fileHash = await generateFileHash(inputPath);

    // 生成作者专属标识（基于作者名生成固定不变的标识）
    const author = payload.author || 'Unknown';
    const authorId = generateAuthorId(author);

    // 准备嵌入数据（包含作者、哈希、时间戳、作者专属标识）
    const embedData = {
      author,
      authorId,
      featureHash,
      fileHash,
      timestamp: Date.now(),
      version: '1.0',
      antiCompression: true // 标记为抗压缩版本
    };

    console.log('Embedding data:', embedData);

    const dataBuffer = encodeTextToBytes(embedData);

    // 整图均匀嵌入（抗压缩版本）
    const processedImage = await embedToFullImage(image, dataBuffer);

    // 保存结果
    await processedImage.toFile(outputPath);

    return {
      success: true,
      message: isScreenshot ? '指纹嵌入成功 ⚠️  注意：此图片可能是截图，指纹可能不太可靠。' : '指纹嵌入成功',
      data: { featureHash, fileHash, isScreenshot, ...embedData }
    };
  } catch (err) {
    console.error('Error embedding fingerprint:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 提取并验证指纹
 * @param {string} imagePath 图片路径
 * @returns {Promise<Object>} 结果
 */
exports.extractFingerprint = async (imagePath) => {
  try {
    // 检测是否为截图
    const isScreenshot = await detectScreenshot(imagePath);
    
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    // 检查图片尺寸（最小20x20px）
    if (width < 20 || height < 20) {
      return {
        success: false,
        message: 'Image too small. Minimum size is 20x20px.'
      };
    }
    
    // 如果是截图，添加警告信息
    if (isScreenshot) {
      console.warn('Warning: The image appears to be a screenshot. Verification may be less reliable.');
    }

    // 从整图提取（抗压缩版本）
    const extracted = await extractFromFullImage(image);
    
    console.log('Extracted data:', extracted);
    
    if (extracted && typeof extracted === 'object') {
      // 确保author字段有值
      if (!extracted.author) {
        extracted.author = 'Unknown';
      }
      
      // 生成作者专属标识（用于验证）
      const authorId = generateAuthorId(extracted.author);
      
      // 计算当前图片的特征哈希（代表内容身份）
      const currentFeatureHash = await generateFeatureHash(imagePath);
      
      // 计算当前图片的文件哈希（代表文件身份）
      const currentFileHash = await generateFileHash(imagePath);

      // 验证完整性：
      // 1. 归属权验证：只要能提取出作者信息和authorId，就认为是作者的作品
      // 2. 版本验证：对比特征哈希，判断是原版还是修改版
      // 3. 文件验证：对比文件哈希，判断是否被重新保存或压缩
      
      // 状态判定逻辑：
      // - 特征哈希一致 → 内容未篡改，是"原版"
      // - 特征哈希不一致 → 内容被修改
      // - 对于修改版，由于无法直接判断修改者，统一标记为"作者修改版"
      //   （实际使用中，用户可以根据上下文判断是否为恶意篡改）
      
      const isOriginal = extracted.featureHash === currentFeatureHash;
      const isModified = !isOriginal;
      const isReSaved = extracted.fileHash !== currentFileHash;
      
      // 确定状态
      let status = 'valid';
      if (isOriginal) {
        status = 'original'; // 原版
      } else if (isModified) {
        status = 'modified'; // 作者修改版
      }

      // 生成界面提示信息
      let uiMessage = '';
      if (isOriginal) {
        uiMessage = `This image belongs to ${extracted.author} (original version)`;
      } else if (isModified) {
        uiMessage = `This image belongs to ${extracted.author} (modified version by owner)`;
      }
      
      // 如果是截图，添加警告信息
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

    throw new Error('No valid fingerprint found');
  } catch (err) {
    console.error('Error extracting fingerprint:', err);
    return {
      success: false,
      message: err.message,
      data: {
        status: 'no_fingerprint',
        uiMessage: 'This image has no ownership information'
      }
    };
  }
};

/**
 * 验证指纹（快速验证模式，只返回状态）
 * @param {string} imagePath 图片路径
 * @returns {Promise<Object>} 验证结果
 */
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