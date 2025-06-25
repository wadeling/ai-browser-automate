// Content Script - 记录用户操作
console.log('AI浏览器自动化助手 - Content Script 已加载');

let isLearningMode = false;
let clickCount = 0;
let inputCount = 0;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查学习模式状态
    chrome.runtime.sendMessage({action: 'getLearningStatus'}, function(response) {
        if (response && response.isLearningMode) {
            startLearning();
        }
    });
});

// 监听来自sidepanel的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content Script 收到消息:', request);
    
    if (request.action === 'startLearning') {
        startLearning();
        sendResponse({success: true});
    } else if (request.action === 'stopLearning') {
        stopLearning();
        sendResponse({success: true});
    }
});

// 开始学习模式
function startLearning() {
    if (isLearningMode) return;
    
    isLearningMode = true;
    clickCount = 0;
    inputCount = 0;
    
    console.log('开始学习模式');
    
    // 添加事件监听器
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);
    
    // 添加视觉指示器
    addLearningIndicator();
}

// 停止学习模式
function stopLearning() {
    if (!isLearningMode) return;
    
    isLearningMode = false;
    
    console.log('停止学习模式');
    
    // 移除事件监听器
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('submit', handleSubmit, true);
    
    // 移除视觉指示器
    removeLearningIndicator();
}

// 获取元素的CSS Selector（类似Chrome开发者工具的Copy selector）
function getCssSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    
    if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
            return `.${classes.join('.')}`;
        }
    }
    
    let path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
            selector = `#${current.id}`;
            path.unshift(selector);
            break;
        }
        
        if (current.className) {
            const classes = current.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                selector += `.${classes.join('.')}`;
            }
        }
        
        // 添加nth-child选择器
        let index = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === current.tagName) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }
        
        if (index > 1) {
            selector += `:nth-child(${index})`;
        }
        
        path.unshift(selector);
        current = current.parentElement;
    }
    
    return path.join(' > ');
}

// 处理点击事件
function handleClick(event) {
    if (!isLearningMode) return;
    
    clickCount++;
    
    const target = event.target;
    const description = getElementDescription(target);
    const xpath = getXPath(target);
    const selector = getCssSelector(target);
    
    // 获取table信息（如果元素在table中）
    const tableInfo = getTableInfo(target);
    
    // 记录点击操作
    const actionData = {
        type: 'click',
        description: `点击 ${description}`,
        url: window.location.href,
        element: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            textContent: target.textContent?.substring(0, 50),
            xpath: xpath,
            selector: selector
        },
        timestamp: new Date().toISOString(),
        position: {
            x: event.clientX,
            y: event.clientY
        }
    };
    
    // 如果元素在table中，添加table信息
    if (tableInfo) {
        actionData.element.table = tableInfo;
    }
    
    // 发送到background script
    chrome.runtime.sendMessage({
        action: 'saveLearningData',
        data: actionData
    });
    
    // 发送到sidepanel
    chrome.runtime.sendMessage({
        action: 'recordAction',
        type: 'click',
        description: `点击 ${description}`,
        url: window.location.href,
        element: actionData.element,
        timestamp: actionData.timestamp,
        position: actionData.position
    });
    
    console.log('记录点击操作:', actionData);
}

// 处理输入事件
function handleInput(event) {
    if (!isLearningMode) return;
    
    inputCount++;
    
    const target = event.target;
    const description = getElementDescription(target);
    const xpath = getXPath(target);
    const selector = getCssSelector(target);
    
    // 获取table信息（如果元素在table中）
    const tableInfo = getTableInfo(target);
    
    // 记录输入操作
    const actionData = {
        type: 'input',
        description: `在 ${description} 中输入`,
        url: window.location.href,
        element: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            placeholder: target.placeholder,
            type: target.type,
            xpath: xpath,
            selector: selector
        },
        timestamp: new Date().toISOString(),
        value: target.value?.substring(0, 100) // 限制长度
    };
    
    // 如果元素在table中，添加table信息
    if (tableInfo) {
        actionData.element.table = tableInfo;
    }
    
    // 发送到background script
    chrome.runtime.sendMessage({
        action: 'saveLearningData',
        data: actionData
    });
    
    // 发送到sidepanel
    chrome.runtime.sendMessage({
        action: 'recordAction',
        type: 'input',
        description: `在 ${description} 中输入`,
        url: window.location.href,
        element: actionData.element,
        timestamp: actionData.timestamp,
        value: actionData.value
    });
    
    console.log('记录输入操作:', actionData);
}

// 处理选择变化事件
function handleChange(event) {
    if (!isLearningMode) return;
    
    const target = event.target;
    const description = getElementDescription(target);
    const xpath = getXPath(target);
    const selector = getCssSelector(target);
    
    // 获取table信息（如果元素在table中）
    const tableInfo = getTableInfo(target);
    
    // 记录选择操作
    const actionData = {
        type: 'change',
        description: `选择 ${description}`,
        url: window.location.href,
        element: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            xpath: xpath,
            selector: selector
        },
        timestamp: new Date().toISOString(),
        value: target.value
    };
    
    // 如果元素在table中，添加table信息
    if (tableInfo) {
        actionData.element.table = tableInfo;
    }
    
    // 发送到background script
    chrome.runtime.sendMessage({
        action: 'saveLearningData',
        data: actionData
    });
    
    // 发送到sidepanel
    chrome.runtime.sendMessage({
        action: 'recordAction',
        type: 'change',
        description: `选择 ${description}`,
        url: window.location.href,
        element: actionData.element,
        timestamp: actionData.timestamp,
        value: actionData.value
    });
    
    console.log('记录选择操作:', actionData);
}

// 处理表单提交事件
function handleSubmit(event) {
    if (!isLearningMode) return;
    
    const target = event.target;
    const description = getElementDescription(target);
    const xpath = getXPath(target);
    const selector = getCssSelector(target);
    
    // 获取table信息（如果元素在table中）
    const tableInfo = getTableInfo(target);
    
    // 记录提交操作
    const actionData = {
        type: 'submit',
        description: `提交表单 ${description}`,
        url: window.location.href,
        element: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            action: target.action,
            xpath: xpath,
            selector: selector
        },
        timestamp: new Date().toISOString()
    };
    
    // 如果元素在table中，添加table信息
    if (tableInfo) {
        actionData.element.table = tableInfo;
    }
    
    // 发送到background script
    chrome.runtime.sendMessage({
        action: 'saveLearningData',
        data: actionData
    });
    
    // 发送到sidepanel
    chrome.runtime.sendMessage({
        action: 'recordAction',
        type: 'submit',
        description: `提交表单 ${description}`,
        url: window.location.href,
        element: actionData.element,
        timestamp: actionData.timestamp
    });
    
    console.log('记录提交操作:', actionData);
}

// 获取元素描述
function getElementDescription(element) {
    if (element.id) {
        return `ID为"${element.id}"的${element.tagName.toLowerCase()}`;
    }
    
    if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
            return `类名为"${classes[0]}"的${element.tagName.toLowerCase()}`;
        }
    }
    
    if (element.placeholder) {
        return `占位符为"${element.placeholder}"的${element.tagName.toLowerCase()}`;
    }
    
    if (element.textContent && element.textContent.trim()) {
        const text = element.textContent.trim().substring(0, 20);
        return `文本为"${text}"的${element.tagName.toLowerCase()}`;
    }
    
    return element.tagName.toLowerCase();
}

// 获取元素所在的table信息
function getTableInfo(element) {
    // 查找元素所在的table（向上遍历DOM树）
    let current = element;
    let tableElement = null;
    
    while (current && current !== document.body) {
        if (current.tagName === 'TABLE') {
            tableElement = current;
            break;
        }
        current = current.parentElement;
    }
    
    if (!tableElement) {
        return null;
    }
    
    // 获取table的详细信息
    const tableInfo = {
        tagName: tableElement.tagName,
        id: tableElement.id || '',
        className: tableElement.className || '',
        xpath: getXPath(tableElement),
        selector: getCssSelector(tableElement),
        rows: tableElement.rows ? tableElement.rows.length : 0,
        cells: 0
    };
    
    // 计算总单元格数
    if (tableElement.rows) {
        for (let i = 0; i < tableElement.rows.length; i++) {
            tableInfo.cells += tableElement.rows[i].cells.length;
        }
    }
    
    // 获取table的caption或第一个th作为描述
    const caption = tableElement.querySelector('caption');
    if (caption && caption.textContent.trim()) {
        tableInfo.caption = caption.textContent.trim();
    } else {
        const firstTh = tableElement.querySelector('th');
        if (firstTh && firstTh.textContent.trim()) {
            tableInfo.caption = firstTh.textContent.trim().substring(0, 50);
        }
    }
    
    // 获取元素在table中的位置信息
    const positionInfo = getElementPositionInTable(element, tableElement);
    if (positionInfo) {
        tableInfo.elementPosition = positionInfo;
    }
    
    return tableInfo;
}

// 获取元素在table中的位置信息
function getElementPositionInTable(element, tableElement) {
    let current = element;
    let rowIndex = -1;
    let cellIndex = -1;
    
    // 查找元素所在的行
    while (current && current !== tableElement) {
        if (current.tagName === 'TR') {
            rowIndex = Array.from(tableElement.rows).indexOf(current);
            break;
        }
        current = current.parentElement;
    }
    
    if (rowIndex === -1) return null;
    
    // 查找元素所在的单元格
    const row = tableElement.rows[rowIndex];
    for (let i = 0; i < row.cells.length; i++) {
        const cell = row.cells[i];
        if (cell.contains(element) || cell === element) {
            cellIndex = i;
            break;
        }
    }
    
    if (cellIndex === -1) return null;
    
    return {
        row: rowIndex + 1, // 从1开始计数
        column: cellIndex + 1, // 从1开始计数
        rowIndex: rowIndex,
        cellIndex: cellIndex
    };
}

// 获取元素的XPath（类似Chrome开发者工具的Copy full XPath）
function getXPath(element) {
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }
    
    if (element === document.body) {
        return '/html/body';
    }
    
    if (element === document.documentElement) {
        return '/html';
    }
    
    if (element === document.head) {
        return '/html/head';
    }
    
    function getElementIndex(element) {
        if (!element.parentElement) return 1;
        
        const parent = element.parentElement;
        const tagName = element.tagName.toLowerCase();
        
        // 对于html、head、body这些特殊元素，不计算索引
        if (tagName === 'html' || tagName === 'head' || tagName === 'body') {
            return 1;
        }
        
        // 计算同类型兄弟元素的索引（Chrome的行为）
        let index = 1;
        let sibling = element.previousElementSibling;
        
        while (sibling) {
            if (sibling.tagName === element.tagName) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }
        
        return index;
    }
    
    let pathSegments = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        const tagName = current.tagName.toLowerCase();
        const index = getElementIndex(current);
        
        // 对于html、head、body，不添加索引
        if (tagName === 'html' || tagName === 'head' || tagName === 'body') {
            pathSegments.unshift(tagName);
        } else {
            // 总是添加索引以确保精确匹配，即使索引是1
            pathSegments.unshift(`${tagName}[${index}]`);
        }
        
        current = current.parentElement;
        if (current === document.documentElement) break; 
    }
    
    // 确保路径以 /html 开头
    if (pathSegments[0] !== 'html') {
        pathSegments.unshift('html');
    }
    
    return '/' + pathSegments.join('/');
}

// 添加学习模式视觉指示器
function addLearningIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'ai-learning-indicator';
    indicator.innerHTML = `
        <div style="
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(40, 167, 69, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            animation: pulse 2s infinite;
        ">
            🎯 学习模式开启
        </div>
    `;
    
    document.body.appendChild(indicator);
}

// 移除学习模式视觉指示器
function removeLearningIndicator() {
    const indicator = document.getElementById('ai-learning-indicator');
    if (indicator) {
        indicator.remove();
    }
} 