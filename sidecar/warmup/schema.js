/**
 * Warm-up Schema & Validation
 * Defines schema for warm-up templates and progress tracking
 */

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

// Supported platforms
const PLATFORMS = ['facebook', 'tiktok', 'instagram', 'google', 'twitter', 'youtube', 'linkedin', 'telegram'];

// Available action types per platform
const PLATFORM_ACTIONS = {
  facebook: ['login', 'scrollFeed', 'like', 'comment', 'post', 'addFriend', 'joinGroup', 'sharePost', 'watchVideo', 'reactStory'],
  tiktok: ['login', 'scrollFeed', 'like', 'comment', 'follow', 'post', 'watchVideo', 'shareVideo', 'duet'],
  instagram: ['login', 'scrollFeed', 'like', 'comment', 'follow', 'post', 'watchReels', 'watchStory', 'sharePost', 'sendDM'],
  google: ['login', 'search', 'browseResults', 'watchYoutube', 'checkGmail', 'useDrive', 'useMaps'],
  twitter: ['login', 'scrollFeed', 'like', 'retweet', 'tweet', 'follow', 'reply', 'bookmark'],
  youtube: ['login', 'watchVideo', 'like', 'comment', 'subscribe', 'addPlaylist', 'searchVideo'],
  linkedin: ['login', 'scrollFeed', 'like', 'comment', 'post', 'connect', 'viewProfile', 'sendMessage'],
  telegram: ['login', 'readMessages', 'sendMessage', 'joinChannel', 'joinGroup', 'reactMessage']
};

// Default action range schema
const DEFAULT_ACTION_RANGE = { min: 0, max: 0 };

/**
 * Create a new warm-up template
 * @param {Object} data - Template data
 * @returns {Object} Validated template
 */
function createWarmupTemplate(data) {
  const now = new Date().toISOString();

  return {
    id: data.id || `warmup-${uuidv4()}`,
    name: data.name || 'New Warm-up Template',
    description: data.description || '',
    platform: validatePlatform(data.platform),
    totalDays: data.totalDays || 21,
    phases: validatePhases(data.phases, data.platform),
    schedule: validateSchedule(data.schedule),
    isDefault: data.isDefault || false,
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

/**
 * Validate platform
 */
function validatePlatform(platform) {
  if (!platform || !PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform: ${platform}. Must be one of: ${PLATFORMS.join(', ')}`);
  }
  return platform;
}

/**
 * Validate phases array
 */
function validatePhases(phases, platform) {
  if (!phases || !Array.isArray(phases) || phases.length === 0) {
    throw new Error('Phases must be a non-empty array');
  }

  return phases.map((phase, index) => {
    if (!phase.name) {
      phase.name = `Phase ${index + 1}`;
    }

    if (!phase.days || !Array.isArray(phase.days) || phase.days.length !== 2) {
      throw new Error(`Phase ${index + 1}: days must be [startDay, endDay] array`);
    }

    if (phase.days[0] > phase.days[1]) {
      throw new Error(`Phase ${index + 1}: startDay must be <= endDay`);
    }

    // Validate dailyActions
    if (!phase.dailyActions || typeof phase.dailyActions !== 'object') {
      throw new Error(`Phase ${index + 1}: dailyActions is required`);
    }

    // Validate each action
    const validActions = PLATFORM_ACTIONS[platform] || [];
    const validatedActions = {};

    for (const [action, range] of Object.entries(phase.dailyActions)) {
      if (action === 'login') {
        validatedActions.login = !!range;
        continue;
      }

      if (!validActions.includes(action)) {
        console.warn(`Unknown action '${action}' for platform '${platform}'`);
      }

      if (typeof range === 'object' && range !== null) {
        validatedActions[action] = {
          min: typeof range.min === 'number' ? range.min : 0,
          max: typeof range.max === 'number' ? range.max : 0
        };
      } else if (typeof range === 'number') {
        validatedActions[action] = { min: range, max: range };
      } else {
        validatedActions[action] = { ...DEFAULT_ACTION_RANGE };
      }
    }

    return {
      name: phase.name,
      days: phase.days,
      dailyActions: validatedActions
    };
  });
}

/**
 * Validate schedule config
 */
function validateSchedule(schedule) {
  const defaultSchedule = {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['09:00', '14:00', '20:00'],
    randomDelay: 30 // minutes
  };

  if (!schedule) {
    return defaultSchedule;
  }

  return {
    timezone: schedule.timezone || defaultSchedule.timezone,
    runAt: Array.isArray(schedule.runAt) ? schedule.runAt : defaultSchedule.runAt,
    randomDelay: typeof schedule.randomDelay === 'number' ? schedule.randomDelay : defaultSchedule.randomDelay
  };
}

/**
 * Create warm-up progress record
 * @param {Object} data - Progress data
 * @returns {Object} Validated progress
 */
function createWarmupProgress(data) {
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  if (!data.warmupId) {
    throw new Error('warmupId is required');
  }
  if (!data.profileId) {
    throw new Error('profileId is required');
  }

  return {
    id: data.id || `progress-${uuidv4()}`,
    warmupId: data.warmupId,
    profileId: data.profileId,
    profileName: data.profileName || '',
    startDate: data.startDate || today,
    currentDay: data.currentDay || 1,
    currentPhase: data.currentPhase || 1,
    status: data.status || 'pending', // pending, running, paused, completed, failed
    dailyLogs: data.dailyLogs || [],
    nextRunAt: data.nextRunAt || null,
    completedAt: data.completedAt || null,
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

/**
 * Create daily log entry
 * @param {number} day - Day number
 * @param {Object} actions - Actions performed
 * @param {string} status - Status (completed, partial, skipped, failed)
 * @returns {Object} Daily log entry
 */
function createDailyLog(day, actions, status = 'completed') {
  const today = new Date().toISOString().split('T')[0];

  return {
    day,
    date: today,
    actions: actions || {},
    status,
    error: null,
    executedAt: new Date().toISOString()
  };
}

/**
 * Get current phase for a given day
 * @param {Array} phases - Phases array
 * @param {number} currentDay - Current day
 * @returns {Object} Current phase or null
 */
function getCurrentPhase(phases, currentDay) {
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (currentDay >= phase.days[0] && currentDay <= phase.days[1]) {
      return { ...phase, index: i + 1 };
    }
  }
  return null;
}

/**
 * Generate random action count within range
 * @param {Object} range - { min, max }
 * @returns {number} Random count
 */
function getRandomActionCount(range) {
  if (!range || typeof range !== 'object') return 0;
  const min = range.min || 0;
  const max = range.max || 0;
  if (min >= max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate next run time
 * @param {Object} schedule - Schedule config
 * @returns {Date} Next run time
 */
function calculateNextRun(schedule) {
  const now = new Date();
  const runTimes = schedule.runAt || ['09:00', '14:00', '20:00'];

  // Find next run time today or tomorrow
  for (const timeStr of runTimes) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const runTime = new Date(now);
    runTime.setHours(hours, minutes, 0, 0);

    // Add random delay
    if (schedule.randomDelay) {
      const delayMs = (Math.random() * 2 - 1) * schedule.randomDelay * 60 * 1000;
      runTime.setTime(runTime.getTime() + delayMs);
    }

    if (runTime > now) {
      return runTime;
    }
  }

  // All times passed, schedule for tomorrow at first time
  const [hours, minutes] = runTimes[0].split(':').map(Number);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);

  if (schedule.randomDelay) {
    const delayMs = (Math.random() * 2 - 1) * schedule.randomDelay * 60 * 1000;
    tomorrow.setTime(tomorrow.getTime() + delayMs);
  }

  return tomorrow;
}

/**
 * Progress status transitions
 */
const STATUS_TRANSITIONS = {
  pending: ['running', 'paused'],
  running: ['paused', 'completed', 'failed'],
  paused: ['running', 'pending'],
  completed: [],
  failed: ['pending', 'running']
};

/**
 * Validate status transition
 */
function canTransitionTo(currentStatus, newStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

module.exports = {
  PLATFORMS,
  PLATFORM_ACTIONS,
  createWarmupTemplate,
  validatePlatform,
  validatePhases,
  validateSchedule,
  createWarmupProgress,
  createDailyLog,
  getCurrentPhase,
  getRandomActionCount,
  calculateNextRun,
  canTransitionTo
};
