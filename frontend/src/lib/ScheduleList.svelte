<script>
  import { onMount, onDestroy } from 'svelte';
  import ScheduleEditor from './ScheduleEditor.svelte';
  import { showConfirm } from './stores/dialog.js';

  export let sidecarUrl = 'http://localhost:3456';

  let schedules = [];
  let workflows = [];
  let profiles = [];
  let loading = true;
  let error = null;
  let schedulerStatus = null;

  // Editor state
  let showEditor = false;
  let editingSchedule = null;

  // Refresh interval
  let refreshInterval;

  onMount(async () => {
    await loadData();
    // Refresh status every 30 seconds
    refreshInterval = setInterval(loadStatus, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  async function loadData() {
    loading = true;
    error = null;

    try {
      const [schedulesRes, workflowsRes, statusRes] = await Promise.all([
        sendCommand('listSchedules'),
        sendCommand('listWorkflows'),
        sendCommand('getSchedulerStatus'),
      ]);

      if (schedulesRes.success) {
        schedules = schedulesRes.schedules;
      }
      if (workflowsRes.success) {
        workflows = workflowsRes.workflows;
      }
      if (statusRes.success) {
        schedulerStatus = statusRes;
      }

      // Load profiles from Tauri
      if (window.__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        profiles = await invoke('get_profiles');
      }
    } catch (err) {
      error = err.message;
    }

    loading = false;
  }

  async function loadStatus() {
    try {
      const result = await sendCommand('getSchedulerStatus');
      if (result.success) {
        schedulerStatus = result;
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }

  function openNewSchedule() {
    editingSchedule = null;
    showEditor = true;
  }

  function editSchedule(schedule) {
    editingSchedule = schedule;
    showEditor = true;
  }

  async function handleSave(event) {
    const data = event.detail;
    try {
      let result;
      if (editingSchedule) {
        result = await sendCommand('updateSchedule', { id: editingSchedule.id, ...data });
      } else {
        result = await sendCommand('createSchedule', data);
      }

      if (result.success) {
        showEditor = false;
        await loadData();
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function deleteSchedule(schedule) {
    const confirmed = await showConfirm(`Delete schedule "${schedule.name}"?`, {
      title: 'Delete Schedule',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      const result = await sendCommand('deleteSchedule', { id: schedule.id });
      if (result.success) {
        await loadData();
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function toggleSchedule(schedule) {
    try {
      const action = schedule.enabled ? 'disableSchedule' : 'enableSchedule';
      const result = await sendCommand(action, { id: schedule.id });
      if (result.success) {
        await loadData();
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function runNow(schedule) {
    try {
      const result = await sendCommand('runScheduleNow', { id: schedule.id });
      if (result.success) {
        await loadData();
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  function getStatusColor(status) {
    switch (status) {
      case 'success': return '#22c55e';
      case 'failed': return '#ef4444';
      case 'running': return '#3b82f6';
      default: return '#6b7280';
    }
  }
</script>

<div class="schedule-list">
  <div class="header">
    <div class="header-left">
      <h2>Schedules</h2>
      {#if schedulerStatus}
        <div class="scheduler-status">
          <span class="status-indicator" class:running={schedulerStatus.running}></span>
          <span class="status-text">
            {schedulerStatus.enabledSchedules} / {schedulerStatus.totalSchedules} active
          </span>
        </div>
      {/if}
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" on:click={loadData} disabled={loading}>
        Refresh
      </button>
      <button class="btn btn-primary" on:click={openNewSchedule}>
        + New Schedule
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button on:click={() => error = null}>x</button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading schedules...</div>
  {:else if schedules.length === 0}
    <div class="empty-state">
      <div class="empty-icon">o</div>
      <h3>No Schedules</h3>
      <p>Create a schedule to run workflows automatically</p>
      <button class="btn btn-primary" on:click={openNewSchedule}>
        Create Schedule
      </button>
    </div>
  {:else}
    <div class="schedules-grid">
      {#each schedules as schedule}
        <div class="schedule-card" class:disabled={!schedule.enabled}>
          <div class="schedule-header">
            <div class="schedule-info">
              <h3>{schedule.name}</h3>
              <span class="cron-badge">{schedule.cronDescription || schedule.cron}</span>
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                checked={schedule.enabled}
                on:change={() => toggleSchedule(schedule)}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="schedule-details">
            <div class="detail-row">
              <span class="detail-label">Workflow</span>
              <span class="detail-value">{schedule.workflowName || schedule.workflowId || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Profiles</span>
              <span class="detail-value">{schedule.profileIds?.length || 0} selected</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Next Run</span>
              <span class="detail-value">{formatDate(schedule.nextRun)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Last Run</span>
              <span class="detail-value">
                {formatDate(schedule.lastRun)}
                {#if schedule.lastStatus}
                  <span class="status-badge" style="background: {getStatusColor(schedule.lastStatus)}">
                    {schedule.lastStatus}
                  </span>
                {/if}
              </span>
            </div>
          </div>

          <div class="schedule-actions">
            <button class="btn btn-small" on:click={() => runNow(schedule)} title="Run Now">
              Run
            </button>
            <button class="btn btn-small" on:click={() => editSchedule(schedule)} title="Edit">
              Edit
            </button>
            <button class="btn btn-small btn-danger" on:click={() => deleteSchedule(schedule)} title="Delete">
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Upcoming Executions -->
  {#if schedulerStatus?.upcomingExecutions?.length > 0}
    <div class="upcoming-section">
      <h3>Upcoming Executions</h3>
      <div class="upcoming-list">
        {#each schedulerStatus.upcomingExecutions as exec}
          <div class="upcoming-item">
            <span class="upcoming-name">{exec.name}</span>
            <span class="upcoming-time">{formatDate(exec.nextRun)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Schedule Editor Modal -->
{#if showEditor}
  <ScheduleEditor
    schedule={editingSchedule}
    {workflows}
    {profiles}
    {sidecarUrl}
    on:save={handleSave}
    on:close={() => showEditor = false}
  />
{/if}

<style>
  .schedule-list {
    padding: 20px;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--text-primary, #fff);
  }

  .scheduler-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 16px;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }

  .status-indicator.running {
    background: #22c55e;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-secondary {
    background: var(--bg-secondary, #1a1a1a);
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, #333);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-small {
    padding: 4px 12px;
    font-size: 12px;
    background: var(--bg-secondary, #1a1a1a);
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, #333);
  }

  .btn-small:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-danger {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .error-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    margin-bottom: 16px;
    color: #ef4444;
    font-size: 13px;
  }

  .error-banner button {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 16px;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary, #888);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary, #888);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    color: var(--text-primary, #fff);
    font-size: 18px;
  }

  .empty-state p {
    margin: 0 0 20px;
    font-size: 14px;
  }

  .schedules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 16px;
  }

  .schedule-card {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    padding: 16px;
    transition: all 0.15s;
  }

  .schedule-card:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .schedule-card.disabled {
    opacity: 0.6;
  }

  .schedule-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .schedule-info h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: var(--text-primary, #fff);
  }

  .cron-badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #374151;
    border-radius: 22px;
    transition: 0.2s;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: 0.2s;
  }

  .toggle input:checked + .toggle-slider {
    background: var(--accent-color, #3b82f6);
  }

  .toggle input:checked + .toggle-slider:before {
    transform: translateX(18px);
  }

  .schedule-details {
    margin-bottom: 16px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 13px;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    color: var(--text-secondary, #888);
  }

  .detail-value {
    color: var(--text-primary, #fff);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    color: #fff;
    text-transform: uppercase;
  }

  .schedule-actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #333);
  }

  .upcoming-section {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color, #333);
  }

  .upcoming-section h3 {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .upcoming-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upcoming-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 6px;
    font-size: 13px;
  }

  .upcoming-name {
    color: var(--text-primary, #fff);
  }

  .upcoming-time {
    color: var(--text-secondary, #888);
  }
</style>
