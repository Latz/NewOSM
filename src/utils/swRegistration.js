/**
 * Service Worker Registration Helper for NewOSM
 *
 * Handles registration, feature detection, HTTPS checks, and cache management
 * for the Service Worker tile caching system.
 */

/**
 * Register the Service Worker for tile caching
 *
 * Features:
 * - Feature detection (exits gracefully if not supported)
 * - HTTPS enforcement (with localhost exception for development)
 * - Error handling and logging
 * - Update event handling for development workflow
 *
 * @param {string} swPath - Path to service-worker.js file
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker(swPath) {
	// Check if Service Workers are supported
	if (!('serviceWorker' in navigator)) {
		console.log('[NewOSM] Service Worker not supported in this browser');
		return null;
	}

	// Check HTTPS requirement (localhost is allowed for development)
	if (!isHttpsOrLocalhost()) {
		console.warn('[NewOSM] Service Worker registration skipped: HTTPS required (HTTP detected)');
		return null;
	}

	try {
		console.log(`[NewOSM] Registering Service Worker from: ${swPath}`);

		const registration = await navigator.serviceWorker.register(swPath, {
			scope: '/',
		});

		console.log('[NewOSM] Service Worker registered successfully', registration);

		// Handle updates (for development with "Update on reload")
		registration.addEventListener('updatefound', () => {
			const newWorker = registration.installing;

			newWorker.addEventListener('statechange', () => {
				if (newWorker.state === 'activated') {
					console.log('[NewOSM] Service Worker updated and activated');
				}
			});
		});

		return registration;
	} catch (error) {
		console.error('[NewOSM] Service Worker registration failed:', error);
		return null;
	}
}

/**
 * Check if current page is HTTPS or localhost
 * @returns {boolean} True if HTTPS or localhost, false otherwise
 */
function isHttpsOrLocalhost() {
	const { protocol, hostname } = window.location;
	return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Clear all cached tiles
 *
 * Sends a CLEAR_CACHE message to the Service Worker and deletes the cache.
 * Can be called from console: `clearTileCache()`
 *
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function clearTileCache() {
	if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
		console.warn('[NewOSM] Cannot clear cache: Service Worker not active');
		return false;
	}

	try {
		console.log('[NewOSM] Clearing tile cache...');

		// Create a message channel for response
		const channel = new MessageChannel();

		// Send message to Service Worker
		navigator.serviceWorker.controller.postMessage(
			{ type: 'CLEAR_CACHE' },
			[channel.port2]
		);

		// Wait for response
		return new Promise((resolve) => {
			channel.port1.onmessage = (event) => {
				if (event.data.success) {
					console.log('[NewOSM] Tile cache cleared successfully');
					resolve(true);
				} else {
					console.error('[NewOSM] Failed to clear tile cache');
					resolve(false);
				}
			};

			// Timeout after 5 seconds
			setTimeout(() => {
				console.warn('[NewOSM] Cache clear operation timed out');
				resolve(false);
			}, 5000);
		});
	} catch (error) {
		console.error('[NewOSM] Error clearing cache:', error);
		return false;
	}
}

/**
 * Get current cache statistics
 *
 * Returns information about cached tiles including:
 * - Number of tiles cached
 * - Total cache size in bytes
 * - Percentage of cache used
 *
 * Can be called from console: `getCacheInfo().then(info => console.log(info))`
 *
 * @returns {Promise<{tileCount: number, totalSize: number, percentUsed: string}|null>}
 */
export async function getCacheInfo() {
	if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
		console.warn('[NewOSM] Cannot get cache info: Service Worker not active');
		return null;
	}

	try {
		console.log('[NewOSM] Getting cache info...');

		// Create a message channel for response
		const channel = new MessageChannel();

		// Send message to Service Worker
		navigator.serviceWorker.controller.postMessage(
			{ type: 'GET_CACHE_INFO' },
			[channel.port2]
		);

		// Wait for response
		return new Promise((resolve) => {
			channel.port1.onmessage = (event) => {
				const info = {
					tileCount: event.data.tileCount,
					totalSize: event.data.totalSize,
					percentUsed: event.data.percentUsed,
					formattedSize: formatBytes(event.data.totalSize),
				};
				console.log('[NewOSM] Cache info:', info);
				resolve(info);
			};

			// Timeout after 5 seconds
			setTimeout(() => {
				console.warn('[NewOSM] Cache info request timed out');
				resolve(null);
			}, 5000);
		});
	} catch (error) {
		console.error('[NewOSM] Error getting cache info:', error);
		return null;
	}
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
 * Expose cache management functions globally for console access
 * Allows developers to call: window.NewOPM.clearTileCache(), window.NewOPM.getCacheInfo()
 */
if (typeof window !== 'undefined') {
	window.NewOPM = window.NewOPM || {};
	window.NewOPM.clearTileCache = clearTileCache;
	window.NewOPM.getCacheInfo = getCacheInfo;
}
