# Scrambled Tiles Fix - Applied 2026-01-27

## Issue
The map tiles were appearing scrambled in the backend editor due to missing CSS protection against WordPress theme interference.

## Root Cause
WordPress themes often apply global CSS rules to `img` elements that interfere with Leaflet's tile positioning system. Leaflet requires tiles to be exactly 256x256px with specific positioning, but theme CSS can override these dimensions with rules like:
- `max-width: 100%`
- `height: auto`
- Custom margins, padding, or borders
- Different box-sizing models

## Solution Applied
Added comprehensive CSS protection to `src/editor.scss` to ensure Leaflet tiles maintain their required dimensions and positioning:

```scss
// Fix for scrambled tiles - protect dimensions and positioning
img.leaflet-tile {
    max-width: none !important;
    max-height: none !important;
    width: 256px !important;
    height: 256px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-sizing: content-box !important;
    object-fit: fill !important;
    display: block !important;
}
```

## Files Modified
1. **src/editor.scss** - Added complete tile protection CSS (lines 18-30)

## Files Already Protected
The following files already had the fix in place:
1. **src/style.scss** - Frontend styles (lines 30-43)
2. **assets/leaflet/leaflet.css** - Leaflet core CSS (lines 664-675)

## Verification
After building, the compiled CSS in `build/index.css` now includes all protection rules:
```css
.wp-block-newopm-osm-map .newopm-map-container .leaflet-container img.leaflet-tile {
    border:none!important;
    box-sizing:content-box!important;
    display:block!important;
    height:256px!important;
    margin:0!important;
    max-height:none!important;
    max-width:none!important;
    object-fit:fill!important;
    padding:0!important;
    width:256px!important;
}
```

## Related Commits
- **e54527ad** - Initial scrambled tiles fix with additional CSS protection
- **4d71fde7** - Lazy loading implementation (separate optimization)

## Testing
To verify the fix:
1. Clear browser cache
2. Reload the WordPress editor
3. Insert or edit an OpenStreetMap block
4. Verify that map tiles appear correctly aligned without scrambling
5. Test with different WordPress themes to ensure compatibility

## Prevention
This fix uses `!important` flags to ensure theme CSS cannot override the critical Leaflet tile dimensions. The protection is applied at three levels:
1. **Editor** (src/editor.scss) - For block editor
2. **Frontend** (src/style.scss) - For public-facing pages
3. **Leaflet Core** (assets/leaflet/leaflet.css) - Base protection

## Additional Notes
- The fix is compatible with all modern browsers
- No JavaScript changes were required
- The fix does not affect other Leaflet functionality
- Fullscreen mode continues to work correctly

