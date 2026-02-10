<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getProfiles, getProxies, deleteProfile, launchProfile, createNewProfile, getPresetList, createFromPreset, testProfileFingerprint, getResourceCountByPlatform } from './api.js';
  import { showAlert, showConfirm } from './stores/dialog.js';
  import ProfileEditor from './ProfileEditor.svelte';
  import ResourceModal from './ResourceModal.svelte';

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

  // Resources
  let showResourceModal = false;
  let resourceModalProfile = null;
  let resourceCounts = {};

  // Test fingerprint
  let showTestModal = false;
  let testingProfile = null;
  let testResults = null;
  let testLoading = false;

  // Menu states
  let openMenuProfileId = null;
  let moreMenuProfileId = null;
  let launchingProfileId = null;

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

  onMount(async () => {
    await loadData();
    loadPresets();
  });

  async function loadData() {
    loading = true;
    try {
      [profiles, proxies] = await Promise.all([
        getProfiles(),
        getProxies()
      ]);
      // Build proxy map
      proxyMap = {};
      for (const p of proxies) {
        proxyMap[p.id] = p;
      }
      // Load resource counts for all profiles
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

  function openResourceModal(profile) {
    resourceModalProfile = profile;
    showResourceModal = true;
  }

  function closeResourceModal() {
    showResourceModal = false;
    resourceModalProfile = null;
    loadResourceCounts();
  }

  async function handleTestFingerprint(profile) {
    testingProfile = profile;
    testResults = null;
    testLoading = true;
    showTestModal = true;

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

  function getPlatformIcon(platform) {
    if (platform?.includes('Win')) return '🪟';
    if (platform?.includes('Mac')) return '🍎';
    if (platform?.includes('Linux')) return '🐧';
    if (platform?.includes('iPhone') || platform?.includes('iPad')) return '📱';
    if (platform?.includes('arm') || platform?.includes('Android')) return '📱';
    return '💻';
  }

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

  // Toggle menus
  function toggleOpenMenu(profileId, event) {
    event.stopPropagation();
    openMenuProfileId = openMenuProfileId === profileId ? null : profileId;
    moreMenuProfileId = null;
  }

  function toggleMoreMenu(profileId, event) {
    event.stopPropagation();
    moreMenuProfileId = moreMenuProfileId === profileId ? null : profileId;
    openMenuProfileId = null;
  }

  function closeMenus() {
    openMenuProfileId = null;
    moreMenuProfileId = null;
  }

  // Launch profile
  async function handleLaunchProfile(profile, url, event) {
    if (event) event.stopPropagation();
    openMenuProfileId = null;
    launchingProfileId = profile.id;

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

  async function quickLaunch(profile, event) {
    await handleLaunchProfile(profile, 'https://browserleaks.com/canvas', event);
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

    <div class="list">
      {#if loading}
        <div class="empty">Loading...</div>
      {:else if profiles.length === 0}
        <div class="empty">
          <p>No profiles yet.</p>
          <p>Create a new profile or generate a random one.</p>
        </div>
      {:else}
        {#each profiles as profile}
          <div
            class="profile-card"
            class:selected={selectedProfile?.id === profile.id}
            on:click={() => selectProfile(profile)}
            on:dblclick={() => openEditor(profile)}
          >
            <div class="profile-icon">
              {getPlatformIcon(profile.platform)}
            </div>
            <div class="profile-info">
              <div class="profile-header">
                <h3>{profile.name || 'Unnamed Profile'}</h3>
                <span class="status-badge" class:active={profile.status === 'active'}>
                  {profile.status || 'active'}
                </span>
              </div>
              <div class="profile-id">ID: {profile.id?.substring(0, 8) || 'N/A'}</div>

              <!-- Browser & OS Info -->
              <div class="info-row">
                <span class="info-tag browser">
                  {#if profile.browserType === 'chrome'}🌐
                  {:else if profile.browserType === 'firefox'}🦊
                  {:else if profile.browserType === 'safari'}🧭
                  {:else if profile.browserType === 'edge'}📘
                  {:else}🌐
                  {/if}
                  {profile.browserType || 'chrome'} {profile.browserVersion || '120'}
                </span>
                <span class="info-tag os">{profile.platform || profile.os || 'Win32'}</span>
                <span class="info-tag resolution">{profile.viewportWidth || 1920}x{profile.viewportHeight || 1080}</span>
              </div>

              <!-- Hardware Info -->
              <div class="info-row">
                <span class="info-tag hardware">💻 {profile.cpuCores || 8} cores</span>
                <span class="info-tag hardware">🧠 {profile.deviceMemory || 8} GB</span>
                <span class="info-tag timezone">🕐 {profile.timezone || 'UTC'}</span>
              </div>

              <!-- WebGL -->
              <div class="webgl-info">
                <span class="webgl-label">GPU:</span>
                <span class="webgl-value">{profile.webglRenderer?.substring(0, 45) || 'Not set'}...</span>
              </div>

              <!-- Proxy -->
              {#if profile.proxyId && proxyMap[profile.proxyId]}
                <div class="proxy-info">
                  <span class="proxy-icon">🌐</span>
                  <span class="proxy-name">{proxyMap[profile.proxyId].name}</span>
                  <span class="proxy-host">{proxyMap[profile.proxyId].host}:{proxyMap[profile.proxyId].port}</span>
                  <span class="proxy-type">{(proxyMap[profile.proxyId].type || proxyMap[profile.proxyId].proxyType || 'http').toUpperCase()}</span>
                </div>
              {:else}
                <div class="no-proxy">
                  <span>⚠️ No Proxy</span>
                </div>
              {/if}

              <!-- Last IP & Usage -->
              <div class="usage-info">
                {#if profile.lastIP}
                  <span class="last-ip">📍 {profile.lastIP}</span>
                {/if}
                {#if profile.lastUsedAt}
                  <span class="last-used">🕒 {profile.lastUsedAt}</span>
                {:else}
                  <span class="never-used">Never used</span>
                {/if}
                {#if resourceCounts[profile.id] > 0}
                  <span class="resource-count">📦 {resourceCounts[profile.id]} resources</span>
                {/if}
              </div>
            </div>
            <div class="profile-actions">
              <!-- Open button with dropdown -->
              <div class="open-dropdown">
                <button
                  class="btn-open"
                  class:loading={launchingProfileId === profile.id}
                  on:click|stopPropagation={(e) => toggleOpenMenu(profile.id, e)}
                  disabled={launchingProfileId === profile.id}
                >
                  {#if launchingProfileId === profile.id}
                    ⏳
                  {:else}
                    ▶ Open
                  {/if}
                </button>
                {#if openMenuProfileId === profile.id}
                  <div class="open-menu" on:click|stopPropagation>
                    <div class="menu-section">
                      <div class="menu-header">Quick Launch</div>
                      <button class="menu-item" on:click={(e) => quickLaunch(profile, e)}>
                        🚀 Open Browser
                      </button>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-section">
                      <div class="menu-header">Fingerprint Tests</div>
                      {#each testSites as site}
                        <button class="menu-item" on:click={(e) => handleLaunchProfile(profile, site.url, e)}>
                          {site.icon} {site.name}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>

              <!-- More menu -->
              <div class="more-dropdown">
                <button
                  class="btn-more"
                  on:click|stopPropagation={(e) => toggleMoreMenu(profile.id, e)}
                >
                  ⋮
                </button>
                {#if moreMenuProfileId === profile.id}
                  <div class="more-menu" on:click|stopPropagation>
                    <button class="menu-item" on:click|stopPropagation={() => { moreMenuProfileId = null; openEditor(profile); }}>
                      ✏️ Edit Profile
                    </button>
                    <button class="menu-item" on:click|stopPropagation={() => { moreMenuProfileId = null; handleTestFingerprint(profile); }}>
                      🔬 Test Fingerprint
                    </button>
                    <button class="menu-item" on:click|stopPropagation={() => { moreMenuProfileId = null; openResourceModal(profile); }}>
                      📦 Manage Resources
                    </button>
                    <div class="menu-divider"></div>
                    <button class="menu-item danger" on:click|stopPropagation={() => { moreMenuProfileId = null; handleDeleteProfile(profile.id); }}>
                      🗑️ Delete Profile
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<!-- Resource Modal -->
<ResourceModal
  profileId={resourceModalProfile?.id}
  profileName={resourceModalProfile?.name}
  bind:show={showResourceModal}
  on:close={closeResourceModal}
  on:saved={loadResourceCounts}
/>

<!-- Test Fingerprint Modal -->
{#if showTestModal}
  <div class="modal-overlay" on:click={closeTestModal}>
    <div class="test-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🔬 Fingerprint Test - {testingProfile?.name}</h2>
        <button class="close-btn" on:click={closeTestModal}>&times;</button>
      </div>
      <div class="modal-body">
        {#if testLoading}
          <div class="loading">
            <div class="spinner"></div>
            <p>Running fingerprint tests...</p>
          </div>
        {:else if testResults?.success}
          <div class="test-summary">
            <div class="summary-item pass">
              <span class="count">{testResults.summary.passed}</span>
              <span class="label">Passed</span>
            </div>
            <div class="summary-item warn">
              <span class="count">{testResults.summary.warned}</span>
              <span class="label">Warning</span>
            </div>
            <div class="summary-item fail">
              <span class="count">{testResults.summary.failed}</span>
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
              {#each testResults.tests as test}
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
            <p>Failed to run tests: {testResults?.error || 'Unknown error'}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

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

  .empty {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .profile-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .profile-card:hover {
    border-color: #e94560;
  }

  .profile-card.selected {
    border-color: #e94560;
    background: #1a2a4e;
  }

  .profile-icon {
    font-size: 2rem;
  }

  .profile-info {
    flex: 1;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .profile-info h3 {
    margin: 0;
    font-size: 1rem;
    color: #fff;
  }

  .status-badge {
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    text-transform: uppercase;
  }

  .status-badge.active {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .profile-id {
    font-size: 0.7rem;
    color: #e94560;
    font-family: monospace;
    margin-bottom: 0.4rem;
  }

  .info-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.35rem;
  }

  .info-tag {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: #0f3460;
    color: #ccc;
  }

  .info-tag.browser {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .info-tag.os {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .info-tag.resolution {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .info-tag.hardware {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .info-tag.timezone {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
  }

  .webgl-info {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    margin-bottom: 0.35rem;
    padding: 0.25rem 0.5rem;
    background: rgba(75, 85, 99, 0.3);
    border-radius: 4px;
  }

  .webgl-label {
    color: #888;
    font-weight: 500;
  }

  .webgl-value {
    color: #9ca3af;
    font-family: monospace;
    font-size: 0.65rem;
  }

  .proxy-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    margin-bottom: 0.35rem;
    padding: 0.3rem 0.5rem;
    background: rgba(59, 130, 246, 0.15);
    border-radius: 4px;
  }

  .proxy-icon {
    font-size: 0.8rem;
  }

  .proxy-name {
    color: #3b82f6;
    font-weight: 500;
  }

  .proxy-host {
    color: #60a5fa;
    font-family: monospace;
    font-size: 0.7rem;
  }

  .proxy-type {
    color: #888;
    font-size: 0.6rem;
    padding: 0.1rem 0.3rem;
    background: #0f3460;
    border-radius: 3px;
    margin-left: auto;
  }

  .no-proxy {
    font-size: 0.75rem;
    color: #f59e0b;
    margin-bottom: 0.35rem;
  }

  .usage-info {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.7rem;
    color: #888;
  }

  .last-ip {
    color: #f59e0b;
    font-family: monospace;
  }

  .last-used {
    color: #888;
  }

  .never-used {
    color: #666;
    font-style: italic;
  }

  .resource-count {
    color: #10b981;
  }

  .profile-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .open-dropdown, .more-dropdown {
    position: relative;
  }

  .btn-open {
    background: #22c55e;
    border: none;
    color: #fff;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-open:hover {
    background: #16a34a;
  }

  .btn-open.loading {
    background: #666;
    cursor: wait;
  }

  .btn-more {
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #888;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-more:hover {
    border-color: #e94560;
    color: #fff;
  }

  .open-menu, .more-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 8px;
    min-width: 200px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    margin-top: 4px;
  }

  .more-menu {
    min-width: 150px;
    padding: 0.5rem 0;
  }

  .menu-section {
    padding: 0.5rem 0;
  }

  .menu-header {
    padding: 0.5rem 1rem;
    font-size: 0.7rem;
    color: #888;
    text-transform: uppercase;
  }

  .menu-divider {
    height: 1px;
    background: #0f3460;
    margin: 0.25rem 0;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 0.6rem 1rem;
    text-align: left;
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .menu-item:hover {
    background: #0f3460;
    color: #fff;
  }

  .menu-item.danger {
    color: #f87171;
  }

  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.2);
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

  /* Test Modal */
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
