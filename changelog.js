(function() {
    // --- CONFIGURATION ---
    const CHANGELOG_VERSION = "1.2.1"; // Change this to trigger a new popup
    const UPDATE_DATE = "April 24, 2026";
    const LOG_TITLE = "Archive System Update";
    
    const CHANGES = [
        "Site is down rn.",
    ];
    // ---------------------

    // 1. Instant check
    if (localStorage.getItem('ada_log_seen') === CHANGELOG_VERSION) return;

    // 2. Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #ada-log-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 2000000; display: flex; align-items: center; justify-content: center; font-family: -apple-system, sans-serif; opacity: 1; transition: opacity 0.3s; }
        .ada-log-box { width: 450px; background: #161b22; border: 1px solid #30363d; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; }
        .ada-log-header { padding: 20px; background: #21262d; border-bottom: 1px solid #30363d; }
        .ada-log-header h3 { margin: 0; font-size: 16px; color: #f0f6fc; }
        .ada-log-body { padding: 25px; max-height: 300px; overflow-y: auto; color: #c9d1d9; }
        .ada-log-list { padding: 0; margin: 0; list-style: none; }
        .ada-log-item { margin-bottom: 12px; font-size: 13px; display: flex; gap: 10px; line-height: 1.4; }
        .ada-log-item:before { content: "•"; color: #58a6ff; font-weight: bold; }
        .ada-log-footer { padding: 15px; border-top: 1px solid #30363d; text-align: right; background: #161b22; }
        .ada-log-btn { background: #238636; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .ada-log-btn:hover { background: #2ea043; }
    `;
    document.head.appendChild(style);

    // 3. Create Element
    const overlay = document.createElement('div');
    overlay.id = 'ada-log-overlay';
    overlay.innerHTML = `
        <div class="ada-log-box">
            <div class="ada-log-header">
                <h3>${LOG_TITLE}</h3>
                <div style="font-size:11px; color:#8b949e; margin-top:4px;">Version ${CHANGELOG_VERSION} • ${UPDATE_DATE}</div>
            </div>
            <div class="ada-log-body">
                <ul class="ada-log-list">${CHANGES.map(i => `<li class="ada-log-item">${i}</li>`).join('')}</ul>
            </div>
            <div class="ada-log-footer">
                <button class="ada-log-btn" id="ada-close-log">Acknowledge Update</button>
            </div>
        </div>
    `;

    // 4. Robust Trigger
    // This function adds the log to the body and sets up the click listener
    function showLog() {
        if (document.getElementById('ada-log-overlay')) return;
        document.body.appendChild(overlay);

        // --- THE FIX: EVENT DELEGATION ---
        // We listen for clicks on the OVERLAY itself
        overlay.addEventListener('click', function(e) {
            // If the clicked element is our button
            if (e.target && e.target.id === 'ada-close-log') {
                localStorage.setItem('ada_log_seen', CHANGELOG_VERSION);
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }

    // Attempt to show when the page says it's ready, or after a short delay
    window.addEventListener('ada-ready', showLog);
    window.addEventListener('ada-uplink-complete', showLog);
    
    // Fail-safe: if no ADA events fire, show after 3 seconds
    setTimeout(showLog, 3000);

})();
