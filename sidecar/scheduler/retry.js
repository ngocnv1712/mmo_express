/**
 * Retry Manager
 * Handles retry logic with different strategies
 */

// Error types that can be retried
const RETRYABLE_ERRORS = [
  'timeout',
  'TimeoutError',
  'network_error',
  'NetworkError',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'element_not_found',
  'ElementNotFound',
  'Navigation timeout',
  'net::ERR_',
  'Target closed',
  'Session closed',
  'Context destroyed'
];

class RetryManager {
  constructor(options = {}) {
    this.config = {
      maxRetries: options.maxRetries ?? 3,
      strategy: options.strategy || 'exponential',
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 60000,
      retryOn: options.retryOn || RETRYABLE_ERRORS,
      jitter: options.jitter ?? true, // Add randomness to prevent thundering herd
      ...options
    };
  }

  /**
   * Check if error should be retried
   * @param {Error|string} error - The error
   * @param {number} currentRetryCount - Current retry count
   * @returns {boolean}
   */
  shouldRetry(error, currentRetryCount) {
    // Check max retries
    if (currentRetryCount >= this.config.maxRetries) {
      return false;
    }

    // Check if strategy is 'none'
    if (this.config.strategy === 'none') {
      return false;
    }

    // Check if error is retryable
    const errorMessage = error?.message || String(error);
    return this.isRetryableError(errorMessage);
  }

  /**
   * Check if error message indicates a retryable error
   * @param {string} errorMessage - Error message
   * @returns {boolean}
   */
  isRetryableError(errorMessage) {
    return this.config.retryOn.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(errorMessage);
      }
      return errorMessage.toLowerCase().includes(pattern.toLowerCase());
    });
  }

  /**
   * Calculate delay for retry attempt
   * @param {number} retryCount - Current retry count (0-based)
   * @returns {number} Delay in milliseconds
   */
  getDelay(retryCount) {
    let delay;

    switch (this.config.strategy) {
      case 'none':
        return 0;

      case 'fixed':
        delay = this.config.baseDelay;
        break;

      case 'linear':
        delay = this.config.baseDelay * (retryCount + 1);
        break;

      case 'exponential':
      default:
        delay = this.config.baseDelay * Math.pow(2, retryCount);
        break;
    }

    // Apply max delay cap
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter (±20%)
    if (this.config.jitter) {
      const jitterRange = delay * 0.2;
      delay += (Math.random() * jitterRange * 2) - jitterRange;
    }

    return Math.round(delay);
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Options
   * @param {Function} options.onRetry - Callback on retry
   * @param {Function} options.onError - Callback on error (before retry check)
   * @returns {Promise<*>} Result of function
   */
  async execute(fn, options = {}) {
    let lastError;
    let retryCount = 0;

    while (retryCount <= this.config.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (options.onError) {
          options.onError(error, retryCount);
        }

        if (!this.shouldRetry(error, retryCount)) {
          throw error;
        }

        const delay = this.getDelay(retryCount);

        if (options.onRetry) {
          options.onRetry({
            error,
            retryCount: retryCount + 1,
            maxRetries: this.config.maxRetries,
            delay
          });
        }

        await this._sleep(delay);
        retryCount++;
      }
    }

    throw lastError;
  }

  /**
   * Create a retryable wrapper for a function
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Options for retry
   * @returns {Function} Wrapped function
   */
  wrap(fn, options = {}) {
    return (...args) => this.execute(() => fn(...args), options);
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get retry info for display
   * @param {number} retryCount - Current retry count
   * @returns {Object}
   */
  getRetryInfo(retryCount) {
    const delays = [];
    for (let i = 0; i < this.config.maxRetries; i++) {
      delays.push(this.getDelay(i));
    }

    return {
      currentRetry: retryCount,
      maxRetries: this.config.maxRetries,
      strategy: this.config.strategy,
      nextDelay: retryCount < this.config.maxRetries ? this.getDelay(retryCount) : null,
      allDelays: delays,
      willRetry: retryCount < this.config.maxRetries
    };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Preset configurations
RetryManager.PRESETS = {
  aggressive: {
    maxRetries: 5,
    strategy: 'exponential',
    baseDelay: 500,
    maxDelay: 30000
  },
  standard: {
    maxRetries: 3,
    strategy: 'exponential',
    baseDelay: 1000,
    maxDelay: 60000
  },
  conservative: {
    maxRetries: 2,
    strategy: 'linear',
    baseDelay: 2000,
    maxDelay: 120000
  },
  none: {
    maxRetries: 0,
    strategy: 'none'
  }
};

module.exports = RetryManager;
