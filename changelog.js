(function() {
    // --- EDIT THESE VALUES TO CHANGE THE LOG ---
    const CHANGELOG_VERSION = "1.2.0"; // Change this to make the pop-up appear again
    const UPDATE_DATE = "April 24, 2026";
    const LOG_TITLE = "Archive Update: System Patch 1.2";
    
    const CHANGES = [
        "Site in development currently its down.",
    ];
    // ------------------------------------------

    // 1. Check if user has already seen this version
    const lastSeen = localStorage.getItem('ada_changelog_seen');
    if (lastSeen === CHANGELOG_VERSION) return;

    // 2. Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #ada-log-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000000; display: flex; align-items: center; justify-content: center; font-family: -apple-system, sans-serif; }
        .ada-log-box { width: 450px; background: #161b22; border: 1px solid #30363d; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; animation: ada-pop 0.3s ease-out; }
        @keyframes ada-pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .ada-log-header { padding: 20px; background: #21262d; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; }
        .ada-log-header h3 { margin: 0; font-size: 16px; color: #f0f6fc; }
        .ada-log-date { font-size: 11px; color: #8b949e; margin-top: 4px; }

        .ada-log-body { padding: 25px; max-height: 350px; overflow-y: auto; color: #c9d1d9; }
        .ada-log-list { padding: 0; margin: 0; list-style: none; }
        .ada-log-item { margin-bottom: 12px; font-size: 13px; line-height: 1.5; display: flex; gap: 10px; }
        .ada-log-item:before { content: "•"; color: #58a6ff; font-weight: bold; }

        .ada-log-footer { padding: 15px 25px; border-top: 1px solid #30363d; text-align: right; background: #161b22; }
        .ada-log-btn { background: #238636; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .ada-log-btn:hover { background: #2ea043; }
    `;
    document.head.appendChild(style);

    // 3. Construct HTML
    const logOverlay = document.createElement('div');
    logOverlay.id = 'ada-log-overlay';
    
    let listHtml = CHANGES.map(item => `<li class="ada-log-item">${item}</li>`).join('');

    logOverlay.innerHTML = `
        <div class="ada-log-box">
            <div class="ada-log-header">
                <div>
                    <h3>${LOG_TITLE}</h3>
                    <div class="ada-log-date">Deployed: ${UPDATE_DATE}</div>
                </div>
                <span style="color:#8b949e; font-size:10px;">v${CHANGELOG_VERSION}</span>
            </div>
            <div class="ada-log-body">
                <ul class="ada-log-list">
                    ${listHtml}
                </ul>
            </div>
            <div class="ada-log-footer">
                <button class="ada-log-btn" id="dismiss-log">Acknowledge Update</button>
            </div>
        </div>
    `;

    // 4. Initialization Logic
    // We wait for the Neural Guard to finish so the log doesn't show behind the loader
    window.addEventListener('ada-ready', () => {
        document.body.appendChild(logOverlay);
        
        document.getElementById('dismiss-log').onclick = function() {
            localStorage.setItem('ada_changelog_seen', CHANGELOG_VERSION);
            logOverlay.style.opacity = '0';
            setTimeout(() => logOverlay.remove(), 300);
        };
    });

    // Fallback: If ada-ready doesn't fire within 5 seconds, show anyway
    setTimeout(() => {
        if (!document.getElementById('ada-log-overlay') && localStorage.getItem('ada_changelog_seen') !== CHANGELOG_VERSION) {
             document.body.appendChild(logOverlay);
        }
    }, 5000);

})();
