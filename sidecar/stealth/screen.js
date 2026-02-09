/**
 * Screen Properties Spoofing Module
 * Overrides screen dimensions and properties
 */

function buildScreenScript(profile) {
  const screenWidth = profile.screenWidth || 1920;
  const screenHeight = profile.screenHeight || 1080;
  const colorDepth = profile.colorDepth || 24;
  const pixelRatio = profile.pixelRatio || 1.0;

  return `
// ======== SCREEN SPOOFING ========

const SCREEN_WIDTH = ${screenWidth};
const SCREEN_HEIGHT = ${screenHeight};
const COLOR_DEPTH = ${colorDepth};
const PIXEL_RATIO = ${pixelRatio};

// Override screen properties
Object.defineProperty(screen, 'width', {
  get: () => SCREEN_WIDTH,
  configurable: true
});

Object.defineProperty(screen, 'height', {
  get: () => SCREEN_HEIGHT,
  configurable: true
});

Object.defineProperty(screen, 'availWidth', {
  get: () => SCREEN_WIDTH,
  configurable: true
});

Object.defineProperty(screen, 'availHeight', {
  get: () => SCREEN_HEIGHT - 40, // Taskbar
  configurable: true
});

Object.defineProperty(screen, 'colorDepth', {
  get: () => COLOR_DEPTH,
  configurable: true
});

Object.defineProperty(screen, 'pixelDepth', {
  get: () => COLOR_DEPTH,
  configurable: true
});

Object.defineProperty(window, 'devicePixelRatio', {
  get: () => PIXEL_RATIO,
  configurable: true
});

// Also override outerWidth/Height for consistency
Object.defineProperty(window, 'outerWidth', {
  get: () => SCREEN_WIDTH,
  configurable: true
});

Object.defineProperty(window, 'outerHeight', {
  get: () => SCREEN_HEIGHT,
  configurable: true
});

console.debug('[Stealth] Screen set to:', SCREEN_WIDTH + 'x' + SCREEN_HEIGHT);
`;
}

module.exports = { buildScreenScript };
