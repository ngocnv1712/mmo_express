/**
 * Headless Detection Prevention Module
 * Patches various methods used to detect headless/automated browsers
 */

function buildHeadlessScript(profile) {
  return `
// ======== HEADLESS DETECTION PREVENTION ========

// 1. Remove automation-related properties
const automationProps = [
  'webdriver',
  '__webdriver_script_fn',
  '__driver_evaluate',
  '__webdriver_evaluate',
  '__selenium_evaluate',
  '__fxdriver_evaluate',
  '__driver_unwrapped',
  '__webdriver_unwrapped',
  '__selenium_unwrapped',
  '__fxdriver_unwrapped',
  '__webdriver_script_func',
  '_Selenium_IDE_Recorder',
  '_selenium',
  'calledSelenium',
  '$cdc_asdjflasutopfhvcZLmcfl_',
  '$chrome_asyncScriptInfo',
  '__$webdriverAsyncExecutor',
  'webdriver',
  '__nightmare',
  '__phantomas',
  '_phantom',
  'phantom',
  'callPhantom',
  '__testing',
  '_testing',
];

automationProps.forEach(prop => {
  try {
    if (prop in window) {
      delete window[prop];
    }
    if (prop in document) {
      delete document[prop];
    }
  } catch(e) {}
});

// 2. Fix navigator.webdriver (critical)
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});

// Also try to delete from prototype
try {
  delete Object.getPrototypeOf(navigator).webdriver;
} catch(e) {}

// 3. Fix window.chrome (make it look like real Chrome)
if (!window.chrome) {
  window.chrome = {};
}

window.chrome.app = {
  isInstalled: false,
  InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
  RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
  getDetails: function() { return null; },
  getIsInstalled: function() { return false; },
  installState: function() { return 'not_installed'; },
  runningState: function() { return 'cannot_run'; },
};

window.chrome.runtime = {
  OnInstalledReason: {
    CHROME_UPDATE: 'chrome_update',
    INSTALL: 'install',
    SHARED_MODULE_UPDATE: 'shared_module_update',
    UPDATE: 'update',
  },
  OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
  PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
  PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
  PlatformOs: { ANDROID: 'android', CROS: 'cros', FUCHSIA: 'fuchsia', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
  RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
  connect: function() { return { onDisconnect: { addListener: function() {} }, onMessage: { addListener: function() {} }, postMessage: function() {} }; },
  sendMessage: function() {},
  id: undefined,
};

window.chrome.csi = function() {
  return {
    onloadT: Date.now(),
    pageT: performance.now(),
    startE: Date.now() - performance.now(),
    tran: 15,
  };
};

window.chrome.loadTimes = function() {
  return {
    commitLoadTime: Date.now() / 1000,
    connectionInfo: 'h2',
    finishDocumentLoadTime: Date.now() / 1000,
    finishLoadTime: Date.now() / 1000,
    firstPaintAfterLoadTime: 0,
    firstPaintTime: Date.now() / 1000,
    navigationType: 'Other',
    npnNegotiatedProtocol: 'h2',
    requestTime: Date.now() / 1000 - 0.5,
    startLoadTime: Date.now() / 1000 - 0.5,
    wasAlternateProtocolAvailable: false,
    wasFetchedViaSpdy: true,
    wasNpnNegotiated: true,
  };
};

// 4. Fix Permissions API (query for notifications)
const originalPermissionsQuery = navigator.permissions?.query;
if (originalPermissionsQuery) {
  navigator.permissions.query = function(parameters) {
    // Return 'prompt' instead of 'denied' for automation detection
    if (parameters.name === 'notifications') {
      return Promise.resolve({
        state: Notification.permission === 'denied' ? 'prompt' : Notification.permission,
        onchange: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      });
    }
    return originalPermissionsQuery.call(navigator.permissions, parameters);
  };
}

// 5. Fix console.debug to not expose automation
const originalConsoleDebug = console.debug;
console.debug = function(...args) {
  // Filter out Playwright/Puppeteer related messages
  const str = args.join(' ');
  if (str.includes('puppeteer') || str.includes('playwright') || str.includes('automation')) {
    return;
  }
  return originalConsoleDebug.apply(console, args);
};

// 6. Fix outerWidth/outerHeight (headless browsers have 0)
if (window.outerWidth === 0) {
  Object.defineProperty(window, 'outerWidth', {
    get: () => window.innerWidth + 16,
    configurable: true
  });
}
if (window.outerHeight === 0) {
  Object.defineProperty(window, 'outerHeight', {
    get: () => window.innerHeight + 85,
    configurable: true
  });
}

// 7. Fix window.history.length (headless typically has 1)
try {
  Object.defineProperty(window.history, 'length', {
    get: () => Math.floor(Math.random() * 3) + 2,
    configurable: true
  });
} catch(e) {}

// 8. Fix Error.prototype.stack (remove automation traces)
const originalStackGetter = Object.getOwnPropertyDescriptor(Error.prototype, 'stack')?.get;
if (originalStackGetter) {
  Object.defineProperty(Error.prototype, 'stack', {
    get: function() {
      const stack = originalStackGetter.call(this);
      if (typeof stack === 'string') {
        // Remove puppeteer/playwright from stack traces
        return stack
          .replace(/puppeteer/gi, 'browser')
          .replace(/playwright/gi, 'browser')
          .replace(/webdriver/gi, 'browser')
          .replace(/__puppeteer_evaluation_script__/g, 'anonymous');
      }
      return stack;
    },
    configurable: true
  });
}

// 9. Fix document.hasFocus (headless returns false)
const originalHasFocus = document.hasFocus;
document.hasFocus = function() {
  return true;
};

// 10. Fix window.screenX/screenY (headless typically 0)
if (window.screenX === 0 && window.screenY === 0) {
  Object.defineProperty(window, 'screenX', {
    get: () => Math.floor(Math.random() * 100) + 10,
    configurable: true
  });
  Object.defineProperty(window, 'screenY', {
    get: () => Math.floor(Math.random() * 100) + 10,
    configurable: true
  });
}

// 11. Fix Intl.DateTimeFormat (timezone detection)
// This helps ensure timezone consistency
const originalDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function(locale, options) {
  const dtf = new originalDateTimeFormat(locale, options);
  return dtf;
};
Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
Object.defineProperty(Intl.DateTimeFormat, 'name', { value: 'DateTimeFormat' });
Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;

// 12. Fix performance.memory (only available in Chrome)
if (!performance.memory) {
  Object.defineProperty(performance, 'memory', {
    get: () => ({
      jsHeapSizeLimit: 2172649472,
      totalJSHeapSize: 19321856,
      usedJSHeapSize: 16781520
    }),
    configurable: true
  });
}

// 13. Fix CSS media queries that detect automation
// matchMedia for prefers-reduced-motion
const originalMatchMedia = window.matchMedia;
window.matchMedia = function(query) {
  const result = originalMatchMedia.call(window, query);

  // Override specific media queries used for headless detection
  if (query === '(prefers-reduced-motion: reduce)') {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function() {},
      removeListener: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    };
  }

  return result;
};

// 14. Fix OffscreenCanvas (often missing in headed browsers but present in headless)
// CreepJS uses this for detection

// 15. Prevent iframe content window detection
// Some sites check if iframes have proper contentWindow
const originalCreateElement = document.createElement;
document.createElement = function(tagName, options) {
  const element = originalCreateElement.call(document, tagName, options);

  if (tagName.toLowerCase() === 'iframe') {
    // Ensure iframe looks normal
    const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    if (originalContentWindow) {
      Object.defineProperty(element, 'contentWindow', {
        get: function() {
          const win = originalContentWindow.get.call(this);
          return win;
        },
        configurable: true
      });
    }
  }

  return element;
};

// Note: WebGL spoofing is handled by webgl.js - no duplicate code here

// 16. Make sure the prototype chain looks normal
try {
  // Fix Navigator prototype
  Object.defineProperty(Navigator.prototype, Symbol.toStringTag, {
    get: () => 'Navigator',
    configurable: true
  });
} catch(e) {}

// 17. Fix Incognito/Private Mode detection
// Sites detect incognito using storage quota estimation
if (navigator.storage && navigator.storage.estimate) {
  const originalEstimate = navigator.storage.estimate;
  navigator.storage.estimate = async function() {
    // Always return a large quota to appear as normal browsing
    // Don't even check the real quota - just return fake values
    return {
      quota: 107374182400, // ~100GB (normal Chrome)
      usage: Math.floor(Math.random() * 1000000) + 50000, // Random usage 50KB-1MB
      usageDetails: {
        indexedDB: Math.floor(Math.random() * 500000) + 10000,
        caches: Math.floor(Math.random() * 300000) + 5000,
        serviceWorkerRegistrations: Math.floor(Math.random() * 100000) + 1000
      }
    };
  };
}

// 17b. Fix navigator.storage.persist() and persisted()
if (navigator.storage) {
  navigator.storage.persist = async function() {
    return true; // Always claim persistence is granted
  };
  navigator.storage.persisted = async function() {
    return true; // Always claim storage is persisted (non-incognito)
  };
}

// 18. Fix FileSystem API (used for incognito detection)
// In incognito, webkitRequestFileSystem fails or has limited quota
if (window.webkitRequestFileSystem) {
  const originalRequestFileSystem = window.webkitRequestFileSystem;
  window.webkitRequestFileSystem = function(type, size, success, error) {
    // Always try to succeed with a mock filesystem if real one fails
    const originalError = error;
    originalRequestFileSystem.call(window, type, size, success, function(err) {
      // If it fails (likely incognito), create a mock success
      if (success) {
        // Create a minimal mock filesystem
        success({
          name: '',
          root: {
            isFile: false,
            isDirectory: true,
            name: '',
            fullPath: '/',
            getFile: function(path, options, success, error) { if (error) error({ name: 'NotFoundError' }); },
            getDirectory: function(path, options, success, error) { if (error) error({ name: 'NotFoundError' }); }
          }
        });
      }
    });
  };
}

// 19. Fix ServiceWorker in incognito (it's available but registration fails)
// Don't completely hide it, just make it behave normally

// 20. Fix IndexedDB detection (used for incognito detection)
// In some browsers, indexedDB.open fails silently in incognito
if (window.indexedDB) {
  const originalOpen = window.indexedDB.open;
  window.indexedDB.open = function(name, version) {
    try {
      return originalOpen.call(window.indexedDB, name, version);
    } catch (e) {
      // If IndexedDB fails (incognito), return a mock request
      const mockRequest = {
        result: null,
        error: null,
        source: null,
        transaction: null,
        readyState: 'done',
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        onblocked: null
      };
      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.onerror({ target: mockRequest });
        }
      }, 0);
      return mockRequest;
    }
  };
}

// 21. Fix Cache API quota (incognito has limited cache)
if (window.caches) {
  const originalCachesOpen = window.caches.open;
  window.caches.open = async function(cacheName) {
    try {
      return await originalCachesOpen.call(window.caches, cacheName);
    } catch (e) {
      // Return a mock cache if it fails
      return {
        match: async () => undefined,
        matchAll: async () => [],
        add: async () => {},
        addAll: async () => {},
        put: async () => {},
        delete: async () => false,
        keys: async () => []
      };
    }
  };
}

// 22. Fix StorageManager.getDirectory (File System Access API)
if (navigator.storage && !navigator.storage.getDirectory) {
  navigator.storage.getDirectory = async function() {
    // Return a mock directory handle
    return {
      kind: 'directory',
      name: '',
      isSameEntry: async () => false,
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFileHandle: async () => { throw new DOMException('', 'NotFoundError'); },
      getDirectoryHandle: async () => { throw new DOMException('', 'NotFoundError'); },
      removeEntry: async () => {},
      resolve: async () => null,
      keys: async function*() {},
      values: async function*() {},
      entries: async function*() {}
    };
  };
}

// 23. Fix navigator.credentials (may behave differently in incognito)
if (navigator.credentials) {
  const originalGet = navigator.credentials.get;
  const originalStore = navigator.credentials.store;

  navigator.credentials.get = async function(options) {
    try {
      return await originalGet.call(navigator.credentials, options);
    } catch (e) {
      return null;
    }
  };

  navigator.credentials.store = async function(credential) {
    try {
      return await originalStore.call(navigator.credentials, credential);
    } catch (e) {
      return credential;
    }
  };
}

console.debug('[Stealth] Headless detection prevention applied (incognito bypass enabled)');
`;
}

module.exports = { buildHeadlessScript };
