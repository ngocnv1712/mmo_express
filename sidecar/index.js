/**
 * MMO Express - Playwright Sidecar
 * Automation engine with stealth, multi-browser, and multi-context support
 */

const { chromium, firefox, webkit } = require('playwright');
const crypto = require('crypto');
const readline = require('readline');
const http = require('http');

// UUID v4 generator
function uuidv4() {
  return crypto.randomUUID();
}

// Import modules
const { buildStealthScript, getDefaultProfile } = require('./stealth');
const { launchBrowser, getRecommendedEngine, supportsFeature } = require('./browser/engines');
const { getDevice, applyDeviceToProfile } = require('./profile/devices');
const { autoApplyGeo, lookupIP } = require('./geo/lookup');
const extensionManager = require('./extension/manager');
const cookieManager = require('./cookie/manager');
const testRunner = require('./test/runner');
const automation = require('./automation');
const Scheduler = require('./scheduler/scheduler');

// Workflow Manager instance
const workflowManager = new automation.WorkflowManager();

// Profile cache (synced from frontend)
const profileCache = new Map();

/**
 * Sync profiles from frontend
 */
function syncProfiles(profiles) {
  profileCache.clear();
  for (const profile of profiles) {
    profileCache.set(profile.id, profile);
  }
  console.error(`[CACHE] Synced ${profiles.length} profiles`);
  return { success: true, count: profiles.length };
}

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
    // Execute workflow for each profile
    const results = [];

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

    console.error(`[SCHEDULER] Using ${profiles.length} cached profile(s)`);

    for (const profileId of schedule.profileIds) {
      try {
        // Find profile data from API response
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) {
          console.error(`[SCHEDULER] Profile not found: ${profileId}`);
          results.push({ profileId, success: false, error: 'Profile not found' });
          continue;
        }

        console.error(`[SCHEDULER] Executing ${workflow.name} on profile ${profile.name || profileId}`);

        // Create browser session
        const sessionResult = await createSession(profile, null);
        if (!sessionResult.success) {
          console.error(`[SCHEDULER] Failed to create session: ${sessionResult.error}`);
          results.push({ profileId, success: false, error: sessionResult.error });
          continue;
        }

        const sessionId = sessionResult.sessionId;
        console.error(`[SCHEDULER] Session created: ${sessionId}`);

        try {
          // Execute workflow
          const execResult = await executeWorkflow(sessionId, schedule.workflowId);

          if (execResult.success) {
            console.error(`[SCHEDULER] Workflow completed successfully on ${profile.name || profileId}`);
            results.push({ profileId, success: true });
          } else {
            console.error(`[SCHEDULER] Workflow failed: ${execResult.error}`);
            results.push({ profileId, success: false, error: execResult.error });
          }
        } finally {
          // Always close session
          console.error(`[SCHEDULER] Closing session: ${sessionId}`);
          await closeSession(sessionId);
        }
      } catch (error) {
        console.error(`[SCHEDULER] Error on profile ${profileId}:`, error.message);
        results.push({ profileId, success: false, error: error.message });
      }
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      results,
      error: allSuccess ? null : 'Some executions failed',
    };
  },
});

// Initialize scheduler
scheduler.init().catch(err => console.error('[SCHEDULER] Init error:', err));

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
async function createSession(profile, proxyConfig = null) {
  const sessionId = uuidv4();

  // Apply device preset if specified
  let fullProfile = { ...getDefaultProfile(), ...profile };
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

  // Launch a NEW browser for each session (so we can detect when user closes it)
  let browser;
  try {
    browser = await launchBrowser(engineName, {
      headless: false,
    });
    console.error(`[BROWSER] Launched new ${engineName} browser for session ${sessionId}`);
  } catch (error) {
    console.error(`[BROWSER] Failed to launch ${engineName}:`, error.message);
    return { success: false, error: error.message };
  }

  try {
    // Auto-apply geo settings from proxy if mode is 'auto'
    if (proxyConfig && (fullProfile.timezoneMode === 'auto' || fullProfile.localeMode === 'auto')) {
      fullProfile = await autoApplyGeo(fullProfile, proxyConfig);
    }

    // Context options
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

    // Create isolated context
    const context = await browser.newContext(contextOptions);

    // Block unnecessary resources for performance
    if (fullProfile.blockImages || fullProfile.blockMedia) {
      await context.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (fullProfile.blockImages && ['image'].includes(resourceType)) {
          return route.abort();
        }
        if (fullProfile.blockMedia && ['media', 'font'].includes(resourceType)) {
          return route.abort();
        }
        return route.continue();
      });
    }

    // Inject stealth scripts (only for Chromium - others have better native privacy)
    if (engineName === 'chromium' && supportsFeature('chromium', 'stealth')) {
      const stealthScript = buildStealthScript(fullProfile);
      await context.addInitScript(stealthScript);
    }

    // Create page
    const page = await context.newPage();

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
    const { workflowId, workflowName, workflow, cron, profileIds, enabled } = data;

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
          result = await handler(params.profile, params.proxy);
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
          result = await handler(params);
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
        } else {
          // No-arg handlers (listSchedules, getSchedulerStatus, getCronPresets, etc.)
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
  removeExtension,

  // Utilities
  evaluate,
  screenshot,
  getUrl,
  getTitle,
  getDevices,
  getEngines,
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
