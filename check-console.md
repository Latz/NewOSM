# Block Registration Diagnostic Steps

## Step 1: Check Browser Console for Block Registration Messages

Open the WordPress block editor and check the browser console (F12) for these specific messages:

1. Look for: `NewOSM: Attempting to register block newopm/osm-map`
2. Look for: `NewOSM: Block registration result SUCCESS` or `FAILED`

If you DON'T see these messages, the JavaScript file isn't loading at all.

## Step 2: Check for JavaScript Errors

Look for any RED error messages in the console that mention:
- `newopm`
- `registerBlockType`
- Syntax errors
- Module loading errors

## Step 3: Check Network Tab

1. Open DevTools Network tab (F12 -> Network)
2. Reload the page
3. Filter by "index.js"
4. Look for: `newopm-osm-map-editor-script` or similar
5. Check if it loads (status 200) or fails (404, 500, etc.)

## Step 4: Verify Block is Registered

In the browser console, type:
```javascript
wp.blocks.getBlockTypes().filter(b => b.name.includes('newopm'))
```

If this returns an empty array `[]`, the block is not registered.
If it returns an object, the block IS registered but hidden somehow.

## Step 5: Check Block Category

Type this in console:
```javascript
wp.blocks.getCategories()
```

Make sure the 'media' category exists.

## Report Back

Please copy and paste:
1. Any messages that mention "NewOSM" from the console
2. The result of the `wp.blocks.getBlockTypes()` command
3. Any JavaScript errors in red
