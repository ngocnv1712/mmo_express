/**
 * System Resources Detection
 * Detects VM/system resources and recommends optimal parallel settings
 */

const os = require('os');

/**
 * Get system resource information
 */
function getSystemResources() {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const platform = os.platform();
  const arch = os.arch();

  return {
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0, // MHz
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      totalGB: Math.round(totalMemory / (1024 * 1024 * 1024) * 10) / 10,
      freeGB: Math.round(freeMemory / (1024 * 1024 * 1024) * 10) / 10,
      usedGB: Math.round(usedMemory / (1024 * 1024 * 1024) * 10) / 10,
      usagePercent: Math.round((usedMemory / totalMemory) * 100),
    },
    platform,
    arch,
    uptime: os.uptime(),
    loadAvg: os.loadavg(), // [1min, 5min, 15min]
  };
}

/**
 * Estimate memory per browser context
 * Based on typical Chromium memory usage with anti-detect features
 */
const MEMORY_PER_CONTEXT_MB = {
  minimal: 150,   // Minimal pages, no heavy content
  normal: 250,    // Normal browsing, some JS
  heavy: 400,     // Heavy JS, video, many tabs
};

/**
 * Calculate recommended max concurrent profiles
 * @param {object} options
 * @param {string} options.memoryMode - 'minimal', 'normal', 'heavy'
 * @param {number} options.reserveMemoryPercent - Reserve memory for system (default 30%)
 * @param {number} options.maxCpuUsagePercent - Max CPU usage target (default 80%)
 */
function calculateRecommendedConcurrency(options = {}) {
  const {
    memoryMode = 'normal',
    reserveMemoryPercent = 30,
    maxCpuUsagePercent = 80,
  } = options;

  const resources = getSystemResources();
  const memoryPerContext = MEMORY_PER_CONTEXT_MB[memoryMode] || MEMORY_PER_CONTEXT_MB.normal;

  // Calculate available memory (leave reserve for system)
  const availableMemoryMB = (resources.memory.free / (1024 * 1024)) * ((100 - reserveMemoryPercent) / 100);
  const maxByMemory = Math.floor(availableMemoryMB / memoryPerContext);

  // Calculate based on CPU cores
  // Rule: Each context needs ~0.5-1 core for smooth operation
  const cpuFactor = maxCpuUsagePercent / 100;
  const maxByCpu = Math.floor(resources.cpu.cores * cpuFactor);

  // Take the minimum of both constraints
  const recommended = Math.max(1, Math.min(maxByMemory, maxByCpu));

  // Also provide safe/aggressive options
  const safe = Math.max(1, Math.floor(recommended * 0.6));
  const aggressive = Math.min(Math.floor(recommended * 1.5), resources.cpu.cores * 2);

  return {
    recommended,
    safe,
    aggressive,
    maxByMemory,
    maxByCpu,
    constraints: {
      availableMemoryMB: Math.round(availableMemoryMB),
      memoryPerContextMB: memoryPerContext,
      cpuCores: resources.cpu.cores,
      memoryMode,
    },
    resources,
  };
}

/**
 * Get current system load
 */
function getCurrentLoad() {
  const resources = getSystemResources();
  const loadAvg = resources.loadAvg;
  const cpuCount = resources.cpu.cores;

  // Load average as percentage of CPU capacity
  const load1min = Math.round((loadAvg[0] / cpuCount) * 100);
  const load5min = Math.round((loadAvg[1] / cpuCount) * 100);
  const load15min = Math.round((loadAvg[2] / cpuCount) * 100);

  return {
    cpu: {
      load1min,
      load5min,
      load15min,
      isHigh: load1min > 80,
    },
    memory: {
      usagePercent: resources.memory.usagePercent,
      freeGB: resources.memory.freeGB,
      isLow: resources.memory.usagePercent > 85,
    },
    canAddMore: load1min < 70 && resources.memory.usagePercent < 80,
  };
}

/**
 * Monitor resources during execution
 * Returns a function to check if we should throttle
 */
function createResourceMonitor(options = {}) {
  const {
    checkInterval = 5000, // Check every 5 seconds
    cpuThreshold = 90,    // Throttle if CPU > 90%
    memoryThreshold = 90, // Throttle if memory > 90%
  } = options;

  let lastCheck = 0;
  let shouldThrottle = false;

  return {
    check() {
      const now = Date.now();
      if (now - lastCheck < checkInterval) {
        return { shouldThrottle };
      }

      lastCheck = now;
      const load = getCurrentLoad();

      shouldThrottle = load.cpu.load1min > cpuThreshold ||
                       load.memory.usagePercent > memoryThreshold;

      return {
        shouldThrottle,
        reason: shouldThrottle
          ? `High load: CPU ${load.cpu.load1min}%, Memory ${load.memory.usagePercent}%`
          : null,
        load,
      };
    },

    getRecommendation() {
      return calculateRecommendedConcurrency();
    },
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

module.exports = {
  getSystemResources,
  calculateRecommendedConcurrency,
  getCurrentLoad,
  createResourceMonitor,
  formatBytes,
  MEMORY_PER_CONTEXT_MB,
};
