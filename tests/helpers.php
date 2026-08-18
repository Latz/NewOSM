<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Shared test helpers — available in every Unit test closure.
 *
 * Included from bootstrap-unit.php AFTER stubs are loaded so that
 * WP_REST_Request is already defined.
 */

/**
 * Build a concrete WP_REST_Request stub with preset params and headers.
 */
function newopm_make_request(array $params = [], array $headers = []): WP_REST_Request
{
    $request = new WP_REST_Request();
    foreach ($params as $k => $v) {
        $request[$k] = $v;
    }
    foreach ($headers as $k => $v) {
        $request->set_header($k, $v);
    }
    return $request;
}
