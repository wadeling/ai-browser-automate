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

// 获取元素的XPath
function getXPath(element) {
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }
    
    if (element === document.body) {
        return '/html/body';
    }
    
    let path = '';
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousSibling;
        
        while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
                index++;
            }
            sibling = sibling.previousSibling;
        }
        
        const tagName = current.tagName.toLowerCase();
        const pathIndex = index > 1 ? `[${index}]` : '';
        path = `/${tagName}${pathIndex}${path}`;
        
        current = current.parentNode;
    }
    
    return path;
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