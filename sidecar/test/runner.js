/**
 * Test Runner
 * Orchestrates anti-detect and performance tests
 */

const fs = require('fs');
const path = require('path');

const antidetect = require('./antidetect');
const benchmark = require('./benchmark');

/**
 * Test sites for detection testing
 */
const DETECTION_SITES = [
  {
    name: 'BrowserLeaks Canvas',
    url: 'https://browserleaks.com/canvas',
    description: 'Canvas fingerprint test',
  },
  {
    name: 'BrowserLeaks WebGL',
    url: 'https://browserleaks.com/webgl',
    description: 'WebGL fingerprint test',
  },
  {
    name: 'BrowserLeaks JavaScript',
    url: 'https://browserleaks.com/javascript',
    description: 'JavaScript properties test',
  },
  {
    name: 'Pixelscan',
    url: 'https://pixelscan.net',
    description: 'Comprehensive detection test',
  },
  {
    name: 'Bot Detector',
    url: 'https://bot.sannysoft.com',
    description: 'Bot/automation detection',
  },
  {
    name: 'CreepJS',
    url: 'https://abrahamjuliot.github.io/creepjs/',
    description: 'Advanced fingerprinting',
  },
  {
    name: 'IPHey',
    url: 'https://iphey.com',
    description: 'IP and WebRTC test',
  },
];

/**
 * Run detection test on external site
 */
async function runDetectionSiteTest(page, site, timeout = 30000) {
  const result = {
    site: site.name,
    url: site.url,
    description: site.description,
    success: false,
    loadTime: 0,
    screenshot: null,
    pageData: null,
    error: null,
  };

  try {
    const startTime = performance.now();
    await page.goto(site.url, { waitUntil: 'networkidle', timeout });
    result.loadTime = Math.round(performance.now() - startTime);
    result.success = true;

    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Get page title and basic info
    result.pageData = {
      title: await page.title(),
      url: page.url(),
    };

    // Take screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: false });
    result.screenshot = screenshotBuffer.toString('base64');

    console.error(`[TEST] ${site.name}: Loaded in ${result.loadTime}ms`);
  } catch (error) {
    result.error = error.message;
    console.error(`[TEST] ${site.name}: Failed - ${error.message}`);
  }

  return result;
}

/**
 * Run all detection site tests
 */
async function runAllDetectionSiteTests(page, sites = DETECTION_SITES) {
  const results = {
    timestamp: new Date().toISOString(),
    sites: [],
    summary: {
      total: sites.length,
      passed: 0,
      failed: 0,
    },
  };

  for (const site of sites) {
    const result = await runDetectionSiteTest(page, site);
    results.sites.push(result);

    if (result.success) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  }

  return results;
}

/**
 * Run complete test suite
 */
async function runCompleteSuite(page, browser, options = {}) {
  const suite = {
    timestamp: new Date().toISOString(),
    profile: options.profile || null,
    tests: {},
    summary: {
      antidetect: null,
      benchmark: null,
      detectionSites: null,
    },
  };

  console.error('[SUITE] Starting complete test suite...');

  // 1. Anti-detect tests
  console.error('[SUITE] Running anti-detect tests...');
  const antidetectResults = await antidetect.runAllTests(page, {
    expectedTimezone: options.expectedTimezone,
  });
  suite.tests.antidetect = antidetectResults;
  suite.summary.antidetect = {
    score: antidetectResults.summary.score,
    passed: antidetectResults.summary.passed,
    failed: antidetectResults.summary.failed,
    warnings: antidetectResults.summary.warnings,
  };

  // 2. Quick benchmark
  console.error('[SUITE] Running quick benchmark...');
  suite.tests.quickBenchmark = await benchmark.quickBenchmark(page);

  // 3. Detection site tests (optional, takes longer)
  if (options.runDetectionSites) {
    console.error('[SUITE] Running detection site tests...');
    const siteResults = await runAllDetectionSiteTests(page, options.detectionSites || DETECTION_SITES);
    suite.tests.detectionSites = siteResults;
    suite.summary.detectionSites = {
      total: siteResults.summary.total,
      passed: siteResults.summary.passed,
      failed: siteResults.summary.failed,
    };
  }

  // 4. Full benchmark (optional, takes longer)
  if (options.runFullBenchmark && browser) {
    console.error('[SUITE] Running full benchmark...');
    suite.tests.fullBenchmark = await benchmark.runFullBenchmark(browser, {
      iterations: options.benchmarkIterations || 3,
      contextCount: options.benchmarkContexts || 3,
      stealthScript: options.stealthScript,
    });
    suite.summary.benchmark = {
      contextCreation: suite.tests.fullBenchmark.benchmarks.contextCreation?.avg,
      memoryPerContext: suite.tests.fullBenchmark.benchmarks.memory?.memoryPerContext,
    };
  }

  console.error('[SUITE] Test suite complete');
  return suite;
}

/**
 * Generate complete test report
 */
function generateCompleteReport(suite) {
  const lines = [];

  lines.push('='.repeat(70));
  lines.push('MMO EXPRESS - COMPLETE TEST REPORT');
  lines.push('='.repeat(70));
  lines.push(`Timestamp: ${suite.timestamp}`);
  if (suite.profile) {
    lines.push(`Profile: ${suite.profile.name || suite.profile.id}`);
  }
  lines.push('');

  // Summary section
  lines.push('-'.repeat(70));
  lines.push('SUMMARY');
  lines.push('-'.repeat(70));

  if (suite.summary.antidetect) {
    const ad = suite.summary.antidetect;
    lines.push(`Anti-Detect Score: ${ad.score}% (${ad.passed} passed, ${ad.failed} failed, ${ad.warnings} warnings)`);
  }

  if (suite.summary.benchmark) {
    const bm = suite.summary.benchmark;
    lines.push(`Context Creation: ${bm.contextCreation}ms avg`);
    lines.push(`Memory per Context: ~${bm.memoryPerContext}MB`);
  }

  if (suite.summary.detectionSites) {
    const ds = suite.summary.detectionSites;
    lines.push(`Detection Sites: ${ds.passed}/${ds.total} loaded successfully`);
  }
  lines.push('');

  // Anti-detect details
  if (suite.tests.antidetect) {
    lines.push('-'.repeat(70));
    lines.push('ANTI-DETECT TEST RESULTS');
    lines.push('-'.repeat(70));
    lines.push(antidetect.generateReport(suite.tests.antidetect));
    lines.push('');
  }

  // Quick benchmark
  if (suite.tests.quickBenchmark) {
    const qb = suite.tests.quickBenchmark;
    lines.push('-'.repeat(70));
    lines.push('QUICK BENCHMARK');
    lines.push('-'.repeat(70));
    for (const test of qb.tests) {
      lines.push(`  ${test.name}: ${test.time}ms`);
    }
    lines.push(`  Process Memory: ${qb.memory.heapUsed}MB heap used`);
    lines.push('');
  }

  // Detection site results
  if (suite.tests.detectionSites) {
    lines.push('-'.repeat(70));
    lines.push('DETECTION SITE RESULTS');
    lines.push('-'.repeat(70));
    for (const site of suite.tests.detectionSites.sites) {
      const status = site.success ? `OK (${site.loadTime}ms)` : `FAILED: ${site.error}`;
      lines.push(`  ${site.site}: ${status}`);
    }
    lines.push('');
  }

  // Full benchmark
  if (suite.tests.fullBenchmark) {
    lines.push('-'.repeat(70));
    lines.push('FULL BENCHMARK RESULTS');
    lines.push('-'.repeat(70));
    lines.push(benchmark.generateBenchmarkReport(suite.tests.fullBenchmark));
  }

  lines.push('='.repeat(70));
  lines.push('END OF REPORT');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

/**
 * Save test results to file
 */
function saveResults(results, outputPath, format = 'json') {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (format === 'json') {
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  } else if (format === 'txt') {
    const report = generateCompleteReport(results);
    fs.writeFileSync(outputPath, report);
  }

  console.error(`[REPORT] Saved to ${outputPath}`);
  return outputPath;
}

/**
 * Compare two test results
 */
function compareResults(result1, result2) {
  const comparison = {
    timestamp: new Date().toISOString(),
    result1Time: result1.timestamp,
    result2Time: result2.timestamp,
    differences: [],
  };

  // Compare anti-detect scores
  if (result1.summary?.antidetect && result2.summary?.antidetect) {
    const score1 = result1.summary.antidetect.score;
    const score2 = result2.summary.antidetect.score;
    comparison.differences.push({
      metric: 'Anti-Detect Score',
      before: score1,
      after: score2,
      change: score2 - score1,
      improved: score2 > score1,
    });
  }

  // Compare benchmark times
  if (result1.summary?.benchmark && result2.summary?.benchmark) {
    const ctx1 = result1.summary.benchmark.contextCreation;
    const ctx2 = result2.summary.benchmark.contextCreation;
    comparison.differences.push({
      metric: 'Context Creation Time',
      before: ctx1,
      after: ctx2,
      change: ctx2 - ctx1,
      improved: ctx2 < ctx1,
    });

    const mem1 = result1.summary.benchmark.memoryPerContext;
    const mem2 = result2.summary.benchmark.memoryPerContext;
    comparison.differences.push({
      metric: 'Memory per Context',
      before: mem1,
      after: mem2,
      change: mem2 - mem1,
      improved: mem2 < mem1,
    });
  }

  return comparison;
}

/**
 * Generate comparison report
 */
function generateComparisonReport(comparison) {
  const lines = [];

  lines.push('='.repeat(60));
  lines.push('TEST COMPARISON REPORT');
  lines.push('='.repeat(60));
  lines.push(`Comparison Time: ${comparison.timestamp}`);
  lines.push(`Result 1: ${comparison.result1Time}`);
  lines.push(`Result 2: ${comparison.result2Time}`);
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('DIFFERENCES');
  lines.push('-'.repeat(60));

  for (const diff of comparison.differences) {
    const arrow = diff.improved ? '↑' : diff.change === 0 ? '→' : '↓';
    const sign = diff.change >= 0 ? '+' : '';
    lines.push(`  ${diff.metric}:`);
    lines.push(`    Before: ${diff.before}`);
    lines.push(`    After: ${diff.after}`);
    lines.push(`    Change: ${sign}${diff.change} ${arrow} ${diff.improved ? '(improved)' : ''}`);
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

module.exports = {
  DETECTION_SITES,
  runDetectionSiteTest,
  runAllDetectionSiteTests,
  runCompleteSuite,
  generateCompleteReport,
  saveResults,
  compareResults,
  generateComparisonReport,
  // Re-export submodules
  antidetect,
  benchmark,
};
