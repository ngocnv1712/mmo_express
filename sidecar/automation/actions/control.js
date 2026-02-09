/**
 * Control Flow Actions
 * If/Else, Loops, Try-Catch, Break, Continue, Stop
 */

const control = {
  /**
   * If condition
   */
  condition: {
    name: 'If Condition',
    description: 'Execute actions based on condition',
    icon: '🔀',
    category: 'control',
    isControlFlow: true,
    hasChildren: true,
    configSchema: {
      conditionType: {
        type: 'string',
        required: true,
        options: ['element-exists', 'element-visible', 'text-contains', 'url-contains', 'compare', 'expression'],
        description: 'Condition type',
      },
      selector: { type: 'string', description: 'CSS selector (for element checks)' },
      text: { type: 'string', description: 'Text to search (for text-contains)' },
      urlPattern: { type: 'string', description: 'URL pattern (for url-contains)' },
      left: { type: 'string', description: 'Left value (for compare)' },
      operator: {
        type: 'string',
        options: ['==', '!=', '<', '>', '<=', '>=', 'contains', 'startsWith', 'endsWith'],
        description: 'Comparison operator',
      },
      right: { type: 'string', description: 'Right value (for compare)' },
      expression: { type: 'string', description: 'JavaScript expression (for expression)' },
      negate: { type: 'boolean', default: false, description: 'Negate condition' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      let result = false;

      switch (config.conditionType) {
        case 'element-exists': {
          const selector = variables.interpolate(config.selector);
          const count = await page.locator(selector).count();
          result = count > 0;
          break;
        }

        case 'element-visible': {
          const selector = variables.interpolate(config.selector);
          try {
            result = await page.isVisible(selector);
          } catch {
            result = false;
          }
          break;
        }

        case 'text-contains': {
          const text = variables.interpolate(config.text);
          const selector = config.selector ? variables.interpolate(config.selector) : 'body';
          const content = await page.textContent(selector);
          result = content?.includes(text) || false;
          break;
        }

        case 'url-contains': {
          const pattern = variables.interpolate(config.urlPattern);
          result = page.url().includes(pattern);
          break;
        }

        case 'compare': {
          const left = variables.interpolate(config.left);
          const right = variables.interpolate(config.right);
          const op = config.operator || '==';

          switch (op) {
            case '==':
              result = String(left) === String(right);
              break;
            case '!=':
              result = String(left) !== String(right);
              break;
            case '<':
              result = parseFloat(left) < parseFloat(right);
              break;
            case '>':
              result = parseFloat(left) > parseFloat(right);
              break;
            case '<=':
              result = parseFloat(left) <= parseFloat(right);
              break;
            case '>=':
              result = parseFloat(left) >= parseFloat(right);
              break;
            case 'contains':
              result = String(left).includes(String(right));
              break;
            case 'startsWith':
              result = String(left).startsWith(String(right));
              break;
            case 'endsWith':
              result = String(left).endsWith(String(right));
              break;
          }
          break;
        }

        case 'expression': {
          const expr = variables.interpolate(config.expression);
          try {
            result = await page.evaluate(expr);
          } catch {
            result = false;
          }
          break;
        }
      }

      // Negate if requested
      if (config.negate) {
        result = !result;
      }

      return {
        success: true,
        conditionResult: result,
        // Executor will handle then/else branches
      };
    },
  },

  /**
   * Loop - For each element
   */
  'loop-elements': {
    name: 'Loop Elements',
    description: 'Loop through matching elements',
    icon: '🔁',
    category: 'control',
    isControlFlow: true,
    isLoop: true,
    hasChildren: true,
    configSchema: {
      selector: { type: 'string', required: true, description: 'CSS selector' },
      maxItems: { type: 'number', default: 100, description: 'Maximum items to loop' },
      variableName: { type: 'string', default: 'element', description: 'Variable name for current element' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const selector = variables.interpolate(config.selector);

      const locator = page.locator(selector);
      let count = await locator.count();

      if (config.maxItems && config.maxItems < count) {
        count = config.maxItems;
      }

      // Return loop info for executor
      return {
        success: true,
        isLoop: true,
        loopType: 'elements',
        selector,
        count,
        variableName: config.variableName || 'element',
        // Executor will iterate and execute children
      };
    },
  },

  /**
   * Loop - Repeat N times
   */
  'loop-count': {
    name: 'Repeat N Times',
    description: 'Repeat actions a number of times',
    icon: '🔁',
    category: 'control',
    isControlFlow: true,
    isLoop: true,
    hasChildren: true,
    configSchema: {
      count: { type: 'number', required: true, description: 'Number of iterations' },
      variableName: { type: 'string', default: 'i', description: 'Variable name for index' },
    },
    async execute(context, config) {
      const { variables } = context;
      const count = parseInt(variables.interpolate(String(config.count))) || 0;

      return {
        success: true,
        isLoop: true,
        loopType: 'count',
        count,
        variableName: config.variableName || 'i',
      };
    },
  },

  /**
   * Loop - While condition
   */
  'loop-while': {
    name: 'While Loop',
    description: 'Loop while condition is true',
    icon: '🔁',
    category: 'control',
    isControlFlow: true,
    isLoop: true,
    hasChildren: true,
    configSchema: {
      condition: { type: 'string', required: true, description: 'Condition expression' },
      maxIterations: { type: 'number', default: 100, description: 'Safety limit' },
      variableName: { type: 'string', default: 'iteration', description: 'Variable name' },
    },
    async execute(context, config) {
      return {
        success: true,
        isLoop: true,
        loopType: 'while',
        condition: config.condition,
        maxIterations: config.maxIterations || 100,
        variableName: config.variableName || 'iteration',
      };
    },
  },

  /**
   * Loop - For each item in array/list
   */
  'loop-array': {
    name: 'Loop Array',
    description: 'Loop through items in an array variable',
    icon: '🔁',
    category: 'control',
    isControlFlow: true,
    isLoop: true,
    hasChildren: true,
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name or JSON array' },
      variableName: { type: 'string', default: 'item', description: 'Variable name for current item' },
      maxItems: { type: 'number', description: 'Maximum items to loop' },
    },
    async execute(context, config) {
      const { variables } = context;

      let array;
      const arrayValue = variables.interpolate(config.array);

      // Try to parse as JSON or get from variable
      try {
        array = JSON.parse(arrayValue);
      } catch {
        // Try to get as variable
        array = variables.store.get(config.array);
      }

      if (!Array.isArray(array)) {
        throw new Error(`${config.array} is not an array`);
      }

      let count = array.length;
      if (config.maxItems && config.maxItems < count) {
        count = config.maxItems;
      }

      return {
        success: true,
        isLoop: true,
        loopType: 'array',
        items: array.slice(0, count),
        count,
        variableName: config.variableName || 'item',
      };
    },
  },

  /**
   * Break loop
   */
  break: {
    name: 'Break Loop',
    description: 'Exit the current loop immediately',
    icon: '🛑',
    category: 'control',
    isControlFlow: true,
    configSchema: {},
    async execute() {
      return {
        success: true,
        break: true,
      };
    },
  },

  /**
   * Continue loop
   */
  continue: {
    name: 'Continue',
    description: 'Skip to next iteration',
    icon: '⏭️',
    category: 'control',
    isControlFlow: true,
    configSchema: {},
    async execute() {
      return {
        success: true,
        continue: true,
      };
    },
  },

  /**
   * Try-Catch
   */
  'try-catch': {
    name: 'Try-Catch',
    description: 'Handle errors gracefully',
    icon: '🚨',
    category: 'control',
    isControlFlow: true,
    hasChildren: true,
    configSchema: {
      errorVariable: { type: 'string', default: 'error', description: 'Variable name for error' },
      continueOnError: { type: 'boolean', default: true, description: 'Continue workflow on error' },
    },
    async execute(context, config) {
      return {
        success: true,
        isTryCatch: true,
        errorVariable: config.errorVariable || 'error',
        continueOnError: config.continueOnError !== false,
        // Executor will handle try/catch/finally
      };
    },
  },

  /**
   * Call another workflow
   */
  'call-workflow': {
    name: 'Call Workflow',
    description: 'Execute another workflow',
    icon: '📞',
    category: 'control',
    configSchema: {
      workflowId: { type: 'string', required: true, description: 'Workflow ID or name' },
      parameters: { type: 'object', description: 'Parameters to pass' },
      waitForCompletion: { type: 'boolean', default: true },
    },
    async execute(context, config) {
      const { workflowManager, variables } = context;

      if (!workflowManager) {
        throw new Error('Workflow manager not available');
      }

      const workflowId = variables.interpolate(config.workflowId);
      const params = config.parameters ? variables.interpolateObject(config.parameters) : {};

      if (config.waitForCompletion) {
        const result = await workflowManager.executeWorkflow(workflowId, {
          ...context,
          parameters: params,
        });
        return { success: true, workflowResult: result };
      } else {
        workflowManager.executeWorkflowAsync(workflowId, {
          ...context,
          parameters: params,
        });
        return { success: true, started: true };
      }
    },
  },

  /**
   * Stop workflow
   */
  stop: {
    name: 'Stop Workflow',
    description: 'Stop workflow execution',
    icon: '🏁',
    category: 'control',
    configSchema: {
      status: {
        type: 'string',
        default: 'success',
        options: ['success', 'failed'],
        description: 'Exit status',
      },
      message: { type: 'string', description: 'Exit message' },
    },
    async execute(context, config) {
      const { variables } = context;
      const message = config.message ? variables.interpolate(config.message) : '';

      return {
        success: config.status !== 'failed',
        stop: true,
        status: config.status || 'success',
        message,
      };
    },
  },

  /**
   * Log message
   */
  log: {
    name: 'Log Message',
    description: 'Log a message',
    icon: '📝',
    category: 'control',
    configSchema: {
      level: {
        type: 'string',
        default: 'info',
        options: ['info', 'warning', 'error', 'debug'],
        description: 'Log level',
      },
      message: { type: 'string', required: true, description: 'Message to log' },
    },
    async execute(context, config) {
      const { variables, logger } = context;
      const message = variables.interpolate(config.message);
      const level = config.level || 'info';

      if (logger) {
        logger.log(level, message);
      } else {
        console.error(`[${level.toUpperCase()}] ${message}`);
      }

      return { success: true, level, message };
    },
  },

  /**
   * Comment/Note (no-op)
   */
  comment: {
    name: 'Comment',
    description: 'Add a note (does nothing)',
    icon: '💬',
    category: 'control',
    configSchema: {
      text: { type: 'string', description: 'Comment text' },
    },
    async execute(context, config) {
      return { success: true, comment: config.text };
    },
  },
};

module.exports = control;
