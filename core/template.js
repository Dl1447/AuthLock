const fs = require('fs');
const path = require('path');

/**
 * 生成 DMCA 投诉模板
 * @param {Object} data - 投诉信息
 * @returns {string} - DMCA 投诉模板内容
 */
exports.generateDMCA = (data) => {
  const now = new Date().toISOString().split('T')[0];
  
  // 验证并格式化时间戳
  let formattedTimestamp = '[Unknown]';
  if (data.timestamp) {
    try {
      formattedTimestamp = new Date(data.timestamp).toISOString();
    } catch (error) {
      formattedTimestamp = data.timestamp.toString();
    }
  }

  return `DMCA COPYRIGHT INFRINGEMENT NOTICE

Date: ${now}

To: [Service Provider]

Re: Notice of Copyright Infringement

I am writing to notify you that I believe my copyrighted work is being infringed upon on your service. Please take immediate action to remove or disable access to the infringing material as required by the Digital Millennium Copyright Act (DMCA).

1. IDENTIFICATION OF COPYRIGHTED WORK
The copyrighted work in question is my original creation: [Work Title]

2. IDENTIFICATION OF INFRINGING MATERIAL
The infringing material is located at:
[URL of Infringing Material]

3. AUTHORIZED REPRESENTATIVE
I am the author and copyright owner of the work, or I am authorized to act on behalf of the owner.

4. CONTACT INFORMATION
Name: ${data.author}
Email: ${data.email || '[Your Email]'}
Address: ${data.address || '[Your Address]'}
Phone: ${data.phone || '[Your Phone Number]'}

5. STATEMENTS
I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law.

I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.

6. FINGERPRINT EVIDENCE
Original Work Hash: ${data.featureHash || data.rootHash || '[Unknown]'}
Creation Timestamp: ${formattedTimestamp}
Verification Status: ${data.isTampered ? 'TAMPERED' : 'VALID'}

7. SIGNATURE
${data.author}
[Digital Signature]
`;
};

/**
 * 生成中国版权投诉模板
 * @param {Object} data - 投诉信息
 * @returns {string} - 中国版权投诉模板内容
 */
exports.generateChineseCopyrightNotice = (data) => {
  const now = new Date().toISOString().split('T')[0];
  
  // 验证并格式化时间戳
  let formattedTimestamp = '[Unknown]';
  if (data.timestamp) {
    try {
      formattedTimestamp = new Date(data.timestamp).toISOString();
    } catch (error) {
      formattedTimestamp = data.timestamp.toString();
    }
  }
  
  return `中国版权侵权投诉函

日期：${now}

致：[服务提供商]

关于：版权侵权投诉

我特此通知贵方，我认为我的 copyrighted 作品在贵方服务上被侵权。请根据《中华人民共和国著作权法》的相关规定，立即采取措施删除或屏蔽访问侵权材料。

1. 版权作品信息
被侵权作品为我的原创作品：[作品名称]

2. 侵权材料信息
侵权材料位于：
[侵权材料链接]

3. 授权代表
我是该作品的作者和版权所有者，或我有权代表版权所有者采取行动。

4. 联系信息
姓名：${data.author}
邮箱：${data.email || '[您的邮箱]'}
地址：${data.address || '[您的地址]'}
电话：${data.phone || '[您的电话号码]'}

5. 声明
我有合理理由相信上述版权材料的使用未经版权所有者、其代理人或法律授权。

我保证，本通知中的信息准确无误，并且我是版权所有者或有权代表版权所有者就所称侵权行为采取行动。

6. 指纹证据
原始作品哈希值：${data.featureHash || data.rootHash || '[Unknown]'}
创建时间戳：${formattedTimestamp}
验证状态：${data.isTampered ? '已篡改' : '有效'}

7. 签名
${data.author}
[电子签名]
`;
};

/**
 * 保存模板到文件
 * @param {string} content - 模板内容
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<void>}
 */
exports.saveTemplate = async (content, outputPath) => {
  try {
    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 写入文件
    await fs.promises.writeFile(outputPath, content, 'utf8');
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
};