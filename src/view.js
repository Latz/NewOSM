/**
 * Frontend initialization for NewOSM maps
 * This script initializes Leaflet maps on the frontend
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;

const pluginUrl = window.newOpmData?.pluginUrl?.replace(/\/$/, '') || '';

L.Icon.Default.mergeOptions({
	iconRetinaUrl: pluginUrl + '/assets/leaflet/marker-icon-2x.png',
	iconUrl: pluginUrl + '/assets/leaflet/marker-icon.png',
	shadowUrl: pluginUrl + '/assets/leaflet/marker-shadow.png',
});

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

			// Add tile layer with performance optimizations
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 19,
				tileSize: 256,
				updateWhenIdle: true, // Only update tiles when map stops moving
				updateWhenZooming: false, // Don't update during zoom animation
				keepBuffer: 2, // Keep 2 tile rows/cols in buffer for smoother panning
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

			// Add fullscreen control and get its cleanup function
			const fullscreenCleanup = addFullscreenControl(map, mapElement);
			if (fullscreenCleanup) {
				cleanupFunctions.push(fullscreenCleanup);
			}

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

/**
 * Add fullscreen control to map
 * @param {Object} map - Leaflet map instance
 * @param {HTMLElement} mapElement - Map container element
 * @returns {Function} Cleanup function to remove event listeners
 */
function addFullscreenControl(map, mapElement) {
	const fullscreenButton = L.control({ position: 'topright' });

	fullscreenButton.onAdd = function () {
		const button = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
		button.innerHTML = '⛶';
		button.title = 'Toggle Fullscreen';
		button.style.backgroundColor = 'white';
		button.style.width = '30px';
		button.style.height = '30px';
		button.style.fontSize = '20px';
		button.style.cursor = 'pointer';
		button.style.border = '2px solid rgba(0,0,0,0.2)';
		button.style.borderRadius = '4px';

		// Accessibility attributes
		button.setAttribute('aria-label', 'Toggle fullscreen map view');
		button.setAttribute('role', 'button');
		button.setAttribute('type', 'button');
		button.setAttribute('aria-pressed', 'false');

		L.DomEvent.disableClickPropagation(button);
		L.DomEvent.on(button, 'click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			toggleFullscreen(mapElement, map);
		});

		return button;
	};

	fullscreenButton.addTo(map);

	// Handle fullscreen changes
	const handleFullscreenChange = function () {
		const isFullscreen = !!(
			document.fullscreenElement ||
			document.mozFullScreenElement ||
			document.webkitFullscreenElement ||
			document.msFullscreenElement
		);

		// Update ARIA attributes
		const fullscreenBtn = mapElement.querySelector('.leaflet-control-custom');
		if (fullscreenBtn) {
			fullscreenBtn.setAttribute('aria-pressed', isFullscreen ? 'true' : 'false');
			fullscreenBtn.setAttribute(
				'aria-label',
				isFullscreen ? 'Exit fullscreen map view' : 'Toggle fullscreen map view'
			);
		}

		setTimeout(() => {
			if (map) {
				map.invalidateSize();
			}
		}, 100);
	};

	// Add event listeners
	document.addEventListener('fullscreenchange', handleFullscreenChange);
	document.addEventListener('mozfullscreenchange', handleFullscreenChange);
	document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
	document.addEventListener('msfullscreenchange', handleFullscreenChange);

	// Return cleanup function to remove event listeners
	return function cleanup() {
		document.removeEventListener('fullscreenchange', handleFullscreenChange);
		document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
		document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.removeEventListener('msfullscreenchange', handleFullscreenChange);
	};
}

/**
 * Toggle fullscreen mode
 * @param {HTMLElement} element - Element to make fullscreen
 * @param {Object} map - Leaflet map instance
 */
function toggleFullscreen(element, map) {
	const isFullscreen = !!(
		document.fullscreenElement ||
		document.mozFullScreenElement ||
		document.webkitFullscreenElement ||
		document.msFullscreenElement
	);

	if (!isFullscreen) {
		// Enter fullscreen
		if (element.requestFullscreen) {
			element.requestFullscreen();
		} else if (element.mozRequestFullScreen) {
			element.mozRequestFullScreen();
		} else if (element.webkitRequestFullscreen) {
			element.webkitRequestFullscreen();
		} else if (element.msRequestFullscreen) {
			element.msRequestFullscreen();
		}
	} else {
		// Exit fullscreen
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		}
	}
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
