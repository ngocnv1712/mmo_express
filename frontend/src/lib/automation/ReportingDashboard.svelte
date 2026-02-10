<script>
  import { onMount } from 'svelte';

  export let sidecarUrl = 'http://localhost:3456';

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  let stats = null;
  let dailyStats = [];
  let executions = [];
  let loading = true;
  let error = null;
  let activeTab = 'overview'; // overview, history

  // Pagination
  let currentPage = 1;
  let pageSize = 20;
  let totalExecutions = 0;

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [statsRes, dailyRes, historyRes] = await Promise.all([
        sendCommand('getExecutionStats'),
        sendCommand('getDailyStats', { days: 7 }),
        sendCommand('getExecutionHistory', { limit: pageSize, offset: (currentPage - 1) * pageSize })
      ]);

      if (statsRes.success) stats = statsRes.stats;
      if (dailyRes.success) dailyStats = dailyRes.dailyStats;
      if (historyRes.success) {
        executions = historyRes.executions;
        totalExecutions = historyRes.executions.length;
      }
    } catch (err) {
      error = err.message;
    }
    loading = false;
  }

  async function exportCSV() {
    try {
      const result = await sendCommand('exportExecutionsCSV', { limit: 1000 });
      if (result.success) {
        // Download CSV
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `executions-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  }

  async function cleanup() {
    if (!confirm('Delete execution history older than 30 days?')) return;
    try {
      const result = await sendCommand('cleanupExecutions', { days: 30 });
      if (result.success) {
        alert(`Deleted ${result.deleted} old records`);
        loadData();
      }
    } catch (err) {
      alert('Cleanup failed: ' + err.message);
    }
  }

  function formatDuration(ms) {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN');
  }

  function getStatusColor(status) {
    switch (status) {
      case 'success': return '#10b981';
      case 'failure': return '#ef4444';
      case 'running': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  // Simple bar chart renderer
  function getBarHeight(value, max) {
    if (!max) return 0;
    return Math.round((value / max) * 100);
  }

  onMount(loadData);
</script>

<div class="reporting-dashboard">
  <div class="dashboard-header">
    <h2>Reporting & Analytics</h2>
    <div class="header-actions">
      <button class="btn-refresh" on:click={loadData} disabled={loading}>
        {loading ? '...' : '↻'} Refresh
      </button>
      <button class="btn-export" on:click={exportCSV}>
        ↓ Export CSV
      </button>
      <button class="btn-cleanup" on:click={cleanup}>
        🗑 Cleanup
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class:active={activeTab === 'overview'} on:click={() => activeTab = 'overview'}>
      Overview
    </button>
    <button class:active={activeTab === 'history'} on:click={() => activeTab = 'history'}>
      Execution History
    </button>
  </div>

  {#if loading && !stats}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    {#if activeTab === 'overview'}
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-info">
            <div class="stat-value">{stats?.schedules?.total || 0}</div>
            <div class="stat-label">Total Schedules</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✓</div>
          <div class="stat-info">
            <div class="stat-value">{stats?.schedules?.enabled || 0}</div>
            <div class="stat-label">Active Schedules</div>
          </div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-value">{stats?.schedules?.totalSuccess || 0}</div>
            <div class="stat-label">Total Success</div>
          </div>
        </div>
        <div class="stat-card failure">
          <div class="stat-icon">❌</div>
          <div class="stat-info">
            <div class="stat-value">{stats?.schedules?.totalFailure || 0}</div>
            <div class="stat-label">Total Failures</div>
          </div>
        </div>
      </div>

      <!-- Success Rate -->
      <div class="success-rate-card">
        <h3>Success Rate</h3>
        <div class="rate-bar">
          <div
            class="rate-fill"
            style="width: {stats?.executions?.successRate || 0}%"
          ></div>
          <span class="rate-text">{stats?.executions?.successRate || 0}%</span>
        </div>
        <div class="rate-details">
          <span>Total: {stats?.executions?.total || 0}</span>
          <span>Success: {stats?.executions?.success || 0}</span>
          <span>Failed: {stats?.executions?.failure || 0}</span>
          <span>Avg Duration: {formatDuration(stats?.executions?.avgDuration)}</span>
        </div>
      </div>

      <!-- Daily Chart -->
      <div class="chart-card">
        <h3>Last 7 Days</h3>
        <div class="bar-chart">
          {#each dailyStats as day}
            {@const max = Math.max(...dailyStats.map(d => d.total), 1)}
            <div class="bar-group">
              <div class="bars">
                <div
                  class="bar success"
                  style="height: {getBarHeight(day.success, max)}%"
                  title="Success: {day.success}"
                ></div>
                <div
                  class="bar failure"
                  style="height: {getBarHeight(day.failure, max)}%"
                  title="Failed: {day.failure}"
                ></div>
              </div>
              <div class="bar-label">{day.date.slice(5)}</div>
              <div class="bar-value">{day.total}</div>
            </div>
          {/each}
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="dot success"></span> Success</span>
          <span class="legend-item"><span class="dot failure"></span> Failure</span>
        </div>
      </div>
    {:else}
      <!-- Execution History Table -->
      <div class="history-table">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Profile</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Steps</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {#each executions as exec}
              <tr>
                <td class="time">{formatDate(exec.startedAt)}</td>
                <td class="profile">{exec.profileName || exec.profileId?.slice(0, 8)}</td>
                <td>
                  <span class="status-badge" style="background: {getStatusColor(exec.status)}">
                    {exec.status}
                  </span>
                </td>
                <td>{formatDuration(exec.duration)}</td>
                <td>{exec.stepsCompleted}/{exec.totalSteps}</td>
                <td class="error-cell" title={exec.error}>{exec.error?.slice(0, 30) || '-'}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="6" class="no-data">No execution history yet</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if executions.length > 0}
        <div class="pagination">
          <button disabled={currentPage <= 1} on:click={() => { currentPage--; loadData(); }}>
            ← Prev
          </button>
          <span>Page {currentPage}</span>
          <button disabled={executions.length < pageSize} on:click={() => { currentPage++; loadData(); }}>
            Next →
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .reporting-dashboard {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .dashboard-header h2 {
    margin: 0;
    font-size: 20px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-actions button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn-refresh {
    background: var(--bg-tertiary, #2d2d44);
    color: inherit;
  }

  .btn-export {
    background: #3b82f6;
    color: white;
  }

  .btn-cleanup {
    background: var(--bg-tertiary, #2d2d44);
    color: #ef4444;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .tabs button {
    padding: 10px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-secondary, #a0a0b0);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tabs button.active {
    color: var(--accent-color, #6366f1);
    border-bottom-color: var(--accent-color, #6366f1);
  }

  .loading, .error {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary, #a0a0b0);
  }

  .error {
    color: #ef4444;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }

  .stat-card {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .stat-card.success {
    border-color: #10b981;
  }

  .stat-card.failure {
    border-color: #ef4444;
  }

  .stat-icon {
    font-size: 24px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-secondary, #a0a0b0);
  }

  /* Success Rate */
  .success-rate-card {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .success-rate-card h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--text-secondary, #a0a0b0);
  }

  .rate-bar {
    height: 24px;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }

  .rate-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    transition: width 0.3s ease;
  }

  .rate-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-weight: 600;
    font-size: 12px;
  }

  .rate-details {
    display: flex;
    gap: 20px;
    margin-top: 12px;
    font-size: 12px;
    color: var(--text-secondary, #a0a0b0);
  }

  /* Bar Chart */
  .chart-card {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    padding: 16px;
  }

  .chart-card h3 {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: var(--text-secondary, #a0a0b0);
  }

  .bar-chart {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    height: 150px;
    padding: 0 10px;
  }

  .bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }

  .bars {
    display: flex;
    gap: 2px;
    height: 120px;
    align-items: flex-end;
  }

  .bar {
    width: 16px;
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
    min-height: 2px;
  }

  .bar.success {
    background: #10b981;
  }

  .bar.failure {
    background: #ef4444;
  }

  .bar-label {
    font-size: 10px;
    color: var(--text-secondary, #a0a0b0);
    margin-top: 8px;
  }

  .bar-value {
    font-size: 11px;
    font-weight: 600;
  }

  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 16px;
    font-size: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot.success {
    background: #10b981;
  }

  .dot.failure {
    background: #ef4444;
  }

  /* History Table */
  .history-table {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  th {
    background: var(--bg-tertiary, #2d2d44);
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-secondary, #a0a0b0);
  }

  td {
    font-size: 13px;
  }

  .time {
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary, #a0a0b0);
  }

  .profile {
    font-weight: 500;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    color: white;
  }

  .error-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #ef4444;
    font-size: 12px;
  }

  .no-data {
    text-align: center;
    color: var(--text-secondary, #a0a0b0);
    padding: 40px !important;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 16px;
  }

  .pagination button {
    padding: 8px 16px;
    background: var(--bg-tertiary, #2d2d44);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: inherit;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
