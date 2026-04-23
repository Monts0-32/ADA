// --- ADA GLOBAL CONFIG ---
const API_URL = "https://ada-relay.andrewdinglearchive.workers.dev";

// 1. Setup the UI immediately upon script execution
(function injectLoader() {
    if (document.getElementById('neural-guard')) return;
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

window.clearGuard = function() {
    const el = document.getElementById('neural-guard');
    if (el) el.classList.add('guard-hidden');
};

window.runNeuralGuard = async function(requiredTag = null) {
    const email = localStorage.getItem('ada_user_email');
    const path = window.location.pathname.split("/").pop() || "index.html";

    // FAIL-SAFE: 3 seconds max. If blocker breaks our script, show the site anyway.
    const failSafe = setTimeout(() => {
        console.warn("ADA: Security Timeout - Forcing Display.");
        window.clearGuard();
    }, 3000);

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
        if (!res.ok) throw new Error("Database Link Failed");
        const data = await res.json();

        // BLOCK CHECK (Applies to everyone including Admins)
        if (data.blocks.includes(path) || data.blocks.includes('ALL')) {
            window.location.href = '/blocked.html';
            return null;
        }

        // --- ADMIN PERMISSION BYPASS ---
        // If a tag is required AND user is NOT an admin AND user doesn't have the tag...
        if (requiredTag && !data.user.is_admin && !data.permissions.includes(requiredTag)) {
            window.location.href = '/blocked.html';
            return null;
        }

        // SUCCESS
        clearTimeout(failSafe);
        window.ADA_CONFIG = data; 
        window.clearGuard();
        return data;

    } catch (e) {
        console.error("ADA: Guard Error", e);
        // On error, let failSafe clear the screen
        return null;
    }
};
