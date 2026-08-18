import { useBlockProps } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

export default function save({ attributes }) {
	const { latitude, longitude, zoom, markerLat, markerLon, markerLabel, multimarker, markers, height, width, mapId } =
		attributes;
	const blockProps = useBlockProps.save();

	// Validate coordinates to prevent rendering invalid maps
	const validLat = typeof latitude === 'number' && latitude >= -90 && latitude <= 90;
	const validLon = typeof longitude === 'number' && longitude >= -180 && longitude <= 180;
	const validZoom = typeof zoom === 'number' && zoom >= 1 && zoom <= 18;

	if (!validLat || !validLon || !validZoom) {
		return (
			<div {...blockProps}>
				<div
					className='newopm-map-error'
					style={{ padding: '20px', border: '2px solid #dc3232', borderRadius: '4px', backgroundColor: '#fef7f7' }}
				>
					<p style={{ margin: 0, color: '#dc3232' }}>
						<strong>{__('Invalid map configuration:', 'newopm')}</strong>{' '}
						{__('Please check the map coordinates and zoom level in the block settings.', 'newopm')}
					</p>
				</div>
			</div>
		);
	}

	// Use the mapId from attributes (generated once when block is created)
	// For old blocks without mapId, use a deterministic default
	const finalMapId = mapId || 'newopm-map-default';

	const validMarkers =
		multimarker && Array.isArray(markers)
			? markers.filter(m => typeof m.lat === 'number' && typeof m.lon === 'number')
			: [];

	return (
		<div {...blockProps}>
			<div
				id={finalMapId}
				className='newopm-map-frontend'
				data-lat={latitude}
				data-lon={longitude}
				data-zoom={zoom}
				data-marker-lat={markerLat}
				data-marker-lon={markerLon}
				data-marker-label={markerLabel}
				data-multimarker={multimarker ? 'true' : 'false'}
				data-markers={multimarker ? JSON.stringify(validMarkers) : undefined}
				data-height={height}
				data-width={width}
				style={{ height: height + 'px', width: width || '100%' }}
			>
				<noscript>
					<p>{__('This map requires JavaScript to display.', 'newopm')}</p>
				</noscript>
			</div>
		</div>
	);
}
