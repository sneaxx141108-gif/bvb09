/* BVB 09 – Service Worker: App offline verfuegbar, Daten immer frisch */
const SHELL = 'bvb09-shell-v27';
const IMG = 'bvb09-img-v1';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== IMG).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req.url.split('?')[0], res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req.url.split('?')[0]);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

async function cacheFirst(req, name, limit) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    cache.put(req, res.clone());
    if (limit) cache.keys().then((keys) => { if (keys.length > limit) keys.slice(0, keys.length - limit).forEach((k) => cache.delete(k)); });
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/data/')) e.respondWith(networkFirst(req));
    else e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, SHELL));
    return;
  }
  if (/transfermarkt\.technology$|akamaized\.net$|wikimedia\.org$|imgur\.com$|dfb\.de$|thesportsdb\.com$|espncdn\.com$|fotmob\.com$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, IMG, 600));
  }
  // OpenLigaDB-Live-Daten und alles andere: immer direkt aus dem Netz
});
