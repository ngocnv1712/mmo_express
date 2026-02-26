/**
 * Worker Inject Stealth Module
 * Creates a compact script for injection into worker contexts via CDP
 * This script spoofs navigator and related APIs in worker contexts
 */

function buildWorkerInjectScript(profile) {
  const userAgent = profile.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const platform = profile.platform || 'Win32';
  const browserType = profile.browserType || 'chrome';

  // Extract Chrome version from user agent
  const chromeVersionMatch = userAgent.match(/Chrome\/(\d+)/);
  const chromeVersion = chromeVersionMatch ? chromeVersionMatch[1] : '120';
  const fullVersionMatch = userAgent.match(/Chrome\/([\d.]+)/);
  const fullVersion = fullVersionMatch ? fullVersionMatch[1] : '120.0.0.0';

  // Determine vendor based on browser type
  const vendor = browserType === 'firefox' ? '' : 'Google Inc.';
  const appVersion = userAgent.replace('Mozilla/', '');

  // Determine platform for userAgentData
  const uaPlatform = profile.os === 'macos' ? 'macOS' :
                     profile.os === 'windows' ? 'Windows' :
                     profile.os === 'android' ? 'Android' :
                     profile.os === 'ios' ? 'iOS' : 'Linux';

  return `
(function() {
  'use strict';

  // Only run in worker contexts
  if (typeof WorkerGlobalScope === 'undefined' && typeof ServiceWorkerGlobalScope === 'undefined') {
    return;
  }

  const SPOOF = {
    userAgent: '${userAgent.replace(/'/g, "\\'")}',
    appVersion: '${appVersion.replace(/'/g, "\\'")}',
    platform: '${platform}',
    vendor: '${vendor}',
    language: '${profile.locale || 'en-US'}',
    languages: Object.freeze(${JSON.stringify((profile.language || 'en-US,en').split(',').map(s => s.trim()))}),
    hardwareConcurrency: ${profile.cpuCores || 8},
    deviceMemory: ${profile.deviceMemory || 8},
    chromeVersion: '${chromeVersion}',
    fullVersion: '${fullVersion}',
    uaPlatform: '${uaPlatform}',
    isMobile: ${profile.os === 'android' || profile.os === 'ios'},
    webglVendor: '${(profile.webglVendor || 'Google Inc. (NVIDIA)').replace(/'/g, "\\'")}',
    webglRenderer: '${(profile.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)').replace(/'/g, "\\'")}',
    connectionRtt: ${profile.connectionRtt || 50},
    connectionDownlink: ${profile.connectionDownlink || 10},
    connectionType: '${profile.connectionType || 'wifi'}'
  };

  // Override navigator properties
  const navOverrides = {
    userAgent: SPOOF.userAgent,
    appVersion: SPOOF.appVersion,
    platform: SPOOF.platform,
    vendor: SPOOF.vendor,
    language: SPOOF.language,
    languages: SPOOF.languages,
    hardwareConcurrency: SPOOF.hardwareConcurrency,
    deviceMemory: SPOOF.deviceMemory,
    webdriver: undefined,
    productSub: '20030107',
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    product: 'Gecko',
    onLine: true
  };

  for (const [key, value] of Object.entries(navOverrides)) {
    try {
      Object.defineProperty(navigator, key, {
        get: () => value,
        configurable: true
      });
    } catch(e) {}
  }

  // Override userAgentData (Client Hints)
  const brands = [
    { brand: 'Chromium', version: SPOOF.chromeVersion },
    { brand: 'Google Chrome', version: SPOOF.chromeVersion },
    { brand: 'Not-A.Brand', version: '99' }
  ];

  const fakeUAData = {
    brands: brands,
    mobile: SPOOF.isMobile,
    platform: SPOOF.uaPlatform,
    getHighEntropyValues: async function(hints) {
      const result = {
        brands: brands,
        mobile: SPOOF.isMobile,
        platform: SPOOF.uaPlatform,
      };
      if (hints.includes('platformVersion')) result.platformVersion = '${profile.os === 'windows' ? '10.0.0' : profile.os === 'macos' ? '14.0.0' : '6.1'}';
      if (hints.includes('architecture')) result.architecture = 'x86';
      if (hints.includes('bitness')) result.bitness = '64';
      if (hints.includes('model')) result.model = '';
      if (hints.includes('uaFullVersion')) result.uaFullVersion = SPOOF.fullVersion;
      if (hints.includes('fullVersionList')) {
        result.fullVersionList = [
          { brand: 'Chromium', version: SPOOF.fullVersion },
          { brand: 'Google Chrome', version: SPOOF.fullVersion },
          { brand: 'Not-A.Brand', version: '99.0.0.0' }
        ];
      }
      return result;
    },
    toJSON: function() {
      return { brands: brands, mobile: SPOOF.isMobile, platform: SPOOF.uaPlatform };
    }
  };

  try {
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => fakeUAData,
      configurable: true
    });
  } catch(e) {}

  // Override connection API
  try {
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: SPOOF.connectionRtt,
        downlink: SPOOF.connectionDownlink,
        saveData: false,
        type: SPOOF.connectionType,
        addEventListener: () => {},
        removeEventListener: () => {},
        onchange: null
      }),
      configurable: true
    });
  } catch(e) {}

  // Override WebGL in OffscreenCanvas (workers use this)
  if (typeof OffscreenCanvas !== 'undefined') {
    const origGetContext = OffscreenCanvas.prototype.getContext;
    OffscreenCanvas.prototype.getContext = function(type, options) {
      const ctx = origGetContext.call(this, type, options);
      if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
        const origGetParam = ctx.getParameter.bind(ctx);
        ctx.getParameter = function(param) {
          if (param === 37445) return SPOOF.webglVendor;
          if (param === 37446) return SPOOF.webglRenderer;
          return origGetParam(param);
        };

        const origGetExt = ctx.getExtension.bind(ctx);
        ctx.getExtension = function(name) {
          const ext = origGetExt(name);
          if (name === 'WEBGL_debug_renderer_info' && ext) {
            return new Proxy(ext, {
              get(target, prop) {
                if (prop === 'UNMASKED_VENDOR_WEBGL') return 37445;
                if (prop === 'UNMASKED_RENDERER_WEBGL') return 37446;
                return target[prop];
              }
            });
          }
          return ext;
        };
      }
      return ctx;
    };
  }

  console.debug('[Worker Stealth] Applied - UA:', SPOOF.userAgent.substring(0, 50) + '...');
})();
`;
}

module.exports = { buildWorkerInjectScript };
