// Background Script - 管理学习模式状态和数据存储
console.log('AI浏览器自动化助手 - Background Script 已加载');

// 学习模式状态
let isLearningMode = false;
let learningData = [];

// 初始化
chrome.runtime.onInstalled.addListener(function() {
    console.log('AI浏览器自动化助手已安装');
    
    // 初始化存储
    chrome.storage.local.set({
        isLearningMode: false,
        learningData: []
    });
});

// 监听来自content script和sidepanel的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Background收到消息:', request);
    
    switch (request.action) {
        case 'getLearningStatus':
            // 返回学习模式状态
            sendResponse({
                isLearningMode: isLearningMode,
                learningData: learningData
            });
            break;
            
        case 'saveLearningData':
            // 保存学习数据
            if (request.data) {
                learningData.push(request.data);
                
                // 保存到本地存储
                chrome.storage.local.set({
                    learningData: learningData
                });
                
                console.log('保存学习数据:', request.data);
                console.log('总记录数:', learningData.length);
            }
            sendResponse({success: true});
            break;
            
        case 'clearLearningData':
            // 清空学习数据
            learningData = [];
            chrome.storage.local.set({
                learningData: []
            });
            sendResponse({success: true});
            break;
            
        case 'exportLearningData':
            // 导出学习数据
            const dataStr = JSON.stringify(learningData, null, 2);
            sendResponse({
                success: true,
                data: dataStr
            });
            break;
            
        default:
            sendResponse({error: '未知操作'});
    }
});

// 监听存储变化
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local') {
        if (changes.isLearningMode) {
            isLearningMode = changes.isLearningMode.newValue;
            console.log('学习模式状态更新:', isLearningMode);
        }
        
        if (changes.learningData) {
            learningData = changes.learningData.newValue || [];
            console.log('学习数据更新，记录数:', learningData.length);
        }
    }
});

// 页面加载时检查状态
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        // 向content script发送当前学习模式状态
        chrome.tabs.sendMessage(tabId, {
            action: 'getLearningStatus',
            isLearningMode: isLearningMode
        }).catch(() => {
            // content script可能还没有加载，忽略错误
        });
    }
});

// 处理扩展图标点击
chrome.action.onClicked.addListener(function(tab) {
    // 打开sidepanel
    chrome.sidePanel.open({tabId: tab.id});
});

// 处理tab更新
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        // 页面加载完成后，检查是否需要注入content script
        chrome.storage.local.get(['isLearningMode'], function(result) {
            if (result.isLearningMode) {
                // 如果学习模式开启，通知content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'startLearning'
                }).catch(() => {
                    // 如果content script还没有加载，忽略错误
                });
            }
        });
    }
});

// 处理tab激活
chrome.tabs.onActivated.addListener(function(activeInfo) {
    // 当切换tab时，检查学习模式状态
    chrome.storage.local.get(['isLearningMode'], function(result) {
        if (result.isLearningMode) {
            chrome.tabs.sendMessage(activeInfo.tabId, {
                action: 'startLearning'
            }).catch(() => {
                // 忽略错误
            });
        }
    });
}); 