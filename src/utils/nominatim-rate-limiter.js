/**
 * Rate limiter for Nominatim API requests
 * Implements 1-second rate limiting and 5-minute caching per Nominatim usage policy
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export class NominatimRateLimiter {
	constructor() {
		this.lastRequestTime = 0;
		this.minInterval = 1000; // 1 second between requests
		this.cache = new Map();
		this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
		this.pendingRequests = new Map(); // For request deduplication
	}

	/**
	 * Get cached response if available and not expired
	 * @param {string} url - Request URL
	 * @returns {Object|null} Cached response or null
	 */
	getCached(url) {
		const cached = this.cache.get(url);
		if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
			return cached.data;
		}
		if (cached) {
			this.cache.delete(url);
		}
		return null;
	}

	/**
	 * Store response in cache
	 * @param {string} url - Request URL
	 * @param {Object} data - Response data
	 */
	setCached(url, data) {
		this.cache.set(url, {
			data,
			timestamp: Date.now(),
		});
	}

	/**
	 * Make rate-limited request to Nominatim API
	 * @param {string} url - Request URL
	 * @returns {Promise<Object>} Response data
	 */
	async request(url) {
		// Check cache first
		const cached = this.getCached(url);
		if (cached) {
			return cached;
		}

		// Check if there's already a pending request for this URL
		if (this.pendingRequests.has(url)) {
			return this.pendingRequests.get(url);
		}

		// Calculate wait time to enforce rate limit
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;
		const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest);

		// Create promise for this request
		const requestPromise = (async () => {
			// Wait if necessary
			if (waitTime > 0) {
				await new Promise(resolve => setTimeout(resolve, waitTime));
			}

			// Update last request time
			this.lastRequestTime = Date.now();

			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();

				// Cache the response
				this.setCached(url, data);

				return data;
			} finally {
				// Remove from pending requests
				this.pendingRequests.delete(url);
			}
		})();

		// Store pending request
		this.pendingRequests.set(url, requestPromise);

		return requestPromise;
	}

	/**
	 * Clear all cached data
	 */
	clearCache() {
		this.cache.clear();
	}

	/**
	 * Get cache size
	 * @returns {number} Number of cached entries
	 */
	getCacheSize() {
		return this.cache.size;
	}
}
