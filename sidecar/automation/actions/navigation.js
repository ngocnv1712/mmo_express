/**
 * Navigation Actions
 * Page navigation, tabs, history
 */

const navigation = {
  /**
   * Navigate to URL
   */
  navigate: {
    name: 'Navigate to URL',
    description: 'Navigate the browser to a URL',
    icon: '🌐',
    category: 'navigation',
    configSchema: {
      url: { type: 'string', required: true, description: 'URL to navigate to' },
      waitUntil: {
        type: 'string',
        default: 'domcontentloaded',
        options: ['load', 'domcontentloaded', 'networkidle'],
        description: 'Wait until event',
      },
      timeout: { type: 'number', default: 30000, description: 'Timeout in ms' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const url = variables.interpolate(config.url);

      await page.goto(url, {
        waitUntil: config.waitUntil || 'domcontentloaded',
        timeout: config.timeout || 30000,
      });

      return { success: true, url };
    },
  },

  /**
   * Go back in history
   */
  'go-back': {
    name: 'Go Back',
    description: 'Navigate to previous page in history',
    icon: '🔙',
    category: 'navigation',
    configSchema: {
      waitUntil: {
        type: 'string',
        default: 'domcontentloaded',
        options: ['load', 'domcontentloaded', 'networkidle'],
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page } = context;

      await page.goBack({
        waitUntil: config.waitUntil || 'domcontentloaded',
        timeout: config.timeout || 30000,
      });

      return { success: true, url: page.url() };
    },
  },

  /**
   * Go forward in history
   */
  'go-forward': {
    name: 'Go Forward',
    description: 'Navigate to next page in history',
    icon: '🔜',
    category: 'navigation',
    configSchema: {
      waitUntil: {
        type: 'string',
        default: 'domcontentloaded',
        options: ['load', 'domcontentloaded', 'networkidle'],
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page } = context;

      await page.goForward({
        waitUntil: config.waitUntil || 'domcontentloaded',
        timeout: config.timeout || 30000,
      });

      return { success: true, url: page.url() };
    },
  },

  /**
   * Refresh page
   */
  refresh: {
    name: 'Refresh Page',
    description: 'Reload the current page',
    icon: '🔄',
    category: 'navigation',
    configSchema: {
      waitUntil: {
        type: 'string',
        default: 'domcontentloaded',
        options: ['load', 'domcontentloaded', 'networkidle'],
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page } = context;

      await page.reload({
        waitUntil: config.waitUntil || 'domcontentloaded',
        timeout: config.timeout || 30000,
      });

      return { success: true, url: page.url() };
    },
  },

  /**
   * Open new tab
   */
  'new-tab': {
    name: 'New Tab',
    description: 'Open a new browser tab',
    icon: '📑',
    category: 'navigation',
    configSchema: {
      url: { type: 'string', description: 'URL to open (optional)' },
      switchTo: { type: 'boolean', default: true, description: 'Switch to new tab' },
    },
    async execute(context, config) {
      const { page, browserContext, variables, setPage } = context;

      const newPage = await browserContext.newPage();

      if (config.url) {
        const url = variables.interpolate(config.url);
        await newPage.goto(url, { waitUntil: 'domcontentloaded' });
      }

      if (config.switchTo !== false) {
        setPage(newPage);
      }

      return { success: true, switched: config.switchTo !== false };
    },
  },

  /**
   * Close current tab
   */
  'close-tab': {
    name: 'Close Tab',
    description: 'Close the current tab',
    icon: '❌',
    category: 'navigation',
    configSchema: {},
    async execute(context) {
      const { page, browserContext, setPage } = context;

      await page.close();

      // Switch to another tab if available
      const pages = browserContext.pages();
      if (pages.length > 0) {
        setPage(pages[pages.length - 1]);
      }

      return { success: true };
    },
  },

  /**
   * Switch to tab by index
   */
  'switch-tab': {
    name: 'Switch Tab',
    description: 'Switch to another browser tab',
    icon: '🔀',
    category: 'navigation',
    configSchema: {
      index: { type: 'number', default: 0, description: 'Tab index (0-based)' },
    },
    async execute(context, config) {
      const { browserContext, setPage } = context;

      const pages = browserContext.pages();
      const index = config.index || 0;

      if (index < 0 || index >= pages.length) {
        throw new Error(`Tab index ${index} out of range (0-${pages.length - 1})`);
      }

      setPage(pages[index]);
      await pages[index].bringToFront();

      return { success: true, tabIndex: index };
    },
  },
};

module.exports = navigation;
