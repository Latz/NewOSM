<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Example Integration test.
 *
 * Run with a real WP test DB:
 *   vendor/bin/pest --testsuite=Integration --bootstrap tests/bootstrap-integration.php
 *
 * Requires the WP test suite installed via bin/install-wp-tests.sh.
 * The WP_TESTS_DIR env var must point to that suite.
 */

it('registers the newopm/osm-map block', function (): void {
    // WP is fully loaded here – blocks are registered on 'init'.
    expect(WP_Block_Type_Registry::get_instance()->is_registered('newopm/osm-map'))->toBeTrue();
});

it('registers the newopm/v1 REST routes', function (): void {
    $server = rest_get_server();
    $routes = $server->get_routes();

    expect($routes)->toHaveKey('/newopm/v1/defaults');
    expect($routes)->toHaveKey('/newopm/v1/nominatim/search');
    expect($routes)->toHaveKey('/newopm/v1/nominatim/reverse');
});
