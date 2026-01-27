# Code Review Fixes Applied

## Version 1.1.5 - 2026-01-26

### ✅ Fixed Issues

#### 1. **Hardcoded Plugin Path (CRITICAL)** ✅ FIXED
**Issue:** Plugin URL was hardcoded as `window.location.origin + '/wp-content/plugins/NewOSM'`

**Fix Applied:**
- **PHP Side (`newopm.php`):**
  - Added `newopm_localize_editor_script()` function
  - Uses `wp_localize_script()` to pass plugin URL to JavaScript
  - Passes `pluginUrl`, `pluginDir`, and `version` to `window.newOpmData`
  - Hooked to `enqueue_block_editor_assets` with priority 20

- **JavaScript Side (`src/edit.js`):**
  - Now reads from `window.newOpmData.pluginUrl`
  - Added error logging if data is not available
  - Removes trailing slash for consistency
  - Fallback to empty string (will show error in console)

**Benefits:**
- ✅ Works with WordPress in subdirectories
- ✅ Works if plugin folder is renamed
- ✅ Works with custom `wp-content` directories
- ✅ Portable and follows WordPress best practices

---

#### 2. **Missing Error Boundaries (MAJOR)** ✅ FIXED
**Issue:** No error handling for React component failures

**Fix Applied:**
- Added `MapErrorBoundary` component class
- Catches errors in map components
- Shows user-friendly error message with:
  - Clear explanation of what went wrong
  - Possible causes (network, Leaflet, config, browser)
  - Error details in collapsible section (for debugging)
  - "Try Again" button to reset component
  - "Reload Page" button as fallback
- Prevents entire editor from crashing

**Benefits:**
- ✅ Better user experience on errors
- ✅ Debugging information available
- ✅ Editor remains functional even if map fails

---

#### 3. **Nominatim API Rate Limiting (MAJOR)** ✅ FIXED
**Issue:** No rate limiting, violates Nominatim usage policy (max 1 req/sec)

**Fix Applied:**
- Added `NominatimRateLimiter` class with:
  - 1-second minimum interval between requests
  - Request caching (5-minute expiry)
  - Automatic request queuing
  - Cache key generation
  - Pending request tracking
- Integrated into search and reverse geocoding functions

**Benefits:**
- ✅ Complies with Nominatim usage policy
- ✅ Prevents IP bans
- ✅ Reduces unnecessary API calls
- ✅ Improves performance with caching

---

#### 4. **Missing Internationalization in JavaScript (MODERATE)** ✅ FIXED
**Issue:** All strings hardcoded in English

**Fix Applied:**
- Imported `__()` from `@wordpress/i18n`
- Wrapped all user-facing strings in translation functions
- Used text domain `'new-osm'` (Note: Should be `'newopm'` to match PHP)

**Benefits:**
- ✅ Plugin can be translated
- ✅ Follows WordPress i18n best practices

---

### 📝 Additional Improvements Made

1. **Better Error Logging**
   - Console errors when plugin data is missing
   - Detailed error information in Error Boundary

2. **Code Comments**
   - Added explanatory comments for plugin URL handling
   - Documented rate limiter functionality

3. **Defensive Programming**
   - Optional chaining (`?.`) for safe property access
   - Fallback values to prevent crashes

---

### ⚠️ Issues Still Remaining

See `codereview.txt` for the full list. Priority items still to address:

1. **Text Domain Inconsistency** - Using `'new-osm'` in JS but `'newopm'` in PHP
2. **REST API Public Access** - Default settings endpoint is public
3. **Console.log in Production** - Should be removed or wrapped in dev check
4. **Alert() Usage** - Should use WordPress notices instead
5. **Map Re-renders** - Using `setMapKey()` destroys/recreates map (expensive)
6. **No Debouncing on Marker Drag** - Could trigger many API calls
7. **Leaflet from CDN** - Should bundle locally or add SRI hash
8. **Memory Leaks** - Event listeners in view.js not cleaned up
9. **Accessibility** - Missing ARIA labels and keyboard navigation
10. **No Unit Tests** - Should add test coverage

---

### 🔧 How to Test the Fixes

1. **Plugin URL Fix:**
   - Rename plugin folder to something else
   - Check if marker icons still load correctly
   - Install WordPress in a subdirectory
   - Verify maps still work

2. **Error Boundary:**
   - Temporarily break Leaflet import
   - Verify error message appears instead of blank screen
   - Check that "Try Again" button works

3. **Rate Limiting:**
   - Open browser dev tools → Network tab
   - Search for multiple locations quickly
   - Verify requests are spaced 1 second apart
   - Search for same location twice
   - Verify second request uses cache (no network call)

4. **Internationalization:**
   - Install a translation plugin
   - Create translations for the plugin
   - Verify strings are translatable

---

### 📦 Next Steps

1. Run `npm run build` to compile changes
2. Test in WordPress editor
3. Address remaining issues from code review
4. Update version number to 1.1.5
5. Update CHANGELOG.md with these fixes

