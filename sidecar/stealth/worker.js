/**
 * Worker Stealth Module
 * Intercepts Worker and ServiceWorker creation to inject stealth scripts
 * This prevents fingerprinting via worker contexts where normal page scripts don't run
 */

function buildWorkerScript(profile) {
  const userAgent = profile.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const platform = profile.platform || 'Win32';
  const browserType = profile.browserType || 'chrome';

  // Extract Chrome version from user agent
  const chromeVersionMatch = userAgent.match(/Chrome\/(\d+)/);
  const chromeVersion = chromeVersionMatch ? chromeVersionMatch[1] : '120';

  // Determine vendor based on browser type
  const vendor = browserType === 'firefox' ? '' : 'Google Inc.';
  const productSub = browserType === 'firefox' ? '20100101' : '20030107';
  const appVersion = userAgent.replace('Mozilla/', '');

  // Build the worker stealth code that will be prepended to all workers
  const workerStealthCode = `
// ======== WORKER STEALTH ========
(function() {
  'use strict';

  const SPOOFED_USER_AGENT = '${userAgent}';
  const SPOOFED_PLATFORM = '${platform}';
  const SPOOFED_VENDOR = '${vendor}';
  const SPOOFED_PRODUCT_SUB = '${productSub}';
  const SPOOFED_APP_VERSION = '${appVersion}';
  const SPOOFED_LANGUAGE = '${profile.locale || 'en-US'}';
  const SPOOFED_LANGUAGES = ${JSON.stringify((profile.language || 'en-US,en').split(',').map(s => s.trim()))};
  const SPOOFED_CORES = ${profile.cpuCores || 8};
  const SPOOFED_MEMORY = ${profile.deviceMemory || 8};
  const CHROME_VERSION = '${chromeVersion}';

  // Override navigator in worker context
  if (typeof WorkerNavigator !== 'undefined' || typeof navigator !== 'undefined') {
    const nav = navigator;

    // Core navigator properties
    const overrides = {
      userAgent: SPOOFED_USER_AGENT,
      appVersion: SPOOFED_APP_VERSION,
      platform: SPOOFED_PLATFORM,
      vendor: SPOOFED_VENDOR,
      productSub: SPOOFED_PRODUCT_SUB,
      language: SPOOFED_LANGUAGE,
      languages: Object.freeze(SPOOFED_LANGUAGES),
      hardwareConcurrency: SPOOFED_CORES,
      deviceMemory: SPOOFED_MEMORY,
      webdriver: undefined
    };

    for (const [key, value] of Object.entries(overrides)) {
      try {
        Object.defineProperty(nav, key, {
          get: () => value,
          configurable: true
        });
      } catch(e) {}
    }

    // Override userAgentData (Client Hints) in worker
    if (nav.userAgentData || typeof NavigatorUAData !== 'undefined') {
      const brands = [
        { brand: 'Chromium', version: CHROME_VERSION },
        { brand: 'Google Chrome', version: CHROME_VERSION },
        { brand: 'Not-A.Brand', version: '99' }
      ];

      const fakeUAData = {
        brands: brands,
        mobile: ${profile.os === 'android' || profile.os === 'ios'},
        platform: '${profile.os === 'macos' ? 'macOS' : profile.os === 'windows' ? 'Windows' : profile.os === 'android' ? 'Android' : profile.os === 'ios' ? 'iOS' : 'Linux'}',
        getHighEntropyValues: async function(hints) {
          const result = {
            brands: brands,
            mobile: ${profile.os === 'android' || profile.os === 'ios'},
            platform: '${profile.os === 'macos' ? 'macOS' : profile.os === 'windows' ? 'Windows' : profile.os === 'android' ? 'Android' : profile.os === 'ios' ? 'iOS' : 'Linux'}',
          };
          if (hints.includes('platformVersion')) result.platformVersion = '${profile.os === 'windows' ? '10.0.0' : profile.os === 'macos' ? '14.0.0' : '6.1'}';
          if (hints.includes('architecture')) result.architecture = 'x86';
          if (hints.includes('bitness')) result.bitness = '64';
          if (hints.includes('model')) result.model = '';
          if (hints.includes('uaFullVersion')) result.uaFullVersion = CHROME_VERSION + '.0.0.0';
          if (hints.includes('fullVersionList')) {
            result.fullVersionList = [
              { brand: 'Chromium', version: CHROME_VERSION + '.0.0.0' },
              { brand: 'Google Chrome', version: CHROME_VERSION + '.0.0.0' },
              { brand: 'Not-A.Brand', version: '99.0.0.0' }
            ];
          }
          return result;
        },
        toJSON: function() {
          return { brands: brands, mobile: ${profile.os === 'android' || profile.os === 'ios'}, platform: '${profile.os === 'macos' ? 'macOS' : profile.os === 'windows' ? 'Windows' : profile.os === 'android' ? 'Android' : profile.os === 'ios' ? 'iOS' : 'Linux'}' };
        }
      };

      try {
        Object.defineProperty(nav, 'userAgentData', {
          get: () => fakeUAData,
          configurable: true
        });
      } catch(e) {}
    }

    // Connection API in worker
    try {
      Object.defineProperty(nav, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: ${profile.connectionRtt || 50},
          downlink: ${profile.connectionDownlink || 10},
          saveData: false,
          type: '${profile.connectionType || 'wifi'}',
          addEventListener: () => {},
          removeEventListener: () => {},
          onchange: null
        }),
        configurable: true
      });
    } catch(e) {}
  }

  console.debug('[Worker Stealth] Applied in worker context');
})();
// ======== END WORKER STEALTH ========

`;

  // Main page script that intercepts Worker creation
  return `
// ======== WORKER INTERCEPTION ========

const WORKER_STEALTH_CODE = ${JSON.stringify(workerStealthCode)};

// Store original constructors
const OriginalWorker = window.Worker;
const OriginalSharedWorker = window.SharedWorker;

// Helper to create blob with stealth code prepended
function createStealthBlob(originalUrl, isModule = false) {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch the original worker script
      const response = await fetch(originalUrl);
      const originalCode = await response.text();

      // Prepend stealth code
      const stealthCode = WORKER_STEALTH_CODE + '\\n' + originalCode;

      // Create new blob
      const blob = new Blob([stealthCode], { type: 'application/javascript' });
      resolve(URL.createObjectURL(blob));
    } catch(e) {
      // If fetch fails (cross-origin), return original URL
      console.warn('[Worker Stealth] Could not intercept worker:', e.message);
      resolve(originalUrl);
    }
  });
}

// Override Worker constructor
window.Worker = function(scriptURL, options = {}) {
  const url = scriptURL instanceof URL ? scriptURL.href : scriptURL;

  // For blob URLs, we can't easily intercept, create directly
  if (url.startsWith('blob:')) {
    // Try to intercept blob workers by wrapping
    return new OriginalWorker(scriptURL, options);
  }

  // For module workers, we need special handling
  if (options.type === 'module') {
    // Module workers are harder to intercept, create with original
    return new OriginalWorker(scriptURL, options);
  }

  // Create a wrapper that injects stealth code
  const workerWrapper = \`
    ${workerStealthCode.replace(/`/g, '\\`').replace(/\$/g, '\\$')}
    importScripts('\${url}');
  \`;

  const blob = new Blob([workerWrapper], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  const worker = new OriginalWorker(blobUrl, options);

  // Clean up blob URL after worker starts
  worker.addEventListener('error', () => URL.revokeObjectURL(blobUrl), { once: true });
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

  return worker;
};

// Copy static properties
window.Worker.prototype = OriginalWorker.prototype;
Object.defineProperty(window.Worker, 'name', { value: 'Worker' });

// Override SharedWorker constructor
if (OriginalSharedWorker) {
  window.SharedWorker = function(scriptURL, options) {
    const url = scriptURL instanceof URL ? scriptURL.href : scriptURL;

    if (url.startsWith('blob:') || (options && options.type === 'module')) {
      return new OriginalSharedWorker(scriptURL, options);
    }

    const workerWrapper = \`
      ${workerStealthCode.replace(/`/g, '\\`').replace(/\$/g, '\\$')}
      importScripts('\${url}');
    \`;

    const blob = new Blob([workerWrapper], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    const worker = new OriginalSharedWorker(blobUrl, typeof options === 'string' ? options : options);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    return worker;
  };

  window.SharedWorker.prototype = OriginalSharedWorker.prototype;
  Object.defineProperty(window.SharedWorker, 'name', { value: 'SharedWorker' });
}

// Intercept ServiceWorker registration
if (navigator.serviceWorker) {
  const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);

  navigator.serviceWorker.register = async function(scriptURL, options = {}) {
    // ServiceWorkers can't be easily intercepted due to security restrictions
    // But we can try to use the scope to influence behavior
    console.debug('[Worker Stealth] ServiceWorker registration:', scriptURL);
    return originalRegister(scriptURL, options);
  };
}

console.debug('[Worker Stealth] Worker interception initialized');
`;
}

module.exports = { buildWorkerScript };
