<script>
  import { onMount } from 'svelte';
  import { showConfirm } from './stores/dialog.js';
  import ProxyList from './ProxyList.svelte';
  import ExtensionList from './ExtensionList.svelte';

  // Active menu
  let activeMenu = 'general';

  // Menu items
  const menuItems = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'proxies', label: 'Proxies', icon: '🌐' },
    { id: 'extensions', label: 'Extensions', icon: '🧩' },
    { id: 'paths', label: 'Storage', icon: '💾' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ];

  let settings = {
    theme: 'dark',
    language: 'en',
    sidecarUrl: 'http://localhost:3456',
    defaultBrowser: 'chromium',
    autoSave: true,
    showTutorial: true,
    enableTelemetry: false,
    startupPage: 'profiles',
    defaultUrl: 'https://browserleaks.com/canvas',
    screenshotPath: '~/Documents/MMO Express/screenshots',
    cookiePath: '~/Documents/MMO Express/cookies',
    workflowPath: '~/Documents/MMO Express/workflows',
  };

  let saved = false;

  const themes = [
    { value: 'dark', label: 'Dark Theme' },
    { value: 'light', label: 'Light Theme' },
    { value: 'system', label: 'System Default' },
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'zh', label: '中文' },
  ];

  const browsers = [
    { value: 'chromium', label: 'Chromium' },
    { value: 'firefox', label: 'Firefox' },
    { value: 'webkit', label: 'WebKit (Safari)' },
  ];

  const startupPages = [
    { value: 'profiles', label: 'Profiles' },
    { value: 'sessions', label: 'Sessions' },
    { value: 'workflows', label: 'Workflows' },
  ];

  onMount(() => {
    loadSettings();
  });

  function loadSettings() {
    const savedSettings = localStorage.getItem('mmo-express-settings');
    if (savedSettings) {
      settings = { ...settings, ...JSON.parse(savedSettings) };
    }
  }

  function saveSettings() {
    localStorage.setItem('mmo-express-settings', JSON.stringify(settings));
    saved = true;
    setTimeout(() => saved = false, 2000);
  }

  async function resetSettings() {
    const confirmed = await showConfirm('Reset all settings to defaults?', {
      title: 'Reset Settings',
      variant: 'warning',
      confirmText: 'Reset'
    });
    if (!confirmed) return;
    localStorage.removeItem('mmo-express-settings');
    location.reload();
  }
</script>

<div class="settings-page">
  <!-- Sidebar -->
  <div class="settings-sidebar">
    <div class="sidebar-header">
      <h2>Settings</h2>
    </div>
    <nav class="sidebar-nav">
      {#each menuItems as item}
        <button
          class="nav-item"
          class:active={activeMenu === item.id}
          on:click={() => activeMenu = item.id}
        >
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </nav>
  </div>

  <!-- Content -->
  <div class="settings-content">
    {#if activeMenu === 'general'}
      <div class="content-section">
        <div class="section-header">
          <h1>General Settings</h1>
          {#if saved}
            <span class="saved-badge">Saved!</span>
          {/if}
        </div>

        <div class="settings-group">
          <h3>Appearance</h3>

          <div class="setting-item">
            <div class="setting-info">
              <label>Theme</label>
              <p>Choose color scheme for the interface</p>
            </div>
            <select bind:value={settings.theme} on:change={saveSettings}>
              {#each themes as theme}
                <option value={theme.value}>{theme.label}</option>
              {/each}
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>Language</label>
              <p>Interface language</p>
            </div>
            <select bind:value={settings.language} on:change={saveSettings}>
              {#each languages as lang}
                <option value={lang.value}>{lang.label}</option>
              {/each}
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>Startup Page</label>
              <p>Default page when app starts</p>
            </div>
            <select bind:value={settings.startupPage} on:change={saveSettings}>
              {#each startupPages as page}
                <option value={page.value}>{page.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="settings-group">
          <h3>Browser</h3>

          <div class="setting-item">
            <div class="setting-info">
              <label>Default Browser Engine</label>
              <p>Browser engine for new profiles</p>
            </div>
            <select bind:value={settings.defaultBrowser} on:change={saveSettings}>
              {#each browsers as browser}
                <option value={browser.value}>{browser.label}</option>
              {/each}
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>Default URL</label>
              <p>URL to open when launching profiles</p>
            </div>
            <input type="text" bind:value={settings.defaultUrl} on:blur={saveSettings} placeholder="https://example.com" />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>Sidecar URL</label>
              <p>URL for automation sidecar server</p>
            </div>
            <input type="text" bind:value={settings.sidecarUrl} on:blur={saveSettings} placeholder="http://localhost:3456" />
          </div>
        </div>

        <div class="settings-group">
          <h3>Behavior</h3>

          <div class="setting-item toggle">
            <div class="setting-info">
              <label>Auto Save</label>
              <p>Automatically save changes</p>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={settings.autoSave} on:change={saveSettings} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-item toggle">
            <div class="setting-info">
              <label>Show Tutorials</label>
              <p>Display helpful tips and tutorials</p>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={settings.showTutorial} on:change={saveSettings} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-item toggle">
            <div class="setting-info">
              <label>Analytics</label>
              <p>Help improve MMO Express by sending anonymous usage data</p>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={settings.enableTelemetry} on:change={saveSettings} />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-actions">
          <button class="btn btn-danger" on:click={resetSettings}>Reset to Defaults</button>
        </div>
      </div>

    {:else if activeMenu === 'proxies'}
      <div class="content-section full-height">
        <ProxyList />
      </div>

    {:else if activeMenu === 'extensions'}
      <div class="content-section full-height">
        <ExtensionList />
      </div>

    {:else if activeMenu === 'paths'}
      <div class="content-section">
        <div class="section-header">
          <h1>Storage Paths</h1>
          {#if saved}
            <span class="saved-badge">Saved!</span>
          {/if}
        </div>

        <div class="settings-group">
          <h3>File Locations</h3>

          <div class="setting-item">
            <div class="setting-info">
              <label>Screenshots Path</label>
              <p>Where to save screenshots</p>
            </div>
            <input type="text" bind:value={settings.screenshotPath} on:blur={saveSettings} />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>Cookies Path</label>
              <p>Where to save exported cookies</p>
            </div>
            <input type="text" bind:value={settings.cookiePath} on:blur={saveSettings} />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label>Workflows Path</label>
              <p>Where to save workflow exports</p>
            </div>
            <input type="text" bind:value={settings.workflowPath} on:blur={saveSettings} />
          </div>
        </div>
      </div>

    {:else if activeMenu === 'about'}
      <div class="content-section">
        <div class="section-header">
          <h1>About</h1>
        </div>

        <div class="settings-group">
          <div class="about-card">
            <div class="about-logo">MMO</div>
            <h2>MMO Express</h2>
            <p class="about-tagline">Anti-Detect Browser & Automation Tool</p>
          </div>

          <div class="about-info">
            <div class="about-row">
              <span class="about-label">Version</span>
              <span class="about-value">1.0.0</span>
            </div>
            <div class="about-row">
              <span class="about-label">Build</span>
              <span class="about-value">2024.02.09</span>
            </div>
            <div class="about-row">
              <span class="about-label">Framework</span>
              <span class="about-value">Tauri 2 + Svelte 5 + Playwright</span>
            </div>
            <div class="about-row">
              <span class="about-label">License</span>
              <span class="about-value">MIT</span>
            </div>
          </div>

          <div class="about-links">
            <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
            <a href="https://docs.example.com" target="_blank" rel="noopener">Documentation</a>
            <a href="https://discord.gg" target="_blank" rel="noopener">Discord</a>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    height: 100%;
    background: var(--bg-primary);
  }

  /* Sidebar */
  .settings-sidebar {
    width: 220px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .sidebar-nav {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .nav-item:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent-color);
    color: white;
  }

  .nav-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  /* Content */
  .settings-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-primary);
  }

  .content-section {
    padding: 24px;
    max-width: 800px;
  }

  .content-section.full-height {
    height: 100%;
    max-width: none;
    padding: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .section-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  .saved-badge {
    padding: 4px 12px;
    background: var(--success-color);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .settings-group {
    margin-bottom: 32px;
  }

  .settings-group h3 {
    margin: 0 0 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .setting-item.toggle {
    padding: 16px 0;
  }

  .setting-info {
    flex: 1;
  }

  .setting-info label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .setting-info p {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .setting-item select,
  .setting-item input[type="text"] {
    width: 220px;
    padding: 10px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
  }

  .setting-item select:focus,
  .setting-item input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  /* Switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
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
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--accent-color);
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* About */
  .about-card {
    text-align: center;
    padding: 32px;
    background: var(--bg-secondary);
    border-radius: 12px;
    margin-bottom: 24px;
  }

  .about-logo {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--accent-color), #8b5cf6);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: bold;
    color: white;
    margin: 0 auto 16px;
  }

  .about-card h2 {
    margin: 0 0 8px;
    font-size: 24px;
  }

  .about-tagline {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0;
  }

  .about-info {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .about-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .about-row:last-child {
    border-bottom: none;
  }

  .about-label {
    color: var(--text-secondary);
    font-size: 13px;
  }

  .about-value {
    color: var(--text-primary);
    font-size: 13px;
  }

  .about-links {
    display: flex;
    gap: 16px;
    justify-content: center;
  }

  .about-links a {
    color: var(--accent-color);
    text-decoration: none;
    font-size: 14px;
  }

  .about-links a:hover {
    text-decoration: underline;
  }

  /* Buttons */
  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-danger {
    background: transparent;
    color: var(--danger-color);
    border: 1px solid var(--danger-color);
  }

  .btn-danger:hover {
    background: var(--danger-color);
    color: white;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .btn-icon.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: var(--danger-color);
  }

  .settings-actions {
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
  }
</style>
