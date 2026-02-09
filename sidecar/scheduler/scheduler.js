/**
 * Scheduler Service
 * Manages scheduled workflow executions
 */

const fs = require('fs').promises;
const path = require('path');
const { getNextRun, describeCron, validateCron, CRON_PRESETS } = require('./cronParser');

const SCHEDULES_FILE = path.join(__dirname, '../../data/schedules.json');

class Scheduler {
  constructor(options = {}) {
    this.options = options;
    this.schedules = new Map();
    this.timers = new Map();
    this.running = false;
    this.checkInterval = null;
    this.logger = options.logger || console;
    this.onExecute = options.onExecute || null; // Callback for execution
    this.onScheduleLoaded = options.onScheduleLoaded || null; // Callback when schedule is loaded (to register workflow)
  }

  /**
   * Initialize scheduler - load schedules and start
   */
  async init() {
    await this.loadSchedules();
    this.start();
    this.logger.error('[SCHEDULER] Initialized with', this.schedules.size, 'schedules');
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) return;

    this.running = true;

    // Check every minute for schedules to run
    this.checkInterval = setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000); // Check every minute

    // Run initial check
    this.checkSchedules();

    this.logger.error('[SCHEDULER] Started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.running = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Clear all scheduled timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    this.logger.error('[SCHEDULER] Stopped');
  }

  /**
   * Check schedules and execute due ones
   */
  checkSchedules() {
    const now = new Date();
    now.setSeconds(0);
    now.setMilliseconds(0);

    for (const [id, schedule] of this.schedules) {
      if (!schedule.enabled) continue;

      // Check if it's time to run
      if (schedule.nextRun) {
        const nextRunTime = new Date(schedule.nextRun);
        nextRunTime.setSeconds(0);
        nextRunTime.setMilliseconds(0);

        if (nextRunTime.getTime() === now.getTime()) {
          this.executeSchedule(id);
        }
      }
    }
  }

  /**
   * Execute a schedule
   */
  async executeSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;

    this.logger.error(`[SCHEDULER] Executing schedule: ${schedule.name}`);

    try {
      // Update last run time
      schedule.lastRun = new Date().toISOString();
      schedule.nextRun = getNextRun(schedule.cron)?.toISOString() || null;
      schedule.lastStatus = 'running';

      await this.saveSchedules();

      // Execute via callback if provided
      if (this.onExecute) {
        const result = await this.onExecute(schedule);
        schedule.lastStatus = result.success ? 'success' : 'failed';
        schedule.lastError = result.error || null;
      } else {
        // Emit event for external handling
        schedule.lastStatus = 'pending';
      }

      await this.saveSchedules();

      this.logger.error(`[SCHEDULER] Completed: ${schedule.name} - ${schedule.lastStatus}`);
    } catch (error) {
      schedule.lastStatus = 'failed';
      schedule.lastError = error.message;
      await this.saveSchedules();
      this.logger.error(`[SCHEDULER] Failed: ${schedule.name} - ${error.message}`);
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data) {
    const validation = validateCron(data.cron);
    if (!validation.valid) {
      throw new Error(`Invalid cron expression: ${validation.error}`);
    }

    const id = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const schedule = {
      id,
      name: data.name || 'Unnamed Schedule',
      description: data.description || '',
      workflowId: data.workflowId,
      workflowName: data.workflowName || '',
      workflow: data.workflow || null, // Store full workflow definition for persistence
      profileIds: data.profileIds || [],
      cron: data.cron,
      cronDescription: describeCron(data.cron),
      enabled: data.enabled !== false,
      runOnStart: data.runOnStart || false,
      maxRetries: data.maxRetries || 0,
      timeout: data.timeout || 300000, // 5 minutes default
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      lastStatus: null,
      lastError: null,
      nextRun: getNextRun(data.cron)?.toISOString() || null,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
    };

    this.schedules.set(id, schedule);
    await this.saveSchedules();

    this.logger.error(`[SCHEDULER] Created: ${schedule.name} (${schedule.cronDescription})`);

    return schedule;
  }

  /**
   * Update a schedule
   */
  async updateSchedule(id, data) {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    if (data.cron && data.cron !== schedule.cron) {
      const validation = validateCron(data.cron);
      if (!validation.valid) {
        throw new Error(`Invalid cron expression: ${validation.error}`);
      }
      schedule.cron = data.cron;
      schedule.cronDescription = describeCron(data.cron);
      schedule.nextRun = getNextRun(data.cron)?.toISOString() || null;
    }

    if (data.name !== undefined) schedule.name = data.name;
    if (data.description !== undefined) schedule.description = data.description;
    if (data.workflowId !== undefined) schedule.workflowId = data.workflowId;
    if (data.workflowName !== undefined) schedule.workflowName = data.workflowName;
    if (data.workflow !== undefined) schedule.workflow = data.workflow;
    if (data.profileIds !== undefined) schedule.profileIds = data.profileIds;
    if (data.enabled !== undefined) schedule.enabled = data.enabled;
    if (data.runOnStart !== undefined) schedule.runOnStart = data.runOnStart;
    if (data.maxRetries !== undefined) schedule.maxRetries = data.maxRetries;
    if (data.timeout !== undefined) schedule.timeout = data.timeout;

    schedule.updatedAt = new Date().toISOString();

    await this.saveSchedules();

    this.logger.error(`[SCHEDULER] Updated: ${schedule.name}`);

    return schedule;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id) {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    this.schedules.delete(id);
    await this.saveSchedules();

    this.logger.error(`[SCHEDULER] Deleted: ${schedule.name}`);

    return true;
  }

  /**
   * Get a schedule by ID
   */
  getSchedule(id) {
    return this.schedules.get(id);
  }

  /**
   * List all schedules
   */
  listSchedules() {
    return Array.from(this.schedules.values()).map(s => ({
      ...s,
      cronDescription: describeCron(s.cron),
    }));
  }

  /**
   * Enable a schedule
   */
  async enableSchedule(id) {
    return this.updateSchedule(id, { enabled: true });
  }

  /**
   * Disable a schedule
   */
  async disableSchedule(id) {
    return this.updateSchedule(id, { enabled: false });
  }

  /**
   * Run a schedule immediately (manual trigger)
   */
  async runNow(id) {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    await this.executeSchedule(id);
    return this.schedules.get(id);
  }

  /**
   * Load schedules from file
   */
  async loadSchedules() {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.dirname(SCHEDULES_FILE), { recursive: true });

      const data = await fs.readFile(SCHEDULES_FILE, 'utf-8');
      const schedules = JSON.parse(data);

      this.schedules.clear();
      for (const schedule of schedules) {
        // Recalculate next run time
        schedule.nextRun = getNextRun(schedule.cron)?.toISOString() || null;
        this.schedules.set(schedule.id, schedule);

        // Register workflow if callback provided and workflow is stored
        if (this.onScheduleLoaded && schedule.workflow) {
          try {
            this.onScheduleLoaded(schedule);
          } catch (err) {
            this.logger.error(`[SCHEDULER] Failed to register workflow for ${schedule.name}:`, err.message);
          }
        }
      }

      this.logger.error(`[SCHEDULER] Loaded ${this.schedules.size} schedules`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('[SCHEDULER] Error loading schedules:', error.message);
      }
      // File doesn't exist yet, start with empty
    }
  }

  /**
   * Save schedules to file
   */
  async saveSchedules() {
    try {
      await fs.mkdir(path.dirname(SCHEDULES_FILE), { recursive: true });
      const data = JSON.stringify(Array.from(this.schedules.values()), null, 2);
      await fs.writeFile(SCHEDULES_FILE, data, 'utf-8');
    } catch (error) {
      this.logger.error('[SCHEDULER] Error saving schedules:', error.message);
    }
  }

  /**
   * Get cron presets
   */
  static getPresets() {
    return CRON_PRESETS;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    const now = new Date();
    const upcoming = [];

    for (const schedule of this.schedules.values()) {
      if (schedule.enabled && schedule.nextRun) {
        upcoming.push({
          id: schedule.id,
          name: schedule.name,
          nextRun: schedule.nextRun,
          cronDescription: schedule.cronDescription,
        });
      }
    }

    upcoming.sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun));

    return {
      running: this.running,
      totalSchedules: this.schedules.size,
      enabledSchedules: Array.from(this.schedules.values()).filter(s => s.enabled).length,
      upcomingExecutions: upcoming.slice(0, 5),
      serverTime: now.toISOString(),
    };
  }
}

module.exports = Scheduler;
