/**
 * Resource Blocking Module
 * Intercepts and blocks unnecessary resources for faster loading
 */

// Known tracker domains
const TRACKER_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'facebook.com/tr',
  'connect.facebook.net',
  'analytics.tiktok.com',
  'pixel.facebook.com',
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'fullstory.com',
  'clarity.ms',
  'newrelic.com',
  'sentry.io',
  'bugsnag.com',
  'intercom.io',
  'crisp.chat',
  'zendesk.com',
  'livechatinc.com',
  'tawk.to',
  'ads.google.com',
  'googlesyndication.com',
  'adservice.google.com',
];

// Resource types to block
const RESOURCE_TYPES = {
  images: ['image', 'imageset'],
  media: ['media', 'video', 'audio'],
  fonts: ['font'],
  css: ['stylesheet'],
};

/**
 * Set up request interception for resource blocking
 * @param {Page} page - Playwright page instance
 * @param {Object} blockingConfig - What to block
 */
async function setupResourceBlocking(page, blockingConfig = {}) {
  const {
    images = false,
    media = false,
    fonts = false,
    css = false,
    trackers = false,
  } = blockingConfig;

  // Collect resource types to block
  const blockedTypes = new Set();

  if (images) {
    RESOURCE_TYPES.images.forEach(t => blockedTypes.add(t));
  }
  if (media) {
    RESOURCE_TYPES.media.forEach(t => blockedTypes.add(t));
  }
  if (fonts) {
    RESOURCE_TYPES.fonts.forEach(t => blockedTypes.add(t));
  }
  if (css) {
    RESOURCE_TYPES.css.forEach(t => blockedTypes.add(t));
  }

  // Only set up interception if there's something to block
  if (blockedTypes.size === 0 && !trackers) {
    return;
  }

  await page.route('**/*', (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    const url = request.url();

    // Block by resource type
    if (blockedTypes.has(resourceType)) {
      return route.abort();
    }

    // Block trackers
    if (trackers) {
      const urlLower = url.toLowerCase();
      for (const domain of TRACKER_DOMAINS) {
        if (urlLower.includes(domain)) {
          return route.abort();
        }
      }
    }

    // Allow everything else
    return route.continue();
  });
}

/**
 * Get blocking summary for logging
 * @param {Object} blockingConfig - Blocking configuration
 * @returns {string} Summary string
 */
function getBlockingSummary(blockingConfig = {}) {
  const blocked = [];
  if (blockingConfig.images) blocked.push('images');
  if (blockingConfig.media) blocked.push('media');
  if (blockingConfig.fonts) blocked.push('fonts');
  if (blockingConfig.css) blocked.push('css');
  if (blockingConfig.trackers) blocked.push('trackers');

  if (blocked.length === 0) return 'none';
  return blocked.join(', ');
}

/**
 * Estimate bandwidth savings
 * @param {Object} blockingConfig - Blocking configuration
 * @returns {number} Estimated percentage saved
 */
function estimateSavings(blockingConfig = {}) {
  let savings = 0;
  if (blockingConfig.images) savings += 50;
  if (blockingConfig.media) savings += 30;
  if (blockingConfig.fonts) savings += 10;
  if (blockingConfig.css) savings += 15;
  if (blockingConfig.trackers) savings += 10;
  return Math.min(savings, 90); // Cap at 90%
}

module.exports = {
  setupResourceBlocking,
  getBlockingSummary,
  estimateSavings,
  TRACKER_DOMAINS,
  RESOURCE_TYPES,
};
