/**
 * Wait Actions
 * Wait for elements, time, navigation, network, text
 */

const wait = {
  /**
   * Wait for element
   */
  'wait-element': {
    name: 'Wait for Element',
    description: 'Wait for an element to appear/disappear',
    icon: '⏱️',
    category: 'wait',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      state: {
        type: 'string',
        default: 'visible',
        options: ['visible', 'hidden', 'attached', 'detached'],
        description: 'Element state',
      },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      await page.waitForSelector(selector, {
        state: config.state || 'visible',
        timeout: config.timeout || 30000,
      });

      return { success: true, selector, state: config.state };
    },
  },

  /**
   * Wait for time
   */
  'wait-time': {
    name: 'Wait for Time',
    description: 'Wait for a specified duration',
    icon: '⏳',
    category: 'wait',
    configSchema: {
      duration: { type: 'number', required: true, description: 'Duration in seconds' },
      randomVariation: { type: 'number', default: 0, description: 'Random variation in seconds' },
    },
    async execute(context, config) {
      const { page } = context;

      let duration = (config.duration || 1) * 1000;

      // Add random variation
      if (config.randomVariation) {
        const variation = config.randomVariation * 1000;
        duration += Math.floor(Math.random() * variation * 2) - variation;
        duration = Math.max(100, duration); // Minimum 100ms
      }

      await page.waitForTimeout(duration);

      return { success: true, duration };
    },
  },

  /**
   * Wait for navigation
   */
  'wait-navigation': {
    name: 'Wait for Navigation',
    description: 'Wait for page navigation to complete',
    icon: '🌐',
    category: 'wait',
    configSchema: {
      waitUntil: {
        type: 'string',
        default: 'load',
        options: ['load', 'domcontentloaded', 'networkidle'],
        description: 'Wait until event',
      },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
    },
    async execute(context, config) {
      const { page } = context;

      await page.waitForLoadState(config.waitUntil || 'load', {
        timeout: config.timeout || 30000,
      });

      return { success: true, waitUntil: config.waitUntil };
    },
  },

  /**
   * Wait for network request
   */
  'wait-network': {
    name: 'Wait for Network',
    description: 'Wait for a specific network request',
    icon: '📡',
    category: 'wait',
    configSchema: {
      urlPattern: { type: 'string', required: true, description: 'URL pattern (glob or regex)' },
      method: {
        type: 'string',
        default: 'any',
        options: ['any', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method',
      },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
      saveResponse: { type: 'string', description: 'Variable name to save response' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const urlPattern = variables.interpolate(config.urlPattern);

      const response = await page.waitForResponse(
        (res) => {
          const urlMatch = res.url().includes(urlPattern) ||
            new RegExp(urlPattern).test(res.url());
          const methodMatch = config.method === 'any' ||
            res.request().method() === config.method;
          return urlMatch && methodMatch;
        },
        { timeout: config.timeout || 30000 }
      );

      // Save response if variable name provided
      if (config.saveResponse) {
        try {
          const data = await response.json();
          variables.store.set(config.saveResponse, data);
        } catch {
          const text = await response.text();
          variables.store.set(config.saveResponse, text);
        }
      }

      return {
        success: true,
        url: response.url(),
        status: response.status(),
      };
    },
  },

  /**
   * Wait for text to appear
   */
  'wait-text': {
    name: 'Wait for Text',
    description: 'Wait for specific text to appear on page',
    icon: '📝',
    category: 'wait',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text to wait for' },
      selector: { type: 'string', description: 'Limit search to selector (optional)' },
      exact: { type: 'boolean', default: false, description: 'Exact match' },
      caseSensitive: { type: 'boolean', default: false, description: 'Case sensitive' },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const text = variables.interpolate(config.text);

      const locator = config.selector
        ? page.locator(config.selector).getByText(text, { exact: config.exact })
        : page.getByText(text, { exact: config.exact });

      await locator.waitFor({
        state: 'visible',
        timeout: config.timeout || 30000,
      });

      return { success: true, text };
    },
  },

  /**
   * Wait for URL to match
   */
  'wait-url': {
    name: 'Wait for URL',
    description: 'Wait for URL to contain or match pattern',
    icon: '🔗',
    category: 'wait',
    configSchema: {
      pattern: { type: 'string', required: true, description: 'URL pattern to match' },
      matchType: {
        type: 'string',
        default: 'contains',
        options: ['contains', 'equals', 'startsWith', 'regex'],
        description: 'Match type',
      },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const pattern = variables.interpolate(config.pattern);

      await page.waitForURL(
        (url) => {
          const urlStr = url.toString();
          switch (config.matchType) {
            case 'equals':
              return urlStr === pattern;
            case 'startsWith':
              return urlStr.startsWith(pattern);
            case 'regex':
              return new RegExp(pattern).test(urlStr);
            default: // contains
              return urlStr.includes(pattern);
          }
        },
        { timeout: config.timeout || 30000 }
      );

      return { success: true, url: page.url() };
    },
  },

  /**
   * Wait for function to return true
   */
  'wait-function': {
    name: 'Wait for Function',
    description: 'Wait for JavaScript function to return true',
    icon: '💻',
    category: 'wait',
    configSchema: {
      expression: { type: 'string', required: true, description: 'JavaScript expression' },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
      pollingInterval: { type: 'number', default: 100, description: 'Polling interval in ms' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const expression = variables.interpolate(config.expression);

      await page.waitForFunction(expression, null, {
        timeout: config.timeout || 30000,
        polling: config.pollingInterval || 100,
      });

      return { success: true, expression };
    },
  },
};

module.exports = wait;
