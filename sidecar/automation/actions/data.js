/**
 * Data Actions
 * Get text, attributes, set variables, screenshots, cookies
 */

const path = require('path');

const data = {
  /**
   * Get text from element
   */
  'get-text': {
    name: 'Get Text',
    description: 'Extract text content from an element',
    icon: '📖',
    category: 'data',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      saveAs: { type: 'string', required: true, description: 'Variable name to save result' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      const text = await page.textContent(selector, { timeout: config.timeout || 30000 });
      variables.store.set(config.saveAs, text?.trim() || '');

      return { success: true, text: text?.trim(), variable: config.saveAs };
    },
  },

  /**
   * Get attribute from element
   */
  'get-attribute': {
    name: 'Get Attribute',
    description: 'Get an attribute value from an element',
    icon: '🔗',
    category: 'data',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      attribute: { type: 'string', required: true, description: 'Attribute name' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      const value = await page.getAttribute(selector, config.attribute, {
        timeout: config.timeout || 30000,
      });
      variables.store.set(config.saveAs, value || '');

      return { success: true, attribute: config.attribute, value, variable: config.saveAs };
    },
  },

  /**
   * Get current URL
   */
  'get-url': {
    name: 'Get URL',
    description: 'Get the current page URL',
    icon: '🌐',
    category: 'data',
    configSchema: {
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      const url = page.url();
      variables.store.set(config.saveAs, url);

      return { success: true, url, variable: config.saveAs };
    },
  },

  /**
   * Get page title
   */
  'get-title': {
    name: 'Get Title',
    description: 'Get the current page title',
    icon: '📄',
    category: 'data',
    configSchema: {
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      const title = await page.title();
      variables.store.set(config.saveAs, title);

      return { success: true, title, variable: config.saveAs };
    },
  },

  /**
   * Count elements
   */
  'count-elements': {
    name: 'Count Elements',
    description: 'Count matching elements',
    icon: '📊',
    category: 'data',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      const count = await page.locator(selector).count();
      variables.store.set(config.saveAs, count);

      return { success: true, count, variable: config.saveAs };
    },
  },

  /**
   * Set variable
   */
  'set-variable': {
    name: 'Set Variable',
    description: 'Set a variable value',
    icon: '💾',
    category: 'data',
    configSchema: {
      name: { type: 'string', required: true, description: 'Variable name' },
      value: { type: 'string', required: true, description: 'Value (supports interpolation)' },
      type: {
        type: 'string',
        default: 'string',
        options: ['string', 'number', 'boolean', 'json'],
        description: 'Value type',
      },
    },
    async execute(context, config) {
      const { variables } = context;

      let value = variables.interpolate(config.value);

      // Convert type
      switch (config.type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true' || value === '1' || value === true;
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string if invalid JSON
          }
          break;
      }

      variables.store.set(config.name, value);

      return { success: true, variable: config.name, value };
    },
  },

  /**
   * Calculate expression
   */
  calculate: {
    name: 'Calculate',
    description: 'Evaluate an expression and save result',
    icon: '🧮',
    category: 'data',
    configSchema: {
      expression: { type: 'string', required: true, description: 'Expression (e.g., {{count}} + 1)' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const result = variables.evaluate(config.expression);
      variables.store.set(config.saveAs, result);

      return { success: true, expression: config.expression, result, variable: config.saveAs };
    },
  },

  /**
   * Take screenshot
   */
  screenshot: {
    name: 'Screenshot',
    description: 'Take a screenshot',
    icon: '📸',
    category: 'data',
    configSchema: {
      filename: { type: 'string', required: true, description: 'Filename (supports variables)' },
      type: {
        type: 'string',
        default: 'visible',
        options: ['visible', 'fullPage', 'element'],
        description: 'Screenshot type',
      },
      selector: { type: 'string', description: 'Element selector (for element type)' },
      quality: { type: 'number', default: 80, description: 'JPEG quality (1-100)' },
    },
    async execute(context, config) {
      const { page, variables, outputDir } = context;

      let filename = variables.interpolate(config.filename);
      if (!path.isAbsolute(filename) && outputDir) {
        filename = path.join(outputDir, filename);
      }

      const options = {
        path: filename,
        type: filename.endsWith('.png') ? 'png' : 'jpeg',
      };

      if (options.type === 'jpeg') {
        options.quality = config.quality || 80;
      }

      if (config.type === 'fullPage') {
        options.fullPage = true;
      } else if (config.type === 'element' && config.selector) {
        const selector = variables.interpolate(config.selector);
        await page.locator(selector).screenshot(options);
        return { success: true, path: filename, type: 'element' };
      }

      await page.screenshot(options);

      return { success: true, path: filename, type: config.type };
    },
  },

  /**
   * Export cookies
   */
  'export-cookies': {
    name: 'Export Cookies',
    description: 'Export cookies to file',
    icon: '🍪',
    category: 'data',
    configSchema: {
      filename: { type: 'string', required: true, description: 'Filename' },
      format: {
        type: 'string',
        default: 'json',
        options: ['json', 'netscape'],
        description: 'Export format',
      },
    },
    async execute(context, config) {
      const { browserContext, variables, outputDir } = context;
      const fs = require('fs');
      const cookieManager = require('../../cookie/manager');

      let filename = variables.interpolate(config.filename);
      if (!path.isAbsolute(filename) && outputDir) {
        filename = path.join(outputDir, filename);
      }

      const cookies = await browserContext.cookies();
      let content;

      if (config.format === 'netscape') {
        content = cookieManager.exportNetscape(cookies);
      } else {
        content = cookieManager.exportJSON(cookies);
      }

      fs.writeFileSync(filename, content);

      return { success: true, path: filename, count: cookies.length };
    },
  },

  /**
   * Import cookies
   */
  'import-cookies': {
    name: 'Import Cookies',
    description: 'Import cookies from file',
    icon: '📥',
    category: 'data',
    configSchema: {
      filename: { type: 'string', required: true, description: 'File path' },
    },
    async execute(context, config) {
      const { browserContext, variables } = context;
      const cookieManager = require('../../cookie/manager');

      const filename = variables.interpolate(config.filename);
      const cookies = cookieManager.loadFromFile(filename);

      await browserContext.addCookies(cookies);

      return { success: true, path: filename, count: cookies.length };
    },
  },

  /**
   * Clear cookies
   */
  'clear-cookies': {
    name: 'Clear Cookies',
    description: 'Clear all or domain-specific cookies',
    icon: '🗑️',
    category: 'data',
    configSchema: {
      domain: { type: 'string', description: 'Domain to clear (optional, clears all if empty)' },
    },
    async execute(context, config) {
      const { browserContext, variables } = context;

      if (config.domain) {
        const domain = variables.interpolate(config.domain);
        const cookies = await browserContext.cookies();
        const toKeep = cookies.filter(c => !c.domain.includes(domain));
        await browserContext.clearCookies();
        await browserContext.addCookies(toKeep);
        return { success: true, domain };
      } else {
        await browserContext.clearCookies();
        return { success: true, domain: 'all' };
      }
    },
  },

  /**
   * Evaluate JavaScript and get result
   */
  evaluate: {
    name: 'Evaluate JS',
    description: 'Execute JavaScript and save result',
    icon: '💻',
    category: 'data',
    configSchema: {
      script: { type: 'string', required: true, description: 'JavaScript code' },
      saveAs: { type: 'string', description: 'Variable name to save result' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      const script = variables.interpolate(config.script);
      const result = await page.evaluate(script);

      if (config.saveAs) {
        variables.store.set(config.saveAs, result);
      }

      return { success: true, result, variable: config.saveAs };
    },
  },

  /**
   * Get all elements' texts as array
   */
  'get-all-texts': {
    name: 'Get All Texts',
    description: 'Get text from all matching elements',
    icon: '📚',
    category: 'data',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
      limit: { type: 'number', description: 'Max elements to get' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      const locator = page.locator(selector);
      let count = await locator.count();

      if (config.limit && config.limit < count) {
        count = config.limit;
      }

      const texts = [];
      for (let i = 0; i < count; i++) {
        const text = await locator.nth(i).textContent();
        texts.push(text?.trim() || '');
      }

      variables.store.set(config.saveAs, texts);

      return { success: true, count: texts.length, variable: config.saveAs };
    },
  },
};

module.exports = data;
