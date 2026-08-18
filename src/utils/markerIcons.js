/**
 * SVG Marker Icons for Leaflet
 * Inline SVG data URIs to eliminate HTTP requests for marker images
 *
 * This optimization reduces network requests by embedding marker icons as data URIs.
 * See FUTURE_OPTIMIZATIONS.md #5 for details.
 */

import L from 'leaflet';

/**
 * Build the marker pin SVG markup for a given fill color, used both for the
 * standard/retina default icon data URIs below and per-marker multimarker icons.
 * @param {string} fill        - Solid or gradient-stop fill color for the pin body
 * @param {string} strokeColor - Stroke color for the pin outline
 * @param {number} scale       - 1 for standard (25x41), 2 for retina (50x82)
 */
function buildPinSVG(fill, strokeColor, scale = 1) {
	const width = 25 * scale;
	const height = 41 * scale;
	return `
<svg width="${width}" height="${height}" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 1.9 0.4 3.7 1.3 5.3L12.5 41l11.2-23.2c0.9-1.6 1.3-3.4 1.3-5.3C25 5.6 19.4 0 12.5 0z"
        fill="${fill}"
        stroke="${strokeColor}"
        stroke-width="1.5"/>
  <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
</svg>
`;
}

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

/**
 * Fixed color palette for multimarker per-marker icon customization.
 * Keys are stored on the `markers[].color` block attribute.
 */
export const MARKER_COLOR_PALETTE = {
	blue: '#3b7ecf',
	red: '#dc3232',
	green: '#2e7d32',
	orange: '#e6852c',
};

const MARKER_STROKE_COLOR = '#2d6ca5';

/**
 * Escape a string for safe use inside an HTML attribute value.
 * @param {string} value
 */
function escapeHtmlAttr(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Build a distinct Leaflet divIcon for a single multimarker marker, colored per
 * `markers[].color` and stamped with a `data-marker-id` attribute so the editor's
 * raw DOM mousedown/mouseup handlers (MapInteractionHandler) can identify which
 * marker was interacted with.
 * @param {Object} options
 * @param {string} [options.color]    - Key into MARKER_COLOR_PALETTE; falls back to 'blue'
 * @param {string} [options.markerId] - Marker id, stamped as data-marker-id
 */
export function createMarkerIcon({ color, markerId } = {}) {
	const fill = MARKER_COLOR_PALETTE[color] || MARKER_COLOR_PALETTE.blue;
	const svg = `data:image/svg+xml;base64,${btoa(buildPinSVG(fill, MARKER_STROKE_COLOR))}`;

	return L.divIcon({
		className: 'newopm-multimarker-icon',
		html: `<div data-marker-id="${escapeHtmlAttr(markerId || '')}"><img src="${svg}" width="25" height="41" alt="" /></div>`,
		iconSize: markerIconConfig.iconSize,
		iconAnchor: markerIconConfig.iconAnchor,
		popupAnchor: markerIconConfig.popupAnchor,
	});
}
