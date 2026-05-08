/* ══════════════════════════════════════════
   Skillak Service Worker v15
   ══════════════════════════════════════════ */
const CACHE = 'skillak-v27';
const ASSETS = [
  './', './index.html', './style.css', './style_patch.css',
  './script.js', './patch4.js', './patch_final.js', './patch_v9.js',
  './patch_fix_refund.js',
  './style_brand.css',
  './patch_master.js',
  './skillak_hotfix.js',
  './skillak_luxury.css',
  './skillak_finance_patch.js',
  './skillak.png', './icon-192.png', './icon-512.png',
  './skillak_ads_top_fix.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] cache addAll error:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // لا نخزن طلبات Firebase أو الـ APIs الخارجية
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('emailjs') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('fonts.g')
  ) {
    return; // لا تخزّن — اتصل مباشرة
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached || new Response('', { status: 503 }));
    })
  );
});
