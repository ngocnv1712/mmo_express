/**
 * Anti-Detect Test Suite
 * Tests stealth capabilities against detection sites
 */

/**
 * Test navigator properties
 */
function testNavigator(page) {
  return page.evaluate(() => {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
    };

    // Test webdriver
    if (navigator.webdriver === undefined || navigator.webdriver === false) {
      results.passed.push('webdriver: hidden');
    } else {
      results.failed.push('webdriver: detected');
    }

    // Test plugins
    if (navigator.plugins.length > 0) {
      results.passed.push(`plugins: ${navigator.plugins.length} plugins`);
    } else {
      results.warnings.push('plugins: empty (suspicious)');
    }

    // Test languages
    if (navigator.languages && navigator.languages.length > 0) {
      results.passed.push(`languages: ${navigator.languages.join(', ')}`);
    } else {
      results.warnings.push('languages: empty');
    }

    // Test platform
    if (navigator.platform) {
      results.passed.push(`platform: ${navigator.platform}`);
    }

    // Test hardwareConcurrency
    if (navigator.hardwareConcurrency >= 1) {
      results.passed.push(`cpuCores: ${navigator.hardwareConcurrency}`);
    }

    // Test deviceMemory
    if (navigator.deviceMemory >= 1) {
      results.passed.push(`deviceMemory: ${navigator.deviceMemory}GB`);
    }

    // Test userAgent consistency
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    if (ua.includes('Windows') && platform.includes('Win')) {
      results.passed.push('ua-platform: consistent (Windows)');
    } else if (ua.includes('Mac') && platform.includes('Mac')) {
      results.passed.push('ua-platform: consistent (Mac)');
    } else if (ua.includes('Linux') && platform.includes('Linux')) {
      results.passed.push('ua-platform: consistent (Linux)');
    } else {
      results.warnings.push(`ua-platform: may be inconsistent (${platform})`);
    }

    // Test automation flags
    if (!window.chrome || !window.chrome.runtime) {
      // This is actually normal for non-extension contexts
    }

    // Check for Playwright/Puppeteer specific
    if (!window.__playwright && !window.__puppeteer) {
      results.passed.push('automation-flags: hidden');
    } else {
      results.failed.push('automation-flags: detected');
    }

    return results;
  });
}

/**
 * Test WebGL fingerprint
 */
function testWebGL(page) {
  return page.evaluate(() => {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
    };

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      results.warnings.push('webgl: not available');
      return results;
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

      results.passed.push(`webgl-vendor: ${vendor}`);
      results.passed.push(`webgl-renderer: ${renderer}`);

      // Check for suspicious values
      if (renderer.includes('SwiftShader') || renderer.includes('llvmpipe')) {
        results.warnings.push('webgl-renderer: software rendering (suspicious)');
      }
    } else {
      results.warnings.push('webgl-debug: extension not available');
    }

    return results;
  });
}

/**
 * Test Canvas fingerprint
 */
function testCanvas(page) {
  return page.evaluate(() => {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
      data: {},
    };

    // Create canvas and draw
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');

    // Draw text
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = '#069';
    ctx.fillText('Canvas Fingerprint Test', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas Fingerprint Test', 4, 17);

    // Get data URL
    const dataURL = canvas.toDataURL();
    results.data.hash = dataURL.substring(0, 100) + '...';

    // Test if canvas is readable
    if (dataURL && dataURL.length > 100) {
      results.passed.push('canvas: readable');

      // Run multiple times to check for noise
      const hashes = [];
      for (let i = 0; i < 3; i++) {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 50;
        const cx = c.getContext('2d');
        cx.textBaseline = 'top';
        cx.font = '14px Arial';
        cx.fillStyle = '#f60';
        cx.fillRect(0, 0, 200, 50);
        cx.fillStyle = '#069';
        cx.fillText('Canvas Fingerprint Test', 2, 15);
        hashes.push(c.toDataURL());
      }

      // Check if noise is being applied
      const unique = new Set(hashes);
      if (unique.size > 1) {
        results.passed.push('canvas-noise: active (unique per draw)');
      } else {
        results.warnings.push('canvas-noise: may not be active');
      }
    } else {
      results.failed.push('canvas: blocked or empty');
    }

    return results;
  });
}

/**
 * Test Audio fingerprint
 */
function testAudio(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const results = {
        passed: [],
        failed: [],
        warnings: [],
        data: {},
      };

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          results.warnings.push('audio: AudioContext not available');
          resolve(results);
          return;
        }

        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const analyser = context.createAnalyser();
        const gain = context.createGain();
        const processor = context.createScriptProcessor(4096, 1, 1);

        gain.gain.value = 0; // Mute
        oscillator.type = 'triangle';
        oscillator.frequency.value = 1000;

        oscillator.connect(analyser);
        analyser.connect(processor);
        processor.connect(gain);
        gain.connect(context.destination);

        oscillator.start(0);

        const samples = [];
        processor.onaudioprocess = (event) => {
          const data = event.inputBuffer.getChannelData(0);
          samples.push(...Array.from(data.slice(0, 10)));

          if (samples.length >= 30) {
            oscillator.stop();
            processor.disconnect();
            context.close();

            // Check for noise
            const sum = samples.reduce((a, b) => a + Math.abs(b), 0);
            results.data.sampleSum = sum;

            if (sum > 0) {
              results.passed.push('audio: fingerprint generated');

              // Run multiple times
              // Note: Can't easily do this in single evaluate
              results.passed.push('audio-context: working');
            } else {
              results.warnings.push('audio: silent output');
            }

            resolve(results);
          }
        };

        // Timeout
        setTimeout(() => {
          oscillator.stop();
          context.close();
          results.warnings.push('audio: timeout');
          resolve(results);
        }, 1000);
      } catch (e) {
        results.failed.push(`audio: error - ${e.message}`);
        resolve(results);
      }
    });
  });
}

/**
 * Test WebRTC
 */
function testWebRTC(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const results = {
        passed: [],
        failed: [],
        warnings: [],
        data: { ips: [] },
      };

      if (!window.RTCPeerConnection) {
        results.passed.push('webrtc: disabled/not available');
        resolve(results);
        return;
      }

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.createDataChannel('');

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            // Extract IP addresses
            const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
            const matches = candidate.match(ipRegex);
            if (matches) {
              results.data.ips.push(...matches);
            }
          }
        };

        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(e => {
            results.warnings.push(`webrtc: offer error - ${e.message}`);
          });

        setTimeout(() => {
          pc.close();

          if (results.data.ips.length === 0) {
            results.passed.push('webrtc: no IP leak detected');
          } else {
            const uniqueIPs = [...new Set(results.data.ips)];
            results.warnings.push(`webrtc: IPs found - ${uniqueIPs.join(', ')}`);
          }

          resolve(results);
        }, 2000);
      } catch (e) {
        results.passed.push(`webrtc: blocked - ${e.message}`);
        resolve(results);
      }
    });
  });
}

/**
 * Test Timezone
 */
function testTimezone(page, expectedTimezone = null) {
  return page.evaluate((expected) => {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
      data: {},
    };

    // Get timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    results.data.timezone = tz;

    if (expected && tz === expected) {
      results.passed.push(`timezone: ${tz} (matches expected)`);
    } else if (expected) {
      results.failed.push(`timezone: ${tz} (expected: ${expected})`);
    } else {
      results.passed.push(`timezone: ${tz}`);
    }

    // Check getTimezoneOffset
    const offset = new Date().getTimezoneOffset();
    results.data.offset = offset;
    results.passed.push(`timezone-offset: ${offset} minutes`);

    return results;
  }, expectedTimezone);
}

/**
 * Test Screen properties
 */
function testScreen(page) {
  return page.evaluate(() => {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
      data: {},
    };

    results.data.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    };

    results.data.window = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    };

    // Validate screen size
    if (screen.width >= 320 && screen.height >= 240) {
      results.passed.push(`screen: ${screen.width}x${screen.height}`);
    } else {
      results.warnings.push(`screen: unusual size ${screen.width}x${screen.height}`);
    }

    // Check window vs screen consistency
    if (window.outerWidth <= screen.width && window.outerHeight <= screen.height) {
      results.passed.push('window-screen: consistent');
    } else {
      results.warnings.push('window-screen: window larger than screen');
    }

    // Check devicePixelRatio
    if (window.devicePixelRatio >= 1 && window.devicePixelRatio <= 3) {
      results.passed.push(`pixelRatio: ${window.devicePixelRatio}`);
    } else {
      results.warnings.push(`pixelRatio: unusual value ${window.devicePixelRatio}`);
    }

    return results;
  });
}

/**
 * Run all anti-detect tests
 */
async function runAllTests(page, options = {}) {
  const allResults = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {
      passed: 0,
      failed: 0,
      warnings: 0,
    },
  };

  console.error('[TEST] Running Navigator tests...');
  allResults.tests.navigator = await testNavigator(page);

  console.error('[TEST] Running WebGL tests...');
  allResults.tests.webgl = await testWebGL(page);

  console.error('[TEST] Running Canvas tests...');
  allResults.tests.canvas = await testCanvas(page);

  console.error('[TEST] Running Audio tests...');
  allResults.tests.audio = await testAudio(page);

  console.error('[TEST] Running WebRTC tests...');
  allResults.tests.webrtc = await testWebRTC(page);

  console.error('[TEST] Running Timezone tests...');
  allResults.tests.timezone = await testTimezone(page, options.expectedTimezone);

  console.error('[TEST] Running Screen tests...');
  allResults.tests.screen = await testScreen(page);

  // Calculate summary
  for (const [name, results] of Object.entries(allResults.tests)) {
    allResults.summary.passed += results.passed?.length || 0;
    allResults.summary.failed += results.failed?.length || 0;
    allResults.summary.warnings += results.warnings?.length || 0;
  }

  allResults.summary.total = allResults.summary.passed + allResults.summary.failed + allResults.summary.warnings;
  allResults.summary.score = Math.round((allResults.summary.passed / allResults.summary.total) * 100);

  return allResults;
}

/**
 * Generate test report
 */
function generateReport(results) {
  let report = [];

  report.push('='.repeat(60));
  report.push('ANTI-DETECT TEST REPORT');
  report.push('='.repeat(60));
  report.push(`Timestamp: ${results.timestamp}`);
  report.push(`Score: ${results.summary.score}%`);
  report.push(`Passed: ${results.summary.passed} | Failed: ${results.summary.failed} | Warnings: ${results.summary.warnings}`);
  report.push('');

  for (const [name, testResults] of Object.entries(results.tests)) {
    report.push('-'.repeat(40));
    report.push(`[${name.toUpperCase()}]`);

    if (testResults.passed?.length > 0) {
      testResults.passed.forEach(p => report.push(`  ✓ ${p}`));
    }

    if (testResults.warnings?.length > 0) {
      testResults.warnings.forEach(w => report.push(`  ⚠ ${w}`));
    }

    if (testResults.failed?.length > 0) {
      testResults.failed.forEach(f => report.push(`  ✗ ${f}`));
    }
  }

  report.push('');
  report.push('='.repeat(60));

  return report.join('\n');
}

module.exports = {
  testNavigator,
  testWebGL,
  testCanvas,
  testAudio,
  testWebRTC,
  testTimezone,
  testScreen,
  runAllTests,
  generateReport,
};
