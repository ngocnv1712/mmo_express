/**
 * Browser Engines Module
 * Supports Chromium, Firefox, and WebKit (Safari)
 */

const { chromium, firefox, webkit } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const browserDownloader = require('./downloader');

/**
 * Find an available port for remote debugging
 */
async function findAvailablePort(startPort = 9222) {
  for (let port = startPort; port < startPort + 100; port++) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
    if (available) return port;
  }
  throw new Error('No available port found');
}

/**
 * Launch Chrome manually and connect via CDP (more stealthy)
 */
async function launchStealthChrome(userDataDir, options = {}) {
  const port = await findAvailablePort();

  // Get Chromium path from downloader (handles auto-download)
  let chromePath = null;

  // First check if Chromium is installed via our downloader
  if (browserDownloader.isChromiumInstalled()) {
    chromePath = browserDownloader.getChromiumPath();
    console.error(`[ENGINE] Using downloaded Chromium: ${chromePath}`);
  } else {
    // Fallback to system browsers (prefer Chromium over Chrome)
    const systemPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      // Google Chrome (--load-extension is disabled, but better than nothing)
      '/opt/google/chrome/chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ];

    for (const p of systemPaths) {
      if (fs.existsSync(p)) {
        chromePath = p;
        console.error(`[ENGINE] Using system browser: ${chromePath}`);
        break;
      }
    }
  }

  if (!chromePath) {
    throw new Error('Chrome executable not found');
  }

  // Minimal args - just what's needed, no automation flags
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
    '--enable-extensions',
  ];

  // Add viewport if specified
  if (options.viewport) {
    args.push(`--window-size=${options.viewport.width},${options.viewport.height}`);
  }

  // Add extension args if provided
  if (options.args && options.args.length > 0) {
    args.push(...options.args);
    console.error(`[ENGINE] Adding extension args: ${options.args.length} args`);
    options.args.forEach((arg, i) => console.error(`[ENGINE]   arg[${i}]: ${arg}`));
  }

  console.error(`[ENGINE] Final Chrome args: ${args.length} total`);
  args.forEach((arg, i) => console.error(`[ENGINE]   [${i}]: ${arg.substring(0, 100)}${arg.length > 100 ? '...' : ''}`));

  // Launch Chrome as a regular process
  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for Chrome to start and debugging port to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome launch timeout')), 15000);

    const checkPort = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkPort, 200);
        }
      } catch (e) {
        setTimeout(checkPort, 200);
      }
    };

    chromeProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    chromeProcess.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited with code ${code}`));
      }
    });

    setTimeout(checkPort, 500);
  });

  // Connect Playwright to the running Chrome
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

  // Get the default context (the one Chrome created)
  const contexts = browser.contexts();
  let context = contexts[0];

  if (!context) {
    context = await browser.newContext(options);
  }

  // Store process reference for cleanup
  browser._chromeProcess = chromeProcess;
  browser._debugPort = port;

  console.error(`[ENGINE] Launched stealth Chrome on port ${port}`);

  return { browser, context, chromeProcess, port };
}

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
      // Additional flags to avoid incognito/automation detection
      '--disable-features=IsolateOrigins,site-per-process,TranslateUI',
      '--disable-site-isolation-trials',
      '--disable-web-security=false',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--hide-scrollbars=false',
      '--mute-audio=false',
      '--no-default-browser-check',
      '--disable-client-side-phishing-detection',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      // Force non-incognito storage behavior
      '--unlimited-storage',
      '--enable-features=StorageBuckets',
      '--disk-cache-size=104857600',
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

    // Ignore Playwright's default automation flags that can be detected
    launchOptions.ignoreDefaultArgs = [
      '--enable-automation',
      '--enable-blink-features=IdleDetection',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--export-tagged-pdf',
    ];

    // Use system Chrome instead of Chrome for Testing (less detectable)
    // channel: 'chrome' uses the system-installed Google Chrome
    if (!options.usePlaywrightBrowser) {
      launchOptions.channel = 'chrome';
      console.error('[ENGINE] Using system Chrome browser');
    }
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
 * Launch browser with persistent context (non-incognito)
 * @param {string} engineName - Browser engine name
 * @param {string} userDataDir - Path to user data directory
 * @param {Object} options - Launch and context options
 * @returns {Promise<{browser: Browser, context: BrowserContext}>} Browser and context
 */
async function launchPersistentContext(engineName, userDataDir, options = {}) {
  const engine = getEngine(engineName);

  // Use stealth mode by default for Chromium (launch Chrome manually, connect via CDP)
  if (engineName === 'chromium' && options.headless !== true) {
    try {
      const result = await launchStealthChrome(userDataDir, options);
      return result;
    } catch (e) {
      console.error('[ENGINE] Stealth launch failed, falling back to standard:', e.message);
      // Fall through to standard launch
    }
  }

  const launchOptions = {
    headless: options.headless ?? false,
    ...options,
  };

  // Remove context-specific options that go separately
  const contextOptions = {};
  const contextKeys = ['viewport', 'userAgent', 'locale', 'timezoneId', 'colorScheme',
    'deviceScaleFactor', 'isMobile', 'hasTouch', 'geolocation', 'permissions', 'proxy'];

  for (const key of contextKeys) {
    if (launchOptions[key] !== undefined) {
      contextOptions[key] = launchOptions[key];
      delete launchOptions[key];
    }
  }

  // Add engine-specific args
  if (engineName === 'chromium') {
    launchOptions.args = [
      ...engine.defaultArgs,
      ...(options.args || []),
    ];

    // Ignore Playwright's default automation flags that can be detected
    launchOptions.ignoreDefaultArgs = [
      '--enable-automation',
      '--enable-blink-features=IdleDetection',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--export-tagged-pdf',
    ];

    // Use system Chrome instead of Chrome for Testing (less detectable)
    if (!options.usePlaywrightBrowser) {
      launchOptions.channel = 'chrome';
      console.error('[ENGINE] Using system Chrome browser (persistent context)');
    }
  }

  // Firefox preferences
  if (engineName === 'firefox') {
    launchOptions.firefoxUserPrefs = {
      ...engine.firefoxPrefs,
      ...(options.firefoxUserPrefs || {}),
    };
  }

  // Merge context options into launch options for persistent context
  const persistentOptions = { ...launchOptions, ...contextOptions };

  // launchPersistentContext returns a context that also acts as browser
  const context = await engine.launcher.launchPersistentContext(userDataDir, persistentOptions);

  return { browser: context, context };
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
  launchPersistentContext,
  launchStealthChrome,
  getRecommendedEngine,
  supportsFeature,
  getAvailableEngines,
};
