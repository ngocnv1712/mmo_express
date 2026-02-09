<script>
  import { onMount } from 'svelte';

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

  function resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;
    localStorage.removeItem('mmo-express-settings');
    location.reload();
  }
</script>

<div class="settings-page">
  <div class="settings-header">
    <h1>Settings</h1>
    {#if saved}
      <span class="saved-badge">Saved!</span>
    {/if}
  </div>

  <div class="settings-content">
    <div class="settings-section">
      <h2>Appearance</h2>

      <div class="setting-item">
        <div class="setting-info">
          <label for="theme">Theme</label>
          <p>Choose color scheme for the interface</p>
        </div>
        <select id="theme" bind:value={settings.theme}>
          {#each themes as theme}
            <option value={theme.value}>{theme.label}</option>
          {/each}
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="language">Language</label>
          <p>Interface language</p>
        </div>
        <select id="language" bind:value={settings.language}>
          {#each languages as lang}
            <option value={lang.value}>{lang.label}</option>
          {/each}
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="startupPage">Startup Page</label>
          <p>Default page when app starts</p>
        </div>
        <select id="startupPage" bind:value={settings.startupPage}>
          {#each startupPages as page}
            <option value={page.value}>{page.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h2>Browser</h2>

      <div class="setting-item">
        <div class="setting-info">
          <label for="defaultBrowser">Default Browser Engine</label>
          <p>Browser engine for new profiles</p>
        </div>
        <select id="defaultBrowser" bind:value={settings.defaultBrowser}>
          {#each browsers as browser}
            <option value={browser.value}>{browser.label}</option>
          {/each}
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="defaultUrl">Default URL</label>
          <p>URL to open when launching profiles</p>
        </div>
        <input type="text" id="defaultUrl" bind:value={settings.defaultUrl} placeholder="https://example.com" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="sidecarUrl">Sidecar URL</label>
          <p>URL for automation sidecar server</p>
        </div>
        <input type="text" id="sidecarUrl" bind:value={settings.sidecarUrl} placeholder="http://localhost:3456" />
      </div>
    </div>

    <div class="settings-section">
      <h2>Paths</h2>

      <div class="setting-item">
        <div class="setting-info">
          <label for="screenshotPath">Screenshots Path</label>
          <p>Where to save screenshots</p>
        </div>
        <input type="text" id="screenshotPath" bind:value={settings.screenshotPath} />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="cookiePath">Cookies Path</label>
          <p>Where to save exported cookies</p>
        </div>
        <input type="text" id="cookiePath" bind:value={settings.cookiePath} />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label for="workflowPath">Workflows Path</label>
          <p>Where to save workflow exports</p>
        </div>
        <input type="text" id="workflowPath" bind:value={settings.workflowPath} />
      </div>
    </div>

    <div class="settings-section">
      <h2>Behavior</h2>

      <div class="setting-item toggle">
        <div class="setting-info">
          <label for="autoSave">Auto Save</label>
          <p>Automatically save changes</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="autoSave" bind:checked={settings.autoSave} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-item toggle">
        <div class="setting-info">
          <label for="showTutorial">Show Tutorials</label>
          <p>Display helpful tips and tutorials</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="showTutorial" bind:checked={settings.showTutorial} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-item toggle">
        <div class="setting-info">
          <label for="enableTelemetry">Analytics</label>
          <p>Help improve MMO Express by sending anonymous usage data</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="enableTelemetry" bind:checked={settings.enableTelemetry} />
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h2>About</h2>

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
      </div>
    </div>
  </div>

  <div class="settings-footer">
    <button class="btn btn-danger" on:click={resetSettings}>Reset to Defaults</button>
    <button class="btn btn-primary" on:click={saveSettings}>Save Settings</button>
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color, #2a2a4a);
  }

  .settings-header h1 {
    margin: 0;
    font-size: 20px;
    color: var(--text-primary, #fff);
  }

  .saved-badge {
    padding: 4px 12px;
    background: var(--success-color, #10b981);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .settings-section {
    margin-bottom: 32px;
    max-width: 600px;
  }

  .settings-section h2 {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color, #2a2a4a);
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
    color: var(--text-primary, #fff);
    margin-bottom: 2px;
  }

  .setting-info p {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .setting-item select,
  .setting-item input[type="text"] {
    width: 200px;
    padding: 8px 12px;
    background: var(--bg-secondary, #16213e);
    border: 1px solid var(--border-color, #2a2a4a);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .setting-item select:focus,
  .setting-item input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

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
    background-color: var(--bg-tertiary, #2a2a4a);
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
    background-color: var(--accent-color, #3b82f6);
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  .about-info {
    background: var(--bg-secondary, #16213e);
    border-radius: 8px;
    padding: 16px;
  }

  .about-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, #2a2a4a);
  }

  .about-row:last-child {
    border-bottom: none;
  }

  .about-label {
    color: var(--text-secondary, #888);
    font-size: 13px;
  }

  .about-value {
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color, #2a2a4a);
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover, #2563eb);
  }

  .btn-danger {
    background: transparent;
    color: var(--danger-color, #ef4444);
    border: 1px solid var(--danger-color, #ef4444);
  }

  .btn-danger:hover {
    background: var(--danger-color, #ef4444);
    color: white;
  }
</style>
