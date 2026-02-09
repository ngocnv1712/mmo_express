/**
 * Media Devices Spoofing Module
 * Fakes or blocks camera/microphone/speaker enumeration
 */

function buildMediaDevicesScript(profile) {
  const mediaDevicesMode = profile.mediaDevicesMode || 'real';
  const fakeCameras = profile.fakeCameras || 1;
  const fakeMicrophones = profile.fakeMicrophones || 1;
  const fakeSpeakers = profile.fakeSpeakers || 1;

  return `
// ======== MEDIA DEVICES ========

const MEDIA_DEVICES_MODE = '${mediaDevicesMode}';
const FAKE_CAMERAS = ${fakeCameras};
const FAKE_MICROPHONES = ${fakeMicrophones};
const FAKE_SPEAKERS = ${fakeSpeakers};

// Generate consistent device IDs based on profile
function generateDeviceId(type, index) {
  const base = type + '-' + index + '-${profile.id || 'default'}';
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + Math.random().toString(36).substr(2, 9);
}

if (MEDIA_DEVICES_MODE === 'block') {
  // Block all media device enumeration
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = async function() {
      return [];
    };

    navigator.mediaDevices.getUserMedia = async function() {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };

    navigator.mediaDevices.getDisplayMedia = async function() {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
  }

  console.debug('[Stealth] Media devices blocked');
} else if (MEDIA_DEVICES_MODE === 'fake') {
  // Return fake devices
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = async function() {
      const devices = [];

      // Generate fake cameras
      for (let i = 0; i < FAKE_CAMERAS; i++) {
        devices.push({
          deviceId: generateDeviceId('camera', i),
          groupId: 'group-' + i,
          kind: 'videoinput',
          label: i === 0 ? 'Integrated Camera' : 'USB Camera ' + i
        });
      }

      // Generate fake microphones
      for (let i = 0; i < FAKE_MICROPHONES; i++) {
        devices.push({
          deviceId: generateDeviceId('mic', i),
          groupId: 'group-' + (i + FAKE_CAMERAS),
          kind: 'audioinput',
          label: i === 0 ? 'Internal Microphone' : 'USB Microphone ' + i
        });
      }

      // Generate fake speakers
      for (let i = 0; i < FAKE_SPEAKERS; i++) {
        devices.push({
          deviceId: generateDeviceId('speaker', i),
          groupId: 'group-' + (i + FAKE_CAMERAS + FAKE_MICROPHONES),
          kind: 'audiooutput',
          label: i === 0 ? 'Speakers (Realtek High Definition Audio)' : 'External Speaker ' + i
        });
      }

      return devices;
    };
  }

  console.debug('[Stealth] Fake media devices:', FAKE_CAMERAS, 'cameras,', FAKE_MICROPHONES, 'mics,', FAKE_SPEAKERS, 'speakers');
}
// 'real' mode uses default browser behavior
`;
}

module.exports = { buildMediaDevicesScript };
