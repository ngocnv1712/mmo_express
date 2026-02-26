/**
 * Navigator Spoofing Module
 * Overrides navigator properties to hide automation
 */

function buildNavigatorScript(profile) {
  return `
// ======== WEBDRIVER SPOOFING ========
// Hide navigator.webdriver to avoid automation detection
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});

// Remove from prototype chain
try { delete navigator.__proto__.webdriver; } catch(e) {}

// Also ensure it returns false if accessed differently
if (Object.getOwnPropertyDescriptor(navigator, 'webdriver')) {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
    configurable: true
  });
}

console.debug('[Stealth] Navigator: webdriver hidden via JS injection');
`;
}

function buildNavigatorScriptFull(profile) {
  const userAgent = profile.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const platform = profile.platform || 'Win32';
  const browserType = profile.browserType || 'chrome';

  // Determine vendor based on browser type
  const vendor = browserType === 'firefox' ? '' : 'Google Inc.';
  const productSub = browserType === 'firefox' ? '20100101' : '20030107';

  // Extract appVersion from userAgent
  const appVersion = userAgent.replace('Mozilla/', '');

  return `
// ======== NAVIGATOR SPOOFING (FULL) ========

const BROWSER_TYPE = '${browserType}';
const USER_AGENT = '${userAgent}';
const PLATFORM = '${platform}';
const VENDOR = '${vendor}';
const PRODUCT_SUB = '${productSub}';
const APP_VERSION = '${appVersion}';

// Remove webdriver property (critical for automation detection)
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});

// Remove automation properties
try { delete navigator.__proto__.webdriver; } catch(e) {}

// Override userAgent (CRITICAL - must match HTTP header)
Object.defineProperty(navigator, 'userAgent', {
  get: () => USER_AGENT,
  configurable: true
});

// Override appVersion (derived from userAgent)
Object.defineProperty(navigator, 'appVersion', {
  get: () => APP_VERSION,
  configurable: true
});

// Override vendor (Google Inc. for Chrome, empty for Firefox)
Object.defineProperty(navigator, 'vendor', {
  get: () => VENDOR,
  configurable: true
});

// Override productSub
Object.defineProperty(navigator, 'productSub', {
  get: () => PRODUCT_SUB,
  configurable: true
});

// Override platform
Object.defineProperty(navigator, 'platform', {
  get: () => PLATFORM,
  configurable: true
});

// Override hardware concurrency (CPU cores)
Object.defineProperty(navigator, 'hardwareConcurrency', {
  get: () => ${profile.cpuCores || 8},
  configurable: true
});

// Override device memory
Object.defineProperty(navigator, 'deviceMemory', {
  get: () => ${profile.deviceMemory || 8},
  configurable: true
});

// Override max touch points
Object.defineProperty(navigator, 'maxTouchPoints', {
  get: () => ${profile.maxTouchPoints || 0},
  configurable: true
});

// Override language
Object.defineProperty(navigator, 'language', {
  get: () => '${profile.locale || 'en-US'}',
  configurable: true
});

// Override languages
Object.defineProperty(navigator, 'languages', {
  get: () => Object.freeze(${JSON.stringify((profile.language || 'en-US,en').split(',').map(s => s.trim()))}),
  configurable: true
});

// Override Do Not Track
Object.defineProperty(navigator, 'doNotTrack', {
  get: () => ${profile.doNotTrack ? "'1'" : 'null'},
  configurable: true
});

// Fix navigator.plugins (make it look real)
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const plugins = [
      {
        name: 'Chrome PDF Plugin',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
        length: 1,
        0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      },
      {
        name: 'Chrome PDF Viewer',
        description: '',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        length: 1,
        0: { type: 'application/pdf', suffixes: 'pdf', description: '' }
      },
      {
        name: 'Native Client',
        description: '',
        filename: 'internal-nacl-plugin',
        length: 2,
        0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
        1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }
      }
    ];
    plugins.item = (i) => plugins[i];
    plugins.namedItem = (name) => plugins.find(p => p.name === name);
    plugins.refresh = () => {};
    return plugins;
  },
  configurable: true
});

// Fix mimeTypes
Object.defineProperty(navigator, 'mimeTypes', {
  get: () => {
    const mimeTypes = [
      { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
      { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
      { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }
    ];
    mimeTypes.item = (i) => mimeTypes[i];
    mimeTypes.namedItem = (name) => mimeTypes.find(m => m.type === name);
    return mimeTypes;
  },
  configurable: true
});

// Hide chrome automation
if (window.chrome) {
  window.chrome.runtime = {
    connect: () => {},
    sendMessage: () => {},
    onMessage: { addListener: () => {} }
  };
}

// Fix permissions API
const originalQuery = window.navigator.permissions?.query;
if (originalQuery) {
  window.navigator.permissions.query = (parameters) => {
    if (parameters.name === 'notifications') {
      return Promise.resolve({ state: Notification.permission });
    }
    return originalQuery(parameters);
  };
}

// Fix connection info (Network Information API) - use profile-based consistent values
const connectionRtt = ${profile.connectionRtt || 50};
const connectionDownlink = ${profile.connectionDownlink || 10};
const connectionType = '${profile.connectionType || 'wifi'}';

Object.defineProperty(navigator, 'connection', {
  get: () => {
    const conn = {
      effectiveType: '4g',
      rtt: connectionRtt,
      downlink: connectionDownlink,
      saveData: false,
      type: connectionType,
      addEventListener: () => {},
      removeEventListener: () => {},
      onchange: null
    };
    // Make it look like a real NetworkInformation object
    Object.setPrototypeOf(conn, EventTarget.prototype);
    return conn;
  },
  configurable: true
});

// Battery API - return consistent fake values based on profile
const batteryLevel = ${profile.batteryLevel || 0.85};
const batteryCharging = ${profile.batteryCharging !== false};

if (navigator.getBattery) {
  const fakeBattery = {
    charging: batteryCharging,
    chargingTime: batteryCharging ? 0 : Infinity,
    dischargingTime: batteryCharging ? Infinity : 18000,
    level: batteryLevel,
    addEventListener: () => {},
    removeEventListener: () => {},
    onchargingchange: null,
    onchargingtimechange: null,
    ondischargingtimechange: null,
    onlevelchange: null
  };
  Object.setPrototypeOf(fakeBattery, EventTarget.prototype);

  navigator.getBattery = async function() {
    return fakeBattery;
  };
}

// Disable Bluetooth API (fingerprint risk)
if (navigator.bluetooth) {
  Object.defineProperty(navigator, 'bluetooth', {
    get: () => undefined,
    configurable: true
  });
}

// Disable USB API (fingerprint risk)
if (navigator.usb) {
  Object.defineProperty(navigator, 'usb', {
    get: () => undefined,
    configurable: true
  });
}

// Disable Serial API (fingerprint risk)
if (navigator.serial) {
  Object.defineProperty(navigator, 'serial', {
    get: () => undefined,
    configurable: true
  });
}

// Disable HID API
if (navigator.hid) {
  Object.defineProperty(navigator, 'hid', {
    get: () => undefined,
    configurable: true
  });
}

// Override pdfViewerEnabled (Chrome 94+)
Object.defineProperty(navigator, 'pdfViewerEnabled', {
  get: () => true,
  configurable: true
});

// NOTE: Removed webkitTemporaryStorage override - it triggers incognito detection
// The storage quota in fake mode doesn't match real storage behavior

// Override keyboard API
if (navigator.keyboard) {
  const originalGetLayoutMap = navigator.keyboard.getLayoutMap;
  if (originalGetLayoutMap) {
    navigator.keyboard.getLayoutMap = async function() {
      const map = await originalGetLayoutMap.call(navigator.keyboard);
      // Return empty map or consistent layout
      return map;
    };
  }
}

// Override sendBeacon to look normal
const originalSendBeacon = navigator.sendBeacon;
if (originalSendBeacon) {
  navigator.sendBeacon = function(url, data) {
    return originalSendBeacon.call(navigator, url, data);
  };
}

console.debug('[Stealth] Navigator spoofing applied - UserAgent:', USER_AGENT.substring(0, 50) + '...');
`;
}

module.exports = { buildNavigatorScript };
