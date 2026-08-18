/**
 * Vitest test setup file
 * Runs before each test file
 */
import { vi } from 'vitest';

// Mock WordPress i18n functions
global.wp = {
	i18n: {
		__: (text) => text,
		_x: (text) => text,
		_n: (single, plural, number) => (number === 1 ? single : plural),
		sprintf: (format, ...args) => {
			let index = 0;
			return format.replace(/%s/g, () => args[index++]);
		},
	},
};

// Make __ available globally for tests
global.__ = global.wp.i18n.__;

// Mock console methods to reduce test output noise
global.console = {
	...console,
	error: vi.fn(),
	warn: vi.fn(),
	log: vi.fn(),
};

// Add custom matchers if needed
expect.extend({
	// Custom matcher example
	toBeValidCoordinate(received, min, max) {
		const pass = typeof received === 'number' && received >= min && received <= max;
		return {
			pass,
			message: () =>
				pass
					? `expected ${received} not to be a valid coordinate between ${min} and ${max}`
					: `expected ${received} to be a valid coordinate between ${min} and ${max}`,
		};
	},
});
