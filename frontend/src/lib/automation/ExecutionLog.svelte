<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let show = false;
  export let execution = null;
  export let sidecarUrl = 'http://localhost:3456';

  const dispatch = createEventDispatcher();

  let logs = [];
  let autoScroll = true;
  let logContainer;
  let pollInterval;

  $: if (show && execution) {
    startPolling();
  } else {
    stopPolling();
  }

  onDestroy(() => {
    stopPolling();
  });

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(fetchLogs, 500);
    fetchLogs();
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function fetchLogs() {
    if (!execution?.id) return;

    try {
      const response = await fetch(sidecarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getExecutionLogs',
          executionId: execution.id,
        }),
      });
      const result = await response.json();
      if (result.success && result.logs) {
        logs = result.logs;
        if (autoScroll && logContainer) {
          setTimeout(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
          }, 50);
        }
      }

      // Check if execution is complete
      if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
        stopPolling();
        dispatch('complete', { status: result.status });
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }

  function cancelExecution() {
    dispatch('cancel');
  }

  function close() {
    show = false;
    stopPolling();
    dispatch('close');
  }

  function getLogIcon(type) {
    switch (type) {
      case 'start': return '🚀';
      case 'action': return '▶️';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'complete': return '🎉';
      default: return '📝';
    }
  }

  function getLogClass(type) {
    switch (type) {
      case 'success':
      case 'complete':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return '';
    }
  }

  function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
</script>

{#if show}
  <div class="execution-log-panel">
    <div class="log-header">
      <div class="header-left">
        <h4>📋 Execution Log</h4>
        {#if execution}
          <span class="execution-status" class:running={execution.status === 'running'}>
            {execution.status || 'running'}
          </span>
        {/if}
      </div>
      <div class="header-right">
        <label class="auto-scroll-toggle">
          <input type="checkbox" bind:checked={autoScroll} />
          Auto-scroll
        </label>
        {#if execution?.status === 'running'}
          <button class="btn btn-cancel" on:click={cancelExecution}>
            ⏹️ Cancel
          </button>
        {/if}
        <button class="btn-close" on:click={close}>&times;</button>
      </div>
    </div>

    <div class="log-body" bind:this={logContainer}>
      {#if logs.length === 0}
        <div class="empty-log">
          <div class="spinner"></div>
          <p>Waiting for execution to start...</p>
        </div>
      {:else}
        {#each logs as log, index}
          <div class="log-entry {getLogClass(log.type)}">
            <span class="log-time">{formatTime(log.timestamp)}</span>
            <span class="log-icon">{getLogIcon(log.type)}</span>
            <span class="log-message">{log.message}</span>
            {#if log.duration}
              <span class="log-duration">{formatDuration(log.duration)}</span>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    {#if execution}
      <div class="log-footer">
        <div class="stats">
          <span class="stat">
            <span class="stat-label">Actions:</span>
            <span class="stat-value">{execution.completedActions || 0}/{execution.totalActions || 0}</span>
          </span>
          {#if execution.startTime}
            <span class="stat">
              <span class="stat-label">Duration:</span>
              <span class="stat-value">{formatDuration(Date.now() - new Date(execution.startTime).getTime())}</span>
            </span>
          {/if}
          {#if execution.errors > 0}
            <span class="stat error">
              <span class="stat-label">Errors:</span>
              <span class="stat-value">{execution.errors}</span>
            </span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .execution-log-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 500px;
    max-width: 90vw;
    height: 400px;
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px 12px 0 0;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
    z-index: 900;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
    background: var(--bg-primary, #121212);
    border-radius: 12px 12px 0 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .log-header h4 {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary, #fff);
  }

  .execution-status {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(107, 114, 128, 0.3);
    color: #9ca3af;
    text-transform: uppercase;
  }

  .execution-status.running {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .auto-scroll-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary, #888);
    cursor: pointer;
  }

  .auto-scroll-toggle input {
    cursor: pointer;
  }

  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-cancel {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .btn-cancel:hover {
    background: rgba(239, 68, 68, 0.3);
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

  .log-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
  }

  .empty-log {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary, #888);
  }

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid var(--border-color, #333);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .log-entry {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .log-entry:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .log-entry.success {
    background: rgba(34, 197, 94, 0.08);
  }

  .log-entry.error {
    background: rgba(239, 68, 68, 0.08);
  }

  .log-entry.warning {
    background: rgba(245, 158, 11, 0.08);
  }

  .log-time {
    color: var(--text-secondary, #666);
    font-size: 10px;
    min-width: 65px;
  }

  .log-icon {
    font-size: 12px;
  }

  .log-message {
    flex: 1;
    color: var(--text-primary, #e0e0e0);
    word-break: break-word;
  }

  .log-entry.success .log-message {
    color: #22c55e;
  }

  .log-entry.error .log-message {
    color: #f87171;
  }

  .log-entry.warning .log-message {
    color: #fbbf24;
  }

  .log-duration {
    color: var(--text-secondary, #888);
    font-size: 10px;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .log-footer {
    padding: 10px 16px;
    border-top: 1px solid var(--border-color, #333);
    background: var(--bg-primary, #121212);
  }

  .stats {
    display: flex;
    gap: 20px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .stat-label {
    color: var(--text-secondary, #888);
  }

  .stat-value {
    color: var(--text-primary, #fff);
    font-weight: 500;
  }

  .stat.error .stat-value {
    color: #f87171;
  }
</style>
