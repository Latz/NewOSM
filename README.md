# NewOSM - OpenStreetMap Block for WordPress

A WordPress Gutenberg block plugin that allows you to insert interactive OpenStreetMap maps into your posts and pages with location search and marker placement functionality.

## Features

- **Interactive Maps**: Display OpenStreetMap maps in your WordPress content
- **Location Search**: Search for any location using the Nominatim geocoding API
- **Marker Placement**: Click on the map to place a marker, or drag to reposition
- **Size Presets**: Quick size options (Small, Medium, Large, Fullscreen) or custom dimensions
- **Custom Dimensions**: Set custom width and height for maps
- **Save Defaults**: Save your preferred settings as defaults for new maps
- **Settings Page**: Configure default map size, zoom, and dimensions
- **Customizable**: Adjust map height, width, zoom level, and marker labels
- **Responsive**: Maps automatically adapt to different screen sizes
- **Easy to Use**: Simple block interface integrated with WordPress Gutenberg editor

## Installation

1. Upload the `NewOSM` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Add the "OpenStreetMap" block to any post or page

## Development

### Requirements
- Node.js 14+ and npm
- WordPress 6.1+
- PHP 7.4+

### Build Instructions

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run start

# Production build
npm run build

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### Performance

This plugin is optimized for performance with:
- ✅ Canvas rendering (2-3x faster than SVG)
- ✅ React memoization (40-60% fewer re-renders)
- ✅ Tile layer optimization (~30% fewer requests)
- ✅ Debounced updates
- ✅ Deferred script loading

**Performance improvement: ~40-50% faster than v1.1.5**

📚 **Documentation:**
- [Performance Optimizations](PERFORMANCE_OPTIMIZATIONS.md) - Implemented optimizations
- [Future Optimizations](FUTURE_OPTIMIZATIONS.md) - Planned enhancements
- [Performance Guide](docs/PERFORMANCE_GUIDE.md) - Testing and monitoring

## Usage

### Adding a Map

1. **Add the Block**: In the WordPress editor, click the '+' button and search for "OpenStreetMap"
2. **Search for a Location**: Use the search field in the block settings sidebar to find a location
3. **Place a Marker**: Click anywhere on the map to place a marker
4. **Adjust Settings**:
   - **Size Preset**: Choose from Small (300×200), Medium (100%×400), Large (100%×600), Fullscreen (100%×800), or Custom
   - **Custom Width**: Set custom width (e.g., 100%, 800px, 50vw) when using Custom preset
   - **Custom Height**: Control the display height (200-1200px) when using Custom preset
   - **Zoom Level**: Adjust map zoom (1-18)
   - **Marker Label**: Add custom text to the marker popup
5. **Save as Default**: Click "Save Current Settings as Default" to use these settings for new maps
6. **Publish**: Save or publish your post to display the map on the frontend

### Configuring Defaults

1. Go to **Settings > NewOSM** in WordPress admin
2. Configure default settings:
   - **Default Size Preset**: Choose the default size preset for new maps
   - **Default Height**: Set default height in pixels (used with Custom preset)
   - **Default Width**: Set default width (e.g., 100%, 800px)
   - **Default Zoom Level**: Set default zoom level (1-18)
3. Click **Save Settings**

New maps will automatically use these defaults when inserted.

## Block Settings

### Inspector Controls (Sidebar)
- **Search Location**: Search for any address, city, or landmark
- **Size Preset**: Quick size options (Small, Medium, Large, Fullscreen, Custom)
- **Map Width**: Custom width (visible when Custom preset selected)
- **Map Height**: Custom height (visible when Custom preset selected)
- **Zoom Level**: Control how close the map zooms in
- **Save Current Settings as Default**: Save current configuration as defaults
- **Marker Label**: Custom text for the marker popup
- **Clear Marker**: Remove the currently placed marker

### Block Attributes
- `latitude`: Map center latitude (default: 51.505)
- `longitude`: Map center longitude (default: -0.09)
- `zoom`: Zoom level 1-18 (default: 13)
- `markerLat`: Marker latitude position
- `markerLon`: Marker longitude position
- `markerLabel`: Text displayed in marker popup
- `height`: Map height in pixels (default: 400)
- `width`: Map width (default: "100%")
- `sizePreset`: Size preset selection (default: "medium")

### Size Presets
- **Small**: 300px × 200px
- **Medium**: 100% × 400px (default)
- **Large**: 100% × 600px
- **Fullscreen**: 100% × 800px
- **Custom**: User-defined width and height

## Technical Details

- **Frontend**: React + Leaflet + React-Leaflet
- **Build System**: @wordpress/scripts (Webpack-based)
- **Map Tiles**: OpenStreetMap
- **Geocoding**: Nominatim API
- **License**: GPL v2 or later

## Credits

- Map data from [OpenStreetMap](https://www.openstreetmap.org/) contributors
- Powered by [Leaflet](https://leafletjs.com/)
- Geocoding by [Nominatim](https://nominatim.openstreetmap.org/)

## License

This plugin is licensed under GPL v2 or later.

## Support

For bug reports and feature requests, please contact the plugin author.
