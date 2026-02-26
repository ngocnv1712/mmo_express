/**
 * Warm-up Scheduler
 * Manages scheduling and execution of warm-up sessions
 */

const EventEmitter = require('events');
const { calculateNextRun, getCurrentPhase } = require('./schema');
const WarmupExecutor = require('./executor');

class WarmupScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      checkInterval: options.checkInterval || 60000, // Check every minute
      ...options
    };

    this.db = options.db; // Database instance
    this.browserManager = options.browserManager; // Browser manager
    this.executor = new WarmupExecutor(options.executor);

    this.running = false;
    this.checkTimer = null;
    this.activeExecutions = new Map(); // progressId -> execution state
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) return;

    this.running = true;
    console.log('[WARMUP-SCHEDULER] Started');

    // Initial check
    this._checkPendingWarmups();

    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      this._checkPendingWarmups();
    }, this.options.checkInterval);

    this.emit('started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.running) return;

    this.running = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Stop all active executions
    for (const [progressId, execution] of this.activeExecutions) {
      execution.cancelled = true;
    }
    this.activeExecutions.clear();

    console.log('[WARMUP-SCHEDULER] Stopped');
    this.emit('stopped');
  }

  /**
   * Check for pending warmups that need to run
   */
  async _checkPendingWarmups() {
    if (!this.db) return;

    try {
      const now = new Date();
      const pendingWarmups = this.db.getActiveWarmups();

      for (const progress of pendingWarmups) {
        // Skip if already running
        if (this.activeExecutions.has(progress.id)) continue;

        // Check if it's time to run
        if (progress.nextRunAt && new Date(progress.nextRunAt) <= now) {
          // Start warmup execution
          this._executeWarmup(progress);
        }
      }
    } catch (error) {
      console.error('[WARMUP-SCHEDULER] Check error:', error);
    }
  }

  /**
   * Execute warmup for a progress record
   */
  async _executeWarmup(progress) {
    if (!this.browserManager) {
      console.error('[WARMUP-SCHEDULER] No browser manager available');
      return;
    }

    const executionState = {
      progressId: progress.id,
      cancelled: false,
      startedAt: new Date()
    };

    this.activeExecutions.set(progress.id, executionState);

    try {
      // Get template
      const template = this.db.getWarmupTemplate(progress.warmupId);
      if (!template) {
        throw new Error(`Template not found: ${progress.warmupId}`);
      }

      // Update status to running
      this.db.updateWarmupProgressStatus(progress.id, 'running');
      this.emit('warmupStarted', { progress, template });

      // Get profile
      const profile = await this._getProfile(progress.profileId);
      if (!profile) {
        throw new Error(`Profile not found: ${progress.profileId}`);
      }

      // Launch browser context
      const { context, page } = await this.browserManager.createContext(profile);

      try {
        // Execute daily warmup
        const dailyLog = await this.executor.executeDailyWarmup({
          page,
          context,
          template,
          progress,
          onProgress: (data) => {
            if (executionState.cancelled) {
              throw new Error('Execution cancelled');
            }
            this.emit('actionProgress', { progressId: progress.id, ...data });
          }
        });

        // Update progress
        const newProgress = this._advanceProgress(progress, template, dailyLog);
        this.db.updateWarmupProgress(newProgress);

        this.emit('warmupCompleted', { progress: newProgress, dailyLog });

      } finally {
        // Cleanup
        try {
          await page.close();
          await context.close();
        } catch (e) {}
      }

    } catch (error) {
      console.error('[WARMUP-SCHEDULER] Execution error:', error);

      // Update progress with error
      this.db.updateWarmupProgressStatus(progress.id, 'failed', error.message);
      this.emit('warmupFailed', { progressId: progress.id, error: error.message });

    } finally {
      this.activeExecutions.delete(progress.id);
    }
  }

  /**
   * Advance progress to next day/phase
   */
  _advanceProgress(progress, template, dailyLog) {
    const currentDay = progress.currentDay;
    const totalDays = template.totalDays;

    // Add daily log
    const dailyLogs = [...(progress.dailyLogs || []), dailyLog];

    // Check if warmup is complete
    if (currentDay >= totalDays) {
      return {
        ...progress,
        currentDay: totalDays,
        status: 'completed',
        dailyLogs,
        completedAt: new Date().toISOString(),
        nextRunAt: null,
        updatedAt: new Date().toISOString()
      };
    }

    // Advance to next day
    const nextDay = currentDay + 1;
    const nextPhase = getCurrentPhase(template.phases, nextDay);
    const nextRun = calculateNextRun(template.schedule);

    return {
      ...progress,
      currentDay: nextDay,
      currentPhase: nextPhase?.index || progress.currentPhase,
      status: 'running',
      dailyLogs,
      nextRunAt: nextRun.toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get profile from main database
   */
  async _getProfile(profileId) {
    // This would be implemented to fetch profile from the main profiles database
    // For now, return a placeholder
    if (this.options.getProfile) {
      return this.options.getProfile(profileId);
    }
    return null;
  }

  /**
   * Start warmup for profiles
   * @param {string} templateId - Template ID
   * @param {Array} profileIds - Array of profile IDs
   */
  async startWarmup(templateId, profileIds) {
    const template = this.db.getWarmupTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const results = [];
    const now = new Date();
    const firstRun = calculateNextRun(template.schedule);

    for (const profileId of profileIds) {
      // Check if profile already has an active warmup for this template
      const existing = this.db.getWarmupsByProfile(profileId);
      const hasActive = existing.some(p =>
        p.warmupId === templateId &&
        ['pending', 'running', 'paused'].includes(p.status)
      );

      if (hasActive) {
        console.log(`[WARMUP-SCHEDULER] Profile ${profileId} already has active warmup for template ${templateId}`);
        continue;
      }

      // Create progress record
      const progress = this.db.createWarmupProgress({
        warmupId: templateId,
        profileId,
        profileName: '', // Will be filled when profile is fetched
        startDate: now.toISOString().split('T')[0],
        currentDay: 1,
        currentPhase: 1,
        status: 'pending',
        dailyLogs: [],
        nextRunAt: firstRun.toISOString()
      });

      results.push(progress);
      this.emit('warmupCreated', { progress, template });
    }

    return results;
  }

  /**
   * Pause a warmup
   */
  pauseWarmup(progressId) {
    const execution = this.activeExecutions.get(progressId);
    if (execution) {
      execution.cancelled = true;
    }

    this.db.updateWarmupProgressStatus(progressId, 'paused');
    this.emit('warmupPaused', { progressId });
  }

  /**
   * Resume a paused warmup
   */
  resumeWarmup(progressId) {
    const progress = this.db.getWarmupProgress(progressId);
    if (!progress) return;

    const template = this.db.getWarmupTemplate(progress.warmupId);
    if (!template) return;

    const nextRun = calculateNextRun(template.schedule);

    this.db.updateWarmupProgress({
      ...progress,
      status: 'running',
      nextRunAt: nextRun.toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.emit('warmupResumed', { progressId });
  }

  /**
   * Stop a warmup completely
   */
  stopWarmup(progressId) {
    const execution = this.activeExecutions.get(progressId);
    if (execution) {
      execution.cancelled = true;
      this.activeExecutions.delete(progressId);
    }

    this.db.updateWarmupProgressStatus(progressId, 'failed', 'Stopped by user');
    this.emit('warmupStopped', { progressId });
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.running,
      activeExecutions: this.activeExecutions.size,
      executions: Array.from(this.activeExecutions.entries()).map(([id, state]) => ({
        progressId: id,
        startedAt: state.startedAt
      }))
    };
  }
}

module.exports = WarmupScheduler;
