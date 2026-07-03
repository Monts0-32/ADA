(function() {
    const API = (window.ADA_CONFIG && window.ADA_CONFIG.API) || "https://ada-relay.andrewdinglearchive.workers.dev";
    const DEFAULT_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzhCO NDRBRSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTREOCAzLjM0IDgtNy4zNCA4LTQgMTQuMjEgMTIgMTIgMTJ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTggNHoiLz48L3N2Zz4=`;

    const style = document.createElement('style');
    style.innerHTML = `
        #ada-announcement-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000000; display:flex; align-items:center; justify-content:center; font-family:-apple-system,sans-serif; }
        .ada-announcement-card { background:#161b22; border:1px solid #30363d; padding:30px; border-radius:12px; max-width:500px; width:90%; color:#c9d1d9; box-shadow:0 10px 30px rgba(0,0,0,0.5); position:relative; display:flex; flex-direction:column; }
        .ada-announcement-content { margin-bottom:20px; }
        .ada-announcement-media { width:100%; border-radius:8px; margin-bottom:10px; max-height:300px; object-fit:contain; }
        .ada-announcement-caption { font-size:13px; color:#8b949e; text-align:center; margin-bottom:15px; }
        .ada-poll-option { background:#0d1117; border:1px solid #30363d; padding:10px; border-radius:6px; margin-bottom:8px; cursor:pointer; transition:0.2s; font-size:13px; display:flex; align-items:center; gap:10px; }
        .ada-poll-option:hover { border-color:#58a6ff; background:#1c2128; }
        .ada-poll-option.selected { border-color:#58a6ff; background:rgba(88,166,255,0.1); }
        .ada-announcement-btn { background:#58a6ff; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; width:100%; }
        .ada-announcement-footer { display:flex; align-items:center; justify-content:space-between; margin-top:20px; padding-top:15px; border-top:1px solid #30363d; font-size:11px; color:#8b949e; }
        .ada-admin-info { display:flex; align-items:center; gap:8px; }
        .ada-admin-pic { width:24px; height:24px; border-radius:50%; object-fit:cover; background:#0d1117; border:1px solid #30363d; }
        .ada-announcement-missing { background:#0d1117; border:1px dashed #30363d; border-radius:8px; padding:30px 20px; margin-bottom:10px; text-align:center; color:#8b949e; font-size:13px; line-height:1.5; }
    `;
    document.head.appendChild(style);

    let isModalOpen = false;
    // Queue of announcements waiting to be shown. The API may return several
    // active rows in one fetch; we drain them one-at-a-time so a user who
    // just dismissed an announcement doesn't have to wait for the next
    // 1-second poll tick to see the next one.
    let pendingAnnouncements = [];
    let isChecking = false;

    // ─────────────────────────────────────────
    // PAUSE / RESUME BROADCAST
    // ─────────────────────────────────────────
    // Games that want to be paused while a modal is up can either:
    //   (a) listen for the 'ada:announcement:pause' / 'ada:announcement:resume'
    //       window events directly, or
    //   (b) call window.ADA_PauseGame('myGameId') / window.ADA_ResumeGame('myGameId')
    //       from their own code if they want explicit control.
    // The engine also tries to pause every game registered through (b) when a
    // modal opens, and resume them on close.
    const registeredGames = new Set();

    window.ADA_PauseGame = function(gameId) {
        if (gameId) registeredGames.add(gameId);
        window.dispatchEvent(new CustomEvent('ada:announcement:pause', { detail: { gameId: gameId || null } }));
    };

    window.ADA_ResumeGame = function(gameId) {
        if (gameId) registeredGames.delete(gameId);
        window.dispatchEvent(new CustomEvent('ada:announcement:resume', { detail: { gameId: gameId || null } }));
    };

    // Safely read a string. SQLite can return null; an upload that didn't
    // complete leaves the field as an empty string. Treat them all the same.
    function safeText(value, fallback) {
        if (typeof value === 'string' && value.length > 0) return value;
        return fallback || '';
    }

    function showAnnouncement(ann) {
        if (isModalOpen) return;
        if (!ann || typeof ann !== 'object' || !ann.type) {
            // Defensive: skip any record we can't render.
            return;
        }
        isModalOpen = true;

        // Freeze any registered time-sensitive games before the modal appears.
        // Use the dedicated event so games can run their own pause logic
        // (e.g. set isPaused = true, stop intervals, freeze timers).
        window.dispatchEvent(new CustomEvent('ada:announcement:pause', { detail: { gameId: null } }));

        const overlay = document.createElement('div');
        overlay.id = 'ada-announcement-overlay';

        // Always normalise content/settings to objects so a partial row from
        // the relay (e.g. one that failed JSON.parse on the server) still
        // renders something instead of throwing.
        const content = (ann.content && typeof ann.content === 'object') ? ann.content : {};
        const settings = (ann.settings && typeof ann.settings === 'object') ? ann.settings : {};

        let contentHtml = '';
        if (ann.type === 'media') {
            const mediaUrl = safeText(content.url);
            const mediaType = safeText(content.type, 'image');
            const caption = safeText(content.caption);
            let mediaTag;
            if (!mediaUrl) {
                // The admin form allowed submitting without a file or URL, or
                // the upload endpoint wasn't reachable. Show a clear notice
                // rather than a broken <img> / <video>.
                mediaTag = `<div class="ada-announcement-missing">Media file is unavailable.<br><span style="opacity:0.6;">The administrator didn't attach a working link.</span></div>`;
            } else if (mediaType === 'video') {
                mediaTag = `<video src="${mediaUrl}" controls class="ada-announcement-media" preload="metadata"></video>`;
            } else {
                mediaTag = `<img src="${mediaUrl}" class="ada-announcement-media" alt="Announcement image" onerror="this.outerHTML='<div class=\\'ada-announcement-missing\\'>Image failed to load.<br><span style=\\'opacity:0.6;\\'>The link may have expired.</span></div>'">`;
            }
            contentHtml = `<div class="ada-announcement-content">${mediaTag}<div class="ada-announcement-caption">${caption}</div></div>`;
        } else if (ann.type === 'poll') {
            const question = safeText(content.question, 'Poll');
            const options = Array.isArray(content.options) ? content.options : [];
            const optionsHtml = options.map((opt, i) => `<div class="ada-poll-option" data-idx="${i}">${safeText(opt)}</div>`).join('');
            contentHtml = `
                <div class="ada-announcement-content">
                    <div style="font-weight:bold; margin-bottom:15px; text-align:center;">${question}</div>
                    <div id="poll-options">
                        ${optionsHtml || '<div style="opacity:0.5; text-align:center;">No options provided.</div>'}
                    </div>
                </div>
            `;
        } else {
            // 'text' or anything unknown — fall through to a text body.
            const body = safeText(content.text, safeText(ann.type, 'Announcement'));
            contentHtml = `<div class="ada-announcement-content" style="text-align:center; font-size:15px;">${body}</div>`;
        }

        const broadcastUntil = settings.broadcast_until;
        let timeText = "Infinite Broadcast";
        if (broadcastUntil) {
            const diff = broadcastUntil - Math.floor(Date.now()/1000);
            if (diff <= 0) timeText = "Ending soon...";
            else {
                const hours = Math.floor(diff / 3600);
                const mins = Math.floor((diff % 3600) / 60);
                const secs = diff % 60;
                timeText = `Expires in: ${hours}h ${mins}m ${secs}s`;
            }
        }

        // created_at may be a SQLite "YYYY-MM-DD HH:MM:SS" string from
        // CURRENT_TIMESTAMP, or a numeric epoch. Handle both.
        let issuedAt = '';
        if (ann.created_at !== undefined && ann.created_at !== null && ann.created_at !== '') {
            const asNum = Number(ann.created_at);
            const ms = Number.isFinite(asNum) && String(ann.created_at).indexOf('-') === -1
                ? asNum * 1000
                : Date.parse(ann.created_at);
            if (Number.isFinite(ms)) {
                issuedAt = new Date(ms).toLocaleString();
            } else {
                issuedAt = String(ann.created_at);
            }
        }

        overlay.innerHTML = `
            <div class="ada-announcement-card">
                ${contentHtml}
                <button id="ann-submit" class="ada-announcement-btn">Dismiss</button>
                <div class="ada-announcement-footer">
                    <div class="ada-admin-info">
                        <img src="${safeText(ann.profile_picture) || DEFAULT_ICON}" class="ada-admin-pic">
                        <span>Issued by ${safeText(ann.display_name, 'Administrator')}${issuedAt ? ' on ' + issuedAt : ''}</span>
                    </div>
                    <div class="ada-time-left">${timeText}</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const btn = overlay.querySelector('#ann-submit');
        const options = overlay.querySelectorAll('.ada-poll-option');

        if (ann.type === 'poll') {
            options.forEach(opt => {
                opt.onclick = () => {
                    if (settings.is_multivote) {
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
            try {
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
            } catch (e) { /* network error — still close the modal */ }
            overlay.remove();
            isModalOpen = false;

            // Unfreeze any registered time-sensitive games. We do this whether
            // or not the user voted, so a missed poll click doesn't strand a
            // game in a paused state.
            window.dispatchEvent(new CustomEvent('ada:announcement:resume', { detail: { gameId: null } }));

            // Drain the queue: if we have more announcements cached from the
            // last /active call, show the next one immediately so the user
            // doesn't have to wait for the next 1-second poll tick.
            drainQueue();
        };
    }

    function drainQueue() {
        if (isModalOpen) return;
        const next = pendingAnnouncements.shift();
        if (next) {
            showAnnouncement(next);
        }
    }

    async function checkAnnouncements() {
        // Don't issue overlapping requests.
        if (isChecking) return;
        if (isModalOpen) return; // wait for current modal to close
        const email = localStorage.getItem('ada_user_email');
        if (!email) return;

        isChecking = true;
        try {
            const res = await fetch(`${API}/announcements/active?email=${encodeURIComponent(email)}`);
            const announcements = await res.json();
            if (!Array.isArray(announcements) || announcements.length === 0) return;

            // Always show the first one now; stash the rest so they're shown
            // in order as the user dismisses each one. This is the fix for
            // the bug where multiple active announcements appeared to "miss"
            // because the engine only ever rendered announcements[0].
            showAnnouncement(announcements[0]);
            for (let i = 1; i < announcements.length; i++) {
                pendingAnnouncements.push(announcements[i]);
            }
        } catch (e) {
            // Network blip — try again next tick.
        } finally {
            isChecking = false;
        }
    }

    setInterval(checkAnnouncements, 1000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAnnouncements);
    } else {
        checkAnnouncements();
    }
})();
