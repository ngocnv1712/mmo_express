/**
 * Canvas Fingerprint Noise Module
 * Adds noise to canvas to randomize fingerprint
 */

function buildCanvasScript(profile) {
  // Canvas noise gây Masking detected - tạm disable
  return `
// Canvas: Disabled - prototype override causes Masking detected
console.debug('[Stealth] Canvas: disabled to avoid detection');
`;
}

module.exports = { buildCanvasScript };
