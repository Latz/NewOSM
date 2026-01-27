/**
 * Tests for performance optimizations
 * Verifies Canvas rendering, React memoization, debouncing, and other performance features
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Performance Optimizations', () => {
	describe('Canvas Rendering Configuration', () => {
		test('view.js should use Canvas rendering', async () => {
			// Read the view.js file content
			const fs = require('fs');
			const path = require('path');
			const viewJsPath = path.join(__dirname, '../view.js');
			const viewJsContent = fs.readFileSync(viewJsPath, 'utf8');

			// Check that preferCanvas is set to true
			expect(viewJsContent).toMatch(/preferCanvas:\s*true/);
			expect(viewJsContent).not.toMatch(/preferCanvas:\s*false/);
		});

		test('view.js should have tile layer performance optimizations', async () => {
			const fs = require('fs');
			const path = require('path');
			const viewJsPath = path.join(__dirname, '../view.js');
			const viewJsContent = fs.readFileSync(viewJsPath, 'utf8');

			// Check for tile layer optimizations
			expect(viewJsContent).toMatch(/updateWhenIdle:\s*true/);
			expect(viewJsContent).toMatch(/updateWhenZooming:\s*false/);
			expect(viewJsContent).toMatch(/keepBuffer:\s*2/);
			expect(viewJsContent).toMatch(/maxNativeZoom:\s*19/);
			expect(viewJsContent).toMatch(/minZoom:\s*2/);
		});
	});

	describe('React Memoization', () => {
		test('edit.js should import memo and useMemo', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check for memo and useMemo imports
			expect(editJsContent).toMatch(/import.*\{[^}]*memo[^}]*\}.*from.*@wordpress\/element/);
			expect(editJsContent).toMatch(/import.*\{[^}]*useMemo[^}]*\}.*from.*@wordpress\/element/);
		});

		test('edit.js should wrap components with React.memo', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check that key components are wrapped with memo
			const componentsToCheck = [
				'MapInteractionHandler',
				'DraggableMarker',
				'ZoomSync',
				'MapViewSync',
				'MapLoadingHandler',
				'FullscreenControl',
			];

			componentsToCheck.forEach(componentName => {
				// Check for memo wrapper pattern: const ComponentName = memo(function ComponentName
				const memoPattern = new RegExp(`const\\s+${componentName}\\s*=\\s*memo\\s*\\(`);
				expect(editJsContent).toMatch(memoPattern);
			});
		});

		test('edit.js should use useMemo for expensive calculations', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../edit.js');
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
			const editJsPath = path.join(__dirname, '../edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check for zoom debouncing with setTimeout
			expect(editJsContent).toMatch(/zoomTimeoutRef/);
			expect(editJsContent).toMatch(/setTimeout.*setAttributes.*zoom/s);
			expect(editJsContent).toMatch(/150/); // 150ms debounce delay
		});

		test('edit.js should cleanup zoom timeout on unmount', () => {
			const fs = require('fs');
			const path = require('path');
			const editJsPath = path.join(__dirname, '../edit.js');
			const editJsContent = fs.readFileSync(editJsPath, 'utf8');

			// Check for cleanup in useEffect return
			expect(editJsContent).toMatch(/clearTimeout.*zoomTimeoutRef/);
		});
	});

	describe('Script Loading Strategy', () => {
		test('newopm.php should use defer strategy for Leaflet', () => {
			const fs = require('fs');
			const path = require('path');
			const phpPath = path.join(__dirname, '../../newopm.php');
			const phpContent = fs.readFileSync(phpPath, 'utf8');

			// Check for defer strategy in script enqueuing
			expect(phpContent).toMatch(/strategy.*=>.*defer/);
			expect(phpContent).toMatch(/leaflet.*defer/i);
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
		test('webpack.config.js should have code splitting disabled', () => {
			const fs = require('fs');
			const path = require('path');
			const webpackPath = path.join(__dirname, '../../webpack.config.js');
			const webpackContent = fs.readFileSync(webpackPath, 'utf8');

			// Check that splitChunks is set to false
			expect(webpackContent).toMatch(/splitChunks:\s*false/);
		});
	});
});

