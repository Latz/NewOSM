# Diagnostic Steps - Please Follow Exactly

## Step 1: Check if script is in the HTML

In the browser console, paste this command and press Enter:
```javascript
console.log('Script element:', document.querySelector('script[src*="newopm"]'));
console.log('All newopm scripts:', Array.from(document.querySelectorAll('script')).filter(s => s.src.includes('newopm')).map(s => s.src));
```

**Copy the output here.**

---

## Step 2: Check if block is registered

In the browser console, paste this and press Enter:
```javascript
console.log('All blocks:', wp.blocks.getBlockTypes().map(b => b.name));
console.log('NewOSM block:', wp.blocks.getBlockTypes().find(b => b.name === 'newopm/osm-map'));
```

**Copy the output here.**

---

## Step 3: Check Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. **Clear** the network log (🚫 icon)
4. Reload the page (F5)
5. In the filter box at the top, type: **index.js**
6. Look for any files with "newopm" or "NewOSM" in the name

**Take a screenshot or list all the files you see with "index.js" in the name and their status codes.**

---

## Step 4: Try loading script directly

Open this URL in a new browser tab:
```
http://localhost/wp/wp-content/plugins/NewOSM/build/index.js
```

**What happens?**
- [ ] JavaScript code appears
- [ ] 404 Not Found error
- [ ] Blank page
- [ ] Something else (describe)

---

## Step 5: View Page Source

1. Right-click on the page → **View Page Source**
2. Press Ctrl+F (or Cmd+F) and search for: **newopm**
3. Do you find anything?

**If yes, copy the line(s) that contain "newopm".**
