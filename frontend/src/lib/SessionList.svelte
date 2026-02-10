<script>
  import { onMount, onDestroy } from 'svelte';
  import { getSessions, closeSession, navigateSession, shutdownBrowser } from './api.js';
  import { showConfirm, showPrompt } from './stores/dialog.js';

  let sessions = [];
  let loading = true;
  let pollInterval;

  onMount(() => {
    loadSessions();
    // Poll for session updates every 2 seconds
    pollInterval = setInterval(loadSessions, 2000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  async function loadSessions() {
    try {
      const result = await getSessions();
      if (result.success) {
        sessions = result.sessions || [];
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
    loading = false;
  }

  async function handleCloseSession(sessionId) {
    try {
      await closeSession(sessionId);
      await loadSessions();
    } catch (error) {
      console.error('Failed to close session:', error);
    }
  }

  async function handleNavigate(sessionId) {
    const url = await showPrompt('Enter the URL to navigate to:', {
      title: 'Navigate',
      defaultValue: 'https://',
      placeholder: 'https://example.com'
    });
    if (url) {
      try {
        await navigateSession(sessionId, url);
      } catch (error) {
        console.error('Failed to navigate:', error);
      }
    }
  }

  async function handleShutdownAll() {
    const confirmed = await showConfirm('Close all sessions and shutdown browser?', {
      title: 'Shutdown All',
      variant: 'warning',
      confirmText: 'Shutdown'
    });
    if (!confirmed) return;
    try {
      await shutdownBrowser();
      sessions = [];
    } catch (error) {
      console.error('Failed to shutdown:', error);
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  }

  function getRunningTime(startedAt) {
    if (!startedAt) return '';
    const start = new Date(startedAt);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  }
</script>

<div class="session-list">
  <div class="toolbar">
    <div class="toolbar-left">
      <h3>Active Sessions</h3>
    </div>
    <div class="toolbar-right">
      <span class="count">{sessions.length} running</span>
      {#if sessions.length > 0}
        <button class="btn btn-danger btn-sm" on:click={handleShutdownAll}>
          Close All
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading sessions...</div>
  {:else if sessions.length === 0}
    <div class="empty">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="14" rx="2"/>
          <path d="M8 21h8"/>
          <path d="M12 18v3"/>
        </svg>
      </div>
      <p>No active sessions</p>
      <p class="hint">Launch a profile to start a browser session</p>
    </div>
  {:else}
    <div class="sessions-grid">
      {#each sessions as session (session.id)}
        <div class="session-card">
          <div class="session-header">
            <div class="session-profile">
              <span class="profile-name">{session.profileName || 'Unknown'}</span>
              <span class="session-id">{session.id.slice(0, 8)}</span>
            </div>
            <div class="session-status {session.status}">
              <span class="status-dot"></span>
              {session.status}
            </div>
          </div>

          <div class="session-info">
            <div class="info-row">
              <span class="label">Started:</span>
              <span class="value">{formatTime(session.startedAt)}</span>
            </div>
            <div class="info-row">
              <span class="label">Running:</span>
              <span class="value">{getRunningTime(session.startedAt)}</span>
            </div>
          </div>

          <div class="session-actions">
            <button class="btn btn-sm" on:click={() => handleNavigate(session.id)}>
              Navigate
            </button>
            <button class="btn btn-sm btn-danger" on:click={() => handleCloseSession(session.id)}>
              Close
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .session-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-secondary, #16213e);
    border-bottom: 1px solid var(--border-color, #2a2a4a);
  }

  .toolbar h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .toolbar-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .count {
    color: var(--text-secondary, #888);
    font-size: 13px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    background: var(--bg-tertiary, #2a2a4a);
    color: var(--text-primary, #fff);
  }

  .btn:hover {
    background: var(--bg-hover, #3a3a5a);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-danger {
    background: var(--danger-color, #ef4444);
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .sessions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    padding: 16px;
    overflow: auto;
  }

  .session-card {
    background: var(--bg-secondary, #16213e);
    border: 1px solid var(--border-color, #2a2a4a);
    border-radius: 8px;
    padding: 16px;
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .session-profile {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .profile-name {
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .session-id {
    font-size: 11px;
    color: var(--text-secondary, #888);
    font-family: monospace;
  }

  .session-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: capitalize;
  }

  .session-status.running {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .session-status.stopped {
    background: rgba(107, 114, 128, 0.2);
    color: #6b7280;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .session-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-primary, #1a1a2e);
    border-radius: 6px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .info-row .label {
    color: var(--text-secondary, #888);
  }

  .info-row .value {
    color: var(--text-primary, #fff);
    font-family: monospace;
  }

  .session-actions {
    display: flex;
    gap: 8px;
  }

  .session-actions .btn {
    flex: 1;
  }

  .loading,
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    color: var(--text-secondary, #888);
  }

  .empty-icon {
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty p {
    margin: 0;
  }

  .empty .hint {
    font-size: 12px;
    margin-top: 8px;
    opacity: 0.7;
  }
</style>
