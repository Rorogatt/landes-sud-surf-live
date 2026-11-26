/**
 * Service Worker "Mode Pinède & Parking Sans 4G" — Sud Landes Surf Live v2
 *
 * Stratégies :
 * 1. App Shell ESM + CSS + HLS.js + Icônes : Precache à l'installation + StaleWhileRevalidate
 * 2. Google Fonts : CacheFirst longue durée
 * 3. APIs Open-Meteo (Marine + AROME) & Bouées (Portus / EUSKOOS) : NetworkFirst (timeout 4s) -> Fallback Cache
 * 4. Flux vidéo (.m3u8, .ts, quanteec, viewsurf, digitalmax) : Bypass strict (jamais mis en cache)
 */

const SHELL_CACHE = 'landes-surf-shell-v2';
const DATA_CACHE = 'landes-surf-data-v2';
const FONT_CACHE = 'landes-surf-fonts-v2';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/index.css',
  './vendor/hls.min.js',
  './js/app.js',
  './js/data/spotsBase.js',
  './js/data/webcams.js',
  './js/services/time.js',
  './js/services/tides.js',
  './js/services/oceanApi.js',
  './js/services/buoys.js',
  './js/services/scoring.js',
  './js/services/safetyAndCoach.js',
  './js/components/coastMap.js',
  './js/components/webcamPlayer.js',
  './js/components/charts.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, DATA_CACHE, FONT_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStreamingMedia(url) {
  const host = url.hostname;
  const path = url.pathname;
  return (
    path.endsWith('.m3u8') ||
    path.endsWith('.ts') ||
    path.endsWith('.m4s') ||
    host.includes('quanteec.com') ||
    host.includes('viewsurf.com') ||
    host.includes('digitalmax.fr')
  );
}

function isTelemetryApi(url) {
  return (
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('euskoos.eus')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Ne jamais intercepter les flux vidéo live
  if (isStreamingMedia(url)) return;

  // 2. Polices Google Fonts : CacheFirst
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const net = await fetch(request);
        if (net.ok) cache.put(request, net.clone());
        return net;
      })
    );
    return;
  }

  // 3. APIs Météo / Marine / Bouées GET : NetworkFirst avec timeout 4.5s -> Fallback Cache Pinède
  if (isTelemetryApi(url)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4500);
        try {
          const res = await fetch(request, { signal: ctrl.signal });
          clearTimeout(timer);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          clearTimeout(timer);
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('Offline and not in cache');
        }
      })
    );
    return;
  }

  // 4. App Shell local : supporte les deep-links hors-ligne (?spot=...&level=...)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached =
          (await cache.match(request, { ignoreSearch: request.mode === 'navigate' })) ||
          (request.mode === 'navigate' ? await cache.match('./index.html') : null);
        const fetchPromise = fetch(request)
          .then((netRes) => {
            if (netRes.ok && !url.search) cache.put(request, netRes.clone());
            return netRes;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
