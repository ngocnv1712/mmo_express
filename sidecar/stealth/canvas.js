/**
 * Canvas Fingerprint Noise Module
 * Adds noise to canvas to randomize fingerprint
 */

function buildCanvasScript(profile) {
  const canvasNoise = profile.canvasNoise || 0.02;
  const blockCanvas = profile.blockCanvas || false;

  return `
// ======== CANVAS FINGERPRINT ========

const CANVAS_NOISE = ${canvasNoise};
const BLOCK_CANVAS = ${blockCanvas};

if (BLOCK_CANVAS) {
  // Block canvas fingerprinting entirely
  HTMLCanvasElement.prototype.toDataURL = function() { return ''; };
  HTMLCanvasElement.prototype.toBlob = function(callback) { callback(new Blob()); };
  CanvasRenderingContext2D.prototype.getImageData = function() {
    return new ImageData(1, 1);
  };
  console.debug('[Stealth] Canvas blocked');
} else {
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

  // Cache to avoid adding noise multiple times to same canvas
  const noisedCanvases = new WeakSet();

  function addCanvasNoise(canvas) {
    if (noisedCanvases.has(canvas)) return;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = originalGetImageData.call(ctx, 0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Add subtle noise to each pixel
      for (let i = 0; i < data.length; i += 4) {
        // Add noise to RGB channels (not alpha)
        const noise = Math.floor(Math.random() * CANVAS_NOISE * 255 * 2) - (CANVAS_NOISE * 255);
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
      }

      ctx.putImageData(imageData, 0, 0);
      noisedCanvases.add(canvas);
    } catch (e) {
      // Ignore errors (e.g., tainted canvas)
    }
  }

  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    addCanvasNoise(this);
    return originalToDataURL.apply(this, args);
  };

  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    addCanvasNoise(this);
    return originalToBlob.call(this, callback, ...args);
  };

  console.debug('[Stealth] Canvas noise applied:', CANVAS_NOISE);
}
`;
}

module.exports = { buildCanvasScript };
