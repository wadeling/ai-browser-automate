// 学习模式状态管理
let isLearningMode = false;
let learningData = [];
let recordCount = 0;

// 路径可视化相关变量
let pathCanvasCtx = null;
let pathScale = 1;
let pathOffsetX = 0;
let pathOffsetY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let selectedNode = null;
let hoveredNode = null;
let isCurvedPath = false;
let tooltipTimeout = null;

// 节点配置
const nodeConfig = {
    radius: 25,
    spacing: 200,
    textMaxLength: 20,
    textLineHeight: 15,
    colors: {
        click: '#28a745',
        input: '#007bff',
        change: '#ffc107',
        submit: '#dc3545',
        table: '#6f42c1'
    }
};

// DOM元素
const startBtn = document.getElementById('startLearning');
const stopBtn = document.getElementById('stopLearning');
const statusIndicator = document.getElementById('status');
const statusIcon = statusIndicator.querySelector('.status-icon');
const statusText = statusIndicator.querySelector('.status-text');
const recordsTableBody = document.getElementById('recordsTableBody');
const clearRecordsBtn = document.getElementById('clearRecords');
const exportRecordsBtn = document.getElementById('exportRecords');
const viewPathBtn = document.getElementById('viewPath');

// 路径可视化相关元素
const pathModal = document.getElementById('pathModal');
const pathCanvas = document.getElementById('pathCanvas');
const closePathModal = document.getElementById('closePathModal');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetViewBtn = document.getElementById('resetView');
const toggleCurveBtn = document.getElementById('toggleCurve');
const pathSummary = document.getElementById('pathSummary');
const nodeTooltip = document.getElementById('nodeTooltip');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 从存储中恢复状态
    chrome.storage.local.get(['isLearningMode', 'learningData'], function(result) {
        isLearningMode = result.isLearningMode || false;
        learningData = result.learningData || [];
        recordCount = learningData.length;
        updateUI();
        loadRecordsToTable();
    });
    
    // 绑定按钮事件
    startBtn.addEventListener('click', startLearningMode);
    stopBtn.addEventListener('click', stopLearningMode);
    clearRecordsBtn.addEventListener('click', clearRecords);
    exportRecordsBtn.addEventListener('click', exportRecords);
    viewPathBtn.addEventListener('click', showPathVisualization);
    
    // 绑定路径可视化事件
    closePathModal.addEventListener('click', hidePathModal);
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    resetViewBtn.addEventListener('click', resetView);
    toggleCurveBtn.addEventListener('click', toggleCurvePath);
    
    // 点击模态框外部关闭
    pathModal.addEventListener('click', function(e) {
        if (e.target === pathModal) {
            hidePathModal();
        }
    });
});

// 开启学习模式
function startLearningMode() {
    isLearningMode = true;
    learningData = [];
    recordCount = 0;
    
    // 清空表格
    clearTable();
    
    // 更新UI
    updateUI();
    
    // 保存状态
    chrome.storage.local.set({
        isLearningMode: true,
        learningData: []
    });
    
    // 通知content script开始学习
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'startLearning'
            });
        }
    });
    
    // 显示通知
    showNotification('学习模式已开启', '开始记录您的操作行为...');
}

// 结束学习模式
function stopLearningMode() {
    isLearningMode = false;
    
    // 更新UI
    updateUI();
    
    // 保存状态
    chrome.storage.local.set({
        isLearningMode: false,
        learningData: learningData
    });
    
    // 通知content script停止学习
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'stopLearning'
            });
        }
    });
    
    // 显示学习结果
    showLearningResults();
    
    // 显示通知
    showNotification('学习模式已结束', `记录了 ${learningData.length} 个操作`);
}

// 更新UI状态
function updateUI() {
    if (isLearningMode) {
        // 学习模式开启状态
        startBtn.disabled = true;
        stopBtn.disabled = false;
        viewPathBtn.disabled = true; // 学习时禁用路径查看
        
        statusIndicator.className = 'status-indicator learning';
        statusIcon.textContent = '🎯';
        statusText.textContent = '正在学习...';
        
        startBtn.style.opacity = '0.6';
        stopBtn.style.opacity = '1';
        viewPathBtn.style.opacity = '0.6';
    } else {
        // 学习模式关闭状态
        startBtn.disabled = false;
        stopBtn.disabled = true;
        viewPathBtn.disabled = learningData.length === 0; // 没有记录时禁用
        
        statusIndicator.className = 'status-indicator stopped';
        statusIcon.textContent = '⏸️';
        statusText.textContent = '等待开始学习...';
        
        startBtn.style.opacity = '1';
        stopBtn.style.opacity = '0.6';
        viewPathBtn.style.opacity = learningData.length === 0 ? '0.6' : '1';
    }
}

// 添加记录到表格
function addRecordToTable(record) {
    const row = document.createElement('tr');
    
    const time = new Date(record.timestamp).toLocaleTimeString();
    const typeClass = `record-type ${record.type}`;
    const typeText = getTypeText(record.type);
    
    // 处理table信息
    let tableInfo = '';
    if (record.element.table) {
        const table = record.element.table;
        const position = table.elementPosition;
        if (position) {
            tableInfo = `第${position.row}行第${position.column}列`;
        }
        if (table.caption) {
            tableInfo += ` (${table.caption})`;
        }
    }
    
    row.innerHTML = `
        <td>${++recordCount}</td>
        <td><span class="${typeClass}">${typeText}</span></td>
        <td title="${record.description}">${truncateText(record.description, 30)}</td>
        <td title="${record.element.xpath}">${truncateText(record.element.xpath, 25)}</td>
        <td title="${record.element.selector}">${truncateText(record.element.selector, 25)}</td>
        <td title="${tableInfo || '不在表格中'}">${truncateText(tableInfo || '无', 20)}</td>
        <td>${time}</td>
    `;
    
    recordsTableBody.appendChild(row);
    
    // 滚动到底部
    const tableWrapper = document.querySelector('.table-wrapper');
    tableWrapper.scrollTop = tableWrapper.scrollHeight;
}

// 清空表格
function clearTable() {
    recordsTableBody.innerHTML = '';
    recordCount = 0;
}

// 加载记录到表格
function loadRecordsToTable() {
    clearTable();
    learningData.forEach(record => {
        addRecordToTable(record);
    });
}

// 清空记录
function clearRecords() {
    if (confirm('确定要清空所有记录吗？')) {
        learningData = [];
        recordCount = 0;
        clearTable();
        
        // 保存到存储
        chrome.storage.local.set({
            learningData: []
        });
        
        // 更新UI状态
        updateUI();
        
        showNotification('记录已清空', '所有学习记录已被删除');
    }
}

// 导出记录
function exportRecords() {
    if (learningData.length === 0) {
        alert('没有可导出的记录');
        return;
    }
    
    const dataStr = JSON.stringify(learningData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learning-records-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showNotification('导出成功', `已导出 ${learningData.length} 条记录`);
}

// 获取操作类型文本
function getTypeText(type) {
    const typeMap = {
        'click': '点击',
        'input': '输入',
        'change': '选择',
        'submit': '提交'
    };
    return typeMap[type] || type;
}

// 截断文本
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// 显示学习结果
function showLearningResults() {
    if (learningData.length === 0) {
        alert('没有记录到任何操作数据');
        return;
    }
    
    let resultText = `学习完成！\n\n记录了 ${learningData.length} 个操作：\n\n`;
    
    learningData.forEach((action, index) => {
        resultText += `${index + 1}. ${action.type}: ${action.description}\n`;
        resultText += `   XPath: ${action.element.xpath}\n`;
        resultText += `   Selector: ${action.element.selector}\n\n`;
    });
    
    resultText += '\n数据已保存到本地存储。';
    
    alert(resultText);
}

// 显示通知
function showNotification(title, message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(40, 167, 69, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'recordAction' && isLearningMode) {
        // 记录操作数据
        const record = {
            type: request.type,
            description: request.description,
            timestamp: request.timestamp || new Date().toISOString(),
            url: request.url,
            element: request.element
        };
        
        learningData.push(record);
        
        // 添加到表格
        addRecordToTable(record);
        
        // 更新存储
        chrome.storage.local.set({
            learningData: learningData
        });
        
        // 更新状态显示
        statusText.textContent = `正在学习... (${learningData.length} 个操作)`;
    }
});

// ==================== 路径可视化功能 ====================

// 处理学习记录聚合
function aggregateLearningData() {
    const aggregatedData = [];
    let currentGroup = null;
    
    learningData.forEach((record, index) => {
        const isTableElement = record.element.table;
        
        if (isTableElement) {
            // 检查是否与当前组是同一个table
            if (currentGroup && 
                currentGroup.tableId === record.element.table.xpath) {
                // 添加到当前组
                currentGroup.records.push(record);
                currentGroup.count++;
            } else {
                // 保存当前组（如果存在）
                if (currentGroup) {
                    aggregatedData.push(currentGroup);
                }
                
                // 创建新组
                currentGroup = {
                    type: 'table',
                    records: [record],
                    count: 1,
                    tableId: record.element.table.xpath,
                    tableInfo: record.element.table,
                    timestamp: record.timestamp,
                    description: `表格操作 (${record.element.table.caption || '未命名表格'})`,
                    url: record.url
                };
            }
        } else {
            // 非table元素，保存当前组（如果存在）
            if (currentGroup) {
                aggregatedData.push(currentGroup);
                currentGroup = null;
            }
            
            // 添加非table记录
            aggregatedData.push({
                type: 'single',
                record: record,
                count: 1,
                timestamp: record.timestamp,
                description: record.description,
                url: record.url
            });
        }
    });
    
    // 保存最后一个组
    if (currentGroup) {
        aggregatedData.push(currentGroup);
    }
    
    return aggregatedData;
}

// 显示路径可视化
function showPathVisualization() {
    if (learningData.length === 0) {
        alert('没有可显示的操作记录');
        return;
    }
    
    // 显示模态框
    pathModal.classList.add('show');
    
    // 初始化Canvas
    initPathCanvas();
    
    // 绘制路径
    drawPath();
    
    // 更新路径信息
    updatePathInfo();
}

// 隐藏路径可视化
function hidePathModal() {
    pathModal.classList.remove('show');
    selectedNode = null;
    hoveredNode = null;
    hideNodeTooltip();
    isCurvedPath = false;
    toggleCurveBtn.textContent = '🔄 切换弯曲';
}

// 初始化Canvas
function initPathCanvas() {
    const canvas = pathCanvas;
    const container = canvas.parentElement;
    
    // 设置Canvas尺寸
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // 获取2D上下文
    pathCanvasCtx = canvas.getContext('2d');
    
    // 重置变换
    pathScale = 1;
    pathOffsetX = 0;
    pathOffsetY = 0;
    
    // 绑定鼠标事件
    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('click', handleNodeClick);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mouseleave', handleMouseLeave);
}

// 绘制路径
function drawPath() {
    if (!pathCanvasCtx) return;
    
    const ctx = pathCanvasCtx;
    const canvas = pathCanvas;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 应用变换
    ctx.save();
    ctx.translate(pathOffsetX, pathOffsetY);
    ctx.scale(pathScale, pathScale);
    
    // 获取聚合数据
    const aggregatedData = aggregateLearningData();
    
    // 计算节点位置
    const positions = calculateNodePositions(canvas, aggregatedData);
    
    // 绘制连接线
    for (let i = 1; i < aggregatedData.length; i++) {
        const prevPos = positions[i - 1];
        const currPos = positions[i];
        drawConnectionLine(prevPos.x, prevPos.y, currPos.x, currPos.y);
    }
    
    // 绘制节点并更新边界信息
    aggregatedData.forEach((item, index) => {
        const pos = positions[index];
        if (item.type === 'table') {
            drawTableNode(pos.x, pos.y, item, index);
        } else {
            drawSingleNode(pos.x, pos.y, item, index);
        }
    });
    
    ctx.restore();
    
    // 重新绑定聚合数据到全局变量，供事件处理使用
    window.currentAggregatedData = aggregatedData;
}

// 计算节点位置
function calculateNodePositions(canvas, aggregatedData) {
    const positions = [];
    const totalNodes = aggregatedData.length;
    
    if (isCurvedPath && totalNodes > 3) {
        // 弯曲路径：使用蛇形布局
        const rows = Math.ceil(Math.sqrt(totalNodes));
        const cols = Math.ceil(totalNodes / rows);
        const startX = (canvas.width / pathScale - pathOffsetX / pathScale) / 2 - (cols * nodeConfig.spacing) / 2;
        const startY = (canvas.height / pathScale - pathOffsetY / pathScale) / 2 - (rows * nodeConfig.spacing) / 2;
        
        for (let i = 0; i < totalNodes; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = startX + col * nodeConfig.spacing;
            const y = startY + row * nodeConfig.spacing;
            positions.push({ x, y });
        }
    } else {
        // 直线路径
        const startX = (canvas.width / pathScale - pathOffsetX / pathScale) / 2 - (totalNodes - 1) * nodeConfig.spacing / 2;
        const startY = (canvas.height / pathScale - pathOffsetY / pathScale) / 2;
        
        for (let i = 0; i < totalNodes; i++) {
            const x = startX + i * nodeConfig.spacing;
            const y = startY;
            positions.push({ x, y });
        }
    }
    
    return positions;
}

// 绘制table节点
function drawTableNode(x, y, tableItem, index) {
    const ctx = pathCanvasCtx;
    const color = nodeConfig.colors.table;
    
    // 绘制table节点圆圈（稍大一些）
    const radius = nodeConfig.radius + 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 绘制table图标
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📊', x, y - 5);
    
    // 绘制操作数量
    ctx.font = 'bold 12px Arial';
    ctx.fillText(tableItem.count, x, y + 10);
    
    // 绘制table描述
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('表格操作', x, y + radius + 15);
    
    // 绘制table名称
    const tableName = tableItem.tableInfo.caption || '未命名表格';
    const lines = wrapText(tableName, nodeConfig.textMaxLength);
    lines.forEach((line, lineIndex) => {
        const lineY = y + radius + 30 + lineIndex * nodeConfig.textLineHeight;
        ctx.fillText(line, x, lineY);
    });
    
    // 存储节点信息用于点击和hover检测
    const textHeight = lines.length * nodeConfig.textLineHeight;
    tableItem._nodeBounds = {
        x: x - radius,
        y: y - radius,
        width: radius * 2,
        height: radius * 2 + 50 + textHeight,
        centerX: x,
        centerY: y
    };
}

// 绘制单个操作节点
function drawSingleNode(x, y, singleItem, index) {
    const ctx = pathCanvasCtx;
    const record = singleItem.record;
    const color = nodeConfig.colors[record.type] || '#6c757d';
    
    // 绘制节点圆圈
    ctx.beginPath();
    ctx.arc(x, y, nodeConfig.radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 绘制节点编号
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(index + 1, x, y);
    
    // 绘制操作类型
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(getTypeText(record.type), x, y + nodeConfig.radius + 15);
    
    // 绘制文本内容（从记录中提取）
    const textContent = extractTextContent(record);
    if (textContent) {
        const lines = wrapText(textContent, nodeConfig.textMaxLength);
        lines.forEach((line, lineIndex) => {
            const lineY = y + nodeConfig.radius + 35 + lineIndex * nodeConfig.textLineHeight;
            ctx.fillText(line, x, lineY);
        });
    }
    
    // 存储节点信息用于点击和hover检测
    const textHeight = textContent ? (wrapText(textContent, nodeConfig.textMaxLength).length * nodeConfig.textLineHeight) : 0;
    singleItem._nodeBounds = {
        x: x - nodeConfig.radius,
        y: y - nodeConfig.radius,
        width: nodeConfig.radius * 2,
        height: nodeConfig.radius * 2 + 50 + textHeight,
        centerX: x,
        centerY: y
    };
}

// 提取文本内容
function extractTextContent(record) {
    // 根据操作类型提取相关文本
    switch (record.type) {
        case 'click':
            return record.description.replace(/点击/, '').trim();
        case 'input':
            return record.description.replace(/输入/, '').trim();
        case 'change':
            return record.description.replace(/选择/, '').trim();
        case 'submit':
            return record.description.replace(/提交/, '').trim();
        default:
            return record.description;
    }
}

// 文本换行
function wrapText(text, maxLength) {
    if (!text || text.length <= maxLength) {
        return text ? [text] : [];
    }
    
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
        currentLine += text[i];
        if (currentLine.length >= maxLength && i < text.length - 1) {
            lines.push(currentLine);
            currentLine = '';
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines.slice(0, 3); // 最多显示3行
}

// 绘制连接线
function drawConnectionLine(x1, y1, x2, y2) {
    const ctx = pathCanvasCtx;
    
    if (isCurvedPath) {
        // 弯曲路径：使用贝塞尔曲线
        const controlPoint1 = { x: x1 + (x2 - x1) * 0.5, y: y1 };
        const controlPoint2 = { x: x2 - (x2 - x1) * 0.5, y: y2 };
        
        ctx.beginPath();
        ctx.moveTo(x1 + nodeConfig.radius, y1);
        ctx.bezierCurveTo(controlPoint1.x, controlPoint1.y, controlPoint2.x, controlPoint2.y, x2 - nodeConfig.radius, y2);
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 绘制弯曲路径的箭头
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;
        
        // 计算曲线终点处的切线方向
        const t = 0.9; // 在曲线90%处绘制箭头
        const tangentX = 3 * Math.pow(1 - t, 2) * (controlPoint1.x - (x1 + nodeConfig.radius)) +
                        6 * (1 - t) * t * (controlPoint2.x - controlPoint1.x) +
                        3 * t * t * ((x2 - nodeConfig.radius) - controlPoint2.x);
        const tangentY = 3 * Math.pow(1 - t, 2) * (controlPoint1.y - y1) +
                        6 * (1 - t) * t * (controlPoint2.y - controlPoint1.y) +
                        3 * t * t * (y2 - controlPoint2.y);
        
        const angle = Math.atan2(tangentY, tangentX);
        
        // 计算箭头位置
        const arrowX = x1 + nodeConfig.radius + (x2 - x1) * 0.9;
        const arrowY = y1 + (y2 - y1) * 0.9;
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowLength * Math.cos(angle - arrowAngle), 
                   arrowY - arrowLength * Math.sin(angle - arrowAngle));
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowLength * Math.cos(angle + arrowAngle), 
                   arrowY - arrowLength * Math.sin(angle + arrowAngle));
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 3;
        ctx.stroke();
    } else {
        // 直线路径
        ctx.beginPath();
        ctx.moveTo(x1 + nodeConfig.radius, y1);
        ctx.lineTo(x2 - nodeConfig.radius, y2);
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 绘制直线路径的箭头
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.atan2(dy, dx);
        
        const arrowX = x2 - nodeConfig.radius;
        const arrowY = y2;
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowLength * Math.cos(angle - arrowAngle), 
                   arrowY - arrowLength * Math.sin(angle - arrowAngle));
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowLength * Math.cos(angle + arrowAngle), 
                   arrowY - arrowLength * Math.sin(angle + arrowAngle));
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// 鼠标拖拽功能
function startDrag(e) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    pathCanvas.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        pathOffsetX += deltaX;
        pathOffsetY += deltaY;
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        drawPath();
        return;
    }
    
    // 检测hover
    const rect = pathCanvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pathOffsetX) / pathScale;
    const mouseY = (e.clientY - rect.top - pathOffsetY) / pathScale;
    
    // 使用全局聚合数据
    const aggregatedData = window.currentAggregatedData || aggregateLearningData();
    
    let foundNode = null;
    aggregatedData.forEach((item, index) => {
        if (item._nodeBounds) {
            const bounds = item._nodeBounds;
            if (mouseX >= bounds.x && mouseX <= bounds.x + bounds.width &&
                mouseY >= bounds.y && mouseY <= bounds.y + bounds.height) {
                foundNode = item;
                return;
            }
        }
    });
    
    // 更新hover状态
    if (foundNode !== hoveredNode) {
        hoveredNode = foundNode;
        
        if (hoveredNode) {
            // 显示tooltip
            showNodeTooltip(e, hoveredNode);
            pathCanvas.style.cursor = 'pointer';
        } else {
            // 隐藏tooltip
            hideNodeTooltip();
            pathCanvas.style.cursor = 'grab';
        }
    }
}

function endDrag() {
    isDragging = false;
    pathCanvas.style.cursor = 'grab';
}

// 鼠标滚轮缩放
function handleWheel(e) {
    e.preventDefault();
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, pathScale * scaleFactor));
    
    // 计算鼠标位置相对于Canvas的偏移
    const rect = pathCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 调整偏移以保持鼠标位置不变
    pathOffsetX = mouseX - (mouseX - pathOffsetX) * (newScale / pathScale);
    pathOffsetY = mouseY - (mouseY - pathOffsetY) * (newScale / pathScale);
    
    pathScale = newScale;
    drawPath();
}

// 鼠标离开Canvas
function handleMouseLeave() {
    isDragging = false;
    pathCanvas.style.cursor = 'grab';
}

// 节点点击处理
function handleNodeClick(e) {
    const rect = pathCanvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pathOffsetX) / pathScale;
    const mouseY = (e.clientY - rect.top - pathOffsetY) / pathScale;
    
    // 使用全局聚合数据
    const aggregatedData = window.currentAggregatedData || aggregateLearningData();
    
    // 检查点击了哪个节点
    aggregatedData.forEach((item, index) => {
        if (item._nodeBounds) {
            const bounds = item._nodeBounds;
            if (mouseX >= bounds.x && mouseX <= bounds.x + bounds.width &&
                mouseY >= bounds.y && mouseY <= bounds.y + bounds.height) {
                selectedNode = item;
                updatePathInfo();
                return;
            }
        }
    });
}

// 缩放控制
function zoomIn() {
    pathScale = Math.min(3, pathScale * 1.2);
    drawPath();
}

function zoomOut() {
    pathScale = Math.max(0.5, pathScale / 1.2);
    drawPath();
}

function resetView() {
    pathScale = 1;
    pathOffsetX = 0;
    pathOffsetY = 0;
    selectedNode = null;
    hoveredNode = null;
    hideNodeTooltip();
    isCurvedPath = false;
    toggleCurveBtn.textContent = '🔄 切换弯曲';
    drawPath();
    updatePathInfo();
}

// 更新路径信息
function updatePathInfo() {
    if (selectedNode) {
        const aggregatedData = window.currentAggregatedData || aggregateLearningData();
        const index = aggregatedData.indexOf(selectedNode) + 1;
        
        if (selectedNode.type === 'table') {
            // Table节点的信息
            const time = new Date(selectedNode.timestamp).toLocaleString();
            pathSummary.innerHTML = `
                <strong>📊 表格操作 ${index}</strong><br>
                表格名称: ${selectedNode.tableInfo.caption || '未命名表格'}<br>
                操作数量: ${selectedNode.count} 个操作<br>
                表格大小: ${selectedNode.tableInfo.rows}行 ${selectedNode.tableInfo.cells}个单元格<br>
                时间: ${time}<br>
                Table XPath: ${truncateText(selectedNode.tableInfo.xpath, 50)}<br>
                Table Selector: ${truncateText(selectedNode.tableInfo.selector, 50)}
            `;
        } else {
            // 单个操作节点的信息
            const record = selectedNode.record;
            const time = new Date(record.timestamp).toLocaleString();
            let tableInfo = '';
            if (record.element.table) {
                const table = record.element.table;
                const position = table.elementPosition;
                tableInfo = `<br>Table位置: 第${position.row}行第${position.column}列<br>Table描述: ${table.caption || '无'}`;
            }
            
            pathSummary.innerHTML = `
                <strong>操作 ${index}</strong><br>
                类型: ${getTypeText(record.type)}<br>
                描述: ${record.description}<br>
                时间: ${time}<br>
                XPath: ${truncateText(record.element.xpath, 50)}<br>
                Selector: ${truncateText(record.element.selector, 50)}${tableInfo}
            `;
        }
    } else {
        // 路径总览
        const aggregatedData = window.currentAggregatedData || aggregateLearningData();
        const tableNodes = aggregatedData.filter(item => item.type === 'table');
        const singleNodes = aggregatedData.filter(item => item.type === 'single');
        
        pathSummary.innerHTML = `
            <strong>路径总览</strong><br>
            总节点数: ${aggregatedData.length}<br>
            表格操作: ${tableNodes.length} 个<br>
            单个操作: ${singleNodes.length} 个<br>
            时间范围: ${getTimeRange()}<br>
            点击节点查看详细信息
        `;
    }
}

// 获取唯一操作类型
function getUniqueTypes() {
    const types = [...new Set(learningData.map(record => getTypeText(record.type)))];
    return types;
}

// 获取时间范围
function getTimeRange() {
    if (learningData.length === 0) return '无数据';
    
    const aggregatedData = aggregateLearningData();
    if (aggregatedData.length === 0) return '无数据';
    
    const firstTime = new Date(aggregatedData[0].timestamp);
    const lastTime = new Date(aggregatedData[aggregatedData.length - 1].timestamp);
    
    const duration = Math.round((lastTime - firstTime) / 1000);
    return `${firstTime.toLocaleTimeString()} - ${lastTime.toLocaleTimeString()} (${duration}秒)`;
}

// 弯曲路径切换
function toggleCurvePath() {
    isCurvedPath = !isCurvedPath;
    toggleCurveBtn.textContent = isCurvedPath ? '📏 切换直线' : '🔄 切换弯曲';
    drawPath();
}

// 显示节点tooltip
function showNodeTooltip(e, node) {
    const rect = pathCanvas.getBoundingClientRect();
    const tooltipX = e.clientX - rect.left + 15;
    const tooltipY = e.clientY - rect.top - 10;
    
    // 使用全局聚合数据以计算索引
    const aggregatedData = window.currentAggregatedData || aggregateLearningData();
    const index = aggregatedData.indexOf(node) + 1;
    
    let tooltipContent = '';
    
    if (node.type === 'table') {
        // Table节点的tooltip
        const time = new Date(node.timestamp).toLocaleString();
        tooltipContent = `
            <h5>📊 表格操作 ${index}</h5>
            <p><span class="tooltip-label">表格名称:</span> <span class="tooltip-value">${node.tableInfo.caption || '未命名表格'}</span></p>
            <p><span class="tooltip-label">操作数量:</span> <span class="tooltip-value">${node.count} 个操作</span></p>
            <p><span class="tooltip-label">表格大小:</span> <span class="tooltip-value">${node.tableInfo.rows}行 ${node.tableInfo.cells}个单元格</span></p>
            <p><span class="tooltip-label">时间:</span> <span class="tooltip-value">${time}</span></p>
            <p><span class="tooltip-label">Table XPath:</span> <span class="tooltip-value">${truncateText(node.tableInfo.xpath, 60)}</span></p>
            <p><span class="tooltip-label">Table Selector:</span> <span class="tooltip-value">${truncateText(node.tableInfo.selector, 60)}</span></p>
            <hr style="margin: 8px 0; border: none; border-top: 1px solid #555;">
            <h6 style="margin: 8px 0; color: #20c997;">📋 包含的操作:</h6>
        `;
        
        // 添加所有table操作
        node.records.forEach((record, recordIndex) => {
            const recordTime = new Date(record.timestamp).toLocaleTimeString();
            const position = record.element.table.elementPosition;
            tooltipContent += `
                <p style="margin: 4px 0; padding-left: 10px; border-left: 2px solid #20c997;">
                    <span class="tooltip-label">${recordIndex + 1}.</span> 
                    <span class="tooltip-value">${getTypeText(record.type)}: ${record.description}</span><br>
                    <span style="font-size: 11px; color: #aaa;">位置: 第${position.row}行第${position.column}列 | 时间: ${recordTime}</span>
                </p>
            `;
        });
    } else {
        // 单个操作节点的tooltip
        const record = node.record;
        const time = new Date(record.timestamp).toLocaleString();
        
        // 处理table信息
        let tableInfo = '';
        if (record.element.table) {
            const table = record.element.table;
            const position = table.elementPosition;
            tableInfo = `
                <p><span class="tooltip-label">Table位置:</span> <span class="tooltip-value">第${position.row}行第${position.column}列</span></p>
                <p><span class="tooltip-label">Table描述:</span> <span class="tooltip-value">${table.caption || '无'}</span></p>
                <p><span class="tooltip-label">Table大小:</span> <span class="tooltip-value">${table.rows}行 ${table.cells}个单元格</span></p>
                <p><span class="tooltip-label">Table XPath:</span> <span class="tooltip-value">${truncateText(table.xpath, 60)}</span></p>
                <p><span class="tooltip-label">Table Selector:</span> <span class="tooltip-value">${truncateText(table.selector, 60)}</span></p>
            `;
        }
        
        tooltipContent = `
            <h5>操作 ${index}</h5>
            <p><span class="tooltip-label">类型:</span> <span class="tooltip-value">${getTypeText(record.type)}</span></p>
            <p><span class="tooltip-label">描述:</span> <span class="tooltip-value">${record.description}</span></p>
            <p><span class="tooltip-label">时间:</span> <span class="tooltip-value">${time}</span></p>
            <p><span class="tooltip-label">URL:</span> <span class="tooltip-value">${record.url || '未知'}</span></p>
            <p><span class="tooltip-label">XPath:</span> <span class="tooltip-value">${record.element.xpath}</span></p>
            <p><span class="tooltip-label">Selector:</span> <span class="tooltip-value">${record.element.selector}</span></p>
            ${tableInfo}
        `;
    }
    
    nodeTooltip.innerHTML = tooltipContent;
    nodeTooltip.style.left = tooltipX + 'px';
    nodeTooltip.style.top = tooltipY + 'px';
    nodeTooltip.classList.add('show');
    
    // 清除之前的超时
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }
}

// 隐藏节点tooltip
function hideNodeTooltip() {
    nodeTooltip.classList.remove('show');
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }
} 