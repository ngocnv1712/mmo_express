/**
 * Audio Fingerprint Noise Module
 * Adds noise to AudioBuffer to randomize fingerprint
 */

function buildAudioScript(profile) {
  const audioNoise = profile.audioNoise || 0.0001;
  const blockAudioContext = profile.blockAudioContext || false;

  return `
// ======== AUDIO FINGERPRINT ========

const AUDIO_NOISE = ${audioNoise};
const BLOCK_AUDIO_CONTEXT = ${blockAudioContext};

if (BLOCK_AUDIO_CONTEXT) {
  // Block AudioContext fingerprinting entirely
  window.AudioContext = function() {
    throw new Error('AudioContext is not available');
  };
  window.webkitAudioContext = window.AudioContext;
  window.OfflineAudioContext = function() {
    throw new Error('OfflineAudioContext is not available');
  };
  window.webkitOfflineAudioContext = window.OfflineAudioContext;

  console.debug('[Stealth] AudioContext blocked');
} else {
  // Add noise to audio buffer data
  const originalGetChannelData = AudioBuffer.prototype.getChannelData;
  AudioBuffer.prototype.getChannelData = function(channel) {
    const data = originalGetChannelData.call(this, channel);

    // Add subtle noise to audio data
    for (let i = 0; i < data.length; i++) {
      data[i] += (Math.random() - 0.5) * AUDIO_NOISE * 2;
    }

    return data;
  };

  // Also override copyFromChannel
  const originalCopyFromChannel = AudioBuffer.prototype.copyFromChannel;
  if (originalCopyFromChannel) {
    AudioBuffer.prototype.copyFromChannel = function(destination, channelNumber, startInChannel) {
      originalCopyFromChannel.call(this, destination, channelNumber, startInChannel);

      for (let i = 0; i < destination.length; i++) {
        destination[i] += (Math.random() - 0.5) * AUDIO_NOISE * 2;
      }
    };
  }

  // Override getFloatFrequencyData for AnalyserNode
  const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
  AnalyserNode.prototype.getFloatFrequencyData = function(array) {
    originalGetFloatFrequencyData.call(this, array);

    for (let i = 0; i < array.length; i++) {
      array[i] += (Math.random() - 0.5) * AUDIO_NOISE * 100;
    }
  };

  console.debug('[Stealth] Audio noise applied:', AUDIO_NOISE);
}
`;
}

module.exports = { buildAudioScript };
