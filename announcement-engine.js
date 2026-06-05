(function() {
    const API = "https://ada-relay.andrewdinglearchive.workers.dev";
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
    `;
    document.head.appendChild(style);

    let isModalOpen = false;

    function showAnnouncement(ann) {
        if (isModalOpen) return;
        isModalOpen = true;

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

        const broadcastUntil = ann.settings.broadcast_until;
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

        overlay.innerHTML = `
            <div class="ada-announcement-card">
                ${contentHtml}
                <button id="ann-submit" class="ada-announcement-btn">Dismiss</button>
                <div class="ada-announcement-footer">
                    <div class="ada-admin-info">
                        <img src="${ann.profile_picture || DEFAULT_ICON}" class="ada-admin-pic">
                        <span>Issued by ${ann.display_name || 'Administrator'}</span>
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
            isModalOpen = false;
        };
    }

    async function checkAnnouncements() {
        const email = localStorage.getItem('ada_user_email');
        if (!email || isModalOpen) return;
        try {
            const res = await fetch(`${API}/announcements/active?email=${encodeURIComponent(email)}`);
            const announcements = await res.json();
            if (announcements && announcements.length > 0) {
                showAnnouncement(announcements[0]);
            }
        } catch (e) {}
    }

    setInterval(checkAnnouncements, 1000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAnnouncements);
    } else {
        checkAnnouncements();
    }
})();
