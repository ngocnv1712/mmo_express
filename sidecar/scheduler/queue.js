/**
 * Queue Manager
 * Manages profile execution queue with multiple modes
 */

const PRIORITY_ORDER = {
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
  idle: 5
};

class Queue {
  constructor(options = {}) {
    this.mode = options.mode || 'fifo';
    this.items = [];
  }

  /**
   * Add item to queue
   * @param {Object} item - Queue item
   * @param {string} item.id - Unique identifier
   * @param {Object} item.profile - Profile data
   * @param {string} item.priority - Priority level
   */
  add(item) {
    const queueItem = {
      ...item,
      addedAt: Date.now(),
      priority: item.priority || 'normal'
    };

    if (this.mode === 'priority') {
      // Insert in priority order
      const insertIndex = this.items.findIndex(
        existing => PRIORITY_ORDER[existing.priority] > PRIORITY_ORDER[queueItem.priority]
      );
      if (insertIndex === -1) {
        this.items.push(queueItem);
      } else {
        this.items.splice(insertIndex, 0, queueItem);
      }
    } else if (this.mode === 'lifo') {
      // Add to front
      this.items.unshift(queueItem);
    } else {
      // FIFO - add to back
      this.items.push(queueItem);
    }

    return queueItem;
  }

  /**
   * Get next item from queue
   * @returns {Object|null} Next item or null if empty
   */
  next() {
    if (this.isEmpty()) return null;

    switch (this.mode) {
      case 'random':
        const randomIndex = Math.floor(Math.random() * this.items.length);
        return this.items.splice(randomIndex, 1)[0];

      case 'lifo':
        return this.items.shift();

      case 'priority':
      case 'fifo':
      default:
        return this.items.shift();
    }
  }

  /**
   * Peek at next item without removing
   * @returns {Object|null} Next item or null if empty
   */
  peek() {
    if (this.isEmpty()) return null;

    switch (this.mode) {
      case 'random':
        const randomIndex = Math.floor(Math.random() * this.items.length);
        return this.items[randomIndex];

      case 'lifo':
        return this.items[0];

      case 'priority':
      case 'fifo':
      default:
        return this.items[0];
    }
  }

  /**
   * Remove item by ID
   * @param {string} id - Item ID to remove
   * @returns {boolean} True if removed
   */
  remove(id) {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove item by profile ID
   * @param {string} profileId - Profile ID to remove
   * @returns {boolean} True if removed
   */
  removeByProfileId(profileId) {
    const index = this.items.findIndex(item => item.profile?.id === profileId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.items.length === 0;
  }

  /**
   * Get queue size
   * @returns {number}
   */
  size() {
    return this.items.length;
  }

  /**
   * Get all items (copy)
   * @returns {Array}
   */
  getAll() {
    return [...this.items];
  }

  /**
   * Clear queue
   */
  clear() {
    this.items = [];
  }

  /**
   * Set queue mode
   * @param {string} mode - Queue mode (fifo|lifo|random|priority)
   */
  setMode(mode) {
    this.mode = mode;

    // Re-sort if switching to priority mode
    if (mode === 'priority') {
      this.items.sort((a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
    }
  }

  /**
   * Move item to front of queue
   * @param {string} id - Item ID
   * @returns {boolean} True if moved
   */
  moveToFront(id) {
    const index = this.items.findIndex(item => item.id === id);
    if (index > 0) {
      const [item] = this.items.splice(index, 1);
      this.items.unshift(item);
      return true;
    }
    return false;
  }

  /**
   * Move item to back of queue
   * @param {string} id - Item ID
   * @returns {boolean} True if moved
   */
  moveToBack(id) {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1 && index < this.items.length - 1) {
      const [item] = this.items.splice(index, 1);
      this.items.push(item);
      return true;
    }
    return false;
  }

  /**
   * Update item priority
   * @param {string} id - Item ID
   * @param {string} priority - New priority
   * @returns {boolean} True if updated
   */
  updatePriority(id, priority) {
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.priority = priority;

      // Re-sort if in priority mode
      if (this.mode === 'priority') {
        this.items.sort((a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    const byPriority = {};
    for (const item of this.items) {
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    }

    return {
      total: this.items.length,
      mode: this.mode,
      byPriority,
      oldestItem: this.items.length > 0
        ? Date.now() - this.items[this.items.length - 1]?.addedAt
        : 0
    };
  }

  /**
   * Shuffle queue (for random-like behavior in other modes)
   */
  shuffle() {
    for (let i = this.items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
  }

  /**
   * Filter items
   * @param {Function} predicate - Filter function
   * @returns {Array} Filtered items (does not modify queue)
   */
  filter(predicate) {
    return this.items.filter(predicate);
  }

  /**
   * Find item
   * @param {Function} predicate - Find function
   * @returns {Object|undefined}
   */
  find(predicate) {
    return this.items.find(predicate);
  }
}

module.exports = Queue;
