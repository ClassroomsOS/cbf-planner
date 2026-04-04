// CBF Planner — Service Worker (Sprint 7 PWA)
// Strategy: cache-first for static assets, network-only for Supabase

const CACHE = 'cbf-planner-v1'
const BASE  = '/cbf-planner'

// Shell files to pre-cache on install
const SHELL = [
  BASE + '/',
  BASE + '/index.html',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Always go network for Supabase (auth, DB, functions)
  if (url.hostname.includes('supabase.co')) return

  // Navigation requests: network first → cached shell fallback (offline support)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(BASE + '/index.html'))
    )
    return
  }

  // Static assets (JS, CSS, SVG, fonts): cache first → network + update cache
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (!res.ok) return res
        const ext = url.pathname.split('.').pop()
        if (['js', 'css', 'svg', 'woff', 'woff2', 'png', 'ico'].includes(ext)) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      })
    })
  )
})
