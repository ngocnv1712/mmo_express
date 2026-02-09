/**
 * Mobile Device Presets
 * Accurate device profiles for mobile emulation
 */

const MOBILE_DEVICES = {
  // ============ iPhone Series ============

  'iphone-15-pro-max': {
    id: 'iphone-15-pro-max',
    name: 'iPhone 15 Pro Max',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-15-pro': {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-15': {
    id: 'iphone-15',
    name: 'iPhone 15',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-14-pro-max': {
    id: 'iphone-14-pro-max',
    name: 'iPhone 14 Pro Max',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-14-pro': {
    id: 'iphone-14-pro',
    name: 'iPhone 14 Pro',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-13': {
    id: 'iphone-13',
    name: 'iPhone 13',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-12': {
    id: 'iphone-12',
    name: 'iPhone 12',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  'iphone-se': {
    id: 'iphone-se',
    name: 'iPhone SE (3rd gen)',
    category: 'phone',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'iPhone',
    maxTouchPoints: 5,
  },

  // ============ Samsung Galaxy Series ============

  'samsung-s24-ultra': {
    id: 'samsung-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'samsung-s24-plus': {
    id: 'samsung-s24-plus',
    name: 'Samsung Galaxy S24+',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'samsung-s24': {
    id: 'samsung-s24',
    name: 'Samsung Galaxy S24',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'samsung-s23-ultra': {
    id: 'samsung-s23-ultra',
    name: 'Samsung Galaxy S23 Ultra',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'samsung-a54': {
    id: 'samsung-a54',
    name: 'Samsung Galaxy A54',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  // ============ Google Pixel Series ============

  'pixel-8-pro': {
    id: 'pixel-8-pro',
    name: 'Google Pixel 8 Pro',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'pixel-8': {
    id: 'pixel-8',
    name: 'Google Pixel 8',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'pixel-7-pro': {
    id: 'pixel-7-pro',
    name: 'Google Pixel 7 Pro',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  // ============ Other Android Devices ============

  'xiaomi-14-ultra': {
    id: 'xiaomi-14-ultra',
    name: 'Xiaomi 14 Ultra',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 24030PN60G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'oneplus-12': {
    id: 'oneplus-12',
    name: 'OnePlus 12',
    category: 'phone',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; CPH2583) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  // ============ iPad Series ============

  'ipad-pro-12.9': {
    id: 'ipad-pro-12.9',
    name: 'iPad Pro 12.9"',
    category: 'tablet',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'iPad',
    maxTouchPoints: 5,
  },

  'ipad-pro-11': {
    id: 'ipad-pro-11',
    name: 'iPad Pro 11"',
    category: 'tablet',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'iPad',
    maxTouchPoints: 5,
  },

  'ipad-air': {
    id: 'ipad-air',
    name: 'iPad Air',
    category: 'tablet',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'iPad',
    maxTouchPoints: 5,
  },

  'ipad-mini': {
    id: 'ipad-mini',
    name: 'iPad Mini',
    category: 'tablet',
    os: 'ios',
    browserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'iPad',
    maxTouchPoints: 5,
  },

  // ============ Android Tablets ============

  'samsung-tab-s9-ultra': {
    id: 'samsung-tab-s9-ultra',
    name: 'Samsung Galaxy Tab S9 Ultra',
    category: 'tablet',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36',
    viewport: { width: 1848, height: 2960 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },

  'samsung-tab-s9': {
    id: 'samsung-tab-s9',
    name: 'Samsung Galaxy Tab S9',
    category: 'tablet',
    os: 'android',
    browserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36',
    viewport: { width: 1600, height: 2560 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    platform: 'Linux armv81',
    maxTouchPoints: 10,
  },
};

/**
 * Get device by ID
 * @param {string} deviceId - Device ID
 * @returns {Object|null} Device configuration
 */
function getDevice(deviceId) {
  return MOBILE_DEVICES[deviceId] || null;
}

/**
 * Get devices by category
 * @param {string} category - phone, tablet
 * @returns {Array} Device list
 */
function getDevicesByCategory(category) {
  return Object.values(MOBILE_DEVICES).filter(d => d.category === category);
}

/**
 * Get devices by OS
 * @param {string} os - ios, android
 * @returns {Array} Device list
 */
function getDevicesByOS(os) {
  return Object.values(MOBILE_DEVICES).filter(d => d.os === os);
}

/**
 * Get all devices
 * @returns {Array} All device configurations
 */
function getAllDevices() {
  return Object.values(MOBILE_DEVICES);
}

/**
 * Get random device
 * @param {Object} filters - { category, os }
 * @returns {Object} Random device
 */
function getRandomDevice(filters = {}) {
  let devices = Object.values(MOBILE_DEVICES);

  if (filters.category) {
    devices = devices.filter(d => d.category === filters.category);
  }

  if (filters.os) {
    devices = devices.filter(d => d.os === filters.os);
  }

  return devices[Math.floor(Math.random() * devices.length)];
}

/**
 * Apply device to profile
 * @param {Object} profile - Profile to modify
 * @param {string} deviceId - Device ID to apply
 * @returns {Object} Modified profile
 */
function applyDeviceToProfile(profile, deviceId) {
  const device = getDevice(deviceId);
  if (!device) {
    throw new Error(`Unknown device: ${deviceId}`);
  }

  return {
    ...profile,
    os: device.os,
    browserType: device.browserType,
    userAgent: device.userAgent,
    platform: device.platform,
    viewportWidth: device.viewport.width,
    viewportHeight: device.viewport.height,
    screenWidth: device.viewport.width,
    screenHeight: device.viewport.height,
    pixelRatio: device.deviceScaleFactor,
    maxTouchPoints: device.maxTouchPoints,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
  };
}

module.exports = {
  MOBILE_DEVICES,
  getDevice,
  getDevicesByCategory,
  getDevicesByOS,
  getAllDevices,
  getRandomDevice,
  applyDeviceToProfile,
};
