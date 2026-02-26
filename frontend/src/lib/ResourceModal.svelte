<script>
  import { createEventDispatcher } from 'svelte';
  import { getPlatforms, getProfileResources, createResource, updateResource, deleteResource } from './api.js';
  import { showAlert, showConfirm } from './stores/dialog.js';

  export let profileId = '';
  export let profileName = '';
  export let show = false;

  const dispatch = createEventDispatcher();

  let platforms = [];
  let resources = [];
  let loading = false;
  let showAddForm = false;
  let editingResource = null;

  // Form data (Note: Cookies are managed at Profile level in Storage tab)
  let form = {
    platform: '',
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    twofa: '',
    recoveryEmail: '',
    token: '',
    session: '',
    autoLogin: true
  };

  // Platform icons
  function getPlatformEmoji(platform) {
    const icons = {
      facebook: '\u{1F535}',
      zalo: '\u{1F4AC}',
      tiktok: '\u{1F3B5}',
      gmail: '\u{1F4E7}',
      shopee: '\u{1F6D2}',
      telegram: '\u{2708}',
      instagram: '\u{1F4F7}',
      twitter: '\u{1F426}',
      youtube: '\u{1F4FA}',
      linkedin: '\u{1F4BC}'
    };
    return icons[platform] || '\u{1F310}';
  }

  // Load platforms and resources
  async function loadData() {
    loading = true;
    try {
      platforms = getPlatforms() || [];
      resources = await getProfileResources(profileId) || [];
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    loading = false;
  }

  // Watch for show changes
  $: if (show && profileId) {
    loadData();
    showAddForm = false;
    editingResource = null;
  }

  function close() {
    show = false;
    dispatch('close');
  }

  function getPlatformInfo(platformId) {
    return platforms.find(p => p.id === platformId);
  }

  function hasField(platformId, field) {
    const platform = getPlatformInfo(platformId);
    return platform?.fields?.includes(field) || false;
  }

  function resetForm() {
    form = {
      platform: '',
      name: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      twofa: '',
      recoveryEmail: '',
      token: '',
      session: '',
      autoLogin: true
    };
  }

  function startAdd(platformId) {
    resetForm();
    form.platform = platformId;
    editingResource = null;
    showAddForm = true;
  }

  function startEdit(resource) {
    form = {
      platform: resource.platform,
      name: resource.name || '',
      username: resource.username || '',
      email: resource.email || '',
      phone: resource.phone || '',
      password: resource.password || '',
      twofa: resource.twofa || '',
      recoveryEmail: resource.recoveryEmail || '',
      token: resource.token || '',
      session: resource.session || '',
      autoLogin: resource.autoLogin !== false
    };
    editingResource = resource;
    showAddForm = true;
  }

  function cancelForm() {
    showAddForm = false;
    editingResource = null;
    resetForm();
  }

  async function saveResource() {
    loading = true;
    try {
      const data = {
        profileId: profileId,
        platform: form.platform,
        name: form.name || form.email || form.username || form.phone || '',
        username: form.username,
        email: form.email,
        phone: form.phone,
        password: form.password,
        twofa: form.twofa,
        recoveryEmail: form.recoveryEmail,
        token: form.token,
        session: form.session,
        autoLogin: form.autoLogin
      };

      if (editingResource) {
        data.id = editingResource.id;
        data.status = editingResource.status;
        await updateResource(data);
      } else {
        await createResource(data);
      }

      await loadData();
      dispatch('saved');
      cancelForm();
    } catch (e) {
      console.error('Failed to save resource:', e);
      showAlert('Failed to save: ' + e, { title: 'Save Failed', variant: 'danger' });
    }
    loading = false;
  }

  async function handleDeleteResource(id) {
    const confirmed = await showConfirm('Are you sure you want to delete this resource?', {
      title: 'Delete Resource',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    loading = true;
    try {
      await deleteResource(id);
      await loadData();
      dispatch('saved');
    } catch (e) {
      console.error('Failed to delete resource:', e);
    }
    loading = false;
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'active': return { class: 'status-active', text: 'Active' };
      case 'expired': return { class: 'status-expired', text: 'Expired' };
      case 'error': return { class: 'status-error', text: 'Error' };
      default: return { class: 'status-unknown', text: status };
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Resources - {profileName}</h2>
        <button class="close-btn" on:click={close}>&times;</button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading">Loading...</div>
        {:else if showAddForm}
          <!-- Add/Edit Form -->
          <div class="form-container">
            <div class="form-header">
              <h3>
                {getPlatformEmoji(form.platform)}
                {editingResource ? 'Edit' : 'Add'} {getPlatformInfo(form.platform)?.name || form.platform}
              </h3>
              <button class="btn-cancel" on:click={cancelForm}>Cancel</button>
            </div>

            <div class="form-fields">
              <div class="form-group">
                <label>Display Name</label>
                <input type="text" bind:value={form.name} placeholder="Optional - auto-generated if empty" />
              </div>

              {#if hasField(form.platform, 'username')}
                <div class="form-group">
                  <label>Username</label>
                  <input type="text" bind:value={form.username} placeholder="@username" />
                </div>
              {/if}

              {#if hasField(form.platform, 'email')}
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" bind:value={form.email} placeholder="email@example.com" />
                </div>
              {/if}

              {#if hasField(form.platform, 'phone')}
                <div class="form-group">
                  <label>Phone</label>
                  <input type="tel" bind:value={form.phone} placeholder="+84901234567" />
                </div>
              {/if}

              {#if hasField(form.platform, 'password')}
                <div class="form-group">
                  <label>Password</label>
                  <input type="password" bind:value={form.password} placeholder="Password" />
                </div>
              {/if}

              {#if hasField(form.platform, 'twofa')}
                <div class="form-group">
                  <label>2FA Secret</label>
                  <input type="text" bind:value={form.twofa} placeholder="TOTP secret key" />
                </div>
              {/if}

              {#if hasField(form.platform, 'recoveryEmail')}
                <div class="form-group">
                  <label>Recovery Email</label>
                  <input type="email" bind:value={form.recoveryEmail} placeholder="recovery@example.com" />
                </div>
              {/if}

              {#if hasField(form.platform, 'token')}
                <div class="form-group">
                  <label>API Token</label>
                  <input type="text" bind:value={form.token} placeholder="API Token" />
                </div>
              {/if}

              {#if hasField(form.platform, 'session')}
                <div class="form-group">
                  <label>Session String</label>
                  <textarea bind:value={form.session} placeholder="Session data" rows="3"></textarea>
                </div>
              {/if}

              <div class="form-group checkbox">
                <label>
                  <input type="checkbox" bind:checked={form.autoLogin} />
                  Auto-login when opening profile
                </label>
              </div>
            </div>

            <div class="form-actions">
              <button class="btn-save" on:click={saveResource} disabled={loading}>
                {editingResource ? 'Update' : 'Add'} Resource
              </button>
            </div>
          </div>
        {:else}
          <!-- Resource List -->
          <div class="resource-list">
            {#if resources.length === 0}
              <div class="empty-state">
                <p>No resources added yet.</p>
                <p>Click a platform below to add login credentials.</p>
              </div>
            {:else}
              {#each resources as resource}
                <div class="resource-item">
                  <div class="resource-icon">
                    {getPlatformEmoji(resource.platform)}
                  </div>
                  <div class="resource-info">
                    <div class="resource-name">{resource.name || resource.platform}</div>
                    <div class="resource-platform">{getPlatformInfo(resource.platform)?.name || resource.platform}</div>
                  </div>
                  <div class="resource-status">
                    <span class="status-badge {getStatusBadge(resource.status).class}">
                      {getStatusBadge(resource.status).text}
                    </span>
                    {#if resource.autoLogin}
                      <span class="auto-login-badge" title="Auto-login enabled">Auto</span>
                    {/if}
                  </div>
                  <div class="resource-actions">
                    <button class="icon-btn" on:click={() => startEdit(resource)} title="Edit">
                      &#x270F;
                    </button>
                    <button class="icon-btn danger" on:click={() => handleDeleteResource(resource.id)} title="Delete">
                      &#x1F5D1;
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>

          <!-- Platform Selector -->
          <div class="platform-selector">
            <div class="selector-header">Add Resource</div>
            <div class="platform-grid">
              {#each platforms as platform}
                <button class="platform-btn" on:click={() => startAdd(platform.id)}>
                  <span class="platform-icon">{getPlatformEmoji(platform.id)}</span>
                  <span class="platform-name">{platform.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
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

  .modal {
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 12px;
    width: 600px;
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

  /* Resource List */
  .resource-list {
    margin-bottom: 1.5rem;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #0f3460;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }

  .resource-icon {
    font-size: 1.5rem;
  }

  .resource-info {
    flex: 1;
  }

  .resource-name {
    font-weight: 500;
    color: #fff;
  }

  .resource-platform {
    font-size: 0.8rem;
    color: #888;
  }

  .resource-status {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .status-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-active {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-expired {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .status-error {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .auto-login-badge {
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.7rem;
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .resource-actions {
    display: flex;
    gap: 0.25rem;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    font-size: 1rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .icon-btn:hover {
    opacity: 1;
  }

  .icon-btn.danger:hover {
    filter: hue-rotate(180deg);
  }

  /* Platform Selector */
  .platform-selector {
    border-top: 1px solid #0f3460;
    padding-top: 1rem;
  }

  .selector-header {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .platform-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .platform-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem;
    background: #0f3460;
    border: 1px solid #0f3460;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .platform-btn:hover {
    border-color: #e94560;
    background: #1a4a7a;
  }

  .platform-icon {
    font-size: 1.5rem;
  }

  .platform-name {
    font-size: 0.75rem;
    color: #ccc;
  }

  /* Form */
  .form-container {
    background: #0f3460;
    border-radius: 8px;
    padding: 1rem;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .form-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .btn-cancel {
    background: none;
    border: 1px solid #666;
    color: #888;
    padding: 0.3rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-cancel:hover {
    border-color: #888;
    color: #fff;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .form-group label {
    font-size: 0.8rem;
    color: #888;
  }

  .form-group input,
  .form-group textarea {
    background: #16213e;
    border: 1px solid #1a4a7a;
    border-radius: 4px;
    padding: 0.5rem;
    color: #fff;
    font-size: 0.9rem;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #e94560;
  }

  .form-group.checkbox {
    flex-direction: row;
    align-items: center;
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    cursor: pointer;
  }

  .form-group.checkbox input {
    width: auto;
  }

  .form-actions {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
  }

  .btn-save {
    background: #e94560;
    border: none;
    color: #fff;
    padding: 0.5rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .btn-save:hover {
    background: #d63850;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
