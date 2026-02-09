/**
 * Variable System for Workflow Automation
 * Handles variable storage, interpolation, and transformations
 */

/**
 * Variable store for a workflow execution
 */
class VariableStore {
  constructor(initialVars = {}) {
    this.variables = new Map();
    this.profile = null;
    this.session = null;
    this.loopStack = [];

    // Initialize with provided variables
    for (const [key, value] of Object.entries(initialVars)) {
      this.set(key, value);
    }
  }

  /**
   * Set profile context
   */
  setProfile(profile) {
    this.profile = profile;
  }

  /**
   * Set session context
   */
  setSession(session) {
    this.session = session;
  }

  /**
   * Push loop context
   */
  pushLoop(loopVar) {
    this.loopStack.push(loopVar);
  }

  /**
   * Pop loop context
   */
  popLoop() {
    return this.loopStack.pop();
  }

  /**
   * Get current loop context
   */
  getCurrentLoop() {
    return this.loopStack.length > 0 ? this.loopStack[this.loopStack.length - 1] : null;
  }

  /**
   * Set a variable
   */
  set(name, value) {
    this.variables.set(name, value);
  }

  /**
   * Get a variable
   */
  get(name) {
    // Check custom variables first
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }

    // Check nested path (e.g., "profile.name", "data.email")
    const parts = name.split('.');
    const root = parts[0];

    if (root === 'profile' && this.profile) {
      return this.getNestedValue(this.profile, parts.slice(1));
    }

    if (root === 'session' && this.session) {
      return this.getNestedValue(this.session, parts.slice(1));
    }

    if (root === 'loop') {
      const loop = this.getCurrentLoop();
      if (loop) {
        return this.getNestedValue(loop, parts.slice(1));
      }
    }

    // Check if it's a nested path in custom variables
    if (this.variables.has(root)) {
      return this.getNestedValue(this.variables.get(root), parts.slice(1));
    }

    return undefined;
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    if (!obj || path.length === 0) return obj;

    let current = obj;
    for (const key of path) {
      // Handle array index access like [0]
      const match = key.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        current = current?.[match[1]]?.[parseInt(match[2])];
      } else {
        current = current?.[key];
      }
      if (current === undefined) return undefined;
    }
    return current;
  }

  /**
   * Get all variables as object
   */
  getAll() {
    const result = {};
    for (const [key, value] of this.variables) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Check if variable exists
   */
  has(name) {
    return this.get(name) !== undefined;
  }

  /**
   * Delete a variable
   */
  delete(name) {
    return this.variables.delete(name);
  }

  /**
   * Clear all custom variables
   */
  clear() {
    this.variables.clear();
  }
}

/**
 * Built-in variable generators
 */
const builtInVariables = {
  timestamp: () => Date.now(),
  date: () => new Date().toISOString().split('T')[0],
  time: () => new Date().toTimeString().split(' ')[0],
  datetime: () => new Date().toISOString().replace('T', ' ').split('.')[0],
  random: () => Math.floor(Math.random() * 1000000),
  uuid: () => crypto.randomUUID ? crypto.randomUUID() : generateUUID(),
};

/**
 * Generate UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Variable transformations (filters)
 */
const transformations = {
  // String transforms
  uppercase: (v) => String(v).toUpperCase(),
  lowercase: (v) => String(v).toLowerCase(),
  capitalize: (v) => String(v).replace(/\b\w/g, c => c.toUpperCase()),
  trim: (v) => String(v).trim(),
  truncate: (v, length = 50) => {
    const str = String(v);
    return str.length > length ? str.substring(0, length) + '...' : str;
  },
  split: (v, delimiter, index) => {
    const parts = String(v).split(delimiter);
    return index !== undefined ? parts[parseInt(index)] : parts;
  },
  replace: (v, search, replacement) => String(v).replace(new RegExp(search, 'g'), replacement),
  regex: (v, pattern) => {
    const match = String(v).match(new RegExp(pattern));
    return match ? match[0] : null;
  },
  length: (v) => String(v).length,
  reverse: (v) => String(v).split('').reverse().join(''),

  // Number transforms
  round: (v, decimals = 0) => {
    const num = parseFloat(v);
    return decimals === 0 ? Math.round(num) : parseFloat(num.toFixed(decimals));
  },
  floor: (v) => Math.floor(parseFloat(v)),
  ceil: (v) => Math.ceil(parseFloat(v)),
  abs: (v) => Math.abs(parseFloat(v)),
  pad: (v, length) => String(v).padStart(length, '0'),
  currency: (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v),
  number: (v) => parseFloat(v),
  int: (v) => parseInt(v, 10),

  // Date transforms
  date: (v) => new Date(parseInt(v) || v).toISOString().split('T')[0],
  time: (v) => new Date(parseInt(v) || v).toTimeString().split(' ')[0],
  datetime: (v) => new Date(parseInt(v) || v).toISOString().replace('T', ' ').split('.')[0],
  format: (v, pattern) => formatDate(new Date(parseInt(v) || v), pattern),

  // Encoding transforms
  urlencode: (v) => encodeURIComponent(String(v)),
  urldecode: (v) => decodeURIComponent(String(v)),
  base64: (v) => Buffer.from(String(v)).toString('base64'),
  base64decode: (v) => Buffer.from(String(v), 'base64').toString('utf8'),
  stringify: (v) => JSON.stringify(v),
  jsonparse: (v) => {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },

  // Array/Object transforms
  first: (v) => Array.isArray(v) ? v[0] : v,
  last: (v) => Array.isArray(v) ? v[v.length - 1] : v,
  join: (v, delimiter = ', ') => Array.isArray(v) ? v.join(delimiter) : v,
  count: (v) => Array.isArray(v) ? v.length : 1,
  keys: (v) => typeof v === 'object' ? Object.keys(v) : [],
  values: (v) => typeof v === 'object' ? Object.values(v) : [v],

  // Boolean transforms
  bool: (v) => Boolean(v),
  not: (v) => !v,

  // Default value
  default: (v, defaultValue) => v === undefined || v === null || v === '' ? defaultValue : v,
};

/**
 * Simple date formatting
 */
function formatDate(date, pattern) {
  const pad = (n) => String(n).padStart(2, '0');

  const replacements = {
    'YYYY': date.getFullYear(),
    'YY': String(date.getFullYear()).slice(-2),
    'MM': pad(date.getMonth() + 1),
    'DD': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds()),
  };

  let result = pattern;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replace(token, value);
  }
  return result;
}

/**
 * Interpolate variables in a string
 * Supports: {{variable}}, {{variable | transform}}, {{variable | transform:arg1:arg2}}
 */
function interpolate(template, store) {
  if (typeof template !== 'string') {
    return template;
  }

  // Match {{...}} patterns
  const pattern = /\{\{([^}]+)\}\}/g;

  return template.replace(pattern, (match, content) => {
    const trimmed = content.trim();

    // Check for transformation pipe
    const pipeIndex = trimmed.indexOf('|');
    let varName, transforms;

    if (pipeIndex !== -1) {
      varName = trimmed.substring(0, pipeIndex).trim();
      transforms = trimmed.substring(pipeIndex + 1).trim();
    } else {
      varName = trimmed;
      transforms = null;
    }

    // Get value
    let value;

    // Check built-in variables first
    if (builtInVariables[varName]) {
      value = builtInVariables[varName]();
    } else {
      value = store.get(varName);
    }

    // Apply transformations
    if (transforms && value !== undefined) {
      value = applyTransformations(value, transforms);
    }

    // Return value or original match if undefined
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Apply transformation chain
 */
function applyTransformations(value, transformString) {
  // Split by | for chained transforms
  const transforms = transformString.split('|').map(t => t.trim());

  for (const transform of transforms) {
    // Parse transform name and arguments
    const colonIndex = transform.indexOf(':');
    let name, args;

    if (colonIndex !== -1) {
      name = transform.substring(0, colonIndex).trim();
      args = transform.substring(colonIndex + 1).split(':').map(a => a.trim());
    } else {
      name = transform.trim();
      args = [];
    }

    // Apply transform
    const fn = transformations[name];
    if (fn) {
      value = fn(value, ...args);
    }
  }

  return value;
}

/**
 * Interpolate all string values in an object
 */
function interpolateObject(obj, store) {
  if (typeof obj === 'string') {
    return interpolate(obj, store);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, store));
  }

  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, store);
    }
    return result;
  }

  return obj;
}

/**
 * Evaluate simple expression
 * Supports: ==, !=, <, >, <=, >=, &&, ||, +, -, *, /
 */
function evaluateExpression(expression, store) {
  // First interpolate variables
  let expr = interpolate(expression, store);

  // Simple evaluation for comparison expressions
  // WARNING: This is a simplified evaluator, not a full expression parser

  // Boolean comparisons
  if (expr.includes('==')) {
    const [left, right] = expr.split('==').map(s => s.trim());
    return String(left) === String(right);
  }
  if (expr.includes('!=')) {
    const [left, right] = expr.split('!=').map(s => s.trim());
    return String(left) !== String(right);
  }
  if (expr.includes('>=')) {
    const [left, right] = expr.split('>=').map(s => s.trim());
    return parseFloat(left) >= parseFloat(right);
  }
  if (expr.includes('<=')) {
    const [left, right] = expr.split('<=').map(s => s.trim());
    return parseFloat(left) <= parseFloat(right);
  }
  if (expr.includes('>')) {
    const [left, right] = expr.split('>').map(s => s.trim());
    return parseFloat(left) > parseFloat(right);
  }
  if (expr.includes('<')) {
    const [left, right] = expr.split('<').map(s => s.trim());
    return parseFloat(left) < parseFloat(right);
  }

  // Boolean values
  if (expr === 'true') return true;
  if (expr === 'false') return false;

  // Try to evaluate as number expression
  try {
    // Only allow safe characters for math expressions
    if (/^[\d\s+\-*/().]+$/.test(expr)) {
      return new Function(`return (${expr})`)();
    }
  } catch {
    // Ignore evaluation errors
  }

  return expr;
}

module.exports = {
  VariableStore,
  builtInVariables,
  transformations,
  interpolate,
  interpolateObject,
  evaluateExpression,
};
