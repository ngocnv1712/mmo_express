/**
 * Custom Webhook Notifier
 * Sends notifications to custom HTTP endpoints
 */

class WebhookNotifier {
  constructor(config) {
    if (!config.url) {
      throw new Error('Webhook URL is required');
    }

    this.url = config.url;
    this.method = config.method || 'POST';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };
    this.timeout = config.timeout || 10000;
    this.retries = config.retries || 1;
  }

  /**
   * Send notification to webhook
   */
  async send(message, event, data) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      message: {
        title: message.title,
        text: message.text,
        color: message.color,
        fields: message.fields
      },
      data
    };

    let lastError;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.url, {
          method: this.method,
          headers: this.headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Try to parse JSON response, fallback to text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return { success: true, body: await response.text() };

      } catch (err) {
        lastError = err;
        if (attempt < this.retries - 1) {
          await this._sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  /**
   * Test connection
   */
  async test() {
    return this.send({
      title: 'Connection Test',
      text: 'Webhook is working!',
      color: 'green',
      fields: []
    }, 'test', { test: true });
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WebhookNotifier;
