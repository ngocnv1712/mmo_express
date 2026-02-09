<script>
  import { onMount } from 'svelte';
  import ActionPalette from './ActionPalette.svelte';
  import WorkflowCanvas from './WorkflowCanvas.svelte';
  import PropertyPanel from './PropertyPanel.svelte';
  import VariableEditor from './VariableEditor.svelte';
  import ExecutionLog from './ExecutionLog.svelte';
  import ExecutionHistory from './ExecutionHistory.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import { getProfiles } from '../api.js';

  export let sidecarUrl = 'http://localhost:3456';

  let schemas = {};
  let workflows = [];
  let currentWorkflow = {
    id: null,
    name: 'Untitled Workflow',
    description: '',
    blocks: [],
    variables: [],
  };

  // Variable Editor
  let showVariableEditor = false;

  // Execution Log
  let showExecutionLog = false;
  let currentExecution = null;

  // Execution History
  let showExecutionHistory = false;
  let executionHistoryRef;

  // Debug Mode
  let showDebugPanel = false;
  let debugPanelRef;

  let selectedBlock = null;
  let loading = true;
  let saving = false;
  let running = false;
  let error = null;
  let showWorkflowList = false;
  let fileInput;

  // Profile selection for running workflow
  let showProfileSelector = false;
  let profiles = [];
  let selectedProfiles = [];
  let runProgress = { current: 0, total: 0, results: [] };

  // Schedule configuration
  let showSaveModal = false;
  let scheduleEnabled = false;
  let scheduleCron = '0 9 * * *';
  let scheduleProfileIds = [];
  let cronPresets = [
    { value: '* * * * *', label: 'Every minute' },
    { value: '*/5 * * * *', label: 'Every 5 minutes' },
    { value: '*/15 * * * *', label: 'Every 15 minutes' },
    { value: '*/30 * * * *', label: 'Every 30 minutes' },
    { value: '0 * * * *', label: 'Every hour' },
    { value: '0 */2 * * *', label: 'Every 2 hours' },
    { value: '0 */6 * * *', label: 'Every 6 hours' },
    { value: '0 */12 * * *', label: 'Every 12 hours' },
    { value: '0 9 * * *', label: 'Daily at 9:00 AM' },
    { value: '0 0 * * *', label: 'Daily at midnight' },
    { value: '0 9 * * 1-5', label: 'Weekdays at 9:00 AM' },
    { value: '0 9 * * 1', label: 'Weekly on Monday' },
    { value: '0 9 1 * *', label: 'Monthly on 1st' },
  ];

  // Export workflow to JSON file
  function exportWorkflow() {
    const data = {
      name: currentWorkflow.name,
      description: currentWorkflow.description,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      variables: currentWorkflow.variables || [],
      blocks: currentWorkflow.blocks.map(block => ({
        type: block.type,
        name: block.name,
        config: block.config || {},
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWorkflow.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import workflow from JSON file
  function importWorkflow(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Convert to internal format with IDs
        const blocks = (data.blocks || []).map((block, index) => ({
          id: `block-${Date.now()}-${index}`,
          type: block.type,
          name: block.name || block.type,
          icon: getIconForType(block.type),
          category: getCategoryForType(block.type),
          config: block.config || {},
        }));

        currentWorkflow = {
          id: null,
          name: data.name || 'Imported Workflow',
          description: data.description || '',
          blocks,
          variables: data.variables || [],
        };
        selectedBlock = null;
        error = null;
      } catch (err) {
        error = 'Failed to parse workflow file: ' + err.message;
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  }

  onMount(async () => {
    await loadSchemas();
    await loadWorkflows();
    loading = false;
  });

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  async function loadSchemas() {
    try {
      const result = await sendCommand('getActionSchemas');
      if (result.success) {
        schemas = result.schemas;
      }
    } catch (err) {
      console.error('Failed to load schemas:', err);
      error = 'Failed to load action schemas';
    }
  }

  async function loadWorkflows() {
    try {
      const result = await sendCommand('listWorkflows');
      if (result.success) {
        workflows = result.workflows;
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  }

  function handleBlocksChange(blocks) {
    currentWorkflow = { ...currentWorkflow, blocks };
  }

  function handleBlockSelect(block) {
    selectedBlock = block;
  }

  function handleBlockUpdate(updatedBlock) {
    const blocks = currentWorkflow.blocks.map(b =>
      b.id === updatedBlock.id ? updatedBlock : b
    );
    currentWorkflow = { ...currentWorkflow, blocks };
    selectedBlock = updatedBlock;
  }

  function handleBlockDelete(block) {
    if (selectedBlock?.id === block.id) {
      selectedBlock = null;
    }
  }

  function handleBlockDuplicate(block) {
    // Handled in WorkflowCanvas
  }

  // Open save modal with schedule options
  async function openSaveModal() {
    try {
      profiles = await getProfiles();
      // Load existing schedule if any
      if (currentWorkflow.id) {
        const scheduleResult = await sendCommand('getWorkflowSchedule', { workflowId: currentWorkflow.id });
        if (scheduleResult.success && scheduleResult.schedule) {
          scheduleEnabled = scheduleResult.schedule.enabled;
          scheduleCron = scheduleResult.schedule.cron || '0 9 * * *';
          scheduleProfileIds = scheduleResult.schedule.profileIds || [];
        } else {
          scheduleEnabled = false;
          scheduleCron = '0 9 * * *';
          scheduleProfileIds = [];
        }
      }
      showSaveModal = true;
    } catch (err) {
      // Fallback to direct save if can't load profiles
      await saveWorkflow();
    }
  }

  async function saveWorkflow() {
    saving = true;
    error = null;
    showSaveModal = false;

    try {
      // Convert blocks to workflow steps format
      const steps = currentWorkflow.blocks.map((block, index) => ({
        id: block.id || `step-${index}`,
        type: block.type,
        name: block.name,
        config: block.config || {},
      }));

      const workflowId = currentWorkflow.id || `workflow-${Date.now()}`;

      const result = await sendCommand('registerWorkflow', {
        id: workflowId,
        name: currentWorkflow.name,
        description: currentWorkflow.description,
        steps,
        variables: currentWorkflow.variables || [],
      });

      if (result.success) {
        currentWorkflow.id = result.workflow?.id || workflowId;

        // Save/update schedule if enabled
        if (scheduleEnabled && scheduleProfileIds.length > 0) {
          // Pass full workflow definition for persistence
          const workflowDef = {
            id: currentWorkflow.id,
            name: currentWorkflow.name,
            description: currentWorkflow.description,
            steps,
            variables: currentWorkflow.variables || [],
          };

          await sendCommand('saveWorkflowSchedule', {
            workflowId: currentWorkflow.id,
            workflowName: currentWorkflow.name,
            workflow: workflowDef,
            cron: scheduleCron,
            profileIds: scheduleProfileIds,
            enabled: true,
          });
        } else if (currentWorkflow.id) {
          // Disable schedule if turned off
          await sendCommand('deleteWorkflowSchedule', { workflowId: currentWorkflow.id });
        }

        await loadWorkflows();
      } else {
        error = result.error || 'Failed to save workflow';
      }
    } catch (err) {
      error = 'Failed to save workflow: ' + err.message;
    }

    saving = false;
  }

  function toggleScheduleProfile(profileId) {
    if (scheduleProfileIds.includes(profileId)) {
      scheduleProfileIds = scheduleProfileIds.filter(id => id !== profileId);
    } else {
      scheduleProfileIds = [...scheduleProfileIds, profileId];
    }
  }

  function selectAllScheduleProfiles() {
    if (scheduleProfileIds.length === profiles.length) {
      scheduleProfileIds = [];
    } else {
      scheduleProfileIds = profiles.map(p => p.id);
    }
  }

  // Open profile selector before running workflow
  async function openProfileSelector() {
    if (currentWorkflow.blocks.length === 0) return;

    // Save workflow first if not saved
    if (!currentWorkflow.id) {
      await saveWorkflow();
    }

    // Load profiles
    try {
      profiles = await getProfiles();
      selectedProfiles = [];
      runProgress = { current: 0, total: 0, results: [] };
      showProfileSelector = true;
    } catch (err) {
      error = 'Failed to load profiles: ' + err.message;
    }
  }

  function toggleProfileSelection(profileId) {
    if (selectedProfiles.includes(profileId)) {
      selectedProfiles = selectedProfiles.filter(id => id !== profileId);
    } else {
      selectedProfiles = [...selectedProfiles, profileId];
    }
  }

  function selectAllProfiles() {
    if (selectedProfiles.length === profiles.length) {
      selectedProfiles = [];
    } else {
      selectedProfiles = profiles.map(p => p.id);
    }
  }

  async function runWorkflowOnProfiles() {
    if (selectedProfiles.length === 0) {
      error = 'Please select at least one profile';
      return;
    }

    running = true;
    error = null;
    runProgress = { current: 0, total: selectedProfiles.length, results: [] };

    // Show execution log
    const execId = `exec-${Date.now()}`;
    currentExecution = {
      id: execId,
      workflowName: currentWorkflow.name,
      status: 'running',
      startTime: new Date().toISOString(),
      totalActions: currentWorkflow.blocks.length * selectedProfiles.length,
      completedActions: 0,
      errors: 0,
    };
    showExecutionLog = true;

    // Helper to add log
    async function addLog(type, message, duration = null) {
      try {
        await sendCommand('addExecutionLog', {
          executionId: execId,
          type,
          message,
          duration
        });
      } catch (e) {
        console.error('Failed to add log:', e);
      }
    }

    await addLog('start', `Starting workflow "${currentWorkflow.name}" on ${selectedProfiles.length} profile(s)`);

    for (const profileId of selectedProfiles) {
      const profile = profiles.find(p => p.id === profileId);
      const profileName = profile?.name || profileId;
      runProgress.current++;

      await addLog('info', `[${runProgress.current}/${selectedProfiles.length}] Running on profile: ${profileName}`);

      try {
        // Create session for profile
        const sessionStart = Date.now();
        await addLog('action', `Creating browser session for ${profileName}...`);

        const sessionResult = await sendCommand('createSession', {
          profile: profile,
          proxy: null // TODO: get proxy from profile
        });

        if (!sessionResult.success) {
          await addLog('error', `Failed to create session: ${sessionResult.error}`);
          runProgress.results = [...runProgress.results, {
            profileId,
            profileName,
            success: false,
            error: sessionResult.error
          }];
          currentExecution.errors++;
          continue;
        }

        await addLog('success', `Session created`, Date.now() - sessionStart);

        // Execute workflow on session with variables
        const workflowStart = Date.now();
        await addLog('action', `Executing workflow...`);

        const result = await sendCommand('executeWorkflow', {
          workflowId: currentWorkflow.id,
          sessionId: sessionResult.sessionId,
          variables: currentWorkflow.variables || [],
          executionId: execId, // Pass execution ID for logging
        });

        if (result.success) {
          await addLog('success', `Workflow completed on ${profileName}`, Date.now() - workflowStart);
        } else {
          await addLog('error', `Workflow failed: ${result.error}`);
          currentExecution.errors++;
        }

        runProgress.results = [...runProgress.results, {
          profileId,
          profileName,
          success: result.success,
          error: result.error
        }];

        currentExecution.completedActions += currentWorkflow.blocks.length;

        // Close session after workflow completes
        await addLog('action', `Closing session...`);
        await sendCommand('closeSession', { sessionId: sessionResult.sessionId });

      } catch (err) {
        await addLog('error', `Error on ${profileName}: ${err.message}`);
        runProgress.results = [...runProgress.results, {
          profileId,
          profileName,
          success: false,
          error: err.message
        }];
        currentExecution.errors++;
      }
    }

    if (currentExecution.errors > 0) {
      await addLog('warning', `Workflow completed with ${currentExecution.errors} error(s)`);
    } else {
      await addLog('complete', `Workflow completed successfully on all ${selectedProfiles.length} profile(s)`);
    }

    running = false;
    currentExecution.status = currentExecution.errors > 0 ? 'completed_with_errors' : 'completed';

    // Save to history
    if (executionHistoryRef) {
      executionHistoryRef.saveExecution({
        ...currentExecution,
        workflowId: currentWorkflow.id,
        profileCount: selectedProfiles.length,
        results: runProgress.results,
      });
    }
  }

  function handleCancelExecution() {
    // TODO: implement cancel
    running = false;
    if (currentExecution) {
      currentExecution.status = 'cancelled';
    }
  }

  // Debug Mode Functions
  async function openDebugSelector() {
    if (currentWorkflow.blocks.length === 0) return;

    // Save workflow first if not saved
    if (!currentWorkflow.id) {
      await saveWorkflow();
    }

    // Load profiles for debug session
    try {
      profiles = await getProfiles();
      selectedProfiles = [];
      showDebugSelector = true;
    } catch (err) {
      error = 'Failed to load profiles: ' + err.message;
    }
  }

  let showDebugSelector = false;

  async function startDebugSession() {
    if (selectedProfiles.length === 0) {
      error = 'Please select a profile';
      return;
    }

    const profileId = selectedProfiles[0];
    const profile = profiles.find(p => p.id === profileId);

    try {
      // Create session for profile
      const sessionResult = await sendCommand('createSession', {
        profile: profile,
        proxy: null
      });

      if (!sessionResult.success) {
        error = 'Failed to create session: ' + sessionResult.error;
        return;
      }

      showDebugSelector = false;

      // Start debug session
      const workflow = {
        id: currentWorkflow.id,
        name: currentWorkflow.name,
        steps: currentWorkflow.blocks.map((block, index) => ({
          id: block.id || `step-${index}`,
          type: block.type,
          name: block.name,
          config: block.config || {},
        })),
        variables: currentWorkflow.variables || [],
      };

      await debugPanelRef.startDebug(sessionResult.sessionId, workflow);

    } catch (err) {
      error = 'Failed to start debug session: ' + err.message;
    }
  }

  function handleDebugComplete(event) {
    // Debug session completed
  }

  function handleDebugStop() {
    showDebugPanel = false;
  }

  function handleExecutionComplete(event) {
    running = false;
  }

  function closeProfileSelector() {
    showProfileSelector = false;
    selectedProfiles = [];
    runProgress = { current: 0, total: 0, results: [] };
  }

  function newWorkflow() {
    currentWorkflow = {
      id: null,
      name: 'Untitled Workflow',
      description: '',
      blocks: [],
      variables: [],
    };
    selectedBlock = null;
  }

  function handleVariablesChange(event) {
    currentWorkflow.variables = event.detail;
  }

  async function loadWorkflow(workflow) {
    try {
      const result = await sendCommand('getWorkflow', { id: workflow.id });
      if (result.success && result.workflow) {
        // Convert steps back to blocks format
        const blocks = (result.workflow.steps || []).map((step, index) => ({
          id: `block-${Date.now()}-${index}`,
          type: step.type,
          name: step.name || step.type,
          icon: getIconForType(step.type),
          category: getCategoryForType(step.type),
          config: step.config || {},
        }));

        currentWorkflow = {
          id: result.workflow.id,
          name: result.workflow.name,
          description: result.workflow.description || '',
          blocks,
          variables: result.workflow.variables || [],
        };
        selectedBlock = null;
        showWorkflowList = false;
      }
    } catch (err) {
      error = 'Failed to load workflow: ' + err.message;
    }
  }

  async function deleteWorkflow(id) {
    if (!confirm('Delete this workflow?')) return;

    try {
      const result = await sendCommand('deleteWorkflow', { id });
      if (result.success) {
        await loadWorkflows();
        if (currentWorkflow.id === id) {
          newWorkflow();
        }
      }
    } catch (err) {
      error = 'Failed to delete workflow: ' + err.message;
    }
  }

  function getIconForType(type) {
    for (const category of Object.values(schemas)) {
      if (category.actions) {
        for (const action of Object.values(category.actions)) {
          if (action.type === type) {
            return action.icon;
          }
        }
      }
    }
    return '📦';
  }

  function getCategoryForType(type) {
    for (const [catKey, category] of Object.entries(schemas)) {
      if (category.actions) {
        for (const action of Object.values(category.actions)) {
          if (action.type === type) {
            return catKey;
          }
        }
      }
    }
    return 'advanced';
  }
</script>

<div class="automation-builder">
  <div class="builder-toolbar">
    <div class="toolbar-left">
      <button class="btn-icon" on:click={() => showWorkflowList = !showWorkflowList} title="Workflows">
        📁
      </button>
      <button class="btn-icon" on:click={newWorkflow} title="New Workflow">
        ➕
      </button>
      <div class="workflow-name">
        <input
          type="text"
          bind:value={currentWorkflow.name}
          placeholder="Workflow name..."
        />
      </div>
      <button
        class="btn btn-variables"
        on:click={() => showVariableEditor = true}
        title="Manage Variables"
      >
        📊 Variables ({currentWorkflow.variables?.length || 0})
      </button>
      <button
        class="btn btn-history"
        on:click={() => showExecutionHistory = true}
        title="Execution History"
      >
        📜 History
      </button>
    </div>

    <div class="toolbar-right">
      <input
        type="file"
        accept=".json"
        bind:this={fileInput}
        on:change={importWorkflow}
        style="display: none;"
      />
      <button class="btn btn-icon" on:click={() => fileInput?.click()} title="Import Workflow">
        📥
      </button>
      <button class="btn btn-icon" on:click={exportWorkflow} title="Export Workflow" disabled={currentWorkflow.blocks.length === 0}>
        📤
      </button>
      <button class="btn btn-secondary" on:click={openSaveModal} disabled={saving}>
        {saving ? '💾 Saving...' : '💾 Save'}
      </button>
      <button class="btn btn-debug" on:click={openDebugSelector} disabled={running || currentWorkflow.blocks.length === 0} title="Debug Mode - Step-by-step execution">
        🐛 Debug
      </button>
      <button class="btn btn-primary" on:click={openProfileSelector} disabled={running || currentWorkflow.blocks.length === 0}>
        {running ? '⏳ Running...' : '▶️ Run'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button on:click={() => error = null}>✕</button>
    </div>
  {/if}

  <div class="builder-content">
    {#if showWorkflowList}
      <div class="workflow-list-panel">
        <div class="panel-header">
          <h3>Workflows</h3>
          <button class="btn-icon" on:click={() => showWorkflowList = false}>✕</button>
        </div>
        <div class="workflow-items">
          {#each workflows as workflow}
            <div
              class="workflow-item"
              class:active={currentWorkflow.id === workflow.id}
              on:click={() => loadWorkflow(workflow)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && loadWorkflow(workflow)}
            >
              <span class="workflow-name">{workflow.name}</span>
              <button
                class="btn-icon-small"
                on:click|stopPropagation={() => deleteWorkflow(workflow.id)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          {/each}
          {#if workflows.length === 0}
            <div class="empty-list">No saved workflows</div>
          {/if}
        </div>
      </div>
    {/if}

    {#if loading}
      <div class="loading">Loading...</div>
    {:else}
      <ActionPalette
        {schemas}
        onDragStart={() => {}}
      />

      <WorkflowCanvas
        blocks={currentWorkflow.blocks}
        {selectedBlock}
        onBlockSelect={handleBlockSelect}
        onBlockDelete={handleBlockDelete}
        onBlockDuplicate={handleBlockDuplicate}
        onBlocksChange={handleBlocksChange}
      />

      <PropertyPanel
        block={selectedBlock}
        {schemas}
        onBlockUpdate={handleBlockUpdate}
      />
    {/if}
  </div>
</div>

<!-- Variable Editor -->
<VariableEditor
  bind:show={showVariableEditor}
  bind:variables={currentWorkflow.variables}
  on:change={handleVariablesChange}
  on:close={() => showVariableEditor = false}
/>

<!-- Execution Log -->
<ExecutionLog
  bind:show={showExecutionLog}
  execution={currentExecution}
  {sidecarUrl}
  on:cancel={handleCancelExecution}
  on:complete={handleExecutionComplete}
  on:close={() => showExecutionLog = false}
/>

<!-- Execution History -->
<ExecutionHistory
  bind:this={executionHistoryRef}
  bind:show={showExecutionHistory}
  workflowId={currentWorkflow.id}
  on:close={() => showExecutionHistory = false}
/>

<!-- Debug Panel -->
<DebugPanel
  bind:this={debugPanelRef}
  bind:show={showDebugPanel}
  {sidecarUrl}
  on:complete={handleDebugComplete}
  on:stop={handleDebugStop}
  on:close={() => showDebugPanel = false}
/>

<!-- Debug Profile Selector Modal -->
{#if showDebugSelector}
  <div class="modal-overlay" on:click={() => showDebugSelector = false}>
    <div class="profile-selector-modal debug-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🐛 Debug Workflow: {currentWorkflow.name}</h3>
        <button class="btn-close" on:click={() => showDebugSelector = false}>&times;</button>
      </div>

      <div class="modal-body">
        <p class="debug-info">Select a profile to start step-by-step debugging. You can step through each action and inspect variables.</p>

        <div class="profiles-grid single-select">
          {#each profiles as profile}
            <label
              class="profile-select-item"
              class:selected={selectedProfiles.includes(profile.id)}
            >
              <input
                type="radio"
                name="debug-profile"
                checked={selectedProfiles.includes(profile.id)}
                on:change={() => selectedProfiles = [profile.id]}
              />
              <div class="profile-select-info">
                <span class="profile-select-name">{profile.name || 'Unnamed'}</span>
                <span class="profile-select-meta">
                  {profile.browserType || 'chrome'} • {profile.platform || 'Win32'}
                </span>
              </div>
            </label>
          {/each}

          {#if profiles.length === 0}
            <div class="no-profiles">
              No profiles available. Create profiles first.
            </div>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showDebugSelector = false}>
          Cancel
        </button>
        <button
          class="btn btn-debug"
          on:click={startDebugSession}
          disabled={selectedProfiles.length === 0}
        >
          🐛 Start Debugging
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Profile Selector Modal -->
<!-- Save Workflow Modal with Schedule -->
{#if showSaveModal}
  <div class="modal-overlay" on:click={() => showSaveModal = false}>
    <div class="save-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>💾 Save Workflow</h3>
        <button class="btn-close" on:click={() => showSaveModal = false}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Workflow Name</label>
          <input type="text" bind:value={currentWorkflow.name} placeholder="Enter workflow name..." />
        </div>

        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" bind:value={currentWorkflow.description} placeholder="What does this workflow do?" />
        </div>

        <!-- Schedule Section -->
        <div class="schedule-section">
          <label class="schedule-toggle">
            <input type="checkbox" bind:checked={scheduleEnabled} />
            <span>⏰ Enable Schedule</span>
          </label>

          {#if scheduleEnabled}
            <div class="schedule-config">
              <div class="form-group">
                <label>Run Frequency</label>
                <select bind:value={scheduleCron}>
                  {#each cronPresets as preset}
                    <option value={preset.value}>{preset.label}</option>
                  {/each}
                </select>
                <span class="cron-display">Cron: <code>{scheduleCron}</code></span>
              </div>

              <div class="form-group">
                <label>Run on Profiles ({scheduleProfileIds.length} selected)</label>
                <div class="schedule-profile-select">
                  <label class="checkbox-label small">
                    <input
                      type="checkbox"
                      checked={scheduleProfileIds.length === profiles.length && profiles.length > 0}
                      on:change={selectAllScheduleProfiles}
                    />
                    Select All
                  </label>
                </div>
                <div class="schedule-profiles-grid">
                  {#each profiles as profile}
                    <label class="schedule-profile-item" class:selected={scheduleProfileIds.includes(profile.id)}>
                      <input
                        type="checkbox"
                        checked={scheduleProfileIds.includes(profile.id)}
                        on:change={() => toggleScheduleProfile(profile.id)}
                      />
                      <span>{profile.name || 'Unnamed'}</span>
                    </label>
                  {/each}
                  {#if profiles.length === 0}
                    <div class="no-profiles-msg">No profiles available</div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showSaveModal = false}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={saveWorkflow} disabled={saving || !currentWorkflow.name.trim()}>
          {saving ? '💾 Saving...' : '💾 Save Workflow'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Profile Selector Modal -->
{#if showProfileSelector}
  <div class="modal-overlay" on:click={closeProfileSelector}>
    <div class="profile-selector-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🚀 Run Workflow: {currentWorkflow.name}</h3>
        <button class="btn-close" on:click={closeProfileSelector}>&times;</button>
      </div>

      <div class="modal-body">
        {#if running}
          <!-- Running Progress -->
          <div class="run-progress">
            <div class="progress-header">
              <span>Running on profiles...</span>
              <span>{runProgress.current} / {runProgress.total}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {(runProgress.current / runProgress.total) * 100}%"></div>
            </div>

            {#if runProgress.results.length > 0}
              <div class="results-list">
                {#each runProgress.results as result}
                  <div class="result-item" class:success={result.success} class:error={!result.success}>
                    <span class="result-icon">{result.success ? '✓' : '✗'}</span>
                    <span class="result-name">{result.profileName}</span>
                    {#if result.error}
                      <span class="result-error">{result.error}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <!-- Profile Selection -->
          <div class="select-all-row">
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={selectedProfiles.length === profiles.length && profiles.length > 0}
                on:change={selectAllProfiles}
              />
              <span>Select All ({profiles.length} profiles)</span>
            </label>
            <span class="selected-count">{selectedProfiles.length} selected</span>
          </div>

          <div class="profiles-grid">
            {#each profiles as profile}
              <label
                class="profile-select-item"
                class:selected={selectedProfiles.includes(profile.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes(profile.id)}
                  on:change={() => toggleProfileSelection(profile.id)}
                />
                <div class="profile-select-info">
                  <span class="profile-select-name">{profile.name || 'Unnamed'}</span>
                  <span class="profile-select-meta">
                    {profile.browserType || 'chrome'} • {profile.platform || 'Win32'}
                  </span>
                </div>
              </label>
            {/each}

            {#if profiles.length === 0}
              <div class="no-profiles">
                No profiles available. Create profiles first.
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        {#if running}
          {#if runProgress.current === runProgress.total}
            <button class="btn btn-primary" on:click={closeProfileSelector}>
              Done
            </button>
          {:else}
            <button class="btn btn-secondary" disabled>
              ⏳ Running...
            </button>
          {/if}
        {:else}
          <button class="btn btn-secondary" on:click={closeProfileSelector}>
            Cancel
          </button>
          <button
            class="btn btn-primary"
            on:click={runWorkflowOnProfiles}
            disabled={selectedProfiles.length === 0}
          >
            ▶️ Run on {selectedProfiles.length} Profile{selectedProfiles.length !== 1 ? 's' : ''}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .automation-builder {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #121212);
  }

  .builder-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-secondary, #1a1a1a);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .workflow-name input {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-primary, #fff);
    font-size: 14px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 6px;
    min-width: 200px;
  }

  .workflow-name input:hover {
    border-color: var(--border-color, #333);
  }

  .workflow-name input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
    background: var(--bg-primary, #121212);
  }

  .btn-icon {
    background: transparent;
    border: none;
    font-size: 18px;
    padding: 6px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .btn-icon:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-icon-small {
    background: transparent;
    border: none;
    font-size: 12px;
    padding: 4px;
    cursor: pointer;
    opacity: 0.6;
  }

  .btn-icon-small:hover {
    opacity: 1;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-primary, #121212);
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, #333);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-variables {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.4);
    font-size: 12px;
    padding: 6px 12px;
  }

  .btn-variables:hover {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.6);
  }

  .btn-history {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
    font-size: 12px;
    padding: 6px 12px;
  }

  .btn-history:hover {
    background: rgba(245, 158, 11, 0.3);
    border-color: rgba(245, 158, 11, 0.6);
  }

  .btn-debug {
    background: rgba(236, 72, 153, 0.2);
    color: #ec4899;
    border: 1px solid rgba(236, 72, 153, 0.4);
  }

  .btn-debug:hover:not(:disabled) {
    background: rgba(236, 72, 153, 0.3);
    border-color: rgba(236, 72, 153, 0.6);
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #ef4444;
    color: #fff;
    font-size: 13px;
  }

  .error-banner button {
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
  }

  .builder-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .workflow-list-panel {
    position: absolute;
    top: 0;
    left: 0;
    width: 280px;
    height: 100%;
    background: var(--bg-secondary, #1a1a1a);
    border-right: 1px solid var(--border-color, #333);
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .workflow-items {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .workflow-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    margin-bottom: 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .workflow-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .workflow-item.active {
    background: rgba(59, 130, 246, 0.2);
  }

  .empty-list {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary, #666);
    font-size: 13px;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-secondary, #666);
    font-size: 14px;
  }

  /* Profile Selector Modal */
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

  .profile-selector-modal {
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
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
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

  .select-all-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .selected-count {
    color: var(--accent-color, #3b82f6);
    font-size: 13px;
    font-weight: 500;
  }

  .profiles-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    max-height: 400px;
    overflow-y: auto;
  }

  .profile-select-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .profile-select-item:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .profile-select-item.selected {
    border-color: var(--accent-color, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
  }

  .profile-select-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .profile-select-name {
    color: var(--text-primary, #fff);
    font-size: 13px;
    font-weight: 500;
  }

  .profile-select-meta {
    color: var(--text-secondary, #888);
    font-size: 11px;
  }

  .no-profiles {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: var(--text-secondary, #888);
  }

  /* Run Progress */
  .run-progress {
    padding: 20px 0;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  .progress-bar {
    height: 8px;
    background: var(--bg-primary, #121212);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 20px;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color, #3b82f6);
    transition: width 0.3s ease;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
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

  .debug-modal {
    max-width: 500px;
  }

  .debug-info {
    margin: 0 0 16px 0;
    color: var(--text-secondary, #888);
    font-size: 13px;
    line-height: 1.5;
  }

  .profiles-grid.single-select .profile-select-item {
    cursor: pointer;
  }

  .profiles-grid.single-select input[type="radio"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  /* Save Modal */
  .save-modal {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 500px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
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

  .schedule-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color, #333);
  }

  .schedule-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    margin-bottom: 16px;
  }

  .schedule-toggle input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .schedule-config {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 16px;
  }

  .cron-display {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .cron-display code {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .schedule-profile-select {
    margin-bottom: 10px;
  }

  .checkbox-label.small {
    font-size: 12px;
  }

  .schedule-profiles-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 150px;
    overflow-y: auto;
    padding: 4px;
  }

  .schedule-profile-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-primary, #fff);
    transition: all 0.15s;
  }

  .schedule-profile-item:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .schedule-profile-item.selected {
    border-color: var(--accent-color, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
  }

  .schedule-profile-item input {
    width: 14px;
    height: 14px;
  }

  .no-profiles-msg {
    grid-column: 1 / -1;
    text-align: center;
    padding: 20px;
    color: var(--text-secondary, #888);
    font-size: 12px;
  }
</style>
