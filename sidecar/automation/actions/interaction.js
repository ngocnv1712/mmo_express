/**
 * Interaction Actions
 * Click, type, fill, select, hover, scroll, keyboard
 */

/**
 * Add random delay for human-like behavior
 */
function randomDelay(base, variance = 0.3) {
  const min = base * (1 - variance);
  const max = base * (1 + variance);
  return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Human-like typing with variable delays
 */
async function humanType(page, selector, text, baseDelay = 50) {
  await page.click(selector);

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomDelay(baseDelay, 0.5) });

    // Occasional longer pauses
    if (Math.random() < 0.1) {
      await page.waitForTimeout(randomDelay(200, 0.3));
    }
  }
}

const interaction = {
  /**
   * Click element
   */
  click: {
    name: 'Click',
    description: 'Click on an element',
    icon: '👆',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      clickType: {
        type: 'string',
        default: 'single',
        options: ['single', 'double', 'right'],
        description: 'Click type',
      },
      button: {
        type: 'string',
        default: 'left',
        options: ['left', 'right', 'middle'],
      },
      force: { type: 'boolean', default: false, description: 'Force click' },
      waitForNavigation: { type: 'boolean', default: false },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      const clickOptions = {
        button: config.button || 'left',
        force: config.force || false,
        timeout: config.timeout || 30000,
      };

      if (config.clickType === 'double') {
        clickOptions.clickCount = 2;
      }

      if (config.waitForNavigation) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          page.click(selector, clickOptions),
        ]);
      } else {
        await page.click(selector, clickOptions);
      }

      return { success: true, selector };
    },
  },

  /**
   * Type text with typing animation
   */
  type: {
    name: 'Type Text',
    description: 'Type text into an input field',
    icon: '⌨️',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      text: { type: 'string', required: true, description: 'Text to type' },
      delay: { type: 'number', default: 50, description: 'Delay between keys (ms)' },
      clear: { type: 'boolean', default: false, description: 'Clear field first' },
      humanLike: { type: 'boolean', default: true, description: 'Human-like typing' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);
      const text = variables.interpolate(config.text);

      // Wait for element
      await page.waitForSelector(selector, { timeout: config.timeout || 30000 });

      // Clear field if requested
      if (config.clear) {
        await page.click(selector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
      }

      // Type text
      if (config.humanLike) {
        await humanType(page, selector, text, config.delay || 50);
      } else {
        await page.type(selector, text, { delay: config.delay || 50 });
      }

      return { success: true, selector, length: text.length };
    },
  },

  /**
   * Fill input (instant, no typing animation)
   */
  fill: {
    name: 'Fill Form',
    description: 'Fill an input field instantly',
    icon: '📝',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      value: { type: 'string', required: true, description: 'Value to fill' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);
      const value = variables.interpolate(config.value);

      await page.fill(selector, value, { timeout: config.timeout || 30000 });

      return { success: true, selector, value };
    },
  },

  /**
   * Select option from dropdown
   */
  select: {
    name: 'Select Option',
    description: 'Select an option from a dropdown',
    icon: '✅',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      selectBy: {
        type: 'string',
        default: 'value',
        options: ['value', 'label', 'index'],
        description: 'Select by',
      },
      option: { type: 'string', required: true, description: 'Option to select' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);
      const option = variables.interpolate(config.option);

      let selectOption;
      switch (config.selectBy) {
        case 'label':
          selectOption = { label: option };
          break;
        case 'index':
          selectOption = { index: parseInt(option) };
          break;
        default:
          selectOption = { value: option };
      }

      await page.selectOption(selector, selectOption, { timeout: config.timeout || 30000 });

      return { success: true, selector, option };
    },
  },

  /**
   * Check/uncheck checkbox
   */
  check: {
    name: 'Check/Uncheck',
    description: 'Check or uncheck a checkbox',
    icon: '☑️',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      action: {
        type: 'string',
        default: 'check',
        options: ['check', 'uncheck', 'toggle'],
        description: 'Action',
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      switch (config.action) {
        case 'uncheck':
          await page.uncheck(selector, { timeout: config.timeout || 30000 });
          break;
        case 'toggle':
          const isChecked = await page.isChecked(selector);
          if (isChecked) {
            await page.uncheck(selector);
          } else {
            await page.check(selector);
          }
          break;
        default:
          await page.check(selector, { timeout: config.timeout || 30000 });
      }

      return { success: true, selector, action: config.action };
    },
  },

  /**
   * Upload file
   */
  upload: {
    name: 'Upload File',
    description: 'Upload a file to an input',
    icon: '📤',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'File input selector' },
      filePath: { type: 'string', required: true, description: 'Path to file' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);
      const filePath = variables.interpolate(config.filePath);

      await page.setInputFiles(selector, filePath, { timeout: config.timeout || 30000 });

      return { success: true, selector, filePath };
    },
  },

  /**
   * Hover over element
   */
  hover: {
    name: 'Hover',
    description: 'Hover over an element',
    icon: '🖱️',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      duration: { type: 'number', default: 500, description: 'Duration to hover (ms)' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      await page.hover(selector, { timeout: config.timeout || 30000 });

      if (config.duration) {
        await page.waitForTimeout(config.duration);
      }

      return { success: true, selector };
    },
  },

  /**
   * Scroll page
   */
  scroll: {
    name: 'Scroll',
    description: 'Scroll the page',
    icon: '📜',
    category: 'interaction',
    configSchema: {
      direction: {
        type: 'string',
        default: 'down',
        options: ['down', 'up', 'toElement', 'toTop', 'toBottom'],
        description: 'Scroll direction',
      },
      amount: { type: 'number', default: 500, description: 'Scroll amount (pixels)' },
      selector: { type: 'string', description: 'Element selector (for toElement)' },
      smooth: { type: 'boolean', default: true, description: 'Smooth scroll' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      switch (config.direction) {
        case 'up':
          await page.evaluate((amount) => window.scrollBy(0, -amount), config.amount || 500);
          break;
        case 'toTop':
          await page.evaluate(() => window.scrollTo(0, 0));
          break;
        case 'toBottom':
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          break;
        case 'toElement':
          if (config.selector) {
            const selector = variables.interpolate(config.selector);
            await page.locator(selector).scrollIntoViewIfNeeded();
          }
          break;
        default: // down
          await page.evaluate((amount) => window.scrollBy(0, amount), config.amount || 500);
      }

      // Add smooth scroll delay
      if (config.smooth) {
        await page.waitForTimeout(randomDelay(300, 0.3));
      }

      return { success: true, direction: config.direction };
    },
  },

  /**
   * Press keyboard key
   */
  'press-key': {
    name: 'Press Key',
    description: 'Press a keyboard key',
    icon: '⌨️',
    category: 'interaction',
    configSchema: {
      key: {
        type: 'string',
        required: true,
        description: 'Key to press (e.g., Enter, Tab, Escape, ArrowDown, Control+a)',
      },
      selector: { type: 'string', description: 'Focus element first (optional)' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      if (config.selector) {
        const selector = variables.interpolate(config.selector);
        await page.click(selector);
      }

      const key = variables.interpolate(config.key);
      await page.keyboard.press(key);

      return { success: true, key };
    },
  },

  /**
   * Focus element
   */
  focus: {
    name: 'Focus',
    description: 'Focus an element',
    icon: '🎯',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      await page.focus(selector, { timeout: config.timeout || 30000 });

      return { success: true, selector };
    },
  },

  /**
   * Clear input
   */
  clear: {
    name: 'Clear Input',
    description: 'Clear an input field',
    icon: '🗑️',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      await page.fill(selector, '', { timeout: config.timeout || 30000 });

      return { success: true, selector };
    },
  },
};

module.exports = interaction;
