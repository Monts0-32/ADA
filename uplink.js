(function() {
    const API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";

    // Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #neural-guard { position:fixed; top:0; left:0; width:100%; height:100%; background:#0d1117; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: opacity 0.3s; }
        .spinner { width:30px; height:30px; border:2px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .guard-hidden { opacity: 0; pointer-events: none; }
    `;
    document.head.appendChild(style);

    // Inject HTML
    const guardDiv = document.createElement('div');
    guardDiv.id = 'neural-guard';
    guardDiv.innerHTML = `<div class="spinner"></div>`;
    document.body.appendChild(guardDiv);

    async function init() {
        const email = localStorage.getItem('ada_user_email');
        const path = window.location.pathname.split("/").pop() || "index.html";

        if (path === "login.html" || path === "blocked.html") return clear();
        if (!email) { window.location.href = '/login.html'; return; }

        try {
            // Fetch ONLY security/config data
            const res = await fetch(`${API_URL}/sync?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (data.user?.profile_disabled && !data.user?.is_admin) {
                document.body.innerHTML = "<h1 style='color:white;text-align:center;padding:50px;'>Identity Disabled</h1>";
                return;
            }

            if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
                window.location.href = '/blocked.html';
                return;
            }

            const reqTag = window.ADA_CONFIG?.requiredTag;
            if (reqTag && !data.user.is_admin && !data.permissions.includes(reqTag)) {
                window.location.href = '/blocked.html';
                return;
            }

            window.ADA_USER_DATA = data; // Save for page use
            clear();
        } catch (e) {
            console.warn("Uplink Interference - Forcing session");
            clear(); // Force access if blocker breaks the fetch
        }
    }

    function clear() {
        const el = document.getElementById('neural-guard');
        if(el) el.classList.add('guard-hidden');
    }

    init();
})();
