<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let profile = null;
  export let results = null;
  export let loading = false;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="test-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🔬 Fingerprint Test - {profile?.name}</h2>
        <button class="close-btn" on:click={close}>&times;</button>
      </div>
      <div class="modal-body">
        {#if loading}
          <div class="loading">
            <div class="spinner"></div>
            <p>Running fingerprint tests...</p>
          </div>
        {:else if results?.success}
          <div class="test-summary">
            <div class="summary-item pass">
              <span class="count">{results.summary.passed}</span>
              <span class="label">Passed</span>
            </div>
            <div class="summary-item warn">
              <span class="count">{results.summary.warned}</span>
              <span class="label">Warning</span>
            </div>
            <div class="summary-item fail">
              <span class="count">{results.summary.failed}</span>
              <span class="label">Failed</span>
            </div>
          </div>
          <table class="test-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each results.tests as test}
                <tr class={test.status}>
                  <td>{test.name}</td>
                  <td class="value">{test.expected}</td>
                  <td class="value">{test.actual}</td>
                  <td>
                    <span class="status-badge {test.status}">
                      {#if test.status === 'pass'}✓
                      {:else if test.status === 'warn'}⚠
                      {:else}✗
                      {/if}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="error">
            <p>Failed to run tests: {results?.error || 'Unknown error'}</p>
          </div>
        {/if}
      </div>
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
    z-index: 2000;
  }

  .test-modal {
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 12px;
    width: 700px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #0f3460;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #e94560;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: #fff;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #888;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #0f3460;
    border-top-color: #e94560;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .test-summary {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-item {
    flex: 1;
    text-align: center;
    padding: 1rem;
    border-radius: 8px;
    background: #0f3460;
  }

  .summary-item.pass {
    border: 2px solid #22c55e;
  }

  .summary-item.warn {
    border: 2px solid #f59e0b;
  }

  .summary-item.fail {
    border: 2px solid #ef4444;
  }

  .summary-item .count {
    display: block;
    font-size: 2rem;
    font-weight: bold;
  }

  .summary-item.pass .count { color: #22c55e; }
  .summary-item.warn .count { color: #f59e0b; }
  .summary-item.fail .count { color: #ef4444; }

  .summary-item .label {
    font-size: 0.8rem;
    color: #888;
  }

  .test-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .test-table th {
    text-align: left;
    padding: 0.75rem;
    background: #0f3460;
    color: #888;
    font-weight: 500;
    text-transform: uppercase;
    font-size: 0.75rem;
  }

  .test-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #0f3460;
    color: #ccc;
  }

  .test-table td.value {
    font-family: monospace;
    font-size: 0.8rem;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .test-table tr.pass td { background: rgba(34, 197, 94, 0.05); }
  .test-table tr.warn td { background: rgba(245, 158, 11, 0.05); }
  .test-table tr.fail td { background: rgba(239, 68, 68, 0.05); }

  .status-badge {
    display: inline-block;
    width: 24px;
    height: 24px;
    line-height: 24px;
    text-align: center;
    border-radius: 50%;
    font-size: 0.9rem;
  }

  .status-badge.pass {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-badge.warn {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .status-badge.fail {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .error {
    text-align: center;
    padding: 2rem;
    color: #ef4444;
  }
</style>
