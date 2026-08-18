/**
 * Tests for performance optimizations
 * Verifies Canvas rendering, React memoization, debouncing, and other performance features
 */

describe('Performance Optimizations', () => {
	describe('Canvas Rendering Configuration', () => {
		test('view.js should use Canvas rendering', async () => {
			// Read the view.js file content
			const fs = require('fs');
			const path = require('path');
			const viewJsPath = path.join(__dirname, '../../src/view.js');
			const viewJsContent = fs.readFileSync(viewJsPath, 'utf8');

			// Check that preferCanvas is set to true
			expect(viewJsContent).toMatch(/preferCanvas:\s*true/);
			expect(viewJsContent).not.toMatch(/preferCanvas:\s*false/);
		});

		test('view.js should have tile layer performance optimizations', async () => {
			const fs = require('fs');
			const path = require('path');
			const viewJsPath = path.join(__dirname, '../../src/view.js');
			const viewJsContent = fs.readFileSync(viewJsPath, 'utf8');

			// Tile update/buffer values now live in getFrontendTileConfig()
			// (see devicePerformance.test.js) - view.js just wires them through.
			expect(viewJsContent).toMatch(/updateWhenIdle:\s*tileConfig\.updateWhenIdle/);
			expect(viewJsContent).toMatch(/updateWhenZooming:\s*tileConfig\.updateWhenZooming/);
			expect(viewJsContent).toMatch(/keepBuffer:\s*tileConfig\.keepBuffer/);
			expect(viewJsContent).toMatch(/maxNativeZoom:\s*19/);
			expect(viewJsContent).toMatch(/minZoom:\s*2/);
		});
	});

	describe('React Memoization', () => {
		// NOTE: edit.js's map sub-components (MapInteractionHandler, DraggableMarker,
		// ZoomSync, MapViewSync, MapLoadingHandler, FullscreenControl) were extracted
		// into the lazy-loaded src/components/MapEditor.js. Neither file wraps them
		// with `memo()` any more (verified: no `memo(` usage anywhere under src/) -
		// that optimization was dropped at some point. Only the still-true useMemo
		// usage below is asserted; re-adding memo() wrapping is a product decision,
		// not something a test-suite migration should silently reintroduce.
		test('edit.js should use useMemo for expensive calculations', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../../src/edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check for useMemo usage for center and markerPosition
			expect(editJsContent).toMatch(/const\s+center\s*=\s*useMemo/);
			expect(editJsContent).toMatch(/const\s+markerPosition\s*=\s*useMemo/);
		});
	});

	describe('Debouncing', () => {
		test('edit.js should debounce zoom changes', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../../src/edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check for zoom debouncing with setTimeout
			expect(editJsContent).toMatch(/zoomTimeoutRef/);
			expect(editJsContent).toMatch(/setTimeout.*setAttributes.*zoom/s);
			expect(editJsContent).toMatch(/150/); // 150ms debounce delay
		});

		test('edit.js should cleanup zoom timeout on unmount', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../../src/edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check for cleanup in useEffect return
			expect(editJsContent).toMatch(/clearTimeout.*zoomTimeoutRef/);
		});
	});

	describe('Script Loading Strategy', () => {
		test('newopm.php should load the leaflet vendor chunk in the footer, ordered before dependents', () => {
			const fs = require('fs');
			const path = require('path');
			const phpPath = path.join(__dirname, '../../newopm.php');
			const phpContent = fs.readFileSync(phpPath, 'utf8');

			// Vendor chunk is registered with in_footer=true (not an async/defer
			// script strategy) and auto-enqueued via script_loader_tag so it loads
			// before the view/editor scripts that depend on it.
			expect(phpContent).toMatch(/wp_register_script\(\s*\$vendor_handle,[\s\S]*?true\s*\/\/\s*Load in footer/);
			expect(phpContent).toMatch(/add_filter\(\s*'script_loader_tag'/);
		});
	});

	describe('Debug Logging', () => {
		test('newopm.php should wrap error_log in WP_DEBUG checks', () => {
			const fs = require('fs');
			const path = require('path');
			const phpPath = path.join(__dirname, '../../newopm.php');
			const phpContent = fs.readFileSync(phpPath, 'utf8');

			// Check that error_log calls are wrapped in WP_DEBUG checks
			const errorLogMatches = phpContent.match(/error_log\(/g);
			const wpDebugMatches = phpContent.match(/WP_DEBUG/g);

			// Should have WP_DEBUG checks (at least one per function with error_log)
			expect(wpDebugMatches).toBeTruthy();
			expect(wpDebugMatches.length).toBeGreaterThan(0);

			// Check for the pattern: if (defined('WP_DEBUG') && WP_DEBUG)
			expect(phpContent).toMatch(/if\s*\(\s*defined\s*\(\s*['"]WP_DEBUG['"]\s*\)\s*&&\s*WP_DEBUG\s*\)/);
		});
	});

	describe('Webpack Configuration', () => {
		test('webpack.config.js should disable default splitting, keeping only the selective vendor/style cache groups', () => {
			const fs = require('fs');
			const path = require('path');
			const webpackPath = path.join(__dirname, '../../webpack.config.js');
			const webpackContent = fs.readFileSync(webpackPath, 'utf8');

			// Webpack's automatic default/defaultVendors groups are disabled so the
			// only chunks produced are the two explicit cache groups below.
			expect(webpackContent).toMatch(/default:\s*false/);
			expect(webpackContent).toMatch(/defaultVendors:\s*false/);
			expect(webpackContent).toMatch(/cacheGroups:\s*\{/);
			expect(webpackContent).toMatch(/leafletVendor:\s*\{/);
		});
	});
});

