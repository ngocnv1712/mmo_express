/**
 * WebRTC Protection Module
 * Prevents IP leaks through WebRTC
 */

function buildWebRTCScript(profile) {
  const webrtcMode = profile.webrtcMode || 'replace';
  const webrtcPublicIP = profile.webrtcPublicIP || '';
  const blockWebRTC = profile.blockWebRTC || false;

  return `
// ======== WEBRTC PROTECTION ========

const WEBRTC_MODE = '${webrtcMode}';
const WEBRTC_PUBLIC_IP = '${webrtcPublicIP}';
const BLOCK_WEBRTC = ${blockWebRTC};

if (BLOCK_WEBRTC || WEBRTC_MODE === 'disable') {
  // Completely disable WebRTC
  window.RTCPeerConnection = undefined;
  window.webkitRTCPeerConnection = undefined;
  window.mozRTCPeerConnection = undefined;
  window.RTCDataChannel = undefined;
  window.RTCSessionDescription = undefined;
  window.RTCIceCandidate = undefined;

  // Also disable getUserMedia
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async function() {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
  }

  console.debug('[Stealth] WebRTC disabled');
} else if (WEBRTC_MODE === 'replace' && WEBRTC_PUBLIC_IP) {
  // Replace WebRTC IP with custom IP (proxy IP)
  const OriginalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;

  if (OriginalRTCPeerConnection) {
    window.RTCPeerConnection = function(config, constraints) {
      // Remove STUN/TURN servers to prevent IP detection
      if (config && config.iceServers) {
        config.iceServers = [];
      }

      const pc = new OriginalRTCPeerConnection(config, constraints);

      // Override setLocalDescription to modify SDP
      const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
      pc.setLocalDescription = function(desc) {
        if (desc && desc.sdp && WEBRTC_PUBLIC_IP) {
          // Replace all IP addresses in SDP with proxy IP
          desc.sdp = desc.sdp.replace(
            /\\b(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\b/g,
            (match) => {
              // Don't replace 0.0.0.0 or loopback
              if (match === '0.0.0.0' || match.startsWith('127.')) {
                return match;
              }
              return WEBRTC_PUBLIC_IP;
            }
          );
        }
        return originalSetLocalDescription(desc);
      };

      // Filter ICE candidates
      const originalAddIceCandidate = pc.addIceCandidate.bind(pc);
      pc.addIceCandidate = function(candidate) {
        if (candidate && candidate.candidate && WEBRTC_PUBLIC_IP) {
          // Modify candidate to use proxy IP
          const modifiedCandidate = {
            ...candidate,
            candidate: candidate.candidate.replace(
              /\\b(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\b/g,
              (match) => {
                if (match === '0.0.0.0' || match.startsWith('127.')) {
                  return match;
                }
                return WEBRTC_PUBLIC_IP;
              }
            )
          };
          return originalAddIceCandidate(modifiedCandidate);
        }
        return originalAddIceCandidate(candidate);
      };

      return pc;
    };

    window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
    window.webkitRTCPeerConnection = window.RTCPeerConnection;

    console.debug('[Stealth] WebRTC IP replaced with:', WEBRTC_PUBLIC_IP);
  }
} else {
  console.debug('[Stealth] WebRTC mode: real (no modification)');
}
`;
}

module.exports = { buildWebRTCScript };
