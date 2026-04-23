// --- ADA GLOBAL CONFIG ---
const API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";

// 1. Setup the UI immediately
(function injectLoader() {
    const style = document.createElement('style');
    style.innerHTML = `
        #neural-guard { position:fixed; top:0; left:0; width:100%; height:100%; background:#0d1117; z-index:1000000; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .ada-spinner { width:35px; height:35px; border:3px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: ada-spin 0.8s linear infinite; }
        @keyframes ada-spin { to { transform: rotate(360deg); } }
        .guard-hidden { display:none !important; visibility:hidden !important; opacity:0 !important; }
    `;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.id = 'neural-guard';
    div.innerHTML = `<div class="ada-spinner"></div><p id="guard-status" style="color:#8b949e; font-family:monospace; font-size:10px; margin-top:15px; letter-spacing:1px;">UPLINKING...</p>`;
    document.body.appendChild(div);
})();

// 2. Clear Guard Function
window.clearGuard = function() {
    const el = document.getElementById('neural-guard');
    if (el) el.classList.add('guard-hidden');
    console.log("ADA: Guard Cleared.");
};

// 3. The Master Guard Function
window.runNeuralGuard = async function(requiredTag = null) {
    const email = localStorage.getItem('ada_user_email');
    const path = window.location.pathname.split("/").pop() || "index.html";

    // EMERGENCY FAIL-SAFE: If the database is slow, show page after 3 seconds anyway
    const failSafe = setTimeout(() => {
        console.warn("ADA: Fail-safe triggered.");
        window.clearGuard();
    }, 3000);

    // Skip check for login/blocked
    if (path === "login.html" || path === "blocked.html") {
        clearTimeout(failSafe);
        window.clearGuard();
        return { bypass: true };
    }

    if (!email) {
        window.location.href = '/login.html';
        return null;
    }

    try {
        const res = await fetch(`${API_URL}/sync?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error("Sync Failed");
        const data = await res.json();

        // Security Checks
        if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
            window.location.href = '/blocked.html';
            return null;
        }

        if (requiredTag && !data.user.is_admin && !data.permissions.includes(requiredTag)) {
            window.location.href = '/blocked.html';
            return null;
        }

        // Access Granted
        clearTimeout(failSafe);
        window.ADA_CONFIG = data; 
        window.clearGuard();
        return data;

    } catch (e) {
        console.error("ADA: Sync Error", e);
        // On error, let the fail-safe clear the screen so the user isn't stuck
        return null;
    }
};
