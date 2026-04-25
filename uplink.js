// Use 'var' to prevent "Identifier already declared" errors if loaded twice
var ADA_API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";

(function() {
    // 1. Function to Inject UI Safely
    function injectLoader() {
        if (document.getElementById('neural-guard')) return;
        
        var style = document.createElement('style');
        style.innerHTML = `
            #neural-guard { position:fixed; top:0; left:0; width:100%; height:100%; background:#0d1117; z-index:1000000; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: opacity 0.4s; }
            .ada-spinner { width:35px; height:35px; border:3px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: ada-spin 0.8s linear infinite; }
            @keyframes ada-spin { to { transform: rotate(360deg); } }
            .guard-hidden { display:none !important; visibility:hidden !important; opacity:0 !important; }
        `;
        document.head.appendChild(style);

        var div = document.createElement('div');
        div.id = 'neural-guard';
        div.innerHTML = `<div class="ada-spinner"></div><p id="guard-status" style="color:#8b949e; font-family:monospace; font-size:10px; margin-top:15px; letter-spacing:1px;">UPLINKING...</p>`;
        document.body.appendChild(div);
    }

    // 2. Clear Guard Logic
    window.clearGuard = function() {
        var el = document.getElementById('neural-guard');
        if (el) el.classList.add('guard-hidden');
    };

    // 3. The Master Guard Function
    window.runNeuralGuard = async function(requiredTag = null) {
        // Ensure UI is injected before checking
        if (!document.body) {
            await new Promise(r => window.addEventListener('DOMContentLoaded', r));
        }
        injectLoader();

        var email = localStorage.getItem('ada_user_email');
        var path = window.location.pathname.split("/").pop() || "index.html";

        // Emergency Fail-safe
        var failSafe = setTimeout(() => { window.clearGuard(); }, 4000);

        if (path === "login.html" || path === "blocked.html") {
            clearTimeout(failSafe); window.clearGuard();
            return { bypass: true };
        }

        if (!email) { window.location.href = '/login.html'; return null; }

        try {
            var res = await fetch(ADA_API_URL + "/sync?email=" + encodeURIComponent(email));
            var data = await res.json();

            if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
                window.location.href = '/blocked.html'; return null;
            }
            if (data.command === 'reload') {
                location.reload();
                return null;
            }

            if (requiredTag && !data.user.is_admin && !data.permissions.includes(requiredTag)) {
                window.location.href = '/blocked.html'; return null;
            }

            clearTimeout(failSafe);
            window.ADA_CONFIG = data; 
            window.clearGuard();
            return data;
        } catch (e) {
            console.error("ADA: Guard Sync Interrupted", e);
            window.clearGuard();
            return null;
        }
    };
})();
