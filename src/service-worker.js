/**
 * Service Worker for NewOSM Tile Caching
 *
 * This Service Worker implements a cache-first strategy for OpenStreetMap tiles,
 * providing instant tile loading, offline map support, and persistent cache across sessions.
 *
 * Features:
 * - Cache-first strategy: Check cache → return immediately if found → fetch & cache if not
 * - LRU (Least Recently Used) eviction when cache exceeds 50MB limit
 * - Message handlers for cache management (clear, info)
 * - Comprehensive logging with [NewOSM SW] prefix
 * - Safe URL pattern matching (only intercepts OSM tiles)
 */

const CACHE_NAME = 'newopm-tiles-v1';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const TILE_PATTERN = /^https:\/\/[abc]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

/**
 * Install event: Skip waiting for immediate activation
 * Ensures new Service Worker activates immediately without waiting for clients to unload
 */
self.addEventListener('install', (event) => {
	console.log('[NewOSM SW] Install event triggered');
	self.skipWaiting();
});

/**
 * Activate event: Delete old cache versions and claim all clients
 * Cleans up any old cache versions and takes control of all clients immediately
 */
self.addEventListener('activate', (event) => {
	console.log('[NewOSM SW] Activate event triggered');

	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					// Delete all caches that don't match the current version
					if (cacheName !== CACHE_NAME) {
						console.log(`[NewOSM SW] Deleting old cache: ${cacheName}`);
						return caches.delete(cacheName);
					}
				})
			);
		}).then(() => {
			// Claim all clients to take control immediately
			console.log('[NewOSM SW] Claiming all clients');
			return self.clients.claim();
		})
	);
});

/**
 * Fetch event: Cache-first strategy for OSM tiles
 *
 * Flow:
 * 1. Check if request is an OSM tile URL
 * 2. If not, pass through to network
 * 3. If yes, check cache first
 * 4. If in cache, return immediately
 * 5. If not, fetch from network
 * 6. Cache the response and return it
 * 7. Enforce cache size limit with LRU eviction
 */
self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle GET requests for OSM tiles
	if (request.method !== 'GET' || !TILE_PATTERN.test(request.url)) {
		// Pass through non-tile requests to network
		return;
	}

	// Cache-first strategy for tiles
	event.respondWith(
		caches.open(CACHE_NAME).then((cache) => {
			// Check cache first
			return cache.match(request).then((response) => {
				if (response) {
					console.log(`[NewOSM SW] Cache hit: ${request.url}`);
					return response;
				}

				// Not in cache, fetch from network
				console.log(`[NewOSM SW] Cache miss, fetching from network: ${request.url}`);
				return fetch(request).then((networkResponse) => {
					// Only cache successful responses
					if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
						console.log(`[NewOSM SW] Not caching (HTTP ${networkResponse.status}): ${request.url}`);
						return networkResponse;
					}

					// Clone response for caching (response body can only be read once)
					const responseToCache = networkResponse.clone();

					// Cache the response
					cache.put(request, responseToCache).catch((err) => {
						console.error(`[NewOSM SW] Error caching tile: ${err.message}`);
					});

					// Enforce cache size limit asynchronously
					enforceCacheSizeLimit().catch((err) => {
						console.error(`[NewOSM SW] Error enforcing cache size limit: ${err.message}`);
					});

					return networkResponse;
				}).catch((error) => {
					console.error(`[NewOSM SW] Network fetch error: ${error.message}`);
					// Return offline response could be added here in future
					throw error;
				});
			});
		})
	);
});

/**
 * Enforce cache size limit with LRU (Least Recently Used) eviction
 *
 * Algorithm:
 * 1. Get all cache entries
 * 2. Calculate total cache size
 * 3. If over limit, sort entries by timestamp (oldest first)
 * 4. Delete oldest entries until cache is at 80% capacity (40MB)
 * 5. This prevents thrashing (immediately re-evicting)
 */
async function enforceCacheSizeLimit() {
	const cache = await caches.open(CACHE_NAME);
	const requests = await cache.keys();

	if (requests.length === 0) {
		return;
	}

	// Get cache size
	const entries = await Promise.all(
		requests.map(async (request) => {
			const response = await cache.match(request);
			const blob = await response.blob();
			return {
				request,
				size: blob.size,
				timestamp: new Date(response.headers.get('date')).getTime() || Date.now(),
			};
		})
	);

	const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

	if (totalSize <= MAX_CACHE_SIZE) {
		console.log(`[NewOSM SW] Cache size OK: ${formatBytes(totalSize)} / ${formatBytes(MAX_CACHE_SIZE)}`);
		return;
	}

	console.log(`[NewOSM SW] Cache size exceeded: ${formatBytes(totalSize)} / ${formatBytes(MAX_CACHE_SIZE)}`);

	// Sort by timestamp (oldest first) for LRU eviction
	entries.sort((a, b) => a.timestamp - b.timestamp);

	// Delete oldest entries until cache is at 80% capacity
	const targetSize = MAX_CACHE_SIZE * 0.8; // 40MB for 50MB limit
	let currentSize = totalSize;
	let deletedCount = 0;

	for (const entry of entries) {
		if (currentSize <= targetSize) {
			break;
		}

		await cache.delete(entry.request);
		currentSize -= entry.size;
		deletedCount++;
		console.log(`[NewOSM SW] Evicted (LRU): ${entry.request.url}`);
	}

	console.log(`[NewOSM SW] LRU eviction complete: deleted ${deletedCount} tiles, new size: ${formatBytes(currentSize)}`);
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "2.5 MB")
 */
function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get current cache statistics
 * @returns {Promise<{tileCount: number, totalSize: number, percentUsed: string}>}
 */
async function getCacheInfo() {
	const cache = await caches.open(CACHE_NAME);
	const requests = await cache.keys();

	if (requests.length === 0) {
		return {
			tileCount: 0,
			totalSize: 0,
			percentUsed: '0.0%',
		};
	}

	const entries = await Promise.all(
		requests.map(async (request) => {
			const response = await cache.match(request);
			const blob = await response.blob();
			return blob.size;
		})
	);

	const totalSize = entries.reduce((sum, size) => sum + size, 0);
	const percentUsed = ((totalSize / MAX_CACHE_SIZE) * 100).toFixed(1);

	return {
		tileCount: requests.length,
		totalSize,
		percentUsed: `${percentUsed}%`,
	};
}

/**
 * Message event: Handle messages from main thread
 *
 * Messages:
 * - CLEAR_CACHE: Delete all cached tiles
 * - GET_CACHE_INFO: Get cache statistics
 */
self.addEventListener('message', (event) => {
	const { type } = event.data;

	if (type === 'CLEAR_CACHE') {
		console.log('[NewOSM SW] Received CLEAR_CACHE message');
		event.waitUntil(
			caches.delete(CACHE_NAME).then(() => {
				console.log('[NewOSM SW] Cache cleared');
				// Reply to sender with confirmation
				if (event.ports && event.ports[0]) {
					event.ports[0].postMessage({ success: true });
				}
			})
		);
	} else if (type === 'GET_CACHE_INFO') {
		console.log('[NewOSM SW] Received GET_CACHE_INFO message');
		event.waitUntil(
			getCacheInfo().then((info) => {
				console.log(`[NewOSM SW] Cache info: ${info.tileCount} tiles, ${formatBytes(info.totalSize)}`);
				// Reply to sender with cache info
				if (event.ports && event.ports[0]) {
					event.ports[0].postMessage(info);
				}
			})
		);
	} else {
		console.log(`[NewOSM SW] Received unknown message type: ${type}`);
	}
});
