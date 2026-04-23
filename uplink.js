(function() {
    const API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";

    // 1. Injected Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #neural-guard { position:fixed; top:0; left:0; width:100%; height:100%; background:#0d1117; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: opacity 0.4s; }
        .spinner { width:35px; height:35px; border:3px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: ada-spin 0.8s linear infinite; }
        @keyframes ada-spin { to { transform: rotate(360deg); } }
        .guard-hidden { opacity: 0; pointer-events: none; }
    `;
    document.head.appendChild(style);

    // 2. Injected HTML
    const guardDiv = document.createElement('div');
    guardDiv.id = 'neural-guard';
    guardDiv.innerHTML = `<div class="spinner"></div><p id="guard-status" style="color:#8b949e; font-family:monospace; font-size:10px; margin-top:15px; letter-spacing:1px;">UPLINKING...</p>`;
    document.body.appendChild(guardDiv);

    // 3. The Globally Accessible Guard Function
    window.runNeuralGuard = async function(requiredTag = null) {
        const email = localStorage.getItem('ada_user_email');
        const path = window.location.pathname.split("/").pop() || "index.html";

        // Fail-safe: If anything crashes or takes too long, show page after 4 seconds
        const failSafe = setTimeout(() => {
            console.warn("ADA: Security Timeout - Bypassing...");
            clearGuard();
        }, 4000);

        if (!email) {
            window.location.href = '/login.html';
            return null;
        }

        try {
            const res = await fetch(`${API_URL}/sync?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            // Check specific bans
            if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
                window.location.href = '/blocked.html';
                return null;
            }

            // Check permissions
            if (requiredTag && !data.user.is_admin && !data.permissions.includes(requiredTag)) {
                window.location.href = '/blocked.html';
                return null;
            }

            clearTimeout(failSafe);
            window.ADA_CONFIG = data; // Store globally for page use
            clearGuard();
            return data;

        } catch (e) {
            console.error("Uplink Interference:", e);
            document.getElementById('guard-status').innerText = "INTERFERENCE DETECTED - FORCING ACCESS";
            // Do not return null here; let the fail-safe handle the visuals
        }
    };

    function clearGuard() {
        const el = document.getElementById('neural-guard');
        if(el) el.classList.add('guard-hidden');
    }
})();
