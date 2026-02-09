<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let schedule = null;
  export let workflows = [];
  export let profiles = [];
  export let sidecarUrl = 'http://localhost:3456';

  const dispatch = createEventDispatcher();

  let name = '';
  let description = '';
  let workflowId = '';
  let selectedProfileIds = [];
  let cron = '0 9 * * *';
  let cronPreset = '';
  let customCron = false;
  let enabled = true;

  let presets = [];
  let loading = false;
  let error = null;

  // Cron builder state
  let cronMinute = '0';
  let cronHour = '9';
  let cronDayOfMonth = '*';
  let cronMonth = '*';
  let cronDayOfWeek = '*';

  onMount(async () => {
    await loadPresets();

    if (schedule) {
      name = schedule.name || '';
      description = schedule.description || '';
      workflowId = schedule.workflowId || '';
      selectedProfileIds = schedule.profileIds || [];
      cron = schedule.cron || '0 9 * * *';
      enabled = schedule.enabled !== false;
      parseCron(cron);
    }
  });

  async function loadPresets() {
    try {
      const response = await fetch(sidecarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCronPresets' }),
      });
      const result = await response.json();
      if (result.success) {
        presets = result.presets;
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }

  function parseCron(expression) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length === 5) {
      cronMinute = parts[0];
      cronHour = parts[1];
      cronDayOfMonth = parts[2];
      cronMonth = parts[3];
      cronDayOfWeek = parts[4];
    }
  }

  function buildCron() {
    return `${cronMinute} ${cronHour} ${cronDayOfMonth} ${cronMonth} ${cronDayOfWeek}`;
  }

  function handlePresetChange(event) {
    const value = event.target.value;
    if (value) {
      cron = value;
      parseCron(cron);
      customCron = false;
    }
  }

  function handleCronPartChange() {
    cron = buildCron();
    customCron = true;
    cronPreset = '';
  }

  function toggleProfile(profileId) {
    if (selectedProfileIds.includes(profileId)) {
      selectedProfileIds = selectedProfileIds.filter(id => id !== profileId);
    } else {
      selectedProfileIds = [...selectedProfileIds, profileId];
    }
  }

  function selectAllProfiles() {
    if (selectedProfileIds.length === profiles.length) {
      selectedProfileIds = [];
    } else {
      selectedProfileIds = profiles.map(p => p.id);
    }
  }

  function handleSave() {
    if (!name.trim()) {
      error = 'Please enter a schedule name';
      return;
    }

    if (!workflowId) {
      error = 'Please select a workflow';
      return;
    }

    if (selectedProfileIds.length === 0) {
      error = 'Please select at least one profile';
      return;
    }

    const selectedWorkflow = workflows.find(w => w.id === workflowId);

    dispatch('save', {
      name: name.trim(),
      description: description.trim(),
      workflowId,
      workflowName: selectedWorkflow?.name || '',
      profileIds: selectedProfileIds,
      cron,
      enabled,
    });
  }

  function handleClose() {
    dispatch('close');
  }

  function getCronDescription() {
    // Find matching preset
    const preset = presets.find(p => p.value === cron);
    if (preset) return preset.label;

    // Simple descriptions for common patterns
    const parts = cron.split(/\s+/);
    if (parts.length !== 5) return cron;

    const [min, hour, dom, month, dow] = parts;

    if (dom === '*' && month === '*' && dow === '*') {
      if (min === '*' && hour === '*') return 'Every minute';
      if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
      if (min === '0' && hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
      if (hour !== '*') {
        const h = parseInt(hour, 10);
        const m = parseInt(min, 10);
        return `Daily at ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
    }

    return cron;
  }
</script>

<div class="modal-overlay" on:click={handleClose}>
  <div class="modal" on:click|stopPropagation>
    <div class="modal-header">
      <h2>{schedule ? 'Edit Schedule' : 'New Schedule'}</h2>
      <button class="btn-close" on:click={handleClose}>&times;</button>
    </div>

    <div class="modal-body">
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-group">
        <label for="name">Name *</label>
        <input
          type="text"
          id="name"
          bind:value={name}
          placeholder="Daily Login Check"
        />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <input
          type="text"
          id="description"
          bind:value={description}
          placeholder="Runs daily at 9 AM"
        />
      </div>

      <div class="form-group">
        <label for="workflow">Workflow *</label>
        <select id="workflow" bind:value={workflowId}>
          <option value="">Select a workflow...</option>
          {#each workflows as workflow}
            <option value={workflow.id}>{workflow.name}</option>
          {/each}
        </select>
        {#if workflows.length === 0}
          <span class="help-text">No workflows available. Create a workflow first.</span>
        {/if}
      </div>

      <!-- Cron Schedule -->
      <div class="form-group">
        <label>Schedule</label>

        <div class="cron-section">
          <!-- Presets -->
          <div class="cron-presets">
            <label for="preset">Quick Select</label>
            <select id="preset" value={cronPreset} on:change={handlePresetChange}>
              <option value="">Custom...</option>
              {#each presets as preset}
                <option value={preset.value}>{preset.label}</option>
              {/each}
            </select>
          </div>

          <!-- Cron Builder -->
          <div class="cron-builder">
            <div class="cron-field">
              <label>Minute</label>
              <input
                type="text"
                bind:value={cronMinute}
                on:input={handleCronPartChange}
                placeholder="0-59, *, */5"
              />
            </div>
            <div class="cron-field">
              <label>Hour</label>
              <input
                type="text"
                bind:value={cronHour}
                on:input={handleCronPartChange}
                placeholder="0-23, *, */2"
              />
            </div>
            <div class="cron-field">
              <label>Day (Month)</label>
              <input
                type="text"
                bind:value={cronDayOfMonth}
                on:input={handleCronPartChange}
                placeholder="1-31, *"
              />
            </div>
            <div class="cron-field">
              <label>Month</label>
              <input
                type="text"
                bind:value={cronMonth}
                on:input={handleCronPartChange}
                placeholder="1-12, *"
              />
            </div>
            <div class="cron-field">
              <label>Day (Week)</label>
              <input
                type="text"
                bind:value={cronDayOfWeek}
                on:input={handleCronPartChange}
                placeholder="0-6, *"
              />
            </div>
          </div>

          <div class="cron-expression">
            <span class="cron-label">Expression:</span>
            <code>{cron}</code>
            <span class="cron-description">{getCronDescription()}</span>
          </div>
        </div>
      </div>

      <!-- Profile Selection -->
      <div class="form-group">
        <label>Profiles * ({selectedProfileIds.length} selected)</label>

        <div class="profile-select-header">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedProfileIds.length === profiles.length && profiles.length > 0}
              on:change={selectAllProfiles}
            />
            Select All
          </label>
        </div>

        <div class="profile-grid">
          {#each profiles as profile}
            <label
              class="profile-item"
              class:selected={selectedProfileIds.includes(profile.id)}
            >
              <input
                type="checkbox"
                checked={selectedProfileIds.includes(profile.id)}
                on:change={() => toggleProfile(profile.id)}
              />
              <span class="profile-name">{profile.name || 'Unnamed'}</span>
            </label>
          {/each}

          {#if profiles.length === 0}
            <div class="no-profiles">No profiles available</div>
          {/if}
        </div>
      </div>

      <!-- Enable Toggle -->
      <div class="form-group inline">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={enabled} />
          <span>Enable schedule immediately</span>
        </label>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={handleClose}>
        Cancel
      </button>
      <button class="btn btn-primary" on:click={handleSave} disabled={loading}>
        {schedule ? 'Update' : 'Create'} Schedule
      </button>
    </div>
  </div>
</div>

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

  .modal {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 600px;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary, #fff);
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
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #333);
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group.inline {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .form-group input[type="text"],
  .form-group select {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .help-text {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .error-message {
    padding: 10px 14px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 6px;
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .cron-section {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 16px;
  }

  .cron-presets {
    margin-bottom: 16px;
  }

  .cron-presets label {
    margin-bottom: 6px;
  }

  .cron-builder {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .cron-field label {
    font-size: 11px;
    color: var(--text-secondary, #888);
    margin-bottom: 4px;
  }

  .cron-field input {
    width: 100%;
    padding: 8px;
    font-size: 12px;
    font-family: monospace;
    text-align: center;
  }

  .cron-expression {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #333);
    font-size: 13px;
  }

  .cron-label {
    color: var(--text-secondary, #888);
  }

  .cron-expression code {
    padding: 4px 8px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border-radius: 4px;
    font-family: monospace;
  }

  .cron-description {
    color: var(--text-secondary, #888);
    font-style: italic;
  }

  .profile-select-header {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-primary, #fff);
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 4px;
  }

  .profile-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .profile-item:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .profile-item.selected {
    background: rgba(59, 130, 246, 0.1);
    border-color: var(--accent-color, #3b82f6);
  }

  .profile-name {
    font-size: 13px;
    color: var(--text-primary, #fff);
  }

  .no-profiles {
    grid-column: 1 / -1;
    text-align: center;
    padding: 20px;
    color: var(--text-secondary, #888);
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
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
    background: transparent;
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, #333);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
