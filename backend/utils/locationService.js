// Location and distance calculation utilities for delivery radius validation

// Balayan, Batangas coordinates as the delivery origin point
const DELIVERY_ORIGIN = {
  latitude: 13.9371,
  longitude: 120.7330,
  name: 'Balayan, Batangas'
};

// Maximum delivery radius in kilometers
const MAX_DELIVERY_RADIUS_KM = 100;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Check if a location is within the delivery radius from Balayan, Batangas
 * @param {number} latitude - Latitude of the delivery location
 * @param {number} longitude - Longitude of the delivery location
 * @returns {object} Validation result with distance and eligibility
 */
const validateDeliveryLocation = (latitude, longitude) => {
  const distance = calculateDistance(
    DELIVERY_ORIGIN.latitude,
    DELIVERY_ORIGIN.longitude,
    latitude,
    longitude
  );

  const isWithinRadius = distance <= MAX_DELIVERY_RADIUS_KM;

  return {
    distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
    isWithinRadius,
    maxRadius: MAX_DELIVERY_RADIUS_KM,
    origin: DELIVERY_ORIGIN,
    message: isWithinRadius
      ? `Location is within delivery radius (${distance.toFixed(1)}km from ${DELIVERY_ORIGIN.name})`
      : `Location is outside delivery radius (${distance.toFixed(1)}km from ${DELIVERY_ORIGIN.name}). Maximum delivery radius is ${MAX_DELIVERY_RADIUS_KM}km.`
  };
};

/**
 * Geocode an address to coordinates (placeholder - would need Google Maps API or similar)
 * For now, this is a mock function that would be replaced with actual geocoding service
 * @param {string} address - Address to geocode
 * @returns {Promise<object>} Coordinates and validation result
 */
const geocodeAddress = async (address) => {
  // TODO: Implement actual geocoding using Google Maps API, OpenStreetMap, or similar service
  // For now, return mock data or throw error indicating geocoding is not implemented

  // This would typically make an API call to a geocoding service
  // Example with Google Maps Geocoding API:
  /*
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: data.results[0].formatted_address,
      ...validateDeliveryLocation(location.lat, location.lng)
    };
  } else {
    throw new Error('Unable to geocode address');
  }
  */

  throw new Error('Address geocoding not implemented. Please provide coordinates directly or implement a geocoding service.');
};

/**
 * Validate delivery location from coordinates
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {object} Validation result
 */
const validateDeliveryCoordinates = (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Invalid coordinates: latitude and longitude must be numbers');
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error('Invalid latitude: must be between -90 and 90');
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error('Invalid longitude: must be between -180 and 180');
  }

  return validateDeliveryLocation(latitude, longitude);
};

module.exports = {
  DELIVERY_ORIGIN,
  MAX_DELIVERY_RADIUS_KM,
  calculateDistance,
  validateDeliveryLocation,
  validateDeliveryCoordinates,
  geocodeAddress
};