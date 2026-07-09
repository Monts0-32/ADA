/* ════════════════════════════════════════════════════════════════════════════
   ADA OS — Archive Comms Widget (Win95 Retro Edition)
   ────────────────────────────────────────────────────────────────────────────
   Three-pane messenger:
     • Global chat (the original room)
     • Direct Messages (1:1)
     • Group chat (create / join / leave)
   Aggressive attention system:
     • Flashing bevel on the taskbar icon
     • Title-bar (browser tab) flashing prefix
     • Toast notifications slide in from bottom-right
     • Optional audible beep (off by default — first interaction unlocks it)
     • Unread badge per pane + total badge on the launcher
   ════════════════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const API = (window.ADA_CONFIG && window.ADA_CONFIG.API) || "/api";
const email = localStorage.getItem('ada_user_email');
const DEFAULT_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzhCOTRBRSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTREOCAzLjM0IDgtNy4zNCA4LTQgMTQuMjEgMTJ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTggNHoiLz48L3N2Zz4=`;
const POLL_MS = 2500; // notification poll
const CHAT_POLL_MS = 3000; // active channel poll

// Channel modes: "global" | "dm" | "group"
let activeChannel = "global";
let activeDmPartner = null;        // email string
let activeGroupId = null;          // group id string
let lastChatId = 0;                // global
let lastDmId = {};                 // other_email -> id
let lastGroupId = {};              // group_id -> id
let lastNotifTotal = 0;
let lastNotifGlobalId = 0;         // de-dupe global toasts across polls
let isOpen = false;
let isMuted = true;                // for sound (audio policy)
let audioCtx = null;
let toastCount = 0;
let isAdminUser = localStorage.getItem('ada_admin') === '1';
let adminMode = false;             // "all chat logs" mode for admins
let adminFilter = { keyword: '', sender: '', channel: 'all', from: '', to: '' };
let adminResults = [];
let adminUsersList = [];
let stickyBottom = true;           // for global chat scroll-up behavior
let groupDetailsCache = {};        // group_id -> { members, is_public, creator_email }

// ─── 1. STYLE (Win95 chiseled chrome) ─────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
:root {
    --win-bg:         #1c2128;
    --win-bg-light:   #2a313c;
    --win-bg-dark:    #11151b;
    --win-bg-darker:  #0a0d12;
    --win-title-act:  linear-gradient(90deg, #2f81f7 0%, #1f6feb 100%);
    --win-title-inact:linear-gradient(90deg, #2a313c 0%, #1c2128 100%);
    --win-text:       #e6edf3;
    --win-text-blue:  #58a6ff;
    --win-text-mute:  #8b949e;
    --win-border-l:   #4a525e;
    --win-border-d:   #080a0e;
    --accent:         #238636;
}

/* Launcher button */
#ada-chat-launch {
    position: fixed; bottom: 12px; right: 12px;
    width: 32px; height: 32px;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    2px solid var(--win-border-l);
    border-left:   2px solid var(--win-border-l);
    border-right:  2px solid var(--win-border-d);
    border-bottom: 2px solid var(--win-border-d);
    box-shadow: 1px 1px 0 0 #000;
    cursor: pointer; z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    transition: transform 0.1s;
}
#ada-chat-launch:active {
    border-top:    2px solid var(--win-border-d);
    border-left:   2px solid var(--win-border-d);
    border-right:  2px solid var(--win-border-l);
    border-bottom: 2px solid var(--win-border-l);
    transform: translate(1px, 1px);
}
#ada-chat-launch.has-unread {
    animation: ada-flash 0.8s steps(2, end) infinite;
}
@keyframes ada-flash {
    0%   { background: var(--win-bg); }
    50%  { background: #f85149; color: #fff; }
    100% { background: var(--win-bg); }
}
#ada-chat-launch .unread-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 16px; height: 16px; padding: 0 3px;
    background: #f85149; color: #fff;
    border-top:    1px solid #ff8a82;
    border-left:   1px solid #ff8a82;
    border-right:  1px solid #800000;
    border-bottom: 1px solid #800000;
    font-size: 10px; font-weight: bold;
    display: none; align-items: center; justify-content: center;
    pointer-events: none;
}
#ada-chat-launch .unread-badge.show { display: flex; }

/* Main window */
#ada-chat-window {
    position: fixed; bottom: 52px; right: 12px;
    width: 460px; height: 560px;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    2px solid var(--win-border-l);
    border-left:   2px solid var(--win-border-l);
    border-right:  2px solid var(--win-border-d);
    border-bottom: 2px solid var(--win-border-d);
    box-shadow: 2px 2px 0 0 #000, 0 0 0 1px #000;
    display: none; flex-direction: column;
    z-index: 99998;
    font-family: "MS Sans Serif", "Microsoft Sans Serif", "Tahoma", sans-serif;
    font-size: 12px;
}
#ada-chat-window.open { display: flex; }
#ada-chat-window.maximized {
    top: 0; left: 0; right: 0; bottom: 32px;
    width: auto; height: auto;
}

/* Title bar */
.ada-tb {
    background: var(--win-title-act);
    color: #fff;
    padding: 3px 4px 3px 6px;
    display: flex; justify-content: space-between; align-items: center;
    font-weight: bold; font-size: 12px;
    user-select: none;
}
.ada-tb-text { display: flex; align-items: center; gap: 5px; cursor: move; flex: 1; }
.ada-tb-text .tb-icon { font-size: 13px; }
.ada-tb-btns { display: flex; gap: 2px; }
.ada-tb-btn {
    width: 18px; height: 16px;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    display: flex; align-items: center; justify-content: center;
    font-family: "Marlett", "MS Sans Serif", monospace;
    font-size: 10px; cursor: pointer; padding: 0; line-height: 1;
}
.ada-tb-btn:active {
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}

/* Menubar */
.ada-menubar {
    display: flex; gap: 0;
    background: var(--win-bg);
    border-bottom: 1px solid var(--win-border-d);
    padding: 1px 2px;
}
.ada-menubar span {
    padding: 2px 8px; cursor: pointer; font-size: 12px; color: var(--win-text);
}
.ada-menubar span:hover { background: var(--win-text-blue); color: var(--win-bg-darker); }

/* Body layout: sidebar + main */
.ada-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    background: var(--win-bg);
}
.ada-sidebar {
    width: 130px;
    background: var(--win-bg);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    margin: 2px 0 2px 2px;
    display: flex; flex-direction: column;
    overflow: hidden;
}
.ada-tab-bar {
    display: flex; border-bottom: 1px solid var(--win-border-d);
}
.ada-tab {
    flex: 1; padding: 4px 0;
    background: var(--win-bg-dark);
    color: var(--win-text-mute);
    font-size: 10px; font-weight: bold;
    text-align: center; cursor: pointer;
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    user-select: none;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ada-tab.active {
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-bg);
    margin-bottom: -1px;
}
.ada-tab .tab-badge {
    position: absolute; top: 1px; right: 3px;
    min-width: 12px; height: 12px; padding: 0 3px;
    background: #f85149; color: #fff;
    font-size: 8px; font-weight: bold;
    display: none; align-items: center; justify-content: center;
    border-radius: 6px;
}
.ada-tab .tab-badge.show { display: flex; }

/* Admin tab is gold to differentiate from the rest */
.ada-tab.admin-tab { color: #d29922; }
.ada-tab.admin-tab.active { color: #d29922; }

.ada-pane-list {
    flex: 1; overflow-y: auto;
    background: var(--win-bg);
    padding: 2px;
}
.ada-list-item {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 6px; cursor: pointer;
    font-size: 11px; color: var(--win-text);
    border-top:    1px solid transparent;
    border-left:   1px solid transparent;
    border-right:  1px solid transparent;
    border-bottom: 1px solid transparent;
    user-select: none;
}
.ada-list-item:hover {
    background: var(--win-text-blue);
    color: var(--win-bg-darker);
}
.ada-list-item.active {
    background: var(--win-bg-dark);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}
.ada-list-item.active:hover { background: var(--win-bg-dark); }
.ada-list-item img {
    width: 24px; height: 24px;
    background: #0d1117;
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    flex-shrink: 0; object-fit: cover;
}
.ada-list-item .li-text {
    flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    display: flex; flex-direction: column; min-width: 0;
}
.ada-list-item .li-name { font-weight: bold; font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
.ada-list-item .li-preview { font-size: 9px; color: var(--win-text-mute); overflow: hidden; text-overflow: ellipsis; }
.ada-list-item.active .li-preview { color: #8b949e; }
.ada-list-item:hover .li-preview { color: var(--win-bg-darker); }
.ada-list-item .li-badge {
    min-width: 14px; height: 14px; padding: 0 4px;
    background: #f85149; color: #fff;
    font-size: 9px; font-weight: bold;
    display: none; align-items: center; justify-content: center;
    border-radius: 7px;
    flex-shrink: 0;
}
.ada-list-item .li-badge.show { display: flex; }
.ada-list-item.new-dm {
    color: var(--win-text-blue);
    font-style: italic;
}

.ada-sidebar-actions {
    display: flex; gap: 2px; padding: 2px;
    background: var(--win-bg);
    border-top: 1px solid var(--win-border-l);
}
.ada-mini-btn {
    flex: 1;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    padding: 3px 4px; font-size: 10px;
    cursor: pointer; font-family: inherit;
    text-align: center;
}
.ada-mini-btn:active {
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}
.ada-mini-btn:disabled { color: var(--win-bg-light); cursor: not-allowed; }

/* Main pane (messages) */
.ada-main {
    flex: 1;
    display: flex; flex-direction: column;
    margin: 2px;
    background: var(--win-bg);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    overflow: hidden;
}
.ada-main-header {
    padding: 4px 8px;
    background: var(--win-bg-dark);
    border-bottom: 1px solid var(--win-border-l);
    font-weight: bold; font-size: 12px;
    color: var(--win-text);
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
}
.ada-main-header .hdr-meta { font-size: 10px; color: var(--win-text-mute); font-weight: normal; }
.ada-main-header .hdr-actions { display: flex; gap: 4px; }
.ada-main-header .hdr-actions button {
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    padding: 1px 6px; font-size: 10px;
    cursor: pointer; font-family: inherit;
}
.ada-main-header .hdr-actions button:active {
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}

.ada-msg-area {
    flex: 1; overflow-y: auto;
    padding: 8px;
    background: var(--win-bg-darker);
    display: flex; flex-direction: column; gap: 6px;
}
.ada-msg-area::-webkit-scrollbar { width: 14px; }
.ada-msg-area::-webkit-scrollbar-track { background: var(--win-bg-dark); }
.ada-msg-area::-webkit-scrollbar-thumb {
    background: var(--win-bg-light);
    border-top: 1px solid var(--win-border-l);
    border-left: 1px solid var(--win-border-l);
    border-right: 1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
}

.ada-msg {
    display: flex; gap: 6px; align-items: flex-end;
    max-width: 92%;
}
.ada-msg.me { flex-direction: row-reverse; align-self: flex-end; }
.ada-msg .msg-avatar {
    width: 22px; height: 22px;
    background: var(--win-bg);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    flex-shrink: 0; object-fit: cover;
}
.ada-msg .msg-stack { display: flex; flex-direction: column; max-width: 100%; }
.ada-msg.me .msg-stack { align-items: flex-end; }
.ada-msg .msg-author {
    font-size: 9px; color: var(--win-text-mute);
    margin: 0 4px 1px 4px;
    display: flex; gap: 6px;
}
.ada-msg .msg-author .msg-time { color: #5a6470; }
.ada-msg .msg-bubble {
    padding: 5px 8px;
    font-size: 12px; line-height: 1.35;
    word-wrap: break-word;
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    background: var(--win-bg-light);
    color: var(--win-text);
    max-width: 100%;
}
.ada-msg.me .msg-bubble {
    background: var(--accent);
    color: #fff;
    border-top:    1px solid #46c668;
    border-left:   1px solid #46c668;
    border-right:  1px solid #15401f;
    border-bottom: 1px solid #15401f;
}
.ada-msg .msg-bubble img {
    max-width: 220px; max-height: 220px;
    display: block; margin-top: 4px;
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    cursor: pointer;
}
.ada-msg.system {
    align-self: center; max-width: 80%;
    font-size: 10px; font-style: italic;
    color: var(--win-text-mute);
    padding: 2px 0;
}

.ada-msg .msg-img-only { padding: 2px; }

.ada-msg-area .empty-state {
    margin: auto;
    text-align: center;
    color: var(--win-text-mute);
    font-style: italic;
    font-size: 12px;
    padding: 20px;
}

/* Footer (input) */
.ada-footer {
    display: flex; gap: 4px; align-items: center;
    padding: 4px;
    background: var(--win-bg);
    border-top: 1px solid var(--win-border-l);
    flex-shrink: 0;
}
.ada-input {
    flex: 1;
    background: var(--win-bg-darker);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    padding: 4px 6px;
    font-family: inherit; font-size: 12px;
    outline: none;
}
.ada-input:focus {
    background: var(--win-bg-dark);
    border-right-color: var(--win-text-blue);
    border-bottom-color: var(--win-text-blue);
}
.ada-send-btn {
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    padding: 4px 12px; font-size: 12px;
    cursor: pointer; font-family: inherit;
    font-weight: bold;
}
.ada-send-btn:active {
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}
.ada-icon-btn {
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    padding: 3px 6px; font-size: 12px;
    cursor: pointer; font-family: inherit;
}
.ada-icon-btn:active {
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}

/* Status bar */
.ada-statusbar {
    display: flex; gap: 4px;
    padding: 2px;
    background: var(--win-bg);
    border-top: 1px solid var(--win-border-l);
    flex-shrink: 0;
}
.ada-status-cell {
    flex: 1;
    padding: 2px 6px;
    font-size: 11px;
    color: var(--win-text);
    background: var(--win-bg);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    display: flex; align-items: center; gap: 4px;
}
.ada-status-cell .s-icon { font-size: 10px; color: var(--win-text-mute); }
.ada-status-cell .s-online { color: #46c668; font-size: 8px; }

/* Modal dialog (DM / Group) */
.ada-modal-bg {
    position: absolute; inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: none; align-items: center; justify-content: center;
    z-index: 10;
}
.ada-modal-bg.open { display: flex; }
.ada-modal {
    width: 320px;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    2px solid var(--win-border-l);
    border-left:   2px solid var(--win-border-l);
    border-right:  2px solid var(--win-border-d);
    border-bottom: 2px solid var(--win-border-d);
    box-shadow: 2px 2px 0 0 #000;
    display: flex; flex-direction: column;
}
.ada-modal .ada-tb { cursor: default; }
.ada-modal-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.ada-modal .field-group { display: flex; flex-direction: column; gap: 3px; }
.ada-modal .field-group label { font-size: 11px; font-weight: bold; }
.ada-modal .ada-field {
    background: var(--win-bg-darker); color: var(--win-text);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    padding: 3px 5px; font-family: inherit; font-size: 12px;
    outline: none;
}
.ada-modal .ada-field:focus {
    background: var(--win-bg-dark);
    border-right-color: var(--win-text-blue);
    border-bottom-color: var(--win-text-blue);
}
.ada-modal .modal-actions {
    display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px;
}
.ada-btn {
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    2px solid var(--win-border-l);
    border-left:   2px solid var(--win-border-l);
    border-right:  2px solid var(--win-border-d);
    border-bottom: 2px solid var(--win-border-d);
    padding: 3px 14px; font-size: 12px;
    cursor: pointer; font-family: inherit;
    min-width: 75px;
}
.ada-btn:active {
    border-top:    2px solid var(--win-border-d);
    border-left:   2px solid var(--win-border-d);
    border-right:  2px solid var(--win-border-l);
    border-bottom: 2px solid var(--win-border-l);
}
.ada-btn.primary { font-weight: bold; }

.ada-search-results {
    max-height: 130px; overflow-y: auto;
    background: var(--win-bg-darker);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
}
.ada-search-results .ada-list-item { font-size: 11px; }
.ada-modal .modal-error { color: #f85149; font-size: 11px; min-height: 14px; }

/* Admin Logs (filter + result rows) */
.ada-admin-bar {
    display: flex; gap: 4px; flex-wrap: wrap;
    padding: 5px 6px;
    background: var(--win-bg);
    border-bottom: 1px solid var(--win-border-l);
    align-items: center;
    flex-shrink: 0;
}
.ada-admin-bar .ada-field {
    background: var(--win-bg-darker); color: var(--win-text);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    padding: 2px 5px; font-family: inherit; font-size: 11px;
    outline: none;
}
.ada-admin-bar .ada-field:focus {
    background: var(--win-bg-dark);
    border-right-color: #d29922;
    border-bottom-color: #d29922;
}
.ada-admin-bar select.ada-field { padding-right: 4px; }
.ada-admin-bar .ada-field-label { font-size: 10px; color: var(--win-text-mute); }
.ada-admin-row {
    padding: 4px 8px;
    font-size: 11px;
    background: var(--win-bg-light);
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
    word-wrap: break-word;
}
.ada-admin-row .row-meta {
    display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
    font-size: 9px; color: var(--win-text-mute); margin-bottom: 2px;
}
.ada-admin-row .row-tag {
    font-size: 9px; font-weight: bold; padding: 0 4px;
    border-top:    1px solid var(--win-border-l);
    border-left:   1px solid var(--win-border-l);
    border-right:  1px solid var(--win-border-d);
    border-bottom: 1px solid var(--win-border-d);
}
.ada-admin-row .row-tag.global { background: #58a6ff; color: #0a0d12; }
.ada-admin-row .row-tag.dm     { background: #a371f7; color: #0a0d12; }
.ada-admin-row .row-tag.group  { background: #d29922; color: #0a0d12; }
.ada-admin-row .row-content {
    color: var(--win-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
.ada-admin-row .row-content mark {
    background: #d29922; color: #0a0d12; padding: 0 1px;
}

/* Group context menu (creator / member management) */
.ada-group-menu {
    position: absolute;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    2px solid var(--win-border-l);
    border-left:   2px solid var(--win-border-l);
    border-right:  2px solid var(--win-border-d);
    border-bottom: 2px solid var(--win-border-d);
    box-shadow: 2px 2px 0 0 #000;
    z-index: 20;
    min-width: 160px;
    display: flex; flex-direction: column;
    font-size: 12px;
}
.ada-group-menu .ada-menu-item {
    padding: 5px 12px; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    user-select: none;
}
.ada-group-menu .ada-menu-item:hover {
    background: var(--win-text-blue);
    color: var(--win-bg-darker);
}
.ada-group-menu .ada-menu-sep {
    height: 1px; background: var(--win-border-d);
    border-bottom: 1px solid var(--win-border-l);
}
.ada-group-menu .ada-menu-danger { color: #f85149; }
.ada-group-menu .ada-menu-danger:hover { background: #f85149; color: #fff; }

/* Toast notifications (attention grabbers) */
#ada-toast-wrap {
    position: fixed; bottom: 52px; right: 16px;
    z-index: 100000; display: flex; flex-direction: column-reverse; gap: 6px;
    pointer-events: none;
}
.ada-toast {
    width: 280px;
    background: var(--win-bg);
    color: var(--win-text);
    border-top:    2px solid var(--win-border-l);
    border-left:   2px solid var(--win-border-l);
    border-right:  2px solid var(--win-border-d);
    border-bottom: 2px solid var(--win-border-d);
    box-shadow: 2px 2px 0 0 #000;
    display: flex; flex-direction: column;
    pointer-events: auto;
    font-family: "MS Sans Serif", "Microsoft Sans Serif", "Tahoma", sans-serif;
    font-size: 12px;
    animation: ada-toast-in 0.25s ease-out;
}
@keyframes ada-toast-in {
    from { transform: translateX(120%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
}
.ada-toast.dm  { border-top-color: #58a6ff; }
.ada-toast.group{ border-top-color: #d29922; }
.ada-toast .ada-tb { padding: 3px 4px 3px 6px; }
.ada-toast .toast-body {
    padding: 6px 8px;
    background: var(--win-bg-darker);
    display: flex; gap: 8px; align-items: center;
}
.ada-toast .toast-body img {
    width: 28px; height: 28px;
    background: var(--win-bg);
    border-top:    1px solid var(--win-border-d);
    border-left:   1px solid var(--win-border-d);
    border-right:  1px solid var(--win-border-l);
    border-bottom: 1px solid var(--win-border-l);
    object-fit: cover; flex-shrink: 0;
}
.ada-toast .toast-text { flex: 1; min-width: 0; }
.ada-toast .toast-who { font-weight: bold; font-size: 11px; }
.ada-toast .toast-msg {
    font-size: 11px; color: var(--win-text-mute);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ada-toast .toast-close {
    cursor: pointer; opacity: 0.7; font-size: 12px; padding: 0 4px;
}
.ada-toast .toast-close:hover { opacity: 1; }
`;
document.head.appendChild(style);

// ─── 2. HTML ───────────────────────────────────────────────────────────────
const widget = document.createElement('div');
widget.id = 'ada-chat-widget';
widget.innerHTML = `
    <div id="ada-chat-launch" title="Open Archive Comms">
        💬
        <div class="unread-badge" id="ada-launch-badge">0</div>
    </div>

    <div id="ada-chat-window">
        <div class="ada-tb" id="ada-drag-handle">
            <div class="ada-tb-text">
                <span class="tb-icon">💬</span>
                <span id="ada-win-title">Archive Comms</span>
            </div>
            <div class="ada-tb-btns">
                <button class="ada-tb-btn" id="ada-btn-mute" title="Mute / Unmute">🔔</button>
                <button class="ada-tb-btn" id="ada-btn-max" title="Maximize">▢</button>
                <button class="ada-tb-btn" id="ada-btn-close" title="Close">×</button>
            </div>
        </div>
        <div class="ada-menubar">
            <span id="ada-menu-newdm">File ▾</span>
            <span id="ada-menu-newgroup">New Group</span>
            <span id="ada-menu-mute">Sound</span>
            <span id="ada-menu-admin" style="display:none;color:#d29922;font-weight:bold;">🔒 Admin Logs</span>
        </div>
        <div class="ada-body">
            <div class="ada-sidebar">
                <div class="ada-tab-bar">
                    <div class="ada-tab active" data-tab="global">Global<span class="tab-badge" id="tab-badge-global"></span></div>
                    <div class="ada-tab" data-tab="dm">DM<span class="tab-badge" id="tab-badge-dm"></span></div>
                    <div class="ada-tab" data-tab="group">Groups<span class="tab-badge" id="tab-badge-group"></span></div>
                    <div class="ada-tab admin-tab" data-tab="admin" id="ada-tab-admin" style="display:none;">Logs<span class="tab-badge" id="tab-badge-admin"></span></div>
                </div>
                <div class="ada-pane-list" id="ada-pane-list"></div>
                <div class="ada-sidebar-actions" id="ada-sidebar-actions">
                    <button class="ada-mini-btn" id="ada-side-newdm">+ New DM</button>
                </div>
            </div>
            <div class="ada-main">
                <div class="ada-main-header">
                    <span id="ada-main-title">Global Chat</span>
                    <span class="hdr-meta" id="ada-main-meta">All members</span>
                    <span class="hdr-actions" id="ada-main-actions"></span>
                </div>
                <div class="ada-msg-area" id="ada-msg-area">
                    <div class="empty-state">Select a conversation to begin.</div>
                </div>
                <form class="ada-footer" id="ada-msg-form">
                    <button type="button" class="ada-icon-btn" id="ada-btn-img" title="Send image">🖼️</button>
                    <input type="file" id="ada-file" hidden accept="image/*">
                    <input type="text" class="ada-input" id="ada-msg-input" placeholder="Type a message..." autocomplete="off" disabled>
                    <button type="submit" class="ada-send-btn" id="ada-send-btn" disabled>Send</button>
                </form>
            </div>
        </div>
        <div class="ada-statusbar">
            <div class="ada-status-cell">
                <span class="s-icon">👤</span>
                <span id="ada-status-user">guest</span>
            </div>
            <div class="ada-status-cell">
                <span class="s-online">●</span>
                <span id="ada-status-channel">Global</span>
            </div>
            <div class="ada-status-cell">
                <span class="s-icon">✉</span>
                <span id="ada-status-unread">0 unread</span>
            </div>
        </div>

        <!-- Modal overlay -->
        <div class="ada-modal-bg" id="ada-modal-bg">
            <div class="ada-modal" id="ada-modal">
                <div class="ada-tb">
                    <div class="ada-tb-text"><span class="tb-icon">📨</span><span id="ada-modal-title">New DM</span></div>
                </div>
                <div class="ada-modal-body" id="ada-modal-body"></div>
            </div>
        </div>
    </div>

    <div id="ada-toast-wrap"></div>
`;
document.body.appendChild(widget);

// ─── 3. ELEMENTS & STATE ───────────────────────────────────────────────────
const $launch       = document.getElementById('ada-chat-launch');
const $launchBadge  = document.getElementById('ada-launch-badge');
const $window       = document.getElementById('ada-chat-window');
const $winTitle     = document.getElementById('ada-win-title');
const $msgArea      = document.getElementById('ada-msg-area');
const $msgForm      = document.getElementById('ada-msg-form');
const $msgInput     = document.getElementById('ada-msg-input');
const $sendBtn      = document.getElementById('ada-send-btn');
const $btnImg       = document.getElementById('ada-btn-img');
const $fileInput    = document.getElementById('ada-file');
const $paneList     = document.getElementById('ada-pane-list');
const $mainTitle    = document.getElementById('ada-main-title');
const $mainMeta     = document.getElementById('ada-main-meta');
const $mainActions  = document.getElementById('ada-main-actions');
const $statusUser   = document.getElementById('ada-status-user');
const $statusCh     = document.getElementById('ada-status-channel');
const $statusUnrd   = document.getElementById('ada-status-unread');
const $btnClose     = document.getElementById('ada-btn-close');
const $btnMax       = document.getElementById('ada-btn-max');
const $btnMute      = document.getElementById('ada-btn-mute');
const $modalBg      = document.getElementById('ada-modal-bg');
const $modalTitle   = document.getElementById('ada-modal-title');
const $modalBody    = document.getElementById('ada-modal-body');
const $toastWrap    = document.getElementById('ada-toast-wrap');

document.getElementById('ada-status-user').textContent = (email || 'guest').split('@')[0];

// Tab elements
const tabs = document.querySelectorAll('.ada-tab');
const tabBadges = {
    global: document.getElementById('tab-badge-global'),
    dm:     document.getElementById('tab-badge-dm'),
    group:  document.getElementById('tab-badge-group'),
    admin:  document.getElementById('tab-badge-admin')
};

// Show admin tab + menu item only for site admins
if (isAdminUser) {
    const adminTab = document.getElementById('ada-tab-admin');
    if (adminTab) adminTab.style.display = '';
    const adminMenu = document.getElementById('ada-menu-admin');
    if (adminMenu) adminMenu.style.display = '';
}

// ─── 4. OPEN / CLOSE ───────────────────────────────────────────────────────
function openWindow() {
    isOpen = true;
    $window.classList.add('open');
    $launch.classList.remove('has-unread');
    $launchBadge.classList.remove('show');
    // Clear unread for current view as soon as it's opened
    markActiveRead();
    refreshPane();
    setTimeout(() => $msgInput.focus(), 50);
}
function closeWindow() {
    isOpen = false;
    $window.classList.remove('open');
}
function toggleWindow() { isOpen ? closeWindow() : openWindow(); }

$launch.addEventListener('click', toggleWindow);
$btnClose.addEventListener('click', closeWindow);
$btnMax.addEventListener('click', () => $window.classList.toggle('maximized'));

$btnMute.addEventListener('click', () => {
    isMuted = !isMuted;
    $btnMute.textContent = isMuted ? '🔕' : '🔔';
    $btnMute.title = isMuted ? 'Unmute' : 'Mute';
});
document.getElementById('ada-menu-mute').addEventListener('click', () => $btnMute.click());
$btnMute.textContent = '🔕';

// Escape closes
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if ($modalBg.classList.contains('open')) closeModal();
        else if (isOpen) closeWindow();
    }
});

// ─── 5. TABS ───────────────────────────────────────────────────────────────
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
    });
});

function switchTab(tab) {
    // Index map — admin tab only exists when isAdminUser is true. Map safely.
    let idx = 0;
    if (tab === 'dm') idx = 1;
    else if (tab === 'group') idx = 2;
    else if (tab === 'admin') idx = isAdminUser ? 3 : 0;
    tabs.forEach(t => t.classList.toggle('active', t === tabs[idx]));
    activeChannel = tab;
    stickyBottom = true; // fresh view = always start at bottom
    if (tab === 'global') {
        activeDmPartner = null;
        activeGroupId = null;
    } else if (tab === 'dm') {
        activeGroupId = null;
    } else if (tab === 'group') {
        activeDmPartner = null;
    } else if (tab === 'admin') {
        activeDmPartner = null;
        activeGroupId = null;
        // Lazy-load users list and run initial search
        loadAdminUsersList();
        runAdminSearch();
    }
    $mainActions.innerHTML = '';
    renderPaneList();
    renderActiveMessages();
    updateChannelHeader();
    markActiveRead();
    // Sound first-interaction
    if (isMuted) {
        // do nothing
    } else {
        try { initAudio(); } catch (e) {}
    }
}

// ─── 6. PANE LISTS ─────────────────────────────────────────────────────────
let dmConversations = [];
let groupList = [];

async function loadDmConversations() {
    if (!email) return;
    try {
        const res = await fetch(`${API}/dm/conversations?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        dmConversations = (data.conversations || []);
    } catch (e) { dmConversations = []; }
}

async function loadGroupList() {
    if (!email) return;
    try {
        const res = await fetch(`${API}/groups/list?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        groupList = (data.groups || []);
    } catch (e) { groupList = []; }
}

function renderPaneList() {
    if (activeChannel === 'global') {
        $paneList.innerHTML = `
            <div class="ada-list-item active" data-action="open-global">
                <img src="${DEFAULT_ICON}" alt="">
                <div class="li-text">
                    <span class="li-name"># global</span>
                    <span class="li-preview">All members</span>
                </div>
            </div>
        `;
        $paneList.querySelector('[data-action="open-global"]').onclick = () => {
            activeDmPartner = null; activeGroupId = null;
            renderPaneList(); renderActiveMessages(); updateChannelHeader(); markActiveRead();
        };
        document.getElementById('ada-sidebar-actions').innerHTML = '';
        return;
    }
    if (activeChannel === 'dm') {
        if (!dmConversations.length) {
            $paneList.innerHTML = `<div style="padding:10px;font-size:11px;color:var(--win-text-mute);font-style:italic;text-align:center;">No conversations yet.<br>Click "+ New DM" to start one.</div>`;
        } else {
            $paneList.innerHTML = dmConversations.map(c => {
                const isActive = c.other_email === activeDmPartner;
                const preview = c.latest
                    ? (c.latest.is_image ? '🖼 Image' : (c.latest.content || '').slice(0, 40))
                    : '—';
                return `
                <div class="ada-list-item ${isActive ? 'active' : ''}" data-email="${c.other_email}">
                    <img src="${c.profile_picture || DEFAULT_ICON}" alt="">
                    <div class="li-text">
                        <span class="li-name">${escapeHtml(c.display_name || c.other_email)}</span>
                        <span class="li-preview">${escapeHtml(preview)}</span>
                    </div>
                    <span class="li-badge ${c.unread ? 'show' : ''}">${c.unread || ''}</span>
                </div>`;
            }).join('');
            $paneList.querySelectorAll('.ada-list-item[data-email]').forEach(el => {
                el.onclick = () => openDm(el.dataset.email);
            });
        }
        document.getElementById('ada-sidebar-actions').innerHTML =
            '<button class="ada-mini-btn" id="ada-side-newdm">+ New DM</button>';
        document.getElementById('ada-side-newdm').onclick = openNewDmModal;
        return;
    }
    if (activeChannel === 'group') {
        if (!groupList.length) {
            $paneList.innerHTML = `<div style="padding:10px;font-size:11px;color:var(--win-text-mute);font-style:italic;text-align:center;">No groups yet.<br>Click "New Group" above to create one.</div>`;
        } else {
            $paneList.innerHTML = groupList.map(g => {
                const isActive = g.id === activeGroupId;
                const pubTag = g.is_public ? ' · 🌐 public' : '';
                return `
                <div class="ada-list-item ${isActive ? 'active' : ''}" data-group="${g.id}">
                    <img src="${DEFAULT_ICON}" alt="">
                    <div class="li-text">
                        <span class="li-name">${escapeHtml(g.name)}</span>
                        <span class="li-preview">${g.member_count} member${g.member_count === 1 ? '' : 's'}${g.is_member ? '' : ' · not joined'}${pubTag}</span>
                    </div>
                    <span class="li-badge ${g.unread ? 'show' : ''}">${g.unread || ''}</span>
                </div>`;
            }).join('');
            $paneList.querySelectorAll('.ada-list-item[data-group]').forEach(el => {
                el.onclick = () => openGroup(el.dataset.group);
            });
        }
        document.getElementById('ada-sidebar-actions').innerHTML =
            '<button class="ada-mini-btn" id="ada-side-newgroup">+ New Group</button>';
        document.getElementById('ada-side-newgroup').onclick = openNewGroupModal;
        return;
    }
    if (activeChannel === 'admin') {
        $paneList.innerHTML = `
            <div class="ada-list-item active" style="font-style:italic;color:#d29922;">
                <img src="${DEFAULT_ICON}" alt="">
                <div class="li-text">
                    <span class="li-name">All Chat Logs</span>
                    <span class="li-preview">Search & filter everything</span>
                </div>
            </div>
        `;
        document.getElementById('ada-sidebar-actions').innerHTML = '';
        return;
    }
}

function updateChannelHeader() {
    if (activeChannel === 'global') {
        $mainTitle.textContent = '# global';
        $mainMeta.textContent = 'All members';
        $statusCh.textContent = 'Global';
        $mainActions.innerHTML = '';
    } else if (activeChannel === 'dm') {
        const c = dmConversations.find(x => x.other_email === activeDmPartner);
        $mainTitle.textContent = c ? (c.display_name || c.other_email) : (activeDmPartner || 'Select a DM');
        $mainMeta.textContent = c ? c.other_email : '';
        $statusCh.textContent = 'DM';
        $mainActions.innerHTML = '';
    } else if (activeChannel === 'group') {
        const g = groupList.find(x => x.id === activeGroupId);
        $mainTitle.textContent = g ? g.name : (activeGroupId ? 'Group' : 'Select a group');
        $mainMeta.textContent = g ? `${g.member_count} members${g.is_public ? ' · 🌐 public' : ''}` : '';
        $statusCh.textContent = 'Group';
        let actionsHtml = '';
        if (g && g.is_member) {
            actionsHtml = '<button id="ada-leave-group">Leave</button>';
            if (g.creator_email === email || isAdminUser) {
                actionsHtml += ' <button id="ada-group-settings" title="Group settings">⚙ Settings</button>';
            }
            $mainActions.innerHTML = actionsHtml;
            const leaveBtn = document.getElementById('ada-leave-group');
            if (leaveBtn) leaveBtn.onclick = leaveActiveGroup;
            const settingsBtn = document.getElementById('ada-group-settings');
            if (settingsBtn) settingsBtn.onclick = (e) => openGroupSettingsMenu(e.currentTarget);
        } else if (g && !g.is_member) {
            $mainActions.innerHTML = '<button id="ada-join-group">Join</button>';
            const joinBtn = document.getElementById('ada-join-group');
            if (joinBtn) joinBtn.onclick = joinActiveGroup;
        } else {
            $mainActions.innerHTML = '';
        }
    } else if (activeChannel === 'admin') {
        $mainTitle.textContent = '🔒 All Chat Logs';
        $mainMeta.textContent = isAdminUser ? 'Admin view' : '';
        $statusCh.textContent = 'Admin';
        $mainActions.innerHTML = '';
    }
    // Input enabled state — admin view is read-only
    const enabled =
        (activeChannel === 'global') ||
        (activeChannel === 'dm' && !!activeDmPartner) ||
        (activeChannel === 'group' && !!activeGroupId);
    $msgInput.disabled = !enabled;
    $sendBtn.disabled = !enabled;
    $msgInput.placeholder = enabled
        ? (activeChannel === 'global' ? 'Broadcast to all members…'
            : activeChannel === 'dm' ? `DM ${(activeDmPartner || '').split('@')[0]}…`
            : 'Message the group…')
        : (activeChannel === 'admin' ? 'Read-only — admin logs view' : 'Select a conversation to begin.');
}

// ─── 7. OPEN DM / GROUP ────────────────────────────────────────────────────
function openDm(otherEmail) {
    activeChannel = 'dm';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'dm'));
    activeDmPartner = otherEmail;
    activeGroupId = null;
    stickyBottom = true;
    renderPaneList();
    renderActiveMessages();
    updateChannelHeader();
    markActiveRead();
    setTimeout(() => $msgInput.focus(), 50);
}
function openGroup(groupId) {
    activeChannel = 'group';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'group'));
    activeGroupId = groupId;
    activeDmPartner = null;
    stickyBottom = true;
    renderPaneList();
    renderActiveMessages();
    updateChannelHeader();
    markActiveRead();
    setTimeout(() => $msgInput.focus(), 50);
}

// ─── 8. MESSAGE RENDERING ──────────────────────────────────────────────────
function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMsgRow(m, mine) {
    const avatar = m.profile_picture || DEFAULT_ICON;
    const author = m.display_name || m.user_email || m.sender_email || 'unknown';
    const time = m.created_at ? new Date(m.created_at + (m.created_at.includes('Z') ? '' : 'Z')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const isImg = m.is_image || m.isImage;
    const content = m.content;
    const bubbleInner = isImg
        ? `<div class="msg-img-only"><img src="${escapeHtml(content)}" alt="image" onclick="window.open(this.src,'_blank')"></div>`
        : escapeHtml(content);
    return `
        <div class="ada-msg ${mine ? 'me' : ''}">
            <img src="${avatar}" class="msg-avatar" alt="">
            <div class="msg-stack">
                <div class="msg-author">
                    <span>${escapeHtml(author)}</span>
                    <span class="msg-time">${time}</span>
                </div>
                <div class="msg-bubble">${bubbleInner}</div>
            </div>
        </div>`;
}

function renderEmpty(text) {
    $msgArea.innerHTML = `<div class="empty-state">${text}</div>`;
    return;
}

// ─── 9. SYNC EACH CHANNEL ──────────────────────────────────────────────────
async function syncGlobal() {
    if (!email) return;
    try {
        const res = await fetch(`${API}/chat/load`);
        const messages = await res.json();
        const latest = messages[messages.length - 1];
        const prevLast = lastChatId;
        if (latest) {
            // Compute new count since we last saw
            const newOnes = messages.filter(m => m.id > prevLast && m.user_email !== email);
            if (prevLast > 0 && newOnes.length > 0) {
                // Notify
                if (activeChannel !== 'global' || !isOpen) {
                    bumpUnread('global', newOnes.length);
                    newOnes.forEach(m => pushToast({
                        type: 'global',
                        who: m.display_name || m.user_email,
                        pic: m.profile_picture || DEFAULT_ICON,
                        msg: m.is_image ? 'Sent an image' : (m.content || '').slice(0, 60)
                    }));
                } else {
                    // In global + open — just clear badge if any
                    bumpUnread('global', 0);
                }
            }
            lastChatId = Math.max(lastChatId, latest.id);
        }
        if (activeChannel === 'global') renderGlobal(messages);
    } catch (e) {}
}

function renderGlobal(messages) {
    if (!messages.length) { renderEmpty('No messages yet. Say hello!'); stickyBottom = true; return; }
    // Preserve scroll position when re-rendering so the user can scroll up to
    // read history without being yanked back to the bottom on every poll.
    // We snapshot the scroll offset from the *bottom* (so re-renders that
    // prepend/append messages don't shift the user's reading position).
    const wasAtBottom = stickyBottom;
    const prevScrollHeight = $msgArea.scrollHeight;
    const prevScrollTop = $msgArea.scrollTop;
    $msgArea.innerHTML = messages.map(m => renderMsgRow(m, m.user_email === email)).join('');
    if (wasAtBottom) {
        $msgArea.scrollTop = $msgArea.scrollHeight;
        stickyBottom = true;
    } else {
        // Adjust by how much content was added above the current viewport
        const added = $msgArea.scrollHeight - prevScrollHeight;
        $msgArea.scrollTop = prevScrollTop + added;
    }
}

async function syncDm() {
    if (!email) return;
    // Refresh conversation list (cheap)
    await loadDmConversations();
    if (activeChannel === 'dm') {
        if (!activeDmPartner) { renderEmpty('Select a conversation to begin.'); return; }
        try {
            const res = await fetch(`${API}/dm/load?email=${encodeURIComponent(email)}&other=${encodeURIComponent(activeDmPartner)}`);
            const data = await res.json();
            const messages = data.messages || [];
            const lastId = messages.length ? messages[messages.length - 1].id : 0;
            const prev = lastDmId[activeDmPartner] || 0;
            if (prev > 0 && lastId > prev) {
                const newOnes = messages.filter(m => m.id > prev && m.user_email !== email);
                if (newOnes.length) {
                    if (isOpen) {
                        // already focused — just optional beep
                    } else {
                        newOnes.forEach(m => pushToast({
                            type: 'dm',
                            who: m.display_name || m.user_email,
                            pic: m.profile_picture || DEFAULT_ICON,
                            msg: m.is_image ? 'Sent an image' : (m.content || '').slice(0, 60)
                        }));
                    }
                }
            }
            if (lastId) lastDmId[activeDmPartner] = lastId;
            renderActiveMessages();
            updateChannelHeader();
            renderPaneList();
        } catch (e) { renderEmpty('Failed to load conversation.'); }
    } else {
        renderPaneList();
    }
}

async function syncGroup() {
    if (!email) return;
    await loadGroupList();
    if (activeChannel === 'group') {
        if (!activeGroupId) { renderEmpty('Select or create a group to begin.'); return; }
        try {
            const res = await fetch(`${API}/groups/load?id=${encodeURIComponent(activeGroupId)}&email=${encodeURIComponent(email)}`);
            const data = await res.json();
            if (data.error) { renderEmpty(data.error); return; }
            const messages = data.messages || [];
            const lastId = messages.length ? messages[messages.length - 1].id : 0;
            const prev = lastGroupId[activeGroupId] || 0;
            if (prev > 0 && lastId > prev) {
                const newOnes = messages.filter(m => m.id > prev && m.user_email !== email);
                if (newOnes.length) {
                    if (!isOpen) {
                        newOnes.forEach(m => pushToast({
                            type: 'group',
                            who: m.display_name || m.user_email,
                            pic: m.profile_picture || DEFAULT_ICON,
                            msg: m.is_image ? 'Sent an image' : (m.content || '').slice(0, 60)
                        }));
                    }
                }
            }
            if (lastId) lastGroupId[activeGroupId] = lastId;
            renderActiveMessages();
            updateChannelHeader();
            renderPaneList();
        } catch (e) { renderEmpty('Failed to load group.'); }
    } else {
        renderPaneList();
    }
}

function renderActiveMessages() {
    if (activeChannel === 'global') {
        // Already handled by syncGlobal renderGlobal
    } else if (activeChannel === 'dm') {
        if (!activeDmPartner) { renderEmpty('Select a conversation to begin.'); return; }
        // Re-fetch
        fetch(`${API}/dm/load?email=${encodeURIComponent(email)}&other=${encodeURIComponent(activeDmPartner)}`)
            .then(r => r.json())
            .then(data => {
                const messages = data.messages || [];
                if (!messages.length) { renderEmpty('No messages yet. Say hi!'); stickyBottom = true; return; }
                $msgArea.innerHTML = messages.map(m => renderMsgRow(m, m.user_email === email)).join('');
                scrollMsgArea();
            });
    } else if (activeChannel === 'group') {
        if (!activeGroupId) { renderEmpty('Select or create a group to begin.'); return; }
        fetch(`${API}/groups/load?id=${encodeURIComponent(activeGroupId)}&email=${encodeURIComponent(email)}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { renderEmpty(data.error); return; }
                const messages = data.messages || [];
                if (!messages.length) { renderEmpty('No messages in this group yet.'); stickyBottom = true; return; }
                $msgArea.innerHTML = messages.map(m => renderMsgRow(m, m.user_email === email)).join('');
                scrollMsgArea();
            });
    } else if (activeChannel === 'admin') {
        renderAdminResults();
    }
}

function scrollMsgArea(force) {
    // Only auto-scroll to bottom if user is already at (or near) the bottom.
    // If they have scrolled up to read history, leave the scroll position alone.
    if (force || stickyBottom) {
        $msgArea.scrollTop = $msgArea.scrollHeight;
    }
}

// Track whether the user is at the bottom of the message area so we know
// whether to auto-scroll on new messages. The area fires 'scroll' constantly;
// we sample once per frame with rAF to keep this cheap.
$msgArea.addEventListener('scroll', () => {
    const slack = 40; // px of "close enough to bottom"
    const atBottom = ($msgArea.scrollHeight - $msgArea.scrollTop - $msgArea.clientHeight) <= slack;
    stickyBottom = atBottom;
}, { passive: true });

// ─── 10. SEND ──────────────────────────────────────────────────────────────
$msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $msgInput.value.trim();
    if (!text) return;
    if (activeChannel === 'global') {
        await fetch(`${API}/chat`, {
            method: 'POST',
            body: JSON.stringify({ email, content: text, isImage: false })
        });
        $msgInput.value = '';
        syncGlobal();
    } else if (activeChannel === 'dm' && activeDmPartner) {
        await fetch(`${API}/dm/send`, {
            method: 'POST',
            body: JSON.stringify({ sender: email, recipient: activeDmPartner, content: text, isImage: false })
        });
        $msgInput.value = '';
        syncDm();
    } else if (activeChannel === 'group' && activeGroupId) {
        await fetch(`${API}/groups/send`, {
            method: 'POST',
            body: JSON.stringify({ group_id: activeGroupId, email, content: text, isImage: false })
        });
        $msgInput.value = '';
        syncGroup();
    }
});

$btnImg.addEventListener('click', () => $fileInput.click());
$fileInput.addEventListener('change', () => {
    if (!$fileInput.files[0]) return;
    const file = $fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        if (activeChannel === 'global') {
            await fetch(`${API}/chat`, {
                method: 'POST',
                body: JSON.stringify({ email, content: dataUrl, isImage: true })
            });
            syncGlobal();
        } else if (activeChannel === 'dm' && activeDmPartner) {
            await fetch(`${API}/dm/send`, {
                method: 'POST',
                body: JSON.stringify({ sender: email, recipient: activeDmPartner, content: dataUrl, isImage: true })
            });
            syncDm();
        } else if (activeChannel === 'group' && activeGroupId) {
            await fetch(`${API}/groups/send`, {
                method: 'POST',
                body: JSON.stringify({ group_id: activeGroupId, email, content: dataUrl, isImage: true })
            });
            syncGroup();
        }
    };
    reader.readAsDataURL(file);
    $fileInput.value = '';
});

// ─── 11. UNREAD & ATTENTION ────────────────────────────────────────────────
const unreadCounts = { global: 0, dm: 0, group: 0 };
function bumpUnread(channel, delta) {
    unreadCounts[channel] = Math.max(0, (unreadCounts[channel] || 0) + delta);
    refreshBadges();
}
function setUnread(channel, value) {
    unreadCounts[channel] = Math.max(0, value);
    refreshBadges();
}
function refreshBadges() {
    const total = (unreadCounts.global || 0) + (unreadCounts.dm || 0) + (unreadCounts.group || 0);
    // Tab badges
    Object.entries(unreadCounts).forEach(([k, v]) => {
        if (!tabBadges[k]) return;
        if (v > 0) { tabBadges[k].classList.add('show'); tabBadges[k].textContent = v > 99 ? '99+' : String(v); }
        else { tabBadges[k].classList.remove('show'); }
    });
    // Launcher badge + flash
    if (total > 0) {
        $launchBadge.textContent = total > 99 ? '99+' : String(total);
        $launchBadge.classList.add('show');
        if (!isOpen) $launch.classList.add('has-unread');
        else $launch.classList.remove('has-unread');
    } else {
        $launchBadge.classList.remove('show');
        $launch.classList.remove('has-unread');
    }
    // Status bar
    $statusUnrd.textContent = total === 0 ? '0 unread' : `${total} unread`;
    // Browser title flash
    flashBrowserTitle(total);
}

function markActiveRead() {
    if (!isOpen) return;
    if (activeChannel === 'global') {
        setUnread('global', 0);
    } else if (activeChannel === 'dm') {
        if (activeDmPartner) {
            const c = dmConversations.find(x => x.other_email === activeDmPartner);
            if (c) c.unread = 0;
            const lastId = lastDmId[activeDmPartner] || 0;
            if (lastId > 0) {
                fetch(`${API}/dm/mark-read`, {
                    method: 'POST',
                    body: JSON.stringify({ user_email: email, other_email: activeDmPartner, last_id: lastId })
                });
            }
        }
    } else if (activeChannel === 'group') {
        if (activeGroupId) {
            const g = groupList.find(x => x.id === activeGroupId);
            if (g) g.unread = 0;
            const lastId = lastGroupId[activeGroupId] || 0;
            if (lastId > 0) {
                fetch(`${API}/groups/mark-read`, {
                    method: 'POST',
                    body: JSON.stringify({ group_id: activeGroupId, email, last_id: lastId })
                });
            }
        }
    }
    refreshBadges();
    renderPaneList();
}

// Browser title flash
let titleBase = document.title;
let titleTimer = null;
function flashBrowserTitle(total) {
    if (titleTimer) { clearInterval(titleTimer); titleTimer = null; }
    if (total <= 0) { document.title = titleBase; return; }
    let on = false;
    titleBase = (titleBase.replace(/^\(\d+\) /, '')) || document.title.replace(/^\(\d+\) /, '');
    titleTimer = setInterval(() => {
        on = !on;
        document.title = on ? `(${total}) NEW MESSAGE — ${titleBase}` : titleBase;
    }, 900);
}
// Refresh title base on changes (best-effort)
const _titleObserver = new MutationObserver(() => {
    titleBase = document.title.replace(/^\(\d+\) (NEW MESSAGE — )?/, '');
});
_titleObserver.observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });

// Toast notifications
function pushToast({ type, who, pic, msg }) {
    toastCount++;
    const el = document.createElement('div');
    el.className = `ada-toast ${type}`;
    el.innerHTML = `
        <div class="ada-tb" style="padding:2px 4px 2px 6px;">
            <div class="ada-tb-text">
                <span class="tb-icon">${type === 'dm' ? '✉' : type === 'group' ? '👥' : '📢'}</span>
                <span>${type === 'dm' ? 'Direct Message' : type === 'group' ? 'Group Message' : 'Global Chat'}</span>
            </div>
            <div class="ada-tb-btns">
                <button class="ada-tb-btn toast-close" title="Dismiss">×</button>
            </div>
        </div>
        <div class="toast-body">
            <img src="${pic}" alt="">
            <div class="toast-text">
                <div class="toast-who">${escapeHtml(who)}</div>
                <div class="toast-msg">${escapeHtml(msg)}</div>
            </div>
        </div>
    `;
    el.querySelector('.toast-close').onclick = () => el.remove();
    el.onclick = (e) => {
        if (e.target.closest('.toast-close')) return;
        openWindow();
        if (type === 'global') switchTab('global');
        else if (type === 'dm') { switchTab('dm'); openDm(el.dataset.dm || ''); }
        else if (type === 'group') { switchTab('group'); openGroup(el.dataset.group || ''); }
        el.remove();
    };
    if (type === 'dm') el.dataset.dm = who;
    if (type === 'group') el.dataset.group = who;
    $toastWrap.appendChild(el);
    // Auto-dismiss after 6s
    setTimeout(() => el.remove(), 6000);
    // Audible beep
    if (!isMuted) beep();
}

// Optional sound (lazy-init on first user interaction)
function initAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
}
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
function beep() {
    initAudio();
    if (!audioCtx) return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.value = 0.05;
        o.connect(g).connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
}

// ─── 12. NOTIFICATION POLLING (cross-channel) ──────────────────────────────
async function pollNotifications() {
    if (!email) return;
    try {
        const res = await fetch(`${API}/notifications/check`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        // Update unread per channel
        if (activeChannel !== 'global' || !isOpen) {
            setUnread('global', data.global && data.global.sender !== email ? 1 : 0);
        } else {
            setUnread('global', 0);
        }
        // DM
        let dmTotal = 0;
        Object.entries(data.dm_unread || {}).forEach(([sender, cnt]) => {
            if (activeChannel === 'dm' && isOpen && activeDmPartner === sender) {
                // already in this thread — don't count
            } else {
                dmTotal += cnt;
            }
        });
        setUnread('dm', dmTotal);
        // Group
        let groupTotal = 0;
        Object.entries(data.group_unread || {}).forEach(([gid, cnt]) => {
            if (activeChannel === 'group' && isOpen && activeGroupId === gid) {
                // already viewing
            } else {
                groupTotal += cnt;
            }
        });
        setUnread('group', groupTotal);
        refreshBadges();
        // Toasts for genuinely new global messages (de-duped by id so we don't
        // spam the user with the same "new" message on every poll cycle).
        // The very first poll only primes lastNotifGlobalId — it doesn't toast
        // anything. This stops a 5-toast burst on every page reload.
        if (!isOpen && data.global && data.global.sender !== email) {
            const gid = data.global.id || 0;
            if (lastNotifGlobalId === 0) {
                lastNotifGlobalId = gid; // prime, no toast
            } else if (gid > lastNotifGlobalId) {
                lastNotifGlobalId = gid;
                pushToast({
                    type: 'global',
                    who: data.global.sender,
                    pic: DEFAULT_ICON,
                    msg: data.global.is_image ? 'Sent an image' : (data.global.content || '').slice(0, 60)
                });
            }
        }
    } catch (e) {}
}

// ─── 13. MODALS: NEW DM & NEW GROUP ────────────────────────────────────────
function openModal(title, html) {
    $modalTitle.textContent = title;
    $modalBody.innerHTML = html;
    $modalBg.classList.add('open');
    setTimeout(() => {
        const f = $modalBody.querySelector('input,textarea,button');
        if (f) f.focus();
    }, 50);
}
function closeModal() {
    $modalBg.classList.remove('open');
    $modalBody.innerHTML = '';
}
$modalBg.addEventListener('click', (e) => { if (e.target === $modalBg) closeModal(); });

function openNewDmModal() {
    openModal('New Direct Message', `
        <div class="field-group">
            <label>Search a member</label>
            <input type="text" class="ada-field" id="ada-dm-search" placeholder="name or email" autocomplete="off">
        </div>
        <div class="ada-search-results" id="ada-dm-results" style="display:none;"></div>
        <div class="modal-error" id="ada-dm-error"></div>
        <div class="modal-actions">
            <button class="ada-btn" id="ada-dm-cancel">Cancel</button>
        </div>
    `);
    document.getElementById('ada-dm-cancel').onclick = closeModal;
    const searchEl = document.getElementById('ada-dm-search');
    const resultsEl = document.getElementById('ada-dm-results');
    let timer = null;
    searchEl.addEventListener('input', () => {
        const q = searchEl.value.trim();
        clearTimeout(timer);
        if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
        timer = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/users/search?q=${encodeURIComponent(q)}&email=${encodeURIComponent(email || '')}`);
                const data = await res.json();
                const users = data.users || [];
                if (!users.length) { resultsEl.innerHTML = '<div style="padding:8px;font-size:11px;color:var(--win-text-mute);">No users found.</div>'; }
                else {
                    resultsEl.innerHTML = users.map(u => `
                        <div class="ada-list-item" data-email="${escapeHtml(u.email)}">
                            <img src="${u.profile_picture || DEFAULT_ICON}" alt="">
                            <div class="li-text">
                                <span class="li-name">${escapeHtml(u.display_name || u.email)}</span>
                                <span class="li-preview">${escapeHtml(u.email)}</span>
                            </div>
                        </div>
                    `).join('');
                    resultsEl.querySelectorAll('.ada-list-item').forEach(el => {
                        el.onclick = () => {
                            const target = el.dataset.email;
                            closeModal();
                            openDm(target);
                        };
                    });
                }
                resultsEl.style.display = '';
            } catch (e) {}
        }, 220);
    });
}

function openNewGroupModal() {
    openModal('Create Group', `
        <div class="field-group">
            <label>Group Name</label>
            <input type="text" class="ada-field" id="ada-grp-name" placeholder="e.g. Ops Team" maxlength="50">
        </div>
        <div class="field-group">
            <label>Description (optional)</label>
            <input type="text" class="ada-field" id="ada-grp-desc" placeholder="What's this group about?" maxlength="120">
        </div>
        <div class="modal-error" id="ada-grp-error"></div>
        <div class="modal-actions">
            <button class="ada-btn primary" id="ada-grp-create">Create</button>
            <button class="ada-btn" id="ada-grp-cancel">Cancel</button>
        </div>
    `);
    document.getElementById('ada-grp-cancel').onclick = closeModal;
    document.getElementById('ada-grp-create').onclick = async () => {
        const name = document.getElementById('ada-grp-name').value.trim();
        const desc = document.getElementById('ada-grp-desc').value.trim();
        const err = document.getElementById('ada-grp-error');
        if (!name) { err.textContent = 'Group name is required.'; return; }
        err.textContent = '';
        try {
            const res = await fetch(`${API}/groups/create`, {
                method: 'POST',
                body: JSON.stringify({ name, description: desc, creator: email })
            });
            const data = await res.json();
            if (data.success) {
                closeModal();
                await loadGroupList();
                openGroup(data.group_id);
            } else {
                err.textContent = data.error || 'Failed to create group.';
            }
        } catch (e) {
            err.textContent = 'Network error.';
        }
    };
}

async function joinActiveGroup() {
    if (!activeGroupId || !email) return;
    await fetch(`${API}/groups/join`, {
        method: 'POST',
        body: JSON.stringify({ group_id: activeGroupId, email })
    });
    await loadGroupList();
    renderActiveMessages();
    updateChannelHeader();
    renderPaneList();
}
async function leaveActiveGroup() {
    if (!activeGroupId || !email) return;
    if (!confirm('Leave this group?')) return;
    await fetch(`${API}/groups/leave`, {
        method: 'POST',
        body: JSON.stringify({ group_id: activeGroupId, email })
    });
    activeGroupId = null;
    await loadGroupList();
    renderPaneList();
    updateChannelHeader();
    renderActiveMessages();
}

document.getElementById('ada-menu-newdm').onclick = openNewDmModal;
document.getElementById('ada-menu-newgroup').onclick = openNewGroupModal;
if (isAdminUser) {
    document.getElementById('ada-menu-admin').onclick = () => switchTab('admin');
}

// ─── 15. GROUP SETTINGS MENU (creator / admin only) ────────────────────────
function closeGroupMenu() {
    const existing = document.getElementById('ada-group-menu');
    if (existing) existing.remove();
    document.removeEventListener('click', closeGroupMenu, true);
}

function openGroupSettingsMenu(anchorEl) {
    closeGroupMenu();
    if (!activeGroupId) return;
    const g = groupList.find(x => x.id === activeGroupId);
    if (!g) return;
    const isCreator = g.creator_email === email;
    const canManage = isCreator || isAdminUser;

    const menu = document.createElement('div');
    menu.id = 'ada-group-menu';
    menu.className = 'ada-group-menu';

    // Add member
    if (isCreator) {
        const addItem = document.createElement('div');
        addItem.className = 'ada-menu-item';
        addItem.innerHTML = '👤+ Add member';
        addItem.onclick = (e) => { e.stopPropagation(); closeGroupMenu(); openAddMemberModal(); };
        menu.appendChild(addItem);
    }

    // Toggle public (creator or admin)
    if (canManage) {
        const pubItem = document.createElement('div');
        pubItem.className = 'ada-menu-item';
        pubItem.innerHTML = g.is_public ? '🔒 Make private' : '🌐 Make public';
        pubItem.onclick = (e) => { e.stopPropagation(); closeGroupMenu(); toggleGroupPublic(); };
        menu.appendChild(pubItem);
    }

    // View members (always)
    const viewItem = document.createElement('div');
    viewItem.className = 'ada-menu-item';
    viewItem.innerHTML = '👥 View members';
    viewItem.onclick = (e) => { e.stopPropagation(); closeGroupMenu(); openMembersModal(); };
    menu.appendChild(viewItem);

    // Delete (creator or admin)
    if (canManage) {
        const sep = document.createElement('div');
        sep.className = 'ada-menu-sep';
        menu.appendChild(sep);

        const delItem = document.createElement('div');
        delItem.className = 'ada-menu-item ada-menu-danger';
        delItem.innerHTML = '🗑 Delete group';
        delItem.onclick = (e) => { e.stopPropagation(); closeGroupMenu(); deleteActiveGroup(); };
        menu.appendChild(delItem);
    }

    // Position near the anchor
    const rect = anchorEl.getBoundingClientRect();
    const winRect = $window.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = (rect.bottom - winRect.top) + 'px';
    menu.style.right = (winRect.right - rect.right) + 'px';
    $window.appendChild(menu);

    // Dismiss on outside click
    setTimeout(() => document.addEventListener('click', closeGroupMenu, true), 0);
}

async function openAddMemberModal() {
    if (!activeGroupId) return;
    openModal('Add Member', `
        <div class="field-group">
            <label>Search a user to add</label>
            <input type="text" class="ada-field" id="ada-addmem-search" placeholder="name or email" autocomplete="off">
        </div>
        <div class="ada-search-results" id="ada-addmem-results" style="display:none;"></div>
        <div class="modal-error" id="ada-addmem-error"></div>
        <div class="modal-actions">
            <button class="ada-btn" id="ada-addmem-cancel">Close</button>
        </div>
    `);
    document.getElementById('ada-addmem-cancel').onclick = closeModal;
    const searchEl = document.getElementById('ada-addmem-search');
    const resultsEl = document.getElementById('ada-addmem-results');
    const errEl = document.getElementById('ada-addmem-error');
    let timer = null;
    searchEl.addEventListener('input', () => {
        const q = searchEl.value.trim();
        clearTimeout(timer);
        if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
        timer = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/users/search?q=${encodeURIComponent(q)}&email=${encodeURIComponent(email || '')}`);
                const data = await res.json();
                const users = data.users || [];
                if (!users.length) {
                    resultsEl.innerHTML = '<div style="padding:8px;font-size:11px;color:var(--win-text-mute);">No users found.</div>';
                } else {
                    resultsEl.innerHTML = users.map(u => `
                        <div class="ada-list-item" data-email="${escapeHtml(u.email)}">
                            <img src="${u.profile_picture || DEFAULT_ICON}" alt="">
                            <div class="li-text">
                                <span class="li-name">${escapeHtml(u.display_name || u.email)}</span>
                                <span class="li-preview">${escapeHtml(u.email)}</span>
                            </div>
                        </div>
                    `).join('');
                    resultsEl.querySelectorAll('.ada-list-item').forEach(el => {
                        el.onclick = async () => {
                            const target = el.dataset.email;
                            errEl.textContent = '';
                            try {
                                const r = await fetch(`${API}/groups/add-member`, {
                                    method: 'POST',
                                    body: JSON.stringify({ group_id: activeGroupId, creator_email: email, user_email: target })
                                });
                                const d = await r.json();
                                if (d.success) {
                                    errEl.style.color = '#46c668';
                                    errEl.textContent = `Added ${target}.`;
                                    await loadGroupList();
                                    updateChannelHeader();
                                } else {
                                    errEl.style.color = '#f85149';
                                    errEl.textContent = d.error || 'Failed to add member.';
                                }
                            } catch (e) {
                                errEl.style.color = '#f85149';
                                errEl.textContent = 'Network error.';
                            }
                        };
                    });
                }
                resultsEl.style.display = '';
            } catch (e) {}
        }, 220);
    });
}

async function toggleGroupPublic() {
    if (!activeGroupId) return;
    const g = groupList.find(x => x.id === activeGroupId);
    if (!g) return;
    const newVal = !g.is_public;
    try {
        const res = await fetch(`${API}/groups/toggle-public`, {
            method: 'POST',
            body: JSON.stringify({ group_id: activeGroupId, email, is_public: newVal })
        });
        const data = await res.json();
        if (data.success) {
            await loadGroupList();
            updateChannelHeader();
            renderPaneList();
        } else {
            alert(data.error || 'Failed to update group.');
        }
    } catch (e) {
        alert('Network error.');
    }
}

async function openMembersModal() {
    if (!activeGroupId) return;
    let members = [];
    try {
        const res = await fetch(`${API}/groups/load?id=${encodeURIComponent(activeGroupId)}&email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.group) members = data.group.members || [];
    } catch (e) {}
    const g = groupList.find(x => x.id === activeGroupId);
    const isCreator = g && g.creator_email === email;
    const body = `
        <div class="field-group">
            <label>${members.length} member${members.length === 1 ? '' : 's'}</label>
            <div class="ada-search-results" style="max-height:240px;">
                ${members.length ? members.map(m => `
                    <div class="ada-list-item">
                        <img src="${m.profile_picture || DEFAULT_ICON}" alt="">
                        <div class="li-text">
                            <span class="li-name">${escapeHtml(m.display_name || m.email)}${m.email === g.creator_email ? ' 👑' : ''}</span>
                            <span class="li-preview">${escapeHtml(m.email)}</span>
                        </div>
                        ${(isCreator && m.email !== g.creator_email) ? `<button class="ada-mini-btn" data-kick="${escapeHtml(m.email)}" style="flex:0 0 auto;">Kick</button>` : ''}
                    </div>
                `).join('') : '<div style="padding:8px;font-size:11px;color:var(--win-text-mute);">No members.</div>'}
            </div>
        </div>
        <div class="modal-actions">
            <button class="ada-btn" id="ada-mem-close">Close</button>
        </div>
    `;
    openModal('Group Members', body);
    document.getElementById('ada-mem-close').onclick = closeModal;
    $modalBody.querySelectorAll('[data-kick]').forEach(btn => {
        btn.onclick = async () => {
            const target = btn.getAttribute('data-kick');
            if (!confirm(`Remove ${target} from this group?`)) return;
            try {
                const r = await fetch(`${API}/groups/remove-member`, {
                    method: 'POST',
                    body: JSON.stringify({ group_id: activeGroupId, creator_email: email, user_email: target })
                });
                const d = await r.json();
                if (d.success) {
                    await loadGroupList();
                    closeModal();
                    openMembersModal();
                    updateChannelHeader();
                    renderPaneList();
                } else {
                    alert(d.error || 'Failed to remove.');
                }
            } catch (e) {
                alert('Network error.');
            }
        };
    });
}

async function deleteActiveGroup() {
    if (!activeGroupId) return;
    const g = groupList.find(x => x.id === activeGroupId);
    if (!g) return;
    if (!confirm(`Delete group "${g.name}"? This cannot be undone — all messages will be wiped.`)) return;
    try {
        const r = await fetch(`${API}/groups/delete`, {
            method: 'POST',
            body: JSON.stringify({ group_id: activeGroupId, email })
        });
        const d = await r.json();
        if (d.success) {
            activeGroupId = null;
            await loadGroupList();
            renderPaneList();
            updateChannelHeader();
            renderActiveMessages();
        } else {
            alert(d.error || 'Failed to delete group.');
        }
    } catch (e) {
        alert('Network error.');
    }
}

// ─── 16. ADMIN LOGS (admin only) ────────────────────────────────────────────
async function loadAdminUsersList() {
    if (!isAdminUser || adminUsersList.length) return;
    try {
        const res = await fetch(`${API}/admin/users-list`, {
            method: 'POST',
            body: JSON.stringify({ admin_email: email })
        });
        const data = await res.json();
        if (data.success) adminUsersList = data.users || [];
    } catch (e) { adminUsersList = []; }
}

async function runAdminSearch() {
    if (!isAdminUser) return;
    try {
        const payload = {
            admin_email: email,
            keyword: adminFilter.keyword || '',
            sender: adminFilter.sender || '',
            channel: adminFilter.channel || 'all',
            from: adminFilter.from || '',
            to: adminFilter.to || '',
            limit: 200
        };
        const res = await fetch(`${API}/admin/all-chats`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        adminResults = (data.results || []);
    } catch (e) { adminResults = []; }
    renderAdminResults();
}

function renderAdminResults() {
    if (activeChannel !== 'admin') return;
    // Render filter bar + results in the message area. Build it once and re-render
    // rows when adminResults changes.
    let bar = document.getElementById('ada-admin-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'ada-admin-bar';
        bar.className = 'ada-admin-bar';
        const userOpts = adminUsersList.map(u =>
            `<option value="${escapeHtml(u.email)}" ${adminFilter.sender === u.email ? 'selected' : ''}>${escapeHtml(u.display_name || u.email)}</option>`
        ).join('');
        bar.innerHTML = `
            <span class="ada-field-label">🔍</span>
            <input type="text" class="ada-field" id="ada-admin-kw" placeholder="keyword" value="${escapeHtml(adminFilter.keyword)}" style="flex:1;min-width:120px;">
            <select class="ada-field" id="ada-admin-sender" style="max-width:140px;">
                <option value="">All users</option>
                ${userOpts}
            </select>
            <select class="ada-field" id="ada-admin-channel">
                <option value="all"${adminFilter.channel === 'all' ? ' selected' : ''}>All channels</option>
                <option value="global"${adminFilter.channel === 'global' ? ' selected' : ''}>Global</option>
                <option value="dm"${adminFilter.channel === 'dm' ? ' selected' : ''}>DM</option>
                <option value="group"${adminFilter.channel === 'group' ? ' selected' : ''}>Group</option>
            </select>
            <input type="date" class="ada-field" id="ada-admin-from" value="${escapeHtml(adminFilter.from)}" title="From date">
            <input type="date" class="ada-field" id="ada-admin-to" value="${escapeHtml(adminFilter.to)}" title="To date">
            <button class="ada-mini-btn" id="ada-admin-go">Search</button>
            <button class="ada-mini-btn" id="ada-admin-clear">Clear</button>
        `;
        $msgArea.parentNode.insertBefore(bar, $msgArea);
        // Bind events
        document.getElementById('ada-admin-go').onclick = () => {
            adminFilter.keyword = document.getElementById('ada-admin-kw').value.trim();
            adminFilter.sender = document.getElementById('ada-admin-sender').value;
            adminFilter.channel = document.getElementById('ada-admin-channel').value;
            adminFilter.from = document.getElementById('ada-admin-from').value;
            adminFilter.to = document.getElementById('ada-admin-to').value;
            runAdminSearch();
        };
        document.getElementById('ada-admin-clear').onclick = () => {
            adminFilter = { keyword: '', sender: '', channel: 'all', from: '', to: '' };
            runAdminSearch();
        };
        // Enter to search
        document.getElementById('ada-admin-kw').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('ada-admin-go').click();
        });
    } else {
        // Update select values that may have changed
        const senderSel = document.getElementById('ada-admin-sender');
        if (senderSel && senderSel.value !== adminFilter.sender) senderSel.value = adminFilter.sender;
        const chanSel = document.getElementById('ada-admin-channel');
        if (chanSel && chanSel.value !== adminFilter.channel) chanSel.value = adminFilter.channel;
        const kwEl = document.getElementById('ada-admin-kw');
        if (kwEl && document.activeElement !== kwEl) kwEl.value = adminFilter.keyword;
    }

    if (!adminResults.length) {
        renderEmpty('No messages match the current filters.');
        return;
    }
    const kw = adminFilter.keyword;
    const rows = adminResults.map(r => {
        const tag = `<span class="row-tag ${r.channel}">${r.channel.toUpperCase()}</span>`;
        const who = r.display_name || r.user_email;
        const where = r.channel === 'dm'
            ? `↔ ${escapeHtml(r.other_name || r.other_email || '')}`
            : r.channel === 'group'
                ? `# ${escapeHtml(r.group_name || '')}`
                : '';
        const time = r.created_at ? new Date(r.created_at + (r.created_at.includes('Z') ? '' : 'Z')).toLocaleString() : '';
        let body = r.is_image ? '<em>(image)</em>' : escapeHtml(r.content || '');
        if (kw && body) {
            const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            body = body.replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
        }
        return `
        <div class="ada-admin-row">
            <div class="row-meta">
                ${tag}
                <strong>${escapeHtml(who)}</strong>
                <span>${escapeHtml(r.user_email)}</span>
                <span>${where}</span>
                <span style="margin-left:auto;">${escapeHtml(time)}</span>
            </div>
            <div class="row-content">${body}</div>
        </div>`;
    }).join('');
    $msgArea.innerHTML = rows;
    stickyBottom = true;
    scrollMsgArea(true);
}

// ─── 14. DRAGGING THE WINDOW ───────────────────────────────────────────────
(function setupDrag() {
    const handle = document.getElementById('ada-drag-handle');
    if (!handle) return;
    let dragging = false, ox = 0, oy = 0;
    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.ada-tb-btn')) return;
        if ($window.classList.contains('maximized')) return;
        dragging = true;
        const rect = $window.getBoundingClientRect();
        ox = e.clientX - rect.left;
        oy = e.clientY - rect.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const x = Math.max(0, e.clientX - ox);
        const y = Math.max(0, e.clientY - oy);
        $window.style.left = x + 'px';
        $window.style.top = y + 'px';
        $window.style.right = 'auto';
        $window.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
    // Double-click title to maximize
    handle.addEventListener('dblclick', (e) => {
        if (e.target.closest('.ada-tb-btn')) return;
        $window.classList.toggle('maximized');
    });
})();

// ─── 15. BOOTSTRAP ─────────────────────────────────────────────────────────
async function refreshPane() {
    if (activeChannel === 'global') renderPaneList();
    else if (activeChannel === 'dm') { await loadDmConversations(); renderPaneList(); }
    else if (activeChannel === 'group') { await loadGroupList(); renderPaneList(); }
    updateChannelHeader();
}

(async function init() {
    if (!email) return;
    renderPaneList();
    updateChannelHeader();
    await syncGlobal();
    await loadDmConversations();
    await loadGroupList();
    renderPaneList();
    setInterval(pollNotifications, POLL_MS);
    setInterval(syncGlobal, CHAT_POLL_MS);
    setInterval(syncDm, CHAT_POLL_MS);
    setInterval(syncGroup, CHAT_POLL_MS);
    setInterval(pollNotifications, POLL_MS);
    pollNotifications();
})();
})();
