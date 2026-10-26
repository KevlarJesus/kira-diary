// Оболочка дневника в браузере: страница и её файлы живут в кэше, поэтому
// в лифте и в метро приложение открывается и показывает записи с телефона.
// Сами записи хранит store.ts в localStorage, здесь только статика.
//
// Правила простые: страницу берём из сети и кладём в кэш (чтобы выкат доезжал сразу),
// файлы сборки — из кэша (их имена с хэшем, старый файл никогда не меняется),
// чужие адреса — Supabase, шрифты — мимо кэша.

const CACHE = 'kira-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

async function fromNetwork(request) {
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // Страница: сеть вперёд, кэш — когда сети нет.
  if (request.mode === 'navigate') {
    event.respondWith(
      fromNetwork(request).catch(async () => {
        const cache = await caches.open(CACHE)
        return (await cache.match(request)) ?? (await cache.match('index.html')) ?? Response.error()
      }),
    )
    return
  }

  // Файлы сборки: кэш вперёд, сеть — за тем, чего в нём ещё нет.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      try {
        return await fromNetwork(request)
      } catch (error) {
        return Response.error()
      }
    })(),
  )
})
