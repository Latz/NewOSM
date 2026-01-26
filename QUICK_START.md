# NewOSM Quick Start Guide

## New Features Added

### Map Size Options

The plugin now includes preset size options and the ability to save default settings for all new maps.

## Using Size Presets

When editing a map block, you'll find a **Size Preset** dropdown with these options:

1. **Small (300×200)** - Compact map for sidebars or small spaces
2. **Medium (100%×400)** - Default, good for most content
3. **Large (100%×600)** - Larger display for featured maps
4. **Fullscreen (100%×800)** - Maximum impact display
5. **Custom** - Set your own width and height

### Custom Dimensions

When you select **Custom** preset:
- **Map Width** field appears - enter values like:
  - `100%` - Full width of container
  - `800px` - Fixed pixel width
  - `50vw` - 50% of viewport width
  - `calc(100% - 40px)` - CSS calc expressions

- **Map Height** slider appears - adjust from 200px to 1200px

## Setting Defaults

### Method 1: From the Block Editor (Quick)

1. Add a NewOSM block to any post
2. Configure the map exactly how you want (size, zoom, etc.)
3. Click **"Save Current Settings as Default"** button
4. Your settings are now the defaults for all new maps!

### Method 2: From Settings Page (Full Control)

1. Go to **Settings > NewOSM** in WordPress admin
2. Configure:
   - **Default Size Preset**: Choose which preset new maps start with
   - **Default Height**: Pixel height (used with Custom preset)
   - **Default Width**: Width value (used with Custom preset)
   - **Default Zoom Level**: Map zoom (1-18)
3. Click **Save Settings**

## Examples

### Example 1: Wide Featured Map
```
Size Preset: Large
Width: 100%
Height: 600px
Zoom: 14
```

### Example 2: Sidebar Widget
```
Size Preset: Small
Width: 300px
Height: 200px
Zoom: 12
```

### Example 3: Half-Width Map
```
Size Preset: Custom
Width: 50%
Height: 450px
Zoom: 13
```

### Example 4: Full Viewport
```
Size Preset: Custom
Width: 100vw
Height: 800px
Zoom: 10
```

## Tips

- **Save your favorite settings**: If you consistently use the same map configuration, save it as default to save time
- **Responsive design**: Use percentage widths (100%) for responsive maps that adapt to screen size
- **Fixed layouts**: Use pixel widths (800px) when you need precise control
- **Quick switching**: Change presets anytime to quickly resize maps
- **Per-map customization**: Default settings don't lock you in - each map can still be customized individually

## Admin Location

- **Block Inserter**: Click '+' → Search "OpenStreetMap"
- **Settings Page**: WordPress Admin → Settings → NewOSM
- **Block Settings**: Select block → Right sidebar → Map Settings panel
