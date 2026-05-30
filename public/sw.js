const CACHE_NAME = "icc-v21";
const STATIC_ASSETS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Força reload em todos os clientes após ativar novo SW
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

// Network-first para tudo — sempre busca o código mais novo, cache só como fallback offline
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca interceptar chamadas ao Supabase, proxy IA, POST ou o próprio sw.js
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("anthropic") ||
    request.method !== "GET" ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // Network-first: tenta buscar da rede, cai no cache se offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});
