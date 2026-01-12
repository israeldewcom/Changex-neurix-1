// Service Worker for Changex Neurix PWA
const CACHE_NAME = 'changex-neurix-v2.0.0';
const API_CACHE = 'changex-api-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon/favicon.ico',
  '/assets/fonts/Inter.woff2',
  '/assets/fonts/SpaceGrotesk.woff2',
  '/assets/logos/logo.png',
  '/assets/images/placeholder-600x400.png'
];

// Install event - precache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Pre-caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== API_CACHE) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - cache first, then network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests that need fresh data
  if (event.request.url.includes('/api/')) {
    // Network-first for API calls
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses
          if (response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(event.request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For static assets: Cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Update cache in background
          fetchAndCache(event.request);
          return cachedResponse;
        }
        
        // Network fallback
        return fetchAndCache(event.request);
      })
      .catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        
        // Return offline page or placeholder
        if (event.request.destination === 'image') {
          return caches.match('/assets/images/placeholder-600x400.png');
        }
        
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// Helper function to fetch and cache
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    
    // Check if we received a valid response
    if (!response || response.status !== 200 || response.type !== 'basic') {
      return response;
    }
    
    // Clone the response to cache it
    const responseToCache = response.clone();
    
    caches.open(CACHE_NAME)
      .then(cache => {
        cache.put(request, responseToCache);
      });
    
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

// Background sync for failed requests
self.addEventListener('sync', event => {
  if (event.tag === 'sync-images') {
    event.waitUntil(syncImages());
  }
});

async function syncImages() {
  // Implement background sync logic here
  console.log('Background sync: Syncing images');
}

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from Changex Neurix',
    icon: '/favicon/android-chrome-192x192.png',
    badge: '/favicon/favicon-16x16.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Changex Neurix', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateContentCache());
  }
});

async function updateContentCache() {
  // Update cached content periodically
  console.log('Periodic sync: Updating content cache');
}
