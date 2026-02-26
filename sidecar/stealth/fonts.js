/**
 * Font Fingerprint Protection Module
 * Prevents font enumeration and normalizes font metrics
 */

// Common system fonts by OS
const SYSTEM_FONTS = {
  windows: [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math', 'Comic Sans MS',
    'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
    'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings'
  ],
  macos: [
    'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Helvetica',
    'Helvetica Neue', 'Impact', 'Lucida Grande', 'Monaco', 'Palatino', 'SF Pro',
    'SF Pro Display', 'SF Pro Text', 'Times New Roman', 'Trebuchet MS', 'Verdana'
  ],
  linux: [
    'Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif',
    'FreeMono', 'FreeSans', 'FreeSerif', 'Liberation Mono', 'Liberation Sans',
    'Liberation Serif', 'Noto Sans', 'Noto Serif', 'Times New Roman', 'Ubuntu', 'Verdana'
  ],
  android: [
    'Droid Sans', 'Droid Sans Mono', 'Droid Serif', 'Noto Sans', 'Roboto',
    'Roboto Condensed', 'Roboto Mono'
  ],
  ios: [
    'Arial', 'Courier New', 'Georgia', 'Helvetica', 'Helvetica Neue', 'SF Pro',
    'SF Pro Display', 'SF Pro Text', 'Times New Roman', 'Verdana'
  ]
};

function buildFontsScript(profile) {
  const os = profile.os || 'windows';
  const fonts = profile.fonts && profile.fonts.length > 0
    ? profile.fonts
    : SYSTEM_FONTS[os] || SYSTEM_FONTS.windows;

  return `
// ======== FONT FINGERPRINT PROTECTION ========

const ALLOWED_FONTS = ${JSON.stringify(fonts)};
const FONT_SET = new Set(ALLOWED_FONTS.map(f => f.toLowerCase()));

// Create a consistent hash for font metrics noise
function fontMetricNoise(fontName) {
  let hash = 0;
  for (let i = 0; i < fontName.length; i++) {
    hash = ((hash << 5) - hash) + fontName.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash % 100) / 10000; // Returns 0 to 0.01
}

// Override document.fonts.check() to limit font detection
if (document.fonts && document.fonts.check) {
  const originalCheck = document.fonts.check.bind(document.fonts);
  document.fonts.check = function(font, text) {
    // Extract font family from font string
    const match = font.match(/[\\d.]+(?:px|pt|em|rem)?\\s+(.+)/i);
    if (match) {
      const fontFamily = match[1].replace(/["']/g, '').split(',')[0].trim().toLowerCase();
      // Only return true for allowed fonts
      if (!FONT_SET.has(fontFamily)) {
        return false;
      }
    }
    return originalCheck(font, text);
  };
}

// Override FontFaceSet.prototype.check
if (typeof FontFaceSet !== 'undefined' && FontFaceSet.prototype.check) {
  const originalFontFaceCheck = FontFaceSet.prototype.check;
  FontFaceSet.prototype.check = function(font, text) {
    const match = font.match(/[\\d.]+(?:px|pt|em|rem)?\\s+(.+)/i);
    if (match) {
      const fontFamily = match[1].replace(/["']/g, '').split(',')[0].trim().toLowerCase();
      if (!FONT_SET.has(fontFamily)) {
        return false;
      }
    }
    return originalFontFaceCheck.call(this, font, text);
  };
}

// Add slight noise to font measurements to prevent pixel-perfect fingerprinting
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

if (originalOffsetWidth && originalOffsetWidth.get) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    get: function() {
      const width = originalOffsetWidth.get.call(this);
      // Add tiny noise based on element content
      const noise = fontMetricNoise(this.textContent || '');
      return width + noise;
    },
    configurable: true
  });
}

if (originalOffsetHeight && originalOffsetHeight.get) {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    get: function() {
      const height = originalOffsetHeight.get.call(this);
      const noise = fontMetricNoise(this.textContent || '');
      return height + noise;
    },
    configurable: true
  });
}

// Override TextMetrics for canvas-based font detection
const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
CanvasRenderingContext2D.prototype.measureText = function(text) {
  const metrics = originalMeasureText.call(this, text);

  // Create proxy to add noise to width
  return new Proxy(metrics, {
    get(target, prop) {
      if (prop === 'width') {
        const noise = fontMetricNoise(text);
        return target.width + noise;
      }
      if (typeof target[prop] === 'number') {
        return target[prop] + fontMetricNoise(text) * 0.1;
      }
      return target[prop];
    }
  });
};

console.debug('[Stealth] Font protection applied - ${fonts.length} fonts allowed');
`;
}

module.exports = { buildFontsScript, SYSTEM_FONTS };
