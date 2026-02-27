const lsb = require('./core/lsb.js');

async function testExtract() {
  try {
    console.log('开始测试提取指纹...');
    
    // 使用带水印的截图文件进行测试
    const testFile = './appData/temp/screenshot_1771939046048_watermarked.png';
    console.log('测试文件:', testFile);
    
    // 测试提取功能
    const result = await lsb.extractFingerprint(testFile);
    console.log('提取结果:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('测试错误:', error);
  }
}

testExtract();