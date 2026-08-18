/**
 * Playwright — regression test for the /newopm/v1/sw REST route.
 *
 * A service worker can only claim a scope at or below its own script's directory
 * unless the response carries a Service-Worker-Allowed header. build/service-worker.js
 * served as a static file can never carry that header, so registerServiceWorker()
 * asking for scope '/' would be rejected by the browser - and a standalone .php file
 * placed directly in the plugin directory to add that header is itself blocked by
 * the common "deny direct PHP execution in plugin/upload directories" hardening
 * pattern (this repo's own untracked .htaccess enforces exactly that). Routing
 * through the REST API sidesteps both problems: it's served via the site's own
 * index.php like any other endpoint. This test proves the header is actually
 * present and the content served is the real service worker, not just that the
 * endpoint responds.
 *
 * Prerequisites:
 *   npm run env:start          (first time: pulls Docker images, ~2 min)
 *   npm run test:e2e:api
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import constants from '../../../constants.json' with { type: 'json' };

const { REST_NAMESPACE } = constants;

const SW_URL = `/?rest_route=/${REST_NAMESPACE}/sw`;
// Playwright config's testDir/rootDir is the plugin root, so tests run with that as cwd.
const SERVICE_WORKER_SOURCE = readFileSync(path.join(process.cwd(), 'build/service-worker.js'), 'utf-8');

test.describe('GET /sw', () => {
	test('serves the service worker with a sitewide Service-Worker-Allowed scope', async ({ request }) => {
		const res = await request.get(SW_URL);

		expect(res.status()).toBe(200);
		expect(res.headers()['service-worker-allowed']).toBe('/');
		expect(res.headers()['content-type']).toContain('javascript');

		const body = await res.text();
		expect(body).toBe(SERVICE_WORKER_SOURCE);
	});
});
