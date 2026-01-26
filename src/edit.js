import { useState, useEffect, useRef, useCallback, Component } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, TextControl, RangeControl, Button, SelectControl, ToggleControl } from '@wordpress/components';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import apiFetch from '@wordpress/api-fetch';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Error Boundary Component
 * Catches errors in map components to prevent entire editor from crashing
 */
class MapErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error) {
		// Update state so the next render will show the fallback UI
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		// Log error details for debugging
		console.error('Map component error:', error, errorInfo);
		this.setState({
			error,
			errorInfo,
		});
	}

	handleReset = () => {
		// Reset error state and attempt to re-render
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	render() {
		if (this.state.hasError) {
			return (
				<div
					style={{
						padding: '20px',
						border: '2px solid #dc3232',
						borderRadius: '4px',
						backgroundColor: '#fef7f7',
						color: '#444',
					}}
				>
					<h3 style={{ margin: '0 0 12px 0', color: '#dc3232' }}>Map Failed to Load</h3>
					<p style={{ margin: '0 0 12px 0' }}>
						The map component encountered an error and could not be displayed. This may be due to:
					</p>
					<ul style={{ margin: '0 0 16px 20px' }}>
						<li>Network connectivity issues</li>
						<li>Leaflet library failed to load</li>
						<li>Invalid map configuration</li>
						<li>Browser compatibility issues</li>
					</ul>
					{this.state.error && (
						<details style={{ marginBottom: '16px' }}>
							<summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
								Error Details (for debugging)
							</summary>
							<pre
								style={{
									backgroundColor: '#f5f5f5',
									padding: '10px',
									borderRadius: '4px',
									fontSize: '12px',
									overflow: 'auto',
									maxHeight: '200px',
								}}
							>
								{this.state.error.toString()}
								{this.state.errorInfo && this.state.errorInfo.componentStack}
							</pre>
						</details>
					)}
					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							onClick={this.handleReset}
							style={{
								padding: '8px 16px',
								backgroundColor: '#2271b1',
								color: 'white',
								border: 'none',
								borderRadius: '3px',
								cursor: 'pointer',
							}}
						>
							Try Again
						</button>
						<button
							onClick={() => window.location.reload()}
							style={{
								padding: '8px 16px',
								backgroundColor: '#dcdcdc',
								color: '#2c3338',
								border: 'none',
								borderRadius: '3px',
								cursor: 'pointer',
							}}
						>
							Reload Page
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// Fix for default marker icons in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;

// Get plugin URL from localized script data (passed from PHP)
// This data is localized in newopm.php via wp_localize_script()
if (typeof window.newOpmData === 'undefined' || !window.newOpmData.pluginUrl) {
	console.error('NewOSM: Plugin URL not available. Make sure wp_localize_script is working correctly.');
}

const pluginUrl = window.newOpmData?.pluginUrl?.replace(/\/$/, '') || '';

L.Icon.Default.mergeOptions({
	iconRetinaUrl: pluginUrl + '/assets/leaflet/marker-icon-2x.png',
	iconUrl: pluginUrl + '/assets/leaflet/marker-icon.png',
	shadowUrl: pluginUrl + '/assets/leaflet/marker-shadow.png',
});

/**
 * Rate limiter for Nominatim API requests
 * Ensures compliance with Nominatim usage policy (max 1 request/second)
 */
class NominatimRateLimiter {
	constructor() {
		this.lastRequestTime = 0;
		this.minInterval = 1000; // 1 second minimum between requests
		this.cache = new Map();
		this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
		this.pendingRequest = null;
	}

	/**
	 * Get cache key for a request
	 */
	getCacheKey(url) {
		return url;
	}

	/**
	 * Check if cached data is still valid
	 */
	getCached(key) {
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
			return cached.data;
		}
		this.cache.delete(key);
		return null;
	}

	/**
	 * Store data in cache
	 */
	setCache(key, data) {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		});
	}

	/**
	 * Make a rate-limited request to Nominatim
	 */
	async request(url) {
		const cacheKey = this.getCacheKey(url);

		// Check cache first
		const cached = this.getCached(cacheKey);
		if (cached) {
			return cached;
		}

		// If there's a pending request for the same URL, wait for it
		if (this.pendingRequest && this.pendingRequest.url === url) {
			return this.pendingRequest.promise;
		}

		// Calculate time to wait to respect rate limit
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;
		const timeToWait = Math.max(0, this.minInterval - timeSinceLastRequest);

		// Wait if necessary
		if (timeToWait > 0) {
			await new Promise(resolve => setTimeout(resolve, timeToWait));
		}

		// Create the request promise
		const promise = (async () => {
			try {
				this.lastRequestTime = Date.now();

				const response = await fetch(url, {
					headers: {
						'User-Agent': 'WordPress-NewOSM-Plugin/1.0',
					},
				});

				// Handle rate limiting
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After');
					const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
					throw new Error(`Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
				}

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();

				// Cache the result
				this.setCache(cacheKey, data);

				return data;
			} finally {
				// Clear pending request
				if (this.pendingRequest && this.pendingRequest.url === url) {
					this.pendingRequest = null;
				}
			}
		})();

		// Store as pending request
		this.pendingRequest = { url, promise };

		return promise;
	}

	/**
	 * Search for a location
	 */
	async search(query) {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
		return this.request(url);
	}

	/**
	 * Reverse geocode coordinates
	 */
	async reverse(lat, lon) {
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
		return this.request(url);
	}
}

// Create a singleton instance
const nominatimAPI = new NominatimRateLimiter();

// Custom pan handler that doesn't get stuck
function MapInteractionHandler({ onMapClick, onZoomChange }) {
	const map = useMap();
	const isDragging = useRef(false);
	const dragStart = useRef(null);
	const mapStartCenter = useRef(null);

	useEffect(() => {
		if (!map) return;

		// Disable Leaflet's built-in dragging completely
		map.dragging.disable();

		// Listen for zoom changes and update the attribute
		const handleZoomEnd = () => {
			const newZoom = map.getZoom();
			onZoomChange(newZoom);
		};

		map.on('zoomend', handleZoomEnd);

		const container = map.getContainer();

		const handleMouseDown = e => {
			// Don't interfere with marker dragging
			if (e.target.classList.contains('leaflet-marker-icon')) {
				return;
			}

			isDragging.current = false;
			dragStart.current = { x: e.clientX, y: e.clientY };
			mapStartCenter.current = map.getCenter();
			// Don't change cursor yet - wait until we start dragging
			e.preventDefault();
		};

		const handleMouseMove = e => {
			if (!dragStart.current) return;

			const dx = e.clientX - dragStart.current.x;
			const dy = e.clientY - dragStart.current.y;

			// If moved more than 3 pixels, it's a drag
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				// First time we detect dragging, change cursor to grab, then grabbing
				if (!isDragging.current) {
					container.style.cursor = 'grab';
					// Use setTimeout to quickly transition to grabbing
					setTimeout(() => {
						if (dragStart.current) {
							// Still dragging
							container.style.cursor = 'grabbing';
						}
					}, 50);
				}

				isDragging.current = true;

				// Calculate new center based on pixel movement
				const startPoint = map.project(mapStartCenter.current, map.getZoom());
				const newPoint = L.point(startPoint.x - dx, startPoint.y - dy);
				const newCenter = map.unproject(newPoint, map.getZoom());

				map.setView(newCenter, map.getZoom(), { animate: false });
			}
		};

		const handleMouseUp = e => {
			const wasDragging = isDragging.current;

			// Reset everything immediately
			isDragging.current = false;
			dragStart.current = null;
			mapStartCenter.current = null;
			container.style.cursor = 'crosshair'; // Back to crosshair

			// If we didn't drag, place a marker
			if (!wasDragging && e.target.classList.contains('leaflet-container')) {
				const latlng = map.mouseEventToLatLng(e);
				onMapClick(latlng);
			}
		};

		const handleMouseLeave = () => {
			// Clean up if mouse leaves the map
			isDragging.current = false;
			dragStart.current = null;
			mapStartCenter.current = null;
			container.style.cursor = 'crosshair'; // Back to crosshair
		};

		container.addEventListener('mousedown', handleMouseDown);
		container.addEventListener('mousemove', handleMouseMove);
		container.addEventListener('mouseup', handleMouseUp);
		container.addEventListener('mouseleave', handleMouseLeave);

		// Set initial cursor to crosshair
		container.style.cursor = 'crosshair';

		// Global mouse up to catch releases outside map
		const globalMouseUp = () => {
			isDragging.current = false;
			dragStart.current = null;
			mapStartCenter.current = null;
			container.style.cursor = 'crosshair'; // Back to crosshair
		};

		document.addEventListener('mouseup', globalMouseUp);

		return () => {
			container.removeEventListener('mousedown', handleMouseDown);
			container.removeEventListener('mousemove', handleMouseMove);
			container.removeEventListener('mouseup', handleMouseUp);
			container.removeEventListener('mouseleave', handleMouseLeave);
			document.removeEventListener('mouseup', globalMouseUp);
			map.off('zoomend', handleZoomEnd);

			// Re-enable Leaflet dragging on cleanup
			if (map.dragging) {
				map.dragging.enable();
			}
		};
	}, [map, onMapClick, onZoomChange]);

	return null;
}

function DraggableMarker({ position, onDragEnd, label }) {
	const [markerRef, setMarkerRef] = useState(null);

	const eventHandlers = {
		dragend() {
			const marker = markerRef;
			if (marker != null) {
				const newPos = marker.getLatLng();
				onDragEnd(newPos);
			}
		},
	};

	return (
		<Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={setMarkerRef}>
			<Popup>{label || `Lat: ${position.lat.toFixed(5)}, Lon: ${position.lng.toFixed(5)}`}</Popup>
		</Marker>
	);
}

// Component to sync zoom from sidebar to map
function ZoomSync({ zoom }) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		// Wait for map to be fully ready before setting zoom
		map.whenReady(() => {
			if (map.getZoom() !== zoom) {
				map.setZoom(zoom, { animate: false });
			}
		});
	}, [map, zoom]);

	return null;
}

// Component to handle map loading state
function MapLoadingHandler({ onMapReady }) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		// Notify parent when map is ready
		map.whenReady(() => {
			// Small delay to ensure tiles start loading
			setTimeout(() => {
				if (onMapReady) {
					onMapReady();
				}
			}, 100);
		});
	}, [map, onMapReady]);

	return null;
}

// Fullscreen control component
function FullscreenControl() {
	const map = useMap();
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		if (!map) return;

		const container = map.getContainer();
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

			L.DomEvent.disableClickPropagation(button);
			L.DomEvent.on(button, 'click', function (e) {
				e.preventDefault();
				e.stopPropagation();

				const mapWrapper = container.closest('.newopm-map-container');
				if (!mapWrapper) return;

				if (!isFullscreen) {
					// Enter fullscreen
					if (mapWrapper.requestFullscreen) {
						mapWrapper.requestFullscreen();
					} else if (mapWrapper.mozRequestFullScreen) {
						mapWrapper.mozRequestFullScreen();
					} else if (mapWrapper.webkitRequestFullscreen) {
						mapWrapper.webkitRequestFullscreen();
					} else if (mapWrapper.msRequestFullscreen) {
						mapWrapper.msRequestFullscreen();
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
			});

			return button;
		};

		fullscreenButton.addTo(map);

		// Listen for fullscreen changes
		const handleFullscreenChange = () => {
			const isNowFullscreen = !!(
				document.fullscreenElement ||
				document.mozFullScreenElement ||
				document.webkitFullscreenElement ||
				document.msFullscreenElement
			);
			setIsFullscreen(isNowFullscreen);

			// Invalidate map size when entering/exiting fullscreen
			setTimeout(() => {
				map.invalidateSize();
			}, 100);
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('msfullscreenchange', handleFullscreenChange);

		return () => {
			fullscreenButton.remove();
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('msfullscreenchange', handleFullscreenChange);
		};
	}, [map, isFullscreen]);

	return null;
}

const SIZE_PRESETS = {
	small: { width: '300px', height: 200 },
	medium: { width: '100%', height: 400 },
	large: { width: '100%', height: 600 },
	fullscreen: { width: '100%', height: 800 },
	custom: null,
};

export default function Edit({ attributes, setAttributes }) {
	const { latitude, longitude, zoom, markerLat, markerLon, markerLabel, height, width, sizePreset } = attributes;
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [mapKey, setMapKey] = useState(0);
	const [useCustomSize, setUseCustomSize] = useState(sizePreset === 'custom');
	const [isLoadingAddress, setIsLoadingAddress] = useState(false);
	const [markerAddress, setMarkerAddress] = useState('');
	const [isMapLoading, setIsMapLoading] = useState(true);

	// Apply saved defaults on first load
	useEffect(() => {
		const loadDefaults = async () => {
			if (attributes.customDefaultsApplied) {
				console.log('Defaults already applied, skipping');
				return;
			}

			try {
				console.log('Loading defaults from API...');
				const defaults = await apiFetch({
					path: '/newopm/v1/defaults',
					method: 'GET',
				});

				console.log('Defaults loaded:', defaults);
				console.log('Current attributes:', attributes);

				const updates = {
					customDefaultsApplied: true,
				};

				if (defaults.sizePreset && !attributes.sizePreset) {
					updates.sizePreset = defaults.sizePreset;
				}
				if (defaults.height && attributes.height === 400) {
					updates.height = defaults.height;
				}
				if (defaults.width && attributes.width === '100%') {
					updates.width = defaults.width;
				}
				if (defaults.zoom && attributes.zoom === 13) {
					updates.zoom = defaults.zoom;
				}
				if (defaults.latitude && attributes.latitude === 51.505) {
					updates.latitude = defaults.latitude;
				}
				if (defaults.longitude && attributes.longitude === -0.09) {
					updates.longitude = defaults.longitude;
				}
				if (defaults.markerLat && !attributes.markerLat) {
					updates.markerLat = defaults.markerLat;
				}
				if (defaults.markerLon && !attributes.markerLon) {
					updates.markerLon = defaults.markerLon;
				}
				if (defaults.markerLabel && !attributes.markerLabel) {
					updates.markerLabel = defaults.markerLabel;
				}

				console.log('Updates to apply:', updates);

				if (Object.keys(updates).length > 1) {
					setAttributes(updates);
					console.log('Defaults applied successfully');

					// Force map re-center if location changed
					if (updates.latitude || updates.longitude) {
						setMapKey(prev => prev + 1);
					}
				} else {
					console.log('No updates to apply');
				}
			} catch (error) {
				console.error('Error loading defaults:', error);
			}
		};

		loadDefaults();
	}, []);

	const blockProps = useBlockProps({
		style: {
			minHeight: height + 'px',
			width: width,
		},
	});

	const handleSearch = async () => {
		if (!searchQuery.trim()) return;

		setIsSearching(true);
		try {
			const data = await nominatimAPI.search(searchQuery);

			if (data && data.length > 0) {
				const result = data[0];
				const lat = parseFloat(result.lat);
				const lon = parseFloat(result.lon);

				// Set the marker address from search result
				setMarkerAddress(result.display_name);

				setAttributes({
					latitude: lat,
					longitude: lon,
					zoom: 15,
					markerLat: lat,
					markerLon: lon,
					markerLabel: result.display_name,
				});
				setMapKey(prev => prev + 1); // Force map to re-center
			} else {
				alert('Location not found. Please try a different search term.');
			}
		} catch (error) {
			console.error('Search error:', error);
			// Provide more specific error message
			const errorMessage = error.message.includes('Rate limited')
				? error.message
				: 'Error searching for location. Please try again in a moment.';
			alert(errorMessage);
		} finally {
			setIsSearching(false);
		}
	};

	// Debounced reverse geocoding to prevent rapid API calls during marker dragging
	const reverseGeocodeTimeout = useRef(null);

	const fetchAddress = useCallback(
		async (lat, lon) => {
			// Set marker immediately with coordinates
			const coordLabel = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
			setAttributes({
				markerLat: lat,
				markerLon: lon,
				markerLabel: coordLabel,
			});

			// Clear any pending reverse geocode request
			if (reverseGeocodeTimeout.current) {
				clearTimeout(reverseGeocodeTimeout.current);
			}

			// Debounce the reverse geocoding by 500ms
			reverseGeocodeTimeout.current = setTimeout(async () => {
				setIsLoadingAddress(true);
				setMarkerAddress('');

				try {
					const data = await nominatimAPI.reverse(lat, lon);

					if (data && data.display_name) {
						setMarkerAddress(data.display_name);
						setAttributes({
							markerLat: lat,
							markerLon: lon,
							markerLabel: data.display_name,
						});
					} else {
						setMarkerAddress('');
					}
				} catch (error) {
					console.error('Reverse geocoding error:', error);
					setMarkerAddress('');
					// Don't show alert for reverse geocoding errors to avoid interrupting user workflow
				} finally {
					setIsLoadingAddress(false);
				}
			}, 500); // Wait 500ms after user stops dragging before making request
		},
		[setAttributes]
	);

	// Cleanup debounce timeout on unmount
	useEffect(() => {
		return () => {
			if (reverseGeocodeTimeout.current) {
				clearTimeout(reverseGeocodeTimeout.current);
			}
		};
	}, []);

	const handleMapClick = latlng => {
		fetchAddress(latlng.lat, latlng.lng);
	};

	const handleMarkerDrag = latlng => {
		fetchAddress(latlng.lat, latlng.lng);
	};

	const handleZoomChange = newZoom => {
		setAttributes({ zoom: newZoom });
	};

	const clearMarker = () => {
		setAttributes({
			markerLat: undefined,
			markerLon: undefined,
			markerLabel: '',
		});
	};

	const handleSizePresetChange = preset => {
		setAttributes({ sizePreset: preset });

		if (preset !== 'custom' && SIZE_PRESETS[preset]) {
			setAttributes({
				width: SIZE_PRESETS[preset].width,
				height: SIZE_PRESETS[preset].height,
				sizePreset: preset,
			});
			setUseCustomSize(false);
		} else {
			setUseCustomSize(true);
		}
	};

	const saveAsDefault = async () => {
		try {
			console.log('Saving defaults:', {
				sizePreset,
				height,
				width,
				zoom,
				latitude,
				longitude,
				markerLat,
				markerLon,
				markerLabel,
			});

			const data = await apiFetch({
				path: '/newopm/v1/defaults',
				method: 'POST',
				data: {
					sizePreset: sizePreset,
					height: height,
					width: width,
					zoom: zoom,
					latitude: latitude,
					longitude: longitude,
					markerLat: markerLat,
					markerLon: markerLon,
					markerLabel: markerLabel,
				},
			});

			console.log('Save response:', data);

			if (data.success) {
				alert(data.message || 'Default settings saved successfully!');
			} else {
				alert('Settings may not have been saved. Check console for details.');
			}
		} catch (error) {
			console.error('Error saving defaults:', error);
			console.error('Error details:', error.message, error.data);
			alert('Error saving defaults: ' + (error.message || 'Unknown error'));
		}
	};

	const center = [latitude, longitude];
	const markerPosition = markerLat && markerLon ? [markerLat, markerLon] : null;

	// Callback when map finishes loading
	const handleMapReady = useCallback(() => {
		setIsMapLoading(false);
	}, []);

	return (
		<>
			<InspectorControls>
				<PanelBody title='Map Settings' initialOpen={true}>
					<div style={{ marginBottom: '16px' }}>
						<TextControl
							label='Search Location'
							value={searchQuery}
							onChange={value => setSearchQuery(value)}
							placeholder='Enter city, address, or landmark'
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							onKeyDown={e => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleSearch();
								}
							}}
						/>
						<Button
							variant='primary'
							onClick={handleSearch}
							isBusy={isSearching}
							disabled={!searchQuery.trim() || isSearching}
							style={{ marginTop: '8px', width: '100%' }}
						>
							{isSearching ? 'Searching...' : 'Search'}
						</Button>
					</div>

					<SelectControl
						label='Size Preset'
						value={sizePreset}
						options={[
							{ label: 'Small (300×200)', value: 'small' },
							{ label: 'Medium (100%×400)', value: 'medium' },
							{ label: 'Large (100%×600)', value: 'large' },
							{ label: 'Fullscreen (100%×800)', value: 'fullscreen' },
							{ label: 'Custom', value: 'custom' },
						]}
						onChange={handleSizePresetChange}
						help='Quick size presets for the map'
						__next40pxDefaultSize
						__nextHasNoMarginBottom
					/>

					{(sizePreset === 'custom' || useCustomSize) && (
						<>
							<TextControl
								label='Map Width'
								value={width}
								onChange={value => setAttributes({ width: value })}
								placeholder='e.g., 100%, 800px, 50vw'
								help='Width can be percentage, pixels, or viewport units'
								__next40pxDefaultSize
								__nextHasNoMarginBottom
							/>
							<RangeControl
								label='Map Height (px)'
								value={height}
								onChange={value => setAttributes({ height: value })}
								min={200}
								max={1200}
								step={10}
								__next40pxDefaultSize
								__nextHasNoMarginBottom
							/>
						</>
					)}

					<RangeControl
						label='Zoom Level'
						value={zoom}
						onChange={value => setAttributes({ zoom: value })}
						min={1}
						max={18}
						step={1}
						__next40pxDefaultSize
						__nextHasNoMarginBottom
					/>

					<Button variant='secondary' onClick={saveAsDefault} style={{ marginTop: '12px', width: '100%' }}>
						Save Current Settings as Default
					</Button>

					<div style={{ marginTop: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
						<p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Map Center:</p>
						<p style={{ margin: '0', fontSize: '12px' }}>
							Lat: {latitude.toFixed(5)}
							<br />
							Lon: {longitude.toFixed(5)}
						</p>
					</div>

					{markerPosition && (
						<div style={{ marginTop: '12px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
							<p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
								Marker Position{' '}
								{isLoadingAddress && (
									<span style={{ fontSize: '11px', fontWeight: 'normal' }}>(loading address...)</span>
								)}
							</p>

							{markerAddress && (
								<div
									style={{
										marginBottom: '12px',
										padding: '8px',
										background: '#e8f4f8',
										borderRadius: '4px',
										border: '1px solid #0073aa',
									}}
								>
									<p style={{ margin: '0', fontSize: '11px', fontWeight: 'bold', color: '#0073aa' }}>Address:</p>
									<p style={{ margin: '4px 0 0 0', fontSize: '12px', lineHeight: '1.4' }}>{markerAddress}</p>
								</div>
							)}

							<p style={{ margin: '0 0 12px 0', fontSize: '12px' }}>
								<strong>Coordinates:</strong>
								<br />
								Lat: {markerLat.toFixed(5)}
								<br />
								Lon: {markerLon.toFixed(5)}
							</p>

							<TextControl
								label='Marker Label (optional)'
								value={markerLabel}
								onChange={value => setAttributes({ markerLabel: value })}
								placeholder='Customize marker text'
								help='Leave empty to use the address'
								__next40pxDefaultSize
								__nextHasNoMarginBottom
							/>
							<Button
								variant='secondary'
								onClick={clearMarker}
								isDestructive
								style={{ marginTop: '8px', width: '100%' }}
							>
								Clear Marker
							</Button>
						</div>
					)}

					<div
						style={{
							marginTop: '16px',
							padding: '10px',
							background: '#fff3cd',
							borderRadius: '4px',
							border: '1px solid #ffc107',
						}}
					>
						<p style={{ margin: '0', fontSize: '12px', color: '#856404' }}>
							<strong>💡 Tip:</strong> Click to place a marker. Click and drag to pan the map.
						</p>
					</div>
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<MapErrorBoundary>
					<div className='newopm-map-container' style={{ height: height + 'px' }}>
						<MapContainer
							key={mapKey}
							center={center}
							zoom={zoom}
							style={{ height: '100%', width: '100%' }}
							scrollWheelZoom={true}
							dragging={true}
							touchZoom={true}
							doubleClickZoom={true}
							boxZoom={true}
							keyboard={true}
							trackResize={true}
						>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
								url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
							/>
							<MapLoadingHandler onMapReady={handleMapReady} />
							<ZoomSync zoom={zoom} />
							<FullscreenControl />
							<MapInteractionHandler onMapClick={handleMapClick} onZoomChange={handleZoomChange} />
							{markerPosition && (
								<DraggableMarker position={markerPosition} onDragEnd={handleMarkerDrag} label={markerLabel} />
							)}
						</MapContainer>
						{isMapLoading && (
							<div
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									backgroundColor: 'rgba(255, 255, 255, 0.9)',
									zIndex: 1000,
								}}
							>
								<div style={{ textAlign: 'center' }}>
									<div
										className='newopm-spinner'
										style={{
											width: '40px',
											height: '40px',
											border: '4px solid #f3f3f3',
											borderTop: '4px solid #2271b1',
											borderRadius: '50%',
											margin: '0 auto 12px',
										}}
									/>
									<p style={{ margin: 0, color: '#2271b1', fontSize: '14px', fontWeight: '500' }}>
										Loading map...
									</p>
								</div>
							</div>
						)}
					</div>
				</MapErrorBoundary>
			</div>
		</>
	);
}
