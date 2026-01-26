import { useBlockProps } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const { latitude, longitude, zoom, markerLat, markerLon, markerLabel, height, width } = attributes;
    const blockProps = useBlockProps.save();

    const mapId = `newopm-map-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div {...blockProps}>
            <div
                id={mapId}
                className="newopm-map-frontend"
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

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        initializeNewOpmMaps();
    });

    // Also run immediately in case DOM is already loaded
    if (document.readyState === 'loading') {
        // DOM not ready yet
    } else {
        initializeNewOpmMaps();
    }
}

function initializeNewOpmMaps() {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded');
        return;
    }

    const maps = document.querySelectorAll('.newopm-map-frontend');

    maps.forEach(function(mapElement) {
        // Check if already initialized
        if (mapElement.classList.contains('newopm-initialized')) {
            return;
        }

        const lat = parseFloat(mapElement.getAttribute('data-lat'));
        const lon = parseFloat(mapElement.getAttribute('data-lon'));
        const zoom = parseInt(mapElement.getAttribute('data-zoom'));
        const markerLat = parseFloat(mapElement.getAttribute('data-marker-lat'));
        const markerLon = parseFloat(mapElement.getAttribute('data-marker-lon'));
        const markerLabel = mapElement.getAttribute('data-marker-label');

        // Initialize the map
        const map = L.map(mapElement).setView([lat, lon], zoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Add marker if coordinates are present
        if (!isNaN(markerLat) && !isNaN(markerLon)) {
            const marker = L.marker([markerLat, markerLon]).addTo(map);
            if (markerLabel) {
                marker.bindPopup(markerLabel);
            }
        }

        mapElement.classList.add('newopm-initialized');
    });
}
