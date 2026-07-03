/**
 * ADA Page Transition v1.0
 * ------------------------------------------------------------
 * Plays an "app-launch" animation on every page navigation,
 * and a subtle entry animation on page load.
 *
 * Include with: <script src="/page-transition.js"></script>
 *               (load it AFTER config.js)
 *
 * The script auto-attaches to every <a> link that points to a
 * local page. External links (different host) and link-as-button
 * actions (target="_blank", modifier keys, etc.) skip the
 * transition.
 * ------------------------------------------------------------
 */
(function() {
    const config = window.ADA_CONFIG || { transitionMs: 700 };
    const TRANSITION_MS = config.transitionMs || 700;

    // ============== STYLES ==============
    const style = document.createElement('style');
    style.textContent = `
        /* Subtle entry animation for the page itself */
        .ada-page {
            opacity: 0;
            transform: translateY(8px) scale(0.995);
            transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
            will-change: opacity, transform;
        }
        .ada-page.ada-page-ready {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        /* Transition overlay (full-screen) */
        #ada-transition {
            position: fixed; inset: 0; z-index: 999999;
            background: var(--bg, #0d1117);
            opacity: 0; visibility: hidden;
            pointer-events: none;
            transition: opacity 0.18s ease, visibility 0.18s ease;
        }
        #ada-transition.active {
            opacity: 1; visibility: visible;
            pointer-events: auto;
        }

        /* The "opening card" that scales from click point */
        .ada-transition-card {
            position: absolute;
            width: 72px; height: 72px;
            background: var(--panel, #161b22);
            border: 1px solid var(--border, #30363d);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            color: var(--blue, #58a6ff);
            transform: translate(var(--tx, -9999px), var(--ty, -9999px)) scale(1);
            box-shadow: 0 8px 24px rgba(0,0,0,0.45);
            transition: transform 0.62s cubic-bezier(0.32, 0.72, 0, 1),
                        width 0.5s cubic-bezier(0.32, 0.72, 0, 1),
                        height 0.5s cubic-bezier(0.32, 0.72, 0, 1),
                        border-radius 0.5s cubic-bezier(0.32, 0.72, 0, 1),
                        background 0.4s ease,
                        border-color 0.4s ease;
            overflow: hidden;
        }
        #ada-transition.active .ada-transition-card {
            top: 50% !important; left: 50% !important;
            transform: translate(-50%, -50%) scale(var(--scale, 12));
            width: 100vmax; height: 100vmax;
            border-radius: 24px;
            background: var(--bg, #0d1117);
            border-color: var(--border, #30363d);
        }

        .ada-transition-icon {
            width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center;
            transition: opacity 0.25s ease 0.15s, transform 0.3s ease;
        }
        .ada-transition-icon svg { width: 100%; height: 100%; }
        #ada-transition.active .ada-transition-icon {
            opacity: 0;
            transform: scale(0.5);
        }

        .ada-transition-meta {
            position: absolute;
            left: 50%; top: 50%;
            transform: translate(-50%, calc(-50% + 56px));
            text-align: center;
            opacity: 0;
            transition: opacity 0.3s ease 0.25s;
            width: 220px;
        }
        #ada-transition.active .ada-transition-meta { opacity: 1; }

        .ada-transition-name {
            font-size: 13px; font-weight: 600; color: var(--text, #e6edf3);
            letter-spacing: 1.5px; text-transform: uppercase;
            margin-bottom: 14px;
        }
        .ada-transition-bar {
            width: 160px; height: 2px;
            background: var(--border, #30363d);
            border-radius: 2px; margin: 0 auto 10px;
            overflow: hidden;
        }
        .ada-transition-bar-fill {
            width: 0; height: 100%;
            background: linear-gradient(90deg, var(--blue, #58a6ff), var(--purple, #a371f7));
            animation: ada-fill 0.6s ease forwards;
        }
        @keyframes ada-fill { to { width: 100%; } }

        .ada-transition-status {
            font-family: ui-monospace, "SF Mono", Consolas, monospace;
            font-size: 9px; color: var(--muted, #8b949e);
            letter-spacing: 2px;
        }

        /* "Click pulse" — small ripple at the click point so the
           origin of the transition is visible even on the page */
        .ada-click-pulse {
            position: fixed; z-index: 999998;
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--blue, #58a6ff);
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
            pointer-events: none;
            animation: ada-pulse 0.5s ease-out forwards;
        }
        @keyframes ada-pulse {
            to { transform: translate(-50%, -50%) scale(18); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // ============== BUILD OVERLAY ==============
    const overlay = document.createElement('div');
    overlay.id = 'ada-transition';
    overlay.innerHTML = `
        <div class="ada-transition-card" id="ada-transition-card">
            <div class="ada-transition-icon" id="ada-transition-icon"></div>
            <div class="ada-transition-meta">
                <div class="ada-transition-name" id="ada-transition-name">Loading</div>
                <div class="ada-transition-bar"><div class="ada-transition-bar-fill"></div></div>
                <div class="ada-transition-status" id="ada-transition-status">INITIALIZING</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const card = document.getElementById('ada-transition-card');
    const iconEl = document.getElementById('ada-transition-icon');
    const nameEl = document.getElementById('ada-transition-name');
    const statusEl = document.getElementById('ada-transition-status');

    // ============== ENTRY ANIMATION ==============
    // Tag body so it can fade in nicely on first paint.
    function applyEntryAnimation() {
        // Don't apply on pages that manage their own opacity (e.g. the OS shell in dash.html)
        if (document.body.classList.contains('ada-no-entry-anim')) return;
        document.body.classList.add('ada-page');
        // Force reflow then add ready
        void document.body.offsetWidth;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => document.body.classList.add('ada-page-ready'));
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyEntryAnimation);
    } else {
        applyEntryAnimation();
    }

    // ============== NAV INTERCEPTION ==============
    let isTransitioning = false;

    function shouldIntercept(link) {
        if (!link || !link.getAttribute) return false;
        const href = link.getAttribute('href');
        if (!href) return false;
        // Skip external, mailto, tel, anchors, downloads, target=_blank, etc.
        if (href.startsWith('#')) return false;
        if (href.startsWith('mailto:')) return false;
        if (href.startsWith('tel:')) return false;
        if (link.target && link.target !== '' && link.target !== '_self') return false;
        if (link.hasAttribute('download')) return false;
        if (link.dataset.adaNoTransition === 'true') return false;

        // Resolve to absolute URL
        let url;
        try { url = new URL(href, window.location.href); } catch (e) { return false; }

        // Only intercept same-origin
        if (url.origin !== window.location.origin) return false;

        return true;
    }

    function findIcon(link) {
        // Try to find an SVG in the link itself
        const svg = link.querySelector('svg');
        if (svg) return svg.outerHTML;
        return '';
    }

    function findName(link) {
        // Prefer explicit data attribute, then text, then title
        if (link.dataset.adaName) return link.dataset.adaName;
        const title = link.getAttribute('title');
        if (title) return title;
        const text = (link.textContent || '').trim();
        if (text) return text.split('\n')[0].trim().slice(0, 40);
        // Fallback: filename from href
        try {
            const url = new URL(link.getAttribute('href'), window.location.href);
            const parts = url.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || 'Application';
        } catch (e) { return 'Application'; }
    }

    function startTransition(href, name, svgHTML, clickX, clickY) {
        if (isTransitioning) return;
        isTransitioning = true;

        // Position card at click point
        const startX = clickX != null ? clickX - 36 : window.innerWidth / 2 - 36;
        const startY = clickY != null ? clickY - 36 : window.innerHeight / 2 - 36;
        card.style.setProperty('--tx', startX + 'px');
        card.style.setProperty('--ty', startY + 'px');
        card.style.transform = `translate(${startX}px, ${startY}px) scale(1)`;

        // Calculate scale to cover viewport
        const scale = Math.max(window.innerWidth, window.innerHeight) / 50;
        card.style.setProperty('--scale', scale);

        // Reset bar animation (re-trigger)
        const bar = card.querySelector('.ada-transition-bar-fill');
        if (bar) {
            bar.style.animation = 'none';
            void bar.offsetWidth;
            bar.style.animation = '';
        }

        iconEl.innerHTML = svgHTML || '';
        nameEl.textContent = (name || 'Application').toUpperCase();
        statusEl.textContent = 'INITIALIZING';

        // Force reflow then activate
        void overlay.offsetWidth;
        overlay.classList.add('active');

        // Status text progression
        const statuses = ['INITIALIZING', 'LOADING MODULES', 'ESTABLISHING LINK', 'READY'];
        let sIdx = 0;
        const statusInterval = setInterval(() => {
            sIdx++;
            if (sIdx < statuses.length) statusEl.textContent = statuses[sIdx];
        }, Math.floor(TRANSITION_MS / statuses.length));

        setTimeout(() => {
            clearInterval(statusInterval);
            window.location.href = href;
        }, TRANSITION_MS);
    }

    // Click pulse helper
    function showPulse(x, y) {
        const pulse = document.createElement('div');
        pulse.className = 'ada-click-pulse';
        pulse.style.left = x + 'px';
        pulse.style.top = y + 'px';
        document.body.appendChild(pulse);
        setTimeout(() => pulse.remove(), 600);
    }

    // Delegated click handler
    document.addEventListener('click', (e) => {
        // Skip if modified click (let browser open in new tab etc.)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        if (e.button !== 0) return; // only left click

        // Pages with the OS shell manage their own transitions
        if (document.body.classList.contains('ada-no-entry-anim')) return;

        // Walk up to find the link
        let el = e.target;
        while (el && el !== document.body) {
            if (el.tagName === 'A' && shouldIntercept(el)) {
                e.preventDefault();
                const href = el.getAttribute('href');
                const name = findName(el);
                const svg = findIcon(el);
                showPulse(e.clientX, e.clientY);
                startTransition(href, name, svg, e.clientX, e.clientY);
                return;
            }
            el = el.parentElement;
        }
    });

    // ============== PUBLIC API ==============
    // Allow other scripts to trigger the transition manually.
    window.ADA_NAV = {
        go: function(href, opts) {
            opts = opts || {};
            startTransition(
                href,
                opts.name || 'Application',
                opts.icon || '',
                opts.x != null ? opts.x : window.innerWidth / 2,
                opts.y != null ? opts.y : window.innerHeight / 2
            );
        }
    };
})();
