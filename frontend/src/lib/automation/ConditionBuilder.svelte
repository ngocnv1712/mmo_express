<script>
  import { createEventDispatcher } from 'svelte';

  export let condition = '';
  export let variables = [];

  const dispatch = createEventDispatcher();

  // Parsed condition groups
  let conditionGroups = [{ conditions: [createEmptyCondition()], operator: 'AND' }];

  // Condition types
  const conditionTypes = [
    { value: 'variable', label: 'Variable Comparison', icon: '📊' },
    { value: 'element', label: 'Element Check', icon: '🔍' },
    { value: 'custom', label: 'Custom Expression', icon: '✏️' },
  ];

  // Comparison operators
  const comparisonOperators = [
    { value: '==', label: '= equals' },
    { value: '!=', label: '≠ not equals' },
    { value: '>', label: '> greater than' },
    { value: '<', label: '< less than' },
    { value: '>=', label: '≥ greater or equal' },
    { value: '<=', label: '≤ less or equal' },
    { value: 'contains', label: 'contains' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'matches', label: 'matches regex' },
  ];

  // Element check types
  const elementChecks = [
    { value: 'exists', label: 'exists' },
    { value: 'visible', label: 'is visible' },
    { value: 'hidden', label: 'is hidden' },
    { value: 'enabled', label: 'is enabled' },
    { value: 'disabled', label: 'is disabled' },
    { value: 'hasText', label: 'has text' },
    { value: 'hasClass', label: 'has class' },
    { value: 'hasAttribute', label: 'has attribute' },
  ];

  function createEmptyCondition() {
    return {
      id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'variable',
      variable: '',
      operator: '==',
      value: '',
      selector: '',
      elementCheck: 'exists',
      customExpression: '',
    };
  }

  function addCondition(groupIndex) {
    conditionGroups[groupIndex].conditions = [
      ...conditionGroups[groupIndex].conditions,
      createEmptyCondition()
    ];
    updateConditionString();
  }

  function removeCondition(groupIndex, condIndex) {
    if (conditionGroups[groupIndex].conditions.length === 1) {
      if (conditionGroups.length === 1) return; // Keep at least one condition
      conditionGroups = conditionGroups.filter((_, i) => i !== groupIndex);
    } else {
      conditionGroups[groupIndex].conditions = conditionGroups[groupIndex].conditions.filter((_, i) => i !== condIndex);
    }
    updateConditionString();
  }

  function addGroup() {
    conditionGroups = [...conditionGroups, { conditions: [createEmptyCondition()], operator: 'AND' }];
    updateConditionString();
  }

  function toggleGroupOperator(groupIndex) {
    conditionGroups[groupIndex].operator = conditionGroups[groupIndex].operator === 'AND' ? 'OR' : 'AND';
    updateConditionString();
  }

  function updateConditionString() {
    const parts = conditionGroups.map(group => {
      const groupParts = group.conditions.map(cond => {
        if (cond.type === 'custom') {
          return cond.customExpression;
        } else if (cond.type === 'element') {
          const check = cond.elementCheck;
          const selector = cond.selector;

          if (['hasText', 'hasClass', 'hasAttribute'].includes(check)) {
            return `element("${selector}").${check}("${cond.value}")`;
          }
          return `element("${selector}").${check}()`;
        } else {
          // Variable comparison
          const left = `{{${cond.variable}}}`;
          const right = isNaN(cond.value) ? `"${cond.value}"` : cond.value;

          if (['contains', 'startsWith', 'endsWith', 'matches'].includes(cond.operator)) {
            return `${left}.${cond.operator}(${right})`;
          }
          return `${left} ${cond.operator} ${right}`;
        }
      });

      return groupParts.length > 1 ? `(${groupParts.join(` ${group.operator} `)})` : groupParts[0];
    });

    condition = parts.join(' AND ');
    dispatch('change', condition);
  }

  function handleConditionChange() {
    updateConditionString();
  }
</script>

<div class="condition-builder">
  <div class="builder-header">
    <span class="header-icon">🔀</span>
    <span class="header-title">Condition Builder</span>
  </div>

  <div class="condition-groups">
    {#each conditionGroups as group, groupIndex}
      {#if groupIndex > 0}
        <div class="group-separator">
          <span>AND</span>
        </div>
      {/if}

      <div class="condition-group">
        <div class="group-header">
          <span class="group-label">Condition Group {groupIndex + 1}</span>
          {#if group.conditions.length > 1}
            <button class="operator-toggle" on:click={() => toggleGroupOperator(groupIndex)}>
              {group.operator}
            </button>
          {/if}
        </div>

        {#each group.conditions as cond, condIndex}
          {#if condIndex > 0}
            <div class="condition-operator">
              <span>{group.operator}</span>
            </div>
          {/if}

          <div class="condition-row">
            <select
              bind:value={cond.type}
              on:change={handleConditionChange}
              class="input type-select"
            >
              {#each conditionTypes as type}
                <option value={type.value}>{type.icon} {type.label}</option>
              {/each}
            </select>

            {#if cond.type === 'variable'}
              <select
                bind:value={cond.variable}
                on:change={handleConditionChange}
                class="input variable-select"
              >
                <option value="">Select variable...</option>
                {#each variables as v}
                  <option value={v.name}>{v.name}</option>
                {/each}
                <option value="_custom_">Custom...</option>
              </select>

              {#if cond.variable === '_custom_'}
                <input
                  type="text"
                  bind:value={cond.variable}
                  on:input={handleConditionChange}
                  class="input"
                  placeholder="variableName"
                />
              {/if}

              <select
                bind:value={cond.operator}
                on:change={handleConditionChange}
                class="input operator-select"
              >
                {#each comparisonOperators as op}
                  <option value={op.value}>{op.label}</option>
                {/each}
              </select>

              <input
                type="text"
                bind:value={cond.value}
                on:input={handleConditionChange}
                class="input value-input"
                placeholder="Value"
              />
            {:else if cond.type === 'element'}
              <input
                type="text"
                bind:value={cond.selector}
                on:input={handleConditionChange}
                class="input selector-input"
                placeholder="#id or .class or CSS selector"
              />

              <select
                bind:value={cond.elementCheck}
                on:change={handleConditionChange}
                class="input check-select"
              >
                {#each elementChecks as check}
                  <option value={check.value}>{check.label}</option>
                {/each}
              </select>

              {#if ['hasText', 'hasClass', 'hasAttribute'].includes(cond.elementCheck)}
                <input
                  type="text"
                  bind:value={cond.value}
                  on:input={handleConditionChange}
                  class="input value-input"
                  placeholder={cond.elementCheck === 'hasText' ? 'Text to find' : cond.elementCheck === 'hasClass' ? 'Class name' : 'Attribute name'}
                />
              {/if}
            {:else}
              <input
                type="text"
                bind:value={cond.customExpression}
                on:input={handleConditionChange}
                class="input custom-input"
                placeholder="JavaScript expression (e.g., {{count}} > 0 && {{status}} == 'active')"
              />
            {/if}

            <button class="btn-remove" on:click={() => removeCondition(groupIndex, condIndex)} title="Remove">
              ✕
            </button>
          </div>
        {/each}

        <button class="btn-add-condition" on:click={() => addCondition(groupIndex)}>
          + Add Condition
        </button>
      </div>
    {/each}
  </div>

  <button class="btn-add-group" on:click={addGroup}>
    + Add Condition Group
  </button>

  <div class="condition-preview">
    <span class="preview-label">Generated condition:</span>
    <code class="preview-code">{condition || '(empty)'}</code>
  </div>
</div>

<style>
  .condition-builder {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 16px;
  }

  .builder-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .header-icon {
    font-size: 16px;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .condition-groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
  }

  .group-separator {
    text-align: center;
    padding: 8px 0;
  }

  .group-separator span {
    background: var(--accent-color, #3b82f6);
    color: #fff;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .condition-group {
    background: var(--bg-secondary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 12px;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .group-label {
    font-size: 11px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
  }

  .operator-toggle {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #60a5fa;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .operator-toggle:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .condition-operator {
    text-align: center;
    padding: 6px 0;
  }

  .condition-operator span {
    color: var(--text-secondary, #888);
    font-size: 11px;
    font-weight: 500;
  }

  .condition-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .input {
    background: var(--bg-primary, #121212);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #fff);
    padding: 6px 10px;
    font-size: 12px;
  }

  .input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .type-select {
    width: 160px;
  }

  .variable-select {
    width: 140px;
  }

  .operator-select {
    width: 130px;
  }

  .value-input {
    flex: 1;
    min-width: 100px;
  }

  .selector-input {
    flex: 1;
    min-width: 150px;
  }

  .check-select {
    width: 120px;
  }

  .custom-input {
    flex: 1;
    min-width: 200px;
  }

  .btn-remove {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .btn-remove:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .btn-add-condition {
    background: none;
    border: 1px dashed var(--border-color, #333);
    color: var(--text-secondary, #888);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    margin-top: 8px;
    width: 100%;
  }

  .btn-add-condition:hover {
    border-color: var(--accent-color, #3b82f6);
    color: var(--accent-color, #3b82f6);
  }

  .btn-add-group {
    background: none;
    border: 1px dashed var(--border-color, #333);
    color: var(--text-secondary, #888);
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    width: 100%;
    margin-bottom: 16px;
  }

  .btn-add-group:hover {
    border-color: var(--accent-color, #3b82f6);
    color: var(--accent-color, #3b82f6);
  }

  .condition-preview {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 6px;
    padding: 12px;
  }

  .preview-label {
    display: block;
    font-size: 11px;
    color: var(--text-secondary, #888);
    margin-bottom: 6px;
  }

  .preview-code {
    display: block;
    font-size: 12px;
    color: var(--accent-color, #3b82f6);
    word-break: break-all;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  }
</style>
