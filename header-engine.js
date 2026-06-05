(function() {
    const API = "https://ada-relay.andrewdinglearchive.workers.dev";
    const DEFAULT_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzhCOTRBRSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTREOCAzLjM0IDgtNy4zNCA4LTQgMTQuMjEgMTIgMTIgMTJ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTggNHoiLz48L3N2Zz4=`;

    const style = document.createElement('style');
    style.innerHTML = `
        .ada-header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 9999; font-family: -apple-system, sans-serif; }
        .ada-nav-group { display: flex; align-items: center; gap: 10px; }
        .ada-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #30363d; cursor: pointer; background: #21262d; color: white; font-size: 12px; text-decoration: none; font-weight: 500; transition: 0.2s; }
        .ada-user-pill { display: flex; align-items: center; gap: 8px; background: #21262d; border: 1px solid #30363d; padding: 3px 12px; border-radius: 20px; text-decoration: none; color: #c9d1d9; font-size: 12px; position: relative; }
        .ada-user-pill img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; position: absolute; bottom: 2px; left: 24px; border: 2px solid #161b22; }
        .status-online { background: #3fb950; box-shadow: 0 0 8px #3fb950; }
        .status-offline { background: #8b949e; }

        /* Announcement Modal */
        #ada-announcement-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000000; display:flex; align-items:center; justify-content:center; font-family:-apple-system,sans-serif; }
        .ada-announcement-card { background:#161b22; border:1px solid #30363d; padding:30px; border-radius:12px; max-width:500px; width:90%; color:#c9d1d9; box-shadow:0 10px 30px rgba(0,0,0,0.5); position:relative; }
        .ada-announcement-content { margin-bottom:20px; }
        .ada-announcement-media { width:100%; border-radius:8px; margin-bottom:10px; max-height:300px; object-fit:contain; }
        .ada-announcement-caption { font-size:13px; color:#8b949e; text-align:center; margin-bottom:15px; }
        .ada-poll-option { background:#0d1117; border:1px solid #30363d; padding:10px; border-radius:6px; margin-bottom:8px; cursor:pointer; transition:0.2s; font-size:13px; display:flex; align-items:center; gap:10px; }
        .ada-poll-option:hover { border-color:#58a6ff; background:#1c2128; }
        .ada-poll-option.selected { border-color:#58a6ff; background:rgba(88,166,255,0.1); }
        .ada-announcement-btn { background:#58a6ff; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; width:100%; }
    `;
    document.head.appendChild(style);

    async function buildHeader() {
        const anchor = document.getElementById('ada-header-anchor');
        if (!anchor) return;
        const email = localStorage.getItem('ada_user_email');
        if (!email) return;

        try {
            const res = await fetch(`${API}/profile/get?email=${encodeURIComponent(email)}`);
            const data = await res.json();
            const user = data.user;
            const isAdmin = localStorage.getItem('ada_admin') === '1';

            const dotClass = user.is_online ? 'status-online' : 'status-offline';

            anchor.innerHTML = `
                <header class="ada-header">
                    <div class="ada-nav-group">
                        <a href="/dash.html" style="text-decoration:none; font-weight:600; color:white;">ADA ARCHIVE</a>
                        ${isAdmin ? `<a href="/account-manager.html" class="ada-btn">Manager</a>` : ''}
                    </div>
                    <div class="ada-nav-group">
                        <a href="/profile.html" class="ada-user-pill">
                            <img src="${user.profile_picture || DEFAULT_ICON}">
                            <div class="status-indicator ${dotClass}"></div>
                            <span>${user.display_name || user.email}</span>
                        </a>
                        <button class="ada-btn" style="color:#f85149" onclick="localStorage.clear(); location.href='/login.html'">Logout</button>
                    </div>
                </header>
            `;
        } catch (e) {}
    }

    function startHeartbeat() {
        const email = localStorage.getItem('ada_user_email');
        if (!email) return;
        // Backoff-aware heartbeat. Polls /sync every 20s in the steady state, but
        // backs off (20s -> 40s -> 80s -> ... capped at 5 min) when the relay
        // returns errors or CORS/network failures. Resets on any user interaction.
        // This is what stops the 502/503 + CORS death-spiral when the worker is
        // stressed — and a sync storm of unauthenticated retries can itself push
        // the worker into 502/503, so throttling matters.
        const MIN_MS = 20000, MAX_MS = 300000;
        let delay = MIN_MS, failures = 0, timer = null;
        const tick = async () => {
            try {
                const res = await fetch(`${API}/sync?email=${encodeURIComponent(email)}`);
                if (!res.ok) throw new Error("HTTP " + res.status);
                const data = await res.json();
                delay = MIN_MS;
                failures = 0;
                if (data && data.command === 'reload') {
                    location.reload();
                    return;
                }
            } catch(e) {
                failures++;
                delay = Math.min(MAX_MS, MIN_MS * Math.pow(2, Math.min(failures, 4)));
            }
            timer = setTimeout(tick, delay);
        };
        const arm = () => { delay = MIN_MS; failures = 0; };
        ['mousedown', 'keydown', 'scroll'].forEach(ev =>
            window.addEventListener(ev, arm, { passive: true })
        );
        timer = setTimeout(tick, delay);
    }

    function startInteractionTracker() {
        const email = localStorage.getItem('ada_user_email');
        if (!email) return;
        let lastSent = 0;
        const throttle = 10000;

        const notifyInteraction = () => {
            const now = Date.now();
            if (now - lastSent < throttle) return;
            lastSent = now;
            fetch(`${API}/user/interaction`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email })
            }).catch(() => {});
        };

        window.addEventListener('mousedown', notifyInteraction);
        window.addEventListener('keydown', notifyInteraction);
        window.addEventListener('scroll', notifyInteraction);
    }

    async function checkAnnouncements() {
        const email = localStorage.getItem('ada_user_email');
        if (!email) return;
        try {
            const res = await fetch(`${API}/announcements/active?email=${encodeURIComponent(email)}`);
            const announcements = await res.json();
            if (announcements.length > 0) {
                showAnnouncement(announcements[0]);
            }
        } catch (e) {}
    }

    function showAnnouncement(ann) {
        const overlay = document.createElement('div');
        overlay.id = 'ada-announcement-overlay';

        let contentHtml = '';
        if (ann.type === 'media') {
            const mediaTag = ann.content.type === 'video' ? `<video src="${ann.content.url}" controls class="ada-announcement-media"></video>` : `<img src="${ann.content.url}" class="ada-announcement-media">`;
            contentHtml = `<div class="ada-announcement-content">${mediaTag}<div class="ada-announcement-caption">${ann.content.caption || ''}</div></div>`;
        } else if (ann.type === 'poll') {
            contentHtml = `
                <div class="ada-announcement-content">
                    <div style="font-weight:bold; margin-bottom:15px; text-align:center;">${ann.content.question}</div>
                    <div id="poll-options">
                        ${ann.content.options.map((opt, i) => `<div class="ada-poll-option" data-idx="${i}">${opt}</div>`).join('')}
                    </div>
                </div>
            `;
        } else {
            contentHtml = `<div class="ada-announcement-content" style="text-align:center; font-size:15px;">${ann.content.text || ''}</div>`;
        }

        overlay.innerHTML = `
            <div class="ada-announcement-card">
                ${contentHtml}
                <button id="ann-submit" class="ada-announcement-btn">Dismiss</button>
            </div>
        `;
        document.body.appendChild(overlay);

        const btn = overlay.querySelector('#ann-submit');
        const options = overlay.querySelectorAll('.ada-poll-option');

        if (ann.type === 'poll') {
            options.forEach(opt => {
                opt.onclick = () => {
                    if (ann.settings.is_multivote) {
                        opt.classList.toggle('selected');
                    } else {
                        options.forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                    }
                };
            });
        }

        btn.onclick = async () => {
            const email = localStorage.getItem('ada_user_email');
            if (ann.type === 'poll') {
                const selected = Array.from(overlay.querySelectorAll('.ada-poll-option.selected')).map(o => o.innerText);
                if (selected.length === 0) return alert("Please vote to dismiss!");
                await fetch(`${API}/announcements/vote`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, announcement_id: ann.id, votes: selected })
                });
            } else {
                await fetch(`${API}/announcements/dismiss`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, announcement_id: ann.id })
                });
            }
            overlay.remove();
        };
    }

    async function init() {
        if (typeof runNeuralGuard === 'function') {
            await runNeuralGuard();
        }
        buildHeader();
        startHeartbeat();
        startInteractionTracker();
        checkAnnouncements();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
