/**
 * ADA Configuration
 * ------------------------------------------------------------
 * Single source of truth for environment-wide settings.
 *
 * To point every page at a different API endpoint, edit the
 * value of `API` below — no other file needs to change, as
 * long as they read it via `window.ADA_CONFIG.API` (with a
 * fallback to the same default for safety).
 *
 * The `transitionMs` value controls the duration of the
 * app-launch transition between pages (in milliseconds).
 * ------------------------------------------------------------
 */
(function() {
    window.ADA_CONFIG = {
        // Worker / API endpoint used across the archive.
        // Embedded Pages Function lives at functions/api/[[path]].js,
        // which is served at /api/* automatically by Cloudflare Pages.
        // The DB binding (D1) is exposed as `env.DB` inside the worker.
        API: "/api",

        // How long the page-transition animation runs.
        // Keep this in sync with the duration in page-transition.js
        // (the JS hardcodes 700ms for the navigation; this is the
        // value the entry-animation waits for before fading in).
        transitionMs: 700,

        // Escape-key redirect (used by escape-key.js if it loads config first)
        escapeURL: "https://www.google.com"
    };
})();
