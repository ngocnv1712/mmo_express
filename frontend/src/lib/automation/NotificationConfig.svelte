<script>
  import { onMount } from 'svelte';

  export let onClose = () => {};
  export let sidecarUrl = 'http://localhost:3456';

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  let config = {
    enabled: false,
    channels: [],
    events: {
      onStart: false,
      onComplete: true,
      onSuccess: false,
      onFailure: true,
      onRetry: false
    }
  };

  let loading = true;
  let error = null;
  let saving = false;
  let testing = null;
  let testResult = null;

  // New channel form
  let showAddChannel = false;
  let newChannel = {
    type: 'telegram',
    botToken: '',
    chatId: '',
    webhookUrl: '',
    url: '',
    headers: ''
  };

  async function loadConfig() {
    loading = true;
    try {
      const result = await sendCommand('getNotificationConfig');
      if (result.success) {
        config = result.config;
      }
    } catch (err) {
      error = err.message;
    }
    loading = false;
  }

  async function saveConfig() {
    saving = true;
    error = null;
    try {
      const result = await sendCommand('updateNotificationConfig', { config });
      if (result.success) {
        config = result.config;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
    saving = false;
  }

  async function addChannel() {
    error = null;
    let channelData = { type: newChannel.type };

    if (newChannel.type === 'telegram') {
      if (!newChannel.botToken || !newChannel.chatId) {
        error = 'Bot Token and Chat ID are required';
        return;
      }
      channelData.botToken = newChannel.botToken;
      channelData.chatId = newChannel.chatId;
    } else if (newChannel.type === 'discord') {
      if (!newChannel.webhookUrl) {
        error = 'Webhook URL is required';
        return;
      }
      channelData.webhookUrl = newChannel.webhookUrl;
    } else if (newChannel.type === 'webhook') {
      if (!newChannel.url) {
        error = 'URL is required';
        return;
      }
      channelData.url = newChannel.url;
      try {
        channelData.headers = newChannel.headers ? JSON.parse(newChannel.headers) : {};
      } catch (e) {
        error = 'Invalid JSON for headers';
        return;
      }
    }

    try {
      const result = await sendCommand('addNotificationChannel', { channel: channelData });
      if (result.success) {
        config = result.config;
        showAddChannel = false;
        resetNewChannel();
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function removeChannel(channelId) {
    if (!confirm('Remove this notification channel?')) return;
    try {
      const result = await sendCommand('removeNotificationChannel', { channelId });
      if (result.success) {
        config = result.config;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function testChannel(channelId) {
    testing = channelId;
    testResult = null;
    try {
      const result = await sendCommand('testNotificationChannel', { channelId });
      testResult = result.success ? 'success' : result.error;
    } catch (err) {
      testResult = err.message;
    }
    setTimeout(() => {
      if (testing === channelId) {
        testing = null;
        testResult = null;
      }
    }, 3000);
  }

  async function sendTestNotification() {
    try {
      await sendCommand('sendTestNotification');
      alert('Test notification sent!');
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  function resetNewChannel() {
    newChannel = {
      type: 'telegram',
      botToken: '',
      chatId: '',
      webhookUrl: '',
      url: '',
      headers: ''
    };
  }

  function getChannelIcon(type) {
    switch (type) {
      case 'telegram': return '📱';
      case 'discord': return '💬';
      case 'webhook': return '🔗';
      default: return '📢';
    }
  }

  function getChannelLabel(channel) {
    switch (channel.type) {
      case 'telegram': return `Telegram (${channel.chatId})`;
      case 'discord': return 'Discord Webhook';
      case 'webhook': return channel.url;
      default: return channel.type;
    }
  }

  onMount(loadConfig);
</script>

<div class="notification-config">
  <div class="config-header">
    <h2>Notification Settings</h2>
    <button class="btn-close" on:click={onClose}>×</button>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <!-- Enable Toggle -->
    <div class="section">
      <label class="toggle-row">
        <input type="checkbox" bind:checked={config.enabled} on:change={saveConfig} />
        <span class="toggle-label">Enable Notifications</span>
      </label>
    </div>

    <!-- Events -->
    <div class="section">
      <h3>Notification Events</h3>
      <div class="events-grid">
        <label class="event-item">
          <input type="checkbox" bind:checked={config.events.onStart} on:change={saveConfig} />
          <span>On Start</span>
          <small>When workflow starts</small>
        </label>
        <label class="event-item">
          <input type="checkbox" bind:checked={config.events.onComplete} on:change={saveConfig} />
          <span>On Complete</span>
          <small>When workflow finishes</small>
        </label>
        <label class="event-item">
          <input type="checkbox" bind:checked={config.events.onSuccess} on:change={saveConfig} />
          <span>On Success</span>
          <small>Each profile success</small>
        </label>
        <label class="event-item">
          <input type="checkbox" bind:checked={config.events.onFailure} on:change={saveConfig} />
          <span>On Failure</span>
          <small>Each profile failure</small>
        </label>
        <label class="event-item">
          <input type="checkbox" bind:checked={config.events.onRetry} on:change={saveConfig} />
          <span>On Retry</span>
          <small>When retrying profile</small>
        </label>
      </div>
    </div>

    <!-- Channels -->
    <div class="section">
      <div class="section-header">
        <h3>Notification Channels</h3>
        <button class="btn-add" on:click={() => showAddChannel = !showAddChannel}>
          {showAddChannel ? 'Cancel' : '+ Add Channel'}
        </button>
      </div>

      {#if showAddChannel}
        <div class="add-channel-form">
          <div class="form-row">
            <label>Channel Type</label>
            <select bind:value={newChannel.type}>
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="webhook">Custom Webhook</option>
            </select>
          </div>

          {#if newChannel.type === 'telegram'}
            <div class="form-row">
              <label>Bot Token</label>
              <input type="text" bind:value={newChannel.botToken} placeholder="123456:ABC..." />
            </div>
            <div class="form-row">
              <label>Chat ID</label>
              <input type="text" bind:value={newChannel.chatId} placeholder="-100123456789" />
            </div>
          {:else if newChannel.type === 'discord'}
            <div class="form-row">
              <label>Webhook URL</label>
              <input type="text" bind:value={newChannel.webhookUrl} placeholder="https://discord.com/api/webhooks/..." />
            </div>
          {:else if newChannel.type === 'webhook'}
            <div class="form-row">
              <label>URL</label>
              <input type="text" bind:value={newChannel.url} placeholder="https://example.com/webhook" />
            </div>
            <div class="form-row">
              <label>Headers (JSON)</label>
              <input type="text" bind:value={newChannel.headers} placeholder={'{"Authorization": "Bearer ..."}'} />
            </div>
          {/if}

          <div class="form-actions">
            <button class="btn-primary" on:click={addChannel}>Add Channel</button>
          </div>
        </div>
      {/if}

      <div class="channels-list">
        {#each config.channels || [] as channel}
          <div class="channel-item">
            <span class="channel-icon">{getChannelIcon(channel.type)}</span>
            <span class="channel-info">
              <span class="channel-type">{channel.type}</span>
              <span class="channel-label">{getChannelLabel(channel)}</span>
            </span>
            <div class="channel-actions">
              <button
                class="btn-test"
                on:click={() => testChannel(channel.id)}
                disabled={testing === channel.id}
              >
                {#if testing === channel.id}
                  {#if testResult === 'success'}
                    ✓
                  {:else if testResult}
                    ✗
                  {:else}
                    ...
                  {/if}
                {:else}
                  Test
                {/if}
              </button>
              <button class="btn-remove" on:click={() => removeChannel(channel.id)}>×</button>
            </div>
          </div>
        {:else}
          <div class="no-channels">No notification channels configured</div>
        {/each}
      </div>
    </div>

    <!-- Test -->
    {#if config.channels?.length > 0}
      <div class="section">
        <button class="btn-test-all" on:click={sendTestNotification}>
          Send Test Notification
        </button>
      </div>
    {/if}

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if saving}
      <div class="saving">Saving...</div>
    {/if}
  {/if}
</div>

<style>
  .notification-config {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    margin: 0 auto;
  }

  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .config-header h2 {
    margin: 0;
    font-size: 18px;
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary, #a0a0b0);
  }

  .loading, .saving {
    text-align: center;
    padding: 20px;
    color: var(--text-secondary, #a0a0b0);
  }

  .section {
    margin-bottom: 24px;
  }

  .section h3 {
    font-size: 14px;
    margin-bottom: 12px;
    color: var(--text-secondary, #a0a0b0);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .section-header h3 {
    margin: 0;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  .toggle-label {
    font-size: 15px;
    font-weight: 500;
  }

  .events-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .event-item {
    display: flex;
    flex-direction: column;
    padding: 10px;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    cursor: pointer;
  }

  .event-item input {
    margin-bottom: 4px;
  }

  .event-item span {
    font-size: 13px;
    font-weight: 500;
  }

  .event-item small {
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  .btn-add {
    padding: 6px 12px;
    background: var(--accent-color, #6366f1);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .add-channel-form {
    background: var(--bg-tertiary, #2d2d44);
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .form-row {
    margin-bottom: 12px;
  }

  .form-row label {
    display: block;
    font-size: 12px;
    margin-bottom: 4px;
    color: var(--text-secondary, #a0a0b0);
  }

  .form-row input, .form-row select {
    width: 100%;
    padding: 8px;
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 4px;
    color: inherit;
    font-size: 13px;
  }

  .form-actions {
    text-align: right;
  }

  .btn-primary {
    padding: 8px 16px;
    background: var(--accent-color, #6366f1);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .channels-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .channel-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
  }

  .channel-icon {
    font-size: 20px;
  }

  .channel-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .channel-type {
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-secondary, #a0a0b0);
  }

  .channel-label {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .channel-actions {
    display: flex;
    gap: 6px;
  }

  .btn-test {
    padding: 4px 10px;
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: inherit;
    min-width: 40px;
  }

  .btn-remove {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #ef4444;
  }

  .no-channels {
    text-align: center;
    padding: 20px;
    color: var(--text-secondary, #a0a0b0);
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
  }

  .btn-test-all {
    width: 100%;
    padding: 10px;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    font-size: 13px;
  }

  .btn-test-all:hover {
    background: var(--border-color, #3d3d54);
  }

  .error {
    margin-top: 12px;
    padding: 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 4px;
    color: #ef4444;
    font-size: 13px;
  }
</style>
