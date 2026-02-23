const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('authlock', {
  // 嵌入指纹
  embedFingerprint: async (inputPath, outputPath, author) => {
    return await ipcRenderer.invoke('embed-fingerprint', inputPath, outputPath, author);
  },
  
  // 验证指纹
  verifyFingerprint: async (imagePath) => {
    return await ipcRenderer.invoke('verify-fingerprint', imagePath);
  },
  
  // 生成维权模板
  generateTemplate: async (type, data, outputPath) => {
    return await ipcRenderer.invoke('generate-template', type, data, outputPath);
  },
  
  // 选择文件
  selectFile: async (filters, properties) => {
    return await ipcRenderer.invoke('select-file', filters, properties);
  },
  
  // 保存文件
  saveFile: async (filters, defaultPath) => {
    return await ipcRenderer.invoke('save-file', filters, defaultPath);
  },
  
  // 窗口控制
  closeWindow: () => {
    ipcRenderer.send('close-window');
  },
  
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window');
  },
  
  maximizeWindow: () => {
    ipcRenderer.send('maximize-window');
  },
  
  // 截图功能
  takeScreenshot: async () => {
    return await ipcRenderer.invoke('take-screenshot');
  }
});