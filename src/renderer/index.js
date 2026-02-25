// 导入模块
const path = require('path');

// 全局变量
let embedImagePath = null;
let verifyImagePath = null;
let verifyResultData = null;
let selectedTemplateType = 'dmca';
let batchFiles = [];

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
  
  // 绑定批量处理相关事件
  bindBatchEvents();
  
  // 绑定设置相关事件
  bindSettingsEvents();
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
  
  // 绑定水印选项事件
  const visibleWatermarkCheckbox = document.getElementById('visible-watermark-checkbox');
  const watermarkOptions = document.getElementById('watermark-options');
  
  visibleWatermarkCheckbox.addEventListener('change', () => {
    if (visibleWatermarkCheckbox.checked) {
      watermarkOptions.classList.remove('hidden');
    } else {
      watermarkOptions.classList.add('hidden');
    }
  });
  
  // 绑定水印大小滑块事件
  const watermarkSize = document.getElementById('watermark-size');
  const watermarkSizeValue = document.getElementById('watermark-size-value');
  
  watermarkSize.addEventListener('input', () => {
    watermarkSizeValue.textContent = `${watermarkSize.value}px`;
  });
  
  // 绑定水印透明度滑块事件
  const watermarkOpacity = document.getElementById('watermark-opacity');
  const watermarkOpacityValue = document.getElementById('watermark-opacity-value');
  
  watermarkOpacity.addEventListener('input', () => {
    watermarkOpacityValue.textContent = `${Math.round(watermarkOpacity.value * 100)}%`;
  });
  
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
    
    // 检查是否选择了添加非隐形水印
    const visibleWatermark = document.getElementById('visible-watermark-checkbox').checked;
    
    // 水印选项
    let watermarkPosition = 'bottom-right';
    let watermarkSizeValue = 24;
    let watermarkColor = '#ffffff';
    let watermarkOpacityValue = 0.8;
    
    if (visibleWatermark) {
      watermarkPosition = document.getElementById('watermark-position').value;
      watermarkSizeValue = parseInt(document.getElementById('watermark-size').value);
      watermarkColor = document.getElementById('watermark-color').value;
      watermarkOpacityValue = parseFloat(document.getElementById('watermark-opacity').value);
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
      // 调用嵌入指纹方法，传递非隐形水印选项
      const result = await authlock.embedFingerprint(embedImagePath, outputPath, {
        author,
        visibleWatermark,
        watermarkPosition,
        watermarkSize: watermarkSizeValue,
        watermarkColor,
        watermarkOpacity: watermarkOpacityValue
      });
      
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
    
    // 检查是否选择了添加非隐形水印
    const visibleWatermark = document.getElementById('visible-watermark-checkbox').checked;
    
    // 水印选项
    let watermarkPosition = 'bottom-right';
    let watermarkSizeValue = 24;
    let watermarkColor = '#ffffff';
    let watermarkOpacityValue = 0.8;
    
    if (visibleWatermark) {
      watermarkPosition = document.getElementById('watermark-position').value;
      watermarkSizeValue = parseInt(document.getElementById('watermark-size').value);
      watermarkColor = document.getElementById('watermark-color').value;
      watermarkOpacityValue = parseFloat(document.getElementById('watermark-opacity').value);
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
        
        // 嵌入指纹，传递非隐形水印选项
        const embedResult = await authlock.embedFingerprint(screenshotPath, outputPath, {
          author,
          visibleWatermark,
          watermarkPosition,
          watermarkSize: watermarkSizeValue,
          watermarkColor,
          watermarkOpacity: watermarkOpacityValue
        });
        
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
    const closeBtn = statusContainer.querySelector('.close-btn');
    
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
    
    // 绑定关闭按钮事件
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        statusContainer.classList.add('hidden');
      });
    }
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
      showVerifyStatus('请先选择图片', false);
      return;
    }
    
    // 显示加载动画
    showLoading(true);
    
    try {
      // 调用验证指纹方法
      console.log('开始验证指纹:', verifyImagePath);
      const result = await authlock.verifyFingerprint(verifyImagePath);
      console.log('验证结果:', result);
      
      if (result.success) {
        console.log('验证成功，数据:', result.data);
        updateVerifyResult(result.data);
        verifyResultData = result.data;
      } else {
        console.log('验证失败:', result.message);
        showVerifyStatus(`错误: ${result.message}`, false);
      }
    } catch (error) {
      console.error('验证异常:', error);
      showVerifyStatus(`错误: ${error.message}`, false);
    } finally {
      showLoading(false);
    }
  });
  
  // 显示验证状态
  function showVerifyStatus(message, isSuccess) {
    // 确保验证结果区域存在
    let statusContainer = document.getElementById('verify-status');
    if (!statusContainer) {
      // 创建状态容器
      statusContainer = document.createElement('div');
      statusContainer.id = 'verify-status';
      statusContainer.className = 'status-card';
      
      // 创建状态标题
      const statusTitle = document.createElement('h3');
      statusTitle.className = 'status-title';
      statusTitle.textContent = '操作状态';
      statusContainer.appendChild(statusTitle);
      
      // 创建状态消息
      const statusMessage = document.createElement('p');
      statusMessage.id = 'verify-status-message';
      statusMessage.className = 'status-text';
      statusContainer.appendChild(statusMessage);
      
      // 创建关闭按钮
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      closeBtn.addEventListener('click', () => {
        statusContainer.classList.add('hidden');
      });
      statusContainer.appendChild(closeBtn);
      
      // 插入到验证区域
      const verifySection = document.getElementById('verify-section');
      const contentCard = verifySection.querySelector('.content-card');
      contentCard.appendChild(statusContainer);
    }
    
    const statusMessage = document.getElementById('verify-status-message');
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
  }
  
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
  
  // 截图验证按钮点击事件
  const verifyScreenshotBtn = document.getElementById('verify-screenshot-btn');
  verifyScreenshotBtn.addEventListener('click', async () => {
    // 显示加载动画
    showLoading(true);
    
    try {
      // 调用截图方法
      const screenshotResult = await authlock.takeScreenshot();
      
      if (screenshotResult.success) {
        const screenshotPath = screenshotResult.filePath;
        
        // 验证截图
        const verifyResult = await authlock.verifyFingerprint(screenshotPath);
        
        if (verifyResult.success) {
          updateVerifyResult(verifyResult.data);
          verifyResultData = verifyResult.data;
        } else {
          showVerifyStatus(`验证失败: ${verifyResult.message}`, false);
        }
      } else {
        showVerifyStatus(`截图失败: ${screenshotResult.message}`, false);
      }
    } catch (error) {
      showVerifyStatus(`错误: ${error.message}`, false);
    } finally {
      showLoading(false);
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
    const closeBtn = statusContainer.querySelector('.close-btn');
    
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
    
    // 绑定关闭按钮事件
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        statusContainer.classList.add('hidden');
      });
    }
  }
}

// 绑定批量处理相关事件
function bindBatchEvents() {
  const dropArea = document.getElementById('batch-drop-area');
  const selectBtn = document.getElementById('batch-select-btn');
  const processBtn = document.getElementById('batch-process-btn');
  const clearBtn = document.getElementById('batch-clear-btn');
  
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
  
  dropArea.addEventListener('drop', handleBatchDrop, false);
  
  function handleBatchDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      handleBatchFiles(Array.from(files));
    }
  }
  
  // 选择文件按钮点击事件
  selectBtn.addEventListener('click', async () => {
    const result = await authlock.selectFile([
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'bmp']
      }
    ], ['openFile', 'multiSelections']);
    
    if (result.success && result.filePaths.length > 0) {
      batchFiles = result.filePaths;
      updateBatchFileList();
    }
  });
  
  // 处理批量文件
  function handleBatchFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const imagePaths = imageFiles.map(file => file.path);
    batchFiles = [...batchFiles, ...imagePaths];
    updateBatchFileList();
  }
  
  // 更新批量文件列表
  function updateBatchFileList() {
    const fileListContainer = document.getElementById('batch-file-list');
    const filesContainer = document.getElementById('batch-files');
    
    fileListContainer.innerHTML = '';
    
    batchFiles.forEach((filePath, index) => {
      const fileName = path.basename(filePath);
      const fileItem = document.createElement('div');
      fileItem.className = 'batch-file-item';
      fileItem.innerHTML = `
        <span class="batch-file-name">${fileName}</span>
        <button class="batch-file-remove" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      `;
      fileListContainer.appendChild(fileItem);
    });
    
    // 绑定移除文件事件
    document.querySelectorAll('.batch-file-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        batchFiles.splice(index, 1);
        updateBatchFileList();
      });
    });
    
    if (batchFiles.length > 0) {
      filesContainer.classList.remove('hidden');
    } else {
      filesContainer.classList.add('hidden');
    }
  }
  
  // 清除所有文件
  clearBtn.addEventListener('click', () => {
    batchFiles = [];
    updateBatchFileList();
  });
  
  // 批量处理按钮点击事件
  processBtn.addEventListener('click', async () => {
    if (batchFiles.length === 0) {
      showBatchStatus('请先选择图片文件', false);
      return;
    }
    
    const author = document.getElementById('batch-author').value;
    if (!author) {
      showBatchStatus('请输入作者信息', false);
      return;
    }
    
    // 检查是否选择了添加非隐形水印
    const visibleWatermark = document.getElementById('batch-watermark-checkbox').checked;
    
    // 选择保存目录
    const saveResult = await authlock.selectFile([], ['openDirectory']);
    
    if (!saveResult.success || !saveResult.filePaths.length) {
      return;
    }
    
    const outputDir = saveResult.filePaths[0];
    
    // 显示加载动画和进度
    showLoading(true);
    showBatchProgress(0, `准备处理 ${batchFiles.length} 个文件...`);
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < batchFiles.length; i++) {
        const inputPath = batchFiles[i];
        const fileName = path.basename(inputPath);
        const outputPath = path.join(outputDir, fileName.replace(/\.[^/.]+$/, '') + '_watermarked.png');
        
        // 更新进度
        const progress = Math.round((i / batchFiles.length) * 100);
        showBatchProgress(progress, `处理中: ${fileName} (${i + 1}/${batchFiles.length})`);
        
        // 调用嵌入指纹方法
        const result = await authlock.embedFingerprint(inputPath, outputPath, {
          author,
          visibleWatermark
        });
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`处理失败 ${fileName}: ${result.message}`);
        }
      }
      
      // 完成处理
      showBatchProgress(100, `处理完成: 成功 ${successCount}, 失败 ${failCount}`);
      showBatchStatus(`批量处理完成: 成功 ${successCount}, 失败 ${failCount}`, successCount > 0);
    } catch (error) {
      showBatchStatus(`批量处理失败: ${error.message}`, false);
    } finally {
      showLoading(false);
    }
  });
  
  // 显示批量处理状态
  function showBatchStatus(message, isSuccess) {
    const statusContainer = document.getElementById('batch-status');
    const statusMessage = document.getElementById('batch-status-message');
    const closeBtn = statusContainer.querySelector('.close-btn');
    
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
    
    // 绑定关闭按钮事件
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        statusContainer.classList.add('hidden');
      });
    }
  }
  
  // 显示批量处理进度
  function showBatchProgress(progress, message) {
    const progressContainer = document.getElementById('batch-progress');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    
    progressBar.style.width = `${progress}%`;
    progressText.textContent = message;
    progressContainer.classList.remove('hidden');
  }
}

// 绑定设置相关事件
function bindSettingsEvents() {
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const resetSettingsBtn = document.getElementById('reset-settings-btn');
  const themeSelect = document.getElementById('theme-select');
  const accentColor = document.getElementById('accent-color');
  const outputQuality = document.getElementById('output-quality');
  const outputQualityValue = document.getElementById('output-quality-value');
  
  // 输出质量滑块事件
  outputQuality.addEventListener('input', () => {
    outputQualityValue.textContent = `${outputQuality.value}%`;
  });
  
  // 应用主题
  function applyTheme(theme) {
    const appContainer = document.querySelector('.app-container');
    const elements = {
      containers: document.querySelectorAll('.app-container, .window-header, .sidebar, .content-card, .drop-area, .batch-files'),
      inputs: document.querySelectorAll('.form-input, .form-select, .form-textarea'),
      buttons: document.querySelectorAll('.primary-btn, .secondary-btn, .nav-item'),
      texts: document.querySelectorAll('.app-name, .section-title, .form-label, .checkbox-label')
    };
    
    if (theme === 'light') {
      // 浅色主题
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#1e293b';
      
      // 容器元素
      elements.containers.forEach(el => {
        el.style.background = 'linear-gradient(135deg, #ffffff, #f1f5f9)';
        el.style.borderColor = 'rgba(0, 0, 0, 0.1)';
        el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      });
      
      // 输入元素
      elements.inputs.forEach(el => {
        el.style.background = 'linear-gradient(135deg, #ffffff, #f8fafc)';
        el.style.borderColor = 'rgba(0, 0, 0, 0.1)';
        el.style.color = '#1e293b';
      });
      
      // 文本元素
      elements.texts.forEach(el => {
        el.style.color = '#1e293b';
      });
    } else {
      // 深色主题
      document.body.style.backgroundColor = '#0f172a';
      document.body.style.color = '#ffffff';
      
      // 容器元素
      elements.containers.forEach(el => {
        el.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))';
        el.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      });
      
      // 输入元素
      elements.inputs.forEach(el => {
        el.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))';
        el.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        el.style.color = '#ffffff';
      });
      
      // 文本元素
      elements.texts.forEach(el => {
        el.style.color = '#ffffff';
      });
    }
  }
  
  // 保存设置按钮点击事件
  saveSettingsBtn.addEventListener('click', () => {
    const theme = themeSelect.value;
    const accent = accentColor.value;
    const quality = outputQuality.value;
    const autoEncrypt = document.getElementById('auto-encrypt-checkbox').checked;
    const autoTamper = document.getElementById('auto-tamper-checkbox').checked;
    const defaultOutput = document.getElementById('default-output').value;
    
    // 应用主题
    applyTheme(theme);
    
    // 保存设置（这里可以实现持久化存储）
    console.log('保存设置:', {
      theme,
      accent,
      quality,
      autoEncrypt,
      autoTamper,
      defaultOutput
    });
    
    showSettingsStatus('设置保存成功', true);
  });
  
  // 显示设置状态
  function showSettingsStatus(message, isSuccess) {
    const statusContainer = document.getElementById('settings-status');
    const statusMessage = document.getElementById('settings-status-message');
    const closeBtn = statusContainer.querySelector('.close-btn');
    
    statusMessage.textContent = message;
    statusMessage.style.color = isSuccess ? '#10b981' : '#ef4444';
    statusContainer.classList.remove('hidden');
    
    // 绑定关闭按钮事件
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        statusContainer.classList.add('hidden');
      });
    }
  }
  
  // 重置设置按钮点击事件
  resetSettingsBtn.addEventListener('click', () => {
    themeSelect.value = 'dark';
    accentColor.value = '#3b82f6';
    outputQuality.value = '90';
    outputQualityValue.textContent = '90%';
    document.getElementById('auto-encrypt-checkbox').checked = true;
    document.getElementById('auto-tamper-checkbox').checked = true;
    document.getElementById('default-output').value = 'png';
    
    showSettingsStatus('设置已重置为默认值', true);
  });
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