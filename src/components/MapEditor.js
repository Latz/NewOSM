/**
 * MapEditor Component - Lazy loaded map editor
 *
 * This component contains all the heavy Leaflet dependencies and is lazy-loaded
 * to improve initial editor load time. It's only loaded when the block is inserted.
 */

import { Component, useEffect, useRef, useState, useMemo, useCallback } from '@wordpress/element';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { __ } from '@wordpress/i18n';
import { TextControl, Button, ColorPalette } from '@wordpress/components';
import L from 'leaflet';
import { FullScreen } from 'leaflet.fullscreen';
import 'leaflet.fullscreen/dist/Control.FullScreen.css';
import { applySVGMarkerIcons, createMarkerIcon, MARKER_COLOR_PALETTE } from '../utils/markerIcons';
import { getEditorTileConfig } from '../utils/devicePerformance';

const MARKER_COLOR_OPTIONS = Object.entries(MARKER_COLOR_PALETTE).map(([name, color]) => ({ name, color }));

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 5;

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
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		console.error('Map component error:', error, errorInfo);
		this.setState({
			error,
			errorInfo,
		});
	}

	handleReset = () => {
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
					<h3 style={{ margin: '0 0 12px 0', color: '#dc3232' }}>{__('Map Failed to Load', 'newopm')}</h3>
					<p style={{ margin: '0 0 12px 0' }}>
						{__('The map component encountered an error and could not be displayed. This may be due to:', 'newopm')}
					</p>
					<ul style={{ margin: '0 0 16px 20px' }}>
						<li>{__('Network connectivity issues', 'newopm')}</li>
						<li>{__('Leaflet library failed to load', 'newopm')}</li>
						<li>{__('Invalid map configuration', 'newopm')}</li>
						<li>{__('Browser compatibility issues', 'newopm')}</li>
					</ul>
					{this.state.error && (
						<details style={{ marginBottom: '16px' }}>
							<summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
								{__('Error Details (for debugging)', 'newopm')}
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
							{__('Try Again', 'newopm')}
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
							{__('Reload Page', 'newopm')}
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// Apply SVG marker icons to eliminate HTTP requests for PNG files
// See FUTURE_OPTIMIZATIONS.md #5 - Optimize Marker Icons
applySVGMarkerIcons(L);

/**
 * Component to handle map interactions (clicks, zoom changes, and - in multimarker
 * mode - per-marker hover/click/long-press-drag vs. whole-map panning)
 */
function MapInteractionHandler({
	onMapClick,
	onZoomChange,
	onCenterChange,
	isSelected,
	multimarker,
	markerRefsRef,
	onMarkerClick,
	onMarkerDragEnd,
}) {
	const map = useMap();
	const isDraggingRef = useRef(false);
	const dragStartRef = useRef(null);
	const initialCenterRef = useRef(null);

	// Multimarker long-press-to-drag state
	const longPressTimerRef = useRef(null);
	const longPressTargetRef = useRef(null); // { markerId, startX, startY }
	const markerDragModeRef = useRef(false);
	const markerDragStartLatLngRef = useRef(null);

	useEffect(() => {
		if (!map) return;

		// Disable default dragging behavior
		map.dragging.disable();

		// Handle zoom changes
		const handleZoomEnd = () => {
			const zoom = map.getZoom();
			onZoomChange(zoom);
		};

		// Handle center changes from panning
		const handleMoveEnd = () => {
			if (onCenterChange) {
				const center = map.getCenter();
				onCenterChange(center);
			}
		};

		map.on('zoomend', handleZoomEnd);
		map.on('moveend', handleMoveEnd);

		// Custom drag implementation
		const mapContainer = map.getContainer();
		const defaultCursor = isSelected ? 'crosshair' : 'default';

		const clearLongPressState = () => {
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}
			longPressTargetRef.current = null;
			markerDragModeRef.current = false;
			markerDragStartLatLngRef.current = null;
		};

		const handleMouseDown = e => {
			const markerEl = multimarker ? e.target.closest('[data-marker-id]') : null;

			// Marker mousedown in multimarker mode: start long-press timer instead of panning
			if (markerEl) {
				longPressTargetRef.current = {
					markerId: markerEl.dataset.markerId,
					startX: e.clientX,
					startY: e.clientY,
				};
				longPressTimerRef.current = setTimeout(() => {
					// Set drag mode first, unconditionally - it must never be skipped just
					// because the (optional, smoothness-only) start-position capture below
					// fails for some reason, or dragging would silently stop working.
					markerDragModeRef.current = true;
					mapContainer.style.cursor = 'grabbing';

					const target = longPressTargetRef.current;
					const markerInstance = target && markerRefsRef?.current?.[target.markerId];
					if (markerInstance) {
						markerDragStartLatLngRef.current = markerInstance.getLatLng();
					}
				}, LONG_PRESS_MS);
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			// Don't initiate map pan on marker (single-marker mode, or click missed data-marker-id)
			if (e.target.classList.contains('leaflet-marker-icon')) {
				return;
			}

			isDraggingRef.current = false;
			dragStartRef.current = { x: e.clientX, y: e.clientY };
			initialCenterRef.current = map.getCenter();
			e.preventDefault();
		};

		const handleMouseMove = e => {
			// Multimarker: pending long-press on a marker - promote straight to dragging the
			// moment the user moves past the threshold, instead of waiting out the full
			// LONG_PRESS_MS timer first. A real press-and-drag gesture always involves some
			// movement before the timer would fire; requiring perfect stillness first meant
			// dragging almost never actually engaged (movement cancelled it outright, and the
			// mouseup then fell through to "click on empty map", placing a stray new marker).
			// The timer remains as a secondary path for holding still before moving.
			if (longPressTargetRef.current && !markerDragModeRef.current) {
				const target = longPressTargetRef.current;
				const dx = e.clientX - target.startX;
				const dy = e.clientY - target.startY;
				if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
					if (longPressTimerRef.current) {
						clearTimeout(longPressTimerRef.current);
						longPressTimerRef.current = null;
					}
					markerDragModeRef.current = true;
					mapContainer.style.cursor = 'grabbing';
					const markerInstance = markerRefsRef?.current?.[target.markerId];
					if (markerInstance) {
						markerDragStartLatLngRef.current = markerInstance.getLatLng();
					}
					// Fall through to the "actively dragging" branch below so this same
					// move event already repositions the marker - no missed first frame.
				} else {
					return;
				}
			}

			// Multimarker: actively dragging a marker - move it live, don't pan.
			// Uses the pixel delta since drag start (like map panning below), not an
			// absolute cursor->latlng snap, so the marker doesn't jump to the exact
			// cursor position (which rarely matches the icon's anchor point) at drag start.
			// Falls back to the absolute cursor position if the start position wasn't
			// captured for some reason, so dragging always moves the marker regardless.
			if (markerDragModeRef.current && longPressTargetRef.current) {
				const { startX, startY, markerId } = longPressTargetRef.current;
				const markerInstance = markerRefsRef?.current?.[markerId];
				if (!markerInstance) return;

				let newLatLng;
				if (markerDragStartLatLngRef.current) {
					const dx = e.clientX - startX;
					const dy = e.clientY - startY;
					const startPoint = map.project(markerDragStartLatLngRef.current, map.getZoom());
					const newPoint = L.point(startPoint.x + dx, startPoint.y + dy);
					newLatLng = map.unproject(newPoint, map.getZoom());
				} else {
					newLatLng = map.mouseEventToLatLng(e);
				}

				markerInstance.setLatLng(newLatLng);
				return;
			}

			if (!dragStartRef.current) return;

			const dx = e.clientX - dragStartRef.current.x;
			const dy = e.clientY - dragStartRef.current.y;

			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				if (!isDraggingRef.current) {
					mapContainer.style.cursor = 'grab';
					setTimeout(() => {
						if (dragStartRef.current) {
							mapContainer.style.cursor = 'grabbing';
						}
					}, 50);
				}
				isDraggingRef.current = true;

				const currentPoint = map.project(initialCenterRef.current, map.getZoom());
				const newPoint = L.point(currentPoint.x - dx, currentPoint.y - dy);
				const newCenter = map.unproject(newPoint, map.getZoom());

				map.setView(newCenter, map.getZoom(), { animate: false });
			}
		};

		const handleMouseUp = e => {
			// Multimarker: finish a marker drag - compute the final position the same
			// delta-based way as the live drag above (with the same fallback), so the
			// saved position matches exactly where the marker visually ended up.
			if (markerDragModeRef.current && longPressTargetRef.current) {
				const { startX, startY, markerId } = longPressTargetRef.current;

				let newLatLng;
				if (markerDragStartLatLngRef.current) {
					const dx = e.clientX - startX;
					const dy = e.clientY - startY;
					const startPoint = map.project(markerDragStartLatLngRef.current, map.getZoom());
					const newPoint = L.point(startPoint.x + dx, startPoint.y + dy);
					newLatLng = map.unproject(newPoint, map.getZoom());
				} else {
					newLatLng = map.mouseEventToLatLng(e);
				}

				clearLongPressState();
				mapContainer.style.cursor = defaultCursor;
				onMarkerDragEnd(markerId, newLatLng);
				return;
			}

			// Multimarker: released before long-press fired and didn't move = a click on the marker
			if (longPressTargetRef.current) {
				const markerId = longPressTargetRef.current.markerId;
				clearLongPressState();
				onMarkerClick(markerId);
				return;
			}

			const wasDragging = isDraggingRef.current;
			isDraggingRef.current = false;
			dragStartRef.current = null;
			initialCenterRef.current = null;
			mapContainer.style.cursor = defaultCursor;

			if (!wasDragging && e.target.classList.contains('leaflet-container')) {
				const latlng = map.mouseEventToLatLng(e);
				onMapClick(latlng);
			}
		};

		const handleMouseLeave = () => {
			clearLongPressState();
			isDraggingRef.current = false;
			dragStartRef.current = null;
			initialCenterRef.current = null;
			mapContainer.style.cursor = defaultCursor;
		};

		mapContainer.addEventListener('mousedown', handleMouseDown);
		mapContainer.addEventListener('mousemove', handleMouseMove);
		mapContainer.addEventListener('mouseup', handleMouseUp);
		mapContainer.addEventListener('mouseleave', handleMouseLeave);
		mapContainer.style.cursor = defaultCursor;

		const handleGlobalMouseUp = () => {
			clearLongPressState();
			isDraggingRef.current = false;
			dragStartRef.current = null;
			initialCenterRef.current = null;
			mapContainer.style.cursor = defaultCursor;
		};

		document.addEventListener('mouseup', handleGlobalMouseUp);

		return () => {
			clearLongPressState();
			mapContainer.removeEventListener('mousedown', handleMouseDown);
			mapContainer.removeEventListener('mousemove', handleMouseMove);
			mapContainer.removeEventListener('mouseup', handleMouseUp);
			mapContainer.removeEventListener('mouseleave', handleMouseLeave);
			document.removeEventListener('mouseup', handleGlobalMouseUp);
			map.off('zoomend', handleZoomEnd);
			map.off('moveend', handleMoveEnd);
			if (map.dragging) {
				map.dragging.enable();
			}
		};
	}, [map, onMapClick, onZoomChange, onCenterChange, isSelected, multimarker, markerRefsRef, onMarkerClick, onMarkerDragEnd]);

	return null;
}

/**
 * Draggable marker component
 */
function DraggableMarker({ position, onDragEnd, label }) {
	const [markerRef, setMarkerRef] = useState(null);

	const eventHandlers = useMemo(
		() => ({
			dragend() {
				if (markerRef != null) {
					const latlng = markerRef.getLatLng();
					onDragEnd(latlng);
				}
			},
		}),
		[markerRef, onDragEnd]
	);

	return (
		<Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={setMarkerRef}>
			<Popup>{label || `Lat: ${position.lat.toFixed(5)}, Lon: ${position.lng.toFixed(5)}`}</Popup>
		</Marker>
	);
}

/**
 * A single marker in multimarker mode. Click/long-press-drag are handled centrally by
 * MapInteractionHandler (via the marker's data-marker-id DOM attribute), not by react-leaflet's
 * own drag/click handlers, to keep one source of truth for gesture disambiguation. The popup
 * holds the per-marker options (label, color, delete) that replace the sidebar UI used in
 * single-marker mode.
 * @param {Object}   props
 * @param {Object}   props.marker         - { id, lat, lon, label, color }
 * @param {boolean}  props.isPopupOpen    - Whether this marker's popup should be open
 * @param {Function} props.registerRef    - (markerId, leafletMarkerInstance|null) => void
 * @param {Function} props.onLabelChange  - (markerId, label) => void
 * @param {Function} props.onColorChange  - (markerId, color) => void
 * @param {Function} props.onDelete       - (markerId) => void
 */
function MultiMarker({ marker, isPopupOpen, registerRef, onLabelChange, onColorChange, onDelete }) {
	const [markerRef, setMarkerRef] = useState(null);
	const icon = useMemo(() => createMarkerIcon({ color: marker.color, markerId: marker.id }), [marker.color, marker.id]);

	useEffect(() => {
		registerRef(marker.id, markerRef);
		return () => registerRef(marker.id, null);
	}, [marker.id, markerRef, registerRef]);

	useEffect(() => {
		if (!markerRef) return;
		// bindPopup() (implicit via the <Popup> child) auto-attaches its own native
		// 'click' -> togglePopup() listener. We already dispatch marker clicks
		// ourselves via MapInteractionHandler (onMarkerClick) to disambiguate them
		// from long-press-drag, so remove Leaflet's listener to avoid a double-toggle -
		// visible as the popup's autoPan fighting itself (map jitters) near map edges.
		markerRef.off('click');
	}, [markerRef]);

	useEffect(() => {
		if (!markerRef) return;
		if (isPopupOpen) {
			markerRef.openPopup();
		} else {
			markerRef.closePopup();
		}
	}, [isPopupOpen, markerRef]);

	return (
		<Marker position={[marker.lat, marker.lon]} icon={icon} ref={setMarkerRef}>
			<Popup>
				<div className='newopm-marker-popup'>
					<TextControl
						label={__('Marker Label', 'newopm')}
						value={marker.label || ''}
						onChange={value => onLabelChange(marker.id, value)}
						placeholder={__('Customize marker text', 'newopm')}
						__next40pxDefaultSize
						__nextHasNoMarginBottom
					/>
					<ColorPalette
						colors={MARKER_COLOR_OPTIONS}
						value={MARKER_COLOR_PALETTE[marker.color] || MARKER_COLOR_PALETTE.blue}
						onChange={colorValue => {
							const match = MARKER_COLOR_OPTIONS.find(option => option.color === colorValue);
							onColorChange(marker.id, match ? match.name : 'blue');
						}}
						disableCustomColors
						clearable={false}
					/>
					<Button
						isDestructive
						variant='secondary'
						onClick={() => onDelete(marker.id)}
						style={{ marginTop: '8px', width: '100%' }}
					>
						{__('Delete Marker', 'newopm')}
					</Button>
				</div>
			</Popup>
		</Marker>
	);
}

/**
 * Component to sync map view with props
 */
function MapViewSync({ center, zoom }) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		map.whenReady(() => {
			const currentCenter = map.getCenter();
			const currentZoom = map.getZoom();

			if (
				Math.abs(currentCenter.lat - center[0]) > 0.0001 ||
				Math.abs(currentCenter.lng - center[1]) > 0.0001 ||
				currentZoom !== zoom
			) {
				map.setView(center, zoom, { animate: true });
				// Ensure tiles load after view change
				setTimeout(() => map.invalidateSize(), 100);
			}
		});
	}, [map, center, zoom]);

	return null;
}

/**
 * Component to handle map loading state
 */
function MapLoadingHandler({ onMapReady }) {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		map.whenReady(() => {
			// Force map to recalculate size after lazy loading
			setTimeout(() => {
				map.invalidateSize();

				// Load tiles that might have been missed
				setTimeout(() => {
					map.invalidateSize();
					if (onMapReady) {
						onMapReady();
					}
				}, 100);
			}, 50);
		});
	}, [map, onMapReady]);

	return null;
}

/**
 * Fullscreen control component
 */
function FullscreenControl() {
	const map = useMap();

	useEffect(() => {
		if (!map) return;

		// Add the leaflet.fullscreen control
		const fullscreenControl = new FullScreen({
			position: 'topright',
			title: 'Show fullscreen',
			titleCancel: 'Exit fullscreen',
			forceSeparateButton: true,
		});

		map.addControl(fullscreenControl);

		// Handle map resize on fullscreen change
		const handleResize = () => {
			setTimeout(() => {
				if (map) {
					map.invalidateSize();
				}
			}, 100);
		};

		map.on('enterFullscreen', handleResize);
		map.on('exitFullscreen', handleResize);

		return () => {
			map.off('enterFullscreen', handleResize);
			map.off('exitFullscreen', handleResize);
			map.removeControl(fullscreenControl);
		};
	}, [map]);

	return null;
}

/**
 * Main MapEditor Component
 */
export default function MapEditor({
	center,
	zoom,
	markerPosition,
	markerLabel,
	height,
	isMapLoading,
	isSelected,
	onMapClick,
	onZoomChange,
	onCenterChange,
	onMarkerDrag,
	onMapReady,
	multimarker,
	markers,
	openPopupMarkerId,
	onMarkerClick,
	onMarkerDragEnd,
	onMarkerLabelChange,
	onMarkerColorChange,
	onMarkerDelete,
}) {
	// Get optimal tile configuration based on device performance
	// See FUTURE_OPTIMIZATIONS.md #3 - Virtualize Tile Rendering
	const tileConfig = useMemo(() => getEditorTileConfig(), []);

	// Registry of live Leaflet marker instances, keyed by marker id, so
	// MapInteractionHandler can move a marker directly during a long-press-drag
	// without waiting for a React re-render on every mousemove.
	const markerRefsRef = useRef({});
	const registerMarkerRef = useCallback((markerId, instance) => {
		if (instance) {
			markerRefsRef.current[markerId] = instance;
		} else {
			delete markerRefsRef.current[markerId];
		}
	}, []);

	return (
		<MapErrorBoundary>
			<div
				className={`newopm-map-container ${!isSelected ? 'is-unselected' : ''}`}
				style={{ height: height + 'px' }}
				role='application'
				aria-label='Interactive map editor for OpenStreetMap'
			>
				<MapContainer
					center={center}
					zoom={zoom}
					style={{ height: '100%', width: '100%' }}
					scrollWheelZoom={'center'}
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
						maxZoom={19}
						updateWhenIdle={tileConfig.updateWhenIdle}
						updateWhenZooming={tileConfig.updateWhenZooming}
						keepBuffer={tileConfig.keepBuffer}
						maxNativeZoom={19}
						minZoom={2}
					/>
					<MapLoadingHandler onMapReady={onMapReady} />
					<MapViewSync center={center} zoom={zoom} />
					<FullscreenControl />
					<MapInteractionHandler
						onMapClick={onMapClick}
						onZoomChange={onZoomChange}
						onCenterChange={onCenterChange}
						isSelected={isSelected}
						multimarker={multimarker}
						markerRefsRef={markerRefsRef}
						onMarkerClick={onMarkerClick}
						onMarkerDragEnd={onMarkerDragEnd}
					/>
					{multimarker
						? (markers || []).map(marker => (
								<MultiMarker
									key={marker.id}
									marker={marker}
									isPopupOpen={marker.id === openPopupMarkerId}
									registerRef={registerMarkerRef}
									onLabelChange={onMarkerLabelChange}
									onColorChange={onMarkerColorChange}
									onDelete={onMarkerDelete}
								/>
							))
						: markerPosition && <DraggableMarker position={markerPosition} onDragEnd={onMarkerDrag} label={markerLabel} />}
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
						role='status'
						aria-live='polite'
						aria-label='Map is loading'
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
								role='img'
								aria-label='Loading spinner'
							/>
							<p style={{ margin: 0, color: '#2271b1', fontSize: '14px', fontWeight: '500' }}>
								{__('Loading map...', 'newopm')}
							</p>
						</div>
					</div>
				)}
			</div>
		</MapErrorBoundary>
	);
}
