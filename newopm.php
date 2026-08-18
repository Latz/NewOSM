<?php
/**
 * Plugin Name:       NewOSM
 * Description:       A Gutenberg block for embedding OpenStreetMap maps with location search and marker placement.
 * Version:           1.0.0
 * Requires at least: 6.1
 * Requires PHP:      7.4
 * Author:            Your Name
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       newopm
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Force HTTPS for plugin URLs if site is accessed via HTTPS
if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}

// Define plugin constants
define('NEWOPM_VERSION', '1.0.0');
define('NEWOPM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('NEWOPM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('NEWOPM_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Load plugin text domain for translations
 *
 * Loads the plugin's translation files from the /languages directory.
 * This function is hooked into the 'init' action.
 *
 * @since 1.0.0
 * @return void
 */
function newopm_load_textdomain() {
    load_plugin_textdomain('newopm', false, dirname(NEWOPM_PLUGIN_BASENAME) . '/languages');
}
add_action('init', 'newopm_load_textdomain');

/**
 * Register the OpenStreetMap block
 *
 * Registers the block type using the metadata from block.json.
 * This function is hooked into the 'init' action.
 *
 * @since 1.0.0
 * @return void
 */
function newopm_register_block() {
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('NewOSM: newopm_register_block() called');
        error_log('NewOSM: Build dir: ' . NEWOPM_PLUGIN_DIR . 'build');
        error_log('NewOSM: Build dir exists: ' . (file_exists(NEWOPM_PLUGIN_DIR . 'build') ? 'yes' : 'no'));
        error_log('NewOSM: block.json exists: ' . (file_exists(NEWOPM_PLUGIN_DIR . 'build/block.json') ? 'yes' : 'no'));
    }

    $metadata = register_block_type(NEWOPM_PLUGIN_DIR . 'build');

    if (defined('WP_DEBUG') && WP_DEBUG) {
        if ($metadata) {
            error_log('NewOSM: Block registered successfully - ' . $metadata->name);
            error_log('NewOSM: Editor script: ' . print_r($metadata->editor_script, true));
            error_log('NewOSM: Editor style: ' . print_r($metadata->editor_style, true));
        } else {
            error_log('NewOSM: Block registration FAILED');
        }

        // Log registered scripts
        global $wp_scripts;
        if ($wp_scripts) {
            error_log('NewOSM: Checking registered scripts...');
            foreach ($wp_scripts->registered as $handle => $script) {
                if (strpos($handle, 'newopm') !== false || strpos($handle, 'osm-map') !== false) {
                    error_log('NewOSM: Found script - Handle: ' . $handle . ' | Src: ' . $script->src);
                }
            }
        }
    }

    // Force HTTPS for script URLs if needed
    if ($metadata && !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        global $wp_scripts, $wp_styles;

        // Update editor script URL to HTTPS
        if (isset($wp_scripts->registered['newopm-osm-map-editor-script'])) {
            $wp_scripts->registered['newopm-osm-map-editor-script']->src =
                str_replace('http://', 'https://', $wp_scripts->registered['newopm-osm-map-editor-script']->src);
        }

        // Update view script URL to HTTPS
        if (isset($wp_scripts->registered['newopm-osm-map-view-script'])) {
            $wp_scripts->registered['newopm-osm-map-view-script']->src =
                str_replace('http://', 'https://', $wp_scripts->registered['newopm-osm-map-view-script']->src);
        }

        // Update style URLs to HTTPS
        if (isset($wp_styles->registered['newopm-osm-map-editor-style'])) {
            $wp_styles->registered['newopm-osm-map-editor-style']->src =
                str_replace('http://', 'https://', $wp_styles->registered['newopm-osm-map-editor-style']->src);
        }
        if (isset($wp_styles->registered['newopm-osm-map-style'])) {
            $wp_styles->registered['newopm-osm-map-style']->src =
                str_replace('http://', 'https://', $wp_styles->registered['newopm-osm-map-style']->src);
        }
    }
}
add_action('init', 'newopm_register_block');

/**
 * Enqueue vendor chunks manually to ensure correct load order
 *
 * WordPress's automatic script registration may not detect vendor chunks
 * created by webpack code splitting. This function ensures leaflet-vendor.js
 * loads before view.js and editor scripts.
 *
 * Vendor chunks are extracted by webpack's splitChunks configuration to:
 * 1. Reduce bundle size by eliminating Leaflet duplication
 * 2. Improve caching (vendor chunk cached separately)
 * 3. Speed up page loads (less JavaScript to parse)
 *
 * @since 1.2.0
 * @return void
 */
function newopm_enqueue_vendor_chunks() {
	// Check if vendor chunk exists
	$vendor_asset_file = NEWOPM_PLUGIN_DIR . 'build/leaflet-vendor.asset.php';

	if (!file_exists($vendor_asset_file)) {
		// No vendor chunk (might be development build without splitChunks), skip gracefully
		if (defined('WP_DEBUG') && WP_DEBUG) {
			error_log('NewOSM: Vendor chunk not found - tree shaking optimization inactive');
		}
		return;
	}

	$vendor_asset = include($vendor_asset_file);
	$vendor_handle = 'newopm-leaflet-vendor';
	$vendor_style_handle = 'newopm-leaflet-vendor-style';

	// Register vendor chunk as a WordPress script
	wp_register_script(
		$vendor_handle,
		NEWOPM_PLUGIN_URL . 'build/leaflet-vendor.js',
		$vendor_asset['dependencies'] ?? [],
		$vendor_asset['version'] ?? NEWOPM_VERSION,
		true // Load in footer
	);

	// Register the vendor CSS chunk (Leaflet's own base styles, split out by
	// webpack's leafletVendor cache group alongside the JS). Without this,
	// Leaflet's own `.leaflet-container img { max-width: none !important }`
	// protection never loads, and a theme/editor default like
	// `img { max-width: 100% }` silently collapses every marker icon to
	// zero width inside its (unsized) marker pane - no error, no visible
	// marker.
	$vendor_css_file = NEWOPM_PLUGIN_DIR . 'build/leaflet-vendor.css';
	if (file_exists($vendor_css_file)) {
		wp_register_style(
			$vendor_style_handle,
			NEWOPM_PLUGIN_URL . 'build/leaflet-vendor.css',
			[],
			$vendor_asset['version'] ?? NEWOPM_VERSION
		);
	}

	// Force HTTPS if needed
	if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
		global $wp_scripts, $wp_styles;
		if (isset($wp_scripts->registered[$vendor_handle])) {
			$wp_scripts->registered[$vendor_handle]->src =
				str_replace('http://', 'https://', $wp_scripts->registered[$vendor_handle]->src);
		}
		if (isset($wp_styles->registered[$vendor_style_handle])) {
			$wp_styles->registered[$vendor_style_handle]->src =
				str_replace('http://', 'https://', $wp_styles->registered[$vendor_style_handle]->src);
		}
	}

	// Use script_loader_tag filter to auto-enqueue vendor chunk when dependent scripts load
	// This ensures WordPress loads leaflet-vendor.js BEFORE view.js and editor scripts.
	// (CSS is NOT enqueued from here - by the time scripts print, in the footer,
	// wp_head's style-printing pass has already run, so a style enqueued this
	// late would never actually output a <link> tag. The vendor CSS is instead
	// enqueued directly from newopm_localize_editor_script()/
	// newopm_localize_frontend_script(), which already run on the correct
	// enqueue_block_editor_assets/wp_enqueue_scripts hooks.)
	add_filter('script_loader_tag', function($tag, $handle, $src) use ($vendor_handle) {
		// Auto-enqueue vendor chunk when frontend view script loads
		if ($handle === 'newopm-osm-map-view-script') {
			if (!wp_script_is($vendor_handle, 'enqueued')) {
				wp_enqueue_script($vendor_handle);
			}
		}
		// Auto-enqueue vendor chunk when editor script loads
		if ($handle === 'newopm-osm-map-editor-script') {
			if (!wp_script_is($vendor_handle, 'enqueued')) {
				wp_enqueue_script($vendor_handle);
			}
		}
		return $tag;
	}, 10, 3);

	if (defined('WP_DEBUG') && WP_DEBUG) {
		error_log('NewOSM: Vendor chunk registered - ' . $vendor_handle);
	}
}
add_action('init', 'newopm_enqueue_vendor_chunks', 5); // Priority 5, before block registration at 10

/**
 * Localize script data for the block editor
 *
 * Passes PHP data to JavaScript, including the plugin URL for asset paths.
 * This function is hooked into 'enqueue_block_editor_assets'.
 *
 * @since 1.1.5
 * @return void
 */
function newopm_localize_editor_script() {
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('NewOSM: newopm_localize_editor_script() called');
    }

    // The script handle is generated by WordPress scripts as 'newopm-osm-map-editor-script'
    // based on the block name in block.json
    $script_handle = 'newopm-osm-map-editor-script';

    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('NewOSM: Looking for script handle: ' . $script_handle);
        error_log('NewOSM: Script is registered: ' . (wp_script_is($script_handle, 'registered') ? 'yes' : 'no'));
        error_log('NewOSM: Script is enqueued: ' . (wp_script_is($script_handle, 'enqueued') ? 'yes' : 'no'));
    }

    // Try to manually enqueue if not enqueued
    if (!wp_script_is($script_handle, 'enqueued') && wp_script_is($script_handle, 'registered')) {
        wp_enqueue_script($script_handle);
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('NewOSM: Manually enqueued script');
        }
    }

    // Check if the script is registered before localizing
    if (wp_script_is($script_handle, 'registered')) {
        wp_localize_script(
            $script_handle,
            'newOpmData',
            array(
                'pluginUrl' => NEWOPM_PLUGIN_URL,
                'version' => NEWOPM_VERSION,
            )
        );
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('NewOSM: Script localized successfully');
        }
    } else {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('NewOSM: Script NOT registered, cannot localize');
        }
    }

    // Leaflet's own base CSS (registered by newopm_enqueue_vendor_chunks() on
    // 'init') must be enqueued here - not from a script-print-time filter -
    // so it actually makes it into the editor's <head> style output. Without
    // it, Leaflet's `.leaflet-container img { max-width: none !important }`
    // rule never loads, and the editor's own default `img { max-width: 100% }`
    // style silently collapses every marker icon to zero width.
    if (wp_style_is('newopm-leaflet-vendor-style', 'registered')) {
        wp_enqueue_style('newopm-leaflet-vendor-style');
    }
}
add_action('enqueue_block_editor_assets', 'newopm_localize_editor_script', 20);

/**
 * Inline Leaflet's own base CSS into the block editor's iframe
 *
 * The block editor canvas renders inside a separate iframe with its own
 * document/head. WordPress automatically mirrors a block's block.json
 * `editorStyle` into that iframe, but a plain wp_enqueue_style() call
 * (like the one in newopm_localize_editor_script() above, needed for the
 * top-level admin page) is never copied over - the iframe only picks up
 * styles listed in `styles` here. Without Leaflet's own
 * `.leaflet-container img { max-width: none !important }` rule loaded
 * inside the iframe specifically, the editor's default `img { max-width:
 * 100% }` style collapses every marker icon to zero width, even though
 * the marker element itself is created correctly.
 *
 * @since 1.2.0
 * @param array $settings Block editor settings.
 * @return array Modified settings.
 */
function newopm_add_vendor_css_to_editor_iframe($settings) {
    $vendor_css_file = NEWOPM_PLUGIN_DIR . 'build/leaflet-vendor.css';

    if (!file_exists($vendor_css_file)) {
        return $settings;
    }

    $css = file_get_contents($vendor_css_file);
    if ($css === false) {
        return $settings;
    }

    if (!isset($settings['styles']) || !is_array($settings['styles'])) {
        $settings['styles'] = [];
    }

    $settings['styles'][] = ['css' => $css];

    return $settings;
}
add_filter('block_editor_settings_all', 'newopm_add_vendor_css_to_editor_iframe');

/**
 * Debug: Check what scripts are actually enqueued
 */
function newopm_debug_enqueued_scripts() {
    if (!is_admin() || !(defined('WP_DEBUG') && WP_DEBUG)) {
        return;
    }

    error_log('NewOSM: Checking enqueued scripts in wp_footer/admin_print_footer_scripts');
    global $wp_scripts;
    if ($wp_scripts) {
        foreach ($wp_scripts->queue as $handle) {
            if (strpos($handle, 'newopm') !== false) {
                error_log('NewOSM: Script in queue: ' . $handle);
                if (isset($wp_scripts->registered[$handle])) {
                    error_log('NewOSM: Script URL: ' . $wp_scripts->registered[$handle]->src);
                }
            }
        }
    }
}
add_action('admin_print_footer_scripts', 'newopm_debug_enqueued_scripts', 999);

/**
 * Localize script data for the frontend view script
 *
 * Passes PHP data to the frontend JavaScript, including the plugin URL for asset paths.
 * This function is hooked into 'wp_enqueue_scripts' with priority 20 to ensure
 * the script is registered before we try to localize it.
 *
 * @since 1.1.5
 * @return void
 */
function newopm_localize_frontend_script() {
    if (has_block('newopm/osm-map')) {
        // The view script handle is generated by WordPress based on block.json viewScript
        // Format: {namespace}-{blockname}-view-script
        $view_script_handle = 'newopm-osm-map-view-script';

        // Check if the script is registered before localizing
        if (wp_script_is($view_script_handle, 'registered') || wp_script_is($view_script_handle, 'enqueued')) {
            wp_localize_script(
                $view_script_handle,
                'newOpmData',
                array(
                    'pluginUrl' => NEWOPM_PLUGIN_URL,
                    'version' => NEWOPM_VERSION,
                    // Served via the REST API, not the static build file directly - see
                    // newopm_rest_serve_sw()'s docblock for why.
                    'swUrl' => rest_url('newopm/v1/sw'),
                )
            );
        }

        // Leaflet's own base CSS - see the matching comment in
        // newopm_localize_editor_script() for why this must load here.
        if (wp_style_is('newopm-leaflet-vendor-style', 'registered')) {
            wp_enqueue_style('newopm-leaflet-vendor-style');
        }
    }
}
add_action('wp_enqueue_scripts', 'newopm_localize_frontend_script', 20);

/**
 * Add settings page to WordPress admin menu
 *
 * Adds a submenu page under Settings for configuring plugin defaults.
 * This function is hooked into 'admin_menu'.
 *
 * @since 1.0.0
 * @return void
 */
function newopm_add_settings_page() {
    add_options_page(
        __('NewOSM Settings', 'newopm'),
        __('NewOSM', 'newopm'),
        'manage_options',
        'newopm-settings',
        'newopm_render_settings_page'
    );
}
add_action('admin_menu', 'newopm_add_settings_page');

/**
 * Register plugin settings
 *
 * Registers all plugin settings with the WordPress Settings API.
 * This function is hooked into 'admin_init'.
 *
 * @since 1.0.0
 * @return void
 */
function newopm_register_settings() {
    register_setting('newopm_settings', 'newopm_default_size_preset', array(
        'type' => 'string',
        'default' => 'medium',
        'sanitize_callback' => 'sanitize_text_field'
    ));
    register_setting('newopm_settings', 'newopm_default_height', array(
        'type' => 'integer',
        'default' => 400,
        'sanitize_callback' => 'absint'
    ));
    register_setting('newopm_settings', 'newopm_default_width', array(
        'type' => 'string',
        'default' => '100%',
        'sanitize_callback' => 'sanitize_text_field'
    ));
    register_setting('newopm_settings', 'newopm_default_zoom', array(
        'type' => 'integer',
        'default' => 13,
        'sanitize_callback' => 'absint'
    ));
    register_setting('newopm_settings', 'newopm_default_latitude', array(
        'type' => 'number',
        'default' => 51.505,
        'sanitize_callback' => 'floatval'
    ));
    register_setting('newopm_settings', 'newopm_default_longitude', array(
        'type' => 'number',
        'default' => -0.09,
        'sanitize_callback' => 'floatval'
    ));
    register_setting('newopm_settings', 'newopm_default_marker_lat', array(
        'type' => 'number',
        'default' => null,
        'sanitize_callback' => 'floatval'
    ));
    register_setting('newopm_settings', 'newopm_default_marker_lon', array(
        'type' => 'number',
        'default' => null,
        'sanitize_callback' => 'floatval'
    ));
    register_setting('newopm_settings', 'newopm_default_marker_label', array(
        'type' => 'string',
        'default' => '',
        'sanitize_callback' => 'sanitize_text_field'
    ));
}
add_action('admin_init', 'newopm_register_settings');

/**
 * Render the settings page
 *
 * Displays the plugin settings form with all configuration options.
 * Includes size presets, map position, and default marker settings.
 *
 * @since 1.0.0
 * @return void
 */
function newopm_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Reading settings-updated flag set by WordPress Settings API after successful nonce verification
    if (isset($_GET['settings-updated']) && $_GET['settings-updated']) {
        add_settings_error(
            'newopm_messages',
            'newopm_message',
            __('Settings Saved', 'newopm'),
            'updated'
        );
    }

    settings_errors('newopm_messages');
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <form action="options.php" method="post">
            <?php settings_fields('newopm_settings'); ?>

            <h2><?php esc_html_e('Map Size Settings', 'newopm'); ?></h2>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="newopm_default_size_preset"><?php esc_html_e('Default Size Preset', 'newopm'); ?></label>
                    </th>
                    <td>
                        <select id="newopm_default_size_preset" name="newopm_default_size_preset">
                            <option value="small" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'small'); ?>><?php esc_html_e('Small (300×200)', 'newopm'); ?></option>
                            <option value="medium" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'medium'); ?>><?php esc_html_e('Medium (100%×400)', 'newopm'); ?></option>
                            <option value="large" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'large'); ?>><?php esc_html_e('Large (100%×600)', 'newopm'); ?></option>
                            <option value="fullscreen" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'fullscreen'); ?>><?php esc_html_e('Fullscreen (100%×800)', 'newopm'); ?></option>
                            <option value="custom" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'custom'); ?>><?php esc_html_e('Custom', 'newopm'); ?></option>
                        </select>
                        <p class="description"><?php esc_html_e('Select a preset size for new maps', 'newopm'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_height"><?php esc_html_e('Default Height (px)', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_height" name="newopm_default_height"
                               value="<?php echo esc_attr(get_option('newopm_default_height', 400)); ?>"
                               min="200" max="1200" step="10" class="small-text">
                        <p class="description"><?php esc_html_e('Height in pixels (used when preset is "Custom")', 'newopm'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_width"><?php esc_html_e('Default Width', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="text" id="newopm_default_width" name="newopm_default_width"
                               value="<?php echo esc_attr(get_option('newopm_default_width', '100%')); ?>"
                               class="regular-text">
                        <p class="description"><?php esc_html_e('Width (e.g., 100%, 800px, 50vw)', 'newopm'); ?></p>
                    </td>
                </tr>
            </table>

            <h2><?php esc_html_e('Map Position Settings', 'newopm'); ?></h2>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="newopm_default_latitude"><?php esc_html_e('Default Latitude', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_latitude" name="newopm_default_latitude"
                               value="<?php echo esc_attr(get_option('newopm_default_latitude', 51.505)); ?>"
                               min="-90" max="90" step="0.000001" class="regular-text">
                        <p class="description"><?php esc_html_e('Default map center latitude (-90 to 90)', 'newopm'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_longitude"><?php esc_html_e('Default Longitude', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_longitude" name="newopm_default_longitude"
                               value="<?php echo esc_attr(get_option('newopm_default_longitude', -0.09)); ?>"
                               min="-180" max="180" step="0.000001" class="regular-text">
                        <p class="description"><?php esc_html_e('Default map center longitude (-180 to 180)', 'newopm'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_zoom"><?php esc_html_e('Default Zoom Level', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_zoom" name="newopm_default_zoom"
                               value="<?php echo esc_attr(get_option('newopm_default_zoom', 13)); ?>"
                               min="1" max="18" step="1" class="small-text">
                        <p class="description"><?php esc_html_e('Zoom level (1-18)', 'newopm'); ?></p>
                    </td>
                </tr>
            </table>

            <h2><?php esc_html_e('Default Marker Settings', 'newopm'); ?></h2>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="newopm_default_marker_lat"><?php esc_html_e('Default Marker Latitude', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_marker_lat" name="newopm_default_marker_lat"
                               value="<?php echo esc_attr(get_option('newopm_default_marker_lat', '')); ?>"
                               min="-90" max="90" step="0.000001" class="regular-text">
                        <p class="description"><?php esc_html_e('Default marker latitude (leave empty for no marker)', 'newopm'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_marker_lon"><?php esc_html_e('Default Marker Longitude', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_marker_lon" name="newopm_default_marker_lon"
                               value="<?php echo esc_attr(get_option('newopm_default_marker_lon', '')); ?>"
                               min="-180" max="180" step="0.000001" class="regular-text">
                        <p class="description"><?php esc_html_e('Default marker longitude (leave empty for no marker)', 'newopm'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_marker_label"><?php esc_html_e('Default Marker Label', 'newopm'); ?></label>
                    </th>
                    <td>
                        <input type="text" id="newopm_default_marker_label" name="newopm_default_marker_label"
                               value="<?php echo esc_attr(get_option('newopm_default_marker_label', '')); ?>"
                               class="regular-text">
                        <p class="description"><?php esc_html_e('Default text for marker popup', 'newopm'); ?></p>
                    </td>
                </tr>
            </table>

            <?php submit_button(__('Save Settings', 'newopm')); ?>
        </form>
    </div>
    <?php
}

/**
 * Sanitize float values for REST API
 *
 * @param mixed $value Value to sanitize
 * @return float Sanitized float value
 */
function newopm_sanitize_float($value) {
    return floatval($value);
}

/**
 * Validate latitude value
 *
 * @param mixed $value Value to validate
 * @return bool True if valid, false otherwise
 */
function newopm_validate_latitude($value) {
    $lat = floatval($value);
    return $lat >= -90 && $lat <= 90;
}

/**
 * Validate longitude value
 *
 * @param mixed $value Value to validate
 * @return bool True if valid, false otherwise
 */
function newopm_validate_longitude($value) {
    $lon = floatval($value);
    return $lon >= -180 && $lon <= 180;
}

/**
 * Validate zoom level
 *
 * @param mixed $value Value to validate
 * @return bool True if valid, false otherwise
 */
function newopm_validate_zoom($value) {
    $zoom = intval($value);
    return $zoom >= 1 && $zoom <= 18;
}

/**
 * Validate height value
 *
 * @param mixed $value Value to validate
 * @return bool True if valid, false otherwise
 */
function newopm_validate_height($value) {
    $height = intval($value);
    return $height >= 200 && $height <= 1200;
}

/**
 * Validate size preset
 *
 * @param mixed $value Value to validate
 * @return bool True if valid, false otherwise
 */
function newopm_validate_size_preset($value) {
    $valid_presets = array('small', 'medium', 'large', 'fullscreen', 'custom');
    return in_array($value, $valid_presets, true);
}

/**
 * Register REST API endpoints
 *
 * Registers custom REST API routes for getting and saving plugin defaults.
 * This function is hooked into 'rest_api_init'.
 *
 * @since 1.0.0
 * @return void
 */
function newopm_register_rest_routes() {
    // Get defaults endpoint
    register_rest_route('newopm/v1', '/defaults', array(
        'methods' => 'GET',
        'callback' => 'newopm_rest_get_defaults',
        'permission_callback' => function() {
            // Require user to be able to edit posts (same capability needed to use block editor)
            return current_user_can('edit_posts');
        }
    ));

    // Save defaults endpoint
    register_rest_route('newopm/v1', '/defaults', array(
        'methods' => 'POST',
        'callback' => 'newopm_rest_save_defaults',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
        'args' => array(
            'sizePreset' => array(
                'required' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => 'newopm_validate_size_preset'
            ),
            'height' => array(
                'required' => true,
                'type' => 'integer',
                'sanitize_callback' => 'absint',
                'validate_callback' => 'newopm_validate_height'
            ),
            'width' => array(
                'required' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            ),
            'zoom' => array(
                'required' => true,
                'type' => 'integer',
                'sanitize_callback' => 'absint',
                'validate_callback' => 'newopm_validate_zoom'
            ),
            'latitude' => array(
                'required' => true,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float',
                'validate_callback' => 'newopm_validate_latitude'
            ),
            'longitude' => array(
                'required' => true,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float',
                'validate_callback' => 'newopm_validate_longitude'
            ),
            'markerLat' => array(
                'required' => false,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float',
                'validate_callback' => function($value) {
                    return $value === null || $value === '' || newopm_validate_latitude($value);
                }
            ),
            'markerLon' => array(
                'required' => false,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float',
                'validate_callback' => function($value) {
                    return $value === null || $value === '' || newopm_validate_longitude($value);
                }
            ),
            'markerLabel' => array(
                'required' => false,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            )
        )
    ));

    // Nominatim search proxy endpoint
    register_rest_route('newopm/v1', '/nominatim/search', array(
        'methods' => 'GET',
        'callback' => 'newopm_rest_nominatim_search',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        },
        'args' => array(
            'q' => array(
                'required' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            )
        )
    ));

    // Nominatim reverse geocoding proxy endpoint
    register_rest_route('newopm/v1', '/nominatim/reverse', array(
        'methods' => 'GET',
        'callback' => 'newopm_rest_nominatim_reverse',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        },
        'args' => array(
            'lat' => array(
                'required' => true,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float',
                'validate_callback' => 'newopm_validate_latitude'
            ),
            'lon' => array(
                'required' => true,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float',
                'validate_callback' => 'newopm_validate_longitude'
            )
        )
    ));

    // Service worker endpoint - see newopm_rest_serve_sw()'s docblock for why
    // this is served through the REST API rather than as a static build file.
    register_rest_route('newopm/v1', '/sw', array(
        'methods' => 'GET',
        'callback' => 'newopm_rest_serve_sw',
        'permission_callback' => '__return_true'
    ));
}
add_action('rest_api_init', 'newopm_register_rest_routes');

/**
 * REST API: Get defaults
 *
 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure
 */
function newopm_rest_get_defaults() {
    try {
        $marker_lat = get_option('newopm_default_marker_lat', null);
        $marker_lon = get_option('newopm_default_marker_lon', null);

        $response = array(
            'sizePreset' => get_option('newopm_default_size_preset', 'medium'),
            'height' => (int) get_option('newopm_default_height', 400),
            'width' => get_option('newopm_default_width', '100%'),
            'zoom' => (int) get_option('newopm_default_zoom', 13),
            'latitude' => (float) get_option('newopm_default_latitude', 51.505),
            'longitude' => (float) get_option('newopm_default_longitude', -0.09),
            'markerLat' => $marker_lat !== null && $marker_lat !== '' ? (float) $marker_lat : null,
            'markerLon' => $marker_lon !== null && $marker_lon !== '' ? (float) $marker_lon : null,
            'markerLabel' => get_option('newopm_default_marker_label', ''),
        );

        return rest_ensure_response($response);
    } catch (Exception $e) {
        return new WP_Error(
            'newopm_get_defaults_error',
            __('Failed to retrieve default settings', 'newopm'),
            array('status' => 500)
        );
    }
}

/**
 * REST API: Save defaults
 *
 * @param WP_REST_Request $request Request object
 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure
 */
function newopm_rest_save_defaults($request) {
    try {
        $size_preset = $request->get_param('sizePreset');
        $height = $request->get_param('height');
        $width = $request->get_param('width');
        $zoom = $request->get_param('zoom');
        $latitude = $request->get_param('latitude');
        $longitude = $request->get_param('longitude');
        $marker_lat = $request->get_param('markerLat');
        $marker_lon = $request->get_param('markerLon');
        $marker_label = $request->get_param('markerLabel');

        // Update options
        $updates = array(
            'newopm_default_size_preset' => $size_preset,
            'newopm_default_height' => $height,
            'newopm_default_width' => $width,
            'newopm_default_zoom' => $zoom,
            'newopm_default_latitude' => $latitude,
            'newopm_default_longitude' => $longitude,
            'newopm_default_marker_lat' => $marker_lat,
            'newopm_default_marker_lon' => $marker_lon,
            'newopm_default_marker_label' => $marker_label,
        );

        foreach ($updates as $option_name => $option_value) {
            $result = update_option($option_name, $option_value);
            // Loose comparison: get_option() always returns the stored scalar as a
            // string, so a strict !== against a typed REST param (int/float) would
            // misreport update_option()'s "value unchanged" false as a real failure.
            if ($result === false && get_option($option_name) != $option_value) {
                throw new Exception(sprintf(
                    /* translators: %s: option name */
                    __('Failed to update option: %s', 'newopm'),
                    $option_name
                ));
            }
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => __('Settings saved successfully', 'newopm')
        ));
    } catch (Exception $e) {
        return new WP_Error(
            'newopm_save_defaults_error',
            $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * REST API: Nominatim search proxy
 *
 * Proxies search requests to Nominatim API to avoid CORS issues.
 *
 * @param WP_REST_Request $request Request object
 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure
 */
function newopm_rest_nominatim_search($request) {
    $query = $request->get_param('q');

    $url = sprintf(
        'https://nominatim.openstreetmap.org/search?format=json&q=%s&limit=1',
        urlencode($query)
    );

    $response = wp_remote_get($url, array(
        'headers' => array(
            'User-Agent' => 'WordPress-NewOSM-Plugin/1.0'
        ),
        'timeout' => 10
    ));

    if (is_wp_error($response)) {
        return new WP_Error(
            'newopm_nominatim_error',
            __('Failed to connect to geocoding service', 'newopm'),
            array('status' => 500)
        );
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code === 429) {
        return new WP_Error(
            'newopm_rate_limit',
            __('Rate limited. Please wait a moment before trying again.', 'newopm'),
            array('status' => 429)
        );
    }

    if ($status_code !== 200) {
        return new WP_Error(
            'newopm_nominatim_error',
            sprintf(__('Geocoding service error: HTTP %d', 'newopm'), $status_code),
            array('status' => $status_code)
        );
    }

    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return new WP_Error(
            'newopm_parse_error',
            __('Failed to parse geocoding response', 'newopm'),
            array('status' => 500)
        );
    }

    return rest_ensure_response($data);
}

/**
 * REST API: Nominatim reverse geocoding proxy
 *
 * Proxies reverse geocoding requests to Nominatim API to avoid CORS issues.
 *
 * @param WP_REST_Request $request Request object
 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure
 */
function newopm_rest_nominatim_reverse($request) {
    $lat = $request->get_param('lat');
    $lon = $request->get_param('lon');

    $url = sprintf(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=%s&lon=%s&zoom=18&addressdetails=1',
        $lat,
        $lon
    );

    $response = wp_remote_get($url, array(
        'headers' => array(
            'User-Agent' => 'WordPress-NewOSM-Plugin/1.0'
        ),
        'timeout' => 10
    ));

    if (is_wp_error($response)) {
        return new WP_Error(
            'newopm_nominatim_error',
            __('Failed to connect to geocoding service', 'newopm'),
            array('status' => 500)
        );
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code === 429) {
        return new WP_Error(
            'newopm_rate_limit',
            __('Rate limited. Please wait a moment before trying again.', 'newopm'),
            array('status' => 429)
        );
    }

    if ($status_code !== 200) {
        return new WP_Error(
            'newopm_nominatim_error',
            sprintf(__('Geocoding service error: HTTP %d', 'newopm'), $status_code),
            array('status' => $status_code)
        );
    }

    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return new WP_Error(
            'newopm_parse_error',
            __('Failed to parse geocoding response', 'newopm'),
            array('status' => 500)
        );
    }

    return rest_ensure_response($data);
}

/**
 * REST API: Serve the service worker script
 *
 * A service worker can only claim a scope at or below its own script's directory
 * unless the response carries a `Service-Worker-Allowed` header - and the plugin
 * directory may (and, hardened against direct PHP execution as a security measure,
 * often should) refuse to execute a standalone .php file placed there directly.
 * Routing this through the REST API instead means it's served via the site's own
 * index.php, exactly like every other endpoint in this file, so it isn't affected
 * by that kind of directory-level hardening. newopm_add_sw_headers() below attaches
 * the actual Service-Worker-Allowed header and streams the file unencoded.
 *
 * @return WP_REST_Response|WP_Error Response wrapping the raw file content, or
 *                                    WP_Error if the build file is missing.
 */
function newopm_rest_serve_sw() {
    $sw_file = NEWOPM_PLUGIN_DIR . 'build/service-worker.js';

    if (!file_exists($sw_file)) {
        return new WP_Error(
            'newopm_sw_missing',
            __('Service worker build file not found', 'newopm'),
            array('status' => 404)
        );
    }

    return rest_ensure_response(array('content' => file_get_contents($sw_file)));
}

/**
 * Stream the /newopm/v1/sw response as raw JavaScript instead of JSON
 *
 * Hooked into 'rest_pre_serve_request', which fires after the route callback has
 * run but before WP_REST_Server encodes the result as JSON - letting us override
 * the response entirely for this one route while every other REST route in the
 * plugin is untouched.
 *
 * @param bool             $served  Whether the request has already been served.
 * @param WP_REST_Response $result  Response object for the current request.
 * @param WP_REST_Request  $request Request used to generate the response.
 * @return bool True (request served) for the /sw route, otherwise $served unchanged.
 */
function newopm_add_sw_headers($served, $result, $request) {
    if ($request->get_route() !== '/newopm/v1/sw') {
        return $served;
    }

    if (!($result instanceof WP_REST_Response) || $result->is_error()) {
        return $served;
    }

    $data = $result->get_data();
    if (!isset($data['content'])) {
        return $served;
    }

    header('Content-Type: application/javascript; charset=utf-8');
    header('Service-Worker-Allowed: /');
    header('Cache-Control: no-cache');
    echo $data['content'];

    return true;
}
add_filter('rest_pre_serve_request', 'newopm_add_sw_headers', 10, 3);
