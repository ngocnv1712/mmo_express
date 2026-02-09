#!/usr/bin/env node
/**
 * Test CLI Runner
 * Run tests directly from command line
 *
 * Usage:
 *   node test/cli.js antidetect [--profile preset]
 *   node test/cli.js benchmark [--full]
 *   node test/cli.js sites [--site URL]
 *   node test/cli.js all [--save report.json]
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const runner = require('./runner');
const { buildStealthScript, getDefaultProfile } = require('../stealth');
const { getPreset } = require('../profile/presets');

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: args[0] || 'help',
    profile: null,
    full: false,
    site: null,
    save: null,
    headless: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--profile' && args[i + 1]) {
      options.profile = args[++i];
    } else if (arg === '--full') {
      options.full = true;
    } else if (arg === '--site' && args[i + 1]) {
      options.site = args[++i];
    } else if (arg === '--save' && args[i + 1]) {
      options.save = args[++i];
    } else if (arg === '--headless') {
      options.headless = true;
    }
  }

  return options;
}

// Print help
function printHelp() {
  console.log(`
MMO Express Test CLI

Usage:
  node test/cli.js <command> [options]

Commands:
  antidetect    Run anti-detect tests
  benchmark     Run performance benchmark
  sites         Run detection site tests
  all           Run all tests

Options:
  --profile <name>   Use a preset profile (windows-chrome-nvidia, macbook-m2-chrome, etc.)
  --full             Run full benchmark (more iterations)
  --site <url>       Test specific detection site
  --save <file>      Save results to file
  --headless         Run in headless mode

Examples:
  node test/cli.js antidetect
  node test/cli.js antidetect --profile windows-chrome-nvidia
  node test/cli.js benchmark --full
  node test/cli.js sites --site https://browserleaks.com/canvas
  node test/cli.js all --save report.json
`);
}

// Run anti-detect tests
async function runAntidetect(options) {
  console.log('[CLI] Starting anti-detect tests...\n');

  const browser = await chromium.launch({ headless: options.headless });

  // Build profile
  let profile = getDefaultProfile();
  if (options.profile) {
    try {
      profile = { ...profile, ...getPreset(options.profile) };
      console.log(`[CLI] Using preset: ${options.profile}`);
    } catch (e) {
      console.log(`[CLI] Preset not found, using default profile`);
    }
  }

  const context = await browser.newContext({
    viewport: { width: profile.viewportWidth, height: profile.viewportHeight },
    userAgent: profile.userAgent,
    locale: profile.locale,
    timezoneId: profile.timezone,
  });

  // Inject stealth scripts
  const stealthScript = buildStealthScript(profile);
  await context.addInitScript(stealthScript);

  const page = await context.newPage();
  await page.goto('about:blank');

  // Run tests
  const results = await runner.antidetect.runAllTests(page, {
    expectedTimezone: profile.timezone,
  });

  // Generate report
  const report = runner.antidetect.generateReport(results);
  console.log(report);

  // Cleanup
  await browser.close();

  if (options.save) {
    fs.writeFileSync(options.save, JSON.stringify(results, null, 2));
    console.log(`\n[CLI] Results saved to ${options.save}`);
  }

  return results;
}

// Run benchmark tests
async function runBenchmark(options) {
  console.log('[CLI] Starting benchmark tests...\n');

  const browser = await chromium.launch({ headless: options.headless });

  const benchOptions = options.full ? {
    iterations: 10,
    contextCount: 10,
  } : {
    iterations: 3,
    contextCount: 5,
  };

  // Add stealth script for overhead testing
  const stealthScript = buildStealthScript(getDefaultProfile());
  benchOptions.stealthScript = stealthScript;

  const results = await runner.benchmark.runFullBenchmark(browser, benchOptions);
  const report = runner.benchmark.generateBenchmarkReport(results);
  console.log(report);

  await browser.close();

  if (options.save) {
    fs.writeFileSync(options.save, JSON.stringify(results, null, 2));
    console.log(`\n[CLI] Results saved to ${options.save}`);
  }

  return results;
}

// Run detection site tests
async function runSites(options) {
  console.log('[CLI] Starting detection site tests...\n');

  const browser = await chromium.launch({ headless: options.headless });

  // Build profile
  let profile = getDefaultProfile();
  if (options.profile) {
    try {
      profile = { ...profile, ...getPreset(options.profile) };
    } catch (e) {}
  }

  const context = await browser.newContext({
    viewport: { width: profile.viewportWidth, height: profile.viewportHeight },
    userAgent: profile.userAgent,
    locale: profile.locale,
    timezoneId: profile.timezone,
  });

  const stealthScript = buildStealthScript(profile);
  await context.addInitScript(stealthScript);

  const page = await context.newPage();

  let results;
  if (options.site) {
    // Test single site
    const site = { name: 'Custom', url: options.site, description: 'Custom test' };
    const result = await runner.runDetectionSiteTest(page, site);
    console.log(`\n${site.name}: ${result.success ? 'OK' : 'FAILED'}`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Load time: ${result.loadTime}ms`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    results = { site: result };
  } else {
    // Test all sites
    results = await runner.runAllDetectionSiteTests(page);

    console.log('\nDetection Site Results:');
    console.log('-'.repeat(60));
    for (const site of results.sites) {
      const status = site.success ? `OK (${site.loadTime}ms)` : `FAILED: ${site.error}`;
      console.log(`  ${site.site}: ${status}`);
    }
    console.log('-'.repeat(60));
    console.log(`Total: ${results.summary.passed}/${results.summary.total} passed`);
  }

  await browser.close();

  if (options.save) {
    fs.writeFileSync(options.save, JSON.stringify(results, null, 2));
    console.log(`\n[CLI] Results saved to ${options.save}`);
  }

  return results;
}

// Run all tests
async function runAll(options) {
  console.log('[CLI] Starting complete test suite...\n');

  const browser = await chromium.launch({ headless: options.headless });

  // Build profile
  let profile = getDefaultProfile();
  if (options.profile) {
    try {
      profile = { ...profile, ...getPreset(options.profile) };
      console.log(`[CLI] Using preset: ${options.profile}`);
    } catch (e) {}
  }

  const context = await browser.newContext({
    viewport: { width: profile.viewportWidth, height: profile.viewportHeight },
    userAgent: profile.userAgent,
    locale: profile.locale,
    timezoneId: profile.timezone,
  });

  const stealthScript = buildStealthScript(profile);
  await context.addInitScript(stealthScript);

  const page = await context.newPage();
  await page.goto('about:blank');

  const results = await runner.runCompleteSuite(page, browser, {
    profile,
    runDetectionSites: true,
    runFullBenchmark: options.full,
    stealthScript,
  });

  const report = runner.generateCompleteReport(results);
  console.log(report);

  await browser.close();

  if (options.save) {
    fs.writeFileSync(options.save, JSON.stringify(results, null, 2));
    console.log(`\n[CLI] Results saved to ${options.save}`);
  }

  return results;
}

// Main
async function main() {
  const options = parseArgs();

  try {
    switch (options.command) {
      case 'antidetect':
        await runAntidetect(options);
        break;
      case 'benchmark':
        await runBenchmark(options);
        break;
      case 'sites':
        await runSites(options);
        break;
      case 'all':
        await runAll(options);
        break;
      case 'help':
      default:
        printHelp();
    }
  } catch (error) {
    console.error(`\n[ERROR] ${error.message}`);
    process.exit(1);
  }

  process.exit(0);
}

main();
