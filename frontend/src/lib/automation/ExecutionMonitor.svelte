<script>
  import { onMount, onDestroy } from 'svelte';

  export let executionId = null;
  export let onClose = () => {};
  export let sidecarUrl = 'http://localhost:3456';

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  let status = null;
  let error = null;
  let loading = true;
  let pollInterval = null;

  // Fetch status
  async function fetchStatus() {
    if (!executionId) return;

    try {
      const result = await sendCommand('getParallelStatus', { executionId });
      if (result.success) {
        status = result.status;
        error = null;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
    loading = false;
  }

  // Control actions
  async function pause() {
    try {
      await sendCommand('pauseParallelExecution', { executionId });
      await fetchStatus();
    } catch (err) {
      error = err.message;
    }
  }

  async function resume() {
    try {
      await sendCommand('resumeParallelExecution', { executionId });
      await fetchStatus();
    } catch (err) {
      error = err.message;
    }
  }

  async function stop() {
    if (!confirm('Stop execution? This cannot be undone.')) return;
    try {
      await sendCommand('stopParallelExecution', { executionId });
      onClose();
    } catch (err) {
      error = err.message;
    }
  }

  async function skipSlot(slotId) {
    try {
      await sendCommand('skipParallelSlot', { executionId, slotId });
      await fetchStatus();
    } catch (err) {
      error = err.message;
    }
  }

  function formatDuration(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  function getProgressColor(progress) {
    if (progress >= 80) return '#10b981';
    if (progress >= 50) return '#f59e0b';
    return '#3b82f6';
  }

  onMount(() => {
    fetchStatus();
    pollInterval = setInterval(fetchStatus, 1000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
</script>

<div class="execution-monitor">
  <div class="monitor-header">
    <div class="header-left">
      <span class="status-icon" class:running={status?.running} class:paused={status?.paused}>
        {#if status?.running && !status?.paused}
          🚀
        {:else if status?.paused}
          ⏸️
        {:else}
          ✅
        {/if}
      </span>
      <span class="title">
        {#if status?.running}
          Running Workflow
        {:else}
          Execution Complete
        {/if}
      </span>
    </div>
    <div class="header-actions">
      {#if status?.running}
        {#if status?.paused}
          <button class="btn-action resume" on:click={resume}>
            ▶ Resume
          </button>
        {:else}
          <button class="btn-action pause" on:click={pause}>
            ⏸ Pause
          </button>
        {/if}
        <button class="btn-action stop" on:click={stop}>
          ⏹ Stop
        </button>
      {:else}
        <button class="btn-action close" on:click={onClose}>
          Close
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if status}
    <!-- Overall Progress -->
    <div class="progress-section">
      <div class="progress-header">
        <span>Progress: {status.completed}/{status.totalProfiles} profiles</span>
        <span class="progress-percent">{status.progress}%</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {status.progress}%; background-color: {getProgressColor(status.progress)};"
        ></div>
      </div>
      <div class="progress-stats">
        <span>Elapsed: {formatDuration(status.elapsed)}</span>
        {#if status.eta > 0}
          <span>ETA: {formatDuration(status.eta)}</span>
        {/if}
      </div>
    </div>

    <!-- Active Slots -->
    <div class="slots-section">
      <h3>Active Slots ({status.active}/{status.slots?.length || 0})</h3>
      <div class="slots-grid">
        {#each status.slots || [] as slot}
          <div class="slot-card" class:running={slot.status === 'running'}>
            <div class="slot-header">
              <span class="slot-name">{slot.profileName || slot.profileId}</span>
              <button class="btn-skip" on:click={() => skipSlot(slot.id)} title="Skip this profile">
                ⏭
              </button>
            </div>
            <div class="slot-progress-bar">
              <div
                class="slot-progress-fill"
                style="width: {slot.progress}%;"
              ></div>
            </div>
            <div class="slot-info">
              <span>Step {slot.currentStep}/{slot.totalSteps}</span>
              {#if slot.currentAction}
                <span class="current-action">{slot.currentAction}</span>
              {/if}
            </div>
          </div>
        {/each}
        {#if !status.slots?.length}
          <div class="no-slots">No active slots</div>
        {/if}
      </div>
    </div>

    <!-- Queue -->
    <div class="queue-section">
      <h3>Queue ({status.queued})</h3>
      <div class="queue-list">
        {#each status.queueList?.slice(0, 10) || [] as item}
          <div class="queue-item">
            <span class="queue-name">{item.profileName || item.profileId}</span>
            <span class="queue-priority priority-{item.priority}">{item.priority}</span>
            {#if item.retryCount > 0}
              <span class="retry-badge">Retry #{item.retryCount}</span>
            {/if}
          </div>
        {/each}
        {#if status.queued > 10}
          <div class="queue-more">... and {status.queued - 10} more</div>
        {/if}
        {#if !status.queued}
          <div class="queue-empty">Queue empty</div>
        {/if}
      </div>
    </div>

    <!-- Results Summary -->
    <div class="results-section">
      <div class="result-box completed">
        <span class="result-icon">✓</span>
        <span class="result-count">{status.completed}</span>
        <span class="result-label">Completed</span>
      </div>
      <div class="result-box failed">
        <span class="result-icon">✗</span>
        <span class="result-count">{status.failed}</span>
        <span class="result-label">Failed</span>
      </div>
      <div class="result-box queued">
        <span class="result-icon">⋯</span>
        <span class="result-count">{status.queued}</span>
        <span class="result-label">Queued</span>
      </div>
    </div>

    <!-- Failed List -->
    {#if status.failedList?.length > 0}
      <div class="failed-section">
        <h3>Failed Profiles</h3>
        <div class="failed-list">
          {#each status.failedList as item}
            <div class="failed-item">
              <span class="failed-name">{item.profileName || item.profileId}</span>
              <span class="failed-error">{item.error}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .execution-monitor {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    padding: 16px;
    max-height: 600px;
    overflow-y: auto;
  }

  .monitor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-icon {
    font-size: 20px;
  }

  .title {
    font-size: 16px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn-action {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }

  .btn-action.pause {
    background: #f59e0b;
    color: white;
  }

  .btn-action.resume {
    background: #10b981;
    color: white;
  }

  .btn-action.stop {
    background: #ef4444;
    color: white;
  }

  .btn-action.close {
    background: var(--bg-tertiary, #2d2d44);
    color: var(--text-secondary, #a0a0b0);
  }

  .loading, .error {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary, #a0a0b0);
  }

  .error {
    color: #ef4444;
  }

  /* Progress Section */
  .progress-section {
    margin-bottom: 16px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .progress-percent {
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .progress-bar {
    height: 12px;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 6px;
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary, #a0a0b0);
  }

  /* Slots Section */
  .slots-section {
    margin-bottom: 16px;
  }

  .slots-section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--text-secondary, #a0a0b0);
  }

  .slots-grid {
    display: grid;
    gap: 8px;
  }

  .slot-card {
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    padding: 10px;
  }

  .slot-card.running {
    border-left: 3px solid #3b82f6;
  }

  .slot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .slot-name {
    font-size: 13px;
    font-weight: 500;
  }

  .btn-skip {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.6;
    padding: 2px 6px;
  }

  .btn-skip:hover {
    opacity: 1;
  }

  .slot-progress-bar {
    height: 4px;
    background: var(--bg-secondary, #1a1a2e);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .slot-progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s ease;
  }

  .slot-info {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  .current-action {
    color: #3b82f6;
  }

  .no-slots {
    text-align: center;
    padding: 16px;
    color: var(--text-secondary, #a0a0b0);
    font-size: 13px;
  }

  /* Queue Section */
  .queue-section {
    margin-bottom: 16px;
  }

  .queue-section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--text-secondary, #a0a0b0);
  }

  .queue-list {
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    padding: 8px;
    max-height: 120px;
    overflow-y: auto;
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
  }

  .queue-item:not(:last-child) {
    border-bottom: 1px solid var(--border-color, #3d3d54);
  }

  .queue-name {
    flex: 1;
  }

  .queue-priority {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    text-transform: uppercase;
  }

  .priority-critical { background: #ef4444; color: white; }
  .priority-high { background: #f59e0b; color: white; }
  .priority-normal { background: #3b82f6; color: white; }
  .priority-low { background: #6b7280; color: white; }
  .priority-idle { background: #4b5563; color: white; }

  .retry-badge {
    background: #f59e0b;
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
  }

  .queue-more, .queue-empty {
    text-align: center;
    padding: 8px;
    color: var(--text-secondary, #a0a0b0);
    font-size: 12px;
  }

  /* Results Section */
  .results-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .result-box {
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    padding: 12px;
    text-align: center;
  }

  .result-box.completed { border-top: 3px solid #10b981; }
  .result-box.failed { border-top: 3px solid #ef4444; }
  .result-box.queued { border-top: 3px solid #6b7280; }

  .result-icon {
    font-size: 16px;
    display: block;
    margin-bottom: 4px;
  }

  .result-count {
    font-size: 24px;
    font-weight: 600;
    display: block;
  }

  .result-label {
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  /* Failed Section */
  .failed-section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: #ef4444;
  }

  .failed-list {
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    max-height: 150px;
    overflow-y: auto;
  }

  .failed-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 12px;
    border-bottom: 1px solid var(--border-color, #3d3d54);
  }

  .failed-item:last-child {
    border-bottom: none;
  }

  .failed-name {
    font-weight: 500;
  }

  .failed-error {
    color: #ef4444;
    max-width: 60%;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
