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

    // --- Tic-Tac-Toe Variables ---
    const gameSection = document.getElementById('game-section');
    const toggleGameBtn = document.getElementById('toggle-game-btn');
    const cells = document.querySelectorAll('.cell');
    const gameStatus = document.getElementById('game-status');
    
    let mySymbol = null; // Will be 'X' or 'O' assigned by server
    let currentTurn = 'X';
    let boardState = Array(9).fill(null);
    let gameActive = false;
    const winningConditions = [ [0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6] ];

    // --- State Transitions ---

    declineBtn.addEventListener('click', () => {
        landingActions.classList.add('hidden');
        msgDeclined.classList.remove('hidden');
    });

    startChatBtn.addEventListener('click', () => {
        landingActions.classList.add('hidden');
        loadingState.classList.remove('hidden');

        setTimeout(() => {
            landingScreen.style.opacity = '0';
            setTimeout(() => {
                landingScreen.classList.add('hidden');
                chatScreen.classList.remove('hidden');
                chatScreen.style.opacity = '1';
                chatArea.innerHTML = '';
                connectWebSocket(); 
            }, 400);
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
        resetGame();
        connectWebSocket();
    });

    // --- WebSocket Connection ---

    function connectWebSocket() {
        if (chatSocket) chatSocket.close();

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
                    
                    // Assign roles (X for first player, O for second)
                    mySymbol = data.role; 
                    gameActive = true;
                    resetGame();
                    updateGameStatus();
                } else if (data.status === 'disconnected') {
                    handleStrangerDisconnect();
                } else if (data.status === 'waiting') {
                    statusText.textContent = "Looking for someone...";
                    isConnected = false;
                    gameSection.classList.add('hidden');
                }
            } else if (data.type === 'chat_message') {
                if (!data.is_me) {
                    appendIncomingMessage(data.message);
                }
            } else if (data.type === 'game_move') {
                handleIncomingMove(data.index, data.symbol);
            }
        };

        chatSocket.onclose = () => { if (isConnected) handleDisconnect(); };
    }

    // --- Tic-Tac-Toe Actions ---

    toggleGameBtn.addEventListener('click', () => {
        gameSection.classList.toggle('hidden');
    });

    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            const index = cell.getAttribute('data-index');
            // Only allow move if it's your turn, game is active, and cell is empty
            if (!gameActive || currentTurn !== mySymbol || boardState[index] !== null) return;
            
            chatSocket.send(JSON.stringify({
                'type': 'game_move',
                'index': parseInt(index),
                'symbol': mySymbol
            }));
        });
    });

    function handleIncomingMove(index, symbol) {
        boardState[index] = symbol;
        const cell = document.querySelector(`.cell[data-index="${index}"]`);
        if (cell) {
            cell.textContent = symbol;
            cell.style.color = symbol === 'X' ? '#00d2ff' : '#ff4b2b';
        }
        
        if (checkWin(symbol)) {
            gameActive = false;
            gameStatus.textContent = symbol === mySymbol ? "🏆 You win!" : "💀 Stranger wins!";
            setTimeout(() => { if(isConnected) { resetGame(); gameActive = true; updateGameStatus(); } }, 4000);
        } else if (!boardState.includes(null)) {
            gameActive = false;
            gameStatus.textContent = "🤝 It's a draw!";
            setTimeout(() => { if(isConnected) { resetGame(); gameActive = true; updateGameStatus(); } }, 4000);
        } else {
            currentTurn = symbol === 'X' ? 'O' : 'X';
            updateGameStatus();
        }
    }

    function updateGameStatus() {
        if (!gameActive) return;
        gameStatus.textContent = currentTurn === mySymbol ? `Your turn (${mySymbol})` : `Stranger's turn (${currentTurn})`;
    }

    function checkWin(symbol) {
        return winningConditions.some(cond => cond.every(idx => boardState[idx] === symbol));
    }

    function resetGame() {
        boardState = Array(9).fill(null);
        currentTurn = 'X';
        cells.forEach(cell => { cell.textContent = ''; });
        updateGameStatus();
    }

    // --- Standard Chat Functions ---

    function handleDisconnect() {
        isConnected = false;
        if (chatSocket) chatSocket.close();
        inputContainer.classList.add('hidden');
        addSystemMessage("You have disconnected.");
        statusDot.style.backgroundColor = 'var(--text-muted)';
        statusText.textContent = "Disconnected";
        findNewBtn.classList.remove('hidden');
        gameActive = false;
    }
    
    function handleStrangerDisconnect() {
        if(!isConnected) return;
        isConnected = false;
        if (chatSocket) chatSocket.close();
        inputContainer.classList.add('hidden');
        statusText.textContent = "Stranger Disconnected";
        findNewBtn.classList.remove('hidden');
        gameActive = false;
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text === '' || !isConnected || !chatSocket) return;
        const messageEl = document.createElement('div');
        messageEl.className = 'message-wrapper outgoing';
        messageEl.innerHTML = `<div class="message message-outgoing">${escapeHTML(text)}</div>`;
        chatArea.appendChild(messageEl);
        messageInput.value = '';
        scrollToBottom();
        chatSocket.send(JSON.stringify({ 'message': text }));
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    function appendIncomingMessage(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper incoming';
        wrapper.innerHTML = `<div class="message message-incoming">${escapeHTML(text)}<span class="flag-icon" title="Report">&#9873;</span></div>`;
        wrapper.querySelector('.flag-icon').addEventListener('click', openReportModal);
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

    function openReportModal(e) { reportModal.classList.remove('hidden'); }
    function closeReportModal() { reportModal.classList.add('hidden'); }
    cancelReportBtn.addEventListener('click', closeReportModal);
    submitReportBtn.addEventListener('click', () => { 
        closeReportModal(); 
        handleDisconnect();
        addSystemMessage("You blocked the stranger.");
    });

    function scrollToBottom() { chatArea.scrollTop = chatArea.scrollHeight; }
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
    }
});