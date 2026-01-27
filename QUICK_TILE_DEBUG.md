# Quick Tile Debugging Steps

Since there are no JavaScript errors but tiles are still missing, follow these steps **in order**:

---

## Step 1: Check if Tile Images Exist in DOM

1. Open the editor with the map block
2. Press `F12` to open DevTools
3. Go to **Elements** tab
4. Press `Ctrl+F` to search in the DOM
5. Search for: `leaflet-tile`
6. Look for `<img class="leaflet-tile">` elements

### What to check:

**A) Are there ANY `<img class="leaflet-tile">` elements?**
- ✅ **YES** → Go to Step 2
- ❌ **NO** → The map isn't initializing tiles at all (JavaScript issue)

**B) Do the `<img>` tags have `src` attributes?**
- ✅ **YES** → Go to Step 2
- ❌ **NO** → Tile URLs aren't being generated

**C) What do the `src` URLs look like?**
Example of CORRECT URL:
```
https://a.tile.openstreetmap.org/13/4094/2723.png
```

---

## Step 2: Check Network Requests

1. In DevTools, go to **Network** tab
2. Clear the network log (🚫 icon)
3. Reload the page or re-insert the map block
4. Filter by "Img" or search for "tile.openstreetmap"

### What to check:

**A) Are tile requests being made?**
- ✅ **YES** → Check their status (Step 2B)
- ❌ **NO** → Tiles aren't being requested (CSS might be hiding them)

**B) What is the status of tile requests?**
- ✅ **200 OK** → Tiles are loading successfully, this is a CSS display issue (Go to Step 3)
- ❌ **404 Not Found** → Wrong tile URLs
- ❌ **403 Forbidden** → Blocked by tile server
- ❌ **Mixed Content** → HTTP/HTTPS issue
- ❌ **CORS Error** → Cross-origin issue

---

## Step 3: Check CSS Applied to Tiles

1. In DevTools **Elements** tab
2. Find and click on an `<img class="leaflet-tile">` element
3. Look at the **Styles** panel on the right
4. Check what CSS is applied

### What to check:

**A) Is the tile visible?**
Look for these CSS properties:
```css
display: none;        /* ❌ BAD - tile is hidden */
visibility: hidden;   /* ❌ BAD - tile is hidden */
opacity: 0;          /* ❌ BAD - tile is invisible */
```

**B) Are dimensions correct?**
Should be:
```css
width: 256px !important;
height: 256px !important;
```

**C) Is positioning correct?**
Look for:
```css
position: absolute;
left: XXXpx;
top: XXXpx;
```

**D) Take a screenshot of the Styles panel and share it**

---

## Step 4: Check Leaflet Container

1. In **Elements** tab, find the `.leaflet-container` element
2. Check its computed dimensions

### What to check:

**A) Does the container have a height?**
```css
height: 400px;  /* ✅ GOOD */
height: 0px;    /* ❌ BAD - container collapsed */
```

**B) Is overflow set correctly?**
```css
overflow: hidden;  /* ✅ GOOD */
```

---

## Step 5: Console Commands for Debugging

Open the **Console** tab and run these commands:

### Check if Leaflet is loaded:
```javascript
typeof L
```
**Expected:** `"object"`

### Check if map instance exists:
```javascript
document.querySelector('.leaflet-container')
```
**Expected:** Should return the DOM element

### Check tile pane:
```javascript
document.querySelector('.leaflet-tile-pane')
```
**Expected:** Should return the DOM element

### Count tile images:
```javascript
document.querySelectorAll('.leaflet-tile').length
```
**Expected:** Should be > 0 (usually 6-12 tiles)

### Check tile visibility:
```javascript
Array.from(document.querySelectorAll('.leaflet-tile')).map(img => ({
    src: img.src,
    width: img.offsetWidth,
    height: img.offsetHeight,
    display: getComputedStyle(img).display,
    opacity: getComputedStyle(img).opacity
}))
```
**Expected:** Each tile should have width/height of 256, display: "block", opacity: "1"

---

## Quick Visual Check

### What does the map area look like?

**A) Gray/blank rectangle**
- Leaflet container is there but no tiles
- Check Network tab for failed requests

**B) Nothing at all (no container)**
- Map didn't initialize
- Check console for JavaScript errors

**C) Tiles are there but scrambled/overlapping**
- CSS issue with tile positioning
- Check if our CSS fix is being applied

**D) Tiles are there but invisible/transparent**
- CSS opacity or visibility issue
- Check computed styles

---

## Most Likely Causes (Based on Symptoms)

### If tiles exist in DOM but aren't visible:
1. **CSS `display: none`** - Check if tiles are hidden
2. **CSS `opacity: 0`** - Check if tiles are transparent
3. **Wrong z-index** - Tiles might be behind other elements
4. **Parent container has `height: 0`** - Container collapsed

### If tiles don't exist in DOM at all:
1. **Leaflet CSS not loading** - Check if `leaflet.css` is loaded
2. **Map not initializing** - Check console for errors
3. **React-Leaflet issue** - Component not rendering

### If tile requests are failing:
1. **Network blocked** - Firewall or ad blocker
2. **CORS issue** - Cross-origin blocked
3. **Tile server down** - OpenStreetMap server issue

---

## What to Report Back

Please run through Steps 1-5 and tell me:

1. ✅/❌ Are `<img class="leaflet-tile">` elements in the DOM?
2. ✅/❌ Do they have `src` attributes with valid URLs?
3. ✅/❌ Are tile requests being made in Network tab?
4. ✅/❌ What status codes do tile requests have?
5. 📸 Screenshot of the Styles panel for a tile element
6. 📸 Screenshot of what the map area looks like
7. 🔢 How many tiles does `document.querySelectorAll('.leaflet-tile').length` return?

**This will help me pinpoint the exact issue!**

