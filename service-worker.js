<script>
const CACHE_NAME = "branch-linker-cache-v1";

const ASSETS_TO_CACHE = [
  "/",                // root
  "?v=manifest",      // manifest
  "?v=service-worker",// service worker itself
  "index.html",       // your main page
  "script.js",        // if you have JS
  "https://cdn-icons-png.flaticon.com/512/14098/14098677.png",
  "https://cdn-icons-png.flaticon.com/512/14098/14098677.png"
];

// Install event: cache everything
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch event: network first, fallback to cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Save fresh copy to cache
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
</script>
