/**
 * WebGL Fingerprint Spoofing Module
 * Overrides WebGL vendor and renderer
 */

function buildWebGLScript(profile) {
  const vendor = profile.webglVendor || 'Google Inc. (NVIDIA)';
  const renderer = profile.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)';

  return `
// ======== WEBGL FINGERPRINT ========

const WEBGL_VENDOR = '${vendor}';
const WEBGL_RENDERER = '${renderer}';

// WebGL 1.0
const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(param) {
  // UNMASKED_VENDOR_WEBGL
  if (param === 37445) return WEBGL_VENDOR;
  // UNMASKED_RENDERER_WEBGL
  if (param === 37446) return WEBGL_RENDERER;
  return originalGetParameter.call(this, param);
};

// WebGL 2.0
if (typeof WebGL2RenderingContext !== 'undefined') {
  const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return WEBGL_VENDOR;
    if (param === 37446) return WEBGL_RENDERER;
    return originalGetParameter2.call(this, param);
  };
}

// Also override getExtension for WEBGL_debug_renderer_info
const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
WebGLRenderingContext.prototype.getExtension = function(name) {
  const ext = originalGetExtension.call(this, name);
  if (name === 'WEBGL_debug_renderer_info' && ext) {
    // Return a proxy that overrides the constants
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

console.debug('[Stealth] WebGL spoofed:', WEBGL_VENDOR, WEBGL_RENDERER);
`;
}

module.exports = { buildWebGLScript };
