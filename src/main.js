const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { DesktopCapturer, sources } = desktopCapturer;

// 全局变量用于存储屏幕截图
let globalScreenScreenshot = null;

const appDataPath = path.join(__dirname, '..', 'appData');
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}
app.setPath('userData', appDataPath);

const { embedFingerprint, extractFingerprint, verifyFingerprint } = require('../core/lsb');
const { calculateFileHash } = require('../core/hasher');
const { generateDMCA, generateChineseCopyrightNotice, saveTemplate } = require('../core/template');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    transparent: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: false,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'assets', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      enableRemoteModule: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    // Windows 11风格的窗口打开动画
    // 1. 先设置窗口为透明并缩小
    mainWindow.setOpacity(0);
    const [width, height] = mainWindow.getSize();
    mainWindow.setSize(Math.floor(width * 0.95), Math.floor(height * 0.95));
    
    // 2. 显示窗口
    mainWindow.show();
    
    // 3. 平滑过渡到正常大小和不透明度
    let opacity = 0;
    let scale = 0.95;
    const duration = 300; // 动画持续时间（毫秒）
    const frameCount = duration / 16; // 约60fps
    let frame = 0;
    
    const animationInterval = setInterval(() => {
      frame++;
      const progress = frame / frameCount;
      
      // 使用ease-out缓动函数
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      // 更新不透明度和大小
      opacity = easedProgress;
      scale = 0.95 + (0.05 * easedProgress);
      
      mainWindow.setOpacity(opacity);
      mainWindow.setSize(
        Math.floor(width * scale),
        Math.floor(height * scale)
      );
      
      // 居中窗口
      const [currentWidth, currentHeight] = mainWindow.getSize();
      const centerX = Math.floor((mainWindow.getBounds().x + (width - currentWidth) / 2));
      const centerY = Math.floor((mainWindow.getBounds().y + (height - currentHeight) / 2));
      mainWindow.setPosition(centerX, centerY);
      
      if (frame >= frameCount) {
        // 动画结束，确保窗口完全显示
        mainWindow.setOpacity(1);
        mainWindow.setSize(width, height);
        mainWindow.center();
        clearInterval(animationInterval);
      }
    }, 16); // 约60fps
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

ipcMain.handle('embed-fingerprint', async (event, inputPath, outputPath, payload) => {
  try {
    const result = await embedFingerprint(inputPath, outputPath, payload);
    return result;
  } catch (error) {
    console.error('Error embedding fingerprint:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.handle('verify-fingerprint', async (event, imagePath) => {
  try {
    const result = await verifyFingerprint(imagePath);
    return result;
  } catch (error) {
    console.error('Error verifying fingerprint:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.handle('generate-template', async (event, type, data, outputPath) => {
  try {
    let content;
    if (type === 'dmca') {
      content = generateDMCA(data);
    } else if (type === 'chinese') {
      content = generateChineseCopyrightNotice(data);
    } else {
      throw new Error('Invalid template type');
    }
    await saveTemplate(content, outputPath);
    return {
      success: true,
      message: '模板生成成功'
    };
  } catch (error) {
    console.error('Error generating template:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.handle('select-file', async (event, filters, properties) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters,
      properties
    });
    
    if (result.canceled) {
      return {
        success: false,
        message: 'User canceled file selection'
      };
    }
    
    return {
      success: true,
      filePaths: result.filePaths
    };
  } catch (error) {
    console.error('Error selecting file:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.handle('save-file', async (event, filters, defaultPath) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters,
      defaultPath
    });
    return {
      success: true,
      filePath: result.filePath
    };
  } catch (error) {
    console.error('Error saving file:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.on('close-window', () => {
  mainWindow.close();
});

ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('take-screenshot', async () => {
  try {
    // 隐藏主窗口
    mainWindow.hide();
    
    // 等待窗口完全隐藏
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 获取屏幕尺寸
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;
    
    // 获取屏幕截图（在显示截图窗口之前）
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'],
      thumbnailSize: {
        width: width,
        height: height
      }
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources found');
    }
    
    // 使用主屏幕源
    const primarySource = sources[0];
    globalScreenScreenshot = primarySource.thumbnail;
    
    // 创建一个临时窗口用于截图
    const screenshotWindow = new BrowserWindow({
      width: width,
      height: height,
      frame: false,
      show: false,
      transparent: true,
      fullscreen: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false
      }
    });
    
    // 加载截图界面
    screenshotWindow.loadFile(path.join(__dirname, 'renderer', 'screenshot.html'));
    
    // 等待窗口加载完成
    await new Promise(resolve => {
      screenshotWindow.once('ready-to-show', resolve);
    });
    
    // 显示截图窗口
    screenshotWindow.show();
    // 确保窗口获得焦点
    screenshotWindow.focus();
    
    // 等待用户完成截图
    return new Promise((resolve, reject) => {
      let screenshotHandled = false;
      
      // 监听截图完成事件
      ipcMain.once('screenshot-completed', async (event, screenshotPath) => {
        try {
          // 标记窗口已处理
          screenshotHandled = true;
          // 关闭截图窗口
          screenshotWindow.close();
          // 重新显示主窗口
          mainWindow.show();
          // 返回截图路径
          resolve({ success: true, filePath: screenshotPath });
        } catch (error) {
          console.error('Error completing screenshot:', error);
          // 确保主窗口重新显示
          mainWindow.show();
          resolve({ success: false, message: error.message });
        }
      });
      
      // 监听截图取消事件
      ipcMain.once('screenshot-canceled', () => {
        // 标记窗口已处理
        screenshotHandled = true;
        // 关闭截图窗口
        screenshotWindow.close();
        // 重新显示主窗口
        mainWindow.show();
        // 返回取消状态
        resolve({ success: false, message: 'Screenshot canceled' });
      });
      
      // 监听截图窗口错误
      screenshotWindow.on('closed', () => {
        // 重新显示主窗口
        mainWindow.show();
        // 如果没有其他事件触发，返回错误
        if (!screenshotHandled) {
          reject(new Error('Screenshot window closed unexpectedly'));
        }
      });
    });
  } catch (error) {
    console.error('Error taking screenshot:', error);
    // 确保主窗口重新显示
    if (mainWindow) {
      mainWindow.show();
    }
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources;
  } catch (error) {
    console.error('Error getting screen sources:', error);
    return [];
  }
});

ipcMain.handle('capture-selected-area', async (event, area) => {
  try {
    // 获取主屏幕尺寸
    const display = screen.getPrimaryDisplay();
    const displayWidth = display.bounds.width;
    const displayHeight = display.bounds.height;
    
    // 确保截图区域在屏幕范围内
    const safeX = Math.max(0, Math.min(area.x, displayWidth));
    const safeY = Math.max(0, Math.min(area.y, displayHeight));
    const safeWidth = Math.min(area.width, displayWidth - safeX);
    const safeHeight = Math.min(area.height, displayHeight - safeY);
    
    if (safeWidth <= 0 || safeHeight <= 0) {
      throw new Error('Invalid screenshot area');
    }
    
    // 检查是否有预捕获的屏幕截图
    if (!globalScreenScreenshot) {
      throw new Error('No screen screenshot available');
    }
    
    // 使用预捕获的屏幕截图
    const screenshot = globalScreenScreenshot;
    
    // 裁剪截图到选择的区域
    const croppedScreenshot = screenshot.crop({
      x: safeX,
      y: safeY,
      width: safeWidth,
      height: safeHeight
    });
    
    // 将NativeImage转换为Buffer
    const imageBuffer = croppedScreenshot.toPNG();
    
    // 清除全局截图变量
    globalScreenScreenshot = null;
    
    // 返回base64编码的图片数据
    return {
      success: true,
      imageData: imageBuffer.toString('base64')
    };
  } catch (error) {
    console.error('Error capturing selected area:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.handle('save-fingerprint-info', async (event, fingerprintData, outputPath) => {
  try {
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 写入指纹信息到JSON文件
    await fs.promises.writeFile(outputPath, JSON.stringify(fingerprintData, null, 2), 'utf8');
    
    return {
      success: true,
      message: '指纹信息保存成功'
    };
  } catch (error) {
    console.error('Error saving fingerprint info:', error);
    return {
      success: false,
      message: error.message
    };
  }
});