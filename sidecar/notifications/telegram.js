/**
 * Telegram Notifier
 * Sends notifications via Telegram Bot API
 */

class TelegramNotifier {
  constructor(config) {
    if (!config.botToken) {
      throw new Error('Telegram bot token is required');
    }
    if (!config.chatId) {
      throw new Error('Telegram chat ID is required');
    }

    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.parseMode = config.parseMode || 'Markdown';
    this.disableNotification = config.disableNotification || false;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send notification to Telegram
   */
  async send(message, event, data) {
    const text = this._formatMessage(message);

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: this.parseMode,
        disable_notification: this.disableNotification,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Telegram API error: ${error.description || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Format message for Telegram
   */
  _formatMessage(message) {
    const emoji = this._getEmoji(message.color);
    let text = `${emoji} *${message.title}*\n\n`;
    text += `${message.text}\n`;

    if (message.fields && message.fields.length > 0) {
      text += '\n';
      for (const field of message.fields) {
        text += `• *${field.name}:* ${field.value}\n`;
      }
    }

    return text;
  }

  /**
   * Get emoji based on color
   */
  _getEmoji(color) {
    const emojis = {
      blue: '🔵',
      green: '🟢',
      yellow: '🟡',
      orange: '🟠',
      red: '🔴',
      gray: '⚪'
    };
    return emojis[color] || '';
  }

  /**
   * Test connection
   */
  async test() {
    const response = await fetch(`${this.baseUrl}/getMe`);
    if (!response.ok) {
      throw new Error('Invalid bot token');
    }
    return response.json();
  }
}

module.exports = TelegramNotifier;
