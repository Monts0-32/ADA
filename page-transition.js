/**
 * ADA Page Transition v2.0
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
 *
 * Public surface preserved from v1:
 *   - body.ada-no-entry-anim   (opt out of entry + outbound)
 *   - body.ada-page / .ada-page-ready (entry fade stages)
 *   - data-ada-no-transition   (opt a single link out)
 *   - data-ada-name            (override the overlay name)
 *   - window.ADA_NAV.go(href, opts)
 * ------------------------------------------------------------
 */
(function () {
    'use strict';

    try {
        const config = window.ADA_CONFIG || { transitionMs: 700 };
        const reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const TRANSITION_MS = reduceMotion
            ? 180
            : (config.transitionMs || 700);

        // ============== STYLES ==============
        const style = document.createElement('style');
        style.textContent = `
            /* Subtle entry animation for the page itself.
               Opacity-only — no transform on <body> so it can never
               create a containing block for position:fixed children
               (the overlay) or fight with other engines that touch
               body transforms. */
            .ada-page {
                opacity: 0;
                transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .ada-page.ada-page-ready { opacity: 1; }

            /* Transition overlay (full-screen) */
            #ada-transition {
                position: fixed; inset: 0; z-index: 999999;
                background: var(--bg, #0d1117);
                opacity: 0; visibility: hidden;
                pointer-events: none;
                transition: opacity 0.16s ease, visibility 0.16s ease;
                overflow: hidden;
            }
            #ada-transition.active {
                opacity: 1; visibility: visible;
                pointer-events: auto;
            }

            /* The "opening card" that grows from the click point.
               Position:fixed at (0,0); a single transform places
               AND scales it, so there's no jump-to-center moment. */
            .ada-transition-card {
                position: fixed;
                top: 0; left: 0;
                width: 72px; height: 72px;
                background: var(--panel, #161b22);
                border: 1px solid var(--border, #30363d);
                border-radius: 12px;
                display: flex; align-items: center; justify-content: center;
                color: var(--blue, #58a6ff);
                transform: translate(-9999px, -9999px) scale(1);
                box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                transition: transform 0.62s cubic-bezier(0.32, 0.72, 0, 1),
                            background 0.4s ease,
                            border-color 0.4s ease,
                            border-radius 0.5s cubic-bezier(0.32, 0.72, 0, 1);
                will-change: transform;
                overflow: hidden;
            }
            #ada-transition.active .ada-transition-card {
                background: var(--bg, #0d1117);
                border-color: var(--border, #30363d);
                border-radius: 24px;
            }
            #ada-transition.reduced-motion .ada-transition-card {
                transition: opacity 0.12s ease, transform 0.12s ease;
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
                pointer-events: none;
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
            }
            /* Re-trigger the bar fill by toggling this class. */
            .ada-transition-bar-fill.ada-bar-run {
                animation: ada-fill 0.62s cubic-bezier(0.32, 0.72, 0, 1) forwards;
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
        if (reduceMotion) overlay.classList.add('reduced-motion');
        overlay.innerHTML = `
            <div class="ada-transition-card" id="ada-transition-card">
                <div class="ada-transition-icon" id="ada-transition-icon"></div>
                <div class="ada-transition-meta">
                    <div class="ada-transition-name" id="ada-transition-name">Loading</div>
                    <div class="ada-transition-bar"><div class="ada-transition-bar-fill" id="ada-transition-bar-fill"></div></div>
                    <div class="ada-transition-status" id="ada-transition-status">INITIALIZING</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const card = document.getElementById('ada-transition-card');
        const iconEl = document.getElementById('ada-transition-icon');
        const nameEl = document.getElementById('ada-transition-name');
        const statusEl = document.getElementById('ada-transition-status');
        const barFill = document.getElementById('ada-transition-bar-fill');

        // ============== ENTRY ANIMATION ==============
        // Opacity-only on <body>. No transform, so this never creates
        // a containing block for position:fixed descendants and never
        // fights with other engines (header, announcement) that touch
        // body transforms.
        function applyEntryAnimation() {
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
        let activeTimers = [];

        function clearActiveTimers() {
            activeTimers.forEach((t) => clearTimeout(t));
            activeTimers = [];
        }

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
            const svg = link.querySelector('svg');
            if (svg) return svg.outerHTML;
            return '';
        }

        function findName(link) {
            if (link.dataset.adaName) return link.dataset.adaName;
            const title = link.getAttribute('title');
            if (title) return title;
            const text = (link.textContent || '').trim();
            if (text) return text.split('\n')[0].trim().slice(0, 40);
            try {
                const url = new URL(link.getAttribute('href'), window.location.href);
                const parts = url.pathname.split('/').filter(Boolean);
                return parts[parts.length - 1] || 'Application';
            } catch (e) { return 'Application'; }
        }

        function startTransition(href, name, svgHTML, clickX, clickY) {
            if (isTransitioning) return;
            isTransitioning = true;
            clearActiveTimers();

            // Anchor the card to the click point (center of the 72px card).
            const startX = (clickX != null ? clickX : window.innerWidth / 2) - 36;
            const startY = (clickY != null ? clickY : window.innerHeight / 2) - 36;

            // Compute the scale needed to cover the viewport from this
            // anchor point. Use the diagonal of the viewport so a corner
            // click still covers the opposite corner. The +2 is headroom.
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const diag = Math.hypot(vw, vh);
            const scale = Math.ceil(diag / 40) + 2;

            if (reduceMotion) {
                // Skip the dramatic scale — just show the overlay.
                card.style.transition = 'none';
                card.style.transform =
                    'translate(' + startX + 'px, ' + startY + 'px) scale(' + scale + ')';
                // Force layout, then re-enable transitions for next time.
                void card.offsetWidth;
                card.style.transition = '';
            } else {
                // Stage 1: place at click point at scale 1.
                card.style.transform =
                    'translate(' + startX + 'px, ' + startY + 'px) scale(1)';
            }

            // Re-trigger the bar fill by toggling the class. Removing
            // then re-adding in a microtask is the reliable way to
            // restart a CSS animation across navigations.
            barFill.classList.remove('ada-bar-run');
            void barFill.offsetWidth; // force reflow so the re-add is seen
            barFill.classList.add('ada-bar-run');

            iconEl.innerHTML = svgHTML || '';
            nameEl.textContent = (name || 'Application').toUpperCase();
            statusEl.textContent = 'INITIALIZING';

            // Force reflow then activate. The overlay fades in, the
            // card animates to its full size, status stages fire.
            void overlay.offsetWidth;
            overlay.classList.add('active');

            if (!reduceMotion) {
                // Kick off the scale animation in the next frame so the
                // browser registers the starting transform first.
                requestAnimationFrame(() => {
                    card.style.transform =
                        'translate(' + startX + 'px, ' + startY + 'px) scale(' + scale + ')';
                });
            }

            // Status stages, tied to the visible overlay phases, not a
            // fixed interval. Each stage is a setTimeout that records
            // its handle so we can cancel if a new transition starts.
            const stages = [
                { at: 0,            text: 'INITIALIZING' },
                { at: TRANSITION_MS * 0.35, text: 'LOADING MODULES' },
                { at: TRANSITION_MS * 0.65, text: 'ESTABLISHING LINK' },
                { at: TRANSITION_MS * 0.90, text: 'READY' }
            ];
            stages.forEach((stage) => {
                const t = setTimeout(() => {
                    statusEl.textContent = stage.text;
                }, stage.at);
                activeTimers.push(t);
            });

            // Navigate.
            const navTimer = setTimeout(() => {
                clearActiveTimers();
                window.location.href = href;
            }, TRANSITION_MS);
            activeTimers.push(navTimer);
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
            if (e.defaultPrevented) return; // let other handlers claim it

            // Pages with the OS shell manage their own transitions.
            if (document.body.classList.contains('ada-no-entry-anim')) return;
            if (isTransitioning) return; // already mid-transition

            // Walk up to find the link. composedPath handles shadow DOM;
            // parentElement walk is the fallback.
            let el = e.target;
            const path = (typeof e.composedPath === 'function') ? e.composedPath() : null;
            const nodes = path && path.length ? path : (function walkUp() {
                const out = [];
                let n = el;
                while (n && n !== document.body) { out.push(n); n = n.parentElement; }
                return out;
            })();

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (!node || node === document.body) break;
                if (node.tagName === 'A' && shouldIntercept(node)) {
                    e.preventDefault();
                    const href = node.getAttribute('href');
                    const name = findName(node);
                    const svg = findIcon(node);
                    showPulse(e.clientX, e.clientY);
                    startTransition(href, name, svg, e.clientX, e.clientY);
                    return;
                }
            }
        });

        // ============== PUBLIC API ==============
        // Allow other scripts to trigger the transition manually.
        window.ADA_NAV = {
            go: function (href, opts) {
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
    } catch (err) {
        // Never let a transition failure take the page down.
        try { console.error('[ada-transition] disabled:', err); } catch (e) {}
    }
})();
