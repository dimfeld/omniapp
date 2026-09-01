/// <reference lib="webworker" />

import { base, build, files, version } from "$service-worker";

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `omni-${version}`;
const appShell = `${base}/`;
const precache = [...new Set([...build, ...files, appShell])];

worker.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precache)));
  void worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
      )
      .then(() => worker.clients.claim())
  );
});

worker.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== worker.location.origin) return;
  if (url.pathname.startsWith(`${base}/api/`)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match(request)) ?? (await caches.match(appShell)) ?? Response.error()
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
          }
          return response;
        })
    )
  );
});
