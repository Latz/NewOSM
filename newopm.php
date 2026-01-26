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
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

/**
 * Register the block
 */
function newopm_register_block() {
    register_block_type(__DIR__ . '/build');
}
add_action('init', 'newopm_register_block');

/**
 * Enqueue Leaflet CSS for frontend
 */
function newopm_enqueue_leaflet_assets() {
    if (has_block('newopm/osm-map')) {
        wp_enqueue_style(
            'leaflet-css',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            array(),
            '1.9.4'
        );
    }
}
add_action('wp_enqueue_scripts', 'newopm_enqueue_leaflet_assets');

/**
 * Enqueue Leaflet CSS for block editor
 */
function newopm_enqueue_editor_assets() {
    wp_enqueue_style(
        'leaflet-css',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        array(),
        '1.9.4'
    );
}
add_action('enqueue_block_editor_assets', 'newopm_enqueue_editor_assets');

/**
 * Add settings page
 */
function newopm_add_settings_page() {
    add_options_page(
        'NewOSM Settings',
        'NewOSM',
        'manage_options',
        'newopm-settings',
        'newopm_render_settings_page'
    );
}
add_action('admin_menu', 'newopm_add_settings_page');

/**
 * Register settings
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
 * Render settings page
 */
function newopm_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    if (isset($_GET['settings-updated'])) {
        add_settings_error('newopm_messages', 'newopm_message', 'Settings Saved', 'updated');
    }

    settings_errors('newopm_messages');
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <form action="options.php" method="post">
            <?php
            settings_fields('newopm_settings');
            ?>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="newopm_default_size_preset">Default Size Preset</label>
                    </th>
                    <td>
                        <select id="newopm_default_size_preset" name="newopm_default_size_preset">
                            <option value="small" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'small'); ?>>Small (300×200)</option>
                            <option value="medium" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'medium'); ?>>Medium (100%×400)</option>
                            <option value="large" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'large'); ?>>Large (100%×600)</option>
                            <option value="fullscreen" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'fullscreen'); ?>>Fullscreen (100%×800)</option>
                            <option value="custom" <?php selected(get_option('newopm_default_size_preset', 'medium'), 'custom'); ?>>Custom</option>
                        </select>
                        <p class="description">Select a preset size for new maps</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_height">Default Height (px)</label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_height" name="newopm_default_height"
                               value="<?php echo esc_attr(get_option('newopm_default_height', 400)); ?>"
                               min="200" max="1200" step="10" class="small-text">
                        <p class="description">Height in pixels (used when preset is "Custom")</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_width">Default Width</label>
                    </th>
                    <td>
                        <input type="text" id="newopm_default_width" name="newopm_default_width"
                               value="<?php echo esc_attr(get_option('newopm_default_width', '100%')); ?>"
                               class="regular-text">
                        <p class="description">Width (e.g., 100%, 800px, 50vw)</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="newopm_default_zoom">Default Zoom Level</label>
                    </th>
                    <td>
                        <input type="number" id="newopm_default_zoom" name="newopm_default_zoom"
                               value="<?php echo esc_attr(get_option('newopm_default_zoom', 13)); ?>"
                               min="1" max="18" step="1" class="small-text">
                        <p class="description">Zoom level (1-18)</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Save Settings'); ?>
        </form>
    </div>
    <?php
}

/**
 * Sanitize float values for REST API
 */
function newopm_sanitize_float($value) {
    return floatval($value);
}

/**
 * Register REST API endpoints
 */
function newopm_register_rest_routes() {
    // Get defaults endpoint
    register_rest_route('newopm/v1', '/defaults', array(
        'methods' => 'GET',
        'callback' => 'newopm_rest_get_defaults',
        'permission_callback' => function() {
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
                'sanitize_callback' => 'sanitize_text_field'
            ),
            'height' => array(
                'required' => true,
                'type' => 'integer',
                'sanitize_callback' => 'absint'
            ),
            'width' => array(
                'required' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            ),
            'zoom' => array(
                'required' => true,
                'type' => 'integer',
                'sanitize_callback' => 'absint'
            ),
            'latitude' => array(
                'required' => true,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float'
            ),
            'longitude' => array(
                'required' => true,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float'
            ),
            'markerLat' => array(
                'required' => false,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float'
            ),
            'markerLon' => array(
                'required' => false,
                'type' => 'number',
                'sanitize_callback' => 'newopm_sanitize_float'
            ),
            'markerLabel' => array(
                'required' => false,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            )
        )
    ));
}
add_action('rest_api_init', 'newopm_register_rest_routes');

/**
 * REST API: Get defaults
 */
function newopm_rest_get_defaults() {
    $marker_lat = get_option('newopm_default_marker_lat', null);
    $marker_lon = get_option('newopm_default_marker_lon', null);

    return rest_ensure_response(array(
        'sizePreset' => get_option('newopm_default_size_preset', 'medium'),
        'height' => (int) get_option('newopm_default_height', 400),
        'width' => get_option('newopm_default_width', '100%'),
        'zoom' => (int) get_option('newopm_default_zoom', 13),
        'latitude' => (float) get_option('newopm_default_latitude', 51.505),
        'longitude' => (float) get_option('newopm_default_longitude', -0.09),
        'markerLat' => $marker_lat ? (float) $marker_lat : null,
        'markerLon' => $marker_lon ? (float) $marker_lon : null,
        'markerLabel' => get_option('newopm_default_marker_label', ''),
    ));
}

/**
 * REST API: Save defaults
 */
function newopm_rest_save_defaults($request) {
    $size_preset = $request->get_param('sizePreset');
    $height = $request->get_param('height');
    $width = $request->get_param('width');
    $zoom = $request->get_param('zoom');
    $latitude = $request->get_param('latitude');
    $longitude = $request->get_param('longitude');
    $marker_lat = $request->get_param('markerLat');
    $marker_lon = $request->get_param('markerLon');
    $marker_label = $request->get_param('markerLabel');

    update_option('newopm_default_size_preset', $size_preset);
    update_option('newopm_default_height', $height);
    update_option('newopm_default_width', $width);
    update_option('newopm_default_zoom', $zoom);
    update_option('newopm_default_latitude', $latitude);
    update_option('newopm_default_longitude', $longitude);
    update_option('newopm_default_marker_lat', $marker_lat);
    update_option('newopm_default_marker_lon', $marker_lon);
    update_option('newopm_default_marker_label', $marker_label);

    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Settings saved successfully'
    ));
}

