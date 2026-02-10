/**
 * Notification Manager
 * Sends notifications via Telegram, Discord, and custom webhooks
 */

const TelegramNotifier = require('./telegram');
const DiscordNotifier = require('./discord');
const WebhookNotifier = require('./webhook');

class NotificationManager {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      channels: config.channels || [],
      events: {
        onStart: config.events?.onStart ?? false,
        onComplete: config.events?.onComplete ?? true,
        onSuccess: config.events?.onSuccess ?? false,
        onFailure: config.events?.onFailure ?? true,
        onRetry: config.events?.onRetry ?? false,
        ...config.events
      }
    };

    this.notifiers = new Map();
    this._initNotifiers();
  }

  /**
   * Initialize notifiers from config
   */
  _initNotifiers() {
    for (const channel of this.config.channels) {
      try {
        let notifier;
        switch (channel.type) {
          case 'telegram':
            notifier = new TelegramNotifier(channel);
            break;
          case 'discord':
            notifier = new DiscordNotifier(channel);
            break;
          case 'webhook':
            notifier = new WebhookNotifier(channel);
            break;
          default:
            console.warn(`[NOTIFY] Unknown channel type: ${channel.type}`);
            continue;
        }
        this.notifiers.set(channel.id || `${channel.type}-${Date.now()}`, notifier);
      } catch (err) {
        console.error(`[NOTIFY] Failed to init ${channel.type}:`, err.message);
      }
    }
  }

  /**
   * Check if event should trigger notification
   */
  shouldNotify(event) {
    if (!this.config.enabled) return false;
    return this.config.events[event] === true;
  }

  /**
   * Send notification to all channels
   */
  async notify(event, data) {
    if (!this.shouldNotify(event)) return;

    const message = this._formatMessage(event, data);
    const promises = [];

    for (const [id, notifier] of this.notifiers) {
      promises.push(
        notifier.send(message, event, data).catch(err => {
          console.error(`[NOTIFY] ${id} failed:`, err.message);
        })
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * Format message based on event type
   */
  _formatMessage(event, data) {
    const timestamp = new Date().toLocaleString();
    const workflowName = data.workflowName || 'Unknown Workflow';

    switch (event) {
      case 'onStart':
        return {
          title: '🚀 Workflow Started',
          text: `**${workflowName}** started at ${timestamp}`,
          fields: [
            { name: 'Total Profiles', value: data.totalProfiles || 0 },
            { name: 'Max Concurrent', value: data.maxConcurrent || 1 }
          ],
          color: 'blue'
        };

      case 'onComplete':
        const duration = this._formatDuration(data.elapsed);
        return {
          title: '✅ Workflow Completed',
          text: `**${workflowName}** completed`,
          fields: [
            { name: 'Completed', value: `${data.completed || 0}/${data.totalProfiles || 0}` },
            { name: 'Failed', value: data.failed || 0 },
            { name: 'Duration', value: duration },
            { name: 'Success Rate', value: `${data.progress || 0}%` }
          ],
          color: data.failed > 0 ? 'yellow' : 'green'
        };

      case 'onSuccess':
        return {
          title: '✓ Profile Success',
          text: `**${data.profileName || data.profileId}** completed successfully`,
          fields: [
            { name: 'Workflow', value: workflowName },
            { name: 'Duration', value: this._formatDuration(data.duration) }
          ],
          color: 'green'
        };

      case 'onFailure':
        return {
          title: '❌ Profile Failed',
          text: `**${data.profileName || data.profileId}** failed`,
          fields: [
            { name: 'Workflow', value: workflowName },
            { name: 'Error', value: data.error || 'Unknown error' },
            { name: 'Retry Count', value: data.retryCount || 0 }
          ],
          color: 'red'
        };

      case 'onRetry':
        return {
          title: '🔄 Retrying Profile',
          text: `**${data.profileName || data.profileId}** will retry`,
          fields: [
            { name: 'Workflow', value: workflowName },
            { name: 'Attempt', value: `${data.retryCount}/${data.maxRetries || 3}` },
            { name: 'Delay', value: `${Math.round((data.delay || 0) / 1000)}s` },
            { name: 'Error', value: data.error || 'Unknown error' }
          ],
          color: 'orange'
        };

      default:
        return {
          title: 'Notification',
          text: JSON.stringify(data),
          color: 'gray'
        };
    }
  }

  /**
   * Format duration in human readable format
   */
  _formatDuration(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Add notification channel
   */
  addChannel(channel) {
    let notifier;
    switch (channel.type) {
      case 'telegram':
        notifier = new TelegramNotifier(channel);
        break;
      case 'discord':
        notifier = new DiscordNotifier(channel);
        break;
      case 'webhook':
        notifier = new WebhookNotifier(channel);
        break;
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }

    const id = channel.id || `${channel.type}-${Date.now()}`;
    this.notifiers.set(id, notifier);
    this.config.channels.push({ ...channel, id });
    return id;
  }

  /**
   * Remove notification channel
   */
  removeChannel(id) {
    this.notifiers.delete(id);
    this.config.channels = this.config.channels.filter(c => c.id !== id);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    if (newConfig.enabled !== undefined) {
      this.config.enabled = newConfig.enabled;
    }
    if (newConfig.events) {
      Object.assign(this.config.events, newConfig.events);
    }
    if (newConfig.channels) {
      this.config.channels = newConfig.channels;
      this.notifiers.clear();
      this._initNotifiers();
    }
  }

  /**
   * Get current config
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Test notification channel
   */
  async testChannel(channelId) {
    const notifier = this.notifiers.get(channelId);
    if (!notifier) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    return notifier.send({
      title: '🔔 Test Notification',
      text: 'This is a test notification from MMO Express',
      fields: [
        { name: 'Status', value: 'Connected' },
        { name: 'Time', value: new Date().toLocaleString() }
      ],
      color: 'blue'
    }, 'test', {});
  }
}

module.exports = NotificationManager;
