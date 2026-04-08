const STATIC_CACHE = "rankforge-static-v2";
const DYNAMIC_CACHE = "rankforge-dynamic-v2";
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/pwa-192.svg", "/pwa-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => ![STATIC_CACHE, DYNAMIC_CACHE].includes(key)).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const request = event.request;
  const requestUrl = new URL(request.url);

  if (requestUrl.origin.includes("firestore.googleapis.com") || requestUrl.origin.includes("firebase.googleapis.com")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/offline.html"));
    return;
  }

  if (["style", "script", "worker", "image", "font"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackPath) {
      const fallback = await caches.match(fallbackPath);
      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkFetch = fetch(request)
    .then(async (response) => {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || networkFetch || Response.error();
}
