/**
 * Playwright — UI tests for the NewOSM block editor experience.
 *
 * Logs into wp-admin, opens the block editor, inserts the NewOSM block and
 * verifies it renders without a PHP fatal.
 *
 * Run with: npm run test:e2e -- --project=ui
 */

import { test, expect } from '@playwright/test';
import constants from '../../../constants.json' with { type: 'json' };

// All UI tests share a login session — run serially to avoid concurrent login conflicts.
test.describe.configure({ mode: 'serial' });

const { WP_ENV } = constants;

const ADMIN_URL = `${WP_ENV.BASE_URL}/wp-admin`;

// Shared login helper — reused across tests.
async function wpLogin(page) {
	await page.goto(`${ADMIN_URL}/`);
	await page.fill('#user_login', WP_ENV.ADMIN_USER);
	await page.fill('#user_pass', process.env.WP_ADMIN_PASSWORD ?? WP_ENV.ADMIN_PASSWORD);
	await page.click('#wp-submit');
	await page.waitForURL((url) => url.href.includes('/wp-admin/') && !url.href.includes('wp-login'));
}

test.describe('NewOSM block editor', () => {
	test.beforeEach(async ({ page }) => {
		await wpLogin(page);
	});

	test('new post editor loads without a PHP fatal', async ({ page }) => {
		await page.goto(`${ADMIN_URL}/post-new.php`);
		// A PHP fatal would render "Parse error" or "Fatal error" in the body.
		await expect(page.locator('body')).not.toContainText('Fatal error');
		await expect(page.locator('body')).not.toContainText('Parse error');
	});

	test('NewOSM block can be inserted and renders a map container', async ({ page }) => {
		await page.goto(`${ADMIN_URL}/post-new.php`);

		// Dismiss the welcome guide if present.
		const closeWelcomeGuide = page.getByRole('button', { name: 'Close', exact: true });
		if (await closeWelcomeGuide.isVisible().catch(() => false)) {
			await closeWelcomeGuide.click();
		}

		await page.getByRole('button', { name: 'Toggle block inserter' }).click();
		await page.getByRole('searchbox', { name: 'Search' }).fill('New OpenStreetMap');
		await page.getByRole('option', { name: 'New OpenStreetMap' }).click();

		await expect(page.locator('.wp-block-newopm-osm-map')).toBeVisible();
	});
});
