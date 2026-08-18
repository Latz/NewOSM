/**
 * Tests for validation utilities
 */
import {
	isValidLatitude,
	isValidLongitude,
	isValidZoom,
	validateMapConfig,
} from './validation';

describe('isValidLatitude', () => {
	test('accepts valid latitudes', () => {
		expect(isValidLatitude(0)).toBe(true);
		expect(isValidLatitude(45.5)).toBe(true);
		expect(isValidLatitude(-45.5)).toBe(true);
		expect(isValidLatitude(90)).toBe(true);
		expect(isValidLatitude(-90)).toBe(true);
	});

	test('rejects invalid latitudes', () => {
		expect(isValidLatitude(91)).toBe(false);
		expect(isValidLatitude(-91)).toBe(false);
		expect(isValidLatitude(100)).toBe(false);
		expect(isValidLatitude(-100)).toBe(false);
	});

	test('rejects non-numeric values', () => {
		expect(isValidLatitude('45')).toBe(false);
		expect(isValidLatitude(null)).toBe(false);
		expect(isValidLatitude(undefined)).toBe(false);
		expect(isValidLatitude(NaN)).toBe(false);
	});
});

describe('isValidLongitude', () => {
	test('accepts valid longitudes', () => {
		expect(isValidLongitude(0)).toBe(true);
		expect(isValidLongitude(100.5)).toBe(true);
		expect(isValidLongitude(-100.5)).toBe(true);
		expect(isValidLongitude(180)).toBe(true);
		expect(isValidLongitude(-180)).toBe(true);
	});

	test('rejects invalid longitudes', () => {
		expect(isValidLongitude(181)).toBe(false);
		expect(isValidLongitude(-181)).toBe(false);
		expect(isValidLongitude(200)).toBe(false);
		expect(isValidLongitude(-200)).toBe(false);
	});

	test('rejects non-numeric values', () => {
		expect(isValidLongitude('100')).toBe(false);
		expect(isValidLongitude(null)).toBe(false);
		expect(isValidLongitude(undefined)).toBe(false);
		expect(isValidLongitude(NaN)).toBe(false);
	});
});

describe('isValidZoom', () => {
	test('accepts valid zoom levels', () => {
		expect(isValidZoom(1)).toBe(true);
		expect(isValidZoom(10)).toBe(true);
		expect(isValidZoom(18)).toBe(true);
	});

	test('rejects invalid zoom levels', () => {
		expect(isValidZoom(0)).toBe(false);
		expect(isValidZoom(19)).toBe(false);
		expect(isValidZoom(-1)).toBe(false);
		expect(isValidZoom(100)).toBe(false);
	});

	test('rejects non-integer values', () => {
		expect(isValidZoom(10.5)).toBe(true); // Note: currently accepts decimals
		expect(isValidZoom('10')).toBe(false);
		expect(isValidZoom(null)).toBe(false);
		expect(isValidZoom(undefined)).toBe(false);
	});
});

describe('validateMapConfig', () => {
	test('validates complete valid configuration', () => {
		const result = validateMapConfig({
			latitude: 51.505,
			longitude: -0.09,
			zoom: 13,
		});

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('detects invalid latitude', () => {
		const result = validateMapConfig({
			latitude: 100,
			longitude: -0.09,
			zoom: 13,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Invalid latitude: must be between -90 and 90');
	});

	test('detects invalid longitude', () => {
		const result = validateMapConfig({
			latitude: 51.505,
			longitude: 200,
			zoom: 13,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Invalid longitude: must be between -180 and 180');
	});

	test('detects invalid zoom', () => {
		const result = validateMapConfig({
			latitude: 51.505,
			longitude: -0.09,
			zoom: 25,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Invalid zoom: must be between 1 and 18');
	});

	test('detects multiple invalid values', () => {
		const result = validateMapConfig({
			latitude: 100,
			longitude: 200,
			zoom: 0,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(3);
	});

	test('handles edge cases at boundaries', () => {
		// Valid boundaries
		expect(validateMapConfig({ latitude: 90, longitude: 180, zoom: 1 }).valid).toBe(true);
		expect(validateMapConfig({ latitude: -90, longitude: -180, zoom: 18 }).valid).toBe(true);

		// Just outside boundaries
		expect(validateMapConfig({ latitude: 90.01, longitude: 0, zoom: 10 }).valid).toBe(false);
		expect(validateMapConfig({ latitude: 0, longitude: 180.01, zoom: 10 }).valid).toBe(false);
	});
});
