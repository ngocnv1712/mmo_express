/**
 * Notification Manager - Send notifications to Telegram, Discord, and custom webhooks
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'data', 'notifications.json');

class NotificationManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, 'data');
    this.configFile = path.join(this.dataDir, 'notifications.json');

    // Default config
    this.config = {
      enabled: false,
      channels: [],
      events: {
        onStart: false,
        onComplete: true,
        onSuccess: false,
        onFailure: true,
        onRetry: false
      }
    };

    this.loadConfig();
  }

  /**
   * Load config from file
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        this.config = JSON.parse(data);
        console.log('[NOTIFY] Loaded notification config');
      }
    } catch (error) {
      console.error('[NOTIFY] Failed to load config:', error.message);
    }
  }

  /**
   * Save config to file
   */
  saveConfig() {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('[NOTIFY] Failed to save config:', error.message);
    }
  }

  /**
   * Get current config
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      channels: this.config.channels // Preserve channels
    };
    if (newConfig.events) {
      this.config.events = { ...this.config.events, ...newConfig.events };
    }
    this.saveConfig();
    return this.config;
  }

  /**
   * Add a notification channel
   */
  addChannel(channel) {
    const id = `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newChannel = { id, ...channel };
    this.config.channels.push(newChannel);
    this.saveConfig();
    return id;
  }

  /**
   * Remove a notification channel
   */
  removeChannel(channelId) {
    this.config.channels = this.config.channels.filter(c => c.id !== channelId);
    this.saveConfig();
  }

  /**
   * Test a specific channel
   */
  async testChannel(channelId) {
    const channel = this.config.channels.find(c => c.id === channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const testMessage = {
      text: '🔔 MMO Express - Test Notification',
      details: 'This is a test notification from MMO Express.'
    };

    await this.sendToChannel(channel, testMessage);
  }

  /**
   * Send notification for an event
   */
  async notify(event, data) {
    // Check if notifications are enabled
    if (!this.config.enabled) {
      return;
    }

    // Check if this event type is enabled
    if (!this.config.events[event]) {
      return;
    }

    // No channels configured
    if (!this.config.channels.length) {
      return;
    }

    // Format message based on event type
    const message = this.formatMessage(event, data);

    // Send to all channels
    const results = await Promise.allSettled(
      this.config.channels.map(channel => this.sendToChannel(channel, message))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[NOTIFY] Failed to send to channel ${this.config.channels[index].type}:`, result.reason);
      }
    });
  }

  /**
   * Format message based on event type
   */
  formatMessage(event, data) {
    const workflowName = data.workflowName || 'Workflow';
    const timestamp = new Date().toLocaleString('vi-VN');

    switch (event) {
      case 'onStart':
        return {
          title: '🚀 Workflow Started',
          text: `**${workflowName}** has started`,
          fields: [
            { name: 'Profiles', value: data.totalProfiles || 0 },
            { name: 'Time', value: timestamp }
          ],
          color: '#3b82f6' // blue
        };

      case 'onComplete':
        const successRate = data.totalProfiles > 0
          ? Math.round((data.completed / data.totalProfiles) * 100)
          : 0;
        return {
          title: '✅ Workflow Completed',
          text: `**${workflowName}** has finished`,
          fields: [
            { name: 'Completed', value: `${data.completed}/${data.totalProfiles}` },
            { name: 'Failed', value: data.failed || 0 },
            { name: 'Success Rate', value: `${successRate}%` },
            { name: 'Duration', value: this.formatDuration(data.elapsed) },
            { name: 'Time', value: timestamp }
          ],
          color: data.failed > 0 ? '#f59e0b' : '#10b981' // amber/green
        };

      case 'onSuccess':
        return {
          title: '✓ Profile Success',
          text: `Profile **${data.profileName || data.profileId}** completed successfully`,
          fields: [
            { name: 'Workflow', value: workflowName },
            { name: 'Duration', value: this.formatDuration(data.elapsed) },
            { name: 'Time', value: timestamp }
          ],
          color: '#10b981' // green
        };

      case 'onFailure':
        return {
          title: '✗ Profile Failed',
          text: `Profile **${data.profileName || data.profileId}** failed`,
          fields: [
            { name: 'Workflow', value: workflowName },
            { name: 'Error', value: data.error || 'Unknown error' },
            { name: 'Step', value: data.step || 'N/A' },
            { name: 'Time', value: timestamp }
          ],
          color: '#ef4444' // red
        };

      case 'onRetry':
        return {
          title: '🔄 Profile Retry',
          text: `Profile **${data.profileName || data.profileId}** is being retried`,
          fields: [
            { name: 'Workflow', value: workflowName },
            { name: 'Attempt', value: `#${data.retryCount + 1}` },
            { name: 'Reason', value: data.error || 'Previous attempt failed' },
            { name: 'Time', value: timestamp }
          ],
          color: '#f59e0b' // amber
        };

      default:
        return {
          title: '📢 Notification',
          text: JSON.stringify(data),
          color: '#6b7280' // gray
        };
    }
  }

  /**
   * Send message to a specific channel
   */
  async sendToChannel(channel, message) {
    switch (channel.type) {
      case 'telegram':
        return this.sendTelegram(channel, message);
      case 'discord':
        return this.sendDiscord(channel, message);
      case 'webhook':
        return this.sendWebhook(channel, message);
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  /**
   * Send to Telegram
   */
  async sendTelegram(channel, message) {
    const url = `https://api.telegram.org/bot${channel.botToken}/sendMessage`;

    // Format for Telegram (Markdown)
    let text = `*${message.title}*\n\n${message.text}`;
    if (message.fields) {
      text += '\n\n';
      message.fields.forEach(field => {
        text += `• *${field.name}:* ${field.value}\n`;
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channel.chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Telegram API error');
    }

    return response.json();
  }

  /**
   * Send to Discord
   */
  async sendDiscord(channel, message) {
    // Discord embed format
    const embed = {
      title: message.title,
      description: message.text,
      color: parseInt(message.color?.replace('#', '') || 'ffffff', 16),
      fields: message.fields?.map(f => ({
        name: f.name,
        value: String(f.value),
        inline: true
      })) || [],
      timestamp: new Date().toISOString()
    };

    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Discord webhook error');
    }

    return { success: true };
  }

  /**
   * Send to custom webhook
   */
  async sendWebhook(channel, message) {
    const headers = {
      'Content-Type': 'application/json',
      ...(channel.headers || {})
    };

    const response = await fetch(channel.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: message.title,
        message: message.text,
        fields: message.fields,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    return { success: true };
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  formatDuration(ms) {
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
}

module.exports = NotificationManager;
