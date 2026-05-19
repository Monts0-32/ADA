importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts('/uv/uv.sw.js');

// Polyfill BareClient to talk directly to your worker's /bare/ endpoint
self.BareMuxConnection = class {
    constructor() {}
    async setTransport() { return; }
};

// Override the BareClient inside Ultraviolet to point to your worker
const _UV = self.Ultraviolet;
const BARE_URL = 'https://ada-relay.andrewdinglearchive.workers.dev/bare/';

class DirectBareClient {
    async fetch(url, options = {}) {
        const headers = new Headers();
        headers.set('x-bare-url', url.toString());
        headers.set('x-bare-headers', JSON.stringify(options.headers || {}));
        if (options.method) headers.set('x-bare-method', options.method);

        const res = await fetch(BARE_URL, {
            method: 'POST',
            headers,
            body: options.body || null
        });

        const bareStatus    = parseInt(res.headers.get('x-bare-status') || '200');
        const bareHeaders   = JSON.parse(res.headers.get('x-bare-headers') || '{}');
        const finalURL      = res.headers.get('x-bare-final-url') || url.toString();

        return {
            status:    bareStatus,
            statusText: res.headers.get('x-bare-status-text') || '',
            headers:   { rawHeaders: bareHeaders },
            body:      res.body,
            finalURL
        };
    }
}

// Patch Ultraviolet to use our direct bare client
const OrigUV = self.Ultraviolet;
self.Ultraviolet = function(config) {
    const instance = new OrigUV(config);
    instance.bareClient = new DirectBareClient();
    return instance;
};
Object.assign(self.Ultraviolet, OrigUV);

const sw = new UVServiceWorker();

self.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            if (sw.route(event)) {
                return await sw.fetch(event);
            }
            return await fetch(event.request);
        })()
    );
});
