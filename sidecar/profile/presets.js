/**
 * Profile Presets
 * Pre-configured profiles for common use cases
 */

const crypto = require('crypto');
const { defaultProfile, WebRTCMode, GeoMode, MediaDevicesMode } = require('./schema');

// UUID v4 generator
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * Create a preset profile
 */
function createPreset(name, overrides) {
  const now = new Date().toISOString();
  return {
    ...defaultProfile,
    ...overrides,
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
  };
}

// ============ Preset Profiles ============

const presets = {
  // Windows Presets
  'windows-chrome-nvidia': createPreset('Windows Chrome (NVIDIA RTX)', {
    os: 'windows',
    platform: 'Win32',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 16,
    deviceMemory: 32,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman', 'Consolas'],
    speechVoices: ['Microsoft David', 'Microsoft Zira'],
  }),

  'windows-chrome-amd': createPreset('Windows Chrome (AMD RX)', {
    os: 'windows',
    platform: 'Win32',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 2560,
    viewportHeight: 1440,
    screenWidth: 2560,
    screenHeight: 1440,
    cpuCores: 12,
    deviceMemory: 16,
    webglVendor: 'Google Inc. (AMD)',
    webglRenderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman', 'Consolas'],
    speechVoices: ['Microsoft David', 'Microsoft Zira'],
  }),

  'windows-chrome-intel': createPreset('Windows Chrome (Intel UHD)', {
    os: 'windows',
    platform: 'Win32',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1366,
    viewportHeight: 768,
    screenWidth: 1366,
    screenHeight: 768,
    cpuCores: 4,
    deviceMemory: 8,
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman'],
    speechVoices: ['Microsoft David', 'Microsoft Zira'],
  }),

  'windows-firefox': createPreset('Windows Firefox', {
    os: 'windows',
    platform: 'Win32',
    browserType: 'firefox',
    browserVersion: '121',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 8,
    deviceMemory: 16,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman'],
    speechVoices: ['Microsoft David', 'Microsoft Zira'],
  }),

  // macOS Presets
  'macos-chrome-m2': createPreset('MacBook M2 Chrome', {
    os: 'macos',
    platform: 'MacIntel',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 2560,
    viewportHeight: 1440,
    screenWidth: 2560,
    screenHeight: 1440,
    pixelRatio: 2.0,
    colorDepth: 30,
    cpuCores: 10,
    deviceMemory: 16,
    webglVendor: 'Google Inc. (Apple)',
    webglRenderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
    fonts: ['Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman', 'Monaco'],
    speechVoices: ['Alex', 'Samantha', 'Victoria'],
  }),

  'macos-safari-m2': createPreset('MacBook M2 Safari', {
    os: 'macos',
    platform: 'MacIntel',
    browserType: 'safari',
    browserVersion: '17',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 2560,
    screenHeight: 1600,
    pixelRatio: 2.0,
    colorDepth: 30,
    cpuCores: 8,
    deviceMemory: 8,
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M2',
    fonts: ['Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman', 'Monaco'],
    speechVoices: ['Alex', 'Samantha', 'Victoria'],
  }),

  // Linux Presets
  'linux-chrome': createPreset('Linux Chrome', {
    os: 'linux',
    platform: 'Linux x86_64',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 8,
    deviceMemory: 16,
    webglVendor: 'Mesa/X.org',
    webglRenderer: 'Mesa Intel(R) UHD Graphics 630',
    fonts: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'Arial'],
    speechVoices: [],
  }),

  'linux-firefox': createPreset('Linux Firefox', {
    os: 'linux',
    platform: 'Linux x86_64',
    browserType: 'firefox',
    browserVersion: '121',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    cpuCores: 6,
    deviceMemory: 16,
    doNotTrack: true,
    webglVendor: 'Mesa/X.org',
    webglRenderer: 'Mesa Intel(R) Iris(R) Xe Graphics',
    fonts: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'Arial'],
    speechVoices: [],
  }),

  // Mobile Preset
  'android-chrome': createPreset('Android Chrome Mobile', {
    os: 'android',
    platform: 'Linux armv8l',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.280 Mobile Safari/537.36',
    viewportWidth: 412,
    viewportHeight: 915,
    screenWidth: 412,
    screenHeight: 915,
    pixelRatio: 2.625,
    maxTouchPoints: 5,
    cpuCores: 8,
    deviceMemory: 8,
    webglVendor: 'Qualcomm',
    webglRenderer: 'Adreno (TM) 740',
    fonts: ['Roboto', 'Droid Sans'],
    speechVoices: [],
  }),
};

/**
 * Get all preset names
 */
function getPresetNames() {
  return Object.keys(presets);
}

/**
 * Get a preset by name
 * @param {string} name - Preset name
 * @returns {Profile|null}
 */
function getPreset(name) {
  const preset = presets[name];
  if (!preset) return null;

  // Return a fresh copy with new ID
  const now = new Date().toISOString();
  return {
    ...preset,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all presets
 */
function getAllPresets() {
  return Object.entries(presets).map(([key, value]) => ({
    key,
    ...value,
  }));
}

module.exports = {
  presets,
  getPresetNames,
  getPreset,
  getAllPresets,
};
