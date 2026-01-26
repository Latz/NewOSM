/**
 * Coordinate and map configuration validation utilities
 */

/**
 * Validates latitude value
 * @param {number} latitude - Latitude value to validate
 * @returns {boolean} True if valid latitude (-90 to 90)
 */
export function isValidLatitude(latitude) {
	return typeof latitude === 'number' && latitude >= -90 && latitude <= 90;
}

/**
 * Validates longitude value
 * @param {number} longitude - Longitude value to validate
 * @returns {boolean} True if valid longitude (-180 to 180)
 */
export function isValidLongitude(longitude) {
	return typeof longitude === 'number' && longitude >= -180 && longitude <= 180;
}

/**
 * Validates zoom level
 * @param {number} zoom - Zoom level to validate
 * @returns {boolean} True if valid zoom (1 to 18)
 */
export function isValidZoom(zoom) {
	return typeof zoom === 'number' && zoom >= 1 && zoom <= 18;
}

/**
 * Validates complete map configuration
 * @param {Object} config - Map configuration object
 * @param {number} config.latitude - Latitude coordinate
 * @param {number} config.longitude - Longitude coordinate
 * @param {number} config.zoom - Zoom level
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validateMapConfig(config) {
	const errors = [];

	if (!isValidLatitude(config.latitude)) {
		errors.push('Invalid latitude: must be between -90 and 90');
	}

	if (!isValidLongitude(config.longitude)) {
		errors.push('Invalid longitude: must be between -180 and 180');
	}

	if (!isValidZoom(config.zoom)) {
		errors.push('Invalid zoom: must be between 1 and 18');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
