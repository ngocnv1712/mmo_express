/**
 * Performance Benchmark Suite
 * Measures memory, CPU, and timing metrics for browser contexts
 */

const os = require('os');

/**
 * Get system memory info
 */
function getMemoryInfo() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    total: Math.round(totalMemory / 1024 / 1024),
    free: Math.round(freeMemory / 1024 / 1024),
    used: Math.round(usedMemory / 1024 / 1024),
    percentUsed: Math.round((usedMemory / totalMemory) * 100),
  };
}

/**
 * Get process memory usage
 */
function getProcessMemory() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
  };
}

/**
 * Get CPU info
 */
function getCPUInfo() {
  const cpus = os.cpus();
  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    speed: cpus[0]?.speed || 0,
  };
}

/**
 * Benchmark context creation time
 */
async function benchmarkContextCreation(browser, options = {}) {
  const iterations = options.iterations || 5;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();
    await page.goto('about:blank');

    const endTime = performance.now();
    times.push(endTime - startTime);

    await context.close();
  }

  return {
    iterations,
    times,
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    min: Math.round(Math.min(...times)),
    max: Math.round(Math.max(...times)),
  };
}

/**
 * Benchmark page navigation time
 */
async function benchmarkNavigation(page, urls = []) {
  const defaultUrls = [
    'https://example.com',
    'https://httpbin.org/html',
    'about:blank',
  ];

  const testUrls = urls.length > 0 ? urls : defaultUrls;
  const results = [];

  for (const url of testUrls) {
    try {
      const startTime = performance.now();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const endTime = performance.now();

      results.push({
        url,
        time: Math.round(endTime - startTime),
        success: true,
      });
    } catch (error) {
      results.push({
        url,
        time: 0,
        success: false,
        error: error.message,
      });
    }
  }

  const successfulTimes = results.filter(r => r.success).map(r => r.time);
  const avgTime = successfulTimes.length > 0
    ? Math.round(successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length)
    : 0;

  return {
    results,
    avgTime,
    successRate: Math.round((results.filter(r => r.success).length / results.length) * 100),
  };
}

/**
 * Benchmark script injection time
 */
async function benchmarkScriptInjection(page, script = null) {
  const defaultScript = `
    (() => {
      const result = {
        navigator: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
        screen: {
          width: screen.width,
          height: screen.height,
        },
        timestamp: Date.now(),
      };
      return result;
    })()
  `;

  const testScript = script || defaultScript;
  const iterations = 10;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await page.evaluate(testScript);
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  return {
    iterations,
    times,
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length * 100) / 100,
    min: Math.round(Math.min(...times) * 100) / 100,
    max: Math.round(Math.max(...times) * 100) / 100,
  };
}

/**
 * Benchmark stealth script performance
 */
async function benchmarkStealthScript(page, stealthScript) {
  const results = {
    injectionTime: 0,
    executionTime: 0,
    overheadTests: [],
  };

  // Measure injection time
  const injectStart = performance.now();
  await page.addInitScript(stealthScript);
  results.injectionTime = Math.round(performance.now() - injectStart);

  // Navigate to trigger script
  const execStart = performance.now();
  await page.goto('about:blank');
  results.executionTime = Math.round(performance.now() - execStart);

  // Test specific override performance
  const overheadTests = [
    { name: 'navigator.userAgent', script: 'navigator.userAgent' },
    { name: 'navigator.webdriver', script: 'navigator.webdriver' },
    { name: 'canvas.toDataURL', script: `(() => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillRect(0,0,100,100);
      return c.toDataURL();
    })()` },
    { name: 'WebGL.getParameter', script: `(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl');
      return gl ? gl.getParameter(gl.VERSION) : null;
    })()` },
  ];

  for (const test of overheadTests) {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await page.evaluate(test.script);
      times.push(performance.now() - start);
    }

    results.overheadTests.push({
      name: test.name,
      avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length * 100) / 100,
    });
  }

  return results;
}

/**
 * Benchmark memory per context
 */
async function benchmarkMemoryPerContext(browser, contextCount = 5) {
  const contexts = [];
  const memorySnapshots = [];

  // Initial memory
  memorySnapshots.push({
    contexts: 0,
    memory: getProcessMemory(),
  });

  // Create contexts and measure
  for (let i = 0; i < contextCount; i++) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await page.goto('about:blank');

    contexts.push(context);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    memorySnapshots.push({
      contexts: i + 1,
      memory: getProcessMemory(),
    });
  }

  // Calculate memory per context
  const initialRss = memorySnapshots[0].memory.rss;
  const finalRss = memorySnapshots[memorySnapshots.length - 1].memory.rss;
  const memoryPerContext = Math.round((finalRss - initialRss) / contextCount);

  // Cleanup
  for (const context of contexts) {
    await context.close();
  }

  return {
    contextCount,
    initialMemory: initialRss,
    finalMemory: finalRss,
    totalIncrease: finalRss - initialRss,
    memoryPerContext,
    snapshots: memorySnapshots,
  };
}

/**
 * Run full benchmark suite
 */
async function runFullBenchmark(browser, options = {}) {
  const results = {
    timestamp: new Date().toISOString(),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpu: getCPUInfo(),
      memory: getMemoryInfo(),
    },
    benchmarks: {},
  };

  console.error('[BENCHMARK] Starting full benchmark suite...');

  // Context creation benchmark
  console.error('[BENCHMARK] Testing context creation...');
  results.benchmarks.contextCreation = await benchmarkContextCreation(browser, {
    iterations: options.iterations || 5,
  });

  // Create a test context for remaining benchmarks
  const testContext = await browser.newContext();
  const testPage = await testContext.newPage();

  // Navigation benchmark
  console.error('[BENCHMARK] Testing navigation...');
  results.benchmarks.navigation = await benchmarkNavigation(testPage, options.urls);

  // Script injection benchmark
  console.error('[BENCHMARK] Testing script injection...');
  results.benchmarks.scriptInjection = await benchmarkScriptInjection(testPage);

  // Stealth script benchmark (if provided)
  if (options.stealthScript) {
    console.error('[BENCHMARK] Testing stealth script...');
    const stealthContext = await browser.newContext();
    const stealthPage = await stealthContext.newPage();
    results.benchmarks.stealthScript = await benchmarkStealthScript(stealthPage, options.stealthScript);
    await stealthContext.close();
  }

  // Memory per context benchmark
  console.error('[BENCHMARK] Testing memory usage...');
  results.benchmarks.memory = await benchmarkMemoryPerContext(browser, options.contextCount || 5);

  await testContext.close();

  // Final process memory
  results.processMemory = getProcessMemory();

  console.error('[BENCHMARK] Benchmark complete');
  return results;
}

/**
 * Generate benchmark report
 */
function generateBenchmarkReport(results) {
  const lines = [];

  lines.push('='.repeat(60));
  lines.push('PERFORMANCE BENCHMARK REPORT');
  lines.push('='.repeat(60));
  lines.push(`Timestamp: ${results.timestamp}`);
  lines.push('');

  // System info
  lines.push('[SYSTEM]');
  lines.push(`  Platform: ${results.system.platform} (${results.system.arch})`);
  lines.push(`  Node.js: ${results.system.nodeVersion}`);
  lines.push(`  CPU: ${results.system.cpu.model} (${results.system.cpu.cores} cores @ ${results.system.cpu.speed}MHz)`);
  lines.push(`  Memory: ${results.system.memory.used}MB / ${results.system.memory.total}MB (${results.system.memory.percentUsed}%)`);
  lines.push('');

  // Context creation
  if (results.benchmarks.contextCreation) {
    const cc = results.benchmarks.contextCreation;
    lines.push('[CONTEXT CREATION]');
    lines.push(`  Iterations: ${cc.iterations}`);
    lines.push(`  Average: ${cc.avg}ms`);
    lines.push(`  Min: ${cc.min}ms`);
    lines.push(`  Max: ${cc.max}ms`);
    lines.push('');
  }

  // Navigation
  if (results.benchmarks.navigation) {
    const nav = results.benchmarks.navigation;
    lines.push('[NAVIGATION]');
    lines.push(`  Average time: ${nav.avgTime}ms`);
    lines.push(`  Success rate: ${nav.successRate}%`);
    for (const r of nav.results) {
      const status = r.success ? `${r.time}ms` : `FAILED: ${r.error}`;
      lines.push(`  - ${r.url}: ${status}`);
    }
    lines.push('');
  }

  // Script injection
  if (results.benchmarks.scriptInjection) {
    const si = results.benchmarks.scriptInjection;
    lines.push('[SCRIPT INJECTION]');
    lines.push(`  Iterations: ${si.iterations}`);
    lines.push(`  Average: ${si.avg}ms`);
    lines.push(`  Min: ${si.min}ms`);
    lines.push(`  Max: ${si.max}ms`);
    lines.push('');
  }

  // Stealth script
  if (results.benchmarks.stealthScript) {
    const ss = results.benchmarks.stealthScript;
    lines.push('[STEALTH SCRIPT]');
    lines.push(`  Injection time: ${ss.injectionTime}ms`);
    lines.push(`  Execution time: ${ss.executionTime}ms`);
    lines.push('  Overhead per call:');
    for (const test of ss.overheadTests) {
      lines.push(`    - ${test.name}: ${test.avgTime}ms`);
    }
    lines.push('');
  }

  // Memory
  if (results.benchmarks.memory) {
    const mem = results.benchmarks.memory;
    lines.push('[MEMORY USAGE]');
    lines.push(`  Contexts tested: ${mem.contextCount}`);
    lines.push(`  Initial memory: ${mem.initialMemory}MB`);
    lines.push(`  Final memory: ${mem.finalMemory}MB`);
    lines.push(`  Total increase: ${mem.totalIncrease}MB`);
    lines.push(`  Memory per context: ~${mem.memoryPerContext}MB`);
    lines.push('');
  }

  // Process memory
  if (results.processMemory) {
    const pm = results.processMemory;
    lines.push('[PROCESS MEMORY]');
    lines.push(`  RSS: ${pm.rss}MB`);
    lines.push(`  Heap Total: ${pm.heapTotal}MB`);
    lines.push(`  Heap Used: ${pm.heapUsed}MB`);
    lines.push(`  External: ${pm.external}MB`);
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Quick benchmark for single session
 */
async function quickBenchmark(page) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // Page load time
  const loadStart = performance.now();
  await page.goto('about:blank');
  results.tests.push({
    name: 'Page load (about:blank)',
    time: Math.round(performance.now() - loadStart),
  });

  // Script execution
  const scriptStart = performance.now();
  await page.evaluate(() => {
    return { userAgent: navigator.userAgent, time: Date.now() };
  });
  results.tests.push({
    name: 'Script execution',
    time: Math.round((performance.now() - scriptStart) * 100) / 100,
  });

  // DOM manipulation
  const domStart = performance.now();
  await page.evaluate(() => {
    for (let i = 0; i < 100; i++) {
      const div = document.createElement('div');
      div.textContent = `Element ${i}`;
      document.body.appendChild(div);
    }
    return document.body.children.length;
  });
  results.tests.push({
    name: 'DOM manipulation (100 elements)',
    time: Math.round((performance.now() - domStart) * 100) / 100,
  });

  // Process memory
  results.memory = getProcessMemory();

  return results;
}

module.exports = {
  getMemoryInfo,
  getProcessMemory,
  getCPUInfo,
  benchmarkContextCreation,
  benchmarkNavigation,
  benchmarkScriptInjection,
  benchmarkStealthScript,
  benchmarkMemoryPerContext,
  runFullBenchmark,
  generateBenchmarkReport,
  quickBenchmark,
};
