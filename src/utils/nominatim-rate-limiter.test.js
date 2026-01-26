/**
 * Tests for NominatimRateLimiter
 */
import { NominatimRateLimiter } from './nominatim-rate-limiter';

// Mock fetch globally
global.fetch = jest.fn();

describe('NominatimRateLimiter', () => {
	let rateLimiter;

	beforeEach(() => {
		rateLimiter = new NominatimRateLimiter();
		fetch.mockClear();
		jest.clearAllTimers();
	});

	describe('caching', () => {
		test('returns cached response for duplicate requests', async () => {
			const mockData = { display_name: 'Test Location' };
			fetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockData,
			});

			const url = 'https://nominatim.openstreetmap.org/search?q=test';

			// First request
			const result1 = await rateLimiter.request(url);
			expect(result1).toEqual(mockData);
			expect(fetch).toHaveBeenCalledTimes(1);

			// Second request (should use cache)
			const result2 = await rateLimiter.request(url);
			expect(result2).toEqual(mockData);
			expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
		});

		test('cache expires after 5 minutes', async () => {
			const mockData = { display_name: 'Test Location' };
			fetch.mockResolvedValue({
				ok: true,
				json: async () => mockData,
			});

			const url = 'https://nominatim.openstreetmap.org/search?q=test';

			// First request
			await rateLimiter.request(url);
			expect(fetch).toHaveBeenCalledTimes(1);

			// Fast-forward 6 minutes
			const originalDateNow = Date.now;
			Date.now = jest.fn(() => originalDateNow() + 6 * 60 * 1000);

			// Second request (cache should be expired)
			await rateLimiter.request(url);
			expect(fetch).toHaveBeenCalledTimes(2);

			// Restore Date.now
			Date.now = originalDateNow;
		});

		test('clearCache removes all cached entries', async () => {
			const mockData = { display_name: 'Test Location' };
			fetch.mockResolvedValue({
				ok: true,
				json: async () => mockData,
			});

			const url = 'https://nominatim.openstreetmap.org/search?q=test';

			// Cache a request
			await rateLimiter.request(url);
			expect(rateLimiter.getCacheSize()).toBe(1);

			// Clear cache
			rateLimiter.clearCache();
			expect(rateLimiter.getCacheSize()).toBe(0);

			// Next request should fetch again
			await rateLimiter.request(url);
			expect(fetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('rate limiting', () => {
		test('enforces minimum 1 second between requests', async () => {
			jest.useFakeTimers();

			const mockData = { display_name: 'Test Location' };
			fetch.mockResolvedValue({
				ok: true,
				json: async () => mockData,
			});

			const url1 = 'https://nominatim.openstreetmap.org/search?q=test1';
			const url2 = 'https://nominatim.openstreetmap.org/search?q=test2';

			// Start first request
			const promise1 = rateLimiter.request(url1);
			jest.runAllTimers();
			await promise1;

			const timeBeforeSecondRequest = Date.now();

			// Start second request immediately
			const promise2 = rateLimiter.request(url2);
			jest.runAllTimers();
			await promise2;

			const timeAfterSecondRequest = Date.now();

			// Should have waited at least 1 second
			expect(timeAfterSecondRequest - timeBeforeSecondRequest).toBeGreaterThanOrEqual(1000);

			jest.useRealTimers();
		});
	});

	describe('request deduplication', () => {
		test('deduplicates concurrent requests to same URL', async () => {
			const mockData = { display_name: 'Test Location' };
			fetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockData,
			});

			const url = 'https://nominatim.openstreetmap.org/search?q=test';

			// Make multiple concurrent requests
			const results = await Promise.all([
				rateLimiter.request(url),
				rateLimiter.request(url),
				rateLimiter.request(url),
			]);

			// Should only make one fetch call
			expect(fetch).toHaveBeenCalledTimes(1);

			// All results should be the same
			expect(results[0]).toEqual(mockData);
			expect(results[1]).toEqual(mockData);
			expect(results[2]).toEqual(mockData);
		});
	});

	describe('error handling', () => {
		test('throws error for HTTP errors', async () => {
			fetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			const url = 'https://nominatim.openstreetmap.org/search?q=test';

			await expect(rateLimiter.request(url)).rejects.toThrow('HTTP 404: Not Found');
		});

		test('does not cache failed requests', async () => {
			fetch
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: 'Server Error',
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ display_name: 'Success' }),
				});

			const url = 'https://nominatim.openstreetmap.org/search?q=test';

			// First request fails
			await expect(rateLimiter.request(url)).rejects.toThrow();

			// Second request should try again (not use cached error)
			const result = await rateLimiter.request(url);
			expect(result).toEqual({ display_name: 'Success' });
		});
	});

	describe('getCacheSize', () => {
		test('returns correct cache size', async () => {
			const mockData = { display_name: 'Test Location' };
			fetch.mockResolvedValue({
				ok: true,
				json: async () => mockData,
			});

			expect(rateLimiter.getCacheSize()).toBe(0);

			await rateLimiter.request('https://nominatim.openstreetmap.org/search?q=test1');
			expect(rateLimiter.getCacheSize()).toBe(1);

			await rateLimiter.request('https://nominatim.openstreetmap.org/search?q=test2');
			expect(rateLimiter.getCacheSize()).toBe(2);
		});
	});
});
