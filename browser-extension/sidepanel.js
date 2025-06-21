// 学习模式状态管理
let isLearningMode = false;
let learningData = [];
let recordCount = 0;

// DOM元素
const startBtn = document.getElementById('startLearning');
const stopBtn = document.getElementById('stopLearning');
const statusIndicator = document.getElementById('status');
const statusIcon = statusIndicator.querySelector('.status-icon');
const statusText = statusIndicator.querySelector('.status-text');
const recordsTableBody = document.getElementById('recordsTableBody');
const clearRecordsBtn = document.getElementById('clearRecords');
const exportRecordsBtn = document.getElementById('exportRecords');

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
        
        statusIndicator.className = 'status-indicator learning';
        statusIcon.textContent = '🎯';
        statusText.textContent = '正在学习...';
        
        startBtn.style.opacity = '0.6';
        stopBtn.style.opacity = '1';
    } else {
        // 学习模式关闭状态
        startBtn.disabled = false;
        stopBtn.disabled = true;
        
        statusIndicator.className = 'status-indicator stopped';
        statusIcon.textContent = '⏸️';
        statusText.textContent = '等待开始学习...';
        
        startBtn.style.opacity = '1';
        stopBtn.style.opacity = '0.6';
    }
}

// 添加记录到表格
function addRecordToTable(record) {
    const row = document.createElement('tr');
    
    const time = new Date(record.timestamp).toLocaleTimeString();
    const typeClass = `record-type ${record.type}`;
    const typeText = getTypeText(record.type);
    
    row.innerHTML = `
        <td>${++recordCount}</td>
        <td><span class="${typeClass}">${typeText}</span></td>
        <td title="${record.description}">${truncateText(record.description, 30)}</td>
        <td title="${record.element.xpath}">${truncateText(record.element.xpath, 25)}</td>
        <td title="${record.element.selector}">${truncateText(record.element.selector, 25)}</td>
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