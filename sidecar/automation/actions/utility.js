/**
 * Utility Actions
 * Clipboard, Random, String, Array operations
 */

const utility = {
  // ============ CLIPBOARD ============

  /**
   * Copy text to clipboard
   */
  'clipboard-copy': {
    name: 'Copy to Clipboard',
    description: 'Copy text to clipboard',
    icon: '📋',
    category: 'utility',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text to copy (supports variables)' },
    },
    async execute(context, config) {
      const { page, variables } = context;
      const text = variables.interpolate(config.text);

      await page.evaluate((t) => navigator.clipboard.writeText(t), text);

      return { success: true, text };
    },
  },

  /**
   * Paste from clipboard
   */
  'clipboard-paste': {
    name: 'Paste from Clipboard',
    description: 'Paste clipboard content to focused element',
    icon: '📋',
    category: 'utility',
    configSchema: {
      selector: { type: 'string', description: 'Optional: Element selector to focus first' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      if (config.selector) {
        const selector = variables.interpolate(config.selector);
        await page.click(selector);
      }

      await page.keyboard.press('Control+V');

      return { success: true };
    },
  },

  /**
   * Get clipboard content
   */
  'clipboard-get': {
    name: 'Get Clipboard',
    description: 'Get clipboard content and save to variable',
    icon: '📋',
    category: 'utility',
    configSchema: {
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { page, variables } = context;

      const text = await page.evaluate(() => navigator.clipboard.readText());
      variables.store.set(config.saveAs, text);

      return { success: true, text, variable: config.saveAs };
    },
  },

  // ============ RANDOM ============

  /**
   * Generate random text
   */
  'random-text': {
    name: 'Random Text',
    description: 'Generate random text string',
    icon: '🎲',
    category: 'utility',
    configSchema: {
      length: { type: 'number', default: 10, description: 'Length of text' },
      charset: {
        type: 'string',
        default: 'alphanumeric',
        options: [
          { value: 'alphanumeric', label: 'Alphanumeric (a-z, A-Z, 0-9)' },
          { value: 'letters', label: 'Letters only (a-z, A-Z)' },
          { value: 'lowercase', label: 'Lowercase (a-z)' },
          { value: 'uppercase', label: 'Uppercase (A-Z)' },
          { value: 'numbers', label: 'Numbers only (0-9)' },
          { value: 'hex', label: 'Hexadecimal (0-9, a-f)' },
        ],
        description: 'Character set',
      },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const charsets = {
        alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numbers: '0123456789',
        hex: '0123456789abcdef',
      };

      const chars = charsets[config.charset] || charsets.alphanumeric;
      const length = config.length || 10;
      let result = '';

      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      variables.store.set(config.saveAs, result);

      return { success: true, text: result, variable: config.saveAs };
    },
  },

  /**
   * Generate random number
   */
  'random-number': {
    name: 'Random Number',
    description: 'Generate random number in range',
    icon: '🔢',
    category: 'utility',
    configSchema: {
      min: { type: 'number', default: 0, description: 'Minimum value' },
      max: { type: 'number', default: 100, description: 'Maximum value' },
      decimals: { type: 'number', default: 0, description: 'Decimal places' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const min = config.min ?? 0;
      const max = config.max ?? 100;
      const decimals = config.decimals ?? 0;

      let result = Math.random() * (max - min) + min;
      if (decimals === 0) {
        result = Math.floor(result);
      } else {
        result = parseFloat(result.toFixed(decimals));
      }

      variables.store.set(config.saveAs, result);

      return { success: true, number: result, variable: config.saveAs };
    },
  },

  /**
   * Generate random email
   */
  'random-email': {
    name: 'Random Email',
    description: 'Generate random email address',
    icon: '📧',
    category: 'utility',
    configSchema: {
      domain: { type: 'string', default: 'example.com', description: 'Email domain' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let username = '';
      const length = 8 + Math.floor(Math.random() * 8);

      for (let i = 0; i < length; i++) {
        username += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const domain = config.domain || 'example.com';
      const email = `${username}@${domain}`;

      variables.store.set(config.saveAs, email);

      return { success: true, email, variable: config.saveAs };
    },
  },

  /**
   * Generate random phone
   */
  'random-phone': {
    name: 'Random Phone',
    description: 'Generate random phone number',
    icon: '📱',
    category: 'utility',
    configSchema: {
      format: { type: 'string', default: '+1-XXX-XXX-XXXX', description: 'Format (X = digit)' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const format = config.format || '+1-XXX-XXX-XXXX';
      let phone = '';

      for (const char of format) {
        if (char === 'X') {
          phone += Math.floor(Math.random() * 10);
        } else {
          phone += char;
        }
      }

      variables.store.set(config.saveAs, phone);

      return { success: true, phone, variable: config.saveAs };
    },
  },

  /**
   * Generate UUID
   */
  'random-uuid': {
    name: 'Random UUID',
    description: 'Generate random UUID v4',
    icon: '🆔',
    category: 'utility',
    configSchema: {
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;
      const crypto = require('crypto');

      const uuid = crypto.randomUUID();
      variables.store.set(config.saveAs, uuid);

      return { success: true, uuid, variable: config.saveAs };
    },
  },

  /**
   * Pick random item from list
   */
  'random-choice': {
    name: 'Random Choice',
    description: 'Pick random item from a list',
    icon: '🎯',
    category: 'utility',
    configSchema: {
      items: { type: 'array', required: true, description: 'Items to choose from (one per line)' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const items = config.items || [];
      if (items.length === 0) {
        throw new Error('Items list is empty');
      }

      const choice = items[Math.floor(Math.random() * items.length)];
      variables.store.set(config.saveAs, choice);

      return { success: true, choice, variable: config.saveAs };
    },
  },

  // ============ STRING OPERATIONS ============

  /**
   * Split string
   */
  'string-split': {
    name: 'Split String',
    description: 'Split string into array',
    icon: '✂️',
    category: 'utility',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text or {{variable}}' },
      separator: { type: 'string', default: ',', description: 'Separator' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const text = variables.interpolate(config.text);
      const separator = config.separator || ',';
      const result = text.split(separator).map(s => s.trim());

      variables.store.set(config.saveAs, result);

      return { success: true, count: result.length, variable: config.saveAs };
    },
  },

  /**
   * Join array to string
   */
  'string-join': {
    name: 'Join Array',
    description: 'Join array elements into string',
    icon: '🔗',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      separator: { type: 'string', default: ', ', description: 'Join separator' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const arr = variables.store.get(config.array);
      if (!Array.isArray(arr)) {
        throw new Error(`${config.array} is not an array`);
      }

      const result = arr.join(config.separator || ', ');
      variables.store.set(config.saveAs, result);

      return { success: true, result, variable: config.saveAs };
    },
  },

  /**
   * Replace in string
   */
  'string-replace': {
    name: 'String Replace',
    description: 'Replace text in string',
    icon: '🔄',
    category: 'utility',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text or {{variable}}' },
      search: { type: 'string', required: true, description: 'Search for' },
      replace: { type: 'string', default: '', description: 'Replace with' },
      replaceAll: { type: 'boolean', default: true, description: 'Replace all occurrences' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const text = variables.interpolate(config.text);
      const search = config.search;
      const replace = config.replace || '';

      let result;
      if (config.replaceAll) {
        result = text.split(search).join(replace);
      } else {
        result = text.replace(search, replace);
      }

      variables.store.set(config.saveAs, result);

      return { success: true, result, variable: config.saveAs };
    },
  },

  /**
   * Extract substring
   */
  'string-substring': {
    name: 'Substring',
    description: 'Extract part of a string',
    icon: '📏',
    category: 'utility',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text or {{variable}}' },
      start: { type: 'number', default: 0, description: 'Start index' },
      end: { type: 'number', description: 'End index (optional)' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const text = variables.interpolate(config.text);
      const start = config.start || 0;
      const end = config.end;

      const result = end !== undefined ? text.substring(start, end) : text.substring(start);
      variables.store.set(config.saveAs, result);

      return { success: true, result, variable: config.saveAs };
    },
  },

  /**
   * Regex match
   */
  'regex-match': {
    name: 'Regex Match',
    description: 'Find text matching regex pattern',
    icon: '🔍',
    category: 'utility',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text or {{variable}}' },
      pattern: { type: 'string', required: true, description: 'Regex pattern' },
      flags: { type: 'string', default: 'g', description: 'Regex flags (g, i, m)' },
      saveAs: { type: 'string', required: true, description: 'Variable name (array of matches)' },
    },
    async execute(context, config) {
      const { variables } = context;

      const text = variables.interpolate(config.text);
      const regex = new RegExp(config.pattern, config.flags || 'g');
      const matches = text.match(regex) || [];

      variables.store.set(config.saveAs, matches);

      return { success: true, matches, count: matches.length, variable: config.saveAs };
    },
  },

  /**
   * Regex replace
   */
  'regex-replace': {
    name: 'Regex Replace',
    description: 'Replace text using regex pattern',
    icon: '🔄',
    category: 'utility',
    configSchema: {
      text: { type: 'string', required: true, description: 'Text or {{variable}}' },
      pattern: { type: 'string', required: true, description: 'Regex pattern' },
      replace: { type: 'string', default: '', description: 'Replace with ($1, $2 for groups)' },
      flags: { type: 'string', default: 'g', description: 'Regex flags' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const text = variables.interpolate(config.text);
      const regex = new RegExp(config.pattern, config.flags || 'g');
      const result = text.replace(regex, config.replace || '');

      variables.store.set(config.saveAs, result);

      return { success: true, result, variable: config.saveAs };
    },
  },

  // ============ ARRAY OPERATIONS ============

  /**
   * Array push
   */
  'array-push': {
    name: 'Array Push',
    description: 'Add item to end of array',
    icon: '➕',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      value: { type: 'string', required: true, description: 'Value to add' },
    },
    async execute(context, config) {
      const { variables } = context;

      let arr = variables.store.get(config.array) || [];
      if (!Array.isArray(arr)) arr = [];

      const value = variables.interpolate(config.value);
      arr.push(value);
      variables.store.set(config.array, arr);

      return { success: true, length: arr.length };
    },
  },

  /**
   * Array pop
   */
  'array-pop': {
    name: 'Array Pop',
    description: 'Remove and get last item from array',
    icon: '➖',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      saveAs: { type: 'string', description: 'Save popped value to variable' },
    },
    async execute(context, config) {
      const { variables } = context;

      let arr = variables.store.get(config.array) || [];
      if (!Array.isArray(arr)) arr = [];

      const value = arr.pop();
      variables.store.set(config.array, arr);

      if (config.saveAs) {
        variables.store.set(config.saveAs, value);
      }

      return { success: true, value, length: arr.length };
    },
  },

  /**
   * Array get item
   */
  'array-get': {
    name: 'Array Get',
    description: 'Get item at index from array',
    icon: '📍',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      index: { type: 'number', required: true, description: 'Index (0-based, negative from end)' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const arr = variables.store.get(config.array);
      if (!Array.isArray(arr)) {
        throw new Error(`${config.array} is not an array`);
      }

      let index = config.index;
      if (index < 0) index = arr.length + index;

      const value = arr[index];
      variables.store.set(config.saveAs, value);

      return { success: true, value, index, variable: config.saveAs };
    },
  },

  /**
   * Array length
   */
  'array-length': {
    name: 'Array Length',
    description: 'Get array length',
    icon: '📊',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      saveAs: { type: 'string', required: true, description: 'Variable name' },
    },
    async execute(context, config) {
      const { variables } = context;

      const arr = variables.store.get(config.array);
      const length = Array.isArray(arr) ? arr.length : 0;

      variables.store.set(config.saveAs, length);

      return { success: true, length, variable: config.saveAs };
    },
  },

  /**
   * Array filter
   */
  'array-filter': {
    name: 'Array Filter',
    description: 'Filter array by condition',
    icon: '🔍',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      condition: { type: 'string', required: true, description: 'Filter condition (use "item" variable)' },
      saveAs: { type: 'string', required: true, description: 'Variable name for result' },
    },
    async execute(context, config) {
      const { variables } = context;

      const arr = variables.store.get(config.array);
      if (!Array.isArray(arr)) {
        throw new Error(`${config.array} is not an array`);
      }

      const result = arr.filter(item => {
        // Simple evaluation with item context
        try {
          return eval(config.condition.replace(/\bitem\b/g, JSON.stringify(item)));
        } catch {
          return false;
        }
      });

      variables.store.set(config.saveAs, result);

      return { success: true, originalCount: arr.length, filteredCount: result.length, variable: config.saveAs };
    },
  },

  /**
   * Array sort
   */
  'array-sort': {
    name: 'Array Sort',
    description: 'Sort array',
    icon: '📈',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      order: {
        type: 'string',
        default: 'asc',
        options: [
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ],
        description: 'Sort order',
      },
      saveAs: { type: 'string', required: true, description: 'Variable name for result' },
    },
    async execute(context, config) {
      const { variables } = context;

      const arr = variables.store.get(config.array);
      if (!Array.isArray(arr)) {
        throw new Error(`${config.array} is not an array`);
      }

      const sorted = [...arr].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
          return config.order === 'desc' ? b - a : a - b;
        }
        const strA = String(a);
        const strB = String(b);
        return config.order === 'desc' ? strB.localeCompare(strA) : strA.localeCompare(strB);
      });

      variables.store.set(config.saveAs, sorted);

      return { success: true, count: sorted.length, variable: config.saveAs };
    },
  },

  /**
   * Array shuffle
   */
  'array-shuffle': {
    name: 'Array Shuffle',
    description: 'Randomly shuffle array',
    icon: '🔀',
    category: 'utility',
    configSchema: {
      array: { type: 'string', required: true, description: 'Array variable name' },
      saveAs: { type: 'string', required: true, description: 'Variable name for result' },
    },
    async execute(context, config) {
      const { variables } = context;

      const arr = variables.store.get(config.array);
      if (!Array.isArray(arr)) {
        throw new Error(`${config.array} is not an array`);
      }

      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      variables.store.set(config.saveAs, shuffled);

      return { success: true, count: shuffled.length, variable: config.saveAs };
    },
  },
};

module.exports = utility;
