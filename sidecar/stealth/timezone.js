/**
 * Timezone and Geolocation Module
 * Overrides timezone and geolocation APIs
 */

// Timezone offsets in minutes (negative = east of UTC)
const TIMEZONE_OFFSETS = {
  'Asia/Ho_Chi_Minh': -420,
  'Asia/Bangkok': -420,
  'Asia/Singapore': -480,
  'Asia/Tokyo': -540,
  'Asia/Seoul': -540,
  'Asia/Shanghai': -480,
  'America/New_York': 300,
  'America/Los_Angeles': 480,
  'America/Chicago': 360,
  'America/Denver': 420,
  'Europe/London': 0,
  'Europe/Paris': -60,
  'Europe/Berlin': -60,
  'Europe/Moscow': -180,
  'Australia/Sydney': -660,
  'Australia/Melbourne': -660,
  'Pacific/Auckland': -720,
};

function buildTimezoneScript(profile) {
  const timezone = profile.timezone || 'America/New_York';
  const offset = TIMEZONE_OFFSETS[timezone] || 0;

  const geoMode = profile.geoMode || 'query';
  const geoLatitude = profile.geoLatitude || 0;
  const geoLongitude = profile.geoLongitude || 0;
  const geoAccuracy = profile.geoAccuracy || 100;

  return `
// ======== TIMEZONE OVERRIDE ========

const TIMEZONE = '${timezone}';
const TIMEZONE_OFFSET = ${offset};

// Override Intl.DateTimeFormat
const OriginalDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function(locale, options) {
  options = options || {};
  options.timeZone = TIMEZONE;
  return new OriginalDateTimeFormat(locale, options);
};
Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;

// Override Date.prototype.getTimezoneOffset
Date.prototype.getTimezoneOffset = function() {
  return TIMEZONE_OFFSET;
};

// Override toLocaleString methods to use correct timezone
const originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function(locale, options) {
  options = options || {};
  options.timeZone = options.timeZone || TIMEZONE;
  return originalToLocaleString.call(this, locale, options);
};

const originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function(locale, options) {
  options = options || {};
  options.timeZone = options.timeZone || TIMEZONE;
  return originalToLocaleDateString.call(this, locale, options);
};

const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function(locale, options) {
  options = options || {};
  options.timeZone = options.timeZone || TIMEZONE;
  return originalToLocaleTimeString.call(this, locale, options);
};

console.debug('[Stealth] Timezone set to:', TIMEZONE);

// ======== GEOLOCATION ========

const GEO_MODE = '${geoMode}';
const GEO_LATITUDE = ${geoLatitude};
const GEO_LONGITUDE = ${geoLongitude};
const GEO_ACCURACY = ${geoAccuracy};

if (GEO_MODE === 'block') {
  // Block geolocation requests
  navigator.geolocation.getCurrentPosition = function(success, error) {
    if (error) {
      error({
        code: 1,
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1
      });
    }
  };

  navigator.geolocation.watchPosition = function(success, error) {
    if (error) {
      error({
        code: 1,
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1
      });
    }
    return 0;
  };

  navigator.geolocation.clearWatch = function() {};

  console.debug('[Stealth] Geolocation blocked');
} else if (GEO_MODE === 'allow' && GEO_LATITUDE && GEO_LONGITUDE) {
  // Return custom geolocation
  const customPosition = {
    coords: {
      latitude: GEO_LATITUDE,
      longitude: GEO_LONGITUDE,
      accuracy: GEO_ACCURACY,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp: Date.now()
  };

  navigator.geolocation.getCurrentPosition = function(success, error, options) {
    setTimeout(() => success(customPosition), 100);
  };

  navigator.geolocation.watchPosition = function(success, error, options) {
    success(customPosition);
    return 1;
  };

  navigator.geolocation.clearWatch = function(id) {};

  console.debug('[Stealth] Geolocation set to:', GEO_LATITUDE, GEO_LONGITUDE);
}
// 'real' and 'query' modes use default browser behavior
`;
}

module.exports = { buildTimezoneScript, TIMEZONE_OFFSETS };
