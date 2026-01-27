<?php
/**
 * Debug script to check block registration
 * Run this from WordPress admin or via WP-CLI
 */

// Check if running in WordPress context
if (!defined('ABSPATH')) {
    die('This script must be run within WordPress');
}

echo "<h2>NewOSM Block Debug Information</h2>";

// Check if plugin is active
$active_plugins = get_option('active_plugins');
$plugin_file = 'NewOSM/newopm.php';
echo "<h3>1. Plugin Status</h3>";
echo "Plugin active: " . (in_array($plugin_file, $active_plugins) ? '✅ YES' : '❌ NO') . "<br>";

// Check if files exist
echo "<h3>2. Required Files</h3>";
$files_to_check = [
    'newopm.php',
    'build/block.json',
    'build/index.js',
    'build/index.asset.php',
    'build/index.css',
    'build/style-index.css',
    'build/view.js',
];

$plugin_dir = WP_PLUGIN_DIR . '/NewOSM/';
foreach ($files_to_check as $file) {
    $exists = file_exists($plugin_dir . $file);
    echo "$file: " . ($exists ? '✅ EXISTS' : '❌ MISSING') . "<br>";
}

// Check if block is registered
echo "<h3>3. Block Registration</h3>";
$block_registry = WP_Block_Type_Registry::get_instance();
$block_registered = $block_registry->is_registered('newopm/osm-map');
echo "Block registered: " . ($block_registered ? '✅ YES' : '❌ NO') . "<br>";

if ($block_registered) {
    $block = $block_registry->get_registered('newopm/osm-map');
    echo "<h4>Block Details:</h4>";
    echo "<pre>";
    print_r([
        'title' => $block->title,
        'category' => $block->category,
        'editor_script' => $block->editor_script,
        'editor_style' => $block->editor_style,
        'style' => $block->style,
    ]);
    echo "</pre>";
}

// Check registered scripts
echo "<h3>4. Registered Scripts</h3>";
global $wp_scripts;
$script_handles = [
    'newopm-osm-map-editor-script',
    'newopm-osm-map-script',
    'newopm-osm-map-view-script',
];

foreach ($script_handles as $handle) {
    $registered = isset($wp_scripts->registered[$handle]);
    echo "$handle: " . ($registered ? '✅ REGISTERED' : '❌ NOT REGISTERED') . "<br>";
    if ($registered) {
        echo "  - Source: " . $wp_scripts->registered[$handle]->src . "<br>";
    }
}

// Check for PHP errors
echo "<h3>5. PHP Version</h3>";
echo "PHP Version: " . PHP_VERSION . " (Required: 7.4+)<br>";
echo "PHP Version OK: " . (version_compare(PHP_VERSION, '7.4', '>=') ? '✅ YES' : '❌ NO') . "<br>";

// Check WordPress version
echo "<h3>6. WordPress Version</h3>";
global $wp_version;
echo "WordPress Version: $wp_version (Required: 6.1+)<br>";
echo "WordPress Version OK: " . (version_compare($wp_version, '6.1', '>=') ? '✅ YES' : '❌ NO') . "<br>";

