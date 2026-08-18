import { defineConfig } from 'vitest/config';

export default defineConfig({
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
