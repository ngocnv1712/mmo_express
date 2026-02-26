/**
 * Interaction Actions
 * Click, type, fill, select, hover, scroll, keyboard, mouse-move
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

/**
 * Generate Bezier curve control points for natural mouse movement
 */
function generateBezierControlPoints(startX, startY, endX, endY, curvature = 0.3) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Random offset perpendicular to the line
  const perpX = -dy / distance;
  const perpY = dx / distance;

  // Control point offsets with randomness
  const offset1 = distance * curvature * (Math.random() * 0.5 + 0.5);
  const offset2 = distance * curvature * (Math.random() * 0.5 + 0.5);

  // Random side for curve
  const side1 = Math.random() > 0.5 ? 1 : -1;
  const side2 = Math.random() > 0.5 ? 1 : -1;

  return {
    cp1x: startX + dx * 0.25 + perpX * offset1 * side1,
    cp1y: startY + dy * 0.25 + perpY * offset1 * side1,
    cp2x: startX + dx * 0.75 + perpX * offset2 * side2,
    cp2y: startY + dy * 0.75 + perpY * offset2 * side2,
  };
}

/**
 * Calculate point on cubic Bezier curve
 */
function bezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
}

/**
 * Generate human-like mouse path using Bezier curves
 */
function generateMousePath(startX, startY, endX, endY, options = {}) {
  const {
    steps = 20,
    curvature = 0.3,
    jitter = 2,
    overshoot = false,
  } = options;

  const path = [];
  const { cp1x, cp1y, cp2x, cp2y } = generateBezierControlPoints(startX, startY, endX, endY, curvature);

  // Overshoot target slightly
  let targetX = endX;
  let targetY = endY;
  if (overshoot) {
    const dx = endX - startX;
    const dy = endY - startY;
    const overshootAmount = 0.05 + Math.random() * 0.1;
    targetX = endX + dx * overshootAmount;
    targetY = endY + dy * overshootAmount;
  }

  // Generate main path
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Ease in-out for more natural acceleration
    const easedT = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;

    let x = bezierPoint(easedT, startX, cp1x, cp2x, targetX);
    let y = bezierPoint(easedT, startY, cp1y, cp2y, targetY);

    // Add micro-jitter for realism (less at start and end)
    const jitterAmount = jitter * Math.sin(Math.PI * t);
    x += (Math.random() - 0.5) * jitterAmount;
    y += (Math.random() - 0.5) * jitterAmount;

    path.push({ x: Math.round(x), y: Math.round(y) });
  }

  // Add correction path if overshoot
  if (overshoot) {
    const correctionSteps = 5;
    for (let i = 1; i <= correctionSteps; i++) {
      const t = i / correctionSteps;
      const x = targetX + (endX - targetX) * t;
      const y = targetY + (endY - targetY) * t;
      path.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  return path;
}

/**
 * Execute human-like mouse movement
 */
async function humanMouseMove(page, targetX, targetY, options = {}) {
  const {
    speed = 'normal', // slow, normal, fast
    curvature = 0.3,
    jitter = 2,
    overshoot = false,
  } = options;

  // Get current mouse position (default to center if unknown)
  const viewport = page.viewportSize();
  const currentPos = await page.evaluate(() => {
    return window.__mousePos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  });

  // Calculate steps based on distance and speed
  const distance = Math.sqrt(
    Math.pow(targetX - currentPos.x, 2) +
    Math.pow(targetY - currentPos.y, 2)
  );

  const speedMultiplier = { slow: 2, normal: 1, fast: 0.5 }[speed] || 1;
  const steps = Math.max(10, Math.min(50, Math.floor(distance / 20) * speedMultiplier));

  // Generate path
  const path = generateMousePath(
    currentPos.x, currentPos.y,
    targetX, targetY,
    { steps, curvature, jitter, overshoot }
  );

  // Execute movement
  const baseDelay = { slow: 20, normal: 10, fast: 5 }[speed] || 10;

  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(randomDelay(baseDelay, 0.5));
  }

  // Store current position for next movement
  await page.evaluate((pos) => {
    window.__mousePos = pos;
  }, { x: targetX, y: targetY });

  return { finalX: targetX, finalY: targetY, pathLength: path.length };
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

  /**
   * Human-like mouse movement
   */
  'mouse-move': {
    name: 'Mouse Move',
    description: 'Move mouse cursor with human-like Bezier curve path',
    icon: '🖱️',
    category: 'interaction',
    configSchema: {
      target: {
        type: 'string',
        default: 'selector',
        options: [
          { value: 'selector', label: 'To Element' },
          { value: 'coordinates', label: 'To Coordinates' },
          { value: 'random', label: 'Random Position' },
        ],
        description: 'Target type',
      },
      selector: { type: 'string', description: 'CSS selector (for "To Element")' },
      x: { type: 'number', description: 'X coordinate (for "To Coordinates")' },
      y: { type: 'number', description: 'Y coordinate (for "To Coordinates")' },
      speed: {
        type: 'string',
        default: 'normal',
        options: [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ],
        description: 'Movement speed',
      },
      curvature: {
        type: 'number',
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.1,
        description: 'Path curvature (0=straight, 1=very curved)',
      },
      overshoot: {
        type: 'boolean',
        default: false,
        description: 'Overshoot target then correct (more human-like)',
      },
      jitter: {
        type: 'number',
        default: 2,
        min: 0,
        max: 10,
        description: 'Micro-movement jitter (pixels)',
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      let targetX, targetY;

      if (config.target === 'selector' && config.selector) {
        const selector = variables.interpolate(config.selector);
        await page.waitForSelector(selector, { timeout: config.timeout || 30000 });

        // Get element center position
        const box = await page.locator(selector).boundingBox();
        if (!box) {
          throw new Error(`Element not found or not visible: ${selector}`);
        }
        targetX = box.x + box.width / 2;
        targetY = box.y + box.height / 2;
      } else if (config.target === 'coordinates') {
        targetX = config.x || 0;
        targetY = config.y || 0;
      } else if (config.target === 'random') {
        const viewport = page.viewportSize();
        targetX = Math.random() * (viewport?.width || 1920);
        targetY = Math.random() * (viewport?.height || 1080);
      } else {
        throw new Error('Invalid target type or missing selector/coordinates');
      }

      const result = await humanMouseMove(page, targetX, targetY, {
        speed: config.speed || 'normal',
        curvature: config.curvature ?? 0.3,
        overshoot: config.overshoot || false,
        jitter: config.jitter ?? 2,
      });

      return {
        success: true,
        targetX: result.finalX,
        targetY: result.finalY,
        pathLength: result.pathLength,
      };
    },
  },

  /**
   * Human-like click (mouse move + click)
   */
  'human-click': {
    name: 'Human Click',
    description: 'Move mouse naturally to element then click',
    icon: '👆',
    category: 'interaction',
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      clickType: {
        type: 'string',
        default: 'single',
        options: [
          { value: 'single', label: 'Single Click' },
          { value: 'double', label: 'Double Click' },
          { value: 'right', label: 'Right Click' },
        ],
        description: 'Click type',
      },
      speed: {
        type: 'string',
        default: 'normal',
        options: [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ],
        description: 'Movement speed',
      },
      curvature: {
        type: 'number',
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.1,
        description: 'Path curvature',
      },
      overshoot: {
        type: 'boolean',
        default: true,
        description: 'Overshoot then correct',
      },
      preClickDelay: {
        type: 'number',
        default: 100,
        description: 'Delay before clicking (ms)',
      },
      waitForNavigation: {
        type: 'boolean',
        default: false,
        description: 'Wait for page navigation after click',
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      await page.waitForSelector(selector, { timeout: config.timeout || 30000 });

      // Get element center
      const box = await page.locator(selector).boundingBox();
      if (!box) {
        throw new Error(`Element not found or not visible: ${selector}`);
      }

      // Add slight randomness to click position within element
      const offsetX = (Math.random() - 0.5) * box.width * 0.3;
      const offsetY = (Math.random() - 0.5) * box.height * 0.3;
      const targetX = box.x + box.width / 2 + offsetX;
      const targetY = box.y + box.height / 2 + offsetY;

      // Move mouse to element
      await humanMouseMove(page, targetX, targetY, {
        speed: config.speed || 'normal',
        curvature: config.curvature ?? 0.3,
        overshoot: config.overshoot ?? true,
        jitter: 2,
      });

      // Pre-click delay (human reaction time)
      await page.waitForTimeout(randomDelay(config.preClickDelay || 100, 0.3));

      // Perform click using page.click() for better link/navigation support
      // Mouse has already moved to element, so this looks natural
      const clickOptions = {
        button: config.clickType === 'right' ? 'right' : 'left',
        clickCount: config.clickType === 'double' ? 2 : 1,
        position: {
          x: offsetX + box.width / 2,
          y: offsetY + box.height / 2,
        },
      };

      if (config.waitForNavigation) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: config.timeout || 30000 }),
          page.click(selector, clickOptions),
        ]);
      } else {
        await page.click(selector, clickOptions);
      }

      return { success: true, selector, x: targetX, y: targetY };
    },
  },

  /**
   * Drag and drop with human-like movement
   */
  'human-drag': {
    name: 'Human Drag',
    description: 'Drag element with human-like mouse movement',
    icon: '✋',
    category: 'interaction',
    configSchema: {
      sourceSelector: { type: 'string', required: true, description: 'Element to drag' },
      targetSelector: { type: 'string', description: 'Drop target element' },
      targetX: { type: 'number', description: 'Target X (if no selector)' },
      targetY: { type: 'number', description: 'Target Y (if no selector)' },
      speed: {
        type: 'string',
        default: 'slow',
        options: [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ],
        description: 'Drag speed',
      },
      curvature: {
        type: 'number',
        default: 0.2,
        description: 'Path curvature',
      },
      timeout: { type: 'number', default: 30000 },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const sourceSelector = variables.interpolate(config.sourceSelector);

      await page.waitForSelector(sourceSelector, { timeout: config.timeout || 30000 });

      // Get source element position
      const sourceBox = await page.locator(sourceSelector).boundingBox();
      if (!sourceBox) {
        throw new Error(`Source element not found: ${sourceSelector}`);
      }

      const startX = sourceBox.x + sourceBox.width / 2;
      const startY = sourceBox.y + sourceBox.height / 2;

      // Get target position
      let endX, endY;
      if (config.targetSelector) {
        const targetSelector = variables.interpolate(config.targetSelector);
        await page.waitForSelector(targetSelector, { timeout: config.timeout || 30000 });
        const targetBox = await page.locator(targetSelector).boundingBox();
        if (!targetBox) {
          throw new Error(`Target element not found: ${targetSelector}`);
        }
        endX = targetBox.x + targetBox.width / 2;
        endY = targetBox.y + targetBox.height / 2;
      } else {
        endX = config.targetX || startX + 100;
        endY = config.targetY || startY;
      }

      // Move to source
      await humanMouseMove(page, startX, startY, {
        speed: config.speed || 'slow',
        curvature: 0.2,
      });

      // Press mouse button
      await page.mouse.down();
      await page.waitForTimeout(randomDelay(100, 0.3));

      // Drag to target
      await humanMouseMove(page, endX, endY, {
        speed: config.speed || 'slow',
        curvature: config.curvature ?? 0.2,
        jitter: 1,
      });

      // Release
      await page.waitForTimeout(randomDelay(50, 0.3));
      await page.mouse.up();

      return { success: true, from: { x: startX, y: startY }, to: { x: endX, y: endY } };
    },
  },
};

module.exports = interaction;
