/**
 * SVG Marker Icons for Leaflet
 * Inline SVG data URIs to eliminate HTTP requests for marker images
 *
 * This optimization reduces network requests by embedding marker icons as data URIs.
 * See FUTURE_OPTIMIZATIONS.md #5 for details.
 */

/**
 * Standard Leaflet marker icon (blue pin)
 * SVG replica of the classic Leaflet marker-icon.png (25x41px)
 */
export const markerIconSVG = `data:image/svg+xml;base64,${btoa(`
<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="markerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#5d9cec;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b7ecf;stop-opacity:1" />
    </linearGradient>
  </defs>
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 1.9 0.4 3.7 1.3 5.3L12.5 41l11.2-23.2c0.9-1.6 1.3-3.4 1.3-5.3C25 5.6 19.4 0 12.5 0z"
        fill="url(#markerGradient)"
        stroke="#2d6ca5"
        stroke-width="1.5"/>
  <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
</svg>
`)}`;

/**
 * Retina/2x version of the marker icon
 * Uses the same SVG with double dimensions (50x82px)
 */
export const markerIconRetinaUrl = `data:image/svg+xml;base64,${btoa(`
<svg width="50" height="82" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="markerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#5d9cec;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b7ecf;stop-opacity:1" />
    </linearGradient>
  </defs>
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 1.9 0.4 3.7 1.3 5.3L12.5 41l11.2-23.2c0.9-1.6 1.3-3.4 1.3-5.3C25 5.6 19.4 0 12.5 0z"
        fill="url(#markerGradient)"
        stroke="#2d6ca5"
        stroke-width="1.5"/>
  <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
</svg>
`)}`;

/**
 * Marker shadow
 * SVG replica of marker-shadow.png (41x41px)
 */
export const markerShadowUrl = `data:image/svg+xml;base64,${btoa(`
<svg width="41" height="41" viewBox="0 0 41 41" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="13" cy="35" rx="13" ry="5" fill="black" opacity="0.3"/>
  <ellipse cx="13" cy="35" rx="10" ry="3.5" fill="black" opacity="0.15"/>
</svg>
`)}`;

/**
 * Size and anchor configuration for the marker icon
 * These match the default Leaflet marker dimensions
 */
export const markerIconConfig = {
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
	shadowAnchor: [12, 41],
};

/**
 * Apply SVG marker icons to Leaflet default icon
 * Call this function after Leaflet is loaded
 *
 * @param {Object} L - Leaflet instance
 */
export function applySVGMarkerIcons(L) {
	if (!L || !L.Icon || !L.Icon.Default) {
		console.warn('Leaflet not loaded, cannot apply SVG marker icons');
		return;
	}

	// Remove default icon URL getter
	delete L.Icon.Default.prototype._getIconUrl;

	// Apply SVG data URIs
	L.Icon.Default.mergeOptions({
		iconRetinaUrl: markerIconRetinaUrl,
		iconUrl: markerIconSVG,
		shadowUrl: markerShadowUrl,
		...markerIconConfig,
	});
}
