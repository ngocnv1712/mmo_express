/**
 * Profile Schema
 * Defines the structure of a browser fingerprint profile
 */

// WebRTC mode constants
const WebRTCMode = {
  REAL: 'real',       // Use real IP
  REPLACE: 'replace', // Replace with proxy IP
  DISABLE: 'disable'  // Disable WebRTC
};

// Geolocation mode constants
const GeoMode = {
  REAL: 'real',   // Use real location
  ALLOW: 'allow', // Allow with custom location
  BLOCK: 'block', // Block geolocation
  QUERY: 'query'  // Ask permission
};

// Media devices mode constants
const MediaDevicesMode = {
  REAL: 'real',   // Use real devices
  FAKE: 'fake',   // Generate fake devices
  BLOCK: 'block'  // Block device enumeration
};

/**
 * Default profile values
 */
const defaultProfile = {
  // Identity
  id: '',
  name: '',

  // Browser Info
  browserType: 'chrome',      // chrome, firefox, edge
  browserVersion: '120',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Operating System
  os: 'windows',              // windows, macos, linux, android, ios
  platform: 'Win32',          // Win32, MacIntel, Linux x86_64

  // Screen
  viewportWidth: 1920,
  viewportHeight: 1080,
  screenWidth: 1920,
  screenHeight: 1080,
  colorDepth: 24,
  pixelRatio: 1.0,

  // Timezone & Locale
  timezoneMode: 'auto',       // auto (from IP) or manual
  timezone: 'America/New_York',
  localeMode: 'auto',         // auto (from IP) or manual
  locale: 'en-US',
  language: 'en-US,en',
  country: 'US',

  // Hardware
  cpuCores: 8,
  deviceMemory: 8,
  maxTouchPoints: 0,

  // WebGL
  webglImageMode: 'noise',    // real, noise
  webglMetadataMode: 'custom', // real, custom
  webglVendor: 'Google Inc. (NVIDIA)',
  webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)',

  // Fingerprint Noise
  canvasNoise: 0.02,          // 0.02-0.03 recommended
  audioNoise: 0.0001,         // 0.0001-0.001 recommended
  clientRectsNoise: 0.1,      // 0.1-0.3 recommended

  // WebRTC Settings
  webrtcMode: WebRTCMode.REPLACE,
  webrtcPublicIP: '',

  // Geolocation Settings
  geoMode: GeoMode.QUERY,
  geoLatitude: 0,
  geoLongitude: 0,
  geoAccuracy: 100,

  // Media Devices
  mediaDevicesMode: MediaDevicesMode.REAL,
  fakeCameras: 1,
  fakeMicrophones: 1,
  fakeSpeakers: 1,

  // Privacy
  doNotTrack: false,
  blockWebRTC: false,
  blockCanvas: false,
  blockAudioContext: false,
  blockImages: false,
  blockMedia: false,

  // Lists
  fonts: [],
  plugins: ['Chrome PDF Viewer', 'Chromium PDF Viewer'],
  speechVoices: [],

  // Proxy
  proxyId: '',

  // Group & Tags
  groupId: '',
  platformTags: [],           // facebook, tiktok, google, etc.

  // Notes
  notes: '',
  bookmarks: '',

  // Status
  status: 'active',           // active, inactive
  lastUsedAt: '',
  lastIP: '',

  // Metadata
  createdAt: null,
  updatedAt: null,
};

/**
 * Validate profile data
 * @param {Object} profile - Profile to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProfile(profile) {
  const errors = [];

  if (!profile.name || profile.name.trim() === '') {
    errors.push('Profile name is required');
  }

  if (profile.viewportWidth < 320 || profile.viewportWidth > 7680) {
    errors.push('Viewport width must be between 320 and 7680');
  }

  if (profile.viewportHeight < 240 || profile.viewportHeight > 4320) {
    errors.push('Viewport height must be between 240 and 4320');
  }

  if (profile.cpuCores < 1 || profile.cpuCores > 128) {
    errors.push('CPU cores must be between 1 and 128');
  }

  if (profile.deviceMemory < 1 || profile.deviceMemory > 512) {
    errors.push('Device memory must be between 1 and 512');
  }

  if (profile.canvasNoise < 0 || profile.canvasNoise > 1) {
    errors.push('Canvas noise must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a new profile with defaults
 * @param {Partial<Profile>} overrides - Values to override
 * @returns {Profile}
 */
function createProfile(overrides = {}) {
  const now = new Date().toISOString();
  const crypto = require('crypto');
  return {
    ...defaultProfile,
    ...overrides,
    id: overrides.id || crypto.randomUUID(),
    createdAt: overrides.createdAt || now,
    updatedAt: now,
  };
}

module.exports = {
  defaultProfile,
  WebRTCMode,
  GeoMode,
  MediaDevicesMode,
  validateProfile,
  createProfile,
};
