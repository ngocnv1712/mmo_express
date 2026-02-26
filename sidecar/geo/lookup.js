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
 * Try ip-api.com for geo lookup
 */
async function tryIpApi(ip) {
  try {
    const url = ip
      ? `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
      : `http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;

    const response = await httpGet(url, 5000);
    const data = JSON.parse(response);

    if (data.status !== 'success') {
      return null;
    }

    return {
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
  } catch (error) {
    console.error('[GEO] ip-api.com failed:', error.message);
    return null;
  }
}

/**
 * Try ipinfo.io for geo lookup (fallback)
 */
async function tryIpInfo(ip) {
  try {
    const url = ip
      ? `https://ipinfo.io/${ip}/json`
      : `https://ipinfo.io/json`;

    const response = await httpsGet(url, 5000);
    const data = JSON.parse(response);

    if (!data.timezone) {
      return null;
    }

    // Parse location "lat,lon"
    const [lat, lon] = (data.loc || '0,0').split(',').map(Number);

    return {
      ip: data.ip,
      country: data.country === 'VN' ? 'Vietnam' : data.country,
      countryCode: data.country,
      region: data.region,
      regionCode: data.region,
      city: data.city,
      zip: data.postal || '',
      latitude: lat,
      longitude: lon,
      timezone: data.timezone,
      isp: data.org || 'Unknown',
      org: data.org || 'Unknown',
      as: '',
    };
  } catch (error) {
    console.error('[GEO] ipinfo.io failed:', error.message);
    return null;
  }
}

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

  // Try ip-api.com first, then fallback to ipinfo.io
  let result = await tryIpApi(ip);
  if (!result) {
    result = await tryIpInfo(ip);
  }

  if (result) {
    // Cache result
    geoCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });
    return result;
  }

  // Return default on all errors
  console.error('[GEO] All lookup services failed, using default');
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
function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function httpsGet(url, timeout = 10000) {
  return httpGet(url, timeout);
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
