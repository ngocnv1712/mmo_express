<script>
  import { onMount } from 'svelte';
  import ActionPalette from './ActionPalette.svelte';
  import WorkflowCanvas from './WorkflowCanvas.svelte';
  import NodeCanvas from './NodeCanvas.svelte';
  import PropertyPanel from './PropertyPanel.svelte';
  import VariableEditor from './VariableEditor.svelte';
  import ExecutionLog from './ExecutionLog.svelte';
  import ExecutionHistory from './ExecutionHistory.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import ExecutionMonitor from './ExecutionMonitor.svelte';
  import ParallelExecutionConfig from './ParallelExecutionConfig.svelte';
  import NotificationConfig from './NotificationConfig.svelte';
  import ReportingDashboard from './ReportingDashboard.svelte';
  import { getProfiles } from '../api.js';
  import { showConfirm } from '../stores/dialog.js';

  export let sidecarUrl = 'http://localhost:3456';

  let schemas = {};
  let workflows = [];
  let currentWorkflow = {
    id: null,
    name: 'Untitled Workflow',
    description: '',
    tags: [],
    blocks: [],
    variables: [],
  };

  // Workflow list filters
  let workflowSearchQuery = '';
  let workflowFilterTag = '';
  let newTagInput = '';

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

  // View mode: 'list' or 'editor'
  let viewMode = 'list';

  // Canvas mode: 'linear' or 'node'
  let canvasMode = 'node';

  // Node connections (for node canvas mode)
  let connections = [];

  // Auto-generate connections from block order when in node mode
  // This creates a linear connection chain: block[0] -> block[1] -> block[2] -> ...
  $: {
    if (canvasMode === 'node') {
      const blocks = currentWorkflow.blocks;
      if (blocks.length > 1) {
        const autoConnections = [];
        for (let i = 0; i < blocks.length - 1; i++) {
          const fromBlock = blocks[i];
          const toBlock = blocks[i + 1];
          if (fromBlock?.id && toBlock?.id) {
            autoConnections.push({
              id: `auto-conn-${fromBlock.id}-${toBlock.id}`,
              from: fromBlock.id,
              to: toBlock.id
            });
          }
        }
        connections = autoConnections;
      } else {
        connections = [];
      }
    }
  }

  // Quick run workflow (from list)
  let quickRunWorkflow = null;

  // Workflow schedules map
  let workflowSchedules = {};

  // Parallel Execution
  let showParallelConfig = false;
  let parallelExecutionId = null;
  let showExecutionMonitor = false;
  let parallelConfig = {
    maxConcurrent: 3,
    queueMode: 'fifo',
    delayBetween: 1000,
    timeout: 300000,
    stopOnError: false,
    headless: false,
    blocking: {
      images: false,
      media: false,
      fonts: false,
      css: false,
      trackers: false
    },
    retry: {
      maxRetries: 3,
      strategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 60000
    }
  };

  // Notification Config
  let showNotificationConfig = false;

  // Reporting Dashboard
  let showReportingDashboard = false;

  // Get all unique tags from workflows
  $: allWorkflowTags = [...new Set(workflows.flatMap(w => w.tags || []))].sort();

  // Filtered workflows
  $: filteredWorkflows = workflows.filter(w => {
    // Text search
    if (workflowSearchQuery.trim()) {
      const query = workflowSearchQuery.toLowerCase();
      const matchText = (w.name || '').toLowerCase().includes(query) ||
                       (w.description || '').toLowerCase().includes(query);
      if (!matchText) return false;
    }

    // Tag filter
    if (workflowFilterTag && !(w.tags || []).includes(workflowFilterTag)) {
      return false;
    }

    return true;
  });

  // Add tag to current workflow
  function addWorkflowTag() {
    const tag = newTagInput.trim();
    if (tag && !currentWorkflow.tags.includes(tag)) {
      currentWorkflow.tags = [...currentWorkflow.tags, tag];
    }
    newTagInput = '';
  }

  // Remove tag from current workflow
  function removeWorkflowTag(tag) {
    currentWorkflow.tags = currentWorkflow.tags.filter(t => t !== tag);
  }

  // Load schedules for all workflows
  async function loadWorkflowSchedules() {
    try {
      const result = await sendCommand('listSchedules');
      if (result.success) {
        workflowSchedules = {};
        for (const schedule of result.schedules) {
          workflowSchedules[schedule.workflowId] = schedule;
        }
      }
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }

  // Profile selection for running workflow
  let showProfileSelector = false;
  let profiles = [];
  let selectedProfiles = [];
  let runProgress = { current: 0, total: 0, results: [] };

  // Run config (headless, blocking)
  let showRunConfig = false;
  let runConfig = {
    headless: false,
    blocking: {
      images: false,
      media: false,
      fonts: false,
      css: false,
      trackers: false
    }
  };

  // Schedule configuration
  let showSaveModal = false;
  let scheduleEnabled = false;
  let scheduleCron = '0 9 * * *';
  let scheduleProfileIds = [];
  let showSaveParallelConfig = false;

  function toggleParallelConfig() {
    showSaveParallelConfig = !showSaveParallelConfig;
  }

  let profileSearchQuery = '';
  let profileDisplayLimit = 50;
  let profileFilterBrowser = '';
  let profileFilterOS = '';
  let profileFilterGroup = '';
  let profileFilterStatus = '';
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
        x: block.x,
        y: block.y,
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

        // Convert to internal format with IDs (support both 'blocks' and 'steps' formats)
        const rawBlocks = data.blocks || data.steps || [];
        const blocks = rawBlocks.map((block, index) => ({
          id: block.id || `block-${Date.now()}-${index}`,
          type: block.type,
          name: block.name || block.type,
          icon: getIconForType(block.type),
          category: getCategoryForType(block.type),
          config: block.config || {},
          x: block.x,
          y: block.y,
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
    await loadProfiles();
    await loadWorkflowSchedules();
    loading = false;
  });

  async function loadProfiles() {
    try {
      profiles = await getProfiles();
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  }

  // Switch to editor view with a workflow
  function editWorkflow(workflow) {
    loadWorkflow(workflow);
    viewMode = 'editor';
  }

  // Go back to list view
  function backToList() {
    viewMode = 'list';
    currentWorkflow = {
      id: null,
      name: 'Untitled Workflow',
      description: '',
      tags: [],
      blocks: [],
      variables: [],
    };
    selectedBlock = null;
    newTagInput = '';
  }

  // Quick run from list
  async function quickRun(workflow) {
    quickRunWorkflow = workflow;
    await loadWorkflow(workflow);
    showProfileSelector = true;
  }

  // Duplicate workflow
  async function duplicateWorkflow(workflow) {
    try {
      await loadWorkflow(workflow);
      currentWorkflow.id = null;
      currentWorkflow.name = workflow.name + ' (Copy)';
      await saveWorkflow();
      await loadWorkflows();
    } catch (err) {
      error = 'Failed to duplicate: ' + err.message;
    }
  }

  // Export single workflow from list
  function exportSingleWorkflow(workflow) {
    loadWorkflow(workflow).then(() => {
      exportWorkflow();
    });
  }

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
    // Ensure blocks have positions for node canvas mode
    const blocksWithPositions = blocks.map((block, index) => {
      if (block.x === undefined || block.y === undefined) {
        // Layout in a zigzag pattern for better flow visualization
        const col = index % 3;
        const row = Math.floor(index / 3);
        return {
          ...block,
          x: 80 + col * 250,
          y: 60 + row * 100
        };
      }
      return block;
    });
    currentWorkflow = { ...currentWorkflow, blocks: blocksWithPositions };
  }

  // Ensure blocks have positions when switching to node mode
  function ensureBlockPositions() {
    if (currentWorkflow.blocks.some(b => b.x === undefined)) {
      handleBlocksChange(currentWorkflow.blocks);
    }
  }

  // Call when canvas mode changes to node
  $: if (canvasMode === 'node') {
    ensureBlockPositions();
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
      // Reset search, filters and pagination
      profileSearchQuery = '';
      profileDisplayLimit = 50;
      profileFilterBrowser = '';
      profileFilterOS = '';
      profileFilterGroup = '';
      profileFilterStatus = '';

      // Load existing schedule if any
      if (currentWorkflow.id) {
        const scheduleResult = await sendCommand('getWorkflowSchedule', { workflowId: currentWorkflow.id });
        if (scheduleResult.success && scheduleResult.schedule) {
          scheduleEnabled = scheduleResult.schedule.enabled;
          scheduleCron = scheduleResult.schedule.cron || '0 9 * * *';
          scheduleProfileIds = scheduleResult.schedule.profileIds || [];
          // Load parallel config if exists
          if (scheduleResult.schedule.parallelConfig) {
            parallelConfig = { ...parallelConfig, ...scheduleResult.schedule.parallelConfig };
          }
        } else {
          scheduleEnabled = false;
          scheduleCron = '0 9 * * *';
          scheduleProfileIds = [];
        }
      } else {
        // New workflow - reset schedule settings
        scheduleEnabled = false;
        scheduleCron = '0 9 * * *';
        scheduleProfileIds = [];
      }
      showSaveParallelConfig = false; // Start collapsed
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
      // Convert blocks to workflow steps format (include x,y positions for node canvas)
      const steps = currentWorkflow.blocks.map((block, index) => ({
        id: block.id || `step-${index}`,
        type: block.type,
        name: block.name,
        config: block.config || {},
        x: block.x,
        y: block.y,
      }));

      const workflowId = currentWorkflow.id || `workflow-${Date.now()}`;

      const result = await sendCommand('registerWorkflow', {
        id: workflowId,
        name: currentWorkflow.name,
        description: currentWorkflow.description,
        tags: currentWorkflow.tags || [],
        steps,
        variables: currentWorkflow.variables || [],
      });

      if (result.success) {
        currentWorkflow.id = result.workflow?.id || workflowId;

        // Save schedule config (independent of enabled state and profile selection)
        // This allows users to configure schedule without enabling it yet
        if (scheduleEnabled || scheduleProfileIds.length > 0) {
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
            enabled: scheduleEnabled, // Save actual enabled state
            parallelConfig, // Save parallel execution config
          });
        } else if (currentWorkflow.id) {
          // Delete schedule only if both disabled and no profiles selected
          await sendCommand('deleteWorkflowSchedule', { workflowId: currentWorkflow.id });
        }

        await loadWorkflows();
        await loadWorkflowSchedules();
      } else {
        error = result.error || 'Failed to save workflow';
      }
    } catch (err) {
      error = 'Failed to save workflow: ' + err.message;
    }

    saving = false;
  }

  // Get unique values for filter dropdowns
  $: availableBrowsers = [...new Set(profiles.map(p => p.browserType).filter(Boolean))];
  $: availableOS = [...new Set(profiles.map(p => p.os).filter(Boolean))];
  $: availableGroups = [...new Set(profiles.map(p => p.groupId).filter(Boolean))];
  $: availableStatuses = [...new Set(profiles.map(p => p.status).filter(Boolean))];

  // Parse tags from profiles
  function getProfileTags(profile) {
    try {
      return JSON.parse(profile.platformTags || '[]');
    } catch {
      return [];
    }
  }

  $: availableTags = [...new Set(profiles.flatMap(p => getProfileTags(p)))];

  // Filtered profiles based on search query and filters
  $: filteredProfiles = profiles.filter(p => {
    // Text search
    if (profileSearchQuery.trim()) {
      const query = profileSearchQuery.toLowerCase();
      const matchText = (p.name || '').toLowerCase().includes(query) ||
             (p.browserType || '').toLowerCase().includes(query) ||
             (p.notes || '').toLowerCase().includes(query) ||
             (p.groupId || '').toLowerCase().includes(query);
      if (!matchText) return false;
    }

    // Browser filter
    if (profileFilterBrowser && p.browserType !== profileFilterBrowser) return false;

    // OS filter
    if (profileFilterOS && p.os !== profileFilterOS) return false;

    // Group filter
    if (profileFilterGroup && p.groupId !== profileFilterGroup) return false;

    // Status filter
    if (profileFilterStatus && p.status !== profileFilterStatus) return false;

    return true;
  });

  // Profiles to display (with pagination)
  $: displayedProfiles = filteredProfiles.slice(0, profileDisplayLimit);
  $: hasMoreProfiles = filteredProfiles.length > profileDisplayLimit;

  function showMoreProfiles() {
    profileDisplayLimit += 50;
  }

  function selectAllFilteredProfiles() {
    const filteredIds = filteredProfiles.map(p => p.id);
    const allSelected = filteredIds.every(id => scheduleProfileIds.includes(id));

    if (allSelected) {
      // Deselect all filtered
      scheduleProfileIds = scheduleProfileIds.filter(id => !filteredIds.includes(id));
    } else {
      // Select all filtered
      const newIds = [...new Set([...scheduleProfileIds, ...filteredIds])];
      scheduleProfileIds = newIds;
    }
  }

  function clearProfileSelection() {
    scheduleProfileIds = [];
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

    // Build options summary
    const optionParts = [];
    if (runConfig.headless) optionParts.push('headless');
    const blockingTypes = Object.entries(runConfig.blocking).filter(([k, v]) => v).map(([k]) => k);
    if (blockingTypes.length > 0) optionParts.push(`blocking: ${blockingTypes.join(', ')}`);
    const optionsSummary = optionParts.length > 0 ? ` [${optionParts.join(', ')}]` : '';

    await addLog('start', `Starting workflow "${currentWorkflow.name}" on ${selectedProfiles.length} profile(s)${optionsSummary}`);

    for (const profileId of selectedProfiles) {
      const profile = profiles.find(p => p.id === profileId);
      const profileName = profile?.name || profileId;
      runProgress.current++;

      await addLog('info', `[${runProgress.current}/${selectedProfiles.length}] Running on profile: ${profileName}`);

      try {
        // Create session for profile
        const sessionStart = Date.now();
        const headlessText = runConfig.headless ? ' (headless)' : '';
        await addLog('action', `Creating browser session for ${profileName}${headlessText}...`);

        const sessionResult = await sendCommand('createSession', {
          profile: profile,
          proxy: null, // TODO: get proxy from profile
          headless: runConfig.headless,
          blocking: runConfig.blocking
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
          x: block.x,
          y: block.y,
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

  // Parallel Execution Functions
  async function openParallelConfig(workflow = null) {
    if (workflow) {
      await loadWorkflow(workflow);
    }

    if (!currentWorkflow.id && currentWorkflow.blocks.length === 0) return;

    // Save workflow first if not saved
    if (!currentWorkflow.id) {
      await saveWorkflow();
    }

    // Load profiles and sync to sidecar
    try {
      profiles = await getProfiles();
      // Sync profiles to sidecar for scheduled execution
      await sendCommand('syncProfiles', { profiles });
      selectedProfiles = [];
      showParallelConfig = true;
    } catch (err) {
      error = 'Failed to load profiles: ' + err.message;
    }
  }

  async function startParallelExecution() {
    if (selectedProfiles.length === 0) {
      error = 'Please select at least one profile';
      return;
    }

    running = true;
    error = null;

    try {
      const result = await sendCommand('startParallelExecution', {
        workflowId: currentWorkflow.id,
        profileIds: selectedProfiles,
        options: parallelConfig
      });

      if (result.success) {
        parallelExecutionId = result.executionId;
        showParallelConfig = false;
        showExecutionMonitor = true;
      } else {
        error = result.error || 'Failed to start parallel execution';
        running = false;
      }
    } catch (err) {
      error = 'Failed to start parallel execution: ' + err.message;
      running = false;
    }
  }

  function handleMonitorClose() {
    showExecutionMonitor = false;
    parallelExecutionId = null;
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
      tags: [],
      blocks: [],
      variables: [],
    };
    selectedBlock = null;
    newTagInput = '';
  }

  function handleVariablesChange(event) {
    currentWorkflow.variables = event.detail;
  }

  async function loadWorkflow(workflow) {
    try {
      const result = await sendCommand('getWorkflow', { id: workflow.id });
      if (result.success && result.workflow) {
        // Convert steps back to blocks format (preserve x,y positions for node canvas)
        const blocks = (result.workflow.steps || []).map((step, index) => ({
          id: step.id || `block-${Date.now()}-${index}`,
          type: step.type,
          name: step.name || step.type,
          icon: getIconForType(step.type),
          category: getCategoryForType(step.type),
          config: step.config || {},
          x: step.x,
          y: step.y,
        }));

        currentWorkflow = {
          id: result.workflow.id,
          name: result.workflow.name,
          description: result.workflow.description || '',
          tags: result.workflow.tags || [],
          blocks,
          variables: result.workflow.variables || [],
        };
        selectedBlock = null;
        showWorkflowList = false;
        newTagInput = '';
      }
    } catch (err) {
      error = 'Failed to load workflow: ' + err.message;
    }
  }

  async function deleteWorkflow(id) {
    const confirmed = await showConfirm('Delete this workflow?', {
      title: 'Delete Workflow',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      // Also delete schedule if exists
      await sendCommand('deleteWorkflowSchedule', { workflowId: id });
      const result = await sendCommand('deleteWorkflow', { id });
      if (result.success) {
        await loadWorkflows();
        await loadWorkflowSchedules();
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
  {#if viewMode === 'list'}
    <!-- WORKFLOW LIST VIEW -->
    <div class="list-view">
      <div class="list-header">
        <h2>Workflows</h2>
        <div class="list-actions">
          <input
            type="file"
            accept=".json"
            bind:this={fileInput}
            on:change={(e) => { importWorkflow(e); viewMode = 'editor'; }}
            style="display: none;"
          />
          <button class="btn btn-secondary" on:click={() => fileInput?.click()}>
            📥 Import
          </button>
          <button class="btn btn-primary" on:click={() => { newWorkflow(); viewMode = 'editor'; }}>
            ➕ New Workflow
          </button>
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="workflow-filters">
        <div class="workflow-search">
          <input
            type="text"
            bind:value={workflowSearchQuery}
            placeholder="🔍 Search workflows..."
          />
          {#if workflowSearchQuery}
            <button class="btn-clear-search" on:click={() => workflowSearchQuery = ''}>✕</button>
          {/if}
        </div>

        {#if allWorkflowTags.length > 0}
          <div class="workflow-tag-filter">
            <button
              class="tag-filter-btn"
              class:active={!workflowFilterTag}
              on:click={() => workflowFilterTag = ''}
            >
              All
            </button>
            {#each allWorkflowTags as tag}
              <button
                class="tag-filter-btn"
                class:active={workflowFilterTag === tag}
                on:click={() => workflowFilterTag = workflowFilterTag === tag ? '' : tag}
              >
                {tag}
              </button>
            {/each}
          </div>
        {/if}

        <div class="workflow-count">
          {filteredWorkflows.length} of {workflows.length} workflows
        </div>
      </div>

      {#if error}
        <div class="error-banner">
          <span>{error}</span>
          <button on:click={() => error = null}>✕</button>
        </div>
      {/if}

      {#if loading}
        <div class="loading">Loading workflows...</div>
      {:else if workflows.length === 0}
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No workflows yet</h3>
          <p>Create your first automation workflow</p>
          <button class="btn btn-primary" on:click={() => { newWorkflow(); viewMode = 'editor'; }}>
            ➕ Create Workflow
          </button>
        </div>
      {:else if filteredWorkflows.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No workflows found</h3>
          <p>Try different search or filter</p>
          <button class="btn btn-secondary" on:click={() => { workflowSearchQuery = ''; workflowFilterTag = ''; }}>
            Clear Filters
          </button>
        </div>
      {:else}
        <div class="workflow-grid">
          {#each filteredWorkflows as workflow}
            {@const schedule = workflowSchedules[workflow.id]}
            <div class="workflow-card" class:schedule-active={schedule?.enabled} class:schedule-paused={schedule && !schedule.enabled}>
              <div class="card-header">
                <h3 class="card-title">{workflow.name}</h3>
                <span class="card-steps">{workflow.steps?.length || 0} steps</span>
              </div>
              <div class="card-body">
                {#if (workflow.tags || []).length > 0}
                  <div class="card-tags">
                    {#each workflow.tags as tag}
                      <span class="card-tag">{tag}</span>
                    {/each}
                  </div>
                {/if}
                <p class="card-desc">{workflow.description || 'No description'}</p>

                <div class="card-meta">
                  {#if schedule}
                    <div class="meta-item" class:active={schedule.enabled} class:inactive={!schedule.enabled}>
                      <span class="meta-icon">{schedule.enabled ? '⏰' : '⏸️'}</span>
                      <span class="meta-text">{schedule.cronDescription || schedule.cron}</span>
                    </div>
                    <div class="meta-item" class:warning={schedule.enabled && (!schedule.profileIds || schedule.profileIds.length === 0)}>
                      <span class="meta-icon">👤</span>
                      <span class="meta-text">{schedule.profileIds?.length || 0} profiles</span>
                    </div>
                    {#if schedule.parallelConfig}
                      <div class="meta-item">
                        <span class="meta-icon">⚡</span>
                        <span class="meta-text">{schedule.parallelConfig.maxConcurrent || 3} concurrent</span>
                      </div>
                      {#if schedule.parallelConfig.headless}
                        <div class="meta-item headless">
                          <span class="meta-icon">👻</span>
                          <span class="meta-text">Headless</span>
                        </div>
                      {/if}
                      {#if schedule.parallelConfig.blocking && Object.values(schedule.parallelConfig.blocking).some(v => v)}
                        <div class="meta-item blocking">
                          <span class="meta-icon">🚫</span>
                          <span class="meta-text">
                            {[
                              schedule.parallelConfig.blocking.images && 'img',
                              schedule.parallelConfig.blocking.media && 'media',
                              schedule.parallelConfig.blocking.fonts && 'fonts',
                              schedule.parallelConfig.blocking.css && 'css',
                              schedule.parallelConfig.blocking.trackers && 'trackers'
                            ].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      {/if}
                    {/if}
                    {#if schedule.lastRun}
                      <div class="meta-item" class:success={schedule.lastStatus === 'success'} class:failed={schedule.lastStatus === 'failed'}>
                        <span class="meta-icon">{schedule.lastStatus === 'success' ? '✅' : schedule.lastStatus === 'failed' ? '❌' : '⏳'}</span>
                        <span class="meta-text">Last: {new Date(schedule.lastRun).toLocaleString('vi-VN')}</span>
                      </div>
                    {/if}
                  {:else}
                    <div class="meta-item inactive">
                      <span class="meta-icon">⏰</span>
                      <span class="meta-text">No schedule</span>
                    </div>
                  {/if}
                </div>
              </div>
              <div class="card-actions">
                <button class="btn-action btn-run" on:click={() => quickRun(workflow)} title="Run Sequentially">
                  ▶️ Run
                </button>
                <button class="btn-action btn-parallel" on:click={() => openParallelConfig(workflow)} title="Run Parallel">
                  ⚡
                </button>
                <button class="btn-action btn-edit" on:click={() => editWorkflow(workflow)} title="Edit">
                  ✏️ Edit
                </button>
                <button class="btn-action btn-debug" on:click={() => { editWorkflow(workflow); setTimeout(() => openDebugSelector(), 100); }} title="Debug">
                  🐛
                </button>
                <button class="btn-action btn-duplicate" on:click={() => duplicateWorkflow(workflow)} title="Duplicate">
                  📋
                </button>
                <button class="btn-action btn-export" on:click={() => exportSingleWorkflow(workflow)} title="Export">
                  📤
                </button>
                <button class="btn-action btn-delete" on:click={() => deleteWorkflow(workflow.id)} title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- WORKFLOW EDITOR VIEW -->
    <div class="builder-toolbar">
      <div class="toolbar-left">
        <button class="btn btn-back" on:click={backToList} title="Back to list">
          ← Back
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
        <div class="canvas-mode-toggle">
          <button
            class="btn btn-mode"
            class:active={canvasMode === 'linear'}
            on:click={() => canvasMode = 'linear'}
            title="Linear View"
          >
            ☰
          </button>
          <button
            class="btn btn-mode"
            class:active={canvasMode === 'node'}
            on:click={() => canvasMode = 'node'}
            title="Node View (n8n style)"
          >
            ⬡
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <button class="btn btn-icon" on:click={() => showReportingDashboard = true} title="Reports & Analytics">
          📊
        </button>
        <button class="btn btn-icon" on:click={() => showNotificationConfig = true} title="Notification Settings">
          🔔
        </button>
        <button class="btn btn-icon" on:click={exportWorkflow} title="Export Workflow" disabled={currentWorkflow.blocks.length === 0}>
          📤
        </button>
        <button class="btn btn-secondary" on:click={openSaveModal} disabled={saving}>
          {saving ? '💾 Saving...' : '💾 Save'}
        </button>
        <button class="btn btn-debug" on:click={openDebugSelector} disabled={running || currentWorkflow.blocks.length === 0} title="Debug Mode">
          🐛 Debug
        </button>
        <button class="btn btn-parallel" on:click={() => openParallelConfig()} disabled={running || currentWorkflow.blocks.length === 0} title="Run Parallel">
          ⚡ Parallel
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
      {#if loading}
        <div class="loading">Loading...</div>
      {:else}
        <ActionPalette
          {schemas}
          onDragStart={() => {}}
        />

        {#if canvasMode === 'linear'}
          <WorkflowCanvas
            blocks={currentWorkflow.blocks}
            {selectedBlock}
            onBlockSelect={handleBlockSelect}
            onBlockDelete={handleBlockDelete}
            onBlockDuplicate={handleBlockDuplicate}
            onBlocksChange={handleBlocksChange}
          />
        {:else}
          <NodeCanvas
            nodes={currentWorkflow.blocks}
            {connections}
            selectedNode={selectedBlock}
            onNodeSelect={handleBlockSelect}
            onNodeDelete={handleBlockDelete}
            onNodesChange={handleBlocksChange}
            onConnectionsChange={(conns) => connections = conns}
          />
        {/if}

        <PropertyPanel
          block={selectedBlock}
          {schemas}
          onBlockUpdate={handleBlockUpdate}
        />
      {/if}
    </div>
  {/if}
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
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" on:click|self={() => showSaveModal = false}>
    <div class="save-modal">
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

        <div class="form-group">
          <label>Tags</label>
          <div class="tags-input-container">
            <div class="tags-list">
              {#each currentWorkflow.tags || [] as tag}
                <span class="tag-chip">
                  {tag}
                  <button class="tag-remove" on:click={() => removeWorkflowTag(tag)}>×</button>
                </span>
              {/each}
            </div>
            <div class="tag-input-row">
              <input
                type="text"
                bind:value={newTagInput}
                placeholder="Add tag..."
                on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addWorkflowTag())}
              />
              <button type="button" class="btn-add-tag" on:click={addWorkflowTag}>+</button>
            </div>
            {#if allWorkflowTags.length > 0}
              <div class="suggested-tags">
                <span class="suggested-label">Suggested:</span>
                {#each allWorkflowTags.filter(t => !(currentWorkflow.tags || []).includes(t)).slice(0, 5) as tag}
                  <button class="suggested-tag" on:click={() => currentWorkflow.tags = [...(currentWorkflow.tags || []), tag]}>
                    {tag}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Schedule Section -->
        <div class="schedule-section">
          <div class="schedule-header">
            <label class="schedule-toggle">
              <input type="checkbox" bind:checked={scheduleEnabled} />
              <span>⏰ Enable Schedule</span>
            </label>
            {#if scheduleEnabled}
              <select class="cron-select" bind:value={scheduleCron}>
                {#each cronPresets as preset}
                  <option value={preset.value}>{preset.label}</option>
                {/each}
              </select>
            {/if}
          </div>

          <!-- Parallel Config Toggle -->
          <div class="parallel-config-toggle">
            <button
              type="button"
              class="btn-expand-config"
              class:expanded={showSaveParallelConfig}
              on:click={toggleParallelConfig}
            >
              <span class="expand-icon">{showSaveParallelConfig ? '▼' : '▶'}</span>
              <span>⚡ Parallel Execution</span>
              <span class="config-badge">
                {parallelConfig.maxConcurrent} concurrent
              </span>
            </button>

            {#if showSaveParallelConfig}
              <div class="parallel-config-panel">
                <ParallelExecutionConfig
                  bind:config={parallelConfig}
                  onChange={(c) => parallelConfig = c}
                  {sidecarUrl}
                />
              </div>
            {/if}
          </div>

          <!-- Profile Selection (always visible, independent of schedule toggle) -->
          <div class="profile-selection">
            <div class="profile-selection-header">
              <label>👤 Profiles ({scheduleProfileIds.length}/{profiles.length} selected)</label>
              <div class="profile-actions">
                <button type="button" class="btn-small" on:click={selectAllFilteredProfiles}>
                  {filteredProfiles.every(p => scheduleProfileIds.includes(p.id)) ? 'Deselect All' : 'Select All'}
                </button>
                {#if scheduleProfileIds.length > 0}
                  <button type="button" class="btn-small btn-danger" on:click={clearProfileSelection}>
                    Clear
                  </button>
                {/if}
              </div>
            </div>

            <!-- Search and Filters -->
            <div class="profile-filters">
              <div class="filter-row">
                <div class="profile-search">
                  <input
                    type="text"
                    bind:value={profileSearchQuery}
                    placeholder="🔍 Search by name, notes..."
                  />
                  {#if profileSearchQuery}
                    <button class="btn-clear-search" on:click={() => profileSearchQuery = ''}>✕</button>
                  {/if}
                </div>
              </div>

              <div class="filter-row filter-dropdowns">
                {#if availableBrowsers.length > 1}
                  <select bind:value={profileFilterBrowser} class="filter-select">
                    <option value="">All Browsers</option>
                    {#each availableBrowsers as browser}
                      <option value={browser}>{browser}</option>
                    {/each}
                  </select>
                {/if}

                {#if availableOS.length > 1}
                  <select bind:value={profileFilterOS} class="filter-select">
                    <option value="">All OS</option>
                    {#each availableOS as os}
                      <option value={os}>{os}</option>
                    {/each}
                  </select>
                {/if}

                {#if availableGroups.length > 0}
                  <select bind:value={profileFilterGroup} class="filter-select">
                    <option value="">All Groups</option>
                    {#each availableGroups as group}
                      <option value={group}>{group}</option>
                    {/each}
                  </select>
                {/if}

                {#if availableStatuses.length > 1}
                  <select bind:value={profileFilterStatus} class="filter-select">
                    <option value="">All Status</option>
                    {#each availableStatuses as status}
                      <option value={status}>{status}</option>
                    {/each}
                  </select>
                {/if}

                {#if profileFilterBrowser || profileFilterOS || profileFilterGroup || profileFilterStatus}
                  <button class="btn-clear-filters" on:click={() => {
                    profileFilterBrowser = '';
                    profileFilterOS = '';
                    profileFilterGroup = '';
                    profileFilterStatus = '';
                  }}>
                    Clear filters
                  </button>
                {/if}
              </div>

              <div class="filter-summary">
                Showing {filteredProfiles.length} of {profiles.length} profiles
              </div>
            </div>

            <!-- Profile list -->
            <div class="schedule-profiles-grid">
              {#each displayedProfiles as profile}
                <label class="schedule-profile-item" class:selected={scheduleProfileIds.includes(profile.id)}>
                  <input
                    type="checkbox"
                    checked={scheduleProfileIds.includes(profile.id)}
                    on:change={() => toggleScheduleProfile(profile.id)}
                  />
                  <div class="profile-item-info">
                    <span class="profile-item-name">{profile.name || 'Unnamed'}</span>
                    <span class="profile-item-meta">{profile.browserType || 'chrome'}</span>
                  </div>
                </label>
              {/each}

              {#if filteredProfiles.length === 0}
                <div class="no-profiles-msg">
                  {#if profileSearchQuery}
                    No profiles match "{profileSearchQuery}"
                  {:else}
                    No profiles available
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Show more button -->
            {#if hasMoreProfiles}
              <button class="btn-show-more" on:click={showMoreProfiles}>
                Show more ({filteredProfiles.length - profileDisplayLimit} remaining)
              </button>
            {/if}
          </div>
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

<!-- Parallel Execution Config Modal -->
{#if showParallelConfig}
  <div class="modal-overlay" on:click={() => showParallelConfig = false}>
    <div class="parallel-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>⚡ Run Parallel: {currentWorkflow.name}</h3>
        <button class="btn-close" on:click={() => showParallelConfig = false}>&times;</button>
      </div>

      <div class="modal-body">
        <!-- Config Panel -->
        <ParallelExecutionConfig
          bind:config={parallelConfig}
          onChange={(c) => parallelConfig = c}
          {sidecarUrl}
        />

        <!-- Profile Selection -->
        <div class="parallel-profiles">
          <div class="profile-selection-header">
            <label>👤 Profiles ({selectedProfiles.length}/{profiles.length} selected)</label>
            <div class="profile-actions">
              <button type="button" class="btn-small" on:click={selectAllProfiles}>
                {selectedProfiles.length === profiles.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
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
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showParallelConfig = false}>
          Cancel
        </button>
        <button
          class="btn btn-parallel"
          on:click={startParallelExecution}
          disabled={selectedProfiles.length === 0}
        >
          ⚡ Start Parallel ({selectedProfiles.length} profiles)
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Execution Monitor Modal -->
{#if showExecutionMonitor && parallelExecutionId}
  <div class="modal-overlay" on:click={handleMonitorClose}>
    <div class="monitor-modal" on:click|stopPropagation>
      <ExecutionMonitor
        executionId={parallelExecutionId}
        onClose={handleMonitorClose}
        {sidecarUrl}
      />
    </div>
  </div>
{/if}

<!-- Notification Config Modal -->
{#if showNotificationConfig}
  <div class="modal-overlay" on:click={() => showNotificationConfig = false}>
    <div on:click|stopPropagation>
      <NotificationConfig onClose={() => showNotificationConfig = false} {sidecarUrl} />
    </div>
  </div>
{/if}

<!-- Reporting Dashboard Modal -->
{#if showReportingDashboard}
  <div class="modal-overlay large" on:click={() => showReportingDashboard = false}>
    <div class="reporting-modal" on:click|stopPropagation>
      <button class="btn-close-modal" on:click={() => showReportingDashboard = false}>&times;</button>
      <ReportingDashboard {sidecarUrl} />
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
          <!-- Run Configuration -->
          <div class="run-config-section">
            <button type="button" class="config-toggle" on:click={() => showRunConfig = !showRunConfig}>
              <span class="toggle-icon">{showRunConfig ? '▼' : '▶'}</span>
              <span>⚙️ Run Options</span>
              <span class="config-summary">
                {#if runConfig.headless}👻 Headless{/if}
                {#if Object.values(runConfig.blocking).some(v => v)}
                  🚫 Blocking: {[
                    runConfig.blocking.images && 'img',
                    runConfig.blocking.media && 'media',
                    runConfig.blocking.fonts && 'fonts',
                    runConfig.blocking.css && 'css',
                    runConfig.blocking.trackers && 'trackers'
                  ].filter(Boolean).join(', ')}
                {/if}
              </span>
            </button>

            {#if showRunConfig}
              <div class="run-config-content">
                <div class="config-row">
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={runConfig.headless} />
                    <span>👻 Headless Mode</span>
                    <small class="config-hint">Run browsers without visible UI (faster)</small>
                  </label>
                </div>

                <div class="config-group">
                  <label class="config-group-label">🚫 Block Resources (faster loading)</label>
                  <div class="blocking-options">
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={runConfig.blocking.images} />
                      <span>Images</span>
                    </label>
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={runConfig.blocking.media} />
                      <span>Media</span>
                    </label>
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={runConfig.blocking.fonts} />
                      <span>Fonts</span>
                    </label>
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={runConfig.blocking.css} />
                      <span>CSS</span>
                    </label>
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={runConfig.blocking.trackers} />
                      <span>Trackers</span>
                    </label>
                  </div>
                </div>
              </div>
            {/if}
          </div>

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

  /* LIST VIEW STYLES */
  .list-view {
    padding: 24px;
    overflow-y: auto;
    height: 100%;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .list-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .list-actions {
    display: flex;
    gap: 12px;
  }

  /* Workflow Search and Filters */
  .workflow-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding: 12px;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 8px;
  }

  .workflow-search {
    position: relative;
    flex: 1;
    min-width: 200px;
  }

  .workflow-search input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .workflow-tag-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-filter-btn {
    padding: 4px 12px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 16px;
    color: var(--text-secondary, #888);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tag-filter-btn:hover {
    border-color: var(--accent-color, #3b82f6);
    color: var(--text-primary, #fff);
  }

  .tag-filter-btn.active {
    background: var(--accent-color, #3b82f6);
    border-color: var(--accent-color, #3b82f6);
    color: white;
  }

  .workflow-count {
    font-size: 12px;
    color: var(--text-secondary, #888);
    margin-left: auto;
  }

  /* Card Tags */
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .card-tag {
    padding: 2px 8px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    font-size: 10px;
    border-radius: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    text-align: center;
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 20px;
    color: var(--text-primary, #fff);
  }

  .empty-state p {
    margin: 0 0 24px 0;
    color: var(--text-secondary, #888);
  }

  .workflow-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .workflow-card {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .workflow-card:hover {
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .card-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .card-steps {
    font-size: 12px;
    color: var(--text-secondary, #888);
    background: var(--bg-primary, #121212);
    padding: 4px 8px;
    border-radius: 12px;
  }

  .card-body {
    padding: 16px;
    min-height: 80px;
  }

  .card-desc {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--text-secondary, #888);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    background: var(--bg-primary, #121212);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .meta-item.active {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .meta-item.inactive {
    opacity: 0.5;
  }

  .meta-item.success {
    color: #22c55e;
  }

  .meta-item.failed {
    color: #ef4444;
  }

  .meta-item.headless {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .meta-item.blocking {
    background: rgba(249, 115, 22, 0.15);
    color: #fb923c;
  }

  .meta-item.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .meta-icon {
    font-size: 12px;
  }

  .meta-text {
    white-space: nowrap;
  }

  .workflow-card.schedule-active {
    border-color: rgba(34, 197, 94, 0.3);
  }

  .workflow-card.schedule-active .card-header {
    background: rgba(34, 197, 94, 0.05);
  }

  .workflow-card.schedule-paused {
    border-color: rgba(245, 158, 11, 0.3);
  }

  .workflow-card.schedule-paused .card-header {
    background: rgba(245, 158, 11, 0.05);
  }

  .card-actions {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
    background: var(--bg-primary, #121212);
    border-top: 1px solid var(--border-color, #333);
  }

  .btn-action {
    flex: 1;
    padding: 8px 4px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn-action.btn-run {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .btn-action.btn-run:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .btn-action.btn-edit {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .btn-action.btn-edit:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .btn-action.btn-debug {
    background: rgba(236, 72, 153, 0.2);
    color: #ec4899;
  }

  .btn-action.btn-debug:hover {
    background: rgba(236, 72, 153, 0.3);
  }

  .btn-action.btn-duplicate {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .btn-action.btn-duplicate:hover {
    background: rgba(139, 92, 246, 0.3);
  }

  .btn-action.btn-export {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .btn-action.btn-export:hover {
    background: rgba(245, 158, 11, 0.3);
  }

  .btn-action.btn-delete {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .btn-action.btn-delete:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .btn-action.btn-parallel {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .btn-action.btn-parallel:hover {
    background: rgba(234, 179, 8, 0.3);
  }

  .btn-parallel {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.4);
  }

  .btn-parallel:hover:not(:disabled) {
    background: rgba(234, 179, 8, 0.3);
    border-color: rgba(234, 179, 8, 0.6);
  }

  .btn-back {
    background: transparent;
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, #333);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* EDITOR VIEW STYLES */
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

  .canvas-mode-toggle {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 2px;
    margin-left: 8px;
  }

  .btn-mode {
    padding: 4px 10px;
    font-size: 14px;
    background: transparent;
    color: #888;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-mode:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-mode.active {
    color: #fff;
    background: var(--accent-color, #3b82f6);
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
    z-index: 10000;
  }

  .save-modal,
  .profile-selector-modal,
  .parallel-modal,
  .monitor-modal {
    position: relative;
    z-index: 10001;
    pointer-events: auto;
  }

  .save-modal *,
  .profile-selector-modal *,
  .parallel-modal *,
  .monitor-modal * {
    pointer-events: auto;
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

  /* Reporting Modal */
  .modal-overlay.large {
    padding: 20px;
  }

  .reporting-modal {
    background: var(--bg-primary, #0d0d1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    position: relative;
  }

  .btn-close-modal {
    position: absolute;
    top: 16px;
    right: 16px;
    background: var(--bg-tertiary, #2d2d44);
    border: none;
    color: var(--text-secondary, #888);
    font-size: 20px;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 4px;
    z-index: 10;
  }

  .btn-close-modal:hover {
    color: var(--text-primary, #fff);
    background: var(--border-color, #333);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    position: relative;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #333);
  }

  /* Run Config Section */
  .run-config-section {
    margin-bottom: 16px;
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    overflow: hidden;
  }

  .config-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-tertiary, #252525);
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    font-size: 14px;
    text-align: left;
  }

  .config-toggle:hover {
    background: var(--bg-hover, #2a2a2a);
  }

  .toggle-icon {
    font-size: 10px;
    color: var(--text-secondary, #888);
  }

  .config-summary {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .run-config-content {
    padding: 16px;
    background: var(--bg-secondary, #1a1a1a);
    border-top: 1px solid var(--border-color, #333);
  }

  .config-row {
    margin-bottom: 12px;
  }

  .config-row:last-child {
    margin-bottom: 0;
  }

  .config-hint {
    display: block;
    margin-left: 26px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    margin-top: 4px;
  }

  .config-group {
    margin-top: 12px;
  }

  .config-group-label {
    display: block;
    font-size: 13px;
    color: var(--text-secondary, #888);
    margin-bottom: 8px;
  }

  .blocking-options {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .checkbox-label.small {
    font-size: 13px;
  }

  .checkbox-label.small input[type="checkbox"] {
    width: 16px;
    height: 16px;
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
    width: 600px;
    max-width: 90vw;
    max-height: 85vh;
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

  .schedule-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .schedule-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .schedule-toggle input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .cron-select {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  /* Parallel Config Toggle */
  .parallel-config-toggle {
    margin: 16px 0;
  }

  .btn-expand-config {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    color: var(--text-primary, #fff);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .btn-expand-config:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .btn-expand-config.expanded {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom-color: transparent;
  }

  .expand-icon {
    font-size: 10px;
    color: var(--text-secondary, #888);
  }

  .config-badge {
    margin-left: auto;
    padding: 2px 8px;
    background: rgba(99, 102, 241, 0.2);
    border-radius: 4px;
    font-size: 11px;
    color: #a78bfa;
  }

  .parallel-config-panel {
    border: 1px solid var(--border-color, #333);
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
  }

  .parallel-config-panel :global(.parallel-config) {
    border: none;
    border-radius: 0;
  }

  /* Tags Input */
  .tags-input-container {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    padding: 8px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    font-size: 12px;
    border-radius: 12px;
  }

  .tag-remove {
    background: none;
    border: none;
    color: #a78bfa;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    opacity: 0.7;
  }

  .tag-remove:hover {
    opacity: 1;
  }

  .tag-input-row {
    display: flex;
    gap: 6px;
  }

  .tag-input-row input {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 12px;
  }

  .btn-add-tag {
    padding: 6px 12px;
    background: var(--accent-color, #3b82f6);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;
  }

  .btn-add-tag:hover {
    opacity: 0.9;
  }

  .suggested-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #333);
  }

  .suggested-label {
    font-size: 11px;
    color: var(--text-secondary, #888);
  }

  .suggested-tag {
    padding: 2px 8px;
    background: transparent;
    border: 1px dashed var(--border-color, #333);
    border-radius: 10px;
    color: var(--text-secondary, #888);
    font-size: 11px;
    cursor: pointer;
  }

  .suggested-tag:hover {
    border-color: var(--accent-color, #3b82f6);
    color: var(--text-primary, #fff);
  }

  /* Profile Selection */
  .profile-selection {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 12px;
  }

  .profile-selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .profile-selection-header label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .profile-actions {
    display: flex;
    gap: 8px;
  }

  .btn-small {
    padding: 4px 10px;
    font-size: 11px;
    border: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #1a1a1a);
    color: var(--text-primary, #fff);
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-small:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-small.btn-danger {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .btn-small.btn-danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .profile-filters {
    margin-bottom: 12px;
  }

  .filter-row {
    margin-bottom: 8px;
  }

  .profile-search {
    position: relative;
  }

  .profile-search input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .profile-search input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .btn-clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    font-size: 14px;
  }

  .filter-dropdowns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .filter-select {
    padding: 6px 10px;
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 12px;
    cursor: pointer;
    min-width: 100px;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .btn-clear-filters {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #ef4444;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-clear-filters:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .filter-summary {
    font-size: 11px;
    color: var(--text-secondary, #888);
  }

  .schedule-profiles-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
    padding: 2px;
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
    transition: all 0.15s;
  }

  .schedule-profile-item:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .schedule-profile-item.selected {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .schedule-profile-item input {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .profile-item-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .profile-item-name {
    font-size: 12px;
    color: var(--text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-item-meta {
    font-size: 10px;
    color: var(--text-secondary, #888);
  }

  .no-profiles-msg {
    grid-column: 1 / -1;
    text-align: center;
    padding: 20px;
    color: var(--text-secondary, #888);
    font-size: 13px;
  }

  .btn-show-more {
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    background: var(--bg-secondary, #1a1a1a);
    border: 1px dashed var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-secondary, #888);
    font-size: 12px;
    cursor: pointer;
  }

  .btn-show-more:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #fff);
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

  /* Parallel Execution Modal */
  .parallel-modal {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 700px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .parallel-profiles {
    margin-top: 16px;
    padding: 16px;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
  }

  .parallel-profiles .profiles-grid {
    max-height: 250px;
  }

  /* Monitor Modal */
  .monitor-modal {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 600px;
    max-width: 95vw;
    max-height: 90vh;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }
</style>
