<script>
  import { onMount } from 'svelte';
  import {
    getDefaultWarmupTemplates,
    getActiveWarmups,
    getWarmupStats,
    startWarmup,
    pauseWarmup,
    resumeWarmup,
    stopWarmup,
    runWarmupNow,
    deleteWarmupProgress,
    getProfiles
  } from '../api.js';
  import { showAlert, showConfirm } from '../stores/dialog.js';
  import WarmupProgress from './WarmupProgress.svelte';

  // State
  let templates = [];
  let activeWarmups = [];
  let stats = { total: 0, active: 0, completed: 0, failed: 0, paused: 0 };
  let profiles = [];
  let loading = true;
  let showStartModal = false;
  let selectedTemplate = null;
  let selectedProfileIds = [];
  let searchQuery = '';

  // Platform icons
  const platformIcons = {
    facebook: '\u{1F535}',
    tiktok: '\u{1F3B5}',
    instagram: '\u{1F4F7}',
    google: '\u{1F50D}',
    twitter: '\u{1F426}',
    youtube: '\u{1F4FA}',
    linkedin: '\u{1F4BC}',
    telegram: '\u{2708}'
  };

  const defaultIcon = '\u{1F310}';

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [templatesRes, warmupsRes, statsRes, profilesRes] = await Promise.all([
        getDefaultWarmupTemplates(),
        getActiveWarmups(),
        getWarmupStats(),
        getProfiles()
      ]);

      console.log('templatesRes:', templatesRes);
      console.log('warmupsRes:', warmupsRes);
      console.log('statsRes:', statsRes);

      if (templatesRes.success) templates = templatesRes.templates;
      if (warmupsRes.success) activeWarmups = warmupsRes.warmups;
      if (statsRes.success) stats = statsRes.stats;
      if (profilesRes) profiles = profilesRes;

      console.log('templates loaded:', templates.length);
    } catch (e) {
      console.error('Failed to load warmup data:', e);
    }
    loading = false;
  }

  function openStartModal(template) {
    selectedTemplate = template;
    selectedProfileIds = [];
    showStartModal = true;
  }

  function closeStartModal() {
    showStartModal = false;
    selectedTemplate = null;
    selectedProfileIds = [];
  }

  function toggleProfile(profileId) {
    if (selectedProfileIds.includes(profileId)) {
      selectedProfileIds = selectedProfileIds.filter(id => id !== profileId);
    } else {
      selectedProfileIds = [...selectedProfileIds, profileId];
    }
  }

  function selectAllProfiles() {
    selectedProfileIds = filteredProfiles.map(p => p.id);
  }

  function deselectAllProfiles() {
    selectedProfileIds = [];
  }

  async function handleStartWarmup() {
    if (selectedProfileIds.length === 0) {
      showAlert('Please select at least one profile', { title: 'No Profiles Selected' });
      return;
    }

    loading = true;
    try {
      const profileNames = {};
      for (const id of selectedProfileIds) {
        const p = profiles.find(p => p.id === id);
        if (p) profileNames[id] = p.name;
      }

      const result = await startWarmup(selectedTemplate.id, selectedProfileIds, { profileNames });
      if (result.success) {
        showAlert(`Started warmup for ${selectedProfileIds.length} profile(s)`, { title: 'Warmup Started' });
        closeStartModal();
        await loadData();
      } else {
        showAlert(result.error || 'Failed to start warmup', { title: 'Error', variant: 'danger' });
      }
    } catch (e) {
      showAlert(e.message, { title: 'Error', variant: 'danger' });
    }
    loading = false;
  }

  async function handlePause(progressId) {
    const result = await pauseWarmup(progressId);
    if (result.success) await loadData();
  }

  async function handleResume(progressId) {
    const result = await resumeWarmup(progressId);
    if (result.success) await loadData();
  }

  async function handleRunNow(progressId) {
    showAlert('Starting warmup... Browser will open shortly.', { title: 'Running Warmup' });
    const result = await runWarmupNow(progressId);
    if (result.success) {
      showAlert(`Warmup completed! Day ${result.newDay}${result.isCompleted ? ' - All done!' : ''}`, { title: 'Warmup Finished' });
      await loadData();
    } else {
      showAlert(`Warmup failed: ${result.error}`, { title: 'Error', variant: 'danger' });
      await loadData();
    }
  }

  async function handleStop(progressId) {
    const confirmed = await showConfirm('Are you sure you want to stop this warmup?', {
      title: 'Stop Warmup',
      variant: 'danger',
      confirmText: 'Stop'
    });
    if (!confirmed) return;

    const result = await stopWarmup(progressId);
    if (result.success) await loadData();
  }

  async function handleDelete(progressId) {
    const confirmed = await showConfirm('Are you sure you want to delete this warmup progress?', {
      title: 'Delete Warmup',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    const result = await deleteWarmupProgress(progressId);
    if (result.success) await loadData();
  }

  $: filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
</script>

<div class="warmup-dashboard">
  <!-- Header -->
  <div class="header">
    <h2>Account Warm-up</h2>
    <button class="btn-refresh" on:click={loadData} disabled={loading}>
      {loading ? 'Loading...' : 'Refresh'}
    </button>
  </div>

  <!-- Stats -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{stats.total}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat-card active">
      <div class="stat-value">{stats.active}</div>
      <div class="stat-label">Active</div>
    </div>
    <div class="stat-card completed">
      <div class="stat-value">{stats.completed}</div>
      <div class="stat-label">Completed</div>
    </div>
    <div class="stat-card paused">
      <div class="stat-value">{stats.paused}</div>
      <div class="stat-label">Paused</div>
    </div>
    <div class="stat-card failed">
      <div class="stat-value">{stats.failed}</div>
      <div class="stat-label">Failed</div>
    </div>
  </div>

  <!-- Templates -->
  <div class="section">
    <h3>Templates</h3>
    <div class="template-grid">
      {#each templates as template}
        <div class="template-card">
          <div class="template-icon">{platformIcons[template.platform] || defaultIcon}</div>
          <div class="template-info">
            <div class="template-name">{template.name}</div>
            <div class="template-meta">
              {template.totalDays} days / {template.phases.length} phases
            </div>
          </div>
          <button class="btn-start" on:click={() => openStartModal(template)}>
            Start
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Active Warmups -->
  <div class="section">
    <h3>Active Warmups ({activeWarmups.length})</h3>
    {#if activeWarmups.length === 0}
      <div class="empty-state">
        No active warmups. Select a template above to start.
      </div>
    {:else}
      <div class="warmup-list">
        {#each activeWarmups as warmup}
          <WarmupProgress
            {warmup}
            on:runNow={() => handleRunNow(warmup.id)}
            on:pause={() => handlePause(warmup.id)}
            on:resume={() => handleResume(warmup.id)}
            on:stop={() => handleStop(warmup.id)}
            on:delete={() => handleDelete(warmup.id)}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Start Warmup Modal -->
{#if showStartModal && selectedTemplate}
  <div class="modal-overlay" on:click={closeStartModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>
          {platformIcons[selectedTemplate.platform]}
          Start {selectedTemplate.name}
        </h3>
        <button class="close-btn" on:click={closeStartModal}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="template-summary">
          <p><strong>Duration:</strong> {selectedTemplate.totalDays} days</p>
          <p><strong>Phases:</strong> {selectedTemplate.phases.length}</p>
          <p><strong>Schedule:</strong> {selectedTemplate.schedule?.runAt?.join(', ') || '09:00, 14:00, 20:00'}</p>
        </div>

        <div class="profile-selector">
          <div class="selector-header">
            <span>Select Profiles ({selectedProfileIds.length} selected)</span>
            <div class="selector-actions">
              <button class="btn-sm" on:click={selectAllProfiles}>Select All</button>
              <button class="btn-sm" on:click={deselectAllProfiles}>Deselect All</button>
            </div>
          </div>

          <input
            type="text"
            class="search-input"
            placeholder="Search profiles..."
            bind:value={searchQuery}
          />

          <div class="profile-list">
            {#each filteredProfiles as profile}
              <label class="profile-item" class:selected={selectedProfileIds.includes(profile.id)}>
                <input
                  type="checkbox"
                  checked={selectedProfileIds.includes(profile.id)}
                  on:change={() => toggleProfile(profile.id)}
                />
                <span class="profile-name">{profile.name}</span>
              </label>
            {/each}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" on:click={closeStartModal}>Cancel</button>
        <button
          class="btn-start-warmup"
          on:click={handleStartWarmup}
          disabled={selectedProfileIds.length === 0 || loading}
        >
          Start Warmup ({selectedProfileIds.length})
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .warmup-dashboard {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .header h2 {
    margin: 0;
    color: #e94560;
  }

  .btn-refresh {
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-refresh:hover {
    background: #1a4a7a;
  }

  .btn-refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Stats */
  .stats-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    flex: 1;
    background: #0f3460;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
  }

  .stat-label {
    font-size: 0.8rem;
    color: #888;
    text-transform: uppercase;
  }

  .stat-card.active .stat-value { color: #3b82f6; }
  .stat-card.completed .stat-value { color: #22c55e; }
  .stat-card.paused .stat-value { color: #f59e0b; }
  .stat-card.failed .stat-value { color: #ef4444; }

  /* Section */
  .section {
    margin-bottom: 2rem;
  }

  .section h3 {
    margin: 0 0 1rem 0;
    color: #ccc;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Templates */
  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .template-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 8px;
    padding: 1rem;
    transition: border-color 0.2s;
  }

  .template-card:hover {
    border-color: #e94560;
  }

  .template-icon {
    font-size: 2rem;
  }

  .template-info {
    flex: 1;
  }

  .template-name {
    font-weight: 600;
    color: #fff;
  }

  .template-meta {
    font-size: 0.8rem;
    color: #888;
  }

  .btn-start {
    background: #e94560;
    border: none;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-start:hover {
    background: #d63850;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #666;
    background: #0f3460;
    border-radius: 8px;
  }

  /* Warmup List */
  .warmup-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Modal */
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

  .modal {
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 12px;
    width: 500px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #0f3460;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
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

  .template-summary {
    background: #0f3460;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .template-summary p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .profile-selector {
    margin-top: 1rem;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .selector-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-sm {
    background: none;
    border: 1px solid #1a4a7a;
    color: #888;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-sm:hover {
    border-color: #e94560;
    color: #fff;
  }

  .search-input {
    width: 100%;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 6px;
    padding: 0.5rem;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #e94560;
  }

  .profile-list {
    max-height: 200px;
    overflow-y: auto;
    background: #0f3460;
    border-radius: 8px;
    padding: 0.5rem;
  }

  .profile-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .profile-item:hover {
    background: #1a4a7a;
  }

  .profile-item.selected {
    background: rgba(233, 69, 96, 0.2);
  }

  .profile-name {
    color: #fff;
    font-size: 0.9rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #0f3460;
  }

  .btn-cancel {
    background: none;
    border: 1px solid #666;
    color: #888;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    border-color: #888;
    color: #fff;
  }

  .btn-start-warmup {
    background: #e94560;
    border: none;
    color: #fff;
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-start-warmup:hover {
    background: #d63850;
  }

  .btn-start-warmup:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
