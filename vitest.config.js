import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			// @wordpress/element bundles its own (older) React copy internally.
			// @testing-library/react's renderHook/render use the top-level `react`
			// package's dispatcher — two different React instances can't share
			// hook state, which throws "Invalid hook call". Aliasing forces
			// `@wordpress/element` imports to resolve to the same top-level React
			// used by testing-library, matching lynxjournal's vitest setup.
			'@wordpress/element': 'react',
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['tests/js/**/*.test.js'],
		setupFiles: ['tests/js/setup.js'],
		coverage: {
			provider: 'v8',
			reportsDirectory: 'bin/reports/coverage-js',
			reporter: ['text', 'lcov'],
			include: ['src/utils/**'],
			// Complex React components — tested manually / via E2E, not unit coverage.
			exclude: ['src/edit.js', 'src/save.js', 'src/view.js', 'src/index.js', '**/*.test.js'],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
	},
});
