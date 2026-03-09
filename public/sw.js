// Service Worker for comprehensive caching strategies
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
  api: 5 * 60 * 1000, // 5 minutes
  images: 24 * 60 * 60 * 1000, // 24 hours
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/placeholder.svg',
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/rest\/v1\/patients/,
  /\/rest\/v1\/autotexts/,
  /\/rest\/v1\/clinical_phrases/,
  /\/rest\/v1\/templates/,
  /\/rest\/v1\/user_dictionary/,
];

// Performance metrics storage
const performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  cacheRetrievalTime: [],
};

// Install event - precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('static-') || 
                   name.startsWith('dynamic-') || 
                   name.startsWith('api-') ||
                   name.startsWith('images-');
          })
          .filter((name) => {
            return name !== STATIC_CACHE && 
                   name !== DYNAMIC_CACHE && 
                   name !== API_CACHE &&
                   name !== IMAGE_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on request type
  if (isApiRequest(url)) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, CACHE_TTL.api));
  } else if (isImageRequest(url)) {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE, CACHE_TTL.images));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE, CACHE_TTL.static));
  } else {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
});

// Check if request is an API call
function isApiRequest(url) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname)) ||
         url.pathname.includes('/rest/v1/') ||
         url.pathname.includes('/functions/v1/');
}

// Check if request is for an image
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname) ||
         url.pathname.includes('/storage/v1/');
}

// Check if request is for a static asset
function isStaticAsset(url) {
  return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname);
}

// Network First with Cache Fallback (for API requests)
async function networkFirstWithCache(request, cacheName, ttl) {
  const startTime = performance.now();
  
  try {
    performanceMetrics.networkRequests++;
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      
      // Add timestamp header for TTL checking
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const responseWithTime = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, responseWithTime);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    performanceMetrics.cacheMisses++;
    
    const cachedResponse = await getCachedResponse(request, cacheName, ttl);
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Cache First with Network Fallback (for static assets/images)
async function cacheFirstWithNetwork(request, cacheName, ttl) {
  const startTime = performance.now();
  
  const cachedResponse = await getCachedResponse(request, cacheName, ttl);
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
    return cachedResponse;
  }
  
  performanceMetrics.cacheMisses++;
  performanceMetrics.networkRequests++;
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const responseWithTime = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, responseWithTime);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for:', request.url);
    throw error;
  }
}

// Stale While Revalidate (for dynamic content)
async function staleWhileRevalidate(request, cacheName) {
  const startTime = performance.now();
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      responseToCache.blob().then((blob) => {
        const responseWithTime = new Response(blob, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers,
        });
        cache.put(request, responseWithTime);
      });
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
    return cachedResponse;
  }
  
  performanceMetrics.cacheMisses++;
  return fetchPromise;
}

// Get cached response with TTL check
async function getCachedResponse(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const response = await cache.match(request);
  
  if (!response) return null;
  
  const cacheTime = response.headers.get('sw-cache-time');
  if (cacheTime && ttl) {
    const age = Date.now() - parseInt(cacheTime, 10);
    if (age > ttl) {
      // Cache expired, delete and return null
      await cache.delete(request);
      return null;
    }
  }
  
  return response;
}

// Message handler for cache control and metrics
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'GET_METRICS':
      event.ports[0]?.postMessage({
        ...performanceMetrics,
        averageRetrievalTime: performanceMetrics.cacheRetrievalTime.length > 0
          ? performanceMetrics.cacheRetrievalTime.reduce((a, b) => a + b, 0) / performanceMetrics.cacheRetrievalTime.length
          : 0,
        hitRate: performanceMetrics.cacheHits + performanceMetrics.cacheMisses > 0
          ? (performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100
          : 0,
      });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      });
      break;
      
    case 'CLEAR_API_CACHE':
      caches.delete(API_CACHE).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'PRECACHE_URLS':
      if (payload?.urls) {
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.addAll(payload.urls).then(() => {
            event.ports[0]?.postMessage({ success: true });
          });
        });
      }
      break;
      
    case 'RESET_METRICS':
      performanceMetrics.cacheHits = 0;
      performanceMetrics.cacheMisses = 0;
      performanceMetrics.networkRequests = 0;
      performanceMetrics.cacheRetrievalTime = [];
      event.ports[0]?.postMessage({ success: true });
      break;
  }
});
