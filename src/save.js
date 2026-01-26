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
    function init() {
        loadLeafletScript(initializeNewOpmMaps);
    }

    document.addEventListener('DOMContentLoaded', init);

    // Also run immediately in case DOM is already loaded
    if (document.readyState !== 'loading') {
        init();
    }
}

function loadLeafletScript(callback) {
    // Check if Leaflet is already loaded
    if (typeof L !== 'undefined') {
        callback();
        return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="leaflet"]')) {
        // Wait for it to load
        const checkInterval = setInterval(() => {
            if (typeof L !== 'undefined') {
                clearInterval(checkInterval);
                callback();
            }
        }, 100);
        return;
    }

    // Get plugin URL from a known element or construct it
    const pluginUrl = window.newOpmPluginUrl || '/wp-content/plugins/NewOSM';

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = pluginUrl + '/assets/leaflet/leaflet.css';
        document.head.appendChild(link);
    }

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = pluginUrl + '/assets/leaflet/leaflet.js';
    script.onload = callback;
    script.onerror = () => {
        console.error('Failed to load Leaflet library');
    };
    document.head.appendChild(script);
}

function initializeNewOpmMaps() {
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

        // Add fullscreen control
        const fullscreenButton = L.control({ position: 'topright' });
        fullscreenButton.onAdd = function() {
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
            L.DomEvent.on(button, 'click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const isFullscreen = !!(
                    document.fullscreenElement ||
                    document.mozFullScreenElement ||
                    document.webkitFullscreenElement ||
                    document.msFullscreenElement
                );

                if (!isFullscreen) {
                    // Enter fullscreen
                    if (mapElement.requestFullscreen) {
                        mapElement.requestFullscreen();
                    } else if (mapElement.mozRequestFullScreen) {
                        mapElement.mozRequestFullScreen();
                    } else if (mapElement.webkitRequestFullscreen) {
                        mapElement.webkitRequestFullscreen();
                    } else if (mapElement.msRequestFullscreen) {
                        mapElement.msRequestFullscreen();
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

        // Handle fullscreen changes
        const handleFullscreenChange = function() {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        mapElement.classList.add('newopm-initialized');
    });
}
