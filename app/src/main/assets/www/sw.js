// Работа сайта без интернета. Страницы и скрипты берутся из сети, а если её нет — из кэша;
// фото кэшируются по мере просмотра. Номер версии обновляет tools/release.sh
const VERSION = '2.3.0';
const CACHE = 'aerogrill-' + VERSION;
const CORE = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
  'js/version.js', 'js/data-ingredients.js', 'js/data-recipes.js', 'js/data-recipes-2.js', 'js/data-recipes-3.js',
  'js/data-recipes-4.js', 'js/data-recipes-5.js', 'js/data-photos.js', 'js/data-prices.js', 'js/app.js'];

self.addEventListener('install', e => {
  // reload — мимо кэша браузера, иначе новая версия могла бы сохранить старые файлы
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('aerogrill-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // GitHub и прочее — без кэша
  const isImage = url.pathname.includes('/img/');
  e.respondWith(caches.open(CACHE).then(async cache => {
    if (isImage) {
      const hit = await cache.match(e.request);
      if (hit) return hit;
    }
    try {
      // no-cache: браузер всегда сверяется с сайтом (это дёшево — сервер отвечает «не изменилось»),
      // иначе после выхода новой версии до 10 минут показывались бы старые файлы
      const res = await fetch(isImage ? e.request : new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }));
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(e.request, { ignoreSearch: true })) || (await cache.match('index.html'));
    }
  }));
});
