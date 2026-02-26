/**
 * Parallel Executor
 * Manages concurrent execution of workflows across multiple profiles
 * Uses Single Browser - Multi Context pattern for efficiency
 */

const EventEmitter = require('events');
const Queue = require('./queue');
const RetryManager = require('./retry');
const { setupResourceBlocking, getBlockingSummary } = require('../browser/blocking');

class ParallelExecutor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      maxConcurrent: options.maxConcurrent || 3,
      delayBetween: options.delayBetween || 1000,
      timeout: options.timeout || 300000, // 5 minutes
      stopOnError: options.stopOnError || false,
      queueMode: options.queueMode || 'fifo',
      headless: options.headless || false,
      blocking: options.blocking || {},
      ...options
    };

    this.queue = new Queue({ mode: this.config.queueMode });
    this.retryManager = new RetryManager(options.retry || {});

    // Execution state
    this.running = false;
    this.paused = false;
    this.activeSlots = new Map(); // slotId -> { profileId, context, page, progress }
    this.completed = [];
    this.failed = [];
    this.startTime = null;
    this.browser = null;
    this.workflowExecutor = null;
    this.workflow = null;
  }

  /**
   * Start parallel execution
   * @param {Object} params - Execution parameters
   * @param {Object} params.browser - Playwright browser instance
   * @param {Function} params.workflowExecutor - Workflow executor function
   * @param {Object} params.workflow - Workflow to execute
   * @param {Array} params.profiles - Profiles to run
   * @param {Object} params.options - Additional options
   */
  async start({ browser, workflowExecutor, workflow, profiles, options = {} }) {
    if (this.running) {
      throw new Error('Executor is already running');
    }

    this.browser = browser;
    this.workflowExecutor = workflowExecutor;
    this.workflow = workflow;
    this.running = true;
    this.paused = false;
    this.startTime = Date.now();
    this.completed = [];
    this.failed = [];
    this.activeSlots.clear();

    // Add profiles to queue
    for (const profile of profiles) {
      this.queue.add({
        id: profile.id,
        profile,
        priority: profile.priority || options.priority || 'normal',
        retryCount: 0
      });
    }

    this.emit('start', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      totalProfiles: profiles.length,
      maxConcurrent: this.config.maxConcurrent
    });

    // Start execution loop
    await this._runLoop();

    return this.getStatus();
  }

  /**
   * Main execution loop
   */
  async _runLoop() {
    while (this.running && (!this.queue.isEmpty() || this.activeSlots.size > 0)) {
      // Wait if paused
      while (this.paused && this.running) {
        await this._sleep(500);
      }

      if (!this.running) break;

      // Fill available slots
      while (
        this.activeSlots.size < this.config.maxConcurrent &&
        !this.queue.isEmpty() &&
        !this.paused
      ) {
        const item = this.queue.next();
        if (item) {
          const slotId = `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          this._startSlot(slotId, item);

          // Delay between starts
          if (this.config.delayBetween > 0 && !this.queue.isEmpty()) {
            await this._sleep(this.config.delayBetween);
          }
        }
      }

      // Wait a bit before checking again
      await this._sleep(100);
    }

    this.running = false;

    const status = this.getStatus();
    this.emit('complete', status);

    return status;
  }

  /**
   * Start execution in a slot
   */
  async _startSlot(slotId, item) {
    const { profile } = item;

    this.activeSlots.set(slotId, {
      profileId: profile.id,
      profileName: profile.name,
      context: null,
      page: null,
      progress: 0,
      currentStep: 0,
      totalSteps: this.workflow.steps?.length || 0,
      startTime: Date.now(),
      status: 'starting'
    });

    this.emit('slotStart', { slotId, profile });

    // Run in background
    this._executeInSlot(slotId, item).catch(err => {
      console.error(`[PARALLEL] Slot ${slotId} error:`, err);
    });
  }

  /**
   * Execute workflow in a slot
   */
  async _executeInSlot(slotId, item) {
    const { profile } = item;
    let context = null;
    let page = null;
    let result = null;

    try {
      // Create browser context
      const contextOptions = this._buildContextOptions(profile);
      context = await this.browser.newContext(contextOptions);
      page = await context.newPage();

      // Setup resource blocking if configured
      if (this.config.blocking && Object.values(this.config.blocking).some(v => v)) {
        await setupResourceBlocking(page, this.config.blocking);
      }

      // Update slot state
      const slot = this.activeSlots.get(slotId);
      if (slot) {
        slot.context = context;
        slot.page = page;
        slot.status = 'running';
      }

      // Setup progress tracking
      const progressCallback = (progress) => {
        const slot = this.activeSlots.get(slotId);
        if (slot) {
          slot.progress = progress.percentage || 0;
          slot.currentStep = progress.currentStep || 0;
          slot.totalSteps = progress.totalSteps || slot.totalSteps;
          slot.currentAction = progress.action;
        }
        this.emit('progress', { slotId, profile, ...progress });
      };

      // Execute workflow with timeout
      result = await this._executeWithTimeout(
        () => this.workflowExecutor(this.workflow, {
          page,
          browserContext: context,
          profile,
          onProgress: progressCallback
        }),
        this.config.timeout
      );

      // Success
      this.completed.push({
        profileId: profile.id,
        profileName: profile.name,
        result,
        duration: Date.now() - this.activeSlots.get(slotId)?.startTime
      });

      this.emit('slotSuccess', { slotId, profile, result });

    } catch (error) {
      // Get current step info from slot for detailed error logging
      const slot = this.activeSlots.get(slotId);
      const currentStepIndex = slot?.currentStep || 0;
      const totalSteps = slot?.totalSteps || this.workflow?.steps?.length || 0;
      const currentStepData = this.workflow?.steps?.[currentStepIndex];

      const failedStep = {
        index: currentStepIndex,
        id: currentStepData?.id || '',
        name: currentStepData?.name || '',
        type: currentStepData?.type || ''
      };

      // Format error message with step info
      const detailedError = `[Step ${currentStepIndex + 1}/${totalSteps}: ${failedStep.name || failedStep.id}] ${error.message}`;

      const errorInfo = {
        profileId: profile.id,
        profileName: profile.name,
        error: detailedError,
        originalError: error.message,
        failedStep,
        retryCount: item.retryCount,
        duration: Date.now() - (slot?.startTime || Date.now())
      };

      // Check if should retry
      const shouldRetry = this.retryManager.shouldRetry(error, item.retryCount);

      if (shouldRetry) {
        const delay = this.retryManager.getDelay(item.retryCount);
        item.retryCount++;

        this.emit('slotRetry', { slotId, profile, error: detailedError, failedStep, retryCount: item.retryCount, delay });

        // Re-add to queue after delay
        setTimeout(() => {
          if (this.running) {
            this.queue.add(item);
          }
        }, delay);
      } else {
        this.failed.push(errorInfo);
        this.emit('slotFailure', { slotId, profile, error: detailedError, failedStep });

        if (this.config.stopOnError) {
          this.stop();
        }
      }
    } finally {
      // Cleanup
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }

      this.activeSlots.delete(slotId);
      this.emit('slotEnd', { slotId, profile });
    }
  }

  /**
   * Execute with timeout
   */
  async _executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Build browser context options from profile
   */
  _buildContextOptions(profile) {
    const options = {
      viewport: {
        width: profile.viewportWidth || 1920,
        height: profile.viewportHeight || 1080
      },
      userAgent: profile.userAgent,
      locale: profile.locale || 'en-US',
      timezoneId: profile.timezone || 'America/New_York',
      geolocation: profile.geolocation ? {
        latitude: profile.geolocation.latitude,
        longitude: profile.geolocation.longitude
      } : undefined,
      permissions: profile.permissions || ['geolocation'],
      colorScheme: profile.colorScheme || 'light',
      deviceScaleFactor: profile.deviceScaleFactor || 1,
      isMobile: profile.isMobile || false,
      hasTouch: profile.hasTouch || false,
    };

    // Proxy
    if (profile.proxy) {
      options.proxy = {
        server: `${profile.proxy.type || 'http'}://${profile.proxy.host}:${profile.proxy.port}`,
        username: profile.proxy.username,
        password: profile.proxy.password
      };
    }

    return options;
  }

  /**
   * Pause execution
   */
  pause() {
    this.paused = true;
    this.emit('pause');
  }

  /**
   * Resume execution
   */
  resume() {
    this.paused = false;
    this.emit('resume');
  }

  /**
   * Stop execution
   */
  async stop() {
    this.running = false;
    this.paused = false;

    // Close all active contexts
    for (const [slotId, slot] of this.activeSlots) {
      try {
        if (slot.page) await slot.page.close().catch(() => {});
        if (slot.context) await slot.context.close().catch(() => {});
      } catch (e) {
        // Ignore
      }
    }
    this.activeSlots.clear();

    this.emit('stop');
  }

  /**
   * Skip current profile in a slot
   */
  async skipSlot(slotId) {
    const slot = this.activeSlots.get(slotId);
    if (slot) {
      try {
        if (slot.page) await slot.page.close().catch(() => {});
        if (slot.context) await slot.context.close().catch(() => {});
      } catch (e) {
        // Ignore
      }
      this.activeSlots.delete(slotId);
      this.emit('slotSkipped', { slotId });
    }
  }

  /**
   * Add profiles to queue
   */
  addProfiles(profiles) {
    for (const profile of profiles) {
      this.queue.add({
        id: profile.id,
        profile,
        priority: profile.priority || 'normal',
        retryCount: 0
      });
    }
    this.emit('queueUpdated', { queueSize: this.queue.size() });
  }

  /**
   * Remove profile from queue
   */
  removeFromQueue(profileId) {
    this.queue.remove(profileId);
    this.emit('queueUpdated', { queueSize: this.queue.size() });
  }

  /**
   * Get current status
   */
  getStatus() {
    const totalProfiles = this.completed.length + this.failed.length +
                          this.queue.size() + this.activeSlots.size;
    const completedCount = this.completed.length;
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;

    // Calculate ETA
    let eta = 0;
    if (completedCount > 0 && totalProfiles > completedCount) {
      const avgTime = elapsed / completedCount;
      const remaining = totalProfiles - completedCount;
      eta = avgTime * remaining;
    }

    return {
      running: this.running,
      paused: this.paused,
      totalProfiles,
      completed: this.completed.length,
      failed: this.failed.length,
      queued: this.queue.size(),
      active: this.activeSlots.size,
      progress: totalProfiles > 0 ? Math.round((completedCount / totalProfiles) * 100) : 0,
      elapsed,
      eta,
      slots: Array.from(this.activeSlots.entries()).map(([id, slot]) => ({
        id,
        profileId: slot.profileId,
        profileName: slot.profileName,
        progress: slot.progress,
        currentStep: slot.currentStep,
        totalSteps: slot.totalSteps,
        currentAction: slot.currentAction,
        status: slot.status
      })),
      completedList: this.completed,
      failedList: this.failed,
      queueList: this.queue.getAll().map(item => ({
        id: item.id,
        profileId: item.profile.id,
        profileName: item.profile.name,
        priority: item.priority,
        retryCount: item.retryCount
      }))
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    if (newConfig.queueMode) {
      this.queue.setMode(newConfig.queueMode);
    }
    if (newConfig.retry) {
      this.retryManager.updateConfig(newConfig.retry);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ParallelExecutor;
