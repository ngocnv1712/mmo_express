<script>
  import { fade, fly } from 'svelte/transition';
  import ProfileList from './lib/ProfileList.svelte';
  import SessionList from './lib/SessionList.svelte';
  import AutomationBuilder from './lib/automation/AutomationBuilder.svelte';
  import WarmupDashboard from './lib/warmup/WarmupDashboard.svelte';
  import Settings from './lib/Settings.svelte';
  import Dialog from './lib/Dialog.svelte';

  let currentTab = 'profiles';

  const tabs = [
    { id: 'profiles', label: 'Profiles', icon: 'user' },
    { id: 'sessions', label: 'Sessions', icon: 'play' },
    { id: 'workflows', label: 'Workflows', icon: 'flow' },
    { id: 'warmup', label: 'Warm-up', icon: 'fire' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
</script>

<div class="app">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="logo">
      <span class="logo-icon">M</span>
      <span class="logo-text">MMO Express</span>
    </div>

    <nav class="nav">
      {#each tabs as tab}
        <button
          class="nav-item"
          class:active={currentTab === tab.id}
          on:click={() => currentTab = tab.id}
        >
          <span class="nav-icon">
            {#if tab.icon === 'user'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            {:else if tab.icon === 'play'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="14" rx="2"/>
                <path d="M8 21h8"/>
                <path d="M12 18v3"/>
              </svg>
            {:else if tab.icon === 'globe'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            {:else if tab.icon === 'puzzle'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>
              </svg>
            {:else if tab.icon === 'flow'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="6" height="6" rx="1"/>
                <rect x="15" y="3" width="6" height="6" rx="1"/>
                <rect x="9" y="15" width="6" height="6" rx="1"/>
                <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"/>
                <path d="M12 12v3"/>
              </svg>
            {:else if tab.icon === 'fire'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2c.5 2.5 2 4.5 3 6 1 1.5 1.5 3 1.5 4.5a6.5 6.5 0 1 1-13 0c0-1.5.5-3 1.5-4.5 1-1.5 2.5-3.5 3-6a4 4 0 0 1 4 0z"/>
                <path d="M12 14a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0-5z"/>
              </svg>
            {:else if tab.icon === 'settings'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            {/if}
          </span>
          <span class="nav-label">{tab.label}</span>
        </button>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <div class="version">v1.0.0</div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="main">
    {#key currentTab}
      <div class="page-content" in:fade={{ duration: 150 }}>
        {#if currentTab === 'profiles'}
          <ProfileList />
        {:else if currentTab === 'sessions'}
          <SessionList />
        {:else if currentTab === 'proxies'}
          <ProxyList />
        {:else if currentTab === 'extensions'}
          <ExtensionList />
        {:else if currentTab === 'workflows'}
          <AutomationBuilder />
        {:else if currentTab === 'warmup'}
          <WarmupDashboard />
        {:else if currentTab === 'settings'}
          <Settings />
        {/if}
      </div>
    {/key}
  </main>
</div>

<!-- Global Dialog Component -->
<Dialog />

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(html, body, #app) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #0f0f1a;
    color: #fff;
    overflow: hidden;
  }

  :global(:root) {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #2a2a4a;
    --bg-hover: #3a3a5a;
    --border-color: #2a2a4a;
    --text-primary: #ffffff;
    --text-secondary: #888899;
    --accent-color: #3b82f6;
    --accent-hover: #2563eb;
    --success-color: #10b981;
    --danger-color: #ef4444;
    --warning-color: #f59e0b;
  }

  :global(select) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
  }

  :global(select option) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  :global(input) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
  }

  :global(input::placeholder) {
    color: var(--text-secondary);
  }

  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .sidebar {
    width: 220px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--accent-color), #8b5cf6);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
  }

  .logo-text {
    font-weight: 600;
    font-size: 16px;
  }

  .nav {
    flex: 1;
    padding: 16px 8px;
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
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 14px;
    text-align: left;
    transition: all 0.2s;
    width: 100%;
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .nav-label {
    font-weight: 500;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid var(--border-color);
  }

  .version {
    font-size: 11px;
    color: var(--text-secondary);
    text-align: center;
  }

  .main {
    flex: 1;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .page-content {
    height: 100%;
    width: 100%;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
  }

  .placeholder h2 {
    margin-bottom: 8px;
    color: var(--text-primary);
  }
</style>
