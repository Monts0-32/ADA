(function() {
    // --- CONFIGURATION ---
    const API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";
    const DEFAULT_ICON = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzhCOTRBRSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTREOCAzLjM0IDgtNy4zNCA4LTQgMTQuMjEgMTIgMTIgMTJ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTggNHoiLz48L3N2Zz4=`;

    // --- 1. INJECT CSS ---
    const style = document.createElement('style');
    style.innerHTML = `
        #neural-guard { position:fixed; top:0; left:0; width:100%; height:100%; background:#0d1117; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: opacity 0.5s; font-family: sans-serif; }
        .spinner { width:40px; height:40px; border:3px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .guard-hidden { opacity: 0; pointer-events: none; }
    `;
    document.head.appendChild(style);

    // --- 2. INJECT HTML ---
    const guardDiv = document.createElement('div');
    guardDiv.id = 'neural-guard';
    guardDiv.innerHTML = `
        <div class="spinner"></div>
        <p id="guard-text" style="color:#8b949e; font-size:12px; margin-top:20px; letter-spacing:2px;">ESTABLISHING ADA UPLINK...</p>
    `;
    document.body.appendChild(guardDiv);

    // --- 3. SECURITY LOGIC ---
    async function init() {
        const email = localStorage.getItem('ada_user_email');
        const path = window.location.pathname.split("/").pop() || "index.html";

        // Fail-safe: Force show page after 5 seconds regardless of errors
        const forceClear = setTimeout(clearGuard, 5000);

        if (path === "login.html" || path === "blocked.html") {
            return clearGuard(forceClear);
        }

        if (!email) {
            window.location.href = '/login.html';
            return;
        }

        try {
            const res = await fetch(`${API_URL}/sync?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            // Block Checks
            if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
                window.location.href = '/blocked.html';
                return;
            }

            // Permission Check (Check if page has a required tag set in a global variable)
            const requiredTag = window.ADA_CONFIG ? window.ADA_CONFIG.requiredTag : null;
            if (requiredTag && !data.user.is_admin && !data.permissions.includes(requiredTag)) {
                window.location.href = '/blocked.html';
                return;
            }

            // Global Data Sharing (makes it easier for other scripts to get user data)
            window.ADA_USER = data;
            
            clearGuard(forceClear);
        } catch (e) {
            console.error("Uplink Error:", e);
            document.getElementById('guard-text').innerText = "BYPASSING INTERFERENCE...";
        }
    }

    function clearGuard(timer) {
        if(timer) clearTimeout(timer);
        const el = document.getElementById('neural-guard');
        if(el) el.classList.add('guard-hidden');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
