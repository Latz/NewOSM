<!DOCTYPE html>
<html>
<head>
    <title>Block Registration Test</title>
    <style>
        body { font-family: monospace; padding: 20px; }
        .success { color: green; }
        .error { color: red; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>NewOSM Block Registration Test</h1>

    <?php
    // Load WordPress
    require_once('../../../wp-load.php');

    echo "<h2>Registered Block Types:</h2>";
    $block_registry = WP_Block_Type_Registry::get_instance();
    $all_blocks = $block_registry->get_all_registered();

    echo "<p>Total registered blocks: " . count($all_blocks) . "</p>";

    // Check if our block is registered
    if (isset($all_blocks['newopm/osm-map'])) {
        echo "<p class='success'>✓ Block 'newopm/osm-map' IS registered!</p>";
        echo "<h3>Block Details:</h3>";
        echo "<pre>";
        print_r($all_blocks['newopm/osm-map']);
        echo "</pre>";
    } else {
        echo "<p class='error'>✗ Block 'newopm/osm-map' is NOT registered</p>";

        echo "<h3>Checking for newopm blocks:</h3>";
        $found = false;
        foreach ($all_blocks as $name => $block) {
            if (strpos($name, 'newopm') !== false) {
                echo "<p class='success'>Found: $name</p>";
                $found = true;
            }
        }
        if (!$found) {
            echo "<p class='error'>No newopm blocks found</p>";
        }
    }

    echo "<h2>Plugin Info:</h2>";
    echo "<pre>";
    echo "Plugin Directory: " . NEWOPM_PLUGIN_DIR . "\n";
    echo "Plugin URL: " . NEWOPM_PLUGIN_URL . "\n";
    echo "Build directory exists: " . (file_exists(NEWOPM_PLUGIN_DIR . 'build') ? 'Yes' : 'No') . "\n";
    echo "block.json exists: " . (file_exists(NEWOPM_PLUGIN_DIR . 'build/block.json') ? 'Yes' : 'No') . "\n";
    echo "index.js exists: " . (file_exists(NEWOPM_PLUGIN_DIR . 'build/index.js') ? 'Yes' : 'No') . "\n";

    if (file_exists(NEWOPM_PLUGIN_DIR . 'build/block.json')) {
        echo "\nblock.json contents:\n";
        echo file_get_contents(NEWOPM_PLUGIN_DIR . 'build/block.json');
    }
    echo "</pre>";

    echo "<h2>Enqueued Scripts:</h2>";
    echo "<pre>";
    global $wp_scripts;
    if ($wp_scripts) {
        foreach ($wp_scripts->registered as $handle => $script) {
            if (strpos($handle, 'newopm') !== false) {
                echo "Handle: $handle\n";
                echo "  Source: " . $script->src . "\n";
                echo "  Dependencies: " . implode(', ', $script->deps) . "\n\n";
            }
        }
    }
    echo "</pre>";
    ?>
</body>
</html>
