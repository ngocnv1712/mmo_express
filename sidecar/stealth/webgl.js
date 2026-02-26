/**
 * WebGL Fingerprint Spoofing Module
 * Overrides WebGL vendor, renderer, and adds image noise
 */

function buildWebGLScript(profile) {
  const webglMode = profile.webglMode || 'off'; // 'off', 'block', 'spoof'

  if (webglMode === 'off') {
    return `
// WebGL: No modifications (real values)
console.debug('[Stealth] WebGL: using real values');
`;
  }

  if (webglMode === 'block') {
    // Block WEBGL_debug_renderer_info extension entirely
    // Privacy approach - websites can't get vendor/renderer at all
    return `
// ======== WEBGL STEALTH (Block Debug Info) ========
(function() {
  // Block getExtension for debug info
  const _getExtension = WebGLRenderingContext.prototype.getExtension;
  WebGLRenderingContext.prototype.getExtension = function(name) {
    if (name === 'WEBGL_debug_renderer_info') return null;
    return _getExtension.apply(this, arguments);
  };

  if (typeof WebGL2RenderingContext !== 'undefined') {
    const _getExtension2 = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function(name) {
      if (name === 'WEBGL_debug_renderer_info') return null;
      return _getExtension2.apply(this, arguments);
    };
  }

  console.debug('[Stealth] WebGL: debug_renderer_info blocked');
})();
`;
  }

  // Default: no modification to avoid detection
  return `
// WebGL: Disabled to avoid masking detection
console.debug('[Stealth] WebGL: disabled (spoofing causes detection)');
`;
}

function buildWebGLScriptFull(profile) {
  const vendor = profile.webglVendor || 'Google Inc. (NVIDIA)';
  const renderer = profile.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const webglImageMode = profile.webglImageMode || 'noise';
  const webglNoise = profile.webglNoise || 0.02;

  return `
// ======== WEBGL FINGERPRINT (FULL - DISABLED) ========

const WEBGL_VENDOR = '${vendor}';
const WEBGL_RENDERER = '${renderer}';
const WEBGL_IMAGE_MODE = '${webglImageMode}';
const WEBGL_NOISE = ${webglNoise};

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

// Add noise to WebGL readPixels to randomize WebGL fingerprint
if (WEBGL_IMAGE_MODE === 'noise') {
  const originalReadPixels = WebGLRenderingContext.prototype.readPixels;
  WebGLRenderingContext.prototype.readPixels = function(x, y, width, height, format, type, pixels) {
    originalReadPixels.call(this, x, y, width, height, format, type, pixels);

    if (pixels && pixels.length) {
      // Add subtle noise to pixel data
      for (let i = 0; i < pixels.length; i += 4) {
        const noise = Math.floor((Math.random() - 0.5) * WEBGL_NOISE * 255);
        pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise));
        pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise));
        pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise));
      }
    }
  };

  // Also for WebGL2
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const originalReadPixels2 = WebGL2RenderingContext.prototype.readPixels;
    WebGL2RenderingContext.prototype.readPixels = function(x, y, width, height, format, type, pixels) {
      originalReadPixels2.call(this, x, y, width, height, format, type, pixels);

      if (pixels && pixels.length) {
        for (let i = 0; i < pixels.length; i += 4) {
          const noise = Math.floor((Math.random() - 0.5) * WEBGL_NOISE * 255);
          pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise));
          pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise));
          pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise));
        }
      }
    };
  }

  console.debug('[Stealth] WebGL image noise applied:', WEBGL_NOISE);
}

// Override other WebGL parameters that can be used for fingerprinting
const originalGetShaderPrecisionFormat = WebGLRenderingContext.prototype.getShaderPrecisionFormat;
WebGLRenderingContext.prototype.getShaderPrecisionFormat = function(shaderType, precisionType) {
  const result = originalGetShaderPrecisionFormat.call(this, shaderType, precisionType);
  // Return consistent values
  return result;
};

// Override getSupportedExtensions to return consistent list
const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
WebGLRenderingContext.prototype.getSupportedExtensions = function() {
  const extensions = originalGetSupportedExtensions.call(this);
  // Could filter extensions here if needed
  return extensions;
};

// OffscreenCanvas WebGL spoofing (used by workers)
if (typeof OffscreenCanvas !== 'undefined') {
  const originalGetContext = OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext = function(type, options) {
    const ctx = originalGetContext.call(this, type, options);

    if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
      // Override getParameter for OffscreenCanvas WebGL context
      const originalCtxGetParameter = ctx.getParameter.bind(ctx);
      ctx.getParameter = function(param) {
        if (param === 37445) return WEBGL_VENDOR;
        if (param === 37446) return WEBGL_RENDERER;
        return originalCtxGetParameter(param);
      };

      // Override getExtension
      const originalCtxGetExtension = ctx.getExtension.bind(ctx);
      ctx.getExtension = function(name) {
        const ext = originalCtxGetExtension(name);
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

console.debug('[Stealth] WebGL spoofed:', WEBGL_VENDOR.substring(0, 30) + '...');
`;
}

module.exports = { buildWebGLScript };
