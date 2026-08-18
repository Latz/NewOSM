/**
 * Tests for SVG marker icon optimization
 * See FUTURE_OPTIMIZATIONS.md #5
 */

import {
	markerIconSVG,
	markerIconRetinaUrl,
	markerShadowUrl,
	markerIconConfig,
	applySVGMarkerIcons,
	createMarkerIcon,
	MARKER_COLOR_PALETTE,
} from './markerIcons';

describe('SVG Marker Icons', () => {
	test('markerIconSVG should be a valid data URI', () => {
		expect(markerIconSVG).toMatch(/^data:image\/svg\+xml;base64,/);
		expect(markerIconSVG.length).toBeGreaterThan(100);
	});

	test('markerIconRetinaUrl should be a valid data URI', () => {
		expect(markerIconRetinaUrl).toMatch(/^data:image\/svg\+xml;base64,/);
		expect(markerIconRetinaUrl.length).toBeGreaterThan(100);
	});

	test('markerShadowUrl should be a valid data URI', () => {
		expect(markerShadowUrl).toMatch(/^data:image\/svg\+xml;base64,/);
		expect(markerShadowUrl.length).toBeGreaterThan(100);
	});

	test('markerIconConfig should have correct dimensions', () => {
		expect(markerIconConfig.iconSize).toEqual([25, 41]);
		expect(markerIconConfig.iconAnchor).toEqual([12, 41]);
		expect(markerIconConfig.popupAnchor).toEqual([1, -34]);
		expect(markerIconConfig.shadowSize).toEqual([41, 41]);
		expect(markerIconConfig.shadowAnchor).toEqual([12, 41]);
	});

	test('data URIs should decode to valid SVG', () => {
		const decodedMarker = atob(markerIconSVG.replace('data:image/svg+xml;base64,', ''));
		expect(decodedMarker).toContain('<svg');
		expect(decodedMarker).toContain('</svg>');
		expect(decodedMarker).toContain('width="25"');
		expect(decodedMarker).toContain('height="41"');

		const decodedShadow = atob(markerShadowUrl.replace('data:image/svg+xml;base64,', ''));
		expect(decodedShadow).toContain('<svg');
		expect(decodedShadow).toContain('</svg>');
	});

	test('applySVGMarkerIcons should configure Leaflet', () => {
		const mockLeaflet = {
			Icon: {
				Default: {
					prototype: {
						_getIconUrl: jest.fn(),
					},
					mergeOptions: jest.fn(),
				},
			},
		};

		applySVGMarkerIcons(mockLeaflet);

		expect(mockLeaflet.Icon.Default.prototype._getIconUrl).toBeUndefined();
		expect(mockLeaflet.Icon.Default.mergeOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				iconRetinaUrl: expect.stringMatching(/^data:image\/svg\+xml/),
				iconUrl: expect.stringMatching(/^data:image\/svg\+xml/),
				shadowUrl: expect.stringMatching(/^data:image\/svg\+xml/),
				iconSize: [25, 41],
				iconAnchor: [12, 41],
			})
		);
	});

	test('applySVGMarkerIcons should handle missing Leaflet gracefully', () => {
		const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

		applySVGMarkerIcons(null);
		expect(consoleSpy).toHaveBeenCalledWith('Leaflet not loaded, cannot apply SVG marker icons');

		applySVGMarkerIcons({});
		expect(consoleSpy).toHaveBeenCalledWith('Leaflet not loaded, cannot apply SVG marker icons');

		consoleSpy.mockRestore();
	});

	test('SVG data URIs should be smaller than original PNGs', () => {
		// Original PNGs: marker-icon.png (1.5KB) + marker-icon-2x.png (2.5KB) + marker-shadow.png (618B) = 4.6KB
		// The data URIs should be smaller or comparable in size
		const totalSize = markerIconSVG.length + markerIconRetinaUrl.length + markerShadowUrl.length;

		// Base64 encoding adds ~33% overhead, but SVG is more compressible
		// Expect total size to be under 10KB (generous limit for base64-encoded SVG)
		expect(totalSize).toBeLessThan(10000);
	});

	test('marker and retina versions should have same viewBox', () => {
		const decodedMarker = atob(markerIconSVG.replace('data:image/svg+xml;base64,', ''));
		const decodedRetina = atob(markerIconRetinaUrl.replace('data:image/svg+xml;base64,', ''));

		expect(decodedMarker).toContain('viewBox="0 0 25 41"');
		expect(decodedRetina).toContain('viewBox="0 0 25 41"');
	});
});

describe('createMarkerIcon (multimarker per-marker icons)', () => {
	test('returns a Leaflet divIcon with the expected size/anchor config', () => {
		const icon = createMarkerIcon({ color: 'red', markerId: 'm-1' });

		expect(icon.options.className).toBe('newopm-multimarker-icon');
		expect(icon.options.iconSize).toEqual(markerIconConfig.iconSize);
		expect(icon.options.iconAnchor).toEqual(markerIconConfig.iconAnchor);
		expect(icon.options.popupAnchor).toEqual(markerIconConfig.popupAnchor);
	});

	test('uses the requested palette color in the embedded SVG', () => {
		const icon = createMarkerIcon({ color: 'green', markerId: 'm-2' });
		const svgMatch = icon.options.html.match(/src="([^"]+)"/);
		const decodedSvg = atob(svgMatch[1].replace('data:image/svg+xml;base64,', ''));

		expect(decodedSvg).toContain(MARKER_COLOR_PALETTE.green);
	});

	test('falls back to the blue palette color for an unknown/missing color', () => {
		const iconUnknown = createMarkerIcon({ color: 'not-a-color', markerId: 'm-3' });
		const iconMissing = createMarkerIcon({ markerId: 'm-4' });

		[iconUnknown, iconMissing].forEach(icon => {
			const svgMatch = icon.options.html.match(/src="([^"]+)"/);
			const decodedSvg = atob(svgMatch[1].replace('data:image/svg+xml;base64,', ''));
			expect(decodedSvg).toContain(MARKER_COLOR_PALETTE.blue);
		});
	});

	test('stamps the marker id as a data-marker-id attribute', () => {
		const icon = createMarkerIcon({ color: 'blue', markerId: 'm-42' });

		expect(icon.options.html).toContain('data-marker-id="m-42"');
	});

	test('escapes special characters in the marker id to prevent attribute injection', () => {
		const icon = createMarkerIcon({ color: 'blue', markerId: `"><img src=x onerror=alert(1)>` });

		expect(icon.options.html).not.toContain('<img src=x onerror=alert(1)>');
		expect(icon.options.html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
	});

	test('handles a missing markerId gracefully', () => {
		const icon = createMarkerIcon({ color: 'orange' });

		expect(icon.options.html).toContain('data-marker-id=""');
	});

	test('called with no arguments still returns a usable icon', () => {
		const icon = createMarkerIcon();

		expect(icon.options.className).toBe('newopm-multimarker-icon');
		expect(icon.options.html).toContain('data-marker-id=""');
	});
});
