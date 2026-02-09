/**
 * ClientRects Noise Module
 * Adds noise to getBoundingClientRect to randomize fingerprint
 */

function buildClientRectsScript(profile) {
  const clientRectsNoise = profile.clientRectsNoise || 0.1;

  return `
// ======== CLIENT RECTS NOISE ========

const CLIENT_RECTS_NOISE = ${clientRectsNoise};

// Override getBoundingClientRect
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function() {
  const rect = originalGetBoundingClientRect.call(this);
  const noise = CLIENT_RECTS_NOISE;

  return new DOMRect(
    rect.x + (Math.random() - 0.5) * noise,
    rect.y + (Math.random() - 0.5) * noise,
    rect.width + (Math.random() - 0.5) * noise,
    rect.height + (Math.random() - 0.5) * noise
  );
};

// Override getClientRects
const originalGetClientRects = Element.prototype.getClientRects;
Element.prototype.getClientRects = function() {
  const rects = originalGetClientRects.call(this);
  const noise = CLIENT_RECTS_NOISE;
  const modifiedRects = [];

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    modifiedRects.push(new DOMRect(
      rect.x + (Math.random() - 0.5) * noise,
      rect.y + (Math.random() - 0.5) * noise,
      rect.width + (Math.random() - 0.5) * noise,
      rect.height + (Math.random() - 0.5) * noise
    ));
  }

  return modifiedRects;
};

// Override Range.getBoundingClientRect
const originalRangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;
Range.prototype.getBoundingClientRect = function() {
  const rect = originalRangeGetBoundingClientRect.call(this);
  const noise = CLIENT_RECTS_NOISE;

  return new DOMRect(
    rect.x + (Math.random() - 0.5) * noise,
    rect.y + (Math.random() - 0.5) * noise,
    rect.width + (Math.random() - 0.5) * noise,
    rect.height + (Math.random() - 0.5) * noise
  );
};

console.debug('[Stealth] ClientRects noise applied:', CLIENT_RECTS_NOISE);
`;
}

module.exports = { buildClientRectsScript };
