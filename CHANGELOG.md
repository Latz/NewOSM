# Changelog

## Version 1.1.4 - 2026-01-25

### Changed
- **Cursor Behavior**: Updated cursor states for better UX
  - Default cursor is now **crosshair** (indicates click to place marker)
  - Mouse down → Changes to **grab** (indicates you can drag)
  - While dragging → Changes to **grabbing** (active drag state)
  - Mouse up → Returns to **crosshair**
  - Clearer visual feedback for click vs drag actions

### Technical Changes
- Updated cursor states in `handleMouseDown`, `handleMouseMove`, `handleMouseUp`
- Set initial cursor to crosshair in MapInteractionHandler
- Updated CSS to enforce crosshair as default cursor
- Cursor changes dynamically based on interaction state

## Version 1.1.3 - 2026-01-25

### Added
- **Reverse Geocoding (Address Lookup)**: Automatic address lookup when placing markers
  - Click to place marker → Address appears in sidebar
  - Drag marker → Address updates automatically
  - Search for location → Address displays in sidebar
  - Displays full address in a highlighted box
  - Shows both address and coordinates
  - Falls back to coordinates if address not found
  - Loading indicator while fetching address

### Fixed
- Search results now properly update the marker position sidebar with address

### Improved
- Enhanced marker position display in sidebar
  - Address shown in blue highlighted box
  - Coordinates labeled clearly
  - Better visual hierarchy
  - Helpful text for marker label field

### Technical Changes
- Added `fetchAddress()` function using Nominatim reverse geocoding API
- Added `isLoadingAddress` state for loading feedback
- Added `markerAddress` state to display fetched address
- Improved sidebar layout with address section
- Address fetched for both click placement and drag events
- Search results now update `markerAddress` state

## Version 1.1.2 - 2026-01-25

### Added
- **Zoom Synchronization**: Zoom level now syncs bidirectionally
  - Mouse wheel zoom updates the sidebar zoom slider
  - Sidebar zoom slider updates the map zoom
  - Zoom changes from double-click also update the sidebar
  - All zoom interactions stay perfectly in sync

### Technical Changes
- Added `ZoomSync` component to sync sidebar changes to map
- Added `handleZoomChange` callback to update attributes on map zoom
- Added `zoomend` event listener in MapInteractionHandler
- Zoom state is now the single source of truth

## Version 1.1.1 - 2026-01-25

### Fixed
- **Map Dragging Issue**: Implemented intelligent click vs drag detection
  - **Click** (no movement) → Places a marker
  - **Click and drag** (mouse moves >5px) → Pans the map
  - Drag state is forcefully cleared on every mouseup event
  - Global mouseup listeners catch releases outside map area
  - No more stuck drag states!

### How It Works
- Natural interaction: single click for markers, click-drag to pan
- Movement threshold: 5 pixels to distinguish click from drag
- Aggressive cleanup on document mouseup and mouseleave
- Leaflet's `_moving` flag is reset on every mouse release

### Technical Changes
- Created `MapInteractionHandler` component with motion detection
- Tracks mouse position on mousedown with useRef
- Compares mouse movement to determine click vs drag
- Only triggers marker placement if movement < 5px
- Document-level listeners ensure drag cleanup even when mouse leaves map
- Removed toggle control (no longer needed)

## Version 1.1.0 - 2026-01-25

### Added
- **Size Presets**: Quick size options for maps
  - Small (300×200)
  - Medium (100%×400) - Default
  - Large (100%×600)
  - Fullscreen (100%×800)
  - Custom (user-defined)
  
- **Custom Width Support**: Maps can now have custom widths
  - Supports percentages (e.g., 100%, 50%)
  - Supports pixels (e.g., 800px)
  - Supports viewport units (e.g., 50vw)
  
- **Settings Page**: Admin settings page at Settings > NewOSM
  - Configure default size preset
  - Set default height
  - Set default width
  - Set default zoom level
  
- **Save as Default**: Button in block editor to save current settings as defaults
  - Quick way to set preferences without visiting settings page
  - Applies to size, dimensions, and zoom level
  
- **Auto-apply Defaults**: New blocks automatically use saved default settings

### Technical Changes
- Added `width` attribute to block (default: "100%")
- Added `sizePreset` attribute to block (default: "medium")
- Added `customDefaultsApplied` internal attribute
- Added WordPress settings API integration
- Added AJAX handler for saving defaults from editor
- Added admin menu item for settings page

## Version 1.0.0 - 2026-01-25

### Initial Release
- Interactive OpenStreetMap integration with Leaflet
- Location search using Nominatim API
- Click-to-place markers
- Draggable markers
- Customizable map height and zoom
- Frontend map rendering
- Block editor integration
