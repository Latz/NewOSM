<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Unit tests for the pure sanitize/validate helpers in newopm.php.
 */

it('sanitizes floats from mixed input', function (): void {
    expect(newopm_sanitize_float('12.5'))->toBe(12.5);
    expect(newopm_sanitize_float('not-a-number'))->toBe(0.0);
    expect(newopm_sanitize_float(null))->toBe(0.0);
});

it('validates latitude within -90..90, including zero', function (): void {
    expect(newopm_validate_latitude(0))->toBeTrue();
    expect(newopm_validate_latitude('0'))->toBeTrue();
    expect(newopm_validate_latitude(51.505))->toBeTrue();
    expect(newopm_validate_latitude(-90))->toBeTrue();
    expect(newopm_validate_latitude(90))->toBeTrue();
    expect(newopm_validate_latitude(90.1))->toBeFalse();
    expect(newopm_validate_latitude(-90.1))->toBeFalse();
});

it('validates longitude within -180..180, including zero', function (): void {
    expect(newopm_validate_longitude(0))->toBeTrue();
    expect(newopm_validate_longitude('0'))->toBeTrue();
    expect(newopm_validate_longitude(-0.09))->toBeTrue();
    expect(newopm_validate_longitude(-180))->toBeTrue();
    expect(newopm_validate_longitude(180))->toBeTrue();
    expect(newopm_validate_longitude(180.1))->toBeFalse();
    expect(newopm_validate_longitude(-180.1))->toBeFalse();
});

it('validates zoom within 1..18', function (): void {
    expect(newopm_validate_zoom(1))->toBeTrue();
    expect(newopm_validate_zoom(13))->toBeTrue();
    expect(newopm_validate_zoom(18))->toBeTrue();
    expect(newopm_validate_zoom(0))->toBeFalse();
    expect(newopm_validate_zoom(19))->toBeFalse();
});

it('validates height within 200..1200', function (): void {
    expect(newopm_validate_height(200))->toBeTrue();
    expect(newopm_validate_height(400))->toBeTrue();
    expect(newopm_validate_height(1200))->toBeTrue();
    expect(newopm_validate_height(199))->toBeFalse();
    expect(newopm_validate_height(1201))->toBeFalse();
});

it('validates known size presets and rejects unknown ones', function (): void {
    foreach (['small', 'medium', 'large', 'fullscreen', 'custom'] as $preset) {
        expect(newopm_validate_size_preset($preset))->toBeTrue();
    }
    expect(newopm_validate_size_preset('huge'))->toBeFalse();
    expect(newopm_validate_size_preset(''))->toBeFalse();
});
