/**
 * Navigator Spoofing Module
 * Overrides navigator properties to hide automation
 */

function buildNavigatorScript(profile) {
  return `
// ======== NAVIGATOR SPOOFING ========

// Remove webdriver property
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});

// Remove automation properties
delete navigator.__proto__.webdriver;

// Override platform
Object.defineProperty(navigator, 'platform', {
  get: () => '${profile.platform || 'Win32'}',
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
  get: () => ${JSON.stringify((profile.language || 'en-US,en').split(','))},
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

// Fix connection info
Object.defineProperty(navigator, 'connection', {
  get: () => ({
    effectiveType: '4g',
    rtt: 50,
    downlink: 10,
    saveData: false
  }),
  configurable: true
});

console.debug('[Stealth] Navigator spoofing applied');
`;
}

module.exports = { buildNavigatorScript };
