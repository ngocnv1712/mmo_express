<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let sidecarUrl = 'http://localhost:3456';

  const dispatch = createEventDispatcher();

  let debugSession = null;
  let isLoading = false;
  let error = null;

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  export async function startDebug(sessionId, workflow, options = {}) {
    isLoading = true;
    error = null;

    try {
      const result = await sendCommand('startDebug', {
        sessionId,
        workflow,
        options,
      });

      if (result.success) {
        debugSession = {
          ...result,
          sessionId,
        };
        show = true;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }

    isLoading = false;
  }

  async function step() {
    if (!debugSession?.debugId) return;

    isLoading = true;
    error = null;

    try {
      const result = await sendCommand('debugStep', {
        debugId: debugSession.debugId,
      });

      if (result.success) {
        debugSession = { ...debugSession, ...result };

        if (result.completed) {
          dispatch('complete', debugSession);
        }
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }

    isLoading = false;
  }

  async function continueExecution() {
    if (!debugSession?.debugId) return;

    isLoading = true;
    error = null;

    try {
      const result = await sendCommand('debugContinue', {
        debugId: debugSession.debugId,
      });

      if (result.success) {
        debugSession = { ...debugSession, ...result };

        if (result.completed) {
          dispatch('complete', debugSession);
        }
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }

    isLoading = false;
  }

  async function stop() {
    if (!debugSession?.debugId) return;

    isLoading = true;

    try {
      await sendCommand('debugStop', {
        debugId: debugSession.debugId,
      });

      debugSession = null;
      dispatch('stop');
    } catch (err) {
      error = err.message;
    }

    isLoading = false;
  }

  async function toggleBreakpoint(stepId) {
    if (!debugSession?.debugId) return;

    const isSet = debugSession.breakpoints?.includes(stepId);

    try {
      const result = await sendCommand('setBreakpoint', {
        debugId: debugSession.debugId,
        stepId,
        enabled: !isSet,
      });

      if (result.success) {
        debugSession.breakpoints = result.breakpoints;
      }
    } catch (err) {
      error = err.message;
    }
  }

  function close() {
    show = false;
    dispatch('close');
  }

  function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }
</script>

{#if show}
  <div class="debug-overlay" on:click={close}>
    <div class="debug-panel" on:click|stopPropagation>
      <div class="debug-header">
        <h3>Debug Mode</h3>
        <button class="btn-close" on:click={close}>&times;</button>
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {#if debugSession}
        <div class="debug-content">
          <!-- Status Bar -->
          <div class="status-bar">
            <div class="status-indicator" class:running={debugSession.status === 'running'} class:paused={debugSession.status === 'paused'} class:completed={debugSession.status === 'completed'}>
              {debugSession.status?.toUpperCase() || 'UNKNOWN'}
            </div>
            <div class="step-counter">
              Step {debugSession.currentStepIndex + 1} / {debugSession.totalSteps}
            </div>
          </div>

          <!-- Controls -->
          <div class="debug-controls">
            <button
              class="btn btn-step"
              on:click={step}
              disabled={isLoading || debugSession.status === 'completed'}
              title="Step Over (F10)"
            >
              <span class="icon">⏭</span> Step
            </button>
            <button
              class="btn btn-continue"
              on:click={continueExecution}
              disabled={isLoading || debugSession.status === 'completed'}
              title="Continue (F5)"
            >
              <span class="icon">▶</span> Continue
            </button>
            <button
              class="btn btn-stop"
              on:click={stop}
              disabled={isLoading}
              title="Stop (Shift+F5)"
            >
              <span class="icon">⏹</span> Stop
            </button>
          </div>

          <!-- Current Step -->
          {#if debugSession.currentStep}
            <div class="current-step-section">
              <h4>Current Step</h4>
              <div class="current-step">
                <span class="step-icon">{debugSession.currentStep.icon || '📦'}</span>
                <div class="step-info">
                  <span class="step-name">{debugSession.currentStep.name || debugSession.currentStep.type}</span>
                  <span class="step-type">{debugSession.currentStep.type}</span>
                </div>
              </div>

              {#if debugSession.currentStep.config}
                <div class="step-config">
                  <h5>Configuration</h5>
                  <pre>{JSON.stringify(debugSession.currentStep.config, null, 2)}</pre>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Variables -->
          <div class="variables-section">
            <h4>Variables</h4>
            <div class="variables-list">
              {#if debugSession.variables && Object.keys(debugSession.variables).length > 0}
                {#each Object.entries(debugSession.variables) as [name, value]}
                  <div class="variable-item">
                    <span class="var-name">{name}</span>
                    <span class="var-type">{typeof value}</span>
                    <span class="var-value">{formatValue(value)}</span>
                  </div>
                {/each}
              {:else}
                <div class="no-variables">No variables set</div>
              {/if}
            </div>
          </div>

          <!-- Last Step Result -->
          {#if debugSession.stepResult}
            <div class="result-section">
              <h4>Last Result</h4>
              <div class="step-result" class:success={debugSession.stepResult.success} class:error={!debugSession.stepResult.success}>
                <span class="result-icon">{debugSession.stepResult.success ? '✓' : '✗'}</span>
                <pre>{JSON.stringify(debugSession.stepResult.data || debugSession.stepResult, null, 2)}</pre>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="no-session">
          <p>No debug session active</p>
          <p class="hint">Start debugging from the workflow canvas</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .debug-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-end;
    z-index: 1000;
  }

  .debug-panel {
    width: 450px;
    height: 100%;
    background: var(--bg-secondary, #1a1a1a);
    border-left: 1px solid var(--border-color, #333);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-primary, #121212);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .debug-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--text-primary, #fff);
  }

  .error-message {
    padding: 8px 16px;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    font-size: 12px;
  }

  .debug-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .status-indicator {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(107, 114, 128, 0.3);
    color: #9ca3af;
  }

  .status-indicator.running {
    background: rgba(59, 130, 246, 0.3);
    color: #3b82f6;
  }

  .status-indicator.paused {
    background: rgba(245, 158, 11, 0.3);
    color: #f59e0b;
  }

  .status-indicator.completed {
    background: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .step-counter {
    font-size: 13px;
    color: var(--text-secondary, #888);
  }

  .debug-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn .icon {
    font-size: 14px;
  }

  .btn-step {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .btn-step:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
  }

  .btn-continue {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .btn-continue:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.3);
  }

  .btn-stop {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .btn-stop:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
  }

  .current-step-section,
  .variables-section,
  .result-section {
    margin-bottom: 20px;
  }

  h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  h5 {
    margin: 8px 0 6px 0;
    font-size: 11px;
    color: var(--text-secondary, #666);
  }

  .current-step {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
  }

  .step-icon {
    font-size: 24px;
  }

  .step-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .step-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .step-type {
    font-size: 11px;
    color: var(--text-secondary, #888);
    font-family: monospace;
  }

  .step-config {
    margin-top: 12px;
  }

  .step-config pre {
    margin: 0;
    padding: 8px;
    background: var(--bg-primary, #121212);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    overflow-x: auto;
    max-height: 100px;
  }

  .variables-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .variable-item {
    display: grid;
    grid-template-columns: 100px 60px 1fr;
    gap: 8px;
    padding: 8px;
    background: var(--bg-primary, #121212);
    border-radius: 4px;
    font-size: 12px;
    align-items: start;
  }

  .var-name {
    color: #a78bfa;
    font-family: monospace;
    font-weight: 500;
    word-break: break-all;
  }

  .var-type {
    color: var(--text-secondary, #666);
    font-size: 10px;
    text-transform: uppercase;
  }

  .var-value {
    color: var(--text-primary, #fff);
    font-family: monospace;
    word-break: break-all;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-variables {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary, #666);
    font-size: 12px;
  }

  .step-result {
    padding: 12px;
    background: var(--bg-primary, #121212);
    border-radius: 6px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .step-result.success {
    border-left: 3px solid #22c55e;
  }

  .step-result.error {
    border-left: 3px solid #ef4444;
  }

  .result-icon {
    font-size: 16px;
  }

  .step-result.success .result-icon {
    color: #22c55e;
  }

  .step-result.error .result-icon {
    color: #ef4444;
  }

  .step-result pre {
    margin: 0;
    font-size: 11px;
    color: var(--text-secondary, #888);
    overflow-x: auto;
    flex: 1;
    max-height: 150px;
  }

  .no-session {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary, #666);
    text-align: center;
    padding: 40px;
  }

  .no-session p {
    margin: 4px 0;
  }

  .no-session .hint {
    font-size: 12px;
    color: var(--text-secondary, #666);
  }
</style>
