/**
 * MMO Express - Playwright Sidecar
 * Automation engine with stealth, multi-browser, and multi-context support
 */

const { chromium, firefox, webkit } = require('playwright');
const crypto = require('crypto');
const readline = require('readline');
const http = require('http');
const path = require('path');
const os = require('os');

// Data directories
const DATA_DIR = path.join(process.cwd(), 'data');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');
const PROFILES_DIR = path.join(DATA_DIR, 'profiles'); // Browser user data for persistent contexts

// UUID v4 generator
function uuidv4() {
  return crypto.randomUUID();
}

// Import modules
const { buildStealthScript, getDefaultProfile, buildWorkerInjectScript } = require('./stealth');
const { launchBrowser, launchPersistentContext, getRecommendedEngine, supportsFeature } = require('./browser/engines');
const { getDevice, applyDeviceToProfile } = require('./profile/devices');
const { autoApplyGeo, lookupIP } = require('./geo/lookup');
const extensionManager = require('./extension/manager');
const cookieManager = require('./cookie/manager');
const testRunner = require('./test/runner');
const automation = require('./automation');
const Scheduler = require('./scheduler/scheduler');
const ParallelExecutor = require('./scheduler/parallel');
const NotificationManager = require('./notifications');
const { getSystemResources, calculateRecommendedConcurrency, getCurrentLoad } = require('./utils/resources');

// Workflow Manager instance
const workflowManager = new automation.WorkflowManager();

// Profile cache (synced from frontend)
const profileCache = new Map();
const PROFILE_CACHE_FILE = path.join(DATA_DIR, 'profile-cache.json');

/**
 * Load profile cache from file (on startup)
 */
async function loadProfileCache() {
  try {
    const fs = require('fs').promises;
    const data = await fs.readFile(PROFILE_CACHE_FILE, 'utf-8');
    const profiles = JSON.parse(data);
    profileCache.clear();
    for (const profile of profiles) {
      profileCache.set(profile.id, profile);
    }
    console.error(`[CACHE] Loaded ${profiles.length} profiles from cache file`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[CACHE] Error loading cache:', err.message);
    }
    // File doesn't exist yet, that's ok
  }
}

/**
 * Save profile cache to file
 */
async function saveProfileCache() {
  try {
    const fs = require('fs').promises;
    await fs.mkdir(DATA_DIR, { recursive: true });
    const profiles = Array.from(profileCache.values());
    await fs.writeFile(PROFILE_CACHE_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CACHE] Error saving cache:', err.message);
  }
}

/**
 * Sync profiles from frontend
 */
function syncProfiles(profiles) {
  profileCache.clear();
  for (const profile of profiles) {
    profileCache.set(profile.id, profile);
  }
  console.error(`[CACHE] Synced ${profiles.length} profiles`);
  // Save to file for persistence
  saveProfileCache();
  return { success: true, count: profiles.length };
}

// Load cache on startup
loadProfileCache();

/**
 * Get profiles from cache
 */
function getCachedProfiles(profileIds) {
  const profiles = [];
  for (const id of profileIds) {
    const profile = profileCache.get(id);
    if (profile) {
      profiles.push(profile);
    }
  }
  return profiles;
}

/**
 * Get all cached profiles
 */
function getAllCachedProfiles() {
  return Array.from(profileCache.values());
}

// Scheduler instance
const scheduler = new Scheduler({
  logger: console,
  onScheduleLoaded: (schedule) => {
    // Register workflow when schedule is loaded (on startup)
    if (schedule.workflow) {
      try {
        workflowManager.registerWorkflow(schedule.workflow);
        console.error(`[SCHEDULER] Registered workflow: ${schedule.workflow.name} (${schedule.workflowId})`);
      } catch (err) {
        console.error(`[SCHEDULER] Failed to register workflow ${schedule.workflowId}:`, err.message);
      }
    }
  },
  onExecute: async (schedule) => {
    // Get workflow
    const workflow = workflowManager.getWorkflow(schedule.workflowId);
    if (!workflow) {
      console.error(`[SCHEDULER] Workflow not found: ${schedule.workflowId}`);
      return { success: false, error: 'Workflow not found', results: [] };
    }

    // Get profiles from cache
    const profiles = getCachedProfiles(schedule.profileIds);

    if (profiles.length === 0) {
      console.error(`[SCHEDULER] No profiles found in cache. Make sure frontend has synced profiles.`);
      return { success: false, error: 'No profiles in cache. Open the app to sync.', results: [] };
    }

    console.error(`[SCHEDULER] Using ${profiles.length} cached profile(s) with parallel execution`);

    // Get parallel config from schedule (with defaults)
    const parallelConfig = schedule.parallelConfig || {};
    const maxConcurrent = parallelConfig.maxConcurrent || 3;
    const queueMode = parallelConfig.queueMode || 'fifo';
    const retryStrategy = parallelConfig.retryStrategy || 'none';
    const maxRetries = parallelConfig.maxRetries || 0;
    const headless = parallelConfig.headless || false;
    const blocking = parallelConfig.blocking || {};

    console.error(`[SCHEDULER] Config: ${maxConcurrent} concurrent, headless=${headless}, blocking=${Object.keys(blocking).filter(k => blocking[k]).join(',') || 'none'}`);

    // Create parallel executor
    const executionId = `scheduled-${schedule.id}-${Date.now()}`;
    const executor = new ParallelExecutor({
      maxConcurrent,
      queueMode,
      retryStrategy,
      maxRetries,
      headless,
      blocking,
    });

    // Track results
    const results = [];
    let completed = 0;
    let failed = 0;

    // Set up event handlers
    executor.on('slotSuccess', (data) => {
      console.error(`[SCHEDULER] Success: ${data.profileName || data.profileId}`);
      results.push({ profileId: data.profileId, success: true });
      completed++;
    });

    executor.on('slotFailure', (data) => {
      console.error(`[SCHEDULER] Failure: ${data.profileName || data.profileId} - ${data.error}`);
      results.push({ profileId: data.profileId, success: false, error: data.error });
      failed++;
    });

    // Store executor for monitoring
    parallelExecutors.set(executionId, executor);

    // Launch browser
    let browser;
    try {
      browser = await launchBrowser('chromium', { headless });
    } catch (error) {
      parallelExecutors.delete(executionId);
      return { success: false, error: `Failed to launch browser: ${error.message}` };
    }

    // Wait for completion
    return new Promise((resolve) => {
      executor.on('complete', async (data) => {
        console.error(`[SCHEDULER] Complete: ${data.completed}/${data.totalProfiles} succeeded`);

        // Close browser
        try {
          await browser.close();
        } catch (e) {
          console.error('[SCHEDULER] Error closing browser:', e.message);
        }

        // Notify
        notificationManager.notify('onComplete', {
          ...data,
          workflowName: workflow.name,
          executionId,
          scheduleName: schedule.name,
        });

        // Keep executor for a bit for monitoring
        setTimeout(() => {
          parallelExecutors.delete(executionId);
        }, 30000);

        const allSuccess = failed === 0;
        resolve({
          success: allSuccess,
          results,
          completed,
          failed,
          error: allSuccess ? null : `${failed} execution(s) failed`,
        });
      });

      // Start execution
      executor.start({
        browser,
        workflowExecutor: async (wf, ctx) => {
          return workflowManager.executeWorkflow(wf, {
            ...ctx,
            outputDir: SCREENSHOTS_DIR,
            session: { id: ctx.profile.id }
          });
        },
        workflow,
        profiles,
      });
    });
  },
});

// Initialize scheduler
scheduler.init().catch(err => console.error('[SCHEDULER] Init error:', err));

// Parallel Executor instances (one per workflow execution)
const parallelExecutors = new Map();

// Notification Manager instance
let notificationManager = new NotificationManager({
  enabled: false,
  channels: [],
  events: {
    onStart: false,
    onComplete: true,
    onSuccess: false,
    onFailure: true,
    onRetry: false
  }
});

// Browser instances (one per engine type)
const browsers = {
  chromium: null,
  firefox: null,
  webkit: null,
};

// Active contexts/sessions
const sessions = new Map();

// Execution logs (in-memory, keyed by executionId)
const executionLogs = new Map();
const MAX_LOG_ENTRIES = 1000;

/**
 * Add a log entry for an execution
 */
function addExecutionLog(executionId, type, message, duration = null) {
  if (!executionLogs.has(executionId)) {
    executionLogs.set(executionId, []);
  }

  const logs = executionLogs.get(executionId);
  logs.push({
    timestamp: new Date().toISOString(),
    type,
    message,
    duration,
  });

  // Limit log size
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.shift();
  }
}

/**
 * Get logs for an execution
 */
function getExecutionLogs(executionId) {
  const logs = executionLogs.get(executionId) || [];
  return { success: true, logs };
}

/**
 * Clear logs for an execution
 */
function clearExecutionLogs(executionId) {
  executionLogs.delete(executionId);
  return { success: true };
}

/**
 * Initialize browser instance for engine type
 */
async function initBrowser(options = {}) {
  const engineName = options.engine || 'chromium';

  if (browsers[engineName]) {
    return { success: true, message: `${engineName} browser already initialized` };
  }

  try {
    browsers[engineName] = await launchBrowser(engineName, {
      headless: options.headless ?? false,
    });

    console.error(`[BROWSER] ${engineName} initialized successfully`);
    return { success: true, message: `${engineName} browser initialized`, engine: engineName };
  } catch (error) {
    console.error(`[BROWSER] Failed to initialize ${engineName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new browser context with profile settings
 */
async function createSession(profile, proxyConfig = null, options = {}) {
  const sessionId = uuidv4();

  // If profile only has ID, look it up from cache
  let inputProfile = profile;
  if (profile && profile.id && Object.keys(profile).length <= 2) {
    const cachedProfile = profileCache.get(profile.id);
    if (cachedProfile) {
      inputProfile = { ...cachedProfile, ...profile };
      console.error(`[SESSION] Loaded profile from cache: ${cachedProfile.name || profile.id}`);
    }
  }

  // Apply device preset if specified
  let fullProfile = { ...getDefaultProfile(), ...inputProfile };
  if (profile.deviceId) {
    try {
      fullProfile = applyDeviceToProfile(fullProfile, profile.deviceId);
    } catch (e) {
      console.error(`[PROFILE] Device preset failed: ${e.message}`);
    }
  }

  fullProfile.id = profile.id || sessionId;

  // Determine browser engine
  const engineName = fullProfile.browserType === 'firefox' ? 'firefox'
    : fullProfile.browserType === 'webkit' || fullProfile.browserType === 'safari' ? 'webkit'
    : 'chromium';

  // Extract options
  const headless = options.headless || false;
  const blocking = options.blocking || {};

  // Build extension args for Chromium (works with Chromium, not Google Chrome)
  let extensionArgs = [];
  if (engineName === 'chromium' && fullProfile.extensionIds && fullProfile.extensionIds.length > 0) {
    extensionArgs = extensionManager.buildExtensionArgs(fullProfile.extensionIds);
    if (extensionArgs.length > 0) {
      console.error(`[BROWSER] Loading ${fullProfile.extensionIds.length} extensions`);
    }
  }

  // Auto-apply geo settings based on IP (with or without proxy)
  if (fullProfile.timezoneMode === 'auto' || fullProfile.localeMode === 'auto') {
    fullProfile = await autoApplyGeo(fullProfile, proxyConfig);
  }

  // Context options (used by persistent context)
  const contextOptions = {
    viewport: {
      width: fullProfile.viewportWidth || 1920,
      height: fullProfile.viewportHeight || 1080
    },
    userAgent: fullProfile.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: fullProfile.locale || 'en-US',
    timezoneId: fullProfile.timezone || 'America/New_York',
    colorScheme: 'light',
    deviceScaleFactor: fullProfile.pixelRatio || 1,
  };

  // Mobile device settings
  if (fullProfile.isMobile) {
    contextOptions.isMobile = true;
    contextOptions.hasTouch = fullProfile.hasTouch ?? true;
  }

  // Geolocation
  if (fullProfile.geoMode === 'allow' && fullProfile.geoLatitude) {
    contextOptions.geolocation = {
      latitude: fullProfile.geoLatitude,
      longitude: fullProfile.geoLongitude,
      accuracy: fullProfile.geoAccuracy || 100
    };
    contextOptions.permissions = ['geolocation'];
  }

  // Add proxy if provided
  if (proxyConfig && proxyConfig.host) {
    const proxyType = proxyConfig.type || proxyConfig.proxy_type || 'http';
    contextOptions.proxy = {
      server: `${proxyType}://${proxyConfig.host}:${proxyConfig.port}`,
    };
    if (proxyConfig.username && proxyConfig.password) {
      contextOptions.proxy.username = proxyConfig.username;
      contextOptions.proxy.password = proxyConfig.password;
    }

    // Set WebRTC public IP to proxy IP for IP consistency
    if (fullProfile.webrtcMode === 'replace' && !fullProfile.webrtcPublicIP) {
      fullProfile.webrtcPublicIP = proxyConfig.host;
    }
  }

  // Create profile-specific user data directory for persistent context
  // This prevents incognito detection since the browser has real storage
  const profileId = fullProfile.id || sessionId;
  const userDataDir = path.join(PROFILES_DIR, `profile-${profileId}`);

  // Ensure profiles directory exists
  const fs = require('fs');
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }

  // Launch browser with persistent context (non-incognito)
  let browser, context;
  try {
    const result = await launchPersistentContext(engineName, userDataDir, {
      headless: headless,
      args: extensionArgs,
      ...contextOptions,
    });
    browser = result.browser;
    context = result.context;
    console.error(`[BROWSER] Launched ${engineName} with persistent context for session ${sessionId}${headless ? ' (headless)' : ''}`);
    console.error(`[BROWSER] User data dir: ${userDataDir}`);
  } catch (error) {
    console.error(`[BROWSER] Failed to launch ${engineName}:`, error.message);
    return { success: false, error: error.message };
  }

  try {

    // Prepare blocking settings
    const blockImages = blocking.images || fullProfile.blockImages;
    const blockMedia = blocking.media || fullProfile.blockMedia;
    const blockFonts = blocking.fonts;
    const blockCss = blocking.css;
    const blockTrackers = blocking.trackers;
    const trackerDomains = [
      'google-analytics.com', 'googletagmanager.com', 'facebook.net',
      'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
      'analytics.', 'tracker.', 'pixel.', 'beacon.'
    ];

    // Unified route handler for blocking resources
    if (blockImages || blockMedia || blockFonts || blockCss || blockTrackers) {
      await context.route('**/*', async (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();

        if (blockImages && resourceType === 'image') {
          return route.abort();
        }
        if (blockMedia && resourceType === 'media') {
          return route.abort();
        }
        if (blockFonts && resourceType === 'font') {
          return route.abort();
        }
        if (blockCss && resourceType === 'stylesheet') {
          return route.abort();
        }
        if (blockTrackers && trackerDomains.some(d => url.includes(d))) {
          return route.abort();
        }
        return route.continue();
      });
    }

    // Inject stealth scripts (only for Chromium - others have better native privacy)
    if (engineName === 'chromium' && supportsFeature('chromium', 'stealth')) {
      const stealthScript = buildStealthScript(fullProfile);
      await context.addInitScript(stealthScript);

      // Intercept worker scripts and prepend stealth code
      const workerStealthScript = buildWorkerInjectScript(fullProfile);
      await context.route('**/*.js', async (route) => {
        const request = route.request();
        const resourceType = request.resourceType();

        // Only intercept scripts that might be workers
        // Worker scripts are loaded as 'script' or 'other' type
        if (resourceType === 'script' || resourceType === 'other') {
          const url = request.url();

          // Check if this looks like a worker script
          // CreepJS uses blob URLs and inline workers, so we also intercept creepjs-related scripts
          if (url.includes('worker') || url.includes('creep') || url.includes('Worker')) {
            try {
              const response = await route.fetch();
              const body = await response.text();

              // Prepend stealth code
              const modifiedBody = workerStealthScript + '\n' + body;

              await route.fulfill({
                response,
                body: modifiedBody,
                headers: {
                  ...response.headers(),
                  'content-length': Buffer.byteLength(modifiedBody).toString()
                }
              });
              console.error(`[STEALTH] Modified worker script: ${url.substring(0, 60)}...`);
              return;
            } catch (e) {
              // If fetch fails, continue normally
            }
          }
        }
        return route.continue();
      });
    }

    // Create page
    const page = await context.newPage();

    // Use CDP to override User-Agent Metadata (Sec-Ch-Ua headers)
    if (engineName === 'chromium') {
      try {
        const uaMatch = (fullProfile.userAgent || '').match(/Chrome\/(\d+)/);
        const chromeVersion = uaMatch ? uaMatch[1] : '120';
        const fullVersionMatch = (fullProfile.userAgent || '').match(/Chrome\/([\d.]+)/);
        const fullVersion = fullVersionMatch ? fullVersionMatch[1] : '120.0.0.0';

        const cdpSession = await context.newCDPSession(page);

        // Use CDP to inject stealth script even earlier (before any page scripts)
        const stealthScript = buildStealthScript(fullProfile);
        await cdpSession.send('Page.addScriptToEvaluateOnNewDocument', {
          source: stealthScript
        });
        console.error(`[STEALTH] CDP script injection enabled`);

        await cdpSession.send('Network.setUserAgentOverride', {
          userAgent: fullProfile.userAgent || contextOptions.userAgent,
          platform: fullProfile.platform || 'Win32',
          userAgentMetadata: {
            brands: [
              { brand: 'Chromium', version: chromeVersion },
              { brand: 'Google Chrome', version: chromeVersion },
              { brand: 'Not-A.Brand', version: '99' }
            ],
            fullVersionList: [
              { brand: 'Chromium', version: fullVersion },
              { brand: 'Google Chrome', version: fullVersion },
              { brand: 'Not-A.Brand', version: '99.0.0.0' }
            ],
            fullVersion: fullVersion,
            platform: fullProfile.os === 'macos' ? 'macOS' : fullProfile.os === 'linux' ? 'Linux' : 'Windows',
            platformVersion: fullProfile.os === 'macos' ? '13.0.0' : fullProfile.os === 'linux' ? '5.15.0' : '10.0.0',
            architecture: 'x86',
            model: '',
            mobile: fullProfile.isMobile || false,
            bitness: '64',
            wow64: false
          }
        });
        console.error(`[STEALTH] Set User-Agent Metadata: Chrome/${chromeVersion}`);

        // Listen for workers and inject stealth script via evaluate
        const workerStealthScript = buildWorkerInjectScript(fullProfile);

        // Use browser-level CDP to auto-attach to all targets including workers
        // For persistent context, browser is actually the context, so we need to get the real browser
        const realBrowser = browser.browser ? browser.browser() : browser;
        let browserCdp = null;

        // Try to get browser-level CDP session (may fail with persistent context)
        if (realBrowser && typeof realBrowser.newBrowserCDPSession === 'function') {
          browserCdp = await realBrowser.newBrowserCDPSession();
        } else {
          console.error('[STEALTH] Browser CDP not available for persistent context, using page CDP only');
        }

        if (browserCdp) {
          await browserCdp.send('Target.setAutoAttach', {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true,
            filter: [
              { type: 'worker' },
              { type: 'shared_worker' },
              { type: 'service_worker' }
            ]
          });

          browserCdp.on('Target.attachedToTarget', async ({ sessionId: targetSessionId, targetInfo }) => {
            if (targetInfo.type === 'worker' || targetInfo.type === 'shared_worker' || targetInfo.type === 'service_worker') {
              try {
                // Inject stealth script into worker before it runs
                await browserCdp.send('Runtime.evaluate', {
                  expression: workerStealthScript,
                  awaitPromise: false,
                }, targetSessionId);

                // Resume the worker
                await browserCdp.send('Runtime.runIfWaitingForDebugger', {}, targetSessionId);

                console.error(`[STEALTH] CDP injected into ${targetInfo.type}: ${(targetInfo.url || 'blob').substring(0, 40)}...`);
              } catch (e) {
                // Try to resume anyway
                try {
                  await browserCdp.send('Runtime.runIfWaitingForDebugger', {}, targetSessionId);
                } catch (e2) {}
                console.error(`[STEALTH] Worker CDP error: ${e.message}`);
              }
            }
          });
          console.error('[STEALTH] Worker auto-attach enabled');
        }

        // Also use page-level worker events as backup (runs after worker starts)
        page.on('worker', async (worker) => {
          try {
            await worker.evaluate((script) => {
              try { new Function(script)(); } catch(e) {}
            }, workerStealthScript);
            console.error(`[STEALTH] Evaluate injected into worker: ${worker.url().substring(0, 40)}...`);
          } catch (e) {
            // Worker might not support evaluate
          }
        });
      } catch (e) {
        console.error(`[STEALTH] CDP override failed: ${e.message}`);
      }
    }

    // Store session with browser reference
    sessions.set(sessionId, {
      id: sessionId,
      profileId: fullProfile.id,
      profileName: fullProfile.name || 'Unnamed',
      profile: fullProfile,
      engine: engineName,
      browser,
      context,
      page,
      status: 'running',
      startedAt: new Date().toISOString()
    });

    // Auto-cleanup when browser is closed by user (click X on window)
    browser.on('disconnected', () => {
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.error(`[SESSION] Auto-closed: ${sessionId} (browser disconnected)`);
      }
    });

    // Also listen for page close - when user closes the tab/window
    page.on('close', async () => {
      if (sessions.has(sessionId)) {
        console.error(`[SESSION] Page closed, cleaning up: ${sessionId}`);
        try {
          await browser.close();
        } catch (e) {
          // Browser might already be closed
        }
        sessions.delete(sessionId);
        console.error(`[SESSION] Auto-closed: ${sessionId} (page closed)`);
      }
    });

    console.error(`[SESSION] Created: ${sessionId} (${engineName}) for profile ${fullProfile.name || 'Unnamed'}`);

    return {
      success: true,
      sessionId,
      profileId: fullProfile.id,
      profileName: fullProfile.name,
      engine: engineName,
    };
  } catch (error) {
    console.error('[SESSION] Failed to create:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Navigate session to URL
 */
async function navigate(sessionId, url) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.error(`[SESSION] ${sessionId} navigated to ${url}`);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Close a session
 */
async function closeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    // Close browser (this also closes context and pages)
    if (session.browser) {
      await session.browser.close();
    } else {
      await session.context.close();
    }
    sessions.delete(sessionId);
    console.error(`[SESSION] Closed: ${sessionId}`);
    return { success: true };
  } catch (error) {
    sessions.delete(sessionId); // Clean up even if close fails
    return { success: false, error: error.message };
  }
}

/**
 * Get all sessions
 */
function getSessions() {
  const result = [];
  for (const [id, session] of sessions) {
    result.push({
      id: session.id,
      profileId: session.profileId,
      profileName: session.profileName,
      engine: session.engine,
      status: session.status,
      startedAt: session.startedAt
    });
  }
  return { success: true, sessions: result };
}

/**
 * Close browser and all sessions
 */
async function shutdown() {
  try {
    for (const [id, session] of sessions) {
      await session.context.close();
    }
    sessions.clear();

    for (const [name, browser] of Object.entries(browsers)) {
      if (browser) {
        await browser.close();
        browsers[name] = null;
      }
    }

    console.error('[BROWSER] Shutdown complete');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Export cookies from session
 */
async function exportCookies(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const cookies = await session.context.cookies();
    return { success: true, cookies };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import cookies to session
 */
async function importCookies(sessionId, cookies) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    await session.context.addCookies(cookies);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute JavaScript in session
 */
async function evaluate(sessionId, script) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const result = await session.page.evaluate(script);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Take screenshot
 */
async function screenshot(sessionId, path) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    await session.page.screenshot({ path, fullPage: false });
    return { success: true, path };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current page URL
 */
async function getUrl(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const url = session.page.url();
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get page title
 */
async function getTitle(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const title = await session.page.title();
    return { success: true, title };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get available mobile devices
 */
function getDevices() {
  const { getAllDevices } = require('./profile/devices');
  return { success: true, devices: getAllDevices() };
}

/**
 * Get available browser engines
 */
function getEngines() {
  const { getAvailableEngines } = require('./browser/engines');
  return { success: true, engines: getAvailableEngines() };
}

/**
 * Get system info including actual OS for profile consistency
 */
function getSystemInfo() {
  const platform = os.platform(); // 'linux', 'darwin', 'win32'
  const arch = os.arch(); // 'x64', 'arm64', etc.
  const cpuCores = os.cpus().length;
  const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // GB

  // Map platform to profile OS name
  let actualOS;
  if (platform === 'win32') {
    actualOS = 'windows';
  } else if (platform === 'darwin') {
    actualOS = 'macos';
  } else if (platform === 'linux') {
    actualOS = 'linux';
  } else if (platform === 'android') {
    actualOS = 'android';
  } else {
    actualOS = 'linux'; // Default fallback
  }

  return {
    success: true,
    system: {
      actualOS,        // OS name for profile matching: 'windows', 'macos', 'linux', 'android', 'ios'
      platform,        // Raw Node.js platform
      arch,            // CPU architecture
      cpuCores,        // Number of CPU cores
      totalMemory,     // Total RAM in GB
      hostname: os.hostname(),
      release: os.release()
    }
  };
}

/**
 * Lookup geo info for IP
 */
async function geoLookup(ip = null) {
  try {
    const result = await lookupIP(ip);
    return { success: true, geo: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Extension Management ============

/**
 * List installed extensions
 */
function listExtensions() {
  try {
    const extensions = extensionManager.listExtensions();
    return { success: true, extensions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import extension from path
 */
function importExtension(sourcePath, extensionId = null) {
  try {
    const result = extensionManager.importUnpacked(sourcePath, extensionId);
    return { success: true, extension: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import extension from CRX file
 */
function importExtensionCRX(crxPath) {
  try {
    const result = extensionManager.importCRX(crxPath);
    return { success: true, extension: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove extension
 */
function removeExtension(extensionId) {
  try {
    const removed = extensionManager.removeExtension(extensionId);
    return { success: removed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Download and install extension from Chrome Web Store
 */
async function downloadAndInstallExtension(webstoreId) {
  try {
    const result = await extensionManager.downloadAndInstall(webstoreId);
    return { success: true, extension: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Enable extension
 */
function enableExtension(extensionId) {
  try {
    const result = extensionManager.enableExtension(extensionId);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Disable extension
 */
function disableExtension(extensionId) {
  try {
    const result = extensionManager.disableExtension(extensionId);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Toggle extension enabled state
 */
function toggleExtension(extensionId) {
  try {
    const result = extensionManager.toggleExtension(extensionId);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Cookie Management ============

/**
 * Export cookies in specified format
 */
async function exportCookiesFormat(sessionId, format = 'json') {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const cookies = await session.context.cookies();
    let result;

    switch (format) {
      case 'netscape':
        result = cookieManager.exportNetscape(cookies);
        break;
      case 'editthiscookie':
        result = cookieManager.exportEditThisCookie(cookies);
        break;
      case 'base64':
        result = cookieManager.exportBase64(cookies);
        break;
      default:
        result = cookieManager.exportJSON(cookies);
    }

    return { success: true, cookies: result, format };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import cookies from string (auto-detect format)
 */
async function importCookiesString(sessionId, cookieString) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const format = cookieManager.detectFormat(cookieString);
    const cookies = cookieManager.autoImport(cookieString);
    await session.context.addCookies(cookies);

    return { success: true, count: cookies.length, format };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Save cookies to file
 */
async function saveCookiesToFile(sessionId, filePath, format = 'json') {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const cookies = await session.context.cookies();
    cookieManager.saveToFile(cookies, filePath, format);
    return { success: true, path: filePath, count: cookies.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Load cookies from file
 */
async function loadCookiesFromFile(sessionId, filePath) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const cookies = cookieManager.loadFromFile(filePath);
    await session.context.addCookies(cookies);
    return { success: true, count: cookies.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Clear cookies for session
 */
async function clearCookies(sessionId, domain = null) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const cookies = await session.context.cookies();
    let toRemove = cookies;

    if (domain) {
      toRemove = cookieManager.filterByDomain(cookies, domain);
    }

    // Clear by setting empty array for each cookie's URL
    await session.context.clearCookies();
    return { success: true, cleared: toRemove.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Testing ============

/**
 * Run anti-detect tests on session
 */
async function runAntidetectTest(sessionId, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const results = await testRunner.antidetect.runAllTests(session.page, options);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run quick benchmark on session
 */
async function runQuickBenchmark(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const results = await testRunner.benchmark.quickBenchmark(session.page);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run full benchmark (needs browser instance)
 */
async function runFullBenchmark(engineName = 'chromium', options = {}) {
  const browser = browsers[engineName];
  if (!browser) {
    return { success: false, error: `Browser ${engineName} not initialized` };
  }

  try {
    const results = await testRunner.benchmark.runFullBenchmark(browser, options);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run complete test suite on session
 */
async function runTestSuite(sessionId, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  const browser = browsers[session.engine];

  try {
    const results = await testRunner.runCompleteSuite(session.page, browser, {
      profile: session.profile,
      ...options,
    });
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run detection site tests
 */
async function runDetectionSiteTest(sessionId, siteUrl, timeout = 30000) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const site = { name: 'Custom', url: siteUrl, description: 'Custom detection site' };
    const result = await testRunner.runDetectionSiteTest(session.page, site, timeout);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get list of detection sites
 */
function getDetectionSites() {
  return { success: true, sites: testRunner.DETECTION_SITES };
}

/**
 * Generate anti-detect report
 */
function generateAntidetectReport(results) {
  try {
    const report = testRunner.antidetect.generateReport(results);
    return { success: true, report };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate benchmark report
 */
function generateBenchmarkReport(results) {
  try {
    const report = testRunner.benchmark.generateBenchmarkReport(results);
    return { success: true, report };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Automation/Workflow ============

/**
 * Get all action schemas for UI
 */
function getActionSchemas() {
  try {
    const schemas = automation.getAllActionSchemas();
    return { success: true, schemas };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Validate a workflow
 */
function validateWorkflow(workflow) {
  try {
    const result = workflowManager.validateWorkflow(workflow);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Register a workflow
 */
function registerWorkflow(workflow) {
  try {
    const result = workflowManager.registerWorkflow(workflow);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List all workflows
 */
function listWorkflows() {
  try {
    const workflows = workflowManager.listWorkflows();
    return { success: true, workflows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get a workflow
 */
function getWorkflow(workflowId) {
  try {
    const workflow = workflowManager.getWorkflow(workflowId);
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }
    return { success: true, workflow };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a workflow
 */
function deleteWorkflow(workflowId) {
  try {
    const deleted = workflowManager.deleteWorkflow(workflowId);
    return { success: deleted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute workflow on session
 */
async function executeWorkflow(sessionId, workflowIdOrObj) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const result = await workflowManager.executeWorkflow(workflowIdOrObj, {
      page: session.page,
      browserContext: session.context,
      profile: session.profile,
      outputDir: SCREENSHOTS_DIR,
      session: {
        id: session.id,
        url: session.page.url(),
      },
    });

    return { success: true, execution: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute workflow on multiple sessions (batch)
 */
async function executeWorkflowBatch(workflowIdOrObj, sessionIds, options = {}) {
  const sessionsToRun = [];

  for (const sessionId of sessionIds) {
    const session = sessions.get(sessionId);
    if (session) {
      sessionsToRun.push({
        sessionId,
        page: session.page,
        browserContext: session.context,
        profile: session.profile,
      });
    }
  }

  if (sessionsToRun.length === 0) {
    return { success: false, error: 'No valid sessions found' };
  }

  try {
    // Note: Real batch execution would create contexts for each profile
    // This is a simplified version that runs on existing sessions
    const results = [];

    for (const sessionData of sessionsToRun) {
      const result = await workflowManager.executeWorkflow(workflowIdOrObj, {
        page: sessionData.page,
        browserContext: sessionData.browserContext,
        profile: sessionData.profile,
        outputDir: SCREENSHOTS_DIR,
        session: { id: sessionData.sessionId },
      });
      results.push({
        sessionId: sessionData.sessionId,
        ...result,
      });
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get running executions
 */
function getRunningExecutions() {
  try {
    const executions = workflowManager.getRunningExecutions();
    return { success: true, executions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop a running execution
 */
function stopExecution(executionId) {
  try {
    const stopped = workflowManager.stopExecution(executionId);
    return { success: stopped };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Debug Mode ============

/**
 * Start debug session for workflow
 */
async function startDebug(sessionId, workflowIdOrObj, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const workflow = typeof workflowIdOrObj === 'string'
      ? workflowManager.getWorkflow(workflowIdOrObj)
      : workflowIdOrObj;

    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }

    const result = await workflowManager.executor.executeDebug(workflow, {
      page: session.page,
      browserContext: session.context,
      profile: session.profile,
      outputDir: SCREENSHOTS_DIR,
      session: { id: session.id, url: session.page.url() },
    }, options);

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute next step in debug mode
 */
async function debugStep(debugId) {
  try {
    return await workflowManager.executor.debugStep(debugId);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Continue execution until breakpoint or end
 */
async function debugContinue(debugId) {
  try {
    return await workflowManager.executor.debugContinue(debugId);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop debug session
 */
function debugStop(debugId) {
  try {
    return workflowManager.executor.debugStop(debugId);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get debug session state
 */
function getDebugState(debugId) {
  try {
    return workflowManager.executor.getDebugState(debugId);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Set/unset breakpoint
 */
function setBreakpoint(debugId, stepId, enabled = true) {
  try {
    return workflowManager.executor.setBreakpoint(debugId, stepId, enabled);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Modify variable in debug session
 */
function setDebugVariable(debugId, name, value) {
  try {
    return workflowManager.executor.setDebugVariable(debugId, name, value);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List active debug sessions
 */
function listDebugSessions() {
  try {
    const sessions = automation.WorkflowExecutor.listDebugSessions();
    return { success: true, sessions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Scheduler ============

/**
 * Create a new schedule
 */
async function createSchedule(data) {
  try {
    const schedule = await scheduler.createSchedule(data);
    return { success: true, schedule };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a schedule
 */
async function updateSchedule(id, data) {
  try {
    const schedule = await scheduler.updateSchedule(id, data);
    return { success: true, schedule };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a schedule
 */
async function deleteSchedule(id) {
  try {
    await scheduler.deleteSchedule(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get a schedule by ID
 */
function getSchedule(id) {
  try {
    const schedule = scheduler.getSchedule(id);
    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }
    return { success: true, schedule };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List all schedules
 */
function listSchedules() {
  try {
    const schedules = scheduler.listSchedules();
    return { success: true, schedules };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Enable a schedule
 */
async function enableSchedule(id) {
  try {
    const schedule = await scheduler.enableSchedule(id);
    return { success: true, schedule };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Disable a schedule
 */
async function disableSchedule(id) {
  try {
    const schedule = await scheduler.disableSchedule(id);
    return { success: true, schedule };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run a schedule immediately
 */
async function runScheduleNow(id) {
  try {
    const schedule = await scheduler.runNow(id);
    return { success: true, schedule };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  try {
    const status = scheduler.getStatus();
    return { success: true, ...status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get cron presets
 */
function getCronPresets() {
  return { success: true, presets: Scheduler.getPresets() };
}

/**
 * Get schedule for a workflow
 */
function getWorkflowSchedule(workflowId) {
  try {
    const schedules = scheduler.listSchedules();
    const schedule = schedules.find(s => s.workflowId === workflowId);
    return { success: true, schedule: schedule || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Save/update schedule for a workflow
 */
async function saveWorkflowSchedule(data) {
  try {
    const { workflowId, workflowName, workflow, cron, profileIds, enabled, parallelConfig } = data;

    // Check if schedule already exists for this workflow
    const schedules = scheduler.listSchedules();
    const existing = schedules.find(s => s.workflowId === workflowId);

    const scheduleData = {
      name: workflowName,
      workflowId,
      workflowName,
      workflow, // Store full workflow definition for persistence
      cron,
      profileIds,
      enabled,
      parallelConfig, // Parallel execution settings
    };

    // Also register the workflow immediately
    if (workflow) {
      try {
        workflowManager.registerWorkflow(workflow);
        console.error(`[SCHEDULER] Registered workflow: ${workflow.name} (${workflowId})`);
      } catch (err) {
        // Workflow might already be registered, ignore
      }
    }

    if (existing) {
      // Update existing schedule
      const schedule = await scheduler.updateSchedule(existing.id, scheduleData);
      return { success: true, schedule };
    } else {
      // Create new schedule
      const schedule = await scheduler.createSchedule(scheduleData);
      return { success: true, schedule };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete schedule for a workflow
 */
async function deleteWorkflowSchedule(workflowId) {
  try {
    const schedules = scheduler.listSchedules();
    const existing = schedules.find(s => s.workflowId === workflowId);

    if (existing) {
      await scheduler.deleteSchedule(existing.id);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Parallel Execution ============

/**
 * Start parallel workflow execution
 */
async function startParallelExecution(params) {
  const { workflowId, profileIds, options = {} } = params;

  // Get workflow
  const workflow = workflowManager.getWorkflow(workflowId);
  if (!workflow) {
    return { success: false, error: 'Workflow not found' };
  }

  // Get profiles from cache
  const profiles = getCachedProfiles(profileIds);
  if (profiles.length === 0) {
    return { success: false, error: 'No profiles found in cache. Open the app to sync.' };
  }

  // Create parallel executor
  const executionId = `parallel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const headless = options.headless || false;
  const blocking = options.blocking || {};

  const executor = new ParallelExecutor({
    maxConcurrent: options.maxConcurrent || 3,
    delayBetween: options.delayBetween || 1000,
    timeout: options.timeout || 300000,
    stopOnError: options.stopOnError || false,
    queueMode: options.queueMode || 'fifo',
    headless,
    blocking,
    retry: options.retry || {}
  });

  // Setup event listeners
  executor.on('start', (data) => {
    const blockingInfo = Object.entries(blocking).filter(([k, v]) => v).map(([k]) => k).join(', ') || 'none';
    console.error(`[PARALLEL] Started: ${data.workflowName} with ${data.totalProfiles} profiles`);
    console.error(`[PARALLEL] Settings: headless=${headless}, blocking=[${blockingInfo}], concurrent=${data.maxConcurrent}`);
    notificationManager.notify('onStart', { ...data, executionId });
  });

  executor.on('progress', (data) => {
    console.error(`[PARALLEL] Progress: ${data.profileName || data.profileId} - ${data.percentage}%`);
  });

  executor.on('slotSuccess', (data) => {
    console.error(`[PARALLEL] Success: ${data.profileName || data.profileId}`);
    notificationManager.notify('onSuccess', { ...data, workflowName: workflow.name, executionId });
  });

  executor.on('slotFailure', (data) => {
    console.error(`[PARALLEL] Failed: ${data.profileName || data.profileId} - ${data.error}`);
    notificationManager.notify('onFailure', { ...data, workflowName: workflow.name, executionId });
  });

  executor.on('slotRetry', (data) => {
    console.error(`[PARALLEL] Retry: ${data.profileName || data.profileId} (${data.retryCount}/${data.maxRetries})`);
    notificationManager.notify('onRetry', { ...data, workflowName: workflow.name, executionId });
  });

  executor.on('complete', (data) => {
    console.error(`[PARALLEL] Complete: ${data.completed}/${data.totalProfiles} succeeded`);
    notificationManager.notify('onComplete', { ...data, workflowName: workflow.name, executionId });
    // Keep executor for 30 seconds so monitor can show final status
    setTimeout(() => {
      parallelExecutors.delete(executionId);
    }, 30000);
  });

  // Store executor
  parallelExecutors.set(executionId, executor);

  // Launch browser for this execution
  let browser;
  try {
    browser = await launchBrowser('chromium', { headless });
  } catch (error) {
    parallelExecutors.delete(executionId);
    return { success: false, error: `Failed to launch browser: ${error.message}` };
  }

  // Start execution (non-blocking)
  executor.start({
    browser,
    workflowExecutor: async (wf, ctx) => {
      return workflowManager.executeWorkflow(wf, {
        ...ctx,
        outputDir: SCREENSHOTS_DIR,
        session: { id: ctx.profile.id }
      });
    },
    workflow,
    profiles,
    options
  }).then(async (status) => {
    // Close browser when done
    try {
      await browser.close();
    } catch (e) {
      // Ignore
    }
    return status;
  }).catch(async (error) => {
    console.error(`[PARALLEL] Execution error:`, error.message);
    try {
      await browser.close();
    } catch (e) {
      // Ignore
    }
  });

  return {
    success: true,
    executionId,
    status: executor.getStatus()
  };
}

/**
 * Get parallel execution status
 */
function getParallelStatus(executionId) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  return { success: true, status: executor.getStatus() };
}

/**
 * Get all parallel executions
 */
function listParallelExecutions() {
  const executions = [];
  for (const [id, executor] of parallelExecutors) {
    executions.push({
      id,
      ...executor.getStatus()
    });
  }
  return { success: true, executions };
}

/**
 * Pause parallel execution
 */
function pauseParallelExecution(executionId) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  executor.pause();
  return { success: true, status: executor.getStatus() };
}

/**
 * Resume parallel execution
 */
function resumeParallelExecution(executionId) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  executor.resume();
  return { success: true, status: executor.getStatus() };
}

/**
 * Stop parallel execution
 */
async function stopParallelExecution(executionId) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  await executor.stop();
  parallelExecutors.delete(executionId);
  return { success: true };
}

/**
 * Skip current slot in parallel execution
 */
async function skipParallelSlot(executionId, slotId) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  await executor.skipSlot(slotId);
  return { success: true, status: executor.getStatus() };
}

/**
 * Add profiles to running execution queue
 */
function addToParallelQueue(executionId, profileIds) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  const profiles = getCachedProfiles(profileIds);
  executor.addProfiles(profiles);
  return { success: true, status: executor.getStatus() };
}

/**
 * Remove profile from execution queue
 */
function removeFromParallelQueue(executionId, profileId) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  executor.removeFromQueue(profileId);
  return { success: true, status: executor.getStatus() };
}

/**
 * Update parallel execution config
 */
function updateParallelConfig(executionId, config) {
  const executor = parallelExecutors.get(executionId);
  if (!executor) {
    return { success: false, error: 'Execution not found' };
  }
  executor.updateConfig(config);
  return { success: true };
}

// ============ Notifications ============

/**
 * Get notification config
 */
function getNotificationConfig() {
  return { success: true, config: notificationManager.getConfig() };
}

/**
 * Update notification config
 */
function updateNotificationConfig(config) {
  try {
    notificationManager.updateConfig(config);
    return { success: true, config: notificationManager.getConfig() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Add notification channel
 */
function addNotificationChannel(channel) {
  try {
    const id = notificationManager.addChannel(channel);
    return { success: true, id, config: notificationManager.getConfig() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove notification channel
 */
function removeNotificationChannel(channelId) {
  try {
    notificationManager.removeChannel(channelId);
    return { success: true, config: notificationManager.getConfig() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test notification channel
 */
async function testNotificationChannel(channelId) {
  try {
    await notificationManager.testChannel(channelId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send test notification
 */
async function sendTestNotification() {
  try {
    await notificationManager.notify('onComplete', {
      workflowName: 'Test Workflow',
      totalProfiles: 10,
      completed: 8,
      failed: 2,
      elapsed: 120000,
      progress: 80
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ System Resources ============

/**
 * Get system resource information
 */
function getResources() {
  try {
    const resources = getSystemResources();
    return { success: true, resources };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get recommended concurrency based on system resources
 */
function getRecommendedConcurrency(options = {}) {
  try {
    const recommendation = calculateRecommendedConcurrency(options);
    return { success: true, ...recommendation };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current system load
 */
function getSystemLoad() {
  try {
    const load = getCurrentLoad();
    return { success: true, load };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ Execution History & Reporting ============

const { getDB } = require('./database');

/**
 * Get execution history
 */
function getExecutionHistory(options = {}) {
  try {
    const db = getDB();
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const executions = db.getExecutions(limit, offset);
    return { success: true, executions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get execution history by schedule
 */
function getExecutionsBySchedule(scheduleId, limit = 50) {
  try {
    const db = getDB();
    const executions = db.getExecutionsBySchedule(scheduleId, limit);
    return { success: true, executions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get execution statistics
 */
function getExecutionStats() {
  try {
    const db = getDB();
    const stats = db.getExecutionStats();

    // Get schedule stats
    const schedules = db.getSchedules();
    const scheduleStats = {
      total: schedules.length,
      enabled: schedules.filter(s => s.enabled).length,
      totalRuns: schedules.reduce((sum, s) => sum + (s.runCount || 0), 0),
      totalSuccess: schedules.reduce((sum, s) => sum + (s.successCount || 0), 0),
      totalFailure: schedules.reduce((sum, s) => sum + (s.failureCount || 0), 0),
    };

    return {
      success: true,
      stats: {
        executions: stats,
        schedules: scheduleStats
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get daily execution stats for charts
 */
function getDailyStats(days = 7) {
  try {
    const db = getDB();
    const dailyStats = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Query executions for this day
      const stmt = db.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
          AVG(CASE WHEN status = 'success' THEN duration ELSE NULL END) as avgDuration
        FROM execution_history
        WHERE date(started_at) = ?
      `);

      const row = stmt.get(dateStr) || { total: 0, success: 0, failure: 0, avgDuration: 0 };

      dailyStats.push({
        date: dateStr,
        total: row.total || 0,
        success: row.success || 0,
        failure: row.failure || 0,
        avgDuration: Math.round(row.avgDuration || 0)
      });
    }

    return { success: true, dailyStats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Export execution history to CSV
 */
function exportExecutionsCSV(options = {}) {
  try {
    const db = getDB();
    const limit = options.limit || 1000;
    const executions = db.getExecutions(limit, 0);

    // CSV header
    const headers = ['ID', 'Schedule', 'Workflow', 'Profile', 'Status', 'Error', 'Started', 'Duration (ms)', 'Steps'];

    // CSV rows
    const rows = executions.map(e => [
      e.id,
      e.scheduleId,
      e.workflowId,
      e.profileName || e.profileId,
      e.status,
      (e.error || '').replace(/"/g, '""'),
      e.startedAt,
      e.duration,
      `${e.stepsCompleted}/${e.totalSteps}`
    ]);

    // Build CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return { success: true, csv, count: executions.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete old execution history
 */
function cleanupExecutions(days = 30) {
  try {
    const db = getDB();
    const deleted = db.deleteOldExecutions(days);
    return { success: true, deleted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Log execution result (called by parallel executor)
 */
function logExecution(data) {
  try {
    const db = getDB();

    // Build detailed error message if failed
    let errorMessage = data.error || '';
    if (data.status === 'failed' && data.failedStep) {
      const stepInfo = `[Step ${data.failedStep.index + 1}/${data.totalSteps}: ${data.failedStep.name || data.failedStep.id}]`;
      errorMessage = `${stepInfo} ${errorMessage}`;
    }

    const execution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scheduleId: data.scheduleId || '',
      workflowId: data.workflowId,
      profileId: data.profileId,
      profileName: data.profileName || '',
      status: data.status,
      error: errorMessage,
      startedAt: data.startedAt || new Date().toISOString(),
      finishedAt: data.finishedAt || new Date().toISOString(),
      duration: data.duration || 0,
      stepsCompleted: data.stepsCompleted || 0,
      totalSteps: data.totalSteps || 0,
      logs: data.logs || [],
      // Additional fields for debugging
      failedStepId: data.failedStep?.id || '',
      failedStepName: data.failedStep?.name || '',
      failedStepIndex: data.failedStep?.index ?? -1,
    };
    db.createExecution(execution);
    return { success: true, execution };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ WARMUP API ============

const warmup = require('./warmup');

/**
 * Get all warmup templates
 */
function getWarmupTemplates() {
  try {
    const db = getDB();
    const templates = db.getWarmupTemplates();
    return { success: true, templates };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get default warmup templates (pre-built)
 */
function getDefaultWarmupTemplates() {
  return { success: true, templates: warmup.DEFAULT_TEMPLATES };
}

/**
 * Get warmup template by ID
 */
function getWarmupTemplate(id) {
  try {
    const db = getDB();
    const template = db.getWarmupTemplate(id);
    if (!template) {
      // Check default templates
      const defaultTemplate = warmup.getTemplateById(id);
      if (defaultTemplate) {
        return { success: true, template: defaultTemplate };
      }
      return { success: false, error: 'Template not found' };
    }
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create warmup template
 */
function createWarmupTemplate(templateData) {
  try {
    const db = getDB();
    const template = warmup.createWarmupTemplate(templateData);
    const created = db.createWarmupTemplate(template);
    return { success: true, template: created };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update warmup template
 */
function updateWarmupTemplate(id, templateData) {
  try {
    const db = getDB();
    const existing = db.getWarmupTemplate(id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }
    const updated = db.updateWarmupTemplate({ ...existing, ...templateData, id });
    return { success: true, template: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete warmup template
 */
function deleteWarmupTemplate(id) {
  try {
    const db = getDB();
    db.deleteWarmupTemplate(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all warmup progress
 */
function getWarmupProgress(options = {}) {
  try {
    const db = getDB();
    const limit = options.limit || 100;
    const progress = db.getAllWarmupProgress(limit);
    return { success: true, progress };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get active warmups
 */
function getActiveWarmups() {
  try {
    const db = getDB();
    const warmups = db.getActiveWarmups();
    return { success: true, warmups };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get warmups by profile
 */
function getWarmupsByProfile(profileId) {
  try {
    const db = getDB();
    const warmups = db.getWarmupsByProfile(profileId);
    return { success: true, warmups };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Start warmup for profiles
 */
function startWarmup(templateId, profileIds, options = {}) {
  try {
    const db = getDB();

    // Get template (from DB or default)
    let template = db.getWarmupTemplate(templateId);
    if (!template) {
      template = warmup.getTemplateById(templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }
      // Save default template to DB
      template = db.createWarmupTemplate(template);
    }

    const results = [];
    const now = new Date();
    const firstRun = warmup.calculateNextRun(template.schedule);

    for (const profileId of profileIds) {
      // Check if profile already has active warmup
      const existing = db.getWarmupsByProfile(profileId);
      const hasActive = existing.some(p =>
        p.warmupId === templateId &&
        ['pending', 'running', 'paused'].includes(p.status)
      );

      if (hasActive) {
        results.push({ profileId, error: 'Already has active warmup for this template' });
        continue;
      }

      // Create progress record
      const progress = warmup.createWarmupProgress({
        warmupId: templateId,
        profileId,
        profileName: options.profileNames?.[profileId] || '',
        startDate: now.toISOString().split('T')[0],
        currentDay: 1,
        currentPhase: 1,
        status: 'pending',
        dailyLogs: [],
        nextRunAt: firstRun.toISOString()
      });

      const created = db.createWarmupProgress(progress);
      results.push({ profileId, progress: created });
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Pause warmup
 */
function pauseWarmup(progressId) {
  try {
    const db = getDB();
    db.updateWarmupProgressStatus(progressId, 'paused');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Resume warmup
 */
function resumeWarmup(progressId) {
  try {
    const db = getDB();
    const progress = db.getWarmupProgress(progressId);
    if (!progress) {
      return { success: false, error: 'Progress not found' };
    }

    const template = db.getWarmupTemplate(progress.warmupId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const nextRun = warmup.calculateNextRun(template.schedule);
    db.updateWarmupProgress({
      ...progress,
      status: 'running',
      nextRunAt: nextRun.toISOString()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop warmup
 */
function stopWarmup(progressId) {
  try {
    const db = getDB();
    db.updateWarmupProgressStatus(progressId, 'failed', 'Stopped by user');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete warmup progress
 */
function deleteWarmupProgress(progressId) {
  try {
    const db = getDB();
    db.deleteWarmupProgress(progressId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run warmup now (manual trigger)
 */
async function runWarmupNow(progressId) {
  try {
    const db = getDB();

    // Get warmup progress
    const progress = db.getWarmupProgress(progressId);
    if (!progress) {
      return { success: false, error: 'Warmup progress not found' };
    }

    if (progress.status === 'running') {
      return { success: false, error: 'Warmup is already running' };
    }

    if (progress.status === 'completed') {
      return { success: false, error: 'Warmup is already completed' };
    }

    // Get template
    let template = db.getWarmupTemplate(progress.warmupId);
    if (!template) {
      template = warmup.getTemplateById(progress.warmupId);
    }
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Get profile from cache
    const profile = profileCache.get(progress.profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found in cache. Please sync profiles from the app.' };
    }

    // Get resources for this profile (credentials/cookies)
    // Resources are stored in the profile object from the frontend
    const resources = profile.resources || [];
    const platformResource = resources.find(r => r.platform === template.platform) || {};

    // Update status to running
    db.updateWarmupProgressStatus(progressId, 'running');

    // Create browser session
    const sessionResult = await createSession(progress.profileId, { headless: false });
    if (!sessionResult.success) {
      db.updateWarmupProgressStatus(progressId, 'paused', sessionResult.error);
      return { success: false, error: 'Failed to create session: ' + sessionResult.error };
    }

    const sessionId = sessionResult.sessionId;

    try {
      // Get page from session
      const session = sessions.get(sessionId);
      if (!session || !session.page) {
        throw new Error('Session page not available');
      }

      const page = session.page;
      const context = session.context;

      console.error(`[Warmup] Starting executor for ${progress.profileName}, platform: ${template.platform}`);
      console.error(`[Warmup] Resource:`, JSON.stringify(platformResource || {}).slice(0, 200));

      // Execute warmup
      const executor = new warmup.WarmupExecutor({ verbose: true });

      const result = await executor.executeDailyWarmup({
        page,
        context,
        template,
        progress,
        resource: platformResource,
        onProgress: (info) => {
          console.error(`[Warmup] ${progress.profileName}: ${info.action} - ${info.status}`);
        }
      });

      console.error(`[Warmup] Executor completed for ${progress.profileName}`);
      console.error(`[Warmup] Result:`, JSON.stringify(result, null, 2));

      // Update progress
      const newDay = progress.currentDay + 1;
      const isCompleted = newDay > template.totalDays;
      console.error(`[Warmup] newDay=${newDay}, isCompleted=${isCompleted}, totalDays=${template.totalDays}`);

      // Calculate next phase
      const nextPhase = warmup.getCurrentPhase(template.phases, newDay);

      // Add log entry (simplified to avoid serialization issues)
      const dailyLogs = progress.dailyLogs || [];
      dailyLogs.push({
        day: result.day,
        phase: result.phase,
        phaseName: result.phaseName,
        actions: result.actions || {},
        loginMethod: result.loginMethod || null,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt || new Date().toISOString(),
        errors: (result.errors || []).map(e => String(e))
      });

      try {
        console.error(`[Warmup] Updating database...`);
        if (isCompleted) {
          db.updateWarmupProgress({
            id: progressId,
            profileName: progress.profileName || '',
            currentDay: template.totalDays,
            currentPhase: template.phases.length,
            status: 'completed',
            dailyLogs,
            nextRunAt: null,
            completedAt: new Date().toISOString(),
            error: ''
          });
        } else {
          const nextRun = warmup.calculateNextRun(template.schedule);
          const nextPhaseIndex = nextPhase?.index ?? progress.currentPhase ?? 1;
          db.updateWarmupProgress({
            id: progressId,
            profileName: progress.profileName || '',
            currentDay: newDay,
            currentPhase: nextPhaseIndex,
            status: 'pending',
            dailyLogs,
            nextRunAt: nextRun instanceof Date ? nextRun.toISOString() : (nextRun || null),
            completedAt: null,
            error: ''
          });
        }
        console.error(`[Warmup] Database updated successfully`);
      } catch (dbError) {
        console.error(`[Warmup] Database update failed:`, dbError.message);
        throw dbError;
      }

      // Close session after warmup
      await closeSession(sessionId);

      return {
        success: true,
        result,
        newDay: isCompleted ? template.totalDays : newDay,
        isCompleted
      };

    } catch (execError) {
      // Update status to failed
      const errorMsg = execError?.message || String(execError) || 'Unknown error';
      console.error(`[Warmup] Executor error for ${progress.profileName}:`, errorMsg);
      console.error(`[Warmup] Full error:`, execError);
      try {
        db.updateWarmupProgressStatus(progressId, 'paused', errorMsg);
      } catch (dbError) {
        console.error('[Warmup] Failed to update status:', dbError.message);
      }

      // Try to close session
      try {
        await closeSession(sessionId);
      } catch (e) {}

      return { success: false, error: errorMsg };
    }

  } catch (error) {
    const errorMsg = error?.message || String(error) || 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

/**
 * Get warmup stats
 */
function getWarmupStats() {
  try {
    const db = getDB();
    const stats = db.getWarmupStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get supported platforms
 */
function getWarmupPlatforms() {
  return {
    success: true,
    platforms: warmup.PLATFORMS,
    actions: warmup.PLATFORM_ACTIONS
  };
}

// ============ HTTP Server (for frontend dev) ============

const HTTP_PORT = process.env.SIDECAR_HTTP_PORT || 3456;

const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { action, ...params } = JSON.parse(body);
        const handler = handlers[action];

        if (!handler) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Unknown action: ${action}` }));
          return;
        }

        // Extract args based on action
        let result;
        if (action === 'createSession') {
          // Pass options including headless and blocking
          const options = {
            headless: params.headless || false,
            blocking: params.blocking || {}
          };
          console.error(`[DEBUG] createSession called with headless=${options.headless}, blocking=${JSON.stringify(options.blocking)}`);
          result = await handler(params.profile, params.proxy, options);
        } else if (action === 'navigate') {
          result = await handler(params.sessionId, params.url);
        } else if (action === 'closeSession' || action === 'exportCookies' || action === 'getUrl' || action === 'getTitle') {
          result = await handler(params.sessionId);
        } else if (action === 'evaluate') {
          result = await handler(params.sessionId, params.script);
        } else if (action === 'screenshot') {
          result = await handler(params.sessionId, params.path);
        } else if (action === 'importCookies') {
          result = await handler(params.sessionId, params.cookies);
        } else if (action === 'exportCookiesFormat') {
          result = await handler(params.sessionId, params.format);
        } else if (action === 'importCookiesString') {
          result = await handler(params.sessionId, params.cookieString);
        } else if (action === 'saveCookiesToFile') {
          result = await handler(params.sessionId, params.filePath, params.format);
        } else if (action === 'loadCookiesFromFile') {
          result = await handler(params.sessionId, params.filePath);
        } else if (action === 'clearCookies') {
          result = await handler(params.sessionId, params.domain);
        } else if (action === 'importExtension') {
          result = await handler(params.sourcePath, params.extensionId);
        } else if (action === 'importExtensionCRX') {
          result = await handler(params.crxPath);
        } else if (action === 'removeExtension') {
          result = await handler(params.extensionId);
        } else if (action === 'downloadAndInstallExtension') {
          result = await handler(params.webstoreId);
        } else if (action === 'enableExtension' || action === 'disableExtension' || action === 'toggleExtension') {
          result = await handler(params.extensionId);
        } else if (action === 'init') {
          result = await handler(params);
        } else if (action === 'geoLookup') {
          result = await handler(params.ip);
        } else if (action === 'runAntidetectTest' || action === 'runQuickBenchmark') {
          result = await handler(params.sessionId, params.options);
        } else if (action === 'runFullBenchmark') {
          result = await handler(params.engineName, params.options);
        } else if (action === 'runTestSuite') {
          result = await handler(params.sessionId, params.options);
        } else if (action === 'runDetectionSiteTest') {
          result = await handler(params.sessionId, params.siteUrl, params.timeout);
        } else if (action === 'validateWorkflow' || action === 'registerWorkflow') {
          result = await handler(params.workflow);
        } else if (action === 'getWorkflow' || action === 'deleteWorkflow') {
          result = await handler(params.id);
        } else if (action === 'executeWorkflow') {
          result = await handler(params.sessionId, params.workflowId || params);
        } else if (action === 'executeWorkflowBatch') {
          result = await handler(params.workflowId, params.sessionIds, params.options);
        } else if (action === 'stopExecution') {
          result = await handler(params.executionId);
        } else if (action === 'getExecutionLogs' || action === 'clearExecutionLogs') {
          result = await handler(params.executionId);
        } else if (action === 'addExecutionLog') {
          result = await handler(params.executionId, params.type, params.message, params.duration);
        } else if (action === 'generateAntidetectReport' || action === 'generateBenchmarkReport') {
          result = await handler(params.results);
        } else if (action === 'startDebug') {
          result = await handler(params.sessionId, params.workflowId || params.workflow, params.options);
        } else if (action === 'debugStep' || action === 'debugContinue' || action === 'debugStop' || action === 'getDebugState') {
          result = await handler(params.debugId);
        } else if (action === 'setBreakpoint') {
          result = await handler(params.debugId, params.stepId, params.enabled);
        } else if (action === 'setDebugVariable') {
          result = await handler(params.debugId, params.name, params.value);
        } else if (action === 'createSchedule') {
          result = await handler(params);
        } else if (action === 'updateSchedule') {
          result = await handler(params.id, params);
        } else if (action === 'deleteSchedule' || action === 'getSchedule' || action === 'enableSchedule' || action === 'disableSchedule' || action === 'runScheduleNow') {
          result = await handler(params.id);
        } else if (action === 'getWorkflowSchedule' || action === 'deleteWorkflowSchedule') {
          result = await handler(params.workflowId);
        } else if (action === 'saveWorkflowSchedule') {
          result = await handler(params);
        } else if (action === 'syncProfiles') {
          result = await handler(params.profiles || []);
        } else if (action === 'getCachedProfiles') {
          result = await handler(params.profileIds || []);
        } else if (action === 'startParallelExecution') {
          result = await handler(params);
        } else if (action === 'getParallelStatus' || action === 'pauseParallelExecution' || action === 'resumeParallelExecution' || action === 'stopParallelExecution') {
          result = await handler(params.executionId);
        } else if (action === 'skipParallelSlot') {
          result = await handler(params.executionId, params.slotId);
        } else if (action === 'addToParallelQueue') {
          result = await handler(params.executionId, params.profileIds);
        } else if (action === 'removeFromParallelQueue') {
          result = await handler(params.executionId, params.profileId);
        } else if (action === 'updateParallelConfig') {
          result = await handler(params.executionId, params.config);
        } else if (action === 'updateNotificationConfig') {
          result = await handler(params.config || params);
        } else if (action === 'addNotificationChannel') {
          result = await handler(params.channel || params);
        } else if (action === 'removeNotificationChannel' || action === 'testNotificationChannel') {
          result = await handler(params.channelId);
        } else if (action === 'logExecution') {
          result = await handler(params);
        } else if (action === 'getDailyStats') {
          result = await handler(params.days);
        } else if (action === 'getExecutionHistory') {
          result = await handler(params);
        } else if (action === 'getExecutionsBySchedule') {
          result = await handler(params.scheduleId, params.limit);
        } else if (action === 'exportExecutionsCSV') {
          result = await handler(params);
        } else if (action === 'cleanupExecutions') {
          result = await handler(params.days);
        } else if (action === 'startWarmup') {
          result = await handler(params.templateId, params.profileIds, params.options);
        } else if (action === 'pauseWarmup' || action === 'resumeWarmup' || action === 'stopWarmup' || action === 'deleteWarmupProgress' || action === 'runWarmupNow') {
          result = await handler(params.progressId);
        } else if (action === 'getWarmupTemplate' || action === 'deleteWarmupTemplate') {
          result = await handler(params.id);
        } else if (action === 'createWarmupTemplate' || action === 'updateWarmupTemplate') {
          result = await handler(params.template || params);
        } else if (action === 'getWarmupsByProfile') {
          result = await handler(params.profileId);
        } else if (action === 'getWarmupProgress') {
          result = await handler(params);
        } else {
          // No-arg handlers (listSchedules, getSchedulerStatus, getCronPresets, listParallelExecutions, getNotificationConfig, getExecutionStats, getDefaultWarmupTemplates, getActiveWarmups, getWarmupStats, getWarmupPlatforms, etc.)
          result = await handler();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'MMO Express Sidecar' }));
  }
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[HTTP] Port ${HTTP_PORT} already in use, skipping HTTP server`);
  } else {
    console.error(`[HTTP] Server error:`, err.message);
  }
});

httpServer.listen(HTTP_PORT, () => {
  console.error(`[HTTP] Server listening on port ${HTTP_PORT}`);
});

// ============ IPC Communication (for Tauri) ============

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Command handlers
const handlers = {
  // Browser/Session
  init: initBrowser,
  createSession,
  navigate,
  closeSession,
  getSessions,
  shutdown,

  // Basic cookies (Playwright native)
  exportCookies,
  importCookies,

  // Advanced cookies
  exportCookiesFormat,
  importCookiesString,
  saveCookiesToFile,
  loadCookiesFromFile,
  clearCookies,

  // Extensions
  listExtensions,
  importExtension,
  importExtensionCRX,
  downloadAndInstallExtension,
  removeExtension,
  enableExtension,
  disableExtension,
  toggleExtension,

  // Utilities
  evaluate,
  screenshot,
  getUrl,
  getTitle,
  getDevices,
  getEngines,
  getSystemInfo,
  geoLookup,

  // Testing
  runAntidetectTest,
  runQuickBenchmark,
  runFullBenchmark,
  runTestSuite,
  runDetectionSiteTest,
  getDetectionSites,
  generateAntidetectReport,
  generateBenchmarkReport,

  // Automation/Workflow
  getActionSchemas,
  validateWorkflow,
  registerWorkflow,
  listWorkflows,
  getWorkflow,
  deleteWorkflow,
  executeWorkflow,
  executeWorkflowBatch,
  getRunningExecutions,
  stopExecution,

  // Execution Logs
  getExecutionLogs,
  clearExecutionLogs,
  addExecutionLog: (executionId, type, message, duration) => {
    addExecutionLog(executionId, type, message, duration);
    return { success: true };
  },

  // Debug Mode
  startDebug,
  debugStep,
  debugContinue,
  debugStop,
  getDebugState,
  setBreakpoint,
  setDebugVariable,
  listDebugSessions,

  // Scheduler
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  enableSchedule,
  disableSchedule,
  runScheduleNow,
  getSchedulerStatus,
  getCronPresets,

  // Workflow Schedule (simplified)
  getWorkflowSchedule,
  saveWorkflowSchedule,
  deleteWorkflowSchedule,

  // Profile Cache
  syncProfiles,
  getCachedProfiles: (profileIds) => ({ success: true, profiles: getCachedProfiles(profileIds) }),
  getAllCachedProfiles: () => ({ success: true, profiles: getAllCachedProfiles() }),

  // Parallel Execution
  startParallelExecution,
  getParallelStatus,
  listParallelExecutions,
  pauseParallelExecution,
  resumeParallelExecution,
  stopParallelExecution,
  skipParallelSlot,
  addToParallelQueue,
  removeFromParallelQueue,
  updateParallelConfig,

  // Notifications
  getNotificationConfig,
  updateNotificationConfig,
  addNotificationChannel,
  removeNotificationChannel,
  testNotificationChannel,
  sendTestNotification,

  // System Resources
  getResources,
  getRecommendedConcurrency,
  getSystemLoad,

  // Execution History & Reporting
  getExecutionHistory,
  getExecutionsBySchedule,
  getExecutionStats,
  getDailyStats,
  exportExecutionsCSV,
  cleanupExecutions,
  logExecution,

  // Warmup
  getWarmupTemplates,
  getDefaultWarmupTemplates,
  getWarmupTemplate,
  createWarmupTemplate,
  updateWarmupTemplate,
  deleteWarmupTemplate,
  getWarmupProgress,
  getActiveWarmups,
  getWarmupsByProfile,
  startWarmup,
  pauseWarmup,
  resumeWarmup,
  stopWarmup,
  deleteWarmupProgress,
  runWarmupNow,
  getWarmupStats,
  getWarmupPlatforms,
};

// Listen for commands from Tauri
rl.on('line', async (line) => {
  try {
    const { id, command, args } = JSON.parse(line);
    const handler = handlers[command];

    if (!handler) {
      console.log(JSON.stringify({ id, error: `Unknown command: ${command}` }));
      return;
    }

    const result = await handler(...(args || []));
    console.log(JSON.stringify({ id, result }));
  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
  }
});

// Handle exit
process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

console.error('[SIDECAR] Ready - Multi-browser support enabled');
