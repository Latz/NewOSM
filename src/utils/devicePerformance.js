/**
 * Device Performance Detection Utility
 * Detects device capabilities and returns optimal tile rendering settings
 *
 * This optimization improves tile virtualization by adjusting buffer size
 * based on device performance. See FUTURE_OPTIMIZATIONS.md #3.
 */

/**
 * Performance tier levels
 * @typedef {'high' | 'medium' | 'low'} PerformanceTier
 */

/**
 * Tile rendering configuration
 * @typedef {Object} TileConfig
 * @property {number} keepBuffer - Number of tile rows/columns to keep in buffer
 * @property {boolean} updateWhenIdle - Only update tiles when map stops moving
 * @property {boolean} updateWhenZooming - Update tiles during zoom animation
 * @property {number} tileSize - Size of tiles in pixels
 */

/**
 * Detect device performance tier
 * Analyzes multiple factors to determine if device is high/medium/low performance
 *
 * @returns {PerformanceTier} Performance tier of the device
 */
export function detectPerformanceTier() {
	// Default to medium if we can't detect
	let score = 0;
	let maxScore = 0;

	// Factor 1: Device Memory (0-2 points)
	if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
		maxScore += 2;
		const memory = navigator.deviceMemory; // GB
		if (memory >= 8) {
			score += 2; // High memory
		} else if (memory >= 4) {
			score += 1; // Medium memory
		}
		// else: Low memory (0 points)
	}

	// Factor 2: CPU Cores (0-2 points)
	if (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator) {
		maxScore += 2;
		const cores = navigator.hardwareConcurrency;
		if (cores >= 8) {
			score += 2; // High CPU
		} else if (cores >= 4) {
			score += 1; // Medium CPU
		}
		// else: Low CPU (0 points)
	}

	// Factor 3: Network Connection (0-2 points)
	if (
		typeof navigator !== 'undefined' &&
		'connection' in navigator &&
		navigator.connection &&
		'effectiveType' in navigator.connection
	) {
		maxScore += 2;
		const effectiveType = navigator.connection.effectiveType;
		if (effectiveType === '4g') {
			score += 2; // Fast connection
		} else if (effectiveType === '3g') {
			score += 1; // Medium connection
		}
		// else: Slow connection (0 points)
	}

	// Factor 4: Screen Resolution (0-2 points)
	if (typeof window !== 'undefined' && window.screen) {
		maxScore += 2;
		const width = window.screen.width;
		const height = window.screen.height;
		const pixels = width * height;

		// Consider device pixel ratio for retina displays
		const dpr = window.devicePixelRatio || 1;
		const effectivePixels = pixels * dpr * dpr;

		if (effectivePixels >= 8294400) {
			// 4K and above
			score += 2; // High resolution (needs more tiles)
		} else if (effectivePixels >= 2073600) {
			// 1080p
			score += 1; // Medium resolution
		}
		// else: Lower resolution (0 points)
	}

	// If we couldn't detect anything, default to medium
	if (maxScore === 0) {
		return 'medium';
	}

	// Calculate percentage score
	const percentage = (score / maxScore) * 100;

	// Determine tier based on percentage
	if (percentage >= 65) {
		return 'high';
	} else if (percentage >= 35) {
		return 'medium';
	} else {
		return 'low';
	}
}

/**
 * Get optimal tile configuration for editor
 * Editor needs more aggressive buffering for smooth editing experience
 *
 * @returns {TileConfig} Optimal tile configuration
 */
export function getEditorTileConfig() {
	const tier = detectPerformanceTier();

	const configs = {
		high: {
			keepBuffer: 4, // More tiles for smooth panning
			updateWhenIdle: false, // Update during movement
			updateWhenZooming: true, // Update during zoom
			tileSize: 256,
		},
		medium: {
			keepBuffer: 3, // Balanced buffer
			updateWhenIdle: false, // Update during movement
			updateWhenZooming: true, // Update during zoom
			tileSize: 256,
		},
		low: {
			keepBuffer: 2, // Minimal buffer to save memory
			updateWhenIdle: true, // Only update when idle
			updateWhenZooming: false, // Skip updates during zoom
			tileSize: 256,
		},
	};

	return configs[tier];
}

/**
 * Get optimal tile configuration for frontend
 * Frontend prioritizes performance and battery life
 *
 * @returns {TileConfig} Optimal tile configuration
 */
export function getFrontendTileConfig() {
	const tier = detectPerformanceTier();

	const configs = {
		high: {
			keepBuffer: 3, // Good buffer for smooth experience
			updateWhenIdle: true, // Optimize for battery
			updateWhenZooming: false, // Skip updates during zoom
			tileSize: 256,
		},
		medium: {
			keepBuffer: 2, // Balanced buffer
			updateWhenIdle: true, // Optimize for battery
			updateWhenZooming: false, // Skip updates during zoom
			tileSize: 256,
		},
		low: {
			keepBuffer: 1, // Minimal buffer to save memory
			updateWhenIdle: true, // Only update when idle
			updateWhenZooming: false, // Skip updates during zoom
			tileSize: 256,
		},
	};

	return configs[tier];
}

/**
 * Get device performance information for debugging
 * Useful for troubleshooting performance issues
 *
 * @returns {Object} Device performance metrics
 */
export function getDeviceInfo() {
	const info = {
		tier: detectPerformanceTier(),
		memory: typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? navigator.deviceMemory : 'unknown',
		cores:
			typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
				? navigator.hardwareConcurrency
				: 'unknown',
		connection:
			typeof navigator !== 'undefined' &&
			'connection' in navigator &&
			navigator.connection &&
			'effectiveType' in navigator.connection
				? navigator.connection.effectiveType
				: 'unknown',
		screen: {
			width: typeof window !== 'undefined' && window.screen ? window.screen.width : 'unknown',
			height: typeof window !== 'undefined' && window.screen ? window.screen.height : 'unknown',
			devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 'unknown',
		},
	};

	return info;
}
