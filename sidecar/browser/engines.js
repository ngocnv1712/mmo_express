/**
 * Browser Engines Module
 * Supports Chromium, Firefox, and WebKit (Safari)
 */

const { chromium, firefox, webkit } = require('playwright');

// Browser engine configurations
const BROWSER_ENGINES = {
  chromium: {
    name: 'Chromium',
    launcher: chromium,
    stealth: true,      // Supports stealth plugin
    mobile: true,       // Supports mobile emulation
    extensions: true,   // Supports browser extensions
    defaultArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-first-run',
      '--password-store=basic',
      '--use-mock-keychain',
    ],
  },

  firefox: {
    name: 'Firefox',
    launcher: firefox,
    stealth: false,     // Firefox has better native privacy
    mobile: true,
    extensions: true,   // Supports Firefox extensions
    defaultArgs: [],    // Firefox handles args differently
    firefoxPrefs: {
      // Disable telemetry
      'toolkit.telemetry.enabled': false,
      'toolkit.telemetry.unified': false,
      'toolkit.telemetry.archive.enabled': false,
      // Privacy settings
      'privacy.trackingprotection.enabled': true,
      'privacy.resistFingerprinting': false, // We handle this ourselves
      'dom.webdriver.enabled': false,
      // Disable updates
      'app.update.enabled': false,
      'app.update.auto': false,
    },
  },

  webkit: {
    name: 'WebKit (Safari)',
    launcher: webkit,
    stealth: false,     // WebKit is naturally less detected
    mobile: true,       // Best for iOS emulation
    extensions: false,  // No extension support
    defaultArgs: [],
  },
};

/**
 * Get browser engine by name
 * @param {string} engineName - chromium, firefox, or webkit
 * @returns {Object} Engine configuration
 */
function getEngine(engineName) {
  const engine = BROWSER_ENGINES[engineName.toLowerCase()];
  if (!engine) {
    throw new Error(`Unknown browser engine: ${engineName}. Supported: chromium, firefox, webkit`);
  }
  return engine;
}

/**
 * Launch browser with engine-specific options
 * @param {string} engineName - Browser engine name
 * @param {Object} options - Launch options
 * @returns {Promise<Browser>} Browser instance
 */
async function launchBrowser(engineName, options = {}) {
  const engine = getEngine(engineName);

  const launchOptions = {
    headless: options.headless ?? false,
    ...options,
  };

  // Add engine-specific args
  if (engineName === 'chromium') {
    launchOptions.args = [
      ...engine.defaultArgs,
      ...(options.args || []),
    ];
  }

  // Firefox preferences
  if (engineName === 'firefox') {
    launchOptions.firefoxUserPrefs = {
      ...engine.firefoxPrefs,
      ...(options.firefoxUserPrefs || {}),
    };
  }

  return await engine.launcher.launch(launchOptions);
}

/**
 * Get recommended browser for profile type
 * @param {Object} profile - Profile configuration
 * @returns {string} Recommended engine name
 */
function getRecommendedEngine(profile) {
  const os = (profile.os || '').toLowerCase();
  const browserType = (profile.browserType || '').toLowerCase();

  // iOS devices should use WebKit
  if (os === 'ios' || browserType === 'safari' || browserType === 'webkit') {
    return 'webkit';
  }

  // Firefox profiles
  if (browserType === 'firefox') {
    return 'firefox';
  }

  // Default to Chromium for everything else
  return 'chromium';
}

/**
 * Check if engine supports a feature
 * @param {string} engineName - Browser engine name
 * @param {string} feature - Feature name (stealth, mobile, extensions)
 * @returns {boolean}
 */
function supportsFeature(engineName, feature) {
  const engine = getEngine(engineName);
  return engine[feature] === true;
}

/**
 * Get all available engines
 * @returns {Object} Engine map
 */
function getAvailableEngines() {
  return Object.keys(BROWSER_ENGINES).map(key => ({
    id: key,
    name: BROWSER_ENGINES[key].name,
    stealth: BROWSER_ENGINES[key].stealth,
    mobile: BROWSER_ENGINES[key].mobile,
    extensions: BROWSER_ENGINES[key].extensions,
  }));
}

module.exports = {
  BROWSER_ENGINES,
  getEngine,
  launchBrowser,
  getRecommendedEngine,
  supportsFeature,
  getAvailableEngines,
};
