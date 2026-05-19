importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts('/uv/uv.sw.js');

// Tell bare-mux where the bare server is
const { setTransport, EpoxyClient } = BareMux;

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
