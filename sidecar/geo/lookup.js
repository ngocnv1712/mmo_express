/**
 * Geo Lookup Module
 * Detect geographic information from IP address
 */

const http = require('http');
const https = require('https');

// Cache for geo lookups (5 minutes TTL)
const geoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Lookup geographic info from IP
 * @param {string} ip - IP address (optional, uses public IP if not provided)
 * @returns {Promise<Object>} Geo information
 */
async function lookupIP(ip = null) {
  const cacheKey = ip || 'self';

  // Check cache
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use ip-api.com (free, no API key required)
    const url = ip
      ? `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
      : `http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (data.status !== 'success') {
      throw new Error(data.message || 'Geo lookup failed');
    }

    const result = {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      regionCode: data.region,
      city: data.city,
      zip: data.zip,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
      isp: data.isp,
      org: data.org,
      as: data.as,
    };

    // Cache result
    geoCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });

    return result;
  } catch (error) {
    console.error('[GEO] Lookup failed:', error.message);

    // Return default on error
    return {
      ip: ip || 'unknown',
      country: 'United States',
      countryCode: 'US',
      region: 'California',
      regionCode: 'CA',
      city: 'Los Angeles',
      zip: '90001',
      latitude: 34.0522,
      longitude: -118.2437,
      timezone: 'America/Los_Angeles',
      isp: 'Unknown',
      org: 'Unknown',
      as: '',
    };
  }
}

/**
 * Lookup geo info through proxy
 * @param {Object} proxyConfig - Proxy configuration
 * @returns {Promise<Object>} Geo information
 */
async function lookupProxyGeo(proxyConfig) {
  if (!proxyConfig || !proxyConfig.host) {
    return lookupIP();
  }

  try {
    // For proxy geo lookup, we'd need to make a request through the proxy
    // Since this is complex, we'll use the proxy host IP as a fallback
    // In a real implementation, you'd make an HTTP request through the proxy

    // For now, return a lookup of the proxy host
    // This is a simplified version - production would route through proxy
    return await lookupIP(proxyConfig.host);
  } catch (error) {
    console.error('[GEO] Proxy lookup failed:', error.message);
    return lookupIP();
  }
}

/**
 * Get locale and language for country
 * @param {string} countryCode - ISO country code
 * @returns {Object} Locale info
 */
function getLocaleForCountry(countryCode) {
  const locales = require('./countries').COUNTRY_LOCALES;
  return locales[countryCode.toUpperCase()] || locales['US'];
}

/**
 * Build profile geo settings from lookup
 * @param {Object} geoData - Geo lookup result
 * @returns {Object} Profile geo settings
 */
function buildProfileGeoSettings(geoData) {
  const localeInfo = getLocaleForCountry(geoData.countryCode);

  return {
    timezone: geoData.timezone,
    locale: localeInfo.locale,
    language: localeInfo.language,
    country: geoData.countryCode,
    geoLatitude: geoData.latitude,
    geoLongitude: geoData.longitude,
    geoAccuracy: 100,
    webrtcPublicIP: geoData.ip,
  };
}

/**
 * Auto-detect and apply geo settings to profile
 * @param {Object} profile - Profile to modify
 * @param {Object} proxyConfig - Proxy configuration (optional)
 * @returns {Promise<Object>} Modified profile
 */
async function autoApplyGeo(profile, proxyConfig = null) {
  // Only apply if mode is 'auto'
  if (profile.timezoneMode !== 'auto' && profile.localeMode !== 'auto') {
    return profile;
  }

  try {
    const geoData = proxyConfig
      ? await lookupProxyGeo(proxyConfig)
      : await lookupIP();

    const geoSettings = buildProfileGeoSettings(geoData);

    const updatedProfile = { ...profile };

    // Apply timezone if auto mode
    if (profile.timezoneMode === 'auto') {
      updatedProfile.timezone = geoSettings.timezone;
    }

    // Apply locale if auto mode
    if (profile.localeMode === 'auto') {
      updatedProfile.locale = geoSettings.locale;
      updatedProfile.language = geoSettings.language;
      updatedProfile.country = geoSettings.country;
    }

    // Apply geo coordinates if geoMode is 'allow'
    if (profile.geoMode === 'allow') {
      updatedProfile.geoLatitude = geoSettings.geoLatitude;
      updatedProfile.geoLongitude = geoSettings.geoLongitude;
      updatedProfile.geoAccuracy = geoSettings.geoAccuracy;
    }

    // Set WebRTC IP to proxy IP
    if (profile.webrtcMode === 'replace') {
      updatedProfile.webrtcPublicIP = geoSettings.webrtcPublicIP;
    }

    console.error(`[GEO] Applied: ${geoData.city}, ${geoData.country} (${geoData.timezone})`);

    return updatedProfile;
  } catch (error) {
    console.error('[GEO] Auto-apply failed:', error.message);
    return profile;
  }
}

/**
 * Simple HTTP GET request
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Clear geo cache
 */
function clearCache() {
  geoCache.clear();
}

module.exports = {
  lookupIP,
  lookupProxyGeo,
  getLocaleForCountry,
  buildProfileGeoSettings,
  autoApplyGeo,
  clearCache,
};
