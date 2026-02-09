/**
 * Advanced Actions
 * JavaScript execution, HTTP requests, Random values, Notifications
 */

const https = require('https');
const http = require('http');

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json: () => JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json: () => data,
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

const advanced = {
  /**
   * Execute JavaScript in page
   */
  javascript: {
    name: 'Execute JavaScript',
    description: 'Run JavaScript code in the page',
    icon: '💻',
    category: 'advanced',
    configSchema: {
      code: { type: 'string', required: true, description: 'JavaScript code to execute' },
      saveAs: { type: 'string', description: 'Variable name to save result' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const code = variables.interpolate(config.code);

      const result = await page.evaluate(code);

      if (config.saveAs) {
        variables.store.set(config.saveAs, result);
      }

      return { success: true, result, variable: config.saveAs };
    },
  },

  /**
   * HTTP Request
   */
  'http-request': {
    name: 'HTTP Request',
    description: 'Make an HTTP request',
    icon: '🌐',
    category: 'advanced',
    configSchema: {
      url: { type: 'string', required: true, description: 'URL' },
      method: {
        type: 'string',
        default: 'GET',
        options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method',
      },
      headers: { type: 'object', description: 'Request headers (JSON)' },
      body: { type: 'string', description: 'Request body' },
      saveAs: { type: 'string', description: 'Variable name for response' },
      saveStatusAs: { type: 'string', description: 'Variable name for status code' },
    },
    async execute(context, config) {
      const { variables } = context;

      const url = variables.interpolate(config.url);
      const body = config.body ? variables.interpolate(config.body) : undefined;
      const headers = config.headers
        ? variables.interpolateObject(config.headers)
        : {};

      const response = await makeRequest(url, {
        method: config.method || 'GET',
        headers,
        body,
      });

      if (config.saveAs) {
        try {
          variables.store.set(config.saveAs, response.json());
        } catch {
          variables.store.set(config.saveAs, response.body);
        }
      }

      if (config.saveStatusAs) {
        variables.store.set(config.saveStatusAs, response.status);
      }

      return {
        success: true,
        status: response.status,
        variable: config.saveAs,
      };
    },
  },

  /**
   * Generate random value
   */
  random: {
    name: 'Random',
    description: 'Generate a random value',
    icon: '🎰',
    category: 'advanced',
    configSchema: {
      type: {
        type: 'string',
        required: true,
        options: ['number', 'string', 'choice', 'uuid'],
        description: 'Random type',
      },
      min: { type: 'number', default: 0, description: 'Min value (for number)' },
      max: { type: 'number', default: 100, description: 'Max value (for number)' },
      length: { type: 'number', default: 10, description: 'String length' },
      characters: {
        type: 'string',
        default: 'alphanumeric',
        options: ['alphanumeric', 'alpha', 'numeric', 'hex'],
        description: 'Character set',
      },
      choices: { type: 'string', description: 'Comma-separated list of choices' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;
      let value;

      switch (config.type) {
        case 'number': {
          const min = config.min ?? 0;
          const max = config.max ?? 100;
          value = Math.floor(Math.random() * (max - min + 1)) + min;
          break;
        }

        case 'string': {
          const length = config.length || 10;
          const charSets = {
            alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numeric: '0123456789',
            hex: '0123456789abcdef',
          };
          const chars = charSets[config.characters] || charSets.alphanumeric;
          value = '';
          for (let i = 0; i < length; i++) {
            value += chars[Math.floor(Math.random() * chars.length)];
          }
          break;
        }

        case 'choice': {
          const choices = variables.interpolate(config.choices)
            .split(',')
            .map(c => c.trim())
            .filter(c => c);
          value = choices[Math.floor(Math.random() * choices.length)];
          break;
        }

        case 'uuid': {
          value = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          break;
        }
      }

      variables.store.set(config.saveAs, value);

      return { success: true, value, variable: config.saveAs };
    },
  },

  /**
   * Clipboard operations
   */
  clipboard: {
    name: 'Clipboard',
    description: 'Copy or paste text',
    icon: '📋',
    category: 'advanced',
    configSchema: {
      action: {
        type: 'string',
        required: true,
        options: ['copy', 'paste'],
        description: 'Action',
      },
      text: { type: 'string', description: 'Text to copy (for copy)' },
      saveAs: { type: 'string', description: 'Variable name (for paste)' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      if (config.action === 'copy') {
        const text = variables.interpolate(config.text);
        await page.evaluate((t) => navigator.clipboard.writeText(t), text);
        return { success: true, action: 'copy', text };
      } else {
        const text = await page.evaluate(() => navigator.clipboard.readText());
        if (config.saveAs) {
          variables.store.set(config.saveAs, text);
        }
        return { success: true, action: 'paste', text, variable: config.saveAs };
      }
    },
  },

  /**
   * Dialog handling
   */
  dialog: {
    name: 'Handle Dialog',
    description: 'Configure how to handle dialogs (alert, confirm, prompt)',
    icon: '💬',
    category: 'advanced',
    configSchema: {
      action: {
        type: 'string',
        required: true,
        options: ['accept', 'dismiss'],
        description: 'Action for dialogs',
      },
      promptText: { type: 'string', description: 'Text for prompt dialogs' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      const handler = async (dialog) => {
        if (config.action === 'accept') {
          const text = config.promptText ? variables.interpolate(config.promptText) : undefined;
          await dialog.accept(text);
        } else {
          await dialog.dismiss();
        }
      };

      page.on('dialog', handler);

      // Store handler for cleanup
      if (!context.dialogHandlers) {
        context.dialogHandlers = [];
      }
      context.dialogHandlers.push(handler);

      return { success: true, action: config.action };
    },
  },

  /**
   * Wait for download
   */
  download: {
    name: 'Wait for Download',
    description: 'Wait for and save a download',
    icon: '📥',
    category: 'advanced',
    configSchema: {
      triggerSelector: { type: 'string', description: 'Selector to click to trigger download' },
      savePath: { type: 'string', required: true, description: 'Path to save file' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const path = require('path');

      let savePath = variables.interpolate(config.savePath);
      if (!path.isAbsolute(savePath) && context.outputDir) {
        savePath = path.join(context.outputDir, savePath);
      }

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: config.timeout || 30000 }),
        config.triggerSelector
          ? page.click(variables.interpolate(config.triggerSelector))
          : Promise.resolve(),
      ]);

      await download.saveAs(savePath);

      return {
        success: true,
        path: savePath,
        suggestedFilename: download.suggestedFilename(),
      };
    },
  },

  /**
   * Send notification (placeholder for external integrations)
   */
  notification: {
    name: 'Send Notification',
    description: 'Send a notification',
    icon: '🔔',
    category: 'advanced',
    configSchema: {
      type: {
        type: 'string',
        default: 'console',
        options: ['console', 'webhook'],
        description: 'Notification type',
      },
      title: { type: 'string', description: 'Notification title' },
      message: { type: 'string', required: true, description: 'Message' },
      webhookUrl: { type: 'string', description: 'Webhook URL (for webhook type)' },
    },
    async execute(context, config) {
      const { variables } = context;

      const title = config.title ? variables.interpolate(config.title) : '';
      const message = variables.interpolate(config.message);

      if (config.type === 'webhook' && config.webhookUrl) {
        const url = variables.interpolate(config.webhookUrl);
        await makeRequest(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, message, timestamp: Date.now() }),
        });
        return { success: true, type: 'webhook' };
      } else {
        console.error(`[NOTIFICATION] ${title ? title + ': ' : ''}${message}`);
        return { success: true, type: 'console' };
      }
    },
  },

  /**
   * Delay with progress
   */
  'smart-delay': {
    name: 'Smart Delay',
    description: 'Wait with random variation and activity simulation',
    icon: '⏰',
    category: 'advanced',
    configSchema: {
      duration: { type: 'number', required: true, description: 'Base duration in seconds' },
      variation: { type: 'number', default: 20, description: 'Random variation (%)' },
      simulateActivity: { type: 'boolean', default: false, description: 'Simulate mouse/scroll' },
    },
    async execute(context, config) {
      const { page } = context;

      const baseDuration = (config.duration || 1) * 1000;
      const variation = (config.variation || 20) / 100;
      const actualDuration = baseDuration * (1 - variation + Math.random() * variation * 2);

      if (config.simulateActivity) {
        const startTime = Date.now();
        while (Date.now() - startTime < actualDuration) {
          // Random mouse movement
          const x = Math.floor(Math.random() * 800) + 100;
          const y = Math.floor(Math.random() * 600) + 100;
          await page.mouse.move(x, y, { steps: 5 });

          // Occasional scroll
          if (Math.random() < 0.3) {
            await page.evaluate(() => window.scrollBy(0, (Math.random() - 0.5) * 100));
          }

          await page.waitForTimeout(500 + Math.random() * 1000);
        }
      } else {
        await page.waitForTimeout(actualDuration);
      }

      return { success: true, duration: actualDuration };
    },
  },

  /**
   * Assert condition (throws if false)
   */
  assert: {
    name: 'Assert',
    description: 'Assert a condition is true',
    icon: '✅',
    category: 'advanced',
    configSchema: {
      condition: { type: 'string', required: true, description: 'Condition expression' },
      message: { type: 'string', default: 'Assertion failed', description: 'Error message' },
    },
    async execute(context, config) {
      const { variables } = context;

      const result = variables.evaluate(config.condition);

      if (!result) {
        const message = variables.interpolate(config.message);
        throw new Error(message);
      }

      return { success: true, condition: config.condition };
    },
  },

  /**
   * Get page HTML
   */
  'get-html': {
    name: 'Get HTML',
    description: 'Get page or element HTML',
    icon: '📄',
    category: 'advanced',
    configSchema: {
      selector: { type: 'string', description: 'Element selector (optional, gets full page if empty)' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
      outer: { type: 'boolean', default: true, description: 'Include element itself (outerHTML)' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      let html;
      if (config.selector) {
        const selector = variables.interpolate(config.selector);
        if (config.outer) {
          html = await page.$eval(selector, el => el.outerHTML);
        } else {
          html = await page.$eval(selector, el => el.innerHTML);
        }
      } else {
        html = await page.content();
      }

      variables.store.set(config.saveAs, html);

      return { success: true, length: html.length, variable: config.saveAs };
    },
  },
};

module.exports = advanced;
