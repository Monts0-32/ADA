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

            // ✅ Use actual is_online value from server
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

    // ✅ Heartbeat — keeps last_active updated every 20 seconds
    function startHeartbeat() {
        const email = localStorage.getItem('ada_user_email');
        if (!email) return;
        setInterval(() => {
            fetch(`${API}/sync?email=${encodeURIComponent(email)}`).catch(() => {});
        }, 20000);
    }

    // ✅ Wait for runNeuralGuard (which updates last_active) before building header
    async function init() {
        if (typeof runNeuralGuard === 'function') {
            await runNeuralGuard();
        }
        buildHeader();
        startHeartbeat();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
