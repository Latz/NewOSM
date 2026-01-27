import { useState, useEffect, useRef, useCallback, lazy, Suspense } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, TextControl, RangeControl, Button, SelectControl, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';

// Lazy load the heavy map editor component
// This improves initial editor load time by deferring ~440KB of Leaflet code
const MapEditor = lazy(() => import('./components/MapEditor'));

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
export default function Edit({ attributes, setAttributes }) {
	const { latitude, longitude, zoom, markerLat, markerLon, markerLabel, height, width, sizePreset } = attributes;
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [useCustomSize, setUseCustomSize] = useState(sizePreset === 'custom');
	const [isLoadingAddress, setIsLoadingAddress] = useState(false);
	const [markerAddress, setMarkerAddress] = useState('');
	const [isMapLoading, setIsMapLoading] = useState(true);

	// Apply saved defaults on first load
	useEffect(() => {
		const loadDefaults = async () => {
			if (attributes.customDefaultsApplied) {
				return;
			}

			try {
				const defaults = await apiFetch({
					path: '/newopm/v1/defaults',
					method: 'GET',
				});

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

				if (Object.keys(updates).length > 1) {
					setAttributes(updates);
					// Map will automatically re-center via MapViewSync component
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
				// Map will automatically re-center via MapViewSync component
			} else {
				dispatch('core/notices').createNotice(
					'warning',
					__('Location not found. Please try a different search term.', 'newopm'),
					{
						type: 'snackbar',
						isDismissible: true,
					}
				);
			}
		} catch (error) {
			console.error('Search error:', error);
			// Provide more specific error message
			const errorMessage = error.message.includes('Rate limited')
				? error.message
				: __('Error searching for location. Please try again in a moment.', 'newopm');
			dispatch('core/notices').createNotice('error', errorMessage, {
				type: 'snackbar',
				isDismissible: true,
			});
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

	// Cleanup debounce timeouts on unmount
	useEffect(() => {
		return () => {
			if (reverseGeocodeTimeout.current) {
				clearTimeout(reverseGeocodeTimeout.current);
			}
			if (zoomTimeoutRef.current) {
				clearTimeout(zoomTimeoutRef.current);
			}
		};
	}, []);

	const handleMapClick = latlng => {
		fetchAddress(latlng.lat, latlng.lng);
	};

	const handleMarkerDrag = latlng => {
		fetchAddress(latlng.lat, latlng.lng);
	};

	// Debounce zoom changes to reduce attribute updates during zoom animation
	const zoomTimeoutRef = useRef(null);
	const handleZoomChange = useCallback(
		newZoom => {
			if (zoomTimeoutRef.current) {
				clearTimeout(zoomTimeoutRef.current);
			}
			zoomTimeoutRef.current = setTimeout(() => {
				setAttributes({ zoom: newZoom });
			}, 150);
		},
		[setAttributes]
	);

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

			if (data.success) {
				dispatch('core/notices').createNotice(
					'success',
					data.message || __('Default settings saved successfully!', 'newopm'),
					{
						type: 'snackbar',
						isDismissible: true,
					}
				);
			} else {
				dispatch('core/notices').createNotice(
					'warning',
					__('Settings may not have been saved. Check console for details.', 'newopm'),
					{
						type: 'snackbar',
						isDismissible: true,
					}
				);
			}
		} catch (error) {
			console.error('Error saving defaults:', error);
			console.error('Error details:', error.message, error.data);
			dispatch('core/notices').createNotice(
				'error',
				__('Error saving defaults: ', 'newopm') + (error.message || __('Unknown error', 'newopm')),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		}
	};

	// Memoize expensive calculations to prevent unnecessary re-renders
	const center = useMemo(() => [latitude, longitude], [latitude, longitude]);
	const markerPosition = useMemo(
		() => (markerLat && markerLon ? [markerLat, markerLon] : null),
		[markerLat, markerLon]
	);

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
				<Suspense
					fallback={
						<div
							style={{
								height: height + 'px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								backgroundColor: '#f0f0f0',
							}}
						>
							<div style={{ textAlign: 'center' }}>
								<Spinner />
								<p style={{ marginTop: '16px', color: '#666' }}>
									{__('Loading map editor...', 'newopm')}
								</p>
							</div>
						</div>
					}
				>
					<MapEditor
						center={center}
						zoom={zoom}
						markerPosition={markerPosition}
						markerLabel={markerLabel}
						height={height}
						isMapLoading={isMapLoading}
						onMapClick={handleMapClick}
						onZoomChange={handleZoomChange}
						onMarkerDrag={handleMarkerDrag}
						onMapReady={handleMapReady}
					/>
				</Suspense>
			</div>
		</>
	);
}
