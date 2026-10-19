/* GitHub Pages-only offline shell and explicitly saved local games. */
const VERSION = "classroom-shell-v1";
const GAME_CACHE = "classroom-offline-games-v1";
const SHELL = ["./", "index.html", "files.html", "manifest.webmanifest", "assets/css/app.css", "assets/js/catalog.js", "assets/js/local-games.js", "assets/js/app.js", "assets/js/pwa.js", "assets/img/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.indexOf("classroom-") === 0 && key !== VERSION && key !== GAME_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const isGame = url.pathname.indexOf(scope.pathname + "assets/games/") === 0;
  if (isGame) {
    event.respondWith(caches.open(GAME_CACHE).then((cache) => cache.match(request).then((cached) => cached || fetch(request))));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response && response.ok) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match(new URL("index.html", scope).href))));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request).then((response) => {
    if (response && response.ok) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  const reply = (value) => { if (port) port.postMessage(value); };
  const scope = new URL(self.registration.scope);
  const cacheGame = (path) => {
    if (typeof path !== "string" || !/^assets\/games\/[a-zA-Z0-9._-]+\.html?$/.test(path)) return Promise.reject(new Error("Invalid local game path"));
    const url = new URL(path, scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname + "assets/games/")) return Promise.reject(new Error("Outside site scope"));
    return caches.open(GAME_CACHE).then((cache) => fetch(url.href).then((response) => {
      if (!response.ok) throw new Error("Download failed (" + response.status + ")");
      return cache.put(url.href, response.clone()).then(() => ({ ok: true }));
    }));
  };
  if (data.type === "CACHE_GAME") {
    event.waitUntil(cacheGame(data.path).then(reply).catch((error) => reply({ ok: false, error: error.message || "Could not save this file" })));
  } else if (data.type === "REMOVE_GAME") {
    event.waitUntil(caches.open(GAME_CACHE).then((cache) => cache.delete(new URL(data.path, scope).href)).then((removed) => reply({ ok: true, removed })));
  } else if (data.type === "CHECK_GAME") {
    event.waitUntil(caches.open(GAME_CACHE).then((cache) => cache.match(new URL(data.path, scope).href)).then((match) => reply({ ok: true, cached: !!match })));
  } else if (data.type === "CLEAR_GAMES") {
    event.waitUntil(caches.delete(GAME_CACHE).then((removed) => reply({ ok: true, removed })));
  }
});
