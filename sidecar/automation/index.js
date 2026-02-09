/**
 * MMO Express - No-Code Automation System
 * Main entry point for workflow automation
 */

const { WorkflowExecutor, BatchExecutor, ExecutionStatus } = require('./executor');
const { VariableStore, interpolate, evaluateExpression } = require('./variables');
const { getAction, hasAction, getActionTypes, getAllActionSchemas } = require('./actions');

/**
 * Workflow Manager
 * Handles workflow storage, execution, and management
 */
class WorkflowManager {
  constructor(options = {}) {
    this.options = options;
    this.workflows = new Map(); // In-memory storage (would be replaced with DB)
    this.executor = new WorkflowExecutor(options);
    this.batchExecutor = new BatchExecutor(options);
    this.runningExecutions = new Map();
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow) {
    // Validate workflow
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }

    this.workflows.set(workflow.id, {
      ...workflow,
      registeredAt: Date.now(),
    });

    return { success: true, workflowId: workflow.id };
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * List all workflows
   */
  listWorkflows() {
    const result = [];
    for (const [id, workflow] of this.workflows) {
      result.push({
        id,
        name: workflow.name,
        description: workflow.description,
        stepsCount: workflow.steps?.length || 0,
        registeredAt: workflow.registeredAt,
      });
    }
    return result;
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(workflowId) {
    return this.workflows.delete(workflowId);
  }

  /**
   * Validate a workflow
   */
  validateWorkflow(workflow) {
    const errors = [];

    if (!workflow.id) {
      errors.push('Workflow must have an ID');
    }

    if (!workflow.name) {
      errors.push('Workflow must have a name');
    }

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      errors.push('Workflow must have steps array');
    } else {
      // Validate each step
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepErrors = this.validateStep(step, i);
        errors.push(...stepErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single step
   */
  validateStep(step, index) {
    const errors = [];
    const prefix = `Step ${index + 1}`;

    if (!step.id) {
      errors.push(`${prefix}: Missing step ID`);
    }

    if (!step.type) {
      errors.push(`${prefix}: Missing step type`);
    } else if (!hasAction(step.type)) {
      errors.push(`${prefix}: Unknown action type "${step.type}"`);
    }

    // Recursively validate nested steps
    if (step.then) {
      for (let i = 0; i < step.then.length; i++) {
        errors.push(...this.validateStep(step.then[i], i).map(e => `${prefix}.then.${e}`));
      }
    }
    if (step.else) {
      for (let i = 0; i < step.else.length; i++) {
        errors.push(...this.validateStep(step.else[i], i).map(e => `${prefix}.else.${e}`));
      }
    }
    if (step.body) {
      for (let i = 0; i < step.body.length; i++) {
        errors.push(...this.validateStep(step.body[i], i).map(e => `${prefix}.body.${e}`));
      }
    }
    if (step.try) {
      for (let i = 0; i < step.try.length; i++) {
        errors.push(...this.validateStep(step.try[i], i).map(e => `${prefix}.try.${e}`));
      }
    }
    if (step.catch) {
      for (let i = 0; i < step.catch.length; i++) {
        errors.push(...this.validateStep(step.catch[i], i).map(e => `${prefix}.catch.${e}`));
      }
    }

    return errors;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowIdOrObj, context) {
    const workflow = typeof workflowIdOrObj === 'string'
      ? this.getWorkflow(workflowIdOrObj)
      : workflowIdOrObj;

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowIdOrObj}`);
    }

    // Create execution ID
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store running execution
    this.runningExecutions.set(executionId, {
      workflowId: workflow.id,
      status: 'running',
      startedAt: Date.now(),
    });

    try {
      const result = await this.executor.execute(workflow, {
        ...context,
        workflowManager: this,
      });

      this.runningExecutions.set(executionId, {
        ...this.runningExecutions.get(executionId),
        status: result.status,
        completedAt: Date.now(),
        result,
      });

      return {
        executionId,
        ...result,
      };
    } catch (error) {
      this.runningExecutions.set(executionId, {
        ...this.runningExecutions.get(executionId),
        status: 'failed',
        completedAt: Date.now(),
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Execute workflow on multiple profiles
   */
  async executeBatch(workflowIdOrObj, profiles, options = {}) {
    const workflow = typeof workflowIdOrObj === 'string'
      ? this.getWorkflow(workflowIdOrObj)
      : workflowIdOrObj;

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowIdOrObj}`);
    }

    return await this.batchExecutor.executeBatch(workflow, profiles, options);
  }

  /**
   * Get running executions
   */
  getRunningExecutions() {
    const result = [];
    for (const [id, exec] of this.runningExecutions) {
      result.push({ executionId: id, ...exec });
    }
    return result;
  }

  /**
   * Stop a running execution (if possible)
   */
  stopExecution(executionId) {
    const exec = this.runningExecutions.get(executionId);
    if (exec && exec.status === 'running') {
      // Mark as stopped - actual stopping depends on implementation
      this.runningExecutions.set(executionId, {
        ...exec,
        status: 'stopped',
        stoppedAt: Date.now(),
      });
      return true;
    }
    return false;
  }
}

/**
 * Create workflow from JSON
 */
function parseWorkflow(json) {
  if (typeof json === 'string') {
    return JSON.parse(json);
  }
  return json;
}

/**
 * Create a new workflow builder
 */
function createWorkflow(id, name) {
  return {
    id,
    name,
    version: '1.0.0',
    description: '',
    parameters: [],
    variables: {},
    steps: [],

    addStep(type, config, options = {}) {
      this.steps.push({
        id: `step-${this.steps.length + 1}`,
        type,
        name: options.name || type,
        config,
      });
      return this;
    },

    addCondition(conditionConfig, thenSteps = [], elseSteps = []) {
      this.steps.push({
        id: `step-${this.steps.length + 1}`,
        type: 'condition',
        name: 'Condition',
        config: conditionConfig,
        then: thenSteps,
        else: elseSteps,
      });
      return this;
    },

    addLoop(loopType, loopConfig, bodySteps = []) {
      this.steps.push({
        id: `step-${this.steps.length + 1}`,
        type: loopType,
        name: `Loop (${loopType})`,
        config: loopConfig,
        body: bodySteps,
      });
      return this;
    },

    setVariable(name, value) {
      this.variables[name] = value;
      return this;
    },

    addParameter(name, type, options = {}) {
      this.parameters.push({
        name,
        type,
        ...options,
      });
      return this;
    },

    build() {
      return {
        id: this.id,
        name: this.name,
        version: this.version,
        description: this.description,
        parameters: this.parameters,
        variables: this.variables,
        steps: this.steps,
      };
    },
  };
}

// Export everything
module.exports = {
  // Main classes
  WorkflowManager,
  WorkflowExecutor,
  BatchExecutor,

  // Variables
  VariableStore,
  interpolate,
  evaluateExpression,

  // Actions
  getAction,
  hasAction,
  getActionTypes,
  getAllActionSchemas,

  // Utilities
  parseWorkflow,
  createWorkflow,
  ExecutionStatus,
};
