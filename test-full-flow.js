const lsb = require('./core/lsb.js');
const fs = require('fs');

async function testFullFlow() {
  try {
    console.log('开始测试完整流程...');
    
    // 创建一个临时测试图片（使用现有截图）
    const inputImage = './appData/temp/screenshot_1771939046048.png';
    const outputImage = './test-output.png';
    
    console.log('输入文件:', inputImage);
    console.log('输出文件:', outputImage);
    
    // 检查输入文件是否存在
    if (!fs.existsSync(inputImage)) {
      console.error('输入文件不存在:', inputImage);
      return;
    }
    
    // 1. 嵌入指纹
    console.log('\n1. 开始嵌入指纹...');
    const embedResult = await lsb.embedFingerprint(inputImage, outputImage, {
      author: 'Test User',
      visibleWatermark: true
    });
    
    console.log('嵌入结果:', JSON.stringify(embedResult, null, 2));
    
    if (!embedResult.success) {
      console.error('嵌入失败:', embedResult.message);
      return;
    }
    
    // 2. 提取指纹
    console.log('\n2. 开始提取指纹...');
    const extractResult = await lsb.extractFingerprint(outputImage);
    
    console.log('提取结果:', JSON.stringify(extractResult, null, 2));
    
    if (extractResult.success) {
      console.log('\n✅ 测试成功！指纹提取成功');
    } else {
      console.log('\n❌ 测试失败！无法提取指纹');
    }
    
  } catch (error) {
    console.error('测试错误:', error);
  }
}

testFullFlow();