/* 為 GitHub Pages 補上 COOP/COEP 標頭，啟用 SharedArrayBuffer。
   此檔案必須與 index.html 放在同一層目錄。 */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (e) => {
    const r = e.request;
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;
    e.respondWith(
      fetch(r).then((res) => {
        if (res.status === 0) return res;
        const h = new Headers(res.headers);
        h.set('Cross-Origin-Embedder-Policy', 'require-corp');
        h.set('Cross-Origin-Opener-Policy', 'same-origin');
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
      }).catch((err) => console.error(err))
    );
  });
} else {
  (async () => {
    if (window.crossOriginIsolated || !window.isSecureContext || !navigator.serviceWorker) return;
    const reg = await navigator.serviceWorker.register(document.currentScript.src);
    const once = () => {
      if (sessionStorage.getItem('coi-reloaded')) return;
      sessionStorage.setItem('coi-reloaded', '1');
      location.reload();
    };
    reg.addEventListener('updatefound', () => {
      reg.installing.addEventListener('statechange', (e) => { if (e.target.state === 'activated') once(); });
    });
    if (reg.active && !navigator.serviceWorker.controller) once();
  })();
}
