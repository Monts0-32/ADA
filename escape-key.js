/**
 * ADA Escape Key v1.0
 * Press F10 to instantly redirect to a safe page.
 * Include with: <script src="/escape-key.js"></script>
 */
(function() {
    const ESCAPE_URL = (window.ADA_CONFIG && window.ADA_CONFIG.escapeURL) || "https://www.google.com";

    // ── BADGE UI ──
    const style = document.createElement('style');
    style.textContent = `
        #ada-escape-badge {
            position: fixed;
            bottom: 80px;
            left: 20px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 20px;
            padding: 6px 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
            user-select: none;
        }
        #ada-escape-badge:hover {
            border-color: #8b949e;
            background: #1c2128;
        }
        #ada-escape-badge:active {
            transform: scale(0.97);
        }
        #ada-escape-key {
            background: #21262d;
            border: 1px solid #444c56;
            border-bottom: 3px solid #444c56;
            border-radius: 5px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 700;
            color: #c9d1d9;
            font-family: 'SFMono-Regular', Consolas, monospace;
            letter-spacing: 0.5px;
        }
        #ada-escape-label {
            font-size: 11px;
            font-weight: 600;
            color: #8b949e;
            letter-spacing: 0.3px;
        }
    `;
    document.head.appendChild(style);

    const badge = document.createElement('div');
    badge.id = 'ada-escape-badge';
    badge.title = 'Press F10 to escape';
    badge.innerHTML = `
        <span id="ada-escape-key">F10</span>
        <span id="ada-escape-label">Escape Key</span>
    `;
    badge.addEventListener('click', escape);

    // Wait for body to be ready
    if (document.body) {
        document.body.appendChild(badge);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
    }

    // ── KEYDOWN LISTENER ──
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F10') {
            e.preventDefault();
            escape();
        }
    });

    function escape() {
        window.location.replace(ESCAPE_URL);
    }
})();
