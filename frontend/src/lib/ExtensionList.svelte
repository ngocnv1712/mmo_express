<script>
  import { onMount } from 'svelte';
  import { listExtensions, importExtension, importExtensionCRX, removeExtension, downloadAndInstallExtension, toggleExtension } from './api.js';
  import { showAlert, showConfirm, showPrompt } from './stores/dialog.js';

  let extensions = [];
  let loading = true;
  let importing = false;
  let searchQuery = '';
  let activeTab = 'installed'; // 'installed' or 'store'

  // File inputs
  let crxFileInput;
  let folderInput;

  // Store
  let storeSearchQuery = '';
  let installingId = null;
  let selectedCategory = 'all';

  const storeCategories = ['all', 'ad-blocker', 'privacy', 'security', 'password', 'developer', 'automation', 'proxy', 'theme'];

  const popularExtensions = [
    { id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', name: 'uBlock Origin', description: 'An efficient blocker for ads and trackers', icon: '🛡️', category: 'ad-blocker', rating: 4.8, users: '10M+' },
    { id: 'gcbommkclmclpchllfjekcdonpmejbdp', name: 'HTTPS Everywhere', description: 'Automatically use HTTPS on websites', icon: '🔒', category: 'security', rating: 4.5, users: '3M+' },
    { id: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp', name: 'Privacy Badger', description: 'Automatically learns to block invisible trackers', icon: '🦡', category: 'privacy', rating: 4.6, users: '1M+' },
    { id: 'nngceckbapebfimnlniiiahkandclblb', name: 'Bitwarden', description: 'Free password manager for all devices', icon: '🔐', category: 'password', rating: 4.7, users: '3M+' },
    { id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader', description: 'Dark mode for every website', icon: '🌙', category: 'theme', rating: 4.7, users: '5M+' },
    { id: 'bgnkhhnnamicmpeenaelnjfhikgbkllg', name: 'AdGuard AdBlocker', description: 'Block ads on all websites', icon: '🚫', category: 'ad-blocker', rating: 4.7, users: '7M+' },
    { id: 'gighmmpiobklfepjocnamgkkbiglidom', name: 'AdBlock', description: 'The most popular ad blocker', icon: '🔴', category: 'ad-blocker', rating: 4.5, users: '10M+' },
    { id: 'fmkadmapgofadopljbjfkapdkoienihi', name: 'React Developer Tools', description: 'React debugging tools', icon: '⚛️', category: 'developer', rating: 4.4, users: '3M+' },
    { id: 'lmhkpmbekcpmknklioeibfkpmmfibljd', name: 'Redux DevTools', description: 'Redux debugging tools', icon: '🔧', category: 'developer', rating: 4.5, users: '1M+' },
    { id: 'nhdogjmejiglipccpnnnanhbledajbpd', name: 'Vue.js devtools', description: 'Vue.js debugging tools', icon: '💚', category: 'developer', rating: 4.6, users: '1M+' },
    { id: 'hgimnogjllphhhkhlmebbmlgjoejdpjl', name: 'EditThisCookie', description: 'Cookie manager', icon: '🍪', category: 'developer', rating: 4.3, users: '500K+' },
    { id: 'padekgcemlokbadohgkifijomclgjgif', name: 'Proxy SwitchyOmega', description: 'Manage and switch between proxies', icon: '🔀', category: 'proxy', rating: 4.5, users: '2M+' },
    { id: 'cfidkbgamfhdgmedldkagjopnbobdmdn', name: 'Selenium IDE', description: 'Web testing and recording', icon: '🤖', category: 'automation', rating: 4.0, users: '400K+' },
    { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'LastPass', description: 'Password manager and secure vault', icon: '🔑', category: 'password', rating: 4.4, users: '10M+' },
  ];

  onMount(async () => {
    await loadExtensions();
  });

  async function loadExtensions() {
    loading = true;
    try {
      const result = await listExtensions();
      extensions = result?.extensions || [];
    } catch (e) {
      console.error('Failed to load extensions:', e);
      extensions = [];
    }
    loading = false;
  }

  // Handle CRX file selection
  async function handleCRXFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // For browser mode, we need to read the file and send it
    // But since sidecar expects a file path, we'll prompt for path
    const path = await showPrompt('Enter the full path to the CRX file:', {
      title: 'Import CRX',
      defaultValue: file.name,
      placeholder: '/path/to/extension.crx'
    });
    if (!path) return;

    importing = true;
    try {
      await importExtensionCRX(path.trim());
      await loadExtensions();
    } catch (e) {
      showAlert('Import failed: ' + (e.message || e), { title: 'Import Error', variant: 'danger' });
    }
    importing = false;
    event.target.value = '';
  }

  // Handle folder selection (for unpacked extension)
  async function handleFolderSelect() {
    const path = await showPrompt('Enter the full path to extension folder:', {
      title: 'Import Extension Folder',
      placeholder: '/path/to/extension (containing manifest.json)'
    });
    if (!path) return;

    importing = true;
    try {
      await importExtension(path.trim());
      await loadExtensions();
    } catch (e) {
      showAlert('Import failed: ' + (e.message || e), { title: 'Import Error', variant: 'danger' });
    }
    importing = false;
  }

  async function handleDelete(ext) {
    const confirmed = await showConfirm(`Delete extension "${ext.name || ext.id}"?`, {
      title: 'Delete Extension',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      await removeExtension(ext.id);
      await loadExtensions();
    } catch (e) {
      showAlert('Delete failed: ' + (e.message || e), { title: 'Delete Error', variant: 'danger' });
    }
  }

  function openChromeStore(extensionId) {
    const url = `https://chrome.google.com/webstore/detail/${extensionId}`;
    window.open(url, '_blank');
  }

  async function installFromStore(ext) {
    installingId = ext.id;
    try {
      const result = await downloadAndInstallExtension(ext.id);
      if (result?.success) {
        await loadExtensions();
      } else {
        throw new Error(result?.error || 'Install failed');
      }
    } catch (e) {
      console.error('Failed to install:', e);
      showAlert(`Failed to install ${ext.name}: ${e.message || e}\n\nTry downloading manually from Chrome Web Store.`, {
        title: 'Install Failed',
        variant: 'danger'
      });
    }
    installingId = null;
  }

  function isInstalled(storeExt) {
    return extensions.some(ext =>
      ext.storeId === storeExt.id ||
      ext.id === storeExt.id ||
      (ext.name && storeExt.name && ext.name.toLowerCase() === storeExt.name.toLowerCase())
    );
  }

  async function handleToggle(ext) {
    try {
      const result = await toggleExtension(ext.id);
      if (result?.success) {
        await loadExtensions();
      } else {
        throw new Error(result?.error || 'Toggle failed');
      }
    } catch (e) {
      showAlert('Toggle failed: ' + (e.message || e), { title: 'Error', variant: 'danger' });
    }
  }

  function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0));
    return stars;
  }

  // Filter installed extensions
  $: filteredExtensions = extensions.filter(ext =>
    !searchQuery ||
    (ext.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ext.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter store extensions
  $: filteredStoreExtensions = popularExtensions.filter(ext => {
    const matchesSearch = !storeSearchQuery ||
      ext.name.toLowerCase().includes(storeSearchQuery.toLowerCase()) ||
      ext.description.toLowerCase().includes(storeSearchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ext.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
</script>

<!-- Hidden file inputs -->
<input
  type="file"
  accept=".crx"
  bind:this={crxFileInput}
  on:change={handleCRXFile}
  style="display: none;"
/>

<div class="extension-list">
  <div class="header">
    <div class="title-section">
      <h1>Extensions</h1>
      <span class="browser-note">Chromium only</span>
    </div>
    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === 'installed'}
        on:click={() => activeTab = 'installed'}
      >
        Installed ({extensions.length})
      </button>
      <button
        class="tab"
        class:active={activeTab === 'store'}
        on:click={() => activeTab = 'store'}
      >
        Store
      </button>
    </div>
  </div>

  {#if activeTab === 'installed'}
    <!-- Installed Extensions Tab -->
    <div class="toolbar">
      <div class="search-box">
        <input
          type="text"
          placeholder="Search installed extensions..."
          bind:value={searchQuery}
        />
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-secondary" on:click={handleFolderSelect} disabled={importing}>
          + Import Folder
        </button>
        <button class="btn btn-primary" on:click={() => crxFileInput.click()} disabled={importing}>
          {importing ? 'Importing...' : '+ Import CRX'}
        </button>
      </div>
    </div>

    {#if loading}
      <div class="loading">Loading extensions...</div>
    {:else if filteredExtensions.length === 0}
      <div class="empty">
        <div class="empty-icon">🧩</div>
        {#if searchQuery}
          <p>No extensions found matching "{searchQuery}"</p>
        {:else}
          <h3>No extensions installed</h3>
          <p>Import a .crx file or unpacked extension folder</p>
          <p class="hint">Or go to Store tab to install popular extensions</p>
        {/if}
      </div>
    {:else}
      <div class="extensions">
        {#each filteredExtensions as ext}
          <div class="extension-card" class:disabled={!ext.enabled}>
            <div class="ext-icon">
              <span>EXT</span>
            </div>
            <div class="ext-info">
              <div class="ext-name">
                {ext.name || ext.id}
                {#if !ext.enabled}
                  <span class="disabled-badge">Disabled</span>
                {/if}
              </div>
              <div class="ext-meta">
                {#if ext.version}
                  <span class="version">v{ext.version}</span>
                {/if}
                {#if ext.storeId}
                  <span class="source">Chrome Store</span>
                {/if}
              </div>
              {#if ext.path}
                <div class="ext-path">{ext.path}</div>
              {/if}
            </div>
            <div class="ext-actions">
              <label class="switch" title={ext.enabled ? 'Disable' : 'Enable'}>
                <input
                  type="checkbox"
                  checked={ext.enabled}
                  on:change={() => handleToggle(ext)}
                />
                <span class="slider"></span>
              </label>
              <button class="btn-icon danger" on:click={() => handleDelete(ext)} title="Delete">
                ✕
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  {:else}
    <!-- Extension Store Tab -->
    <div class="toolbar">
      <div class="search-box">
        <input
          type="text"
          placeholder="Search extensions..."
          bind:value={storeSearchQuery}
        />
      </div>
    </div>

    <div class="categories">
      {#each storeCategories as category}
        <button
          class="category-btn"
          class:active={selectedCategory === category}
          on:click={() => selectedCategory = category}
        >
          {category === 'all' ? 'All' : category.replace('-', ' ')}
        </button>
      {/each}
    </div>

    <div class="store-grid">
      {#each filteredStoreExtensions as ext}
        <div class="store-card" class:installed={isInstalled(ext)}>
          <div class="store-icon">{ext.icon}</div>
          <div class="store-info">
            <div class="store-name">{ext.name}</div>
            <div class="store-rating">
              <span class="stars">{renderStars(ext.rating)}</span>
              <span class="rating-value">{ext.rating}</span>
              <span class="users">{ext.users}</span>
            </div>
            <div class="store-desc">{ext.description}</div>
          </div>
          <div class="store-actions">
            {#if isInstalled(ext)}
              <span class="installed-badge">Installed</span>
            {:else}
              <button
                class="btn-add"
                on:click={() => installFromStore(ext)}
                disabled={installingId === ext.id}
                title="Download and install"
              >
                {installingId === ext.id ? '...' : 'Add'}
              </button>
              <button
                class="btn-view"
                on:click={() => openChromeStore(ext.id)}
                title="View in Chrome Web Store"
              >
                View
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <div class="store-footer">
      <p>Click "Add" to download and install directly, or "View" to see in Chrome Web Store.</p>
      <a href="https://chrome.google.com/webstore/category/extensions" target="_blank" rel="noopener">
        Browse all extensions on Chrome Web Store →
      </a>
    </div>
  {/if}
</div>

<style>
  .extension-list {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-shrink: 0;
  }

  .title-section {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .title-section h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }

  .browser-note {
    font-size: 12px;
    color: var(--warning-color);
    background: rgba(245, 158, 11, 0.15);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .tabs {
    display: flex;
    gap: 8px;
  }

  .tab {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .tab:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .tab.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: center;
    flex-shrink: 0;
  }

  .search-box {
    flex: 1;
  }

  .search-box input {
    width: 100%;
    padding: 10px 14px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading, .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty h3 {
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .empty .hint {
    font-size: 13px;
    margin-top: 8px;
    color: var(--accent-color);
  }

  .extensions {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .extension-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    transition: all 0.2s;
  }

  .extension-card:hover {
    border-color: var(--accent-color);
  }

  .extension-card.disabled {
    opacity: 0.6;
  }

  .extension-card.disabled .ext-icon {
    background: var(--bg-tertiary);
    opacity: 0.5;
  }

  .ext-icon {
    width: 48px;
    height: 48px;
    background: var(--bg-tertiary);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .ext-info {
    flex: 1;
    min-width: 0;
  }

  .ext-name {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 4px;
  }

  .ext-meta {
    display: flex;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .version {
    color: var(--success-color);
  }

  .source {
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .ext-path {
    font-size: 11px;
    color: var(--text-secondary);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ext-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--bg-tertiary);
  }

  .btn-icon.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: var(--danger-color);
  }

  /* Switch toggle */
  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    transition: 0.2s;
    border-radius: 22px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: var(--text-secondary);
    transition: 0.2s;
    border-radius: 50%;
  }

  .switch input:checked + .slider {
    background-color: var(--success-color);
    border-color: var(--success-color);
  }

  .switch input:checked + .slider:before {
    transform: translateX(18px);
    background-color: white;
  }

  .switch:hover .slider {
    border-color: var(--accent-color);
  }

  .disabled-badge {
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    font-weight: normal;
  }

  /* Categories */
  .categories {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .category-btn {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    text-transform: capitalize;
    transition: all 0.2s;
  }

  .category-btn:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .category-btn.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  /* Store Grid */
  .store-grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
    padding-bottom: 16px;
  }

  .store-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    gap: 12px;
    transition: all 0.2s;
  }

  .store-card:hover {
    border-color: var(--accent-color);
  }

  .store-card.installed {
    opacity: 0.6;
  }

  .store-icon {
    font-size: 28px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .store-info {
    flex: 1;
    min-width: 0;
  }

  .store-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .store-rating {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .stars {
    color: #fbbf24;
    letter-spacing: -1px;
  }

  .rating-value {
    color: var(--text-secondary);
  }

  .users {
    color: var(--text-secondary);
    font-size: 11px;
  }

  .store-desc {
    font-size: 13px;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .store-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .btn-add {
    padding: 8px 16px;
    background: var(--success-color);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add:hover:not(:disabled) {
    background: #059669;
  }

  .btn-add:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-view {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--accent-color);
    border-radius: 6px;
    color: var(--accent-color);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-view:hover {
    background: var(--accent-color);
    color: white;
  }

  .installed-badge {
    padding: 6px 12px;
    background: var(--success-color);
    border-radius: 6px;
    color: white;
    font-size: 12px;
    font-weight: 500;
  }

  .store-footer {
    padding: 16px;
    text-align: center;
    border-top: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 13px;
    flex-shrink: 0;
  }

  .store-footer p {
    margin-bottom: 8px;
  }

  .store-footer a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .store-footer a:hover {
    text-decoration: underline;
  }
</style>
