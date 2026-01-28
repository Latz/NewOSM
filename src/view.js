/**
 * Frontend initialization for NewOSM maps
 * This script initializes Leaflet maps on the frontend
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FullScreen } from 'leaflet.fullscreen';
import 'leaflet.fullscreen/dist/Control.FullScreen.css';
import { applySVGMarkerIcons } from './utils/markerIcons';
import { getFrontendTileConfig } from './utils/devicePerformance';
import { registerServiceWorker } from './utils/swRegistration';

// Apply SVG marker icons to eliminate HTTP requests for PNG files
// See FUTURE_OPTIMIZATIONS.md #5 - Optimize Marker Icons
applySVGMarkerIcons(L);

// Get optimal tile configuration based on device performance
// See FUTURE_OPTIMIZATIONS.md #3 - Virtualize Tile Rendering
const tileConfig = getFrontendTileConfig();

// Register Service Worker for tile caching
// Enables cache-first strategy for OSM tiles, offline map support, and persistent cache
if (typeof window !== 'undefined') {
	const registerSW = () => {
		const pluginUrl = window.newOpmData?.pluginUrl || '';
		const swPath = pluginUrl + 'build/service-worker.js';
		registerServiceWorker(swPath);
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', registerSW);
	} else {
		registerSW();
	}
}

// Store map instances and cleanup functions for proper disposal
const mapInstances = new WeakMap(); // Maps DOM elements to { map, cleanup }

// Initialize maps when DOM is ready
if (typeof window !== 'undefined') {
	function init() {
		initializeNewOpmMaps();
	}

	document.addEventListener('DOMContentLoaded', init);

	// Also run immediately in case DOM is already loaded
	if (document.readyState !== 'loading') {
		init();
	}
}

/**
 * Clean up a map instance and remove all event listeners
 * @param {HTMLElement} mapElement - Map container element
 */
function cleanupMap(mapElement) {
	const instance = mapInstances.get(mapElement);
	if (!instance) {
		return;
	}

	// Run all cleanup functions
	if (instance.cleanup && Array.isArray(instance.cleanup)) {
		instance.cleanup.forEach(function (cleanupFn) {
			try {
				cleanupFn();
			} catch (error) {
				console.error('NewOSM: Error during cleanup', error);
			}
		});
	}

	// Remove the map instance
	if (instance.map) {
		try {
			instance.map.remove();
		} catch (error) {
			console.error('NewOSM: Error removing map', error);
		}
	}

	// Remove from WeakMap
	mapInstances.delete(mapElement);

	// Remove initialization class
	mapElement.classList.remove('newopm-initialized');
}

/**
 * Initialize all NewOSM maps on the page
 */
function initializeNewOpmMaps() {
	// Check if Leaflet is loaded
	if (typeof L === 'undefined') {
		console.error('NewOSM: Leaflet library not loaded');
		return;
	}

	const maps = document.querySelectorAll('.newopm-map-frontend');

	maps.forEach(function (mapElement) {
		// Check if already initialized
		if (mapElement.classList.contains('newopm-initialized')) {
			return;
		}

		// Clean up any existing map instance (shouldn't happen, but safety check)
		const existing = mapInstances.get(mapElement);
		if (existing) {
			cleanupMap(mapElement);
		}

		const lat = parseFloat(mapElement.getAttribute('data-lat'));
		const lon = parseFloat(mapElement.getAttribute('data-lon'));
		const zoom = parseInt(mapElement.getAttribute('data-zoom'));
		const markerLat = parseFloat(mapElement.getAttribute('data-marker-lat'));
		const markerLon = parseFloat(mapElement.getAttribute('data-marker-lon'));
		const markerLabel = mapElement.getAttribute('data-marker-label');

		// Validate coordinates
		if (isNaN(lat) || isNaN(lon) || isNaN(zoom)) {
			console.error('NewOSM: Invalid map coordinates', { lat, lon, zoom });
			return;
		}

		// Show loading indicator
		const loadingOverlay = document.createElement('div');
		loadingOverlay.className = 'newopm-loading-overlay';
		loadingOverlay.setAttribute('role', 'status');
		loadingOverlay.setAttribute('aria-live', 'polite');
		loadingOverlay.setAttribute('aria-label', 'Map is loading');
		loadingOverlay.innerHTML = `
			<div class="newopm-loading-content">
				<div class="newopm-spinner" role="img" aria-label="Loading spinner"></div>
				<p>Loading map...</p>
			</div>
		`;
		mapElement.style.position = 'relative';
		mapElement.setAttribute('role', 'region');
		mapElement.setAttribute('aria-label', 'Interactive OpenStreetMap');
		mapElement.appendChild(loadingOverlay);

		try {
			// Initialize the map
			const map = L.map(mapElement, {
				preferCanvas: true, // Use Canvas rendering for better performance (2-3x faster)
				trackResize: true,
			}).setView([lat, lon], zoom);

			// Store cleanup functions
			const cleanupFunctions = [];

			// Force map to recalculate size after a brief delay
			const resizeTimeout = setTimeout(() => {
				if (map) {
					map.invalidateSize();
				}
			}, 100);
			cleanupFunctions.push(() => clearTimeout(resizeTimeout));

			// Add tile layer with dynamic performance optimizations
			// Configuration adjusts based on device capabilities
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 19,
				tileSize: tileConfig.tileSize,
				updateWhenIdle: tileConfig.updateWhenIdle,
				updateWhenZooming: tileConfig.updateWhenZooming,
				keepBuffer: tileConfig.keepBuffer,
				maxNativeZoom: 19,
				minZoom: 2,
			}).addTo(map);

			// Add marker if coordinates are present
			if (!isNaN(markerLat) && !isNaN(markerLon)) {
				const marker = L.marker([markerLat, markerLon]).addTo(map);
				if (markerLabel) {
					marker.bindPopup(markerLabel);
				}
			}

			// Add leaflet.fullscreen plugin control
			const fullscreenControl = new FullScreen({
				position: 'topright',
				title: 'Show fullscreen',
				titleCancel: 'Exit fullscreen',
				forceSeparateButton: true,
			});
			map.addControl(fullscreenControl);

			// Handle map resize on fullscreen change
			const handleFullscreenResize = function () {
				setTimeout(() => {
					if (map) {
						map.invalidateSize();
					}
				}, 100);
			};
			map.on('enterFullscreen', handleFullscreenResize);
			map.on('exitFullscreen', handleFullscreenResize);

			// Add cleanup for fullscreen control
			cleanupFunctions.push(function () {
				map.off('enterFullscreen', handleFullscreenResize);
				map.off('exitFullscreen', handleFullscreenResize);
			});

			// Remove loading overlay when map is ready
			map.whenReady(function () {
				// Small delay to ensure tiles start loading
				setTimeout(function () {
					if (loadingOverlay && loadingOverlay.parentNode) {
						loadingOverlay.style.opacity = '0';
						loadingOverlay.style.transition = 'opacity 0.3s';
						setTimeout(function () {
							if (loadingOverlay.parentNode) {
								loadingOverlay.parentNode.removeChild(loadingOverlay);
							}
						}, 300);
					}
				}, 100);
			});

			// Store map instance and cleanup functions
			mapInstances.set(mapElement, {
				map: map,
				cleanup: cleanupFunctions,
			});

			mapElement.classList.add('newopm-initialized');
		} catch (error) {
			console.error('NewOSM: Error initializing map', error);
		}
	});
}

// Clean up all maps when page is unloaded or navigated away
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', function () {
		const maps = document.querySelectorAll('.newopm-map-frontend.newopm-initialized');
		maps.forEach(function (mapElement) {
			cleanupMap(mapElement);
		});
	});

	// Expose cleanup functions globally for manual cleanup if needed
	window.NewOPM = window.NewOPM || {};
	window.NewOPM.cleanupMap = cleanupMap;
	window.NewOPM.reinitializeMaps = initializeNewOpmMaps;
}
