/**
 * Action Registry
 * Central registry for all workflow actions
 */

const navigation = require('./navigation');
const interaction = require('./interaction');
const wait = require('./wait');
const data = require('./data');
const control = require('./control');
const advanced = require('./advanced');
const utility = require('./utility');
const file = require('./file');
const http = require('./http');
const googlesheets = require('./googlesheets');
const ai = require('./ai');

/**
 * All available action types
 */
const ACTION_CATEGORIES = {
  navigation: {
    name: 'Navigation',
    icon: '🌐',
    actions: navigation,
  },
  interaction: {
    name: 'Interaction',
    icon: '👆',
    actions: interaction,
  },
  wait: {
    name: 'Wait',
    icon: '⏱️',
    actions: wait,
  },
  data: {
    name: 'Data',
    icon: '📊',
    actions: data,
  },
  control: {
    name: 'Control Flow',
    icon: '🔀',
    actions: control,
  },
  utility: {
    name: 'Utility',
    icon: '🔧',
    actions: utility,
  },
  file: {
    name: 'File',
    icon: '📁',
    actions: file,
  },
  http: {
    name: 'HTTP',
    icon: '🌐',
    actions: http,
  },
  googlesheets: {
    name: 'Google Sheets',
    icon: '📊',
    actions: googlesheets,
  },
  ai: {
    name: 'AI',
    icon: '🤖',
    actions: ai,
  },
  advanced: {
    name: 'Advanced',
    icon: '💻',
    actions: advanced,
  },
};

/**
 * Flat map of all actions by type
 */
const actionRegistry = {};

for (const category of Object.values(ACTION_CATEGORIES)) {
  for (const [type, action] of Object.entries(category.actions)) {
    actionRegistry[type] = action;
  }
}

/**
 * Get action by type
 */
function getAction(type) {
  return actionRegistry[type];
}

/**
 * Check if action type exists
 */
function hasAction(type) {
  return type in actionRegistry;
}

/**
 * Get all action types
 */
function getActionTypes() {
  return Object.keys(actionRegistry);
}

/**
 * Get action schema (for UI generation)
 */
function getActionSchema(type) {
  const action = actionRegistry[type];
  if (!action) return null;

  return {
    type,
    name: action.name,
    description: action.description,
    icon: action.icon,
    category: action.category,
    configSchema: action.configSchema || {},
  };
}

/**
 * Get all action schemas grouped by category
 */
function getAllActionSchemas() {
  const result = {};

  for (const [categoryKey, category] of Object.entries(ACTION_CATEGORIES)) {
    result[categoryKey] = {
      name: category.name,
      icon: category.icon,
      actions: {},
    };

    for (const [type, action] of Object.entries(category.actions)) {
      result[categoryKey].actions[type] = {
        type,
        name: action.name,
        description: action.description,
        icon: action.icon,
        configSchema: action.configSchema || {},
      };
    }
  }

  return result;
}

/**
 * Validate action config against schema
 */
function validateActionConfig(type, config) {
  const action = actionRegistry[type];
  if (!action) {
    return { valid: false, errors: [`Unknown action type: ${type}`] };
  }

  const schema = action.configSchema || {};
  const errors = [];

  // Check required fields
  for (const [field, fieldSchema] of Object.entries(schema)) {
    if (fieldSchema.required && (config[field] === undefined || config[field] === '')) {
      errors.push(`Missing required field: ${field}`);
    }

    // Type validation
    if (config[field] !== undefined && fieldSchema.type) {
      const value = config[field];
      const expectedType = fieldSchema.type;

      if (expectedType === 'number' && typeof value !== 'number' && isNaN(parseFloat(value))) {
        errors.push(`Field ${field} must be a number`);
      }
      if (expectedType === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Field ${field} must be a boolean`);
      }
      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push(`Field ${field} must be a string`);
      }
      if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field ${field} must be an array`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  ACTION_CATEGORIES,
  actionRegistry,
  getAction,
  hasAction,
  getActionTypes,
  getActionSchema,
  getAllActionSchemas,
  validateActionConfig,
};
