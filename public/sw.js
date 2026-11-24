/* 站点静态资源缓存: 带 hash 的 assets 长期缓存, 页面导航网络优先 */
const ASSET_CACHE = 'qiatia-assets-v1';
const HTML_CACHE = 'qiatia-html-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('qiatia-') && key !== ASSET_CACHE && key !== HTML_CACHE
          )
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** 写入缓存失败(如 no-store 或配额不足)时静默忽略 */
function put(cache, request, response) {
  cache.put(request, response).catch(() => {});
}

/** 构建产物带内容 hash, 可安全地缓存优先 */
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) put(cache, request, response.clone());
  return response;
}

/** 页面导航网络优先, 断网时回退到缓存 */
async function networkFirst(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) put(cache, request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});
