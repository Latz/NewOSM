/**
 * Jest configuration for NewOSM plugin tests
 * Extends @wordpress/scripts default Jest configuration
 */

const defaultConfig = require('@wordpress/scripts/config/jest-unit.config.js');

module.exports = {
	...defaultConfig,
	// Test environment
	testEnvironment: 'jsdom',

	// Setup files
	setupFilesAfterEnv: [
		'<rootDir>/tests/setup.js',
	],

	// Coverage configuration
	collectCoverageFrom: [
		'src/**/*.js',
		'!src/**/*.test.js',
		'!src/**/index.js',
		'!src/edit.js', // Complex React component - tested manually
		'!src/save.js', // React save component - tested manually
		'!src/view.js', // Frontend script - tested manually
	],

	// Coverage threshold (enforce minimum coverage for utility functions)
	coverageThreshold: {
		global: {
			statements: 90,
			branches: 85,
			functions: 90,
			lines: 90,
		},
		// Strict requirements for utility functions
		'src/utils/**/*.js': {
			statements: 100,
			branches: 100,
			functions: 100,
			lines: 100,
		},
	},

	// Transform configuration
	transform: {
		'^.+\\.[jt]sx?$': [
			'@wordpress/scripts/config/babel-transform',
		],
	},

	// Module name mapper for CSS imports
	moduleNameMapper: {
		'\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
		'\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
	},
};
