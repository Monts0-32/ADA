(function() {
    const API = "https://ada-relay.andrewdinglearchive.workers.dev";
    const DEFAULT_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzhCOTRBRSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTREOCAzLjM0IDgtNy4zNCA4LTQgMTQuMjEgMTIgMTIgMTJ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTggNHoiLz48L3N2Zz4=`;

    // 1. Inject Header Styles
    const style = document.createElement('style');
    style.innerHTML = `
        .ada-header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 9999; font-family: -apple-system, sans-serif; }
        .ada-logo { font-weight: 600; color: #f0f6fc; text-decoration: none; font-size: 16px; margin-right: 20px; }
        .ada-nav-group { display: flex; align-items: center; gap: 10px; }
        .ada-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #30363d; cursor: pointer; background: #21262d; color: white; font-size: 12px; text-decoration: none; font-weight: 500; transition: 0.2s; }
        .ada-btn:hover { border-color: #8b949e; background: #30363d; }
        .ada-btn-out { color: #f85149; border-color: rgba(248,81,73,0.3); }
        .ada-btn-out:hover { background: rgba(248,81,73,0.1); border-color: #f85149; }
        .ada-user-pill { display: flex; align-items: center; gap: 8px; background: #21262d; border: 1px solid #30363d; padding: 3px 12px; border-radius: 20px; text-decoration: none; color: #c9d1d9; font-size: 12px; transition: 0.2s; }
        .ada-user-pill:hover { border-color: #58a6ff; }
        .ada-user-pill img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; background: #0d1117; }
        @media (max-width: 600px) { .ada-logo-text { display: none; } }
    `;
    document.head.appendChild(style);

    async function buildHeader() {
        const anchor = document.getElementById('ada-header-anchor');
        if (!anchor) return;

        const email = localStorage.getItem('ada_user_email');
        if (!email) return;

        try {
            // Fetch user data for the pill and admin check
            const res = await fetch(`${API}/sync?email=${encodeURIComponent(email)}`);
            const data = await res.json();
            
            // Second fetch for the high-res profile image
            const pRes = await fetch(`${API}/profile/get?email=${encodeURIComponent(email)}`);
            const pData = await pRes.json();
            const user = pData.user;

            const isAdmin = data.user.is_admin === 1;

            anchor.innerHTML = `
                <header class="ada-header">
                    <div class="ada-nav-group">
                        <a href="/dash.html" class="ada-logo">
                            <span class="ada-logo-text">Andrew Dingle Archive</span>
                            <span style="color:#58a6ff">ADA</span>
                        </a>
                        ${isAdmin ? `
                            <a href="/account-creator.html" class="ada-btn">Creator</a>
                            <a href="/account-manager.html" class="ada-btn">Manager</a>
                        ` : ''}
                    </div>
                    
                    <div class="ada-nav-group">
                        <a href="/profile.html" class="ada-user-pill">
                            <img src="${user.profile_picture || DEFAULT_ICON}" alt="">
                            <span>${user.display_name || user.email}</span>
                        </a>
                        <button class="ada-btn ada-btn-out" onclick="window.adaLogout()">Logout</button>
                    </div>
                </header>
            `;
        } catch (e) {
            console.error("Header Engine Error:", e);
        }
    }

    window.adaLogout = function() {
        localStorage.clear();
        window.location.href = '/login.html';
    };

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildHeader);
    } else {
        buildHeader();
    }
})();
