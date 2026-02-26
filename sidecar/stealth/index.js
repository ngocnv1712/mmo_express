/**
 * MMO Express - Stealth Module
 * Combines all anti-detect scripts for Playwright
 */

const { buildNavigatorScript } = require('./navigator');
const { buildCanvasScript } = require('./canvas');
const { buildWebGLScript } = require('./webgl');
const { buildWebRTCScript } = require('./webrtc');
const { buildAudioScript } = require('./audio');
const { buildTimezoneScript } = require('./timezone');
const { buildScreenScript } = require('./screen');
const { buildClientRectsScript } = require('./clientRects');
const { buildMediaDevicesScript } = require('./mediaDevices');
const { buildFontsScript } = require('./fonts');
const { buildSpeechScript } = require('./speech');
const { buildWorkerScript } = require('./worker');
const { buildHeadlessScript } = require('./headless');
const { buildWorkerInjectScript } = require('./workerInject');

/**
 * Build complete stealth script for a profile
 * @param {Object} profile - Profile configuration
 * @returns {string} Combined JavaScript to inject
 */
function buildStealthScript(profile) {
  // DEBUG: Comment từng cái để test
  const scripts = [
    buildNavigatorScript(profile),       // 1. Navigator (empty - webdriver from flag)
    buildTimezoneScript(profile),        // 2. Timezone ✓
    buildCanvasScript(profile),          // 3. Canvas (empty - avoid detection)
    buildWebGLScript(profile),           // 4. WebGL (empty - avoid detection)
    // buildScreenScript(profile),       // 5. Screen - DISABLED
    buildWebRTCScript(profile),       // 6. WebRTC ✓
    buildAudioScript(profile),        // 7. Audio ✓
    buildClientRectsScript(profile),  // 8. ClientRects ✓
    buildMediaDevicesScript(profile), // 9. MediaDevices ✓
    buildFontsScript(profile),        // 10. Fonts ✓
    buildSpeechScript(profile),       // 11. Speech ✓
    buildHeadlessScript(profile),     // 12. Headless ← TESTING
  ];

  return `
(function() {
  'use strict';

  try {
    ${scripts.join('\n\n')}
    console.debug('[Stealth] All protections applied');
  } catch (e) {
    console.error('[Stealth] Error:', e.message);
  }
})();
`;
}

/**
 * Get default profile with anti-detect settings
 * @returns {Object} Default profile configuration
 */
function getDefaultProfile() {
  return {
    // Navigator
    platform: 'Win32',
    cpuCores: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    locale: 'en-US',
    language: 'en-US,en',
    doNotTrack: false,

    // Screen
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,

    // WebGL
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)',

    // Fingerprint noise (recommended values)
    canvasNoise: 0.02,      // 0.02-0.03 for canvas
    audioNoise: 0.0001,     // 0.0001-0.001 for audio
    clientRectsNoise: 0.1,  // 0.1-0.3 for client rects

    // WebRTC
    webrtcMode: 'replace',  // 'real', 'replace', 'disable'
    webrtcPublicIP: '',
    blockWebRTC: false,

    // Audio
    blockAudioContext: false,
    blockCanvas: false,

    // Timezone
    timezone: 'America/New_York',

    // Geolocation
    geoMode: 'query',       // 'real', 'allow', 'block', 'query'
    geoLatitude: 0,
    geoLongitude: 0,
    geoAccuracy: 100,

    // Media Devices
    mediaDevicesMode: 'real', // 'real', 'fake', 'block'
    fakeCameras: 1,
    fakeMicrophones: 1,
    fakeSpeakers: 1,
  };
}

module.exports = {
  buildStealthScript,
  getDefaultProfile,
  // Export individual builders for custom use
  buildNavigatorScript,
  buildCanvasScript,
  buildWebGLScript,
  buildWebRTCScript,
  buildAudioScript,
  buildTimezoneScript,
  buildScreenScript,
  buildClientRectsScript,
  buildMediaDevicesScript,
  buildFontsScript,
  buildSpeechScript,
  buildWorkerScript,
  buildHeadlessScript,
  buildWorkerInjectScript,
};
