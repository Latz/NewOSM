/**
 * Playwright — REST API tests for the NewOSM plugin's /defaults endpoint.
 *
 * Prerequisites:
 *   npm run env:start          (first time: pulls Docker images, ~2 min)
 *   npm run test:e2e:api
 *
 * The wp-env container runs at http://localhost:8888.
 * Authorization header is set globally in playwright.config.mjs.
 */

import { test, expect } from '@playwright/test';
import constants from '../../../constants.json' with { type: 'json' };

const { REST_NAMESPACE, ROUTES } = constants;

const api = (route) => `/?rest_route=/${REST_NAMESPACE}${route}`;

// ---------------------------------------------------------------------------
// GET /defaults
// ---------------------------------------------------------------------------
test.describe('GET /defaults', () => {
	test('returns 200 with the current map defaults', async ({ request }) => {
		const res = await request.get(api(ROUTES.DEFAULTS));
		expect(res.status()).toBe(200);

		const body = await res.json();
		expect(body).toHaveProperty('sizePreset');
		expect(body).toHaveProperty('height');
		expect(body).toHaveProperty('zoom');
		expect(body).toHaveProperty('latitude');
		expect(body).toHaveProperty('longitude');
	});
});

// ---------------------------------------------------------------------------
// POST /defaults
// ---------------------------------------------------------------------------
test.describe('POST /defaults', () => {
	test('saves valid defaults and they are reflected by a subsequent GET', async ({ request }) => {
		const payload = {
			sizePreset: 'medium',
			height: 420,
			width: '100%',
			zoom: 12,
			latitude: 52.52,
			longitude: 13.405,
		};

		const postRes = await request.post(api(ROUTES.DEFAULTS), { data: payload });
		expect(postRes.status()).toBe(200);

		const getRes = await request.get(api(ROUTES.DEFAULTS));
		const body = await getRes.json();

		expect(body.sizePreset).toBe(payload.sizePreset);
		expect(body.height).toBe(payload.height);
		expect(body.zoom).toBe(payload.zoom);
		expect(body.latitude).toBeCloseTo(payload.latitude, 5);
		expect(body.longitude).toBeCloseTo(payload.longitude, 5);
	});

	test('saves a marker at the equator/prime meridian as 0, not null', async ({ request }) => {
		// Regression test: newopm_rest_get_defaults() used a truthy check
		// ($marker_lat ? (float) $marker_lat : null) that discarded a real 0.
		const payload = {
			sizePreset: 'medium',
			height: 420,
			width: '100%',
			zoom: 12,
			latitude: 0,
			longitude: 0,
			markerLat: 0,
			markerLon: 0,
		};

		const postRes = await request.post(api(ROUTES.DEFAULTS), { data: payload });
		expect(postRes.status()).toBe(200);

		const getRes = await request.get(api(ROUTES.DEFAULTS));
		const body = await getRes.json();

		expect(body.markerLat).toBe(0);
		expect(body.markerLon).toBe(0);
	});

	test('saving the exact same values twice in a row still succeeds', async ({ request }) => {
		// Regression test: get_option() always returns stored scalars as strings, so
		// update_option()'s false ("value unchanged") was previously misread as a real
		// failure by a strict !== comparison against the typed REST param - meaning
		// re-saving unchanged defaults (the common case) intermittently 500'd.
		const payload = {
			sizePreset: 'medium',
			height: 420,
			width: '100%',
			zoom: 12,
			latitude: 0,
			longitude: 0,
		};

		await request.post(api(ROUTES.DEFAULTS), { data: payload });
		const secondRes = await request.post(api(ROUTES.DEFAULTS), { data: payload });

		expect(secondRes.status()).toBe(200);
	});

	test('rejects an out-of-range zoom value', async ({ request }) => {
		const res = await request.post(api(ROUTES.DEFAULTS), {
			data: {
				sizePreset: 'medium',
				height: 420,
				width: '100%',
				zoom: 99,
				latitude: 0,
				longitude: 0,
			},
		});

		expect(res.status()).toBe(400);
	});
});
