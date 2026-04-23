(function() {
    // --- CONFIGURATION ---
    const API = "https://ada-relay.andrewdinglearchive.workers.dev";
    const email = localStorage.getItem('ada_user_email');
    const DEFAULT_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzhCOTRBRSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTREOCAzLjM0IDgtNy4zNCA4LTQgMTQuMjEgMTIgMTIgMTJ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTggNHoiLz48L3N2Zz4=`;

    let isChatOpen = false;
    let lastChatId = 0;

    // --- 1. INJECT CSS ---
    const style = document.createElement('style');
    style.innerHTML = `
        #ada-chat-widget { position: fixed; bottom: 25px; right: 25px; z-index: 99999; font-family: -apple-system, sans-serif; }
        #chat-icon { width: 56px; height: 56px; background: #238636; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); position: relative; transition: transform 0.2s; }
        #chat-icon:hover { transform: scale(1.05); }
        #chat-notif { position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; background: #f85149; border-radius: 50%; border: 2px solid #0d1117; display: none; }
        
        #chat-window { width: 380px; height: 550px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; display: none; flex-direction: column; margin-bottom: 15px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
        #chat-header { background: #21262d; padding: 14px; font-size: 14px; font-weight: 600; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; color: white; }
        #chat-body { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; background: #0d1117; scroll-behavior: smooth; }
        
        /* Message Rows */
        .chat-row { display: flex; gap: 10px; align-items: flex-end; max-width: 90%; }
        .chat-row.me { flex-direction: row-reverse; align-self: flex-end; }
        .chat-row img.chat-avatar { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #30363d; background: #0d1117; flex-shrink: 0; object-fit: cover; }
        
        .chat-bubble { padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; word-wrap: break-word; position: relative; color: white; }
        .chat-row.other .chat-bubble { background: #21262d; border: 1px solid #30363d; border-bottom-left-radius: 2px; }
        .chat-row.me .chat-bubble { background: #238636; border-bottom-right-radius: 2px; }
        .chat-user-label { font-size: 9px; opacity: 0.5; display: block; margin-bottom: 2px; color: #c9d1d9; }

        #chat-footer { padding: 12px; border-top: 1px solid #30363d; display: flex; gap: 8px; align-items: center; background: #161b22; }
        #chat-msg-input { flex: 1; background: #0d1117; border: 1px solid #30363d; color: white; padding: 8px 12px; border-radius: 6px; outline: none; font-size: 13px; }
        
        .chat-btn { background: #21262d; border: 1px solid #30363d; color: white; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; }
        .chat-btn:hover { background: #30363d; border-color: #8b949e; }
        .btn-send { background: #238636; border: none; }
        .btn-send:hover { background: #2ea043; }

        /* Scrollbar */
        #chat-body::-webkit-scrollbar { width: 6px; }
        #chat-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
    `;
    document.head.appendChild(style);

    // --- 2. INJECT HTML ---
    const widget = document.createElement('div');
    widget.id = 'ada-chat-widget';
    widget.innerHTML = `
        <div id="chat-window">
            <div id="chat-header">
                <span>Archive Comms</span>
                <span id="close-chat" style="cursor:pointer;opacity:0.6;">✕</span>
            </div>
            <div id="chat-body"></div>
            <form id="chat-footer">
                <input type="text" id="chat-msg-input" placeholder="Type a message..." autocomplete="off">
                <button type="button" class="chat-btn" id="trigger-img">🖼️</button>
                <input type="file" id="chat-file" hidden accept="image/*">
                <button type="submit" class="chat-btn btn-send">Send</button>
            </form>
        </div>
        <div id="chat-icon">
            💬
            <div id="chat-notif"></div>
        </div>
    `;
    document.body.appendChild(widget);

    // --- 3. LOGIC & EVENTS ---
    const chatIcon = document.getElementById('chat-icon');
    const chatWindow = document.getElementById('chat-window');
    const chatBody = document.getElementById('chat-body');
    const chatInput = document.getElementById('chat-msg-input');
    const chatForm = document.getElementById('chat-footer');
    const fileInput = document.getElementById('chat-file');

    chatIcon.onclick = toggleChat;
    document.getElementById('close-chat').onclick = toggleChat;
    document.getElementById('trigger-img').onclick = () => fileInput.click();

    function toggleChat() {
        isChatOpen = !isChatOpen;
        chatWindow.style.display = isChatOpen ? 'flex' : 'none';
        if(isChatOpen) {
            document.getElementById('chat-notif').style.display = 'none';
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    async function syncMessages() {
        if (!email) return;
        try {
            const res = await fetch(`${API}/chat/load`);
            const messages = await res.json();
            
            const latest = messages[messages.length - 1];
            if (latest && latest.id > lastChatId) {
                // Show notification if window is closed
                if (!isChatOpen && lastChatId !== 0) {
                    document.getElementById('chat-notif').style.display = 'block';
                }
                lastChatId = latest.id;
                
                // Render
                chatBody.innerHTML = messages.map(m => `
                    <div class="chat-row ${m.user_email === email ? 'me' : 'other'}">
                        <img src="${m.profile_picture || DEFAULT_ICON}" class="chat-avatar">
                        <div class="chat-bubble">
                            <span class="chat-user-label">${m.display_name || m.user_email}</span>
                            ${m.is_image ? `<img src="${m.content}" style="max-width:100%;border-radius:6px;margin-top:5px;cursor:pointer;" onclick="window.open(this.src)">` : m.content}
                        </div>
                    </div>
                `).join('');
                
                if (isChatOpen) chatBody.scrollTop = chatBody.scrollHeight;
            }
        } catch (e) { console.error("Chat Sync Failed"); }
    }

    chatForm.onsubmit = async (e) => {
        e.preventDefault();
        const content = chatInput.value.trim();
        if(!content) return;
        chatInput.value = '';
        await fetch(`${API}/chat`, {
            method: 'POST',
            body: JSON.stringify({ email, content, isImage: false })
        });
        syncMessages();
    };

    fileInput.onchange = async () => {
        if (fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                await fetch(`${API}/chat`, {
                    method: 'POST',
                    body: JSON.stringify({ email, content: e.target.result, isImage: true })
                });
                syncMessages();
            };
            reader.readAsDataURL(fileInput.files[0]);
        }
    };

    // Initial Start
    setInterval(syncMessages, 3000);
    syncMessages();
})();
