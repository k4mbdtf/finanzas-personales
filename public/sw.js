// Service worker mínimo y sin dependencias.
//  * Navegación (index.html): red primero; si no hay conexión, la copia en caché.
//    Así cada despliegue nuevo se ve al abrir la app con internet.
//  * /assets/* (JS/CSS con hash en el nombre, inmutables): caché primero.
//  * Íconos y manifest: caché primero.
//  * NUNCA se cachean llamadas a Supabase ni a otros orígenes: los datos
//    financieros siempre vienen del servidor y no quedan guardados en el SW.
//  * Al abrir la app con internet se borran del caché los /assets/* que ya no
//    están en el build actual (asset-manifest.json, generado por Vite), para que
//    no se acumulen los de cada despliegue.
// Cambia VERSION para forzar la limpieza de cachés antiguas.
const VERSION = 'v1'
const CACHE = `finanzas-${VERSION}`
const SHELL = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('finanzas-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return // Supabase, Turnstile, etc.

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          event.waitUntil(pruneAssets())
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
      if (res.ok && (url.pathname.includes('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname))) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})

/** Borra del caché los /assets/* que no pertenecen al build publicado ahora. */
async function pruneAssets() {
  try {
    const res = await fetch('./asset-manifest.json', { cache: 'no-store' })
    if (!res.ok) return
    const manifest = await res.json()
    const current = new Set()
    for (const chunk of Object.values(manifest)) {
      for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
        if (file) current.add(new URL(file, self.registration.scope).href)
      }
    }
    if (current.size === 0) return
    const cache = await caches.open(CACHE)
    for (const req of await cache.keys()) {
      if (new URL(req.url).pathname.includes('/assets/') && !current.has(req.url)) await cache.delete(req)
    }
  } catch {
    // Sin conexión o manifiesto inválido: se intenta en la próxima apertura.
  }
}
