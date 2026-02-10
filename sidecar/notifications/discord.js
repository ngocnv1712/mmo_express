/**
 * Discord Notifier
 * Sends notifications via Discord Webhook
 */

class DiscordNotifier {
  constructor(config) {
    if (!config.webhookUrl) {
      throw new Error('Discord webhook URL is required');
    }

    this.webhookUrl = config.webhookUrl;
    this.username = config.username || 'MMO Express';
    this.avatarUrl = config.avatarUrl || null;
  }

  /**
   * Send notification to Discord
   */
  async send(message, event, data) {
    const embed = this._formatEmbed(message);

    const payload = {
      username: this.username,
      embeds: [embed]
    };

    if (this.avatarUrl) {
      payload.avatar_url = this.avatarUrl;
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${error || response.statusText}`);
    }

    // Discord returns 204 No Content on success
    return { success: true };
  }

  /**
   * Format message as Discord embed
   */
  _formatEmbed(message) {
    const embed = {
      title: message.title,
      description: message.text,
      color: this._getColor(message.color),
      timestamp: new Date().toISOString(),
      footer: {
        text: 'MMO Express'
      }
    };

    if (message.fields && message.fields.length > 0) {
      embed.fields = message.fields.map(field => ({
        name: field.name,
        value: String(field.value),
        inline: true
      }));
    }

    return embed;
  }

  /**
   * Get Discord color code
   */
  _getColor(color) {
    const colors = {
      blue: 0x3498db,
      green: 0x2ecc71,
      yellow: 0xf1c40f,
      orange: 0xe67e22,
      red: 0xe74c3c,
      gray: 0x95a5a6
    };
    return colors[color] || 0x7289da;
  }

  /**
   * Test connection
   */
  async test() {
    // Send a test message
    return this.send({
      title: 'Connection Test',
      text: 'Discord webhook is working!',
      color: 'green'
    }, 'test', {});
  }
}

module.exports = DiscordNotifier;
