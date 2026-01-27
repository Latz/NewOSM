# Debugging Missing/Scrambled Tiles Issue

## Current Status

✅ **CSS Fix Applied**: The scrambled tiles fix has been added to `src/editor.scss` and compiled to `build/index.css`
✅ **Build Successful**: All files compiled without errors
✅ **Lazy Loading Working**: MapEditor component loads correctly

❌ **Issue**: Tiles are still missing/scrambled in the backend editor

---

## Step-by-Step Debugging Guide

### Step 1: Clear Browser Cache

**This is the most common cause!**

1. Open WordPress editor
2. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
3. Select "Cached images and files"
4. Clear cache
5. **Hard reload**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
6. Try inserting the map block again

---

### Step 2: Check Browser Console for Errors

1. Open WordPress editor
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Insert or edit an OpenStreetMap block
5. Look for any **red error messages**

**Common errors to look for:**
- `Failed to load resource` - Network issue loading tiles
- `Uncaught TypeError` - JavaScript error
- `Mixed Content` - HTTP/HTTPS issue
- `CORS error` - Cross-origin issue

**Take a screenshot of any errors and share them.**

---

### Step 3: Check Network Tab for Tile Requests

1. Open DevTools (`F12`)
2. Go to **Network** tab
3. Insert/edit OpenStreetMap block
4. Look for requests to `tile.openstreetmap.org`

**What to check:**
- ✅ Are tile requests being made? (URLs like `https://a.tile.openstreetmap.org/13/4094/2723.png`)
- ✅ What is the status code? (Should be `200 OK`)
- ❌ Are requests failing? (Status `404`, `403`, `500`, etc.)
- ❌ Are requests blocked? (Status `(blocked:mixed-content)` or `(blocked:csp)`)

**If no tile requests are being made at all**, there's a JavaScript issue preventing the map from initializing.

---

### Step 4: Inspect Tile Elements in DOM

1. Open DevTools (`F12`)
2. Go to **Elements** tab (or **Inspector** in Firefox)
3. Insert/edit OpenStreetMap block
4. Find the map container in the DOM tree
5. Expand: `.newopm-map-container` → `.leaflet-container` → `.leaflet-pane` → `.leaflet-tile-pane`
6. Look for `<img class="leaflet-tile">` elements

**What to check:**

**A) Are tile `<img>` elements present?**
- ✅ **YES** → Tiles are loading, check their CSS (Step 5)
- ❌ **NO** → JavaScript issue, map not initializing properly

**B) Do tile images have `src` attributes?**
- ✅ **YES** → Check if images are loading (Step 5)
- ❌ **NO** → JavaScript issue with tile URL generation

**C) What do the `src` URLs look like?**
- ✅ **Correct**: `https://a.tile.openstreetmap.org/13/4094/2723.png`
- ❌ **Wrong**: Malformed URLs or missing protocol

---

### Step 5: Check Applied CSS on Tile Elements

1. In DevTools **Elements** tab
2. Select a `<img class="leaflet-tile">` element
3. Look at the **Styles** panel on the right
4. Check what CSS rules are applied

**What to verify:**

```css
img.leaflet-tile {
    width: 256px !important;        /* Should be 256px */
    height: 256px !important;       /* Should be 256px */
    max-width: none !important;     /* Should be none */
    max-height: none !important;    /* Should be none */
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-sizing: content-box !important;
    object-fit: fill !important;
    display: block !important;
}
```

**If you see different values:**
- Check which stylesheet is overriding (shown in the Styles panel)
- Note the selector specificity
- We may need to increase specificity or add more `!important` flags

**Take a screenshot of the Styles panel.**

---

### Step 6: Check if Editor CSS is Loading

1. In DevTools **Network** tab
2. Filter by "CSS"
3. Look for `index.css` (the editor stylesheet)
4. Click on it to view its contents
5. Search for "leaflet-tile" in the file

**What to verify:**
- ✅ File loads successfully (Status `200`)
- ✅ File contains the tile fix CSS
- ❌ File is 404 or not loading
- ❌ File doesn't contain tile fix (build issue)

---

### Step 7: Test in Different Browser

Sometimes browser-specific issues occur:

1. Try opening the editor in a different browser:
   - Chrome
   - Firefox
   - Edge
   - Safari (if on Mac)

2. Does the issue persist in all browsers?
   - **YES** → Server-side or code issue
   - **NO** → Browser-specific issue (cache, extension, etc.)

---

### Step 8: Disable Browser Extensions

Browser extensions can interfere with CSS and JavaScript:

1. Open browser in **Incognito/Private mode** (extensions usually disabled)
2. Log into WordPress
3. Try editing the map block

**Does it work in incognito mode?**
- **YES** → A browser extension is causing the issue
- **NO** → Not an extension issue

---

### Step 9: Check WordPress Theme Compatibility

Some themes have aggressive CSS that overrides everything:

1. Temporarily switch to a default WordPress theme:
   - Twenty Twenty-Four
   - Twenty Twenty-Three
   - Twenty Twenty-Two

2. Test the map block in the editor

**Does it work with default theme?**
- **YES** → Your theme is interfering, we need to increase CSS specificity
- **NO** → Not a theme issue

---

## Common Issues and Solutions

### Issue 1: Tiles Load But Are Scrambled

**Symptoms:**
- Tiles appear but are misaligned/overlapping
- Map looks like a jigsaw puzzle

**Cause:** CSS from theme overriding tile dimensions

**Solution:** Increase CSS specificity (we may need to add more specific selectors)

---

### Issue 2: No Tiles Load At All

**Symptoms:**
- Gray/blank map container
- No tile images in DOM
- No network requests to tile servers

**Cause:** JavaScript error preventing map initialization

**Solution:** Check console for errors, may need to fix JavaScript

---

### Issue 3: Tiles Load But Show Broken Image Icons

**Symptoms:**
- Tile `<img>` elements exist
- But show broken image icon (🖼️❌)
- Network requests fail (404, 403, etc.)

**Cause:** Tile server issue or incorrect tile URLs

**Solution:** Check network tab for failed requests, may need to change tile server

---

### Issue 4: Mixed Content Warning

**Symptoms:**
- Console shows "Mixed Content" warning
- Tiles blocked because site is HTTPS but tiles are HTTP

**Cause:** Tile URLs using HTTP instead of HTTPS

**Solution:** Ensure tile URLs use HTTPS protocol

---

## What Information to Provide

If the issue persists after trying the above steps, please provide:

1. **Screenshots:**
   - Browser console (any errors)
   - Network tab (tile requests)
   - Elements tab (tile DOM structure)
   - Styles panel (CSS applied to tiles)

2. **Details:**
   - WordPress version
   - PHP version
   - Browser and version
   - Active theme name
   - Any relevant error messages

3. **Test Results:**
   - Does it work in incognito mode? (Yes/No)
   - Does it work with default theme? (Yes/No)
   - Are tile requests being made? (Yes/No)
   - Are tile images in the DOM? (Yes/No)

---

## Quick Checklist

- [ ] Cleared browser cache and hard reloaded
- [ ] Checked console for JavaScript errors
- [ ] Checked network tab for tile requests
- [ ] Inspected tile elements in DOM
- [ ] Verified CSS is applied to tiles
- [ ] Verified editor CSS file is loading
- [ ] Tested in different browser
- [ ] Tested in incognito mode
- [ ] Tested with default WordPress theme
- [ ] Took screenshots of any issues

---

## Next Steps

Based on your findings from the above steps, we can:

1. **If it's a CSS specificity issue**: Increase selector specificity
2. **If it's a JavaScript error**: Fix the error in the code
3. **If it's a network issue**: Change tile server or fix CORS
4. **If it's a theme conflict**: Add more specific CSS overrides
5. **If it's a cache issue**: Configure cache-busting

**Please work through the debugging steps above and report back with your findings!**

