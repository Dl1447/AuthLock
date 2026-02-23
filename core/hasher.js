const crypto = require('crypto');
const fs = require('fs');

/**
 * 计算文件的 SHA256 哈希值
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} - SHA256 哈希值
 */
exports.calculateFileHash = async (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        const result = hash.digest('hex');
        resolve(result);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * 计算字符串的 SHA256 哈希值
 * @param {string} data - 输入字符串
 * @returns {string} - SHA256 哈希值
 */
exports.calculateStringHash = (data) => {
  try {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  } catch (error) {
    throw error;
  }
};

/**
 * 验证哈希值是否匹配
 * @param {string} expectedHash - 期望的哈希值
 * @param {string} actualHash - 实际的哈希值
 * @returns {boolean} - 是否匹配
 */
exports.verifyHash = (expectedHash, actualHash) => {
  return expectedHash === actualHash;
};