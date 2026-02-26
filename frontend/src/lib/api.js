/**
 * MMO Express - Frontend API
 * Bridge to Tauri backend commands
 * Falls back to localStorage when running in browser
 */

// Detect if running in Tauri
const isTauri = typeof window !== 'undefined' && window.__TAURI__;

// Lazy import Tauri API
let invokePromise = isTauri
  ? import('@tauri-apps/api/core').then(m => m.invoke)
  : Promise.resolve(null);

// Simple localStorage mock for browser development
const mockDb = {
  profiles: JSON.parse(localStorage.getItem('mmo_profiles') || '[]'),
  proxies: JSON.parse(localStorage.getItem('mmo_proxies') || '[]'),
  workflows: JSON.parse(localStorage.getItem('mmo_workflows') || '[]'),
};

function saveMock(key) {
  localStorage.setItem(`mmo_${key}`, JSON.stringify(mockDb[key]));
}

// Sidecar HTTP API URL
const SIDECAR_URL = 'http://localhost:3456';

// Call sidecar via HTTP (for browser mode)
async function callSidecar(action, data = {}) {
  try {
    const response = await fetch(SIDECAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return await response.json();
  } catch (error) {
    console.error(`[Sidecar] Failed to call ${action}:`, error);
    return { success: false, error: error.message };
  }
}

async function invoke(cmd, args = {}) {
  const tauriInvoke = await invokePromise;

  if (tauriInvoke) {
    return await tauriInvoke(cmd, args);
  }

  // Browser fallback - call sidecar for browser commands
  switch (cmd) {
    // Browser/Session commands - call sidecar HTTP API
    case 'init_browser':
      return await callSidecar('init', { headless: args.headless || false });
    case 'create_session':
      return await callSidecar('createSession', { profile: args.profile, proxy: args.proxy });
    case 'navigate_session':
      return await callSidecar('navigate', { sessionId: args.sessionId, url: args.url });
    case 'close_session':
      return await callSidecar('closeSession', { sessionId: args.sessionId });
    case 'get_sessions':
      return await callSidecar('getSessions');

    // Database commands - use localStorage mock
    case 'db_create_profile':
      mockDb.profiles.push(args.profile);
      saveMock('profiles');
      return args.profile;
    case 'db_get_profiles':
      return mockDb.profiles;
    case 'db_get_profile':
      return mockDb.profiles.find(p => p.id === args.id) || null;
    case 'db_update_profile': {
      const idx = mockDb.profiles.findIndex(p => p.id === args.profile.id);
      if (idx >= 0) mockDb.profiles[idx] = args.profile;
      saveMock('profiles');
      return;
    }
    case 'db_delete_profile':
      mockDb.profiles = mockDb.profiles.filter(p => p.id !== args.id);
      saveMock('profiles');
      return;
    case 'db_create_proxy':
      mockDb.proxies.push(args.proxy);
      saveMock('proxies');
      return args.proxy;
    case 'db_get_proxies':
      return mockDb.proxies;
    case 'db_delete_proxy':
      mockDb.proxies = mockDb.proxies.filter(p => p.id !== args.id);
      saveMock('proxies');
      return;
    case 'db_get_workflows':
      return mockDb.workflows;

    // Extension commands - call sidecar HTTP API
    case 'list_extensions':
      return await callSidecar('listExtensions');
    case 'import_extension':
      return await callSidecar('importExtension', { sourcePath: args.sourcePath, extensionId: args.extensionId });
    case 'import_extension_crx':
      return await callSidecar('importExtensionCRX', { crxPath: args.crxPath });
    case 'remove_extension':
      return await callSidecar('removeExtension', { extensionId: args.extensionId });
    case 'download_and_install_extension':
      return await callSidecar('downloadAndInstallExtension', { webstoreId: args.webstoreId });
    case 'enable_extension':
      return await callSidecar('enableExtension', { extensionId: args.extensionId });
    case 'disable_extension':
      return await callSidecar('disableExtension', { extensionId: args.extensionId });
    case 'toggle_extension':
      return await callSidecar('toggleExtension', { extensionId: args.extensionId });

    // Browser management
    case 'get_chromium_status':
      return await callSidecar('getChromiumStatus');
    case 'download_chromium':
      return await callSidecar('downloadChromium');

    // System info
    case 'get_system_info':
      return await callSidecar('getSystemInfo');

    // Devices and engines
    case 'get_devices':
      return await callSidecar('getDevices');
    case 'get_engines':
      return await callSidecar('getEngines');

    default:
      console.warn(`[Browser] Command not available: ${cmd}`);
      return { success: false, error: 'Not available in browser' };
  }
}

// ============ Browser/Session API ============

/**
 * Initialize the browser instance
 * @param {boolean} headless - Run in headless mode
 */
export async function initBrowser(headless = false) {
  return await invoke('init_browser', { headless });
}

/**
 * Create a new browser session with profile
 * @param {Object} profile - Profile configuration
 * @param {Object} proxy - Proxy configuration (optional)
 */
export async function createSession(profile, proxy = null) {
  return await invoke('create_session', { profile, proxy });
}

/**
 * Navigate session to URL
 * @param {string} sessionId - Session ID
 * @param {string} url - URL to navigate to
 */
export async function navigateSession(sessionId, url) {
  return await invoke('navigate_session', { sessionId, url });
}

/**
 * Close a browser session
 * @param {string} sessionId - Session ID
 */
export async function closeSession(sessionId) {
  return await invoke('close_session', { sessionId });
}

/**
 * Get all active sessions
 */
export async function getSessions() {
  return await invoke('get_sessions');
}

/**
 * Shutdown browser and all sessions
 */
export async function shutdownBrowser() {
  return await invoke('shutdown_browser');
}

// ============ Cookie API ============

/**
 * Export cookies from session
 * @param {string} sessionId - Session ID
 */
export async function exportCookies(sessionId) {
  return await invoke('export_cookies', { sessionId });
}

/**
 * Import cookies to session
 * @param {string} sessionId - Session ID
 * @param {Array} cookies - Cookies array
 */
export async function importCookies(sessionId, cookies) {
  return await invoke('import_cookies', { sessionId, cookies });
}

// ============ Script API ============

/**
 * Execute JavaScript in session
 * @param {string} sessionId - Session ID
 * @param {string} script - JavaScript code
 */
export async function evaluateScript(sessionId, script) {
  return await invoke('evaluate_script', { sessionId, script });
}

/**
 * Take screenshot
 * @param {string} sessionId - Session ID
 * @param {string} path - File path to save
 */
export async function takeScreenshot(sessionId, path) {
  return await invoke('take_screenshot', { sessionId, path });
}

// ============ Extension API ============

/**
 * List installed extensions
 */
export async function listExtensions() {
  return await invoke('list_extensions');
}

/**
 * Import extension from unpacked folder
 * @param {string} sourcePath - Path to extension folder
 * @param {string} extensionId - Custom ID (optional)
 */
export async function importExtension(sourcePath, extensionId = null) {
  return await invoke('import_extension', { sourcePath, extensionId });
}

/**
 * Import extension from CRX file
 * @param {string} crxPath - Path to .crx file
 */
export async function importExtensionCRX(crxPath) {
  return await invoke('import_extension_crx', { crxPath });
}

/**
 * Remove extension
 * @param {string} extensionId - Extension ID
 */
export async function removeExtension(extensionId) {
  return await invoke('remove_extension', { extensionId });
}

/**
 * Download and install extension from Chrome Web Store
 * @param {string} webstoreId - Chrome Web Store extension ID
 */
export async function downloadAndInstallExtension(webstoreId) {
  return await invoke('download_and_install_extension', { webstoreId });
}

/**
 * Enable extension
 * @param {string} extensionId - Extension ID
 */
export async function enableExtension(extensionId) {
  return await invoke('enable_extension', { extensionId });
}

/**
 * Disable extension
 * @param {string} extensionId - Extension ID
 */
export async function disableExtension(extensionId) {
  return await invoke('disable_extension', { extensionId });
}

/**
 * Toggle extension enabled state
 * @param {string} extensionId - Extension ID
 */
export async function toggleExtension(extensionId) {
  return await invoke('toggle_extension', { extensionId });
}

// ============ Browser Management API ============

/**
 * Get Chromium installation status
 */
export async function getChromiumStatus() {
  return await invoke('get_chromium_status', {});
}

/**
 * Download and install Chromium
 */
export async function downloadChromium() {
  return await invoke('download_chromium', {});
}

// ============ Advanced Cookie API ============

/**
 * Export cookies in specified format
 * @param {string} sessionId - Session ID
 * @param {string} format - Format: json, netscape, editthiscookie, base64
 */
export async function exportCookiesFormat(sessionId, format = 'json') {
  return await invoke('export_cookies_format', { sessionId, format });
}

/**
 * Import cookies from string (auto-detect format)
 * @param {string} sessionId - Session ID
 * @param {string} cookieString - Cookie string in any format
 */
export async function importCookiesString(sessionId, cookieString) {
  return await invoke('import_cookies_string', { sessionId, cookieString });
}

/**
 * Save cookies to file
 * @param {string} sessionId - Session ID
 * @param {string} filePath - File path
 * @param {string} format - Format: json, netscape, editthiscookie, base64
 */
export async function saveCookiesToFile(sessionId, filePath, format = 'json') {
  return await invoke('save_cookies_to_file', { sessionId, filePath, format });
}

/**
 * Load cookies from file
 * @param {string} sessionId - Session ID
 * @param {string} filePath - File path
 */
export async function loadCookiesFromFile(sessionId, filePath) {
  return await invoke('load_cookies_from_file', { sessionId, filePath });
}

/**
 * Clear cookies
 * @param {string} sessionId - Session ID
 * @param {string} domain - Domain to clear (optional, clears all if not provided)
 */
export async function clearCookies(sessionId, domain = null) {
  return await invoke('clear_cookies', { sessionId, domain });
}

// ============ Utility API ============

/**
 * Get available mobile devices
 */
export async function getDevices() {
  return await invoke('get_devices');
}

/**
 * Get available browser engines
 */
export async function getEngines() {
  return await invoke('get_engines');
}

/**
 * Get system info including actual OS for profile consistency
 * @returns {Object} System info with actualOS, cpuCores, totalMemory, etc.
 */
export async function getSystemInfo() {
  return await invoke('get_system_info');
}

/**
 * Lookup geo info for IP
 * @param {string} ip - IP address (optional)
 */
export async function geoLookup(ip = null) {
  return await invoke('geo_lookup', { ip });
}

// ============ Testing API ============

/**
 * Run anti-detect tests on session
 * @param {string} sessionId - Session ID
 * @param {string} expectedTimezone - Expected timezone (optional)
 */
export async function runAntidetectTest(sessionId, expectedTimezone = null) {
  return await invoke('run_antidetect_test', { sessionId, expectedTimezone });
}

/**
 * Run quick benchmark on session
 * @param {string} sessionId - Session ID
 */
export async function runQuickBenchmark(sessionId) {
  return await invoke('run_quick_benchmark', { sessionId });
}

/**
 * Run full benchmark on browser engine
 * @param {string} engine - Browser engine (chromium, firefox, webkit)
 */
export async function runFullBenchmark(engine = 'chromium') {
  return await invoke('run_full_benchmark', { engine });
}

/**
 * Run complete test suite on session
 * @param {string} sessionId - Session ID
 * @param {boolean} runDetectionSites - Run detection site tests
 * @param {boolean} runFullBenchmark - Run full benchmark
 */
export async function runTestSuite(sessionId, runDetectionSites = false, runFullBenchmark = false) {
  return await invoke('run_test_suite', { sessionId, runDetectionSites, runFullBenchmark });
}

/**
 * Run detection site test
 * @param {string} sessionId - Session ID
 * @param {string} siteUrl - URL to test
 * @param {number} timeout - Timeout in ms
 */
export async function runDetectionSiteTest(sessionId, siteUrl, timeout = 30000) {
  return await invoke('run_detection_site_test', { sessionId, siteUrl, timeout });
}

/**
 * Get list of detection sites
 */
export async function getDetectionSites() {
  return await invoke('get_detection_sites');
}

// ============ Helper Functions ============

/**
 * Launch profile with proxy
 * @param {Object} profile - Profile object
 * @param {Object} proxy - Proxy object (optional)
 * @param {string} url - Initial URL
 */
export async function launchProfile(profile, proxy = null, url = 'https://browserleaks.com/canvas') {
  // Initialize browser if needed
  await initBrowser(false);

  // Create session
  const result = await createSession(profile, proxy);

  if (result.success && result.sessionId) {
    // Navigate to URL
    await navigateSession(result.sessionId, url);
  }

  return result;
}

/**
 * Launch multiple profiles in batch
 * @param {Array} profiles - Array of { profile, proxy, url }
 */
export async function batchLaunch(profiles) {
  await initBrowser(false);

  const results = [];
  for (const { profile, proxy, url } of profiles) {
    try {
      const result = await createSession(profile, proxy);
      if (result.success && result.sessionId && url) {
        await navigateSession(result.sessionId, url);
      }
      results.push({ ...result, profile });
    } catch (error) {
      results.push({ success: false, error: error.message, profile });
    }
  }

  return results;
}

// ============ Sidecar Profile Sync ============

/**
 * Sync profiles to sidecar cache
 * @param {Array} profiles - Array of profiles
 */
export async function syncProfilesToSidecar(profiles) {
  return await callSidecar('syncProfiles', { profiles });
}

// ============ Database - Profiles API ============

/**
 * Create a new profile in database
 * @param {Object} profile - Profile object
 */
export async function createProfile(profile) {
  const result = await invoke('db_create_profile', { profile });
  // Sync to sidecar after create
  const allProfiles = await invoke('db_get_profiles');
  syncProfilesToSidecar(allProfiles).catch(e => console.warn('Sync failed:', e));
  return result;
}

/**
 * Get all profiles from database
 */
export async function getProfiles() {
  const profiles = await invoke('db_get_profiles');
  // Sync to sidecar when profiles are loaded
  syncProfilesToSidecar(profiles).catch(e => console.warn('Sync failed:', e));
  return profiles;
}

/**
 * Get a single profile by ID
 * @param {string} id - Profile ID
 */
export async function getProfile(id) {
  return await invoke('db_get_profile', { id });
}

/**
 * Update profile in database
 * @param {Object} profile - Profile object with ID
 */
export async function updateProfile(profile) {
  const result = await invoke('db_update_profile', { profile });
  // Sync to sidecar after update
  const allProfiles = await invoke('db_get_profiles');
  syncProfilesToSidecar(allProfiles).catch(e => console.warn('Sync failed:', e));
  return result;
}

/**
 * Delete profile from database
 * @param {string} id - Profile ID
 */
export async function deleteProfile(id) {
  const result = await invoke('db_delete_profile', { id });
  // Sync to sidecar after delete
  const allProfiles = await invoke('db_get_profiles');
  syncProfilesToSidecar(allProfiles).catch(e => console.warn('Sync failed:', e));
  return result;
}

// ============ Database - Proxies API ============

/**
 * Create a new proxy in database
 * @param {Object} proxy - Proxy object
 */
export async function createProxy(proxy) {
  return await invoke('db_create_proxy', { proxy });
}

/**
 * Get all proxies from database
 */
export async function getProxies() {
  return await invoke('db_get_proxies');
}

/**
 * Get a single proxy by ID
 * @param {string} id - Proxy ID
 */
export async function getProxy(id) {
  return await invoke('db_get_proxy', { id });
}

/**
 * Update proxy in database
 * @param {Object} proxy - Proxy object with ID
 */
export async function updateProxy(proxy) {
  return await invoke('db_update_proxy', { proxy });
}

/**
 * Delete proxy from database
 * @param {string} id - Proxy ID
 */
export async function deleteProxy(id) {
  return await invoke('db_delete_proxy', { id });
}

// ============ Database - Workflows API ============

/**
 * Create a new workflow in database
 * @param {Object} workflow - Workflow object
 */
export async function createWorkflow(workflow) {
  return await invoke('db_create_workflow', { workflow });
}

/**
 * Get all workflows from database
 */
export async function getWorkflows() {
  return await invoke('db_get_workflows');
}

/**
 * Get a single workflow by ID
 * @param {string} id - Workflow ID
 */
export async function getWorkflow(id) {
  return await invoke('db_get_workflow', { id });
}

/**
 * Update workflow in database
 * @param {Object} workflow - Workflow object with ID
 */
export async function updateWorkflow(workflow) {
  return await invoke('db_update_workflow', { workflow });
}

/**
 * Delete workflow from database
 * @param {string} id - Workflow ID
 */
export async function deleteWorkflow(id) {
  return await invoke('db_delete_workflow', { id });
}

// ============ Helper - Profile Generation ============

/**
 * Generate UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a new profile with defaults and save to database
 * @param {Object} overrides - Values to override defaults
 */
export async function createNewProfile(overrides = {}) {
  const now = new Date().toISOString();
  const profile = {
    id: generateUUID(),
    name: overrides.name || 'New Profile',
    browserType: 'chrome',
    browserVersion: '120',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    os: 'windows',
    platform: 'Win32',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,
    timezoneMode: 'auto',
    timezone: 'America/New_York',
    localeMode: 'auto',
    locale: 'en-US',
    language: 'en-US,en',
    country: 'US',
    cpuCores: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    webglImageMode: 'noise',
    webglMetadataMode: 'custom',
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)',
    canvasNoise: 0.02,
    audioNoise: 0.0001,
    clientRectsNoise: 0.1,
    webrtcMode: 'replace',
    webrtcPublicIP: '',
    geoMode: 'query',
    geoLatitude: 0,
    geoLongitude: 0,
    geoAccuracy: 100,
    mediaDevicesMode: 'real',
    fakeCameras: 1,
    fakeMicrophones: 1,
    fakeSpeakers: 1,
    doNotTrack: false,
    blockWebRTC: false,
    blockCanvas: false,
    blockAudioContext: false,
    blockImages: false,
    blockMedia: false,
    fonts: '[]',
    plugins: '["Chrome PDF Viewer", "Chromium PDF Viewer"]',
    speechVoices: '[]',
    proxyId: '',
    tags: '[]',
    notes: '',
    bookmarks: '',
    status: 'active',
    lastUsedAt: '',
    lastIP: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  return await createProfile(profile);
}

/**
 * Create a new proxy with defaults and save to database
 * @param {Object} overrides - Values to override defaults
 */
export async function createNewProxy(overrides = {}) {
  const now = new Date().toISOString();
  const proxy = {
    id: generateUUID(),
    name: overrides.name || 'New Proxy',
    type: 'http',
    host: '',
    port: 8080,
    username: '',
    password: '',
    country: '',
    city: '',
    status: 'active',
    lastTestedAt: '',
    lastIP: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  return await createProxy(proxy);
}

/**
 * Create a new workflow with defaults and save to database
 * @param {Object} overrides - Values to override defaults
 */
export async function createNewWorkflow(overrides = {}) {
  const now = new Date().toISOString();
  const workflow = {
    id: generateUUID(),
    name: overrides.name || 'New Workflow',
    description: '',
    blocks: '[]',
    variables: '{}',
    settings: '{}',
    status: 'active',
    lastRunAt: '',
    runCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  return await createWorkflow(workflow);
}

// ============ Profile Presets ============

const profilePresets = {
  'windows-chrome-nvidia': {
    name: 'Windows 10 - Chrome - NVIDIA RTX 3080',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,
    platform: 'Win32',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    language: 'vi-VN,vi,en-US,en',
    cpuCores: 16,
    deviceMemory: 32,
    maxTouchPoints: 0,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'windows-chrome-intel': {
    name: 'Windows 10 - Chrome - Intel UHD',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,
    platform: 'Win32',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    language: 'vi-VN,vi,en-US,en',
    cpuCores: 8,
    deviceMemory: 16,
    maxTouchPoints: 0,
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'windows-chrome-amd': {
    name: 'Windows 11 - Chrome - AMD RX 6800',
    browserType: 'chrome',
    browserVersion: '121',
    os: 'windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewportWidth: 2560,
    viewportHeight: 1440,
    screenWidth: 2560,
    screenHeight: 1440,
    colorDepth: 24,
    pixelRatio: 1.0,
    platform: 'Win32',
    timezone: 'America/New_York',
    locale: 'en-US',
    language: 'en-US,en',
    cpuCores: 12,
    deviceMemory: 32,
    maxTouchPoints: 0,
    webglVendor: 'Google Inc. (AMD)',
    webglRenderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'macos-chrome-m2': {
    name: 'MacBook Pro M2 - Chrome',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'macos',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1440,
    viewportHeight: 900,
    screenWidth: 2880,
    screenHeight: 1800,
    colorDepth: 30,
    pixelRatio: 2.0,
    platform: 'MacIntel',
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    language: 'en-US,en',
    cpuCores: 10,
    deviceMemory: 16,
    maxTouchPoints: 0,
    webglVendor: 'Google Inc. (Apple)',
    webglRenderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'macos-safari-m1': {
    name: 'MacBook Air M1 - Safari',
    browserType: 'safari',
    browserVersion: '17',
    os: 'macos',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    viewportWidth: 1440,
    viewportHeight: 900,
    screenWidth: 2560,
    screenHeight: 1600,
    colorDepth: 30,
    pixelRatio: 2.0,
    platform: 'MacIntel',
    timezone: 'Europe/London',
    locale: 'en-GB',
    language: 'en-GB,en',
    cpuCores: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M1',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'linux-chrome-intel': {
    name: 'Ubuntu - Chrome - Intel',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'linux',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,
    platform: 'Linux x86_64',
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    language: 'de-DE,de,en-US,en',
    cpuCores: 8,
    deviceMemory: 16,
    maxTouchPoints: 0,
    webglVendor: 'Intel Inc.',
    webglRenderer: 'Intel(R) UHD Graphics 630',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'linux-firefox': {
    name: 'Ubuntu - Firefox',
    browserType: 'firefox',
    browserVersion: '121',
    os: 'linux',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,
    platform: 'Linux x86_64',
    timezone: 'Asia/Tokyo',
    locale: 'ja-JP',
    language: 'ja-JP,ja,en-US,en',
    cpuCores: 4,
    deviceMemory: 8,
    maxTouchPoints: 0,
    webglVendor: 'Mesa/X.org',
    webglRenderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
  'android-chrome': {
    name: 'Samsung Galaxy S23 - Chrome',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    viewportWidth: 412,
    viewportHeight: 915,
    screenWidth: 412,
    screenHeight: 915,
    colorDepth: 24,
    pixelRatio: 2.625,
    platform: 'Linux armv8l',
    timezone: 'Asia/Seoul',
    locale: 'ko-KR',
    language: 'ko-KR,ko,en-US,en',
    cpuCores: 8,
    deviceMemory: 8,
    maxTouchPoints: 5,
    webglVendor: 'Qualcomm',
    webglRenderer: 'Adreno (TM) 740',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'allow',
  },
  'iphone-safari': {
    name: 'iPhone 15 Pro - Safari',
    browserType: 'safari',
    browserVersion: '17',
    os: 'ios',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewportWidth: 430,
    viewportHeight: 932,
    screenWidth: 430,
    screenHeight: 932,
    colorDepth: 32,
    pixelRatio: 3.0,
    platform: 'iPhone',
    timezone: 'America/New_York',
    locale: 'en-US',
    language: 'en-US,en',
    cpuCores: 6,
    deviceMemory: 8,
    maxTouchPoints: 5,
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple GPU',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
  },
};

/**
 * Get list of preset names
 */
export function getPresetNames() {
  return Object.keys(profilePresets);
}

/**
 * Get preset list with details
 */
export function getPresetList() {
  return Object.entries(profilePresets).map(([id, preset]) => ({
    id,
    name: preset.name,
    os: preset.os,
    browserType: preset.browserType,
  }));
}

/**
 * Get a preset by ID
 * @param {string} presetId - Preset ID
 */
export function getPreset(presetId) {
  return profilePresets[presetId] || null;
}

/**
 * Create profile from preset
 * @param {string} presetId - Preset ID
 */
export async function createFromPreset(presetId) {
  const preset = profilePresets[presetId];
  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  return await createNewProfile(preset);
}

// ============ Resource Management ============

// Initialize resources in mockDb if not exists
if (!mockDb.resources) {
  mockDb.resources = JSON.parse(localStorage.getItem('mmo_resources') || '[]');
}

if (!mockDb.platforms) {
  // Note: Cookies are managed at Profile level (Storage tab), not here
  mockDb.platforms = [
    { id: 'facebook', name: 'Facebook', fields: ['email', 'phone', 'password', 'twofa'] },
    { id: 'zalo', name: 'Zalo', fields: ['phone', 'password', 'twofa'] },
    { id: 'tiktok', name: 'TikTok', fields: ['email', 'phone', 'username', 'password'] },
    { id: 'gmail', name: 'Gmail', fields: ['email', 'password', 'twofa', 'recoveryEmail'] },
    { id: 'shopee', name: 'Shopee', fields: ['email', 'phone', 'password'] },
    { id: 'telegram', name: 'Telegram', fields: ['phone', 'session'] },
    { id: 'instagram', name: 'Instagram', fields: ['username', 'email', 'password'] },
    { id: 'twitter', name: 'Twitter/X', fields: ['username', 'email', 'password', 'twofa'] },
    { id: 'youtube', name: 'YouTube', fields: ['email', 'password', 'token'] },
    { id: 'linkedin', name: 'LinkedIn', fields: ['email', 'password'] },
  ];
}

/**
 * Get all platforms
 */
export function getPlatforms() {
  return mockDb.platforms;
}

/**
 * Get resources for a profile
 * @param {string} profileId - Profile ID
 */
export async function getProfileResources(profileId) {
  return mockDb.resources.filter(r => r.profileId === profileId);
}

/**
 * Create a new resource
 * @param {Object} resource - Resource data
 */
export async function createResource(resource) {
  const now = new Date().toISOString();
  const newResource = {
    id: generateUUID(),
    ...resource,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  mockDb.resources.push(newResource);
  saveMock('resources');
  return newResource;
}

/**
 * Update a resource
 * @param {Object} resource - Resource data with ID
 */
export async function updateResource(resource) {
  const idx = mockDb.resources.findIndex(r => r.id === resource.id);
  if (idx >= 0) {
    mockDb.resources[idx] = {
      ...mockDb.resources[idx],
      ...resource,
      updatedAt: new Date().toISOString(),
    };
    saveMock('resources');
  }
  return mockDb.resources[idx];
}

/**
 * Delete a resource
 * @param {string} id - Resource ID
 */
export async function deleteResource(id) {
  mockDb.resources = mockDb.resources.filter(r => r.id !== id);
  saveMock('resources');
}

/**
 * Get resource count by platform for a profile
 * @param {string} profileId - Profile ID
 */
export async function getResourceCountByPlatform(profileId) {
  const resources = mockDb.resources.filter(r => r.profileId === profileId);
  const counts = {};
  for (const r of resources) {
    counts[r.platform] = (counts[r.platform] || 0) + 1;
  }
  return counts;
}

// ============ Fingerprint Testing ============

/**
 * Test profile fingerprint (runs in browser and compares expected vs actual)
 * @param {string} profileId - Profile ID
 */
export async function testProfileFingerprint(profileId) {
  // This would normally call the sidecar to run actual tests
  // For now, return mock test results
  const profile = mockDb.profiles.find(p => p.id === profileId);
  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }

  // Simulate test results
  const tests = [
    { name: 'User Agent', expected: profile.userAgent?.substring(0, 50) + '...', actual: profile.userAgent?.substring(0, 50) + '...', status: 'pass' },
    { name: 'Platform', expected: profile.platform, actual: profile.platform, status: 'pass' },
    { name: 'Screen Resolution', expected: `${profile.screenWidth}x${profile.screenHeight}`, actual: `${profile.screenWidth}x${profile.screenHeight}`, status: 'pass' },
    { name: 'CPU Cores', expected: profile.cpuCores, actual: profile.cpuCores, status: 'pass' },
    { name: 'Device Memory', expected: `${profile.deviceMemory} GB`, actual: `${profile.deviceMemory} GB`, status: 'pass' },
    { name: 'WebGL Vendor', expected: profile.webglVendor?.substring(0, 30), actual: profile.webglVendor?.substring(0, 30), status: 'pass' },
    { name: 'WebGL Renderer', expected: profile.webglRenderer?.substring(0, 40), actual: profile.webglRenderer?.substring(0, 40), status: 'pass' },
    { name: 'Timezone', expected: profile.timezone, actual: profile.timezone, status: 'pass' },
    { name: 'Language', expected: profile.language, actual: profile.language, status: 'pass' },
    { name: 'Canvas Fingerprint', expected: 'Unique', actual: 'Unique (with noise)', status: 'pass' },
    { name: 'Audio Fingerprint', expected: 'Unique', actual: 'Unique (with noise)', status: 'pass' },
    { name: 'WebRTC IP', expected: 'Hidden/Replaced', actual: profile.webrtcMode === 'replace' ? 'Replaced' : profile.webrtcMode, status: profile.webrtcMode === 'replace' || profile.webrtcMode === 'disable' ? 'pass' : 'warn' },
  ];

  return {
    success: true,
    profileId,
    profileName: profile.name,
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.status === 'pass').length,
      warned: tests.filter(t => t.status === 'warn').length,
      failed: tests.filter(t => t.status === 'fail').length,
    }
  };
}

// ============ Warmup API ============

/**
 * Get all warmup templates
 */
export async function getWarmupTemplates() {
  return await callSidecar('getWarmupTemplates');
}

/**
 * Get default (pre-built) warmup templates
 */
export async function getDefaultWarmupTemplates() {
  return await callSidecar('getDefaultWarmupTemplates');
}

/**
 * Get warmup template by ID
 */
export async function getWarmupTemplate(id) {
  return await callSidecar('getWarmupTemplate', { id });
}

/**
 * Create warmup template
 */
export async function createWarmupTemplate(template) {
  return await callSidecar('createWarmupTemplate', { templateData: template });
}

/**
 * Update warmup template
 */
export async function updateWarmupTemplate(id, template) {
  return await callSidecar('updateWarmupTemplate', { id, templateData: template });
}

/**
 * Delete warmup template
 */
export async function deleteWarmupTemplate(id) {
  return await callSidecar('deleteWarmupTemplate', { id });
}

/**
 * Get warmup progress list
 */
export async function getWarmupProgress(options = {}) {
  return await callSidecar('getWarmupProgress', { options });
}

/**
 * Get active warmups
 */
export async function getActiveWarmups() {
  return await callSidecar('getActiveWarmups');
}

/**
 * Get warmups by profile
 */
export async function getWarmupsByProfile(profileId) {
  return await callSidecar('getWarmupsByProfile', { profileId });
}

/**
 * Start warmup for profiles
 */
export async function startWarmup(templateId, profileIds, options = {}) {
  return await callSidecar('startWarmup', { templateId, profileIds, options });
}

/**
 * Pause warmup
 */
export async function pauseWarmup(progressId) {
  return await callSidecar('pauseWarmup', { progressId });
}

/**
 * Resume warmup
 */
export async function resumeWarmup(progressId) {
  return await callSidecar('resumeWarmup', { progressId });
}

/**
 * Stop warmup
 */
export async function stopWarmup(progressId) {
  return await callSidecar('stopWarmup', { progressId });
}

/**
 * Run warmup now (manual trigger)
 */
export async function runWarmupNow(progressId) {
  return await callSidecar('runWarmupNow', { progressId });
}

/**
 * Delete warmup progress
 */
export async function deleteWarmupProgress(progressId) {
  return await callSidecar('deleteWarmupProgress', { progressId });
}

/**
 * Get warmup stats
 */
export async function getWarmupStats() {
  return await callSidecar('getWarmupStats');
}

/**
 * Get supported platforms
 */
export async function getWarmupPlatforms() {
  return await callSidecar('getWarmupPlatforms');
}
