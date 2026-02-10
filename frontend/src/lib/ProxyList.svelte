<script>
  import { onMount } from 'svelte';
  import { getProxies, createNewProxy, deleteProxy, updateProxy } from './api.js';
  import { showConfirm, showPrompt } from './stores/dialog.js';

  let proxies = [];
  let loading = true;
  let showAddModal = false;
  let newProxy = {
    name: '',
    type: 'http',
    host: '',
    port: 8080,
    username: '',
    password: ''
  };

  onMount(async () => {
    await loadProxies();
  });

  async function loadProxies() {
    loading = true;
    try {
      proxies = await getProxies();
    } catch (error) {
      console.error('Failed to load proxies:', error);
    }
    loading = false;
  }

  async function handleAddProxy() {
    try {
      await createNewProxy({
        name: newProxy.name || `Proxy ${proxies.length + 1}`,
        type: newProxy.type,
        host: newProxy.host,
        port: parseInt(newProxy.port) || 8080,
        username: newProxy.username,
        password: newProxy.password
      });
      showAddModal = false;
      resetNewProxy();
      await loadProxies();
    } catch (error) {
      console.error('Failed to create proxy:', error);
    }
  }

  async function handleDeleteProxy(id) {
    const confirmed = await showConfirm('Delete this proxy?', {
      title: 'Delete Proxy',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;
    try {
      await deleteProxy(id);
      await loadProxies();
    } catch (error) {
      console.error('Failed to delete proxy:', error);
    }
  }

  function resetNewProxy() {
    newProxy = {
      name: '',
      type: 'http',
      host: '',
      port: 8080,
      username: '',
      password: ''
    };
  }

  async function parseProxyString() {
    const input = await showPrompt('Paste proxy string:', {
      title: 'Parse Proxy',
      placeholder: 'host:port or host:port:user:pass'
    });
    if (!input) return;

    const parts = input.trim().split(':');
    if (parts.length >= 2) {
      newProxy.host = parts[0];
      newProxy.port = parseInt(parts[1]) || 8080;
      if (parts.length >= 4) {
        newProxy.username = parts[2];
        newProxy.password = parts[3];
      }
    }
  }
</script>

<div class="proxy-list">
  <div class="toolbar">
    <div class="toolbar-left">
      <button class="btn btn-primary" on:click={() => showAddModal = true}>
        + Add Proxy
      </button>
    </div>
    <div class="toolbar-right">
      <span class="count">{proxies.length} proxies</span>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading proxies...</div>
  {:else if proxies.length === 0}
    <div class="empty">
      <p>No proxies configured</p>
      <button class="btn btn-primary" on:click={() => showAddModal = true}>Add your first proxy</button>
    </div>
  {:else}
    <div class="table-container">
      <table class="proxy-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Host:Port</th>
            <th>Auth</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each proxies as proxy (proxy.id)}
            <tr>
              <td>
                <div class="proxy-name">{proxy.name}</div>
                <div class="proxy-id">{proxy.id.slice(0, 8)}...</div>
              </td>
              <td>
                <span class="type-badge {proxy.proxyType}">{proxy.proxyType}</span>
              </td>
              <td class="monospace">{proxy.host}:{proxy.port}</td>
              <td>
                {#if proxy.username}
                  <span class="auth-badge">Auth</span>
                {:else}
                  <span class="no-auth">No auth</span>
                {/if}
              </td>
              <td>
                <span class="status-badge {proxy.status}">{proxy.status}</span>
              </td>
              <td class="actions">
                <button class="btn btn-sm btn-danger" on:click={() => handleDeleteProxy(proxy.id)}>
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Add Proxy Modal -->
{#if showAddModal}
  <div class="modal-overlay" on:click={() => showAddModal = false}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Add Proxy</h3>
        <button class="close-btn" on:click={() => showAddModal = false}>&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" bind:value={newProxy.name} placeholder="My Proxy" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select bind:value={newProxy.type}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
          <div class="form-group">
            <label>Port</label>
            <input type="number" bind:value={newProxy.port} placeholder="8080" />
          </div>
        </div>

        <div class="form-group">
          <label>Host</label>
          <input type="text" bind:value={newProxy.host} placeholder="proxy.example.com" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Username</label>
            <input type="text" bind:value={newProxy.username} placeholder="Optional" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" bind:value={newProxy.password} placeholder="Optional" />
          </div>
        </div>

        <button class="btn btn-secondary" on:click={parseProxyString}>
          Parse from string
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn" on:click={() => showAddModal = false}>Cancel</button>
        <button class="btn btn-primary" on:click={handleAddProxy}>Add Proxy</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .proxy-list {
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

  .toolbar-left {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .toolbar-right {
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

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover, #2563eb);
  }

  .btn-secondary {
    background: var(--bg-tertiary, #2a2a4a);
  }

  .btn-sm {
    padding: 4px 10px;
    font-size: 12px;
  }

  .btn-danger {
    background: var(--danger-color, #ef4444);
    color: white;
  }

  .table-container {
    flex: 1;
    overflow: auto;
  }

  .proxy-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .proxy-table th,
  .proxy-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #2a2a4a);
  }

  .proxy-table th {
    background: var(--bg-secondary, #16213e);
    font-weight: 600;
    color: var(--text-secondary, #888);
    position: sticky;
    top: 0;
  }

  .proxy-table tr:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .proxy-name {
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .proxy-id {
    font-size: 11px;
    color: var(--text-secondary, #888);
    font-family: monospace;
  }

  .monospace {
    font-family: monospace;
  }

  .type-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    background: var(--bg-tertiary, #2a2a4a);
  }

  .type-badge.socks5 {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }

  .auth-badge {
    padding: 2px 8px;
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-radius: 4px;
    font-size: 11px;
  }

  .no-auth {
    color: var(--text-secondary, #888);
    font-size: 12px;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: capitalize;
  }

  .status-badge.active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .actions {
    display: flex;
    gap: 6px;
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

  .empty p {
    margin-bottom: 16px;
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
    z-index: 100;
  }

  .modal {
    background: var(--bg-secondary, #16213e);
    border-radius: 12px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #2a2a4a);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--text-primary, #fff);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #2a2a4a);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    color: var(--text-secondary, #888);
    font-weight: 500;
  }

  .form-group input,
  .form-group select {
    padding: 10px 12px;
    background: var(--bg-primary, #1a1a2e);
    border: 1px solid var(--border-color, #2a2a4a);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
</style>
