<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Unit tests for newopm_rest_get_defaults().
 *
 * Regression coverage for a zero-coordinate bug: `$marker_lat ? (float) $marker_lat
 * : null` used to discard a real marker at the equator/prime meridian (0 is falsy in
 * PHP) and return null instead of 0.0, same class of bug as the one covered for
 * newopm_validate_latitude/longitude in ValidationTest.php.
 */

use Brain\Monkey\Functions;

it('returns 0.0 for a marker saved exactly at the equator/prime meridian', function (): void {
    Functions\when('get_option')->alias(function (string $option, mixed $default = false): mixed {
        return match ($option) {
            'newopm_default_marker_lat' => 0,
            'newopm_default_marker_lon' => 0,
            default => $default,
        };
    });

    $response = newopm_rest_get_defaults();
    $data     = $response->data ?? $response;

    expect($data['markerLat'])->toBe(0.0);
    expect($data['markerLon'])->toBe(0.0);
});

it('still returns null when no default marker is set', function (): void {
    Functions\when('get_option')->alias(function (string $option, mixed $default = false): mixed {
        return match ($option) {
            'newopm_default_marker_lat', 'newopm_default_marker_lon' => '',
            default => $default,
        };
    });

    $response = newopm_rest_get_defaults();
    $data     = $response->data ?? $response;

    expect($data['markerLat'])->toBeNull();
    expect($data['markerLon'])->toBeNull();
});
