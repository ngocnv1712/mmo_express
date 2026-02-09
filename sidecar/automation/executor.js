/**
 * Workflow Executor
 * Executes workflow steps sequentially with control flow support
 */

const { VariableStore, interpolate, interpolateObject, evaluateExpression } = require('./variables');
const { getAction, hasAction } = require('./actions');
const EventEmitter = require('events');

/**
 * Execution status
 */
const ExecutionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STOPPED: 'stopped',
};

/**
 * Debug Mode State
 * Stores active debug sessions
 */
const debugSessions = new Map();

/**
 * Step result
 */
class StepResult {
  constructor(stepId, success, data = {}) {
    this.stepId = stepId;
    this.success = success;
    this.timestamp = Date.now();
    this.data = data;
  }
}

/**
 * Workflow Executor
 */
class WorkflowExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.logger = options.logger || console;
  }

  /**
   * Execute a workflow in debug mode (step-by-step)
   */
  async executeDebug(workflow, context, debugOptions = {}) {
    const debugId = `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const debugSession = {
      id: debugId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: ExecutionStatus.PAUSED,
      currentStepIndex: 0,
      totalSteps: workflow.steps?.length || 0,
      currentStep: null,
      variables: {},
      results: [],
      breakpoints: new Set(debugOptions.breakpoints || []),
      startedAt: Date.now(),
      pausedAt: Date.now(),
    };

    debugSessions.set(debugId, debugSession);

    // Initialize variable store
    const variables = new VariableStore(workflow.variables || {});
    if (context.profile) {
      variables.setProfile(context.profile);
    }
    if (context.session) {
      variables.setSession({
        id: context.session.id,
        url: context.page?.url() || '',
        title: '',
      });
    }
    if (context.parameters) {
      for (const [key, value] of Object.entries(context.parameters)) {
        variables.set(key, value);
      }
    }

    debugSession.variableStore = variables;
    debugSession.context = {
      ...context,
      variables: {
        store: variables,
        interpolate: (str) => interpolate(str, variables),
        interpolateObject: (obj) => interpolateObject(obj, variables),
        evaluate: (expr) => evaluateExpression(expr, variables),
      },
      logger: this.logger,
      execution: {
        workflowId: workflow.id,
        workflowName: workflow.name,
        results: debugSession.results,
      },
    };
    debugSession.workflow = workflow;

    // Update variables snapshot
    debugSession.variables = variables.getAll();

    return {
      success: true,
      debugId,
      status: 'paused',
      currentStepIndex: 0,
      totalSteps: debugSession.totalSteps,
      currentStep: workflow.steps?.[0] || null,
      variables: debugSession.variables,
    };
  }

  /**
   * Step to next action in debug mode
   */
  async debugStep(debugId) {
    const session = debugSessions.get(debugId);
    if (!session) {
      return { success: false, error: 'Debug session not found' };
    }

    if (session.status === ExecutionStatus.COMPLETED || session.status === ExecutionStatus.FAILED) {
      return { success: false, error: 'Debug session already finished' };
    }

    const steps = session.workflow.steps || [];
    if (session.currentStepIndex >= steps.length) {
      session.status = ExecutionStatus.COMPLETED;
      session.completedAt = Date.now();
      return {
        success: true,
        status: 'completed',
        results: session.results,
      };
    }

    session.status = ExecutionStatus.RUNNING;
    const step = steps[session.currentStepIndex];
    session.currentStep = step;

    try {
      const result = await this.executeStep(step, session.context);
      session.results.push(result);

      session.currentStepIndex++;
      session.variables = session.variableStore.getAll();

      if (session.currentStepIndex >= steps.length) {
        session.status = ExecutionStatus.COMPLETED;
        session.completedAt = Date.now();
      } else {
        session.status = ExecutionStatus.PAUSED;
        session.pausedAt = Date.now();
        session.currentStep = steps[session.currentStepIndex];
      }

      return {
        success: true,
        status: session.status,
        stepResult: result,
        currentStepIndex: session.currentStepIndex,
        totalSteps: session.totalSteps,
        currentStep: session.currentStep,
        variables: session.variables,
        completed: session.status === ExecutionStatus.COMPLETED,
      };
    } catch (error) {
      session.status = ExecutionStatus.FAILED;
      session.error = error.message;
      return {
        success: false,
        status: 'failed',
        error: error.message,
        currentStepIndex: session.currentStepIndex,
        variables: session.variables,
      };
    }
  }

  /**
   * Continue execution until next breakpoint or end
   */
  async debugContinue(debugId) {
    const session = debugSessions.get(debugId);
    if (!session) {
      return { success: false, error: 'Debug session not found' };
    }

    const results = [];
    while (session.status !== ExecutionStatus.COMPLETED && session.status !== ExecutionStatus.FAILED) {
      const stepId = session.workflow.steps?.[session.currentStepIndex]?.id;

      // Check for breakpoint
      if (session.breakpoints.has(stepId) && session.currentStepIndex > 0) {
        session.status = ExecutionStatus.PAUSED;
        break;
      }

      const result = await this.debugStep(debugId);
      results.push(result);

      if (!result.success || result.completed) {
        break;
      }
    }

    return {
      success: true,
      status: session.status,
      stepResults: results,
      currentStepIndex: session.currentStepIndex,
      totalSteps: session.totalSteps,
      currentStep: session.currentStep,
      variables: session.variables,
      completed: session.status === ExecutionStatus.COMPLETED,
    };
  }

  /**
   * Stop debug session
   */
  debugStop(debugId) {
    const session = debugSessions.get(debugId);
    if (!session) {
      return { success: false, error: 'Debug session not found' };
    }

    session.status = ExecutionStatus.STOPPED;
    session.stoppedAt = Date.now();

    return {
      success: true,
      status: 'stopped',
      results: session.results,
    };
  }

  /**
   * Get debug session state
   */
  getDebugState(debugId) {
    const session = debugSessions.get(debugId);
    if (!session) {
      return { success: false, error: 'Debug session not found' };
    }

    return {
      success: true,
      debugId: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      status: session.status,
      currentStepIndex: session.currentStepIndex,
      totalSteps: session.totalSteps,
      currentStep: session.currentStep,
      variables: session.variables,
      results: session.results,
      breakpoints: Array.from(session.breakpoints),
    };
  }

  /**
   * Set/unset breakpoint
   */
  setBreakpoint(debugId, stepId, enabled = true) {
    const session = debugSessions.get(debugId);
    if (!session) {
      return { success: false, error: 'Debug session not found' };
    }

    if (enabled) {
      session.breakpoints.add(stepId);
    } else {
      session.breakpoints.delete(stepId);
    }

    return {
      success: true,
      breakpoints: Array.from(session.breakpoints),
    };
  }

  /**
   * Modify variable in debug session
   */
  setDebugVariable(debugId, name, value) {
    const session = debugSessions.get(debugId);
    if (!session) {
      return { success: false, error: 'Debug session not found' };
    }

    session.variableStore.set(name, value);
    session.variables = session.variableStore.getAll();

    return {
      success: true,
      variables: session.variables,
    };
  }

  /**
   * Clean up debug session
   */
  cleanupDebugSession(debugId) {
    return debugSessions.delete(debugId);
  }

  /**
   * List active debug sessions
   */
  static listDebugSessions() {
    const result = [];
    for (const [id, session] of debugSessions) {
      result.push({
        id,
        workflowId: session.workflowId,
        workflowName: session.workflowName,
        status: session.status,
        currentStepIndex: session.currentStepIndex,
        totalSteps: session.totalSteps,
        startedAt: session.startedAt,
      });
    }
    return result;
  }

  /**
   * Execute a workflow
   */
  async execute(workflow, context) {
    const execution = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: ExecutionStatus.RUNNING,
      startedAt: Date.now(),
      completedAt: null,
      results: [],
      error: null,
    };

    // Initialize variable store
    const variables = new VariableStore(workflow.variables || {});

    // Set profile and session
    if (context.profile) {
      variables.setProfile(context.profile);
    }
    if (context.session) {
      variables.setSession({
        id: context.session.id,
        url: context.page?.url() || '',
        title: '',
      });
    }

    // Merge in parameters
    if (context.parameters) {
      for (const [key, value] of Object.entries(context.parameters)) {
        variables.set(key, value);
      }
    }

    // Create execution context
    const execContext = {
      ...context,
      variables: {
        store: variables,
        interpolate: (str) => interpolate(str, variables),
        interpolateObject: (obj) => interpolateObject(obj, variables),
        evaluate: (expr) => evaluateExpression(expr, variables),
      },
      logger: this.logger,
      workflowManager: this,
      execution,
    };

    try {
      // Execute steps
      await this.executeSteps(workflow.steps, execContext);

      execution.status = ExecutionStatus.COMPLETED;
    } catch (error) {
      execution.status = ExecutionStatus.FAILED;
      execution.error = error.message;
      this.logger.error(`[WORKFLOW] Execution failed: ${error.message}`);
    }

    execution.completedAt = Date.now();
    execution.duration = execution.completedAt - execution.startedAt;

    return execution;
  }

  /**
   * Execute array of steps
   */
  async executeSteps(steps, context) {
    for (const step of steps) {
      const result = await this.executeStep(step, context);
      context.execution.results.push(result);

      // Handle control flow returns
      if (result.data?.stop) {
        if (result.data.status === 'failed') {
          throw new Error(result.data.message || 'Workflow stopped with failed status');
        }
        break;
      }

      if (result.data?.break || result.data?.continue) {
        return result;
      }

      if (!result.success && !context.continueOnError) {
        throw new Error(`Step "${step.name || step.id}" failed: ${result.data?.error || 'Unknown error'}`);
      }
    }

    return { success: true };
  }

  /**
   * Execute a single step
   */
  async executeStep(step, context) {
    const { id, type, name, config = {} } = step;

    this.logger.error(`[STEP] Executing: ${name || type} (${id})`);

    // Check if action exists
    if (!hasAction(type)) {
      return new StepResult(id, false, { error: `Unknown action type: ${type}` });
    }

    const action = getAction(type);

    try {
      // Interpolate config values
      const interpolatedConfig = context.variables.interpolateObject(config);

      // Execute action
      const result = await action.execute(context, interpolatedConfig);

      // Handle control flow actions
      if (action.isControlFlow) {
        return await this.handleControlFlow(step, result, context);
      }

      this.logger.error(`[STEP] Completed: ${name || type}`);
      return new StepResult(id, result.success, result);
    } catch (error) {
      this.logger.error(`[STEP] Failed: ${name || type} - ${error.message}`);
      return new StepResult(id, false, { error: error.message });
    }
  }

  /**
   * Handle control flow actions (if, loop, try-catch)
   */
  async handleControlFlow(step, result, context) {
    const { type } = step;

    // Condition (if/else)
    if (type === 'condition') {
      return await this.handleCondition(step, result, context);
    }

    // Loops
    if (result.isLoop) {
      return await this.handleLoop(step, result, context);
    }

    // Try-Catch
    if (result.isTryCatch) {
      return await this.handleTryCatch(step, result, context);
    }

    // Simple control flow (break, continue, stop, log)
    return new StepResult(step.id, result.success, result);
  }

  /**
   * Handle if/else condition
   */
  async handleCondition(step, result, context) {
    const conditionMet = result.conditionResult;

    if (conditionMet && step.then && step.then.length > 0) {
      this.logger.error(`[CONDITION] Taking THEN branch`);
      const branchResult = await this.executeSteps(step.then, context);
      return new StepResult(step.id, true, { branch: 'then', ...branchResult });
    } else if (!conditionMet && step.else && step.else.length > 0) {
      this.logger.error(`[CONDITION] Taking ELSE branch`);
      const branchResult = await this.executeSteps(step.else, context);
      return new StepResult(step.id, true, { branch: 'else', ...branchResult });
    }

    return new StepResult(step.id, true, {
      branch: conditionMet ? 'then' : 'else',
      conditionResult: conditionMet,
    });
  }

  /**
   * Handle loops
   */
  async handleLoop(step, result, context) {
    const { loopType, count, variableName, items, condition, maxIterations } = result;
    const { variables } = context;

    let iterations = 0;
    const maxIter = maxIterations || count || (items?.length) || 100;

    this.logger.error(`[LOOP] Starting ${loopType} loop, max ${maxIter} iterations`);

    for (let i = 0; i < maxIter; i++) {
      iterations++;

      // Set loop variables
      const loopContext = {
        index: i,
        count: i + 1,
        first: i === 0,
        last: i === maxIter - 1,
      };

      // Handle different loop types
      if (loopType === 'while') {
        const conditionResult = variables.evaluate(condition);
        if (!conditionResult) {
          this.logger.error(`[LOOP] While condition false, exiting`);
          break;
        }
        variables.store.set(variableName, i);
      } else if (loopType === 'array' && items) {
        variables.store.set(variableName, items[i]);
        loopContext.item = items[i];
      } else if (loopType === 'elements') {
        // For element loops, we need to get element data
        variables.store.set(variableName, { index: i });
      } else {
        variables.store.set(variableName, i);
      }

      // Push loop context
      variables.store.pushLoop(loopContext);

      try {
        // Execute loop body
        if (step.body && step.body.length > 0) {
          const bodyResult = await this.executeSteps(step.body, context);

          // Handle break/continue
          if (bodyResult.data?.break) {
            this.logger.error(`[LOOP] Break at iteration ${i}`);
            break;
          }
          if (bodyResult.data?.continue) {
            this.logger.error(`[LOOP] Continue at iteration ${i}`);
            continue;
          }
        }
      } finally {
        variables.store.popLoop();
      }
    }

    this.logger.error(`[LOOP] Completed after ${iterations} iterations`);
    return new StepResult(step.id, true, { loopType, iterations });
  }

  /**
   * Handle try-catch blocks
   */
  async handleTryCatch(step, result, context) {
    const { errorVariable, continueOnError } = result;

    try {
      // Execute try block
      if (step.try && step.try.length > 0) {
        await this.executeSteps(step.try, { ...context, continueOnError: false });
      }

      return new StepResult(step.id, true, { caught: false });
    } catch (error) {
      this.logger.error(`[TRY-CATCH] Caught error: ${error.message}`);

      // Set error variable
      context.variables.store.set(errorVariable, {
        message: error.message,
        stack: error.stack,
      });

      // Execute catch block
      if (step.catch && step.catch.length > 0) {
        await this.executeSteps(step.catch, context);
      }

      // Execute finally block
      if (step.finally && step.finally.length > 0) {
        await this.executeSteps(step.finally, context);
      }

      if (!continueOnError) {
        throw error;
      }

      return new StepResult(step.id, true, { caught: true, error: error.message });
    }
  }

  /**
   * Execute workflow asynchronously (fire and forget)
   */
  async executeWorkflowAsync(workflowId, context) {
    // This would load workflow from database and execute
    // For now, just log
    this.logger.error(`[WORKFLOW] Async execution requested for: ${workflowId}`);
  }
}

/**
 * Batch Executor - runs workflow on multiple profiles
 */
class BatchExecutor {
  constructor(options = {}) {
    this.options = options;
    this.logger = options.logger || console;
    this.executor = new WorkflowExecutor(options);
  }

  /**
   * Execute workflow on multiple profiles
   */
  async executeBatch(workflow, profiles, options = {}) {
    const {
      mode = 'sequential', // 'sequential' or 'parallel'
      parallelLimit = 5,
      delayBetween = [1000, 3000], // Random delay range [min, max] ms
      onProgress = null,
      onError = 'continue', // 'continue', 'stop', 'retry'
      maxRetries = 3,
    } = options;

    const batchExecution = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      totalProfiles: profiles.length,
      completed: 0,
      failed: 0,
      results: [],
      startedAt: Date.now(),
      completedAt: null,
    };

    this.logger.error(`[BATCH] Starting batch execution: ${profiles.length} profiles`);

    if (mode === 'parallel') {
      await this.executeParallel(workflow, profiles, batchExecution, {
        parallelLimit,
        delayBetween,
        onProgress,
        onError,
        maxRetries,
      });
    } else {
      await this.executeSequential(workflow, profiles, batchExecution, {
        delayBetween,
        onProgress,
        onError,
        maxRetries,
      });
    }

    batchExecution.completedAt = Date.now();
    batchExecution.duration = batchExecution.completedAt - batchExecution.startedAt;

    this.logger.error(`[BATCH] Completed: ${batchExecution.completed}/${batchExecution.totalProfiles} succeeded`);

    return batchExecution;
  }

  /**
   * Execute profiles sequentially
   */
  async executeSequential(workflow, profiles, batchExecution, options) {
    for (const profile of profiles) {
      const result = await this.executeForProfile(workflow, profile, options);
      batchExecution.results.push(result);

      if (result.success) {
        batchExecution.completed++;
      } else {
        batchExecution.failed++;
        if (options.onError === 'stop') {
          break;
        }
      }

      if (options.onProgress) {
        options.onProgress(batchExecution);
      }

      // Random delay between profiles
      const [minDelay, maxDelay] = options.delayBetween;
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  /**
   * Execute profiles in parallel with limit
   */
  async executeParallel(workflow, profiles, batchExecution, options) {
    const { parallelLimit } = options;
    const chunks = [];

    // Split into chunks
    for (let i = 0; i < profiles.length; i += parallelLimit) {
      chunks.push(profiles.slice(i, i + parallelLimit));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(profile =>
        this.executeForProfile(workflow, profile, options)
      );

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchExecution.results.push(result.value);
          if (result.value.success) {
            batchExecution.completed++;
          } else {
            batchExecution.failed++;
          }
        } else {
          batchExecution.results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
          batchExecution.failed++;
        }
      }

      if (options.onProgress) {
        options.onProgress(batchExecution);
      }
    }
  }

  /**
   * Execute workflow for a single profile
   */
  async executeForProfile(workflow, profile, options) {
    let attempts = 0;
    const maxRetries = options.maxRetries || 1;

    while (attempts < maxRetries) {
      attempts++;

      try {
        // Note: In real implementation, this would create browser context
        // and pass page to executor. Here we show the structure.
        const context = {
          profile,
          // page, browserContext would be added by caller
        };

        const result = await this.executor.execute(workflow, context);

        return {
          profileId: profile.id,
          profileName: profile.name,
          success: result.status === ExecutionStatus.COMPLETED,
          attempts,
          result,
        };
      } catch (error) {
        if (attempts >= maxRetries || options.onError !== 'retry') {
          return {
            profileId: profile.id,
            profileName: profile.name,
            success: false,
            attempts,
            error: error.message,
          };
        }

        this.logger.error(`[BATCH] Retry ${attempts}/${maxRetries} for ${profile.name}`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}

module.exports = {
  WorkflowExecutor,
  BatchExecutor,
  ExecutionStatus,
  StepResult,
};
