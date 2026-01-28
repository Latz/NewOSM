/**
 * Tests for device performance detection and tile virtualization
 * See FUTURE_OPTIMIZATIONS.md #3
 */

import {
	detectPerformanceTier,
	getEditorTileConfig,
	getFrontendTileConfig,
	getDeviceInfo,
} from './devicePerformance';

describe('Device Performance Detection', () => {
	// Store original values to restore after tests
	let originalNavigator;
	let originalWindow;

	beforeEach(() => {
		originalNavigator = global.navigator;
		originalWindow = global.window;
	});

	afterEach(() => {
		global.navigator = originalNavigator;
		global.window = originalWindow;
	});

	describe('detectPerformanceTier', () => {
		test('should return medium tier when no detection APIs available', () => {
			global.navigator = {};
			global.window = {};

			expect(detectPerformanceTier()).toBe('medium');
		});

		test('should detect high tier for powerful devices', () => {
			global.navigator = {
				deviceMemory: 16, // 16GB RAM
				hardwareConcurrency: 8, // 8 CPU cores
				connection: {
					effectiveType: '4g',
				},
			};
			global.window = {
				screen: {
					width: 3840,
					height: 2160,
				},
				devicePixelRatio: 2,
			};

			expect(detectPerformanceTier()).toBe('high');
		});

		test('should detect medium tier for average devices', () => {
			global.navigator = {
				deviceMemory: 4, // 4GB RAM
				hardwareConcurrency: 4, // 4 CPU cores
				connection: {
					effectiveType: '3g',
				},
			};
			global.window = {
				screen: {
					width: 1920,
					height: 1080,
				},
				devicePixelRatio: 1,
			};

			expect(detectPerformanceTier()).toBe('medium');
		});

		test('should detect low tier for low-end devices', () => {
			global.navigator = {
				deviceMemory: 2, // 2GB RAM
				hardwareConcurrency: 2, // 2 CPU cores
				connection: {
					effectiveType: '2g',
				},
			};
			global.window = {
				screen: {
					width: 1366,
					height: 768,
				},
				devicePixelRatio: 1,
			};

			expect(detectPerformanceTier()).toBe('low');
		});

		test('should handle missing deviceMemory gracefully', () => {
			global.navigator = {
				hardwareConcurrency: 4,
			};
			global.window = {
				screen: {
					width: 1920,
					height: 1080,
				},
				devicePixelRatio: 1,
			};

			const tier = detectPerformanceTier();
			expect(['high', 'medium', 'low']).toContain(tier);
		});

		test('should handle missing connection API gracefully', () => {
			global.navigator = {
				deviceMemory: 8,
				hardwareConcurrency: 4,
			};
			global.window = {
				screen: {
					width: 1920,
					height: 1080,
				},
				devicePixelRatio: 1,
			};

			const tier = detectPerformanceTier();
			expect(['high', 'medium', 'low']).toContain(tier);
		});
	});

	describe('getEditorTileConfig', () => {
		test('should return valid config for high performance', () => {
			global.navigator = {
				deviceMemory: 16,
				hardwareConcurrency: 8,
				connection: { effectiveType: '4g' },
			};
			global.window = {
				screen: { width: 3840, height: 2160 },
				devicePixelRatio: 2,
			};

			const config = getEditorTileConfig();

			expect(config).toHaveProperty('keepBuffer');
			expect(config).toHaveProperty('updateWhenIdle');
			expect(config).toHaveProperty('updateWhenZooming');
			expect(config).toHaveProperty('tileSize');
			expect(config.keepBuffer).toBe(4);
			expect(config.updateWhenIdle).toBe(false);
			expect(config.updateWhenZooming).toBe(true);
		});

		test('should return valid config for medium performance', () => {
			global.navigator = {
				deviceMemory: 4,
				hardwareConcurrency: 4,
			};
			global.window = {
				screen: { width: 1920, height: 1080 },
				devicePixelRatio: 1,
			};

			const config = getEditorTileConfig();

			expect(config.keepBuffer).toBe(3);
			expect(config.updateWhenIdle).toBe(false);
			expect(config.updateWhenZooming).toBe(true);
		});

		test('should return valid config for low performance', () => {
			global.navigator = {
				deviceMemory: 2,
				hardwareConcurrency: 2,
			};
			global.window = {
				screen: { width: 1366, height: 768 },
				devicePixelRatio: 1,
			};

			const config = getEditorTileConfig();

			expect(config.keepBuffer).toBe(2);
			expect(config.updateWhenIdle).toBe(true);
			expect(config.updateWhenZooming).toBe(false);
		});

		test('should always return tileSize of 256', () => {
			const tiers = [
				{ deviceMemory: 16, hardwareConcurrency: 8 },
				{ deviceMemory: 4, hardwareConcurrency: 4 },
				{ deviceMemory: 2, hardwareConcurrency: 2 },
			];

			tiers.forEach(nav => {
				global.navigator = nav;
				const config = getEditorTileConfig();
				expect(config.tileSize).toBe(256);
			});
		});
	});

	describe('getFrontendTileConfig', () => {
		test('should be more conservative than editor config', () => {
			global.navigator = {
				deviceMemory: 16,
				hardwareConcurrency: 8,
				connection: { effectiveType: '4g' },
			};
			global.window = {
				screen: { width: 3840, height: 2160 },
				devicePixelRatio: 2,
			};

			const editorConfig = getEditorTileConfig();
			const frontendConfig = getFrontendTileConfig();

			// Frontend should have smaller or equal keepBuffer
			expect(frontendConfig.keepBuffer).toBeLessThanOrEqual(editorConfig.keepBuffer);

			// Frontend should prioritize battery (updateWhenIdle = true)
			expect(frontendConfig.updateWhenIdle).toBe(true);
			expect(frontendConfig.updateWhenZooming).toBe(false);
		});

		test('should return valid config for high performance', () => {
			global.navigator = {
				deviceMemory: 16,
				hardwareConcurrency: 8,
			};
			global.window = {
				screen: { width: 3840, height: 2160 },
				devicePixelRatio: 2,
			};

			const config = getFrontendTileConfig();

			expect(config.keepBuffer).toBe(3);
			expect(config.updateWhenIdle).toBe(true);
		});

		test('should return minimal config for low performance', () => {
			global.navigator = {
				deviceMemory: 2,
				hardwareConcurrency: 2,
			};
			global.window = {
				screen: { width: 1366, height: 768 },
				devicePixelRatio: 1,
			};

			const config = getFrontendTileConfig();

			expect(config.keepBuffer).toBe(1);
			expect(config.updateWhenIdle).toBe(true);
			expect(config.updateWhenZooming).toBe(false);
		});
	});

	describe('getDeviceInfo', () => {
		test('should return device information', () => {
			global.navigator = {
				deviceMemory: 8,
				hardwareConcurrency: 4,
				connection: { effectiveType: '4g' },
			};
			global.window = {
				screen: { width: 1920, height: 1080 },
				devicePixelRatio: 2,
			};

			const info = getDeviceInfo();

			expect(info).toHaveProperty('tier');
			expect(info).toHaveProperty('memory');
			expect(info).toHaveProperty('cores');
			expect(info).toHaveProperty('connection');
			expect(info).toHaveProperty('screen');
			expect(info.tier).toMatch(/high|medium|low/);
			expect(info.memory).toBe(8);
			expect(info.cores).toBe(4);
		});

		test('should handle missing APIs gracefully', () => {
			global.navigator = {};
			global.window = {};

			const info = getDeviceInfo();

			expect(info.tier).toMatch(/high|medium|low/);
			expect(info.memory).toBe('unknown');
			expect(info.cores).toBe('unknown');
			expect(info.connection).toBe('unknown');
		});
	});

	describe('Performance Scaling', () => {
		test('keepBuffer should scale with device performance', () => {
			const deviceTiers = [
				{ deviceMemory: 16, hardwareConcurrency: 8, expectedMin: 3 },
				{ deviceMemory: 4, hardwareConcurrency: 4, expectedMin: 2 },
				{ deviceMemory: 2, hardwareConcurrency: 2, expectedMin: 1 },
			];

			deviceTiers.forEach(({ deviceMemory, hardwareConcurrency, expectedMin }) => {
				global.navigator = { deviceMemory, hardwareConcurrency };
				global.window = { screen: { width: 1920, height: 1080 }, devicePixelRatio: 1 };

				const editorConfig = getEditorTileConfig();
				const frontendConfig = getFrontendTileConfig();

				expect(editorConfig.keepBuffer).toBeGreaterThanOrEqual(expectedMin);
				expect(frontendConfig.keepBuffer).toBeGreaterThanOrEqual(expectedMin - 1);
			});
		});

		test('editor should be more aggressive than frontend', () => {
			const tiers = [
				{ deviceMemory: 16, hardwareConcurrency: 8 },
				{ deviceMemory: 4, hardwareConcurrency: 4 },
				{ deviceMemory: 2, hardwareConcurrency: 2 },
			];

			tiers.forEach(nav => {
				global.navigator = nav;
				global.window = { screen: { width: 1920, height: 1080 }, devicePixelRatio: 1 };

				const editorConfig = getEditorTileConfig();
				const frontendConfig = getFrontendTileConfig();

				// Editor should have more buffering for smooth editing
				expect(editorConfig.keepBuffer).toBeGreaterThanOrEqual(frontendConfig.keepBuffer);
			});
		});
	});
});
