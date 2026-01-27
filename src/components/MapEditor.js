/**
 * MapEditor Component - Lazy loaded map editor
 *
 * This component contains all the heavy Leaflet dependencies and is lazy-loaded
 * to improve initial editor load time. It's only loaded when the block is inserted.
 */

import { Component, useEffect, useRef, useState, useMemo } from '@wordpress/element';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { __ } from '@wordpress/i18n';
import L from 'leaflet';

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

// Fix for default marker icons in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;

const pluginUrl = window.newOpmData?.pluginUrl?.replace(/\/$/, '') || '';

L.Icon.Default.mergeOptions({
	iconRetinaUrl: pluginUrl + '/assets/leaflet/marker-icon-2x.png',
	iconUrl: pluginUrl + '/assets/leaflet/marker-icon.png',
	shadowUrl: pluginUrl + '/assets/leaflet/marker-shadow.png',
});

/**
 * Component to handle map interactions (clicks and zoom changes)
 */
function MapInteractionHandler({ onMapClick, onZoomChange, onCenterChange, isSelected }) {
	const map = useMap();
	const isDraggingRef = useRef(false);
	const dragStartRef = useRef(null);
	const initialCenterRef = useRef(null);

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

		const handleMouseDown = e => {
			// Don't initiate drag on marker
			if (e.target.classList.contains('leaflet-marker-icon')) {
				return;
			}

			isDraggingRef.current = false;
			dragStartRef.current = { x: e.clientX, y: e.clientY };
			initialCenterRef.current = map.getCenter();
			e.preventDefault();
		};

		const handleMouseMove = e => {
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
			isDraggingRef.current = false;
			dragStartRef.current = null;
			initialCenterRef.current = null;
			mapContainer.style.cursor = defaultCursor;
		};

		document.addEventListener('mouseup', handleGlobalMouseUp);

		return () => {
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
	}, [map, onMapClick, onZoomChange, onCenterChange, isSelected]);

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
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		if (!map) return;

		const mapContainer = map.getContainer();
		const control = L.control({ position: 'topright' });

		control.onAdd = function () {
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
			button.style.color = '#333';
			button.style.display = 'flex';
			button.style.alignItems = 'center';
			button.style.justifyContent = 'center';
			button.style.padding = '0';
			button.style.lineHeight = '1';

			button.setAttribute('aria-label', 'Toggle fullscreen map view');
			button.setAttribute('role', 'button');
			button.setAttribute('type', 'button');
			button.setAttribute('aria-pressed', 'false');

			L.DomEvent.disableClickPropagation(button);
			L.DomEvent.on(button, 'click', function (e) {
				e.preventDefault();
				e.stopPropagation();

				const container = mapContainer.closest('.newopm-map-container');
				if (!container) return;

				if (!isFullscreen) {
					if (container.requestFullscreen) {
						container.requestFullscreen();
					} else if (container.mozRequestFullScreen) {
						container.mozRequestFullScreen();
					} else if (container.webkitRequestFullscreen) {
						container.webkitRequestFullscreen();
					} else if (container.msRequestFullscreen) {
						container.msRequestFullscreen();
					}
				} else {
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

		control.addTo(map);

		const handleFullscreenChange = () => {
			const isNowFullscreen = !!(
				document.fullscreenElement ||
				document.mozFullScreenElement ||
				document.webkitFullscreenElement ||
				document.msFullscreenElement
			);

			setIsFullscreen(isNowFullscreen);

			const button = mapContainer.querySelector('.leaflet-control-custom');
			if (button) {
				button.setAttribute('aria-pressed', isNowFullscreen ? 'true' : 'false');
				button.setAttribute('aria-label', isNowFullscreen ? 'Exit fullscreen map view' : 'Toggle fullscreen map view');
			}

			setTimeout(() => {
				if (map) {
					map.invalidateSize();
				}
			}, 100);
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('msfullscreenchange', handleFullscreenChange);

		return () => {
			control.remove();
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('msfullscreenchange', handleFullscreenChange);
		};
	}, [map, isFullscreen]);

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
}) {
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
						updateWhenIdle={false}
						updateWhenZooming={true}
						keepBuffer={4}
						maxNativeZoom={19}
						minZoom={2}
					/>
					<MapLoadingHandler onMapReady={onMapReady} />
					<MapViewSync center={center} zoom={zoom} />
					<FullscreenControl />
					<MapInteractionHandler onMapClick={onMapClick} onZoomChange={onZoomChange} onCenterChange={onCenterChange} isSelected={isSelected} />
					{markerPosition && <DraggableMarker position={markerPosition} onDragEnd={onMarkerDrag} label={markerLabel} />}
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
