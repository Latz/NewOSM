<?php
/**
 * Uninstall script for NewOSM plugin
 * 
 * This file is executed when the plugin is uninstalled via the WordPress admin.
 * It removes all plugin options from the database.
 *
 * @package NewOSM
 */

// If uninstall not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Delete all plugin options
$options = array(
    'newopm_default_size_preset',
    'newopm_default_height',
    'newopm_default_width',
    'newopm_default_zoom',
    'newopm_default_latitude',
    'newopm_default_longitude',
    'newopm_default_marker_lat',
    'newopm_default_marker_lon',
    'newopm_default_marker_label',
);

foreach ($options as $option) {
    delete_option($option);
}

// For multisite installations, delete options from all sites
if (is_multisite()) {
    global $wpdb;
    
    $blog_ids = $wpdb->get_col("SELECT blog_id FROM $wpdb->blogs");
    
    foreach ($blog_ids as $blog_id) {
        switch_to_blog($blog_id);
        
        foreach ($options as $option) {
            delete_option($option);
        }
        
        restore_current_blog();
    }
}

