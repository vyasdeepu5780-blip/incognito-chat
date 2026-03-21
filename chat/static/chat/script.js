/* script.js */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const landingScreen = document.getElementById('landing-screen');
    const startChatBtn = document.getElementById('start-chat-btn');
    const declineBtn = document.getElementById('decline-btn');
    const loadingState = document.getElementById('loading-state');
    const landingActions = document.getElementById('landing-actions');
    const msgDeclined = document.getElementById('msg-declined');
    
    const chatScreen = document.getElementById('chat-screen');
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    const inputContainer = document.getElementById('input-container');
    const findNewBtn = document.getElementById('find-new-btn');
    
    const reportModal = document.getElementById('report-modal');
    const cancelReportBtn = document.getElementById('cancel-report-btn');
    const submitReportBtn = document.getElementById('submit-report-btn');
    
    const statusDot = document.querySelector('.dot');
    const statusText = document.querySelector('.status-text');

    let chatSocket = null;
    let isConnected = false;

    // --- State Transitions ---

    declineBtn.addEventListener('click', () => {
        landingActions.classList.add('hidden');
        msgDeclined.classList.remove('hidden');
    });

    startChatBtn.addEventListener('click', () => {
        landingActions.classList.add('hidden');
        loadingState.classList.remove('hidden');

        // Allow UI to fade, then connect
        setTimeout(() => {
            landingScreen.style.opacity = '0';
            setTimeout(() => {
                landingScreen.classList.add('hidden');
                chatScreen.classList.remove('hidden');
                chatScreen.style.opacity = '1';
                
                chatArea.innerHTML = '';
                connectWebSocket(); // Start the real-time connection
            }, 400); // Wait for fade out
        }, 800);
    });

    disconnectBtn.addEventListener('click', handleDisconnect);
    findNewBtn.addEventListener('click', () => {
        findNewBtn.classList.add('hidden');
        inputContainer.classList.remove('hidden');
        inputContainer.classList.remove('disabled');
        messageInput.value = '';
        messageInput.disabled = false;
        sendBtn.disabled = false;
        
        chatArea.innerHTML = '';
        
        statusDot.classList.remove('green-dot');
        statusDot.style.backgroundColor = '#888';
        statusText.textContent = "Connecting...";
        
        disconnectBtn.disabled = true;

        connectWebSocket();
    });

    function connectWebSocket() {
        if (chatSocket) {
            chatSocket.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        chatSocket = new WebSocket(protocol + window.location.host + '/ws/chat/');

        chatSocket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            
            if (data.type === 'system_message') {
                addSystemMessage(data.message);
                if (data.status === 'connected') {
                    statusDot.classList.add('green-dot');
                    statusDot.style.backgroundColor = '';
                    statusText.textContent = "Connected to Stranger";
                    isConnected = true;
                    disconnectBtn.disabled = false;
                } else if (data.status === 'disconnected') {
                    handleStrangerDisconnect();
                } else if (data.status === 'waiting') {
                    statusDot.classList.remove('green-dot');
                    statusDot.style.backgroundColor = '#888';
                    statusText.textContent = "Looking for someone...";
                    isConnected = false;
                }
            } else if (data.type === 'chat_message') {
                if (!data.is_me) {
                    appendIncomingMessage(data.message);
                }
            }
        };

        chatSocket.onclose = function(e) {
            console.log('Chat socket closed');
            if (isConnected) {
                handleDisconnect();
            }
        };
    }

    function handleDisconnect() {
        isConnected = false;
        if (chatSocket) chatSocket.close();
        
        inputContainer.classList.add('hidden');
        messageInput.disabled = true;
        sendBtn.disabled = true;
        
        addSystemMessage("You have disconnected.");
        
        statusDot.classList.remove('green-dot');
        statusDot.style.backgroundColor = 'var(--text-muted)';
        statusText.textContent = "Disconnected";
        
        findNewBtn.classList.remove('hidden');
    }
    
    function handleStrangerDisconnect() {
        if(!isConnected) return;
        isConnected = false;
        if (chatSocket) chatSocket.close();
        
        inputContainer.classList.add('hidden');
        messageInput.disabled = true;
        sendBtn.disabled = true;
        
        statusDot.classList.remove('green-dot');
        statusDot.style.backgroundColor = 'var(--text-muted)';
        statusText.textContent = "Disconnected";
        
        findNewBtn.classList.remove('hidden');
    }

    // --- Messaging ---

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text === '' || !isConnected || !chatSocket) return;

        // Add user message locally
        const messageEl = document.createElement('div');
        messageEl.className = 'message-wrapper outgoing';
        messageEl.innerHTML = `<div class="message message-outgoing">${escapeHTML(text)}</div>`;
        chatArea.appendChild(messageEl);

        messageInput.value = '';
        scrollToBottom();

        // Send over WebSocket
        chatSocket.send(JSON.stringify({
            'message': text
        }));
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function appendIncomingMessage(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper incoming';
        
        const innerHTML = `
            <div class="message message-incoming">
                ${escapeHTML(text)}
                <span class="flag-icon" title="Report message">&#9873;</span>
            </div>
        `;
        wrapper.innerHTML = innerHTML;
        
        const flagIcon = wrapper.querySelector('.flag-icon');
        flagIcon.addEventListener('click', openReportModal);

        chatArea.appendChild(wrapper);
        scrollToBottom();
    }

    function addSystemMessage(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper system-message-wrapper';
        wrapper.innerHTML = `<div class="system-message">${escapeHTML(text)}</div>`;
        chatArea.appendChild(wrapper);
        scrollToBottom();
    }

    // --- Moderation UI ---
    let reportedMessageNodeRow = null;

    function openReportModal(e) {
        reportedMessageNodeRow = e.target.closest('.message-wrapper');
        reportModal.classList.remove('hidden');
    }

    function closeReportModal() {
        reportModal.classList.add('hidden');
        reportedMessageNodeRow = null;
    }

    cancelReportBtn.addEventListener('click', closeReportModal);
    
    reportModal.addEventListener('click', (e) => {
        if(e.target === reportModal) closeReportModal();
    });

    submitReportBtn.addEventListener('click', () => {
        closeReportModal();
        if(reportedMessageNodeRow && reportedMessageNodeRow.parentNode) {
            const msgEl = reportedMessageNodeRow.querySelector('.message');
            if(msgEl) {
                msgEl.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Message removed by moderation system.</span>';
                msgEl.style.backgroundColor = 'transparent';
                msgEl.style.border = '1px dashed var(--text-muted)';
                const flag = msgEl.querySelector('.flag-icon');
                if (flag) flag.remove();
            }
        }
        
        setTimeout(() => {
            handleDisconnect();
            addSystemMessage("You blocked the stranger and disconnected.");
        }, 500);
    });

    // --- Helpers ---

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    }
});
