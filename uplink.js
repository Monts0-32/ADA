(function() {
    const API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";

    // 1. Auto-Inject CSS & HTML Loader
    const injectUI = () => {
        if (document.getElementById('neural-guard')) return;
        const style = document.createElement('style');
        style.innerHTML = `
            #neural-guard { position:fixed; top:0; left:0; width:100%; height:100%; background:#0d1117; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: opacity 0.4s; }
            .ada-spinner { width:35px; height:35px; border:3px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: ada-spin 0.8s linear infinite; }
            @keyframes ada-spin { to { transform: rotate(360deg); } }
            .guard-hidden { opacity: 0 !important; pointer-events: none !important; }
        `;
        document.head.appendChild(style);

        const div = document.createElement('div');
        div.id = 'neural-guard';
        div.innerHTML = `<div class="ada-spinner"></div><p id="guard-status" style="color:#8b949e; font-family:monospace; font-size:10px; margin-top:15px; letter-spacing:1px;">SYNCHRONIZING...</p>`;
        document.body.appendChild(div);
    };

    // 2. Global Guard Function
    window.runNeuralGuard = async function(requiredTag = null) {
        injectUI();
        const email = localStorage.getItem('ada_user_email');
        const path = window.location.pathname.split("/").pop() || "index.html";

        // Emergency Bypass (4 seconds)
        const failSafe = setTimeout(clearGuard, 4000);

        if (path === "login.html" || path === "blocked.html") return clearGuard(failSafe);
        if (!email) { window.location.href = '/login.html'; return null; }

        try {
            const res = await fetch(`${API_URL}/sync?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (data.user?.profile_disabled && !data.user?.is_admin) {
                window.location.href = '/blocked.html'; return null;
            }
            if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
                window.location.href = '/blocked.html'; return null;
            }
            if (requiredTag && !data.user.is_admin && !data.permissions.includes(requiredTag)) {
                window.location.href = '/blocked.html'; return null;
            }

            window.ADA_CONFIG = data; // Set global config
            clearGuard(failSafe);
            return data;
        } catch (e) {
            console.error("Uplink Interference:", e);
            document.getElementById('guard-status').innerText = "LINK UNSTABLE - BYPASSING";
            return null;
        }
    };

    function clearGuard(timer) {
        if(timer) clearTimeout(timer);
        const el = document.getElementById('neural-guard');
        if(el) el.classList.add('guard-hidden');
    }

    // Auto-init for standard pages
    if (document.readyState === 'complete') injectUI();
    else window.addEventListener('load', injectUI);
})();
