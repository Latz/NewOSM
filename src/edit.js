import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	PanelBody,
	TextControl,
	RangeControl,
	Button,
	SelectControl,
	Spinner,
	ToggleControl,
	Modal,
	ColorPalette,
	__experimentalConfirmDialog as ConfirmDialog,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import 'leaflet/dist/leaflet.css';
import { MARKER_COLOR_PALETTE } from './utils/markerIcons';

const MARKER_COLOR_OPTIONS = Object.entries(MARKER_COLOR_PALETTE).map(([name, color]) => ({ name, color }));

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
	getCacheKey(key) {
		return key;
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
	 * Make a rate-limited request to Nominatim via WordPress proxy
	 * @param {string} endpoint - The WordPress API endpoint
	 * @param {Object} params - Query parameters
	 * @param {AbortSignal} signal - Optional AbortController signal for request cancellation
	 */
	async request(endpoint, params, signal = null) {
		const cacheKey = this.getCacheKey(`${endpoint}?${JSON.stringify(params)}`);

		// Check cache first
		const cached = this.getCached(cacheKey);
		if (cached) {
			return cached;
		}

		// If there's a pending request for the same endpoint+params, wait for it
		const requestKey = `${endpoint}:${JSON.stringify(params)}`;
		if (this.pendingRequest && this.pendingRequest.key === requestKey) {
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

		// Check if aborted during wait
		if (signal && signal.aborted) {
			throw new DOMException('Request aborted', 'AbortError');
		}

		// Create the request promise
		const promise = (async () => {
			try {
				this.lastRequestTime = Date.now();

				const fetchOptions = {
					path: `${endpoint}?${new URLSearchParams(params).toString()}`,
					method: 'GET',
				};

				// Add signal if provided
				if (signal) {
					fetchOptions.signal = signal;
				}

				const data = await apiFetch(fetchOptions);

				// Cache the result
				this.setCache(cacheKey, data);

				return data;
			} catch (error) {
				// Handle rate limiting
				if (error.data && error.data.status === 429) {
					throw new Error('Rate limited. Please wait a moment before trying again.');
				}
				throw error;
			} finally {
				// Clear pending request
				if (this.pendingRequest && this.pendingRequest.key === requestKey) {
					this.pendingRequest = null;
				}
			}
		})();

		// Store as pending request
		this.pendingRequest = { key: requestKey, promise };

		return promise;
	}

	/**
	 * Search for a location
	 * @param {string} query - The search query
	 * @param {AbortSignal} signal - Optional AbortController signal for request cancellation
	 */
	async search(query, signal = null) {
		return this.request('/newopm/v1/nominatim/search', { q: query }, signal);
	}

	/**
	 * Reverse geocode coordinates
	 * @param {number} lat - Latitude
	 * @param {number} lon - Longitude
	 * @param {AbortSignal} signal - Optional AbortController signal for request cancellation
	 */
	async reverse(lat, lon, signal = null) {
		return this.request('/newopm/v1/nominatim/reverse', { lat, lon }, signal);
	}
}

// Create a singleton instance
const nominatimAPI = new NominatimRateLimiter();

// Size presets for the map
const SIZE_PRESETS = {
	small: { width: '300px', height: 200 },
	medium: { width: '100%', height: 400 },
	large: { width: '100%', height: 600 },
	fullscreen: { width: '100%', height: 800 },
};

/**
 * Generate a locally-unique id for a new multimarker marker entry.
 */
function generateMarkerId() {
	return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Custom pan handler that doesn't get stuck
export default function Edit({ attributes, setAttributes, isSelected }) {
	const {
		latitude,
		longitude,
		zoom,
		markerLat,
		markerLon,
		markerLabel,
		multimarker,
		markers,
		height,
		width,
		sizePreset,
		mapId,
	} = attributes;
	const [openPopupMarkerId, setOpenPopupMarkerId] = useState(null);
	const [isMultimarkerConfirmOpen, setIsMultimarkerConfirmOpen] = useState(false);
	const [isMarkerListOpen, setIsMarkerListOpen] = useState(false);

	// Kept in sync with the `markers` attribute so multimarker handlers can read/write
	// the latest array synchronously (avoids races between rapid consecutive edits and
	// React's async setAttributes/re-render cycle).
	const markersRef = useRef(markers || []);
	useEffect(() => {
		markersRef.current = markers || [];
	}, [markers]);
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [useCustomSize, setUseCustomSize] = useState(sizePreset === 'custom');
	const [isLoadingAddress, setIsLoadingAddress] = useState(false);
	const [markerAddress, setMarkerAddress] = useState('');
	const [isMapLoading, setIsMapLoading] = useState(true);

	// Track when block becomes selected to prevent immediate marker placement
	const selectionTimeRef = useRef(0);
	const isSelectedRef = useRef(isSelected);

	// Generate and store a unique map ID when block is first created
	// This ensures the ID stays consistent across saves and prevents block validation errors
	useEffect(() => {
		if (!mapId) {
			setAttributes({
				mapId: `newopm-map-${Math.random().toString(36).substring(2, 11)}`,
			});
		}
	}, []); // Empty dependency array = run once on mount

	// Track when block becomes selected to prevent marker placement on selection click
	useEffect(() => {
		// If block just became selected (was false, now true)
		if (!isSelectedRef.current && isSelected) {
			selectionTimeRef.current = Date.now();
		}
		isSelectedRef.current = isSelected;
	}, [isSelected]);

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

	// Load address for existing marker on editor mount
	useEffect(() => {
		const loadExistingMarkerAddress = async () => {
			// Only fetch if we have marker coordinates but no label or address yet
			if (markerLat && markerLon && !markerAddress) {
				setIsLoadingAddress(true);
				try {
					const data = await nominatimAPI.reverse(markerLat, markerLon);
					if (data && data.display_name) {
						setMarkerAddress(data.display_name);
						// Only update markerLabel if it's just coordinates or empty
						if (!markerLabel || markerLabel.startsWith('Lat:')) {
							setAttributes({
								markerLabel: data.display_name,
							});
						}
					}
				} catch (error) {
					console.error('Error loading marker address:', error);
				} finally {
					setIsLoadingAddress(false);
				}
			}
		};

		loadExistingMarkerAddress();
	}, []); // Run once on mount

	const blockProps = useBlockProps({
		style: {
			minHeight: height + 'px',
			width: width,
		},
	});

	const handleSearch = useCallback(async () => {
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
	}, [searchQuery, setAttributes, setMarkerAddress, setIsSearching]);

	// Adaptive debounced reverse geocoding to prevent rapid API calls during marker dragging
	// Uses shorter debounce for single interactions, longer for rapid changes
	const reverseGeocodeTimeout = useRef(null);
	const lastReverseGeocodeTime = useRef(0);
	const reverseGeocodeAbortController = useRef(null);

	const fetchAddress = useCallback(
		async (lat, lon) => {
			// Set marker immediately with coordinates
			const coordLabel = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
			setAttributes({
				markerLat: lat,
				markerLon: lon,
				markerLabel: coordLabel,
			});

			// Cancel any pending API request
			if (reverseGeocodeAbortController.current) {
				reverseGeocodeAbortController.current.abort();
			}

			// Clear any pending reverse geocode timeout
			if (reverseGeocodeTimeout.current) {
				clearTimeout(reverseGeocodeTimeout.current);
			}

			// Adaptive debouncing: Use shorter delay for first interaction,
			// longer delay for rapid changes to reduce API load
			const now = Date.now();
			const timeSinceLastRequest = now - lastReverseGeocodeTime.current;
			const isRapidChange = timeSinceLastRequest < 500;
			const debounceDelay = isRapidChange ? 1000 : 200; // 1s for rapid changes, 200ms for single interactions

			lastReverseGeocodeTime.current = now;

			// Debounce the reverse geocoding
			reverseGeocodeTimeout.current = setTimeout(async () => {
				setIsLoadingAddress(true);
				setMarkerAddress('');

				// Create new AbortController for this request
				reverseGeocodeAbortController.current = new AbortController();

				try {
					const data = await nominatimAPI.reverse(lat, lon, reverseGeocodeAbortController.current.signal);

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
					// Ignore abort errors (expected when user is still interacting)
					if (error.name === 'AbortError') {
						return;
					}
					console.error('Reverse geocoding error:', error);
					setMarkerAddress('');
					// Don't show alert for reverse geocoding errors to avoid interrupting user workflow
				} finally {
					setIsLoadingAddress(false);
				}
			}, debounceDelay);
		},
		[setAttributes]
	);

	// --- Multimarker: per-marker state updates + debounced reverse geocoding ---
	// Mirrors the single-marker fetchAddress logic above, but keyed by marker id and
	// writing into the `markers` array instead of the singular markerLat/markerLon/markerLabel
	// attributes. Kept separate from fetchAddress (rather than a single generalized function)
	// to avoid any risk of regressing the existing, already-working single-marker path.
	const reverseGeocodeTimeoutsById = useRef({});
	const lastReverseGeocodeTimesById = useRef({});
	const reverseGeocodeAbortControllersById = useRef({});

	/**
	 * Immutably update one marker's fields (by id) in the `markers` attribute.
	 * @param {string} markerId
	 * @param {Object} fields - Partial marker fields to merge, e.g. { lat, lon, label }
	 */
	const updateMarkerFields = useCallback(
		(markerId, fields) => {
			const next = markersRef.current.map(m => (m.id === markerId ? { ...m, ...fields } : m));
			markersRef.current = next;
			setAttributes({ markers: next });
		},
		[setAttributes]
	);

	/**
	 * Debounced reverse-geocode for a single multimarker marker; sets coordinates
	 * immediately, then replaces the label with the resolved address once available.
	 * @param {string} markerId
	 * @param {number} lat
	 * @param {number} lon
	 */
	const fetchAddressForMarker = useCallback(
		(markerId, lat, lon) => {
			const coordLabel = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
			updateMarkerFields(markerId, { lat, lon, label: coordLabel });

			if (reverseGeocodeAbortControllersById.current[markerId]) {
				reverseGeocodeAbortControllersById.current[markerId].abort();
			}
			if (reverseGeocodeTimeoutsById.current[markerId]) {
				clearTimeout(reverseGeocodeTimeoutsById.current[markerId]);
			}

			const now = Date.now();
			const timeSinceLastRequest = now - (lastReverseGeocodeTimesById.current[markerId] || 0);
			const isRapidChange = timeSinceLastRequest < 500;
			const debounceDelay = isRapidChange ? 1000 : 200;
			lastReverseGeocodeTimesById.current[markerId] = now;

			reverseGeocodeTimeoutsById.current[markerId] = setTimeout(async () => {
				const controller = new AbortController();
				reverseGeocodeAbortControllersById.current[markerId] = controller;

				try {
					const data = await nominatimAPI.reverse(lat, lon, controller.signal);
					if (data && data.display_name) {
						updateMarkerFields(markerId, { lat, lon, label: data.display_name });
					}
				} catch (error) {
					if (error.name === 'AbortError') {
						return;
					}
					console.error('Reverse geocoding error:', error);
				}
			}, debounceDelay);
		},
		[updateMarkerFields]
	);

	/**
	 * @listens MapEditor#onMapClick (multimarker mode) - adds a new marker at the clicked point
	 */
	const handleMapClickMulti = useCallback(
		latlng => {
			const timeSinceSelection = Date.now() - selectionTimeRef.current;
			if (timeSinceSelection < 150) {
				return;
			}
			if (!isSelectedRef.current) {
				return;
			}

			const newId = generateMarkerId();
			const nextMarkers = [...markersRef.current, { id: newId, lat: latlng.lat, lon: latlng.lng, label: '', color: 'blue' }];
			markersRef.current = nextMarkers;
			setAttributes({ markers: nextMarkers });
			fetchAddressForMarker(newId, latlng.lat, latlng.lng);
		},
		[setAttributes, fetchAddressForMarker]
	);

	/**
	 * @listens MapEditor#onMarkerDragEnd (multimarker mode) - re-geocodes after a marker is moved
	 */
	const handleMarkerDragEndMulti = useCallback(
		(markerId, latlng) => {
			fetchAddressForMarker(markerId, latlng.lat, latlng.lng);
		},
		[fetchAddressForMarker]
	);

	/**
	 * @listens MapEditor#onMarkerClick (multimarker mode) - toggles that marker's options popup
	 */
	const handleMarkerClick = useCallback(markerId => {
		setOpenPopupMarkerId(current => (current === markerId ? null : markerId));
	}, []);

	const handleMarkerLabelChange = useCallback(
		(markerId, label) => {
			updateMarkerFields(markerId, { label });
		},
		[updateMarkerFields]
	);

	const handleMarkerColorChange = useCallback(
		(markerId, color) => {
			updateMarkerFields(markerId, { color });
		},
		[updateMarkerFields]
	);

	const handleMarkerDelete = useCallback(
		markerId => {
			const next = markersRef.current.filter(m => m.id !== markerId);
			markersRef.current = next;
			setAttributes({ markers: next });
			setOpenPopupMarkerId(current => (current === markerId ? null : current));

			if (reverseGeocodeTimeoutsById.current[markerId]) {
				clearTimeout(reverseGeocodeTimeoutsById.current[markerId]);
				delete reverseGeocodeTimeoutsById.current[markerId];
			}
			if (reverseGeocodeAbortControllersById.current[markerId]) {
				reverseGeocodeAbortControllersById.current[markerId].abort();
				delete reverseGeocodeAbortControllersById.current[markerId];
			}
			delete lastReverseGeocodeTimesById.current[markerId];
		},
		[setAttributes]
	);

	/**
	 * @listens ToggleControl#onChange - toggles multimarker mode; auto-migrates an existing
	 * legacy single marker into `markers[0]` the first time it's switched on, so it isn't lost.
	 */
	const handleMultimarkerToggle = useCallback(
		value => {
			if (value && markersRef.current.length === 0 && typeof markerLat === 'number' && typeof markerLon === 'number') {
				const migrated = [{ id: generateMarkerId(), lat: markerLat, lon: markerLon, label: markerLabel, color: 'blue' }];
				markersRef.current = migrated;
				setAttributes({ multimarker: value, markers: migrated });
			} else if (!value && markersRef.current.length > 0) {
				// Warn via WP's ConfirmDialog that the map will visually lose its markers.
				// Actual disabling (and whether `markers` survives) happens in the dialog's
				// onConfirm/onCancel handlers below.
				setIsMultimarkerConfirmOpen(true);
			} else {
				setAttributes({ multimarker: value });
			}
		},
		[setAttributes, markerLat, markerLon, markerLabel]
	);

	const handleConfirmDisableMultimarker = useCallback(() => {
		setIsMultimarkerConfirmOpen(false);
		// `markers` is deliberately left untouched - it stays in the block's saved
		// attributes so every marker silently reappears if multimarker is re-enabled.
		setAttributes({ multimarker: false });
	}, [setAttributes]);

	const handleCancelDisableMultimarker = useCallback(() => {
		setIsMultimarkerConfirmOpen(false);
	}, []);

	// Cleanup debounce timeouts and abort controllers on unmount
	useEffect(() => {
		return () => {
			if (reverseGeocodeTimeout.current) {
				clearTimeout(reverseGeocodeTimeout.current);
			}
			if (reverseGeocodeAbortController.current) {
				reverseGeocodeAbortController.current.abort();
			}
			if (zoomTimeoutRef.current) {
				clearTimeout(zoomTimeoutRef.current);
			}
			if (centerTimeoutRef.current) {
				clearTimeout(centerTimeoutRef.current);
			}
			Object.values(reverseGeocodeTimeoutsById.current).forEach(clearTimeout);
			Object.values(reverseGeocodeAbortControllersById.current).forEach(controller => controller.abort());
		};
	}, []);

	const handleMapClick = useCallback(
		latlng => {
			// Prevent marker placement if block was just selected (within 150ms)
			// This prevents the selection click from also placing a marker
			const timeSinceSelection = Date.now() - selectionTimeRef.current;
			if (timeSinceSelection < 150) {
				return;
			}

			// Only place marker if block is currently selected
			if (!isSelectedRef.current) {
				return;
			}

			fetchAddress(latlng.lat, latlng.lng);
		},
		[fetchAddress]
	);

	const handleMarkerDrag = useCallback(
		latlng => {
			fetchAddress(latlng.lat, latlng.lng);
		},
		[fetchAddress]
	);

	/**
	 * @listens MapEditor#onMapClick - branches to single- or multi-marker placement
	 */
	const handleMapClickCombined = useCallback(
		latlng => {
			if (multimarker) {
				handleMapClickMulti(latlng);
			} else {
				handleMapClick(latlng);
			}
		},
		[multimarker, handleMapClickMulti, handleMapClick]
	);

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

	// Debounce center changes to reduce attribute updates during panning
	const centerTimeoutRef = useRef(null);
	const handleCenterChange = useCallback(
		newCenter => {
			if (centerTimeoutRef.current) {
				clearTimeout(centerTimeoutRef.current);
			}
			centerTimeoutRef.current = setTimeout(() => {
				setAttributes({
					latitude: newCenter.lat,
					longitude: newCenter.lng,
				});
			}, 150);
		},
		[setAttributes]
	);

	const clearMarker = useCallback(() => {
		setAttributes({
			markerLat: undefined,
			markerLon: undefined,
			markerLabel: '',
		});
	}, [setAttributes]);

	const handleSizePresetChange = useCallback(
		preset => {
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
		},
		[setAttributes, setUseCustomSize]
	);

	const saveAsDefault = useCallback(async () => {
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
	}, [sizePreset, height, width, zoom, latitude, longitude, markerLat, markerLon, markerLabel]);

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

					<ToggleControl
						label={__('Multimarker', 'newopm')}
						checked={!!multimarker}
						onChange={handleMultimarkerToggle}
						help={__('Allow placing multiple markers; edit each one via its popup on the map.', 'newopm')}
						__nextHasNoMarginBottom
					/>

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

					{!multimarker && markerPosition && (
						<div style={{ marginTop: '12px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
							<p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>Marker Position</p>

							{isLoadingAddress && (
								<p style={{ margin: '0 0 8px 0', fontSize: '12px', fontStyle: 'italic', color: '#666' }}>
									Loading address...
								</p>
							)}

							{markerAddress ? (
								<p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: '1.4' }}>
									{markerAddress}
									<br />
									<span style={{ fontSize: '11px', color: '#666' }}>
										({markerLat.toFixed(5)}, {markerLon.toFixed(5)})
									</span>
								</p>
							) : !isLoadingAddress && (
								<p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#666' }}>
									Lat: {markerLat.toFixed(5)}, Lon: {markerLon.toFixed(5)}
								</p>
							)}

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

					{multimarker && (
						<div style={{ marginTop: '12px', padding: '12px', background: '#f0f0f0', borderRadius: '4px' }}>
							<p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>
								{(markers || []).length === 1
									? __('1 marker', 'newopm')
									: sprintf(__('%d markers', 'newopm'), (markers || []).length)}
							</p>
							<p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
								{__('Click a marker on the map to edit its label and color, or delete it.', 'newopm')}
							</p>
							{(markers || []).length > 0 && (
								<Button variant='secondary' onClick={() => setIsMarkerListOpen(true)} style={{ width: '100%' }}>
									{__('Manage All Markers', 'newopm')}
								</Button>
							)}
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
							<strong>💡 Tip:</strong>{' '}
							{multimarker
								? __('Click empty map area to add a marker. Click a marker to edit it. Press and hold a marker to move it. Click and drag empty area to pan the map.', 'newopm')
								: __('Click to place a marker. Click and drag to pan the map.', 'newopm')}
						</p>
					</div>
				</PanelBody>
			</InspectorControls>

			<ConfirmDialog
				isOpen={isMultimarkerConfirmOpen}
				onConfirm={handleConfirmDisableMultimarker}
				onCancel={handleCancelDisableMultimarker}
			>
				{__('Achtung! Alle Marker werden entfernt!', 'newopm')}
			</ConfirmDialog>

			{isMarkerListOpen && (
				<Modal
					title={sprintf(__('Manage Markers (%d)', 'newopm'), (markers || []).length)}
					onRequestClose={() => setIsMarkerListOpen(false)}
					style={{ width: '600px', maxWidth: '90vw' }}
				>
					{(markers || []).length === 0 ? (
						<p>{__('No markers yet. Click the map to add one.', 'newopm')}</p>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
							{(markers || []).map((marker, index) => (
								<div
									key={marker.id}
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: '12px',
										padding: '12px',
										border: '1px solid #ddd',
										borderRadius: '4px',
									}}
								>
									<div style={{ flex: 1, minWidth: 0 }}>
										<TextControl
											label={sprintf(__('Marker %d Label', 'newopm'), index + 1)}
											value={marker.label || ''}
											onChange={value => handleMarkerLabelChange(marker.id, value)}
											__next40pxDefaultSize
											__nextHasNoMarginBottom
										/>
										<p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#666' }}>
											{`Lat: ${marker.lat.toFixed(5)}, Lon: ${marker.lon.toFixed(5)}`}
										</p>
										<ColorPalette
											colors={MARKER_COLOR_OPTIONS}
											value={MARKER_COLOR_PALETTE[marker.color] || MARKER_COLOR_PALETTE.blue}
											onChange={colorValue => {
												const match = MARKER_COLOR_OPTIONS.find(option => option.color === colorValue);
												handleMarkerColorChange(marker.id, match ? match.name : 'blue');
											}}
											disableCustomColors
											clearable={false}
										/>
									</div>
									<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
										<Button
											variant='tertiary'
											onClick={() => {
												setOpenPopupMarkerId(marker.id);
												setIsMarkerListOpen(false);
											}}
										>
											{__('Locate', 'newopm')}
										</Button>
										<Button variant='secondary' isDestructive onClick={() => handleMarkerDelete(marker.id)}>
											{__('Delete', 'newopm')}
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</Modal>
			)}

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
								<p style={{ marginTop: '16px', color: '#666' }}>{__('Loading map editor...', 'newopm')}</p>
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
						isSelected={isSelected}
						onMapClick={handleMapClickCombined}
						onZoomChange={handleZoomChange}
						onCenterChange={handleCenterChange}
						onMarkerDrag={handleMarkerDrag}
						onMapReady={handleMapReady}
						multimarker={!!multimarker}
						markers={markers || []}
						openPopupMarkerId={openPopupMarkerId}
						onMarkerClick={handleMarkerClick}
						onMarkerDragEnd={handleMarkerDragEndMulti}
						onMarkerLabelChange={handleMarkerLabelChange}
						onMarkerColorChange={handleMarkerColorChange}
						onMarkerDelete={handleMarkerDelete}
					/>
				</Suspense>
			</div>
		</>
	);
}
