<script>
  export let block = null;
  export let schemas = {};
  export let onBlockUpdate = () => {};

  $: actionSchema = getActionSchema(block);

  function getActionSchema(block) {
    if (!block || !schemas) return null;

    for (const category of Object.values(schemas)) {
      if (category.actions) {
        for (const action of Object.values(category.actions)) {
          if (action.type === block.type) {
            return action;
          }
        }
      }
    }
    return null;
  }

  function handleConfigChange(key, value) {
    if (!block) return;

    const newBlock = {
      ...block,
      config: {
        ...block.config,
        [key]: value
      }
    };
    onBlockUpdate(newBlock);
  }

  function handleNameChange(newName) {
    if (!block) return;

    const newBlock = {
      ...block,
      name: newName
    };
    onBlockUpdate(newBlock);
  }

  function getFieldValue(key) {
    return block?.config?.[key] ?? '';
  }
</script>

<div class="property-panel">
  {#if block}
    <div class="panel-header">
      <span class="block-icon">{block.icon || '📦'}</span>
      <input
        type="text"
        class="block-name-input"
        value={block.name || block.type}
        on:input={(e) => handleNameChange(e.target.value)}
        placeholder="Enter step name..."
      />
    </div>

    {#if actionSchema?.description}
      <div class="description">{actionSchema.description}</div>
    {/if}

    <div class="properties">
      {#if actionSchema?.configSchema}
        {#each Object.entries(actionSchema.configSchema) as [key, field]}
          <div class="field">
            <label for="field-{key}">
              {field.label || key}
              {#if field.required}
                <span class="required">*</span>
              {/if}
            </label>

            {#if field.description}
              <div class="field-hint">{field.description}</div>
            {/if}

            {#if field.type === 'string'}
              {#if field.options}
                <select
                  id="field-{key}"
                  value={getFieldValue(key)}
                  on:change={(e) => handleConfigChange(key, e.target.value)}
                >
                  {#each field.options as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              {:else if field.multiline}
                <textarea
                  id="field-{key}"
                  value={getFieldValue(key)}
                  placeholder={field.placeholder || ''}
                  rows="4"
                  on:input={(e) => handleConfigChange(key, e.target.value)}
                ></textarea>
              {:else}
                <input
                  type="text"
                  id="field-{key}"
                  value={getFieldValue(key)}
                  placeholder={field.placeholder || ''}
                  on:input={(e) => handleConfigChange(key, e.target.value)}
                />
              {/if}
            {:else if field.type === 'number'}
              <input
                type="number"
                id="field-{key}"
                value={getFieldValue(key)}
                min={field.min}
                max={field.max}
                step={field.step || 1}
                placeholder={field.placeholder || ''}
                on:input={(e) => handleConfigChange(key, parseFloat(e.target.value) || 0)}
              />
            {:else if field.type === 'boolean'}
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  id="field-{key}"
                  checked={getFieldValue(key)}
                  on:change={(e) => handleConfigChange(key, e.target.checked)}
                />
                <span class="checkbox-text">{field.checkboxLabel || 'Enable'}</span>
              </label>
            {:else if field.type === 'select'}
              <select
                id="field-{key}"
                value={getFieldValue(key)}
                on:change={(e) => handleConfigChange(key, e.target.value)}
              >
                {#each field.options || [] as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            {:else if field.type === 'array'}
              <textarea
                id="field-{key}"
                value={(getFieldValue(key) || []).join('\n')}
                placeholder={field.placeholder || 'One item per line'}
                rows="3"
                on:input={(e) => handleConfigChange(key, e.target.value.split('\n').filter(v => v.trim()))}
              ></textarea>
            {:else if field.type === 'json'}
              <textarea
                id="field-{key}"
                value={typeof getFieldValue(key) === 'object' ? JSON.stringify(getFieldValue(key), null, 2) : getFieldValue(key)}
                placeholder={field.placeholder || '{}'}
                rows="4"
                class="code"
                on:input={(e) => {
                  try {
                    handleConfigChange(key, JSON.parse(e.target.value));
                  } catch {
                    // Keep as string if invalid JSON
                  }
                }}
              ></textarea>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="no-config">
          <p>This action has no configurable properties.</p>
        </div>
      {/if}

      <!-- Error Handling Section -->
      <div class="error-handling-section">
        <h4>Error Handling</h4>

        <div class="field">
          <label for="on-error">On Error</label>
          <select
            id="on-error"
            value={getFieldValue('onError') || 'stop'}
            on:change={(e) => handleConfigChange('onError', e.target.value)}
          >
            <option value="stop">Stop workflow</option>
            <option value="continue">Continue to next action</option>
            <option value="retry">Retry action</option>
          </select>
        </div>

        {#if getFieldValue('onError') === 'retry'}
          <div class="field">
            <label for="retry-count">Retry attempts</label>
            <input
              type="number"
              id="retry-count"
              value={getFieldValue('retryCount') || 3}
              min="1"
              max="10"
              on:input={(e) => handleConfigChange('retryCount', parseInt(e.target.value) || 3)}
            />
          </div>

          <div class="field">
            <label for="retry-delay">Retry delay (ms)</label>
            <input
              type="number"
              id="retry-delay"
              value={getFieldValue('retryDelay') || 1000}
              min="0"
              max="30000"
              step="100"
              on:input={(e) => handleConfigChange('retryDelay', parseInt(e.target.value) || 1000)}
            />
          </div>
        {/if}

        <div class="field">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={getFieldValue('screenshotOnError') || false}
              on:change={(e) => handleConfigChange('screenshotOnError', e.target.checked)}
            />
            <span class="checkbox-text">Take screenshot on error</span>
          </label>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <div class="block-id">ID: {block.id}</div>
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">⚙️</div>
      <h3>Properties</h3>
      <p>Select a block to edit its properties</p>
    </div>
  {/if}
</div>

<style>
  .property-panel {
    width: 300px;
    background: var(--bg-secondary, #1a1a1a);
    border-left: 1px solid var(--border-color, #333);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .block-icon {
    font-size: 18px;
  }

  .block-name-input {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 4px 8px;
    margin: -4px 0;
    transition: all 0.15s;
  }

  .block-name-input:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--border-color, #333);
  }

  .block-name-input:focus {
    outline: none;
    background: var(--bg-primary, #121212);
    border-color: var(--accent-color, #3b82f6);
  }

  .description {
    padding: 12px 16px;
    font-size: 12px;
    color: var(--text-secondary, #888);
    border-bottom: 1px solid var(--border-color, #333);
    background: rgba(255, 255, 255, 0.02);
  }

  .properties {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .field {
    margin-bottom: 16px;
  }

  .field label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    margin-bottom: 6px;
  }

  .required {
    color: #ef4444;
  }

  .field-hint {
    font-size: 11px;
    color: var(--text-secondary, #666);
    margin-bottom: 6px;
  }

  .field input[type="text"],
  .field input[type="number"],
  .field select,
  .field textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-primary, #121212);
    color: var(--text-primary, #fff);
    font-size: 13px;
    transition: border-color 0.15s;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .field textarea {
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
  }

  .field textarea.code {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .checkbox-text {
    font-size: 13px;
    color: var(--text-primary, #fff);
  }

  .no-config {
    text-align: center;
    color: var(--text-secondary, #666);
    padding: 24px;
  }

  .no-config p {
    margin: 0;
    font-size: 13px;
  }

  .error-handling-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color, #333);
  }

  .error-handling-section h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .panel-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #333);
  }

  .block-id {
    font-size: 10px;
    color: var(--text-secondary, #666);
    font-family: monospace;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary, #666);
    text-align: center;
    padding: 24px;
  }

  .empty-icon {
    font-size: 36px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .empty-state p {
    margin: 0;
    font-size: 13px;
  }
</style>
