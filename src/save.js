import { useBlockProps } from '@wordpress/block-editor';

export default function save({ attributes }) {
	const { latitude, longitude, zoom, markerLat, markerLon, markerLabel, height, width } = attributes;
	const blockProps = useBlockProps.save();

	// Validate coordinates to prevent rendering invalid maps
	const validLat = typeof latitude === 'number' && latitude >= -90 && latitude <= 90;
	const validLon = typeof longitude === 'number' && longitude >= -180 && longitude <= 180;
	const validZoom = typeof zoom === 'number' && zoom >= 1 && zoom <= 18;

	if (!validLat || !validLon || !validZoom) {
		return (
			<div {...blockProps}>
				<div className='newopm-map-error' style={{ padding: '20px', border: '2px solid #dc3232', borderRadius: '4px', backgroundColor: '#fef7f7' }}>
					<p style={{ margin: 0, color: '#dc3232' }}>
						<strong>Invalid map configuration:</strong> Please check the map coordinates and zoom level in the block settings.
					</p>
				</div>
			</div>
		);
	}

	const mapId = `newopm-map-${Math.random().toString(36).substring(2, 11)}`;

	return (
		<div {...blockProps}>
			<div
				id={mapId}
				className='newopm-map-frontend'
				data-lat={latitude}
				data-lon={longitude}
				data-zoom={zoom}
				data-marker-lat={markerLat}
				data-marker-lon={markerLon}
				data-marker-label={markerLabel}
				data-height={height}
				data-width={width}
				style={{ height: height + 'px', width: width || '100%' }}
			>
				<noscript>
					<p>This map requires JavaScript to display.</p>
				</noscript>
			</div>
		</div>
	);
}
