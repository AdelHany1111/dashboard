const CACHE_NAME = 'empire_os_cache_v1';

// الملفات الأساسية اللي لازم تتحمل وتتكاش أول ما التطبيق يفتح
const CACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// تنصيب السيرفيس وركر (Install)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('[Service Worker] جاري تخزين الملفات الأساسية...');
            return cache.addAll(CACHE_ASSETS);
        })
        .then(() => self.skipWaiting())
    );
});

// تفعيل السيرفيس وركر (Activate) وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] مسح كاش قديم:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// التحكم في الطلبات (Fetch)
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // لو الطلب رايح لمكتبات خارجية (CDN) زي الخطوط أو Tailwind أو Chart.js
    // نستخدم استراتيجية: Cache First (الكاش أولاً عشان السرعة والأوفلاين)
    if (requestUrl.origin.includes('cdn.tailwindcss.com') || 
        requestUrl.origin.includes('cdnjs.cloudflare.com') || 
        requestUrl.origin.includes('cdn.jsdelivr.net') || 
        requestUrl.origin.includes('fonts.googleapis.com') || 
        requestUrl.origin.includes('fonts.gstatic.com') ||
        requestUrl.origin.includes('api.dicebear.com')) {
        
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // للملفات العادية (index.html) والبيانات
    // نستخدم استراتيجية: Network First (النت أولاً عشان يجيب أحدث نسخة، ولو مفيش نت يفتح الكاش)
    event.respondWith(
        fetch(event.request)
        .then((response) => {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, resClone);
            });
            return response;
        })
        .catch(() => {
            return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                // لو مفيش نت ومفيش كاش، نرجع الصفحة الرئيسية
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});