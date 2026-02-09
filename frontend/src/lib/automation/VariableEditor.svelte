<script>
  import { createEventDispatcher } from 'svelte';

  export let variables = [];
  export let show = false;

  const dispatch = createEventDispatcher();

  let editingVariable = null;
  let newVariable = { name: '', type: 'string', value: '', description: '' };

  const variableTypes = [
    { value: 'string', label: 'String', icon: '📝', placeholder: 'Text value' },
    { value: 'number', label: 'Number', icon: '🔢', placeholder: '0' },
    { value: 'boolean', label: 'Boolean', icon: '✓', placeholder: 'true/false' },
    { value: 'array', label: 'Array', icon: '📋', placeholder: '["item1", "item2"]' },
    { value: 'object', label: 'Object', icon: '📦', placeholder: '{"key": "value"}' },
  ];

  function getDefaultValue(type) {
    switch (type) {
      case 'number': return '0';
      case 'boolean': return 'false';
      case 'array': return '[]';
      case 'object': return '{}';
      default: return '';
    }
  }

  function parseValue(value, type) {
    try {
      switch (type) {
        case 'number': return parseFloat(value) || 0;
        case 'boolean': return value === 'true' || value === true;
        case 'array': return JSON.parse(value);
        case 'object': return JSON.parse(value);
        default: return String(value);
      }
    } catch {
      return value;
    }
  }

  function formatValue(value, type) {
    if (type === 'array' || type === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  function addVariable() {
    if (!newVariable.name.trim()) return;

    // Check for duplicate names
    if (variables.some(v => v.name === newVariable.name.trim())) {
      alert('Variable name already exists');
      return;
    }

    const variable = {
      id: `var-${Date.now()}`,
      name: newVariable.name.trim(),
      type: newVariable.type,
      value: parseValue(newVariable.value || getDefaultValue(newVariable.type), newVariable.type),
      description: newVariable.description,
    };

    variables = [...variables, variable];
    newVariable = { name: '', type: 'string', value: '', description: '' };
    dispatch('change', variables);
  }

  function startEdit(variable) {
    editingVariable = {
      ...variable,
      value: formatValue(variable.value, variable.type),
    };
  }

  function saveEdit() {
    if (!editingVariable) return;

    variables = variables.map(v => {
      if (v.id === editingVariable.id) {
        return {
          ...editingVariable,
          value: parseValue(editingVariable.value, editingVariable.type),
        };
      }
      return v;
    });

    editingVariable = null;
    dispatch('change', variables);
  }

  function cancelEdit() {
    editingVariable = null;
  }

  function deleteVariable(id) {
    if (!confirm('Delete this variable?')) return;
    variables = variables.filter(v => v.id !== id);
    dispatch('change', variables);
  }

  function close() {
    show = false;
    dispatch('close');
  }

  function onTypeChange() {
    newVariable.value = getDefaultValue(newVariable.type);
  }

  function getTypeIcon(type) {
    return variableTypes.find(t => t.value === type)?.icon || '📝';
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="variable-editor" on:click|stopPropagation>
      <div class="editor-header">
        <h3>📊 Workflow Variables</h3>
        <button class="btn-close" on:click={close}>&times;</button>
      </div>

      <div class="editor-body">
        <!-- Add New Variable -->
        <div class="add-variable-section">
          <h4>Add New Variable</h4>
          <div class="add-form">
            <div class="form-row">
              <div class="form-group name-group">
                <label>Name</label>
                <input
                  type="text"
                  bind:value={newVariable.name}
                  placeholder="variableName"
                  class="input"
                />
              </div>
              <div class="form-group type-group">
                <label>Type</label>
                <select bind:value={newVariable.type} on:change={onTypeChange} class="input">
                  {#each variableTypes as type}
                    <option value={type.value}>{type.icon} {type.label}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group value-group">
                <label>Default Value</label>
                {#if newVariable.type === 'boolean'}
                  <select bind:value={newVariable.value} class="input">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                {:else if newVariable.type === 'array' || newVariable.type === 'object'}
                  <textarea
                    bind:value={newVariable.value}
                    placeholder={variableTypes.find(t => t.value === newVariable.type)?.placeholder}
                    class="input textarea"
                    rows="3"
                  ></textarea>
                {:else}
                  <input
                    type={newVariable.type === 'number' ? 'number' : 'text'}
                    bind:value={newVariable.value}
                    placeholder={variableTypes.find(t => t.value === newVariable.type)?.placeholder}
                    class="input"
                  />
                {/if}
              </div>
            </div>
            <div class="form-row">
              <div class="form-group desc-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  bind:value={newVariable.description}
                  placeholder="What this variable is for..."
                  class="input"
                />
              </div>
              <button class="btn btn-primary" on:click={addVariable} disabled={!newVariable.name.trim()}>
                + Add
              </button>
            </div>
          </div>
        </div>

        <!-- Variable List -->
        <div class="variable-list-section">
          <h4>Variables ({variables.length})</h4>

          {#if variables.length === 0}
            <div class="empty-state">
              <p>No variables defined yet.</p>
              <p class="hint">Use <code>{'{{variableName}}'}</code> in action configs to reference variables.</p>
            </div>
          {:else}
            <div class="variable-list">
              {#each variables as variable}
                <div class="variable-item" class:editing={editingVariable?.id === variable.id}>
                  {#if editingVariable?.id === variable.id}
                    <!-- Edit Mode -->
                    <div class="variable-edit">
                      <div class="edit-row">
                        <input
                          type="text"
                          bind:value={editingVariable.name}
                          class="input input-name"
                          placeholder="Name"
                        />
                        <select bind:value={editingVariable.type} class="input input-type">
                          {#each variableTypes as type}
                            <option value={type.value}>{type.icon} {type.label}</option>
                          {/each}
                        </select>
                      </div>
                      <div class="edit-row">
                        {#if editingVariable.type === 'boolean'}
                          <select bind:value={editingVariable.value} class="input">
                            <option value="false">false</option>
                            <option value="true">true</option>
                          </select>
                        {:else if editingVariable.type === 'array' || editingVariable.type === 'object'}
                          <textarea
                            bind:value={editingVariable.value}
                            class="input textarea"
                            rows="3"
                          ></textarea>
                        {:else}
                          <input
                            type={editingVariable.type === 'number' ? 'number' : 'text'}
                            bind:value={editingVariable.value}
                            class="input"
                          />
                        {/if}
                      </div>
                      <div class="edit-row">
                        <input
                          type="text"
                          bind:value={editingVariable.description}
                          class="input"
                          placeholder="Description"
                        />
                      </div>
                      <div class="edit-actions">
                        <button class="btn btn-sm btn-primary" on:click={saveEdit}>Save</button>
                        <button class="btn btn-sm" on:click={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  {:else}
                    <!-- View Mode -->
                    <div class="variable-view">
                      <div class="variable-main">
                        <span class="variable-type-icon">{getTypeIcon(variable.type)}</span>
                        <span class="variable-name">{variable.name}</span>
                        <span class="variable-type-badge">{variable.type}</span>
                      </div>
                      <div class="variable-value">
                        <code>{formatValue(variable.value, variable.type)}</code>
                      </div>
                      {#if variable.description}
                        <div class="variable-desc">{variable.description}</div>
                      {/if}
                    </div>
                    <div class="variable-actions">
                      <button class="btn-icon" on:click={() => startEdit(variable)} title="Edit">
                        ✏️
                      </button>
                      <button class="btn-icon danger" on:click={() => deleteVariable(variable.id)} title="Delete">
                        🗑️
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Usage Hint -->
        <div class="usage-hint">
          <h4>Usage</h4>
          <p>Reference variables in action configs using: <code>{'{{variableName}}'}</code></p>
          <p>Example: Navigate to <code>{'{{baseUrl}}/login'}</code></p>
        </div>
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
    z-index: 1000;
  }

  .variable-editor {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    width: 650px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .editor-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--text-primary, #fff);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--text-primary, #fff);
  }

  .editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .add-variable-section {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .form-row:last-child {
    margin-bottom: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .name-group {
    flex: 2;
  }

  .type-group {
    flex: 1;
  }

  .value-group {
    flex: 1;
  }

  .desc-group {
    flex: 1;
  }

  .input {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    padding: 8px 12px;
    font-size: 13px;
  }

  .input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .textarea {
    resize: vertical;
    font-family: monospace;
    font-size: 12px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    color: #fff;
    align-self: flex-end;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  .variable-list-section {
    margin-bottom: 20px;
  }

  .empty-state {
    text-align: center;
    padding: 30px;
    color: var(--text-secondary, #888);
  }

  .empty-state p {
    margin: 0 0 8px 0;
  }

  .empty-state .hint {
    font-size: 12px;
  }

  .empty-state code {
    background: var(--bg-primary, #121212);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--accent-color, #3b82f6);
  }

  .variable-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .variable-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 12px;
    transition: border-color 0.15s;
  }

  .variable-item:hover {
    border-color: var(--accent-color, #3b82f6);
  }

  .variable-item.editing {
    flex-direction: column;
    gap: 12px;
  }

  .variable-view {
    flex: 1;
  }

  .variable-main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .variable-type-icon {
    font-size: 14px;
  }

  .variable-name {
    font-weight: 600;
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  .variable-type-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(59, 130, 246, 0.2);
    color: var(--accent-color, #3b82f6);
    border-radius: 4px;
    text-transform: uppercase;
  }

  .variable-value {
    margin-bottom: 4px;
  }

  .variable-value code {
    font-size: 12px;
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .variable-desc {
    font-size: 11px;
    color: var(--text-secondary, #888);
    font-style: italic;
  }

  .variable-actions {
    display: flex;
    gap: 4px;
  }

  .btn-icon {
    background: transparent;
    border: none;
    font-size: 14px;
    padding: 6px;
    cursor: pointer;
    border-radius: 4px;
    opacity: 0.7;
  }

  .btn-icon:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-icon.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .variable-edit {
    width: 100%;
  }

  .edit-row {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
  }

  .edit-row .input {
    flex: 1;
  }

  .input-name {
    flex: 2 !important;
  }

  .input-type {
    flex: 1 !important;
  }

  .edit-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .usage-hint {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
  }

  .usage-hint h4 {
    color: var(--accent-color, #3b82f6);
    margin-bottom: 8px;
  }

  .usage-hint p {
    margin: 0 0 6px 0;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .usage-hint p:last-child {
    margin-bottom: 0;
  }

  .usage-hint code {
    background: var(--bg-primary, #121212);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--accent-color, #3b82f6);
  }
</style>
