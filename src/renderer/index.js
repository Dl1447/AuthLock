// 全局变量
let embedImagePath = null;
let verifyImagePath = null;
let verifyResultData = null;
let selectedTemplateType = 'dmca';

// 初始化函数
function init() {
  // 绑定导航按钮事件
  bindNavEvents();
  
  // 绑定窗口控制按钮事件
  bindWindowControlEvents();
  
  // 绑定嵌入指纹相关事件
  bindEmbedEvents();
  
  // 绑定验证指纹相关事件
  bindVerifyEvents();
  
  // 绑定维权模板相关事件
  bindTemplateEvents();
}

// 绑定导航按钮事件
function bindNavEvents() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSection = btn.dataset.target;
      
      // 更新导航按钮状态
      navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 更新内容区域
      const sections = document.querySelectorAll('.section');
      sections.forEach(section => {
        section.classList.add('hidden');
      });
      
      const target = document.getElementById(targetSection);
      target.classList.remove('hidden');
    });
  });
}

// 绑定窗口控制按钮事件
function bindWindowControlEvents() {
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');
  const closeBtn = document.getElementById('close-btn');
  const windowHeader = document.getElementById('window-header');
  
  // 绑定点击事件
  minimizeBtn.addEventListener('click', () => {
    authlock.minimizeWindow();
  });
  
  maximizeBtn.addEventListener('click', () => {
    authlock.maximizeWindow();
  });
  
  closeBtn.addEventListener('click', () => {
    authlock.closeWindow();
  });
}

// 绑定嵌入指纹相关事件
function bindEmbedEvents() {
  const dropArea = document.getElementById('embed-drop-area');
  const selectBtn = document.getElementById('embed-select-btn');
  const embedBtn = document.getElementById('embed-btn');
  
  // 拖放事件
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  function highlight() {
    dropArea.classList.add('drag-over');
  }
  
  function unhighlight() {
    dropArea.classList.remove('drag-over');
  }
  
  dropArea.addEventListener('drop', handleDrop, false);
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }
  
  // 选择文件按钮点击事件
  selectBtn.addEventListener('click', async () => {
    const result = await authlock.selectFile([
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'bmp']
      }
    ], ['openFile']);
    
    if (result.success && result.filePaths.length > 0) {
      embedImagePath = result.filePaths[0];
      updateEmbedPreview();
    }
  });
  
  // 处理文件
  function handleFile(file) {
    if (file.type.startsWith('image/')) {
      embedImagePath = file.path;
      updateEmbedPreview();
    }
  }
  
  // 更新嵌入预览
  function updateEmbedPreview() {
    const previewContainer = document.getElementById('embed-image-preview');
    const previewImg = document.getElementById('embed-preview-img');
    
    previewImg.src = `file://${embedImagePath}`;
    previewContainer.classList.remove('hidden');
  }
  
  // 嵌入按钮点击事件
  embedBtn.addEventListener('click', async () => {
    if (!embedImagePath) {
      showEmbedStatus('请先选择图片', false);
      return;
    }
    
    const author = document.getElementById('author-input').value;
    if (!author) {
      showEmbedStatus('请输入作者信息', false);
      return;
    }
    
    // 选择保存路径
    const saveResult = await authlock.saveFile([
      {
        name: 'Images',
        extensions: ['png']
      }
    ], embedImagePath.replace(/\.[^/.]+$/, '') + '_watermarked.png');
    
    if (!saveResult.success || !saveResult.filePath) {
      return;
    }
    
    const outputPath = saveResult.filePath;
    
    // 显示加载动画
    showLoading(true);
    
    try {
      // 调用嵌入指纹方法
      const result = await authlock.embedFingerprint(embedImagePath, outputPath, author);
      
      if (result.success) {
        showEmbedStatus('指纹嵌入成功', true);
      } else {
        showEmbedStatus(`错误: ${result.message}`, false);
      }
    } catch (error) {
      showEmbedStatus(`错误: ${error.message}`, false);
    } finally {
      showLoading(false);
    }
  });
  
  // 截图嵌入按钮点击事件
  const embedScreenshotBtn = document.getElementById('embed-screenshot-btn');
  embedScreenshotBtn.addEventListener('click', async () => {
    const author = document.getElementById('author-input').value;
    if (!author) {
      showEmbedStatus('请输入作者信息', false);
      return;
    }
    
    // 显示加载动画
    showLoading(true);
    
    try {
      // 调用截图方法
      const screenshotResult = await authlock.takeScreenshot();
      
      if (screenshotResult.success) {
        const screenshotPath = screenshotResult.filePath;
        
        // 选择保存路径
        const saveResult = await authlock.saveFile([
          {
            name: 'Images',
            extensions: ['png']
          }
        ], screenshotPath.replace(/\.[^/.]+$/, '') + '_watermarked.png');
        
        if (!saveResult.success || !saveResult.filePath) {
          showEmbedStatus('保存失败', false);
          return;
        }
        
        const outputPath = saveResult.filePath;
        
        // 嵌入指纹
        const embedResult = await authlock.embedFingerprint(screenshotPath, outputPath, author);
        
        if (embedResult.success) {
          showEmbedStatus('截图并嵌入指纹成功', true);
        } else {
          showEmbedStatus(`错误: ${embedResult.message}`, false);
        }
      } else {
        showEmbedStatus(`截图失败: ${screenshotResult.message}`, false);
      }
    } catch (error) {
      showEmbedStatus(`错误: ${error.message}`, false);
    } finally {
      showLoading(false);
    }
  });
  
  // 显示嵌入状态
  function showEmbedStatus(message, isSuccess) {
    const statusContainer = document.getElementById('embed-status');
    const statusMessage = document.getElementById('embed-status-message');
    
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
  }
}

// 绑定验证指纹相关事件
function bindVerifyEvents() {
  const dropArea = document.getElementById('verify-drop-area');
  const selectBtn = document.getElementById('verify-select-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const generateTemplateBtn = document.getElementById('generate-template-btn');
  
  // 拖放事件
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  function highlight() {
    dropArea.classList.add('drag-over');
  }
  
  function unhighlight() {
    dropArea.classList.remove('drag-over');
  }
  
  dropArea.addEventListener('drop', handleDrop, false);
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }
  
  // 选择文件按钮点击事件
  selectBtn.addEventListener('click', async () => {
    const result = await authlock.selectFile([
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'bmp']
      }
    ], ['openFile']);
    
    if (result.success && result.filePaths.length > 0) {
      verifyImagePath = result.filePaths[0];
      updateVerifyPreview();
    }
  });
  
  // 处理文件
  function handleFile(file) {
    if (file.type.startsWith('image/')) {
      verifyImagePath = file.path;
      updateVerifyPreview();
    }
  }
  
  // 更新验证预览
  function updateVerifyPreview() {
    const previewContainer = document.getElementById('verify-image-preview');
    const previewImg = document.getElementById('verify-preview-img');
    
    previewImg.src = `file://${verifyImagePath}`;
    previewContainer.classList.remove('hidden');
  }
  
  // 验证按钮点击事件
  verifyBtn.addEventListener('click', async () => {
    if (!verifyImagePath) {
      alert('请先选择图片');
      return;
    }
    
    // 显示加载动画
    showLoading(true);
    
    try {
      // 调用验证指纹方法
      const result = await authlock.verifyFingerprint(verifyImagePath);
      
      if (result.success) {
        updateVerifyResult(result.data);
        verifyResultData = result.data;
      } else {
        alert(`错误: ${result.message}`);
      }
    } catch (error) {
      alert(`错误: ${error.message}`);
    } finally {
      showLoading(false);
    }
  });
  
  // 更新验证结果
  function updateVerifyResult(data) {
    const resultContainer = document.getElementById('verify-result');
    const statusBadge = document.getElementById('verify-status-badge');
    const authorElement = document.getElementById('verify-author');
    const timestampElement = document.getElementById('verify-timestamp');
    const originalHashElement = document.getElementById('verify-root-hash');
    const currentHashElement = document.getElementById('verify-current-hash');
    
    // 更新状态徽章
    let statusText = '';
    let statusClass = 'valid';
    
    if (data.status === 'original') {
      statusText = '原版';
      statusClass = 'valid';
    } else if (data.status === 'modified') {
      statusText = '作者修改版';
      statusClass = 'modified';
    } else if (data.status === 'no_fingerprint') {
      statusText = '无指纹';
      statusClass = 'invalid';
    } else {
      statusText = '正常';
      statusClass = 'valid';
    }
    
    statusBadge.textContent = statusText;
    statusBadge.className = `status-badge ${statusClass}`;
    
    // 更新其他信息
    authorElement.textContent = data.author || '未知';
    timestampElement.textContent = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A';
    
    // 更新特征哈希
    originalHashElement.textContent = data.featureHash || data.rootHash || '';
    currentHashElement.textContent = data.currentFeatureHash || data.currentHash || '';
    
    // 显示结果
    resultContainer.classList.remove('hidden');
  }
  
  // 生成维权模板按钮点击事件
  generateTemplateBtn.addEventListener('click', () => {
    // 切换到维权模板 section
    document.querySelector('.nav-item[data-target="template-section"]').click();
    
    // 填充作者信息
    if (verifyResultData) {
      document.getElementById('template-author').value = verifyResultData.author;
    }
  });
}

// 绑定维权模板相关事件
function bindTemplateEvents() {
  const templateBtns = document.querySelectorAll('.template-btn');
  const saveTemplateBtn = document.getElementById('save-template-btn');
  
  // 模板类型选择
  templateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      templateBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTemplateType = btn.dataset.type;
    });
  });
  
  // 保存模板按钮点击事件
  saveTemplateBtn.addEventListener('click', async () => {
    const author = document.getElementById('template-author').value;
    const email = document.getElementById('template-email').value;
    const address = document.getElementById('template-address').value;
    const phone = document.getElementById('template-phone').value;
    
    if (!author) {
      showTemplateStatus('请输入作者信息', false);
      return;
    }
    
    // 准备模板数据
    const templateData = {
      author,
      email,
      address,
      phone,
      ...verifyResultData
    };
    
    // 选择保存路径
    const saveResult = await authlock.saveFile([
      {
        name: 'Text Files',
        extensions: ['txt']
      }
    ], `copyright_notice_${selectedTemplateType}.txt`);
    
    if (!saveResult.success || !saveResult.filePath) {
      return;
    }
    
    const outputPath = saveResult.filePath;
    
    // 显示加载动画
    showLoading(true);
    
    try {
      // 调用生成模板方法
      const result = await authlock.generateTemplate(selectedTemplateType, templateData, outputPath);
      
      if (result.success) {
        showTemplateStatus('模板生成成功', true);
      } else {
        showTemplateStatus(`错误: ${result.message}`, false);
      }
    } catch (error) {
      showTemplateStatus(`错误: ${error.message}`, false);
    } finally {
      showLoading(false);
    }
  });
  
  // 显示模板状态
  function showTemplateStatus(message, isSuccess) {
    const statusContainer = document.getElementById('template-status');
    const statusMessage = document.getElementById('template-status-message');
    
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
  }
}

// 显示/隐藏加载动画
function showLoading(show) {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

// 启动初始化
window.addEventListener('DOMContentLoaded', init);