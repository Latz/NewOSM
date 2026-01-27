<?php
/**
 * Diagnostic script to test block registration
 * Place this in wp-content/plugins/NewOSM/ and access via browser
 */

// Load WordPress
require_once('../../../wp-load.php');

header('Content-Type: text/plain');

echo "=== NewOSM Block Registration Diagnostic ===\n\n";

// Check if plugin is active
echo "1. Plugin Active Check:\n";
$active_plugins = get_option('active_plugins');
$is_active = in_array('NewOSM/newopm.php', $active_plugins);
echo "   Plugin is " . ($is_active ? "ACTIVE" : "NOT ACTIVE") . "\n\n";

// Check if block type is registered
echo "2. Block Type Registration:\n";
$registry = WP_Block_Type_Registry::get_instance();
$block = $registry->get_registered('newopm/osm-map');
if ($block) {
    echo "   Block 'newopm/osm-map' is REGISTERED\n";
    echo "   Title: " . $block->title . "\n";
    echo "   Category: " . $block->category . "\n";
    echo "   Editor Script: " . (isset($block->editor_script) ? 'Yes' : 'No') . "\n";
} else {
    echo "   Block 'newopm/osm-map' is NOT REGISTERED\n";
}
echo "\n";

// Check build directory
echo "3. Build Directory Check:\n";
$build_dir = __DIR__ . '/build';
echo "   Build dir exists: " . (is_dir($build_dir) ? 'Yes' : 'No') . "\n";
if (is_dir($build_dir)) {
    echo "   block.json exists: " . (file_exists($build_dir . '/block.json') ? 'Yes' : 'No') . "\n";
    echo "   index.js exists: " . (file_exists($build_dir . '/index.js') ? 'Yes' : 'No') . "\n";
    echo "   index.asset.php exists: " . (file_exists($build_dir . '/index.asset.php') ? 'Yes' : 'No') . "\n";
}
echo "\n";

// Check for PHP errors
echo "4. Plugin Constants:\n";
echo "   NEWOPM_PLUGIN_DIR: " . (defined('NEWOPM_PLUGIN_DIR') ? NEWOPM_PLUGIN_DIR : 'NOT DEFINED') . "\n";
echo "   NEWOPM_PLUGIN_URL: " . (defined('NEWOPM_PLUGIN_URL') ? NEWOPM_PLUGIN_URL : 'NOT DEFINED') . "\n";
echo "\n";

// Check registered blocks
echo "5. All Registered Blocks:\n";
$all_blocks = $registry->get_all_registered();
$newopm_blocks = array_filter(array_keys($all_blocks), function($name) {
    return strpos($name, 'newopm') !== false;
});
if (empty($newopm_blocks)) {
    echo "   No 'newopm' blocks found\n";
} else {
    foreach ($newopm_blocks as $block_name) {
        echo "   - $block_name\n";
    }
}
echo "\n";

// Check registered scripts
echo "6. Registered Scripts:\n";
global $wp_scripts;
if ($wp_scripts) {
    $osm_scripts = array_filter(array_keys($wp_scripts->registered), function($handle) {
        return strpos($handle, 'newopm') !== false || strpos($handle, 'osm') !== false;
    });
    if (empty($osm_scripts)) {
        echo "   No 'newopm' or 'osm' scripts found\n";
    } else {
        foreach ($osm_scripts as $handle) {
            echo "   - $handle\n";
        }
    }
}

echo "\n=== End Diagnostic ===\n";
