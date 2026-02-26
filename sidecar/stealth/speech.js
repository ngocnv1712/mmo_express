/**
 * Speech Synthesis Spoofing Module
 * Normalizes speechSynthesis.getVoices() to prevent OS fingerprinting
 */

// Common voices per OS
const SPEECH_VOICES = {
  windows: [
    { name: 'Microsoft David - English (United States)', lang: 'en-US', voiceURI: 'Microsoft David - English (United States)', localService: true, default: true },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', voiceURI: 'Microsoft Zira - English (United States)', localService: true, default: false },
    { name: 'Microsoft Mark - English (United States)', lang: 'en-US', voiceURI: 'Microsoft Mark - English (United States)', localService: true, default: false }
  ],
  macos: [
    { name: 'Alex', lang: 'en-US', voiceURI: 'Alex', localService: true, default: true },
    { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: false },
    { name: 'Victoria', lang: 'en-GB', voiceURI: 'Victoria', localService: true, default: false }
  ],
  linux: [
    { name: 'English (America)', lang: 'en-US', voiceURI: 'English (America)', localService: true, default: true }
  ],
  android: [
    { name: 'English United States', lang: 'en-US', voiceURI: 'English United States', localService: true, default: true }
  ],
  ios: [
    { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: true }
  ]
};

function buildSpeechScript(profile) {
  const os = profile.os || 'windows';
  const voices = profile.speechVoices && profile.speechVoices.length > 0
    ? profile.speechVoices
    : SPEECH_VOICES[os] || SPEECH_VOICES.windows;

  return `
// ======== SPEECH SYNTHESIS SPOOFING ========

const FAKE_VOICES = ${JSON.stringify(voices)};

if (window.speechSynthesis) {
  // Create fake SpeechSynthesisVoice objects
  const createVoice = (voiceData) => {
    const voice = {};
    Object.defineProperties(voice, {
      name: { value: voiceData.name, enumerable: true },
      lang: { value: voiceData.lang, enumerable: true },
      voiceURI: { value: voiceData.voiceURI, enumerable: true },
      localService: { value: voiceData.localService, enumerable: true },
      default: { value: voiceData.default, enumerable: true }
    });
    // Make it look like a real SpeechSynthesisVoice
    Object.setPrototypeOf(voice, SpeechSynthesisVoice?.prototype || Object.prototype);
    return voice;
  };

  const fakeVoices = FAKE_VOICES.map(createVoice);

  // Override getVoices
  const originalGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
  speechSynthesis.getVoices = function() {
    return fakeVoices;
  };

  // Override onvoiceschanged to return fake voices
  let voicesChangedHandler = null;
  Object.defineProperty(speechSynthesis, 'onvoiceschanged', {
    get: () => voicesChangedHandler,
    set: (handler) => {
      voicesChangedHandler = handler;
      // Trigger immediately with fake voices
      if (handler) {
        setTimeout(() => handler(), 0);
      }
    },
    configurable: true
  });

  // Trigger voiceschanged event
  setTimeout(() => {
    if (voicesChangedHandler) {
      voicesChangedHandler();
    }
    speechSynthesis.dispatchEvent?.(new Event('voiceschanged'));
  }, 100);

  console.debug('[Stealth] Speech synthesis spoofed - ${voices.length} voices');
}
`;
}

module.exports = { buildSpeechScript, SPEECH_VOICES };
