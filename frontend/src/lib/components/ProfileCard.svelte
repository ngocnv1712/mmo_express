<script>
  import { createEventDispatcher } from 'svelte';

  export let profile;
  export let proxyInfo = null;
  export let resourceCount = 0;
  export let isSelected = false;
  export let isChecked = false;
  export let isLaunching = false;
  export let showOpenMenu = false;
  export let showMoreMenu = false;
  export let testSites = [];

  const dispatch = createEventDispatcher();

  function getPlatformIcon(platform) {
    if (platform?.includes('Win')) return '🪟';
    if (platform?.includes('Mac')) return '🍎';
    if (platform?.includes('Linux')) return '🐧';
    if (platform?.includes('iPhone') || platform?.includes('iPad')) return '📱';
    if (platform?.includes('arm') || platform?.includes('Android')) return '📱';
    return '💻';
  }

  function handleSelect() {
    dispatch('select', { id: profile.id });
  }

  function handleEdit() {
    dispatch('edit', { profile });
  }

  function handleCheckbox(event) {
    event.stopPropagation();
    dispatch('check', { id: profile.id });
  }

  function handleOpenMenu(event) {
    event.stopPropagation();
    dispatch('toggleOpenMenu', { id: profile.id });
  }

  function handleMoreMenu(event) {
    event.stopPropagation();
    dispatch('toggleMoreMenu', { id: profile.id });
  }

  function handleLaunch(url, event) {
    if (event) event.stopPropagation();
    dispatch('launch', { profile, url });
  }

  function handleQuickLaunch(event) {
    handleLaunch('https://browserleaks.com/canvas', event);
  }

  function handleTestFingerprint() {
    dispatch('testFingerprint', { profile });
  }

  function handleDelete() {
    dispatch('delete', { id: profile.id });
  }
</script>

<div
  class="profile-card"
  class:selected={isSelected}
  on:click={handleSelect}
  on:dblclick={handleEdit}
>
  <!-- Checkbox for bulk selection -->
  <div class="card-checkbox" on:click|stopPropagation>
    <label class="checkbox-wrapper">
      <input type="checkbox" checked={isChecked} on:change={handleCheckbox} />
      <span class="checkmark"></span>
    </label>
  </div>

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
    {#if proxyInfo}
      <div class="proxy-info">
        <span class="proxy-icon">🌐</span>
        <span class="proxy-name">{proxyInfo.name}</span>
        <span class="proxy-host">{proxyInfo.host}:{proxyInfo.port}</span>
        <span class="proxy-type">{(proxyInfo.type || proxyInfo.proxyType || 'http').toUpperCase()}</span>
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
      {#if resourceCount > 0}
        <span class="resource-count">📦 {resourceCount} resources</span>
      {/if}
    </div>

    <!-- Platform Tags -->
    {#if profile.platformTags && profile.platformTags.length > 0}
      <div class="profile-tags">
        {#each profile.platformTags as tag}
          <span class="profile-tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="profile-actions">
    <!-- Open button with dropdown -->
    <div class="open-dropdown">
      <button
        class="btn-open"
        class:loading={isLaunching}
        on:click|stopPropagation={handleOpenMenu}
        disabled={isLaunching}
      >
        {#if isLaunching}
          ⏳
        {:else}
          ▶ Open
        {/if}
      </button>
      {#if showOpenMenu}
        <div class="open-menu" on:click|stopPropagation>
          <div class="menu-section">
            <div class="menu-header">Quick Launch</div>
            <button class="menu-item" on:click={handleQuickLaunch}>
              🚀 Open Browser
            </button>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-section">
            <div class="menu-header">Fingerprint Tests</div>
            {#each testSites as site}
              <button class="menu-item" on:click={(e) => handleLaunch(site.url, e)}>
                {site.icon} {site.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- More menu -->
    <div class="more-dropdown">
      <button class="btn-more" on:click|stopPropagation={handleMoreMenu}>
        ⋮
      </button>
      {#if showMoreMenu}
        <div class="more-menu" on:click|stopPropagation>
          <button class="menu-item" on:click|stopPropagation={handleEdit}>
            ✏️ Edit Profile
          </button>
          <button class="menu-item" on:click|stopPropagation={handleTestFingerprint}>
            🔬 Test Fingerprint
          </button>
          <div class="menu-divider"></div>
          <button class="menu-item danger" on:click|stopPropagation={handleDelete}>
            🗑️ Delete Profile
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
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

  .card-checkbox {
    flex-shrink: 0;
  }

  .checkbox-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .checkbox-wrapper input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .checkmark {
    width: 18px;
    height: 18px;
    border: 2px solid #1a4a7a;
    border-radius: 3px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .checkbox-wrapper:hover .checkmark {
    border-color: #e94560;
  }

  .checkbox-wrapper input:checked ~ .checkmark {
    background: #e94560;
    border-color: #e94560;
  }

  .checkbox-wrapper input:checked ~ .checkmark::after {
    content: '✓';
    color: #fff;
    font-size: 0.75rem;
  }

  .profile-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-badge {
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    text-transform: uppercase;
    flex-shrink: 0;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .profile-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.35rem;
  }

  .profile-tag {
    padding: 0.15rem 0.5rem;
    background: #e94560;
    border-radius: 3px;
    font-size: 0.65rem;
    color: #fff;
    text-transform: uppercase;
  }

  .profile-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-shrink: 0;
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
</style>
