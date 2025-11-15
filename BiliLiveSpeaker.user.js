// ==UserScript==
// @name         B站直播监控聊天与进入信息
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  监控B站直播间弹幕及提示信息，支持TTS语音播报，实时听取直播间动态
// @author       AoEiuV020
// @homepage     https://github.com/AoEiuV020/BiliLiveSpeaker
// @match        *://live.bilibili.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 核心处理函数 ====================
    
    // TTS语音播报配置
    const MAX_USERNAME_LENGTH = 10; // 用户昵称最大长度

    /**
     * TTS语音播报函数
     * @param {string} text - 要播报的文本
     */
    function speakText(text) {
        if (!text || !window.speechSynthesis) return;
        
        // 取消当前正在播报的内容
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; // 设置中文
        utterance.rate = 1.2; // 语速
        utterance.pitch = 1; // 音调
        utterance.volume = 1; // 音量
        
        window.speechSynthesis.speak(utterance);
    }

    /**
     * 截断过长的用户昵称
     * @param {string} username - 原始用户昵称
     * @returns {string} 处理后的用户昵称
     */
    function truncateUsername(username) {
        if (username.length > MAX_USERNAME_LENGTH) {
            return username.substring(0, MAX_USERNAME_LENGTH);
        }
        return username;
    }

    /**
     * 处理弹幕消息
     * @param {string} username - 用户昵称
     * @param {string} content - 弹幕内容
     */
    function handleDanmaku(username, content) {
        const truncatedName = truncateUsername(username);
        const message = `${truncatedName}说：${content}`;
        console.log(`[弹幕] ${message}`);
        speakText(message);
    }

    /**
     * 处理提示消息
     * @param {string} message - 提示内容
     */
    function handlePrompt(message) {
        console.log(`[提示] ${message}`);
        speakText(message);
    }

    // ==================== 监控函数 ====================

    /**
     * 监控聊天列表新增弹幕
     * @returns {MutationObserver} 返回观察者对象
     */
    function monitorChatItems() {
        const chatList = document.getElementById('chat-items');
        if (!chatList) {
            console.log('未找到聊天列表元素（chat-items）');
            return;
        }

        const processedIds = new Set();

        /**
         * 处理单个弹幕项
         * @param {HTMLElement} item - 弹幕DOM元素
         */
        function processDanmakuItem(item) {
            const timestamp = item.dataset.timestamp;
            if (timestamp && processedIds.has(timestamp)) return;

            const username = item.dataset.uname || '未知用户';
            const content = item.dataset.danmaku || 
                          item.querySelector('.danmaku-item-right')?.textContent?.trim() || 
                          '无内容';

            if (timestamp) processedIds.add(timestamp);
            
            // 使用封装的处理函数
            handleDanmaku(username, content);
        }

        // 处理已存在的弹幕
        const existingItems = chatList.querySelectorAll('.chat-item.danmaku-item');
        existingItems.forEach(item => processDanmakuItem(item));

        // 监控新增弹幕
        const chatObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('.chat-item.danmaku-item')) {
                        processDanmakuItem(node);
                    } else if (node.nodeType === 1) {
                        node.querySelectorAll('.chat-item.danmaku-item').forEach(item => {
                            processDanmakuItem(item);
                        });
                    }
                });
            });
        });

        chatObserver.observe(chatList, { childList: true, subtree: true });

        return chatObserver;
    }

    /**
     * 监控提示控件内容变化
     * @returns {MutationObserver} 返回观察者对象
     */
    function monitorBrushPrompt() {
        const brushPrompt = document.getElementById('brush-prompt');
        if (!brushPrompt) {
            console.log('未找到提示控件（brush-prompt）');
            return;
        }

        // 存储当前文本，用于判断变化
        let currentText = brushPrompt.textContent.trim();
        
        // 初始播报一次当前内容
        if (currentText) {
            handlePrompt(currentText);
        }

        // 监控内容变化
        const promptObserver = new MutationObserver(() => {
            const newText = brushPrompt.textContent.trim();
            if (newText && newText !== currentText) {
                currentText = newText;
                handlePrompt(newText);
            }
        });

        // 监控子元素变化和文本内容变化
        promptObserver.observe(brushPrompt, {
            childList: true,    // 监控子元素增减
            subtree: true,      // 监控所有后代元素
            characterData: true // 监控文本节点内容变化
        });

        return promptObserver;
    }

    // ==================== 启动监控 ====================
    
    // 启动弹幕和提示监控
    const chatObserver = monitorChatItems();
    const promptObserver = monitorBrushPrompt();

    // 页面关闭时停止所有监控
    window.addEventListener('beforeunload', () => {
        chatObserver?.disconnect();
        promptObserver?.disconnect();
    });
})();