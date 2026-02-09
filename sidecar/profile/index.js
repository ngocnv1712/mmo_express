/**
 * Profile Module
 * Exports all profile-related functionality
 */

const { defaultProfile, WebRTCMode, GeoMode, MediaDevicesMode, validateProfile, createProfile } = require('./schema');
const { generateRandom, generateWindows, generateMacOS, generateLinux } = require('./generator');
const { presets, getPresetNames, getPreset, getAllPresets } = require('./presets');

module.exports = {
  // Schema
  defaultProfile,
  WebRTCMode,
  GeoMode,
  MediaDevicesMode,
  validateProfile,
  createProfile,

  // Generator
  generateRandom,
  generateWindows,
  generateMacOS,
  generateLinux,

  // Presets
  presets,
  getPresetNames,
  getPreset,
  getAllPresets,
};
