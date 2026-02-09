/**
 * Profile Generator
 * Generates random realistic browser fingerprint profiles
 */

const crypto = require('crypto');
const { defaultProfile, WebRTCMode, GeoMode, MediaDevicesMode } = require('./schema');

// UUID v4 generator (compatible with Node.js without ESM uuid)
function uuidv4() {
  return crypto.randomUUID();
}

// ============ Data Sets ============

const windowsUAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

const macUAs = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

const linuxUAs = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

const geoProfiles = [
  { timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', language: 'vi-VN,vi,en-US,en', country: 'VN' },
  { timezone: 'Asia/Bangkok', locale: 'th-TH', language: 'th-TH,th,en-US,en', country: 'TH' },
  { timezone: 'Asia/Singapore', locale: 'en-SG', language: 'en-SG,en,zh-CN,zh', country: 'SG' },
  { timezone: 'Asia/Tokyo', locale: 'ja-JP', language: 'ja-JP,ja,en-US,en', country: 'JP' },
  { timezone: 'Asia/Seoul', locale: 'ko-KR', language: 'ko-KR,ko,en-US,en', country: 'KR' },
  { timezone: 'Asia/Shanghai', locale: 'zh-CN', language: 'zh-CN,zh,en-US,en', country: 'CN' },
  { timezone: 'America/New_York', locale: 'en-US', language: 'en-US,en', country: 'US' },
  { timezone: 'America/Los_Angeles', locale: 'en-US', language: 'en-US,en', country: 'US' },
  { timezone: 'America/Chicago', locale: 'en-US', language: 'en-US,en', country: 'US' },
  { timezone: 'Europe/London', locale: 'en-GB', language: 'en-GB,en', country: 'GB' },
  { timezone: 'Europe/Paris', locale: 'fr-FR', language: 'fr-FR,fr,en-US,en', country: 'FR' },
  { timezone: 'Europe/Berlin', locale: 'de-DE', language: 'de-DE,de,en-US,en', country: 'DE' },
  { timezone: 'Australia/Sydney', locale: 'en-AU', language: 'en-AU,en', country: 'AU' },
];

const resolutions = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 3840, height: 2160 },
];

const nvidiaGPUs = [
  'NVIDIA GeForce RTX 4090',
  'NVIDIA GeForce RTX 4080',
  'NVIDIA GeForce RTX 4070',
  'NVIDIA GeForce RTX 3090',
  'NVIDIA GeForce RTX 3080',
  'NVIDIA GeForce RTX 3070',
  'NVIDIA GeForce RTX 3060',
  'NVIDIA GeForce GTX 1660',
  'NVIDIA GeForce GTX 1650',
  'NVIDIA GeForce GTX 1060 6GB',
];

const amdGPUs = [
  'AMD Radeon RX 7900 XTX',
  'AMD Radeon RX 7900 XT',
  'AMD Radeon RX 6900 XT',
  'AMD Radeon RX 6800 XT',
  'AMD Radeon RX 6700 XT',
  'AMD Radeon RX 6600 XT',
];

const intelGPUs = [
  'Intel(R) UHD Graphics 770',
  'Intel(R) UHD Graphics 730',
  'Intel(R) UHD Graphics 630',
  'Intel(R) UHD Graphics 620',
  'Intel(R) Iris(R) Xe Graphics',
  'Intel(R) Iris(R) Plus Graphics',
];

const appleGPUs = [
  'Apple M3 Pro',
  'Apple M3',
  'Apple M2 Pro',
  'Apple M2',
  'Apple M1 Pro',
  'Apple M1',
];

const windowsFonts = [
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
  'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
  'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
];

const macFonts = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco',
  'Palatino', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
];

const linuxFonts = [
  'Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Serif', 'FreeMono',
  'FreeSans', 'FreeSerif', 'Liberation Mono', 'Liberation Sans',
  'Liberation Serif', 'Times New Roman', 'Ubuntu', 'Verdana',
];

const windowsVoices = ['Microsoft David', 'Microsoft Zira', 'Microsoft Mark'];
const macVoices = ['Alex', 'Samantha', 'Victoria', 'Daniel'];

// ============ Helper Functions ============

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

// ============ Generator Functions ============

/**
 * Generate a random profile for Windows
 */
function generateWindows() {
  const gpuType = randomInt(0, 2);
  let webglVendor, webglRenderer, cpuCores, deviceMemory;

  switch (gpuType) {
    case 0: // NVIDIA
      webglVendor = 'Google Inc. (NVIDIA)';
      webglRenderer = `ANGLE (NVIDIA, ${randomItem(nvidiaGPUs)} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
      cpuCores = randomItem([8, 12, 16, 24]);
      deviceMemory = randomItem([16, 32, 64]);
      break;
    case 1: // AMD
      webglVendor = 'Google Inc. (AMD)';
      webglRenderer = `ANGLE (AMD, ${randomItem(amdGPUs)} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
      cpuCores = randomItem([8, 12, 16]);
      deviceMemory = randomItem([16, 32]);
      break;
    default: // Intel
      webglVendor = 'Google Inc. (Intel)';
      webglRenderer = `ANGLE (Intel, ${randomItem(intelGPUs)} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
      cpuCores = randomItem([4, 6, 8]);
      deviceMemory = randomItem([8, 16]);
  }

  return {
    os: 'windows',
    platform: 'Win32',
    browserType: 'chrome',
    browserVersion: randomItem(['119', '120', '121', '122']),
    userAgent: randomItem(windowsUAs),
    pixelRatio: 1.0,
    maxTouchPoints: 0,
    fonts: windowsFonts,
    speechVoices: windowsVoices,
    webglVendor,
    webglRenderer,
    cpuCores,
    deviceMemory,
  };
}

/**
 * Generate a random profile for macOS
 */
function generateMacOS() {
  const gpu = randomItem(appleGPUs);

  return {
    os: 'macos',
    platform: 'MacIntel',
    browserType: randomItem(['chrome', 'safari']),
    browserVersion: randomItem(['120', '17']),
    userAgent: randomItem(macUAs),
    pixelRatio: 2.0,
    colorDepth: 30,
    maxTouchPoints: 0,
    fonts: macFonts,
    speechVoices: macVoices,
    webglVendor: 'Google Inc. (Apple)',
    webglRenderer: `ANGLE (Apple, ${gpu}, OpenGL 4.1)`,
    cpuCores: randomItem([8, 10, 12]),
    deviceMemory: randomItem([8, 16, 32]),
  };
}

/**
 * Generate a random profile for Linux
 */
function generateLinux() {
  const gpu = randomItem(intelGPUs);
  const useMesa = Math.random() > 0.5;

  return {
    os: 'linux',
    platform: 'Linux x86_64',
    browserType: randomItem(['chrome', 'firefox']),
    browserVersion: randomItem(['120', '121']),
    userAgent: randomItem(linuxUAs),
    pixelRatio: 1.0,
    maxTouchPoints: 0,
    fonts: linuxFonts,
    speechVoices: [],
    doNotTrack: Math.random() > 0.5,
    webglVendor: useMesa ? 'Mesa/X.org' : 'Intel Inc.',
    webglRenderer: useMesa ? `Mesa ${gpu}` : gpu,
    cpuCores: randomItem([4, 6, 8, 12]),
    deviceMemory: randomItem([8, 16, 32]),
  };
}

/**
 * Generate a random profile
 * @param {string} [platform] - Specific platform (windows, macos, linux) or random
 * @returns {Profile}
 */
function generateRandom(platform = null) {
  // Select platform with weighted probability
  if (!platform) {
    const rand = Math.random() * 100;
    if (rand < 70) platform = 'windows';
    else if (rand < 90) platform = 'macos';
    else platform = 'linux';
  }

  // Generate platform-specific profile
  let profile;
  switch (platform) {
    case 'windows':
      profile = generateWindows();
      break;
    case 'macos':
      profile = generateMacOS();
      break;
    case 'linux':
      profile = generateLinux();
      break;
    default:
      profile = generateWindows();
  }

  // Add common fields
  const geo = randomItem(geoProfiles);
  const res = randomItem(resolutions);
  const now = new Date().toISOString();

  return {
    ...defaultProfile,
    ...profile,
    id: uuidv4(),
    name: `${profile.os.charAt(0).toUpperCase() + profile.os.slice(1)} Profile ${randomInt(1000, 9999)}`,

    // Screen
    viewportWidth: res.width,
    viewportHeight: res.height,
    screenWidth: res.width,
    screenHeight: res.height,
    colorDepth: profile.colorDepth || 24,

    // Timezone & Locale (auto mode - will be detected from IP at launch)
    timezoneMode: 'auto',
    localeMode: 'auto',
    timezone: geo.timezone,
    locale: geo.locale,
    language: geo.language,
    country: geo.country,

    // Fingerprint noise (recommended values)
    canvasNoise: randomFloat(0.02, 0.03),
    audioNoise: randomFloat(0.0001, 0.001),
    clientRectsNoise: randomFloat(0.1, 0.3),

    // WebGL
    webglImageMode: 'noise',
    webglMetadataMode: 'custom',

    // Defaults
    webrtcMode: WebRTCMode.REPLACE,
    geoMode: GeoMode.QUERY,
    mediaDevicesMode: MediaDevicesMode.REAL,
    status: 'active',

    // Timestamps
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  generateRandom,
  generateWindows,
  generateMacOS,
  generateLinux,
  // Data exports for presets
  nvidiaGPUs,
  amdGPUs,
  intelGPUs,
  appleGPUs,
  resolutions,
  geoProfiles,
};
