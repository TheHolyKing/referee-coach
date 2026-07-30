const VERSION = '1.5.9';
const CACHE   = 'refcoach-' + VERSION;
// Relative to this script's own location, so precaching works whether the
// app is deployed at the domain root or a subpath (e.g. GitHub Pages'
// /referee-coach/, which manifest.json's scope/start_url assume).
const ASSETS  = ['./', './index.html', './styles.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  // Don't skipWaiting — wait for the app to prompt the user
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url);

  // Network-first for the app shell and version file — always stay current.
  // Falls back to cache if offline. pathname.endsWith('/') (rather than
  // === '/') so this also matches a subpath deployment root.
  if (pathname.endsWith('.html') || pathname.endsWith('/') || pathname.endsWith('version.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (JS, CSS, icons)
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// Allow the app to trigger activation of the waiting SW
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
