<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let show = false;
  export let workflowId = null;

  const dispatch = createEventDispatcher();

  let history = [];
  let loading = true;
  let selectedExecution = null;

  onMount(() => {
    if (show) {
      loadHistory();
    }
  });

  $: if (show && workflowId) {
    loadHistory();
  }

  async function loadHistory() {
    loading = true;
    try {
      // Load from localStorage for now (can be migrated to Tauri DB later)
      const stored = localStorage.getItem('execution_history') || '[]';
      const allHistory = JSON.parse(stored);

      // Filter by workflowId if specified
      if (workflowId) {
        history = allHistory.filter(h => h.workflowId === workflowId);
      } else {
        history = allHistory;
      }

      // Sort by date descending
      history = history.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } catch (err) {
      console.error('Failed to load history:', err);
      history = [];
    }
    loading = false;
  }

  function close() {
    show = false;
    selectedExecution = null;
    dispatch('close');
  }

  function viewDetails(execution) {
    selectedExecution = execution;
  }

  function backToList() {
    selectedExecution = null;
  }

  function clearHistory() {
    if (!confirm('Clear all execution history?')) return;
    localStorage.setItem('execution_history', '[]');
    history = [];
  }

  function deleteExecution(id) {
    if (!confirm('Delete this execution record?')) return;
    const stored = localStorage.getItem('execution_history') || '[]';
    const allHistory = JSON.parse(stored);
    const filtered = allHistory.filter(h => h.id !== id);
    localStorage.setItem('execution_history', JSON.stringify(filtered));
    history = history.filter(h => h.id !== id);
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(ms) {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'completed': return '✅';
      case 'completed_with_errors': return '⚠️';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  }

  function getStatusClass(status) {
    switch (status) {
      case 'completed': return 'success';
      case 'completed_with_errors': return 'warning';
      case 'failed': return 'error';
      case 'cancelled': return 'cancelled';
      default: return '';
    }
  }

  // Export for saving execution from outside
  export function saveExecution(execution) {
    try {
      const stored = localStorage.getItem('execution_history') || '[]';
      const allHistory = JSON.parse(stored);

      // Add new execution
      allHistory.unshift({
        id: execution.id,
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        status: execution.status,
        startTime: execution.startTime,
        endTime: new Date().toISOString(),
        duration: Date.now() - new Date(execution.startTime).getTime(),
        profileCount: execution.profileCount || 0,
        completedActions: execution.completedActions || 0,
        totalActions: execution.totalActions || 0,
        errors: execution.errors || 0,
        results: execution.results || [],
      });

      // Keep only last 100 executions
      const trimmed = allHistory.slice(0, 100);
      localStorage.setItem('execution_history', JSON.stringify(trimmed));

      // Reload if visible
      if (show) {
        loadHistory();
      }
    } catch (err) {
      console.error('Failed to save execution:', err);
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="history-modal" on:click|stopPropagation>
      <div class="modal-header">
        {#if selectedExecution}
          <button class="btn-back" on:click={backToList}>
            ← Back
          </button>
          <h3>Execution Details</h3>
        {:else}
          <h3>📜 Execution History</h3>
        {/if}
        <button class="btn-close" on:click={close}>&times;</button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading">Loading history...</div>
        {:else if selectedExecution}
          <!-- Execution Details -->
          <div class="execution-details">
            <div class="detail-header">
              <span class="status-icon">{getStatusIcon(selectedExecution.status)}</span>
              <div class="detail-info">
                <h4>{selectedExecution.workflowName}</h4>
                <span class="detail-date">{formatDate(selectedExecution.startTime)}</span>
              </div>
              <span class="status-badge {getStatusClass(selectedExecution.status)}">
                {selectedExecution.status}
              </span>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-value">{formatDuration(selectedExecution.duration)}</span>
                <span class="stat-label">Duration</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{selectedExecution.profileCount || 0}</span>
                <span class="stat-label">Profiles</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{selectedExecution.completedActions}/{selectedExecution.totalActions}</span>
                <span class="stat-label">Actions</span>
              </div>
              <div class="stat-card" class:has-errors={selectedExecution.errors > 0}>
                <span class="stat-value">{selectedExecution.errors}</span>
                <span class="stat-label">Errors</span>
              </div>
            </div>

            {#if selectedExecution.results?.length > 0}
              <div class="results-section">
                <h5>Profile Results</h5>
                <div class="results-list">
                  {#each selectedExecution.results as result}
                    <div class="result-item" class:success={result.success} class:error={!result.success}>
                      <span class="result-icon">{result.success ? '✓' : '✗'}</span>
                      <span class="result-name">{result.profileName}</span>
                      {#if result.error}
                        <span class="result-error">{result.error}</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else if history.length === 0}
          <div class="empty-state">
            <p>No execution history yet.</p>
            <p class="hint">Run a workflow to see history here.</p>
          </div>
        {:else}
          <!-- History List -->
          <div class="history-list">
            {#each history as execution}
              <div class="history-item" on:click={() => viewDetails(execution)}>
                <span class="status-icon">{getStatusIcon(execution.status)}</span>
                <div class="history-info">
                  <span class="history-name">{execution.workflowName}</span>
                  <span class="history-meta">
                    {formatDate(execution.startTime)} • {formatDuration(execution.duration)} • {execution.profileCount || 0} profile(s)
                  </span>
                </div>
                <button
                  class="btn-delete"
                  on:click|stopPropagation={() => deleteExecution(execution.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if !selectedExecution && history.length > 0}
        <div class="modal-footer">
          <button class="btn btn-danger" on:click={clearHistory}>
            🗑️ Clear All History
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .history-modal {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
    gap: 12px;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--text-primary, #fff);
    flex: 1;
  }

  .btn-back {
    background: none;
    border: none;
    color: var(--accent-color, #3b82f6);
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .btn-back:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--text-primary, #fff);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #333);
    display: flex;
    justify-content: flex-end;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary, #888);
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary, #888);
  }

  .empty-state .hint {
    font-size: 13px;
    margin-top: 8px;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .history-item:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .status-icon {
    font-size: 18px;
  }

  .history-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .history-meta {
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .btn-delete {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    opacity: 0.5;
    padding: 4px;
  }

  .btn-delete:hover {
    opacity: 1;
  }

  /* Execution Details */
  .execution-details {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .detail-header .status-icon {
    font-size: 32px;
  }

  .detail-info {
    flex: 1;
  }

  .detail-info h4 {
    margin: 0 0 4px 0;
    font-size: 16px;
    color: var(--text-primary, #fff);
  }

  .detail-date {
    font-size: 13px;
    color: var(--text-secondary, #888);
  }

  .status-badge {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 500;
  }

  .status-badge.success {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-badge.warning {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .status-badge.error {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .status-badge.cancelled {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .stat-card {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .stat-card.has-errors {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.05);
  }

  .stat-value {
    display: block;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin-bottom: 4px;
  }

  .stat-card.has-errors .stat-value {
    color: #ef4444;
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
  }

  .results-section h5 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-primary, #121212);
    border-radius: 6px;
    font-size: 13px;
  }

  .result-item.success {
    border-left: 3px solid #22c55e;
  }

  .result-item.error {
    border-left: 3px solid #ef4444;
  }

  .result-icon {
    font-size: 14px;
  }

  .result-item.success .result-icon {
    color: #22c55e;
  }

  .result-item.error .result-icon {
    color: #ef4444;
  }

  .result-name {
    color: var(--text-primary, #fff);
    flex: 1;
  }

  .result-error {
    color: #ef4444;
    font-size: 11px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-danger {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.3);
  }
</style>
