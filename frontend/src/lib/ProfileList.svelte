<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getProfiles, getProxies, deleteProfile, launchProfile, createNewProfile, getPresetList, createFromPreset, testProfileFingerprint, getResourceCountByPlatform } from './api.js';
  import { showAlert, showConfirm } from './stores/dialog.js';
  import ProfileEditor from './ProfileEditor.svelte';

  // Component imports
  import ProfileFilters from './components/ProfileFilters.svelte';
  import ProfileBulkActions from './components/ProfileBulkActions.svelte';
  import ProfileCard from './components/ProfileCard.svelte';
  import ProfileTestModal from './components/ProfileTestModal.svelte';

  // Core data
  let profiles = [];
  let proxies = [];
  let proxyMap = {};
  let selectedProfile = null;
  let loading = true;
  let showEditor = false;
  let editingProfile = null;

  // Presets
  let presets = [];
  let showPresetMenu = false;

  // Resource counts
  let resourceCounts = {};

  // Filters
  let searchQuery = '';
  let filterOS = '';
  let filterStatus = '';
  let filterProxy = '';
  let filterTag = '';
  let showFilters = false;

  // Bulk selection
  let selectedIds = new Set();
  let selectAll = false;

  // Menu states
  let openMenuProfileId = null;
  let moreMenuProfileId = null;
  let launchingProfileId = null;

  // Test modal
  let showTestModal = false;
  let testingProfile = null;
  let testResults = null;
  let testLoading = false;

  const dispatch = createEventDispatcher();

  // Fingerprint test sites
  const testSites = [
    { name: 'BrowserLeaks Canvas', url: 'https://browserleaks.com/canvas', icon: '🎨' },
    { name: 'BrowserLeaks WebGL', url: 'https://browserleaks.com/webgl', icon: '🖼️' },
    { name: 'BrowserLeaks JavaScript', url: 'https://browserleaks.com/javascript', icon: '📜' },
    { name: 'PixelScan', url: 'https://pixelscan.net/', icon: '🔍' },
    { name: 'CreepJS', url: 'https://abrahamjuliot.github.io/creepjs/', icon: '👻' },
    { name: 'AmIUnique', url: 'https://amiunique.org/fingerprint', icon: '🆔' },
    { name: 'Whoer', url: 'https://whoer.net/', icon: '🌐' },
    { name: 'IPLeak', url: 'https://ipleak.net/', icon: '📡' },
  ];

  // Computed values
  $: allTags = [...new Set(profiles.flatMap(p => p.platformTags || []))].sort();
  $: allOS = [...new Set(profiles.map(p => p.os || 'windows'))].sort();

  // Filtered profiles
  $: filteredProfiles = profiles.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    if (filterOS && (p.os || 'windows') !== filterOS) return false;
    if (filterStatus && (p.status || 'active') !== filterStatus) return false;
    if (filterProxy === 'none' && p.proxyId) return false;
    if (filterProxy && filterProxy !== 'none' && p.proxyId !== filterProxy) return false;
    if (filterTag && !(p.platformTags || []).includes(filterTag)) return false;
    return true;
  });

  // Lifecycle
  onMount(async () => {
    await loadData();
    loadPresets();
  });

  // Data loading
  async function loadData() {
    loading = true;
    try {
      [profiles, proxies] = await Promise.all([
        getProfiles(),
        getProxies()
      ]);
      proxyMap = {};
      for (const p of proxies) {
        proxyMap[p.id] = p;
      }
      await loadResourceCounts();
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    loading = false;
  }

  function loadPresets() {
    presets = getPresetList() || [];
  }

  async function loadResourceCounts() {
    resourceCounts = {};
    for (const profile of profiles) {
      try {
        const counts = await getResourceCountByPlatform(profile.id);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        resourceCounts[profile.id] = total;
      } catch (e) {
        resourceCounts[profile.id] = 0;
      }
    }
  }

  // Profile actions
  function selectProfile(profile) {
    selectedProfile = profile;
  }

  function openEditor(profile = null) {
    editingProfile = profile;
    showEditor = true;
  }

  function closeEditor() {
    showEditor = false;
    editingProfile = null;
    loadData();
  }

  async function handleCreateProfile() {
    try {
      const name = `Profile ${profiles.length + 1}`;
      await createNewProfile({ name });
      await loadData();
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  }

  async function handleCreateFromPreset(presetId) {
    try {
      await createFromPreset(presetId);
      showPresetMenu = false;
      await loadData();
    } catch (error) {
      console.error('Failed to create from preset:', error);
      showAlert('Failed to create profile: ' + error, { title: 'Error', variant: 'danger' });
    }
  }

  async function handleDeleteProfile(id) {
    const confirmed = await showConfirm('Delete this profile?', {
      title: 'Delete Profile',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;
    try {
      await deleteProfile(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  }

  // Launch profile
  async function handleLaunchProfile(profile, url) {
    launchingProfileId = profile.id;
    openMenuProfileId = null;

    try {
      const proxy = profile.proxyId ? proxyMap[profile.proxyId] : null;
      const proxyConfig = proxy ? {
        host: proxy.host,
        port: proxy.port,
        type: proxy.type || proxy.proxyType,
        username: proxy.username,
        password: proxy.password
      } : null;
      await launchProfile(profile, proxyConfig, url);
    } catch (error) {
      console.error('Failed to launch profile:', error);
      showAlert('Failed to launch: ' + error, { title: 'Launch Failed', variant: 'danger' });
    }

    launchingProfileId = null;
  }

  // Test fingerprint
  async function handleTestFingerprint(profile) {
    testingProfile = profile;
    testResults = null;
    testLoading = true;
    showTestModal = true;
    moreMenuProfileId = null;

    try {
      testResults = await testProfileFingerprint(profile.id);
    } catch (error) {
      console.error('Failed to test fingerprint:', error);
      testResults = { success: false, error: error.message };
    }
    testLoading = false;
  }

  function closeTestModal() {
    showTestModal = false;
    testingProfile = null;
    testResults = null;
  }

  // Menu handlers
  function closeMenus() {
    openMenuProfileId = null;
    moreMenuProfileId = null;
  }

  function handleToggleOpenMenu(event) {
    const { id } = event.detail;
    openMenuProfileId = openMenuProfileId === id ? null : id;
    moreMenuProfileId = null;
  }

  function handleToggleMoreMenu(event) {
    const { id } = event.detail;
    moreMenuProfileId = moreMenuProfileId === id ? null : id;
    openMenuProfileId = null;
  }

  // Bulk selection handlers
  function toggleSelectAll() {
    if (selectAll) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredProfiles.map(p => p.id));
    }
    selectAll = !selectAll;
  }

  function toggleSelect(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = selectedIds;
    selectAll = selectedIds.size === filteredProfiles.length && filteredProfiles.length > 0;
  }

  function clearSelection() {
    selectedIds = new Set();
    selectAll = false;
  }

  // Bulk actions
  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    const confirmed = await showConfirm(`Delete ${selectedIds.size} profiles?`, {
      title: 'Bulk Delete',
      variant: 'danger',
      confirmText: 'Delete All'
    });
    if (!confirmed) return;

    loading = true;
    for (const id of selectedIds) {
      try {
        await deleteProfile(id);
      } catch (e) {
        console.error('Failed to delete profile:', id, e);
      }
    }
    clearSelection();
    await loadData();
  }

  async function bulkLaunch() {
    if (selectedIds.size === 0) return;
    const confirmed = await showConfirm(`Open ${selectedIds.size} profiles?`, {
      title: 'Bulk Launch',
      confirmText: 'Open All'
    });
    if (!confirmed) return;

    for (const id of selectedIds) {
      const profile = profiles.find(p => p.id === id);
      if (profile) {
        try {
          await handleLaunchProfile(profile, 'https://google.com');
        } catch (e) {
          console.error('Failed to launch profile:', id, e);
        }
      }
    }
    clearSelection();
  }

  function bulkExport() {
    // Export selected profiles as JSON
    const exportData = filteredProfiles.filter(p => selectedIds.has(p.id));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profiles-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Card event handlers
  function onCardSelect(event) {
    selectProfile(event.detail.profile || profiles.find(p => p.id === event.detail.id));
  }

  function onCardEdit(event) {
    moreMenuProfileId = null;
    openEditor(event.detail.profile);
  }

  function onCardCheck(event) {
    toggleSelect(event.detail.id);
  }

  function onCardLaunch(event) {
    handleLaunchProfile(event.detail.profile, event.detail.url);
  }

  function onCardTestFingerprint(event) {
    handleTestFingerprint(event.detail.profile);
  }

  function onCardDelete(event) {
    moreMenuProfileId = null;
    handleDeleteProfile(event.detail.id);
  }
</script>

<div class="profile-list" on:click={closeMenus}>
  {#if showEditor}
    <ProfileEditor
      profile={editingProfile}
      on:close={closeEditor}
      on:save={closeEditor}
    />
  {:else}
    <!-- Toolbar -->
    <div class="toolbar">
      <h2>Profiles ({profiles.length})</h2>
      <div class="actions">
        <button class="btn primary" on:click={() => openEditor(null)}>+ New</button>
        <button class="btn" on:click={handleCreateProfile}>🎲 Random</button>
        <div class="preset-dropdown">
          <button class="btn" on:click={() => showPresetMenu = !showPresetMenu}>
            📋 Presets
          </button>
          {#if showPresetMenu}
            <div class="preset-menu" on:click|stopPropagation>
              {#each presets as preset}
                <button class="preset-item" on:click={() => handleCreateFromPreset(preset.id)}>
                  <span class="preset-os">
                    {#if preset.os === 'windows'}🪟
                    {:else if preset.os === 'macos'}🍎
                    {:else if preset.os === 'linux'}🐧
                    {:else if preset.os === 'android'}🤖
                    {:else if preset.os === 'ios'}📱
                    {:else}💻
                    {/if}
                  </span>
                  <span class="preset-name">{preset.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Filters -->
    <ProfileFilters
      bind:searchQuery
      bind:filterOS
      bind:filterStatus
      bind:filterProxy
      bind:filterTag
      bind:showFilters
      {allOS}
      {allTags}
      allProxies={proxies}
    />

    <!-- Bulk Actions -->
    <ProfileBulkActions
      selectedCount={selectedIds.size}
      totalCount={filteredProfiles.length}
      {selectAll}
      on:toggleSelectAll={toggleSelectAll}
      on:bulkDelete={bulkDelete}
      on:bulkLaunch={bulkLaunch}
      on:bulkExport={bulkExport}
      on:clearSelection={clearSelection}
    />

    <!-- Profile List -->
    <div class="list">
      {#if loading}
        <div class="empty">
          <div class="spinner"></div>
          <p>Loading profiles...</p>
        </div>
      {:else if profiles.length === 0}
        <div class="empty">
          <p>No profiles yet.</p>
          <p>Create a new profile or generate a random one.</p>
        </div>
      {:else if filteredProfiles.length === 0}
        <div class="empty">
          <p>No profiles match your filters.</p>
          <button class="btn" on:click={() => { searchQuery = ''; filterOS = ''; filterStatus = ''; filterProxy = ''; filterTag = ''; }}>
            Clear Filters
          </button>
        </div>
      {:else}
        <div class="list-header">
          <span class="count">{filteredProfiles.length} profile{filteredProfiles.length !== 1 ? 's' : ''}</span>
        </div>
        {#each filteredProfiles as profile (profile.id)}
          <ProfileCard
            {profile}
            proxyInfo={profile.proxyId ? proxyMap[profile.proxyId] : null}
            resourceCount={resourceCounts[profile.id] || 0}
            isSelected={selectedProfile?.id === profile.id}
            isChecked={selectedIds.has(profile.id)}
            isLaunching={launchingProfileId === profile.id}
            showOpenMenu={openMenuProfileId === profile.id}
            showMoreMenu={moreMenuProfileId === profile.id}
            {testSites}
            on:select={onCardSelect}
            on:edit={onCardEdit}
            on:check={onCardCheck}
            on:toggleOpenMenu={handleToggleOpenMenu}
            on:toggleMoreMenu={handleToggleMoreMenu}
            on:launch={onCardLaunch}
            on:testFingerprint={onCardTestFingerprint}
            on:delete={onCardDelete}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>

<!-- Test Modal -->
<ProfileTestModal
  show={showTestModal}
  profile={testingProfile}
  results={testResults}
  loading={testLoading}
  on:close={closeTestModal}
/>

<style>
  .profile-list {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h2 {
    margin: 0;
    color: #e94560;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    background: #0f3460;
    border: 1px solid #0f3460;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover {
    background: #1a4a7a;
  }

  .btn.primary {
    background: #e94560;
    border-color: #e94560;
  }

  .btn.primary:hover {
    background: #d63850;
  }

  .list {
    flex: 1;
    overflow-y: auto;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding: 0 0.5rem;
  }

  .list-header .count {
    font-size: 0.85rem;
    color: #888;
  }

  .empty {
    text-align: center;
    padding: 3rem;
    color: #666;
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

  /* Preset Dropdown */
  .preset-dropdown {
    position: relative;
  }

  .preset-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 8px;
    min-width: 280px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    margin-top: 4px;
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.6rem 1rem;
    text-align: left;
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .preset-item:hover {
    background: #0f3460;
    color: #fff;
  }

  .preset-os {
    font-size: 1.2rem;
  }

  .preset-name {
    flex: 1;
  }
</style>
