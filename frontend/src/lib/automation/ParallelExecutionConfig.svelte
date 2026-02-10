<script>
  import { onMount } from 'svelte';

  export let config = {};
  export let onChange = () => {};
  export let sidecarUrl = 'http://localhost:3456';

  // Default values
  const defaults = {
    maxConcurrent: 3,
    queueMode: 'fifo',
    delayBetween: 1000,
    timeout: 300000,
    stopOnError: false,
    headless: false,
    blocking: {
      images: false,
      media: false,
      fonts: false,
      css: false,
      trackers: false
    },
    retry: {
      maxRetries: 3,
      strategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 60000
    }
  };

  // Ensure config has all required properties
  $: {
    if (!config.blocking) {
      config.blocking = { ...defaults.blocking };
    }
    if (!config.retry) {
      config.retry = { ...defaults.retry };
    }
    if (config.maxConcurrent === undefined) config.maxConcurrent = defaults.maxConcurrent;
    if (config.queueMode === undefined) config.queueMode = defaults.queueMode;
    if (config.delayBetween === undefined) config.delayBetween = defaults.delayBetween;
    if (config.timeout === undefined) config.timeout = defaults.timeout;
    if (config.stopOnError === undefined) config.stopOnError = defaults.stopOnError;
    if (config.headless === undefined) config.headless = defaults.headless;
  }

  // Resource recommendation state
  let recommendation = null;
  let loadingRecommendation = false;
  let systemLoad = null;

  async function sendCommand(action, data = {}) {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  }

  async function fetchRecommendation() {
    loadingRecommendation = true;
    try {
      const result = await sendCommand('getRecommendedConcurrency');
      if (result.success) {
        recommendation = result;
      }
    } catch (err) {
      console.error('Failed to fetch recommendation:', err);
    }
    loadingRecommendation = false;
  }

  async function fetchSystemLoad() {
    try {
      const result = await sendCommand('getSystemLoad');
      if (result.success) {
        systemLoad = result.load;
      }
    } catch (err) {
      console.error('Failed to fetch system load:', err);
    }
  }

  function applyRecommendation(type) {
    if (!recommendation) return;
    config.maxConcurrent = recommendation[type];
    handleChange();
  }

  const queueModes = [
    { value: 'fifo', label: 'FIFO', description: 'First In, First Out' },
    { value: 'lifo', label: 'LIFO', description: 'Last In, First Out' },
    { value: 'random', label: 'Random', description: 'Random order' },
    { value: 'priority', label: 'Priority', description: 'By priority level' }
  ];

  const retryStrategies = [
    { value: 'none', label: 'No Retry', description: 'Don\'t retry on failure' },
    { value: 'fixed', label: 'Fixed', description: 'Same delay each retry' },
    { value: 'linear', label: 'Linear', description: 'Increasing delay' },
    { value: 'exponential', label: 'Exponential', description: 'Exponentially increasing' }
  ];

  function handleChange() {
    onChange(config);
  }

  function formatDelay(ms) {
    if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 1000)}s`;
  }

  function getLoadColor(percent) {
    if (percent >= 80) return '#ef4444';
    if (percent >= 60) return '#f59e0b';
    return '#10b981';
  }

  onMount(() => {
    fetchRecommendation();
    fetchSystemLoad();
    // Refresh load every 10 seconds
    const interval = setInterval(fetchSystemLoad, 10000);
    return () => clearInterval(interval);
  });

  $: maxSlider = recommendation ? Math.max(recommendation.aggressive, 15) : 10;
</script>

<div class="parallel-config">
  <h3>Parallel Execution Settings</h3>

  <!-- System Resources Panel -->
  {#if recommendation || systemLoad}
    <div class="resource-panel">
      <div class="resource-header">
        <span class="resource-title">System Resources</span>
        <button class="btn-refresh" on:click={fetchRecommendation} disabled={loadingRecommendation}>
          {loadingRecommendation ? '...' : 'Refresh'}
        </button>
      </div>

      {#if recommendation}
        <div class="resource-info">
          <div class="resource-item">
            <span class="resource-label">CPU</span>
            <span class="resource-value">{recommendation.resources.cpu.cores} cores</span>
          </div>
          <div class="resource-item">
            <span class="resource-label">RAM</span>
            <span class="resource-value">{recommendation.resources.memory.freeGB} GB free</span>
          </div>
          {#if systemLoad}
            <div class="resource-item">
              <span class="resource-label">Load</span>
              <span class="resource-value" style="color: {getLoadColor(systemLoad.cpu.load1min)}">
                {systemLoad.cpu.load1min}% CPU, {systemLoad.memory.usagePercent}% RAM
              </span>
            </div>
          {/if}
        </div>

        <div class="recommendation-buttons">
          <button
            class="btn-rec safe"
            class:active={config.maxConcurrent === recommendation.safe}
            on:click={() => applyRecommendation('safe')}
          >
            <span class="btn-label">Safe</span>
            <span class="btn-value">{recommendation.safe}</span>
          </button>
          <button
            class="btn-rec recommended"
            class:active={config.maxConcurrent === recommendation.recommended}
            on:click={() => applyRecommendation('recommended')}
          >
            <span class="btn-label">Recommended</span>
            <span class="btn-value">{recommendation.recommended}</span>
          </button>
          <button
            class="btn-rec aggressive"
            class:active={config.maxConcurrent === recommendation.aggressive}
            on:click={() => applyRecommendation('aggressive')}
          >
            <span class="btn-label">Max</span>
            <span class="btn-value">{recommendation.aggressive}</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Concurrency -->
  <div class="config-section">
    <label>
      <span class="label-text">Max Concurrent Profiles</span>
      <span class="label-value">{config.maxConcurrent}</span>
    </label>
    <input
      type="range"
      min="1"
      max={maxSlider}
      bind:value={config.maxConcurrent}
      on:change={handleChange}
    />
    <div class="range-labels">
      <span>1</span>
      <span>{maxSlider}</span>
    </div>
  </div>

  <!-- Queue Mode -->
  <div class="config-section">
    <label class="label-text">Queue Mode</label>
    <div class="radio-group">
      {#each queueModes as mode}
        <label class="radio-item" class:selected={config.queueMode === mode.value}>
          <input
            type="radio"
            name="queueMode"
            value={mode.value}
            bind:group={config.queueMode}
            on:change={handleChange}
          />
          <span class="radio-label">{mode.label}</span>
          <span class="radio-desc">{mode.description}</span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Delay Between Starts -->
  <div class="config-section">
    <label>
      <span class="label-text">Delay Between Starts</span>
      <span class="label-value">{formatDelay(config.delayBetween)}</span>
    </label>
    <input
      type="range"
      min="0"
      max="10000"
      step="500"
      bind:value={config.delayBetween}
      on:change={handleChange}
    />
    <div class="range-labels">
      <span>0s</span>
      <span>10s</span>
    </div>
  </div>

  <!-- Timeout -->
  <div class="config-section">
    <label>
      <span class="label-text">Profile Timeout</span>
      <span class="label-value">{formatDelay(config.timeout)}</span>
    </label>
    <input
      type="range"
      min="60000"
      max="600000"
      step="30000"
      bind:value={config.timeout}
      on:change={handleChange}
    />
    <div class="range-labels">
      <span>1m</span>
      <span>10m</span>
    </div>
  </div>

  <!-- Stop on Error -->
  <div class="config-section">
    <label class="checkbox-row">
      <input
        type="checkbox"
        bind:checked={config.stopOnError}
        on:change={handleChange}
      />
      <span>Stop All on First Error</span>
    </label>
  </div>

  <!-- Performance Settings -->
  <div class="config-section">
    <h4>Performance Settings</h4>

    <!-- Headless Mode -->
    <div class="performance-option">
      <label class="checkbox-row">
        <input
          type="checkbox"
          bind:checked={config.headless}
          on:change={handleChange}
        />
        <span class="option-label">Headless Mode</span>
        <span class="option-badge fast">Fast</span>
      </label>
      <p class="option-desc">Run browser without UI. Best for: data scraping, form filling, scheduled tasks.</p>
    </div>

    <!-- Resource Blocking -->
    <div class="blocking-section">
      <label class="label-text">Block Resources (faster loading)</label>
      <div class="blocking-grid">
        <label class="blocking-item" class:active={config.blocking?.images}>
          <input
            type="checkbox"
            bind:checked={config.blocking.images}
            on:change={handleChange}
          />
          <span class="blocking-icon">🖼️</span>
          <span class="blocking-label">Images</span>
          <span class="blocking-save">-50%</span>
        </label>

        <label class="blocking-item" class:active={config.blocking?.media}>
          <input
            type="checkbox"
            bind:checked={config.blocking.media}
            on:change={handleChange}
          />
          <span class="blocking-icon">🎬</span>
          <span class="blocking-label">Videos</span>
          <span class="blocking-save">-80%</span>
        </label>

        <label class="blocking-item" class:active={config.blocking?.fonts}>
          <input
            type="checkbox"
            bind:checked={config.blocking.fonts}
            on:change={handleChange}
          />
          <span class="blocking-icon">🔤</span>
          <span class="blocking-label">Fonts</span>
          <span class="blocking-save">-15%</span>
        </label>

        <label class="blocking-item" class:active={config.blocking?.css}>
          <input
            type="checkbox"
            bind:checked={config.blocking.css}
            on:change={handleChange}
          />
          <span class="blocking-icon">🎨</span>
          <span class="blocking-label">CSS</span>
          <span class="blocking-save">-20%</span>
        </label>

        <label class="blocking-item" class:active={config.blocking?.trackers}>
          <input
            type="checkbox"
            bind:checked={config.blocking.trackers}
            on:change={handleChange}
          />
          <span class="blocking-icon">🚫</span>
          <span class="blocking-label">Trackers</span>
          <span class="blocking-save">2x faster</span>
        </label>
      </div>
      <p class="blocking-hint">
        Tip: For scraping, enable all. For login/interaction, only block trackers.
      </p>
    </div>

    <!-- Presets -->
    <div class="performance-presets">
      <span class="preset-label">Quick presets:</span>
      <button class="btn-preset" on:click={() => { config.headless = false; config.blocking = { images: false, media: false, fonts: false, css: false, trackers: false }; handleChange(); }}>
        🖥️ Normal
      </button>
      <button class="btn-preset" on:click={() => { config.headless = true; config.blocking = { images: false, media: false, fonts: false, css: false, trackers: true }; handleChange(); }}>
        ⚡ Fast
      </button>
      <button class="btn-preset" on:click={() => { config.headless = true; config.blocking = { images: true, media: true, fonts: true, css: false, trackers: true }; handleChange(); }}>
        🚀 Max Speed
      </button>
    </div>
  </div>

  <!-- Retry Settings -->
  <div class="config-section">
    <h4>Retry Settings</h4>

    <label class="label-text">Retry Strategy</label>
    <div class="radio-group horizontal">
      {#each retryStrategies as strategy}
        <label class="radio-item compact" class:selected={config.retry.strategy === strategy.value}>
          <input
            type="radio"
            name="retryStrategy"
            value={strategy.value}
            bind:group={config.retry.strategy}
            on:change={handleChange}
          />
          <span class="radio-label">{strategy.label}</span>
        </label>
      {/each}
    </div>

    {#if config.retry.strategy !== 'none'}
      <div class="retry-options">
        <div class="option-row">
          <label>
            <span>Max Retries</span>
            <input
              type="number"
              min="1"
              max="10"
              bind:value={config.retry.maxRetries}
              on:change={handleChange}
            />
          </label>
        </div>
        <div class="option-row">
          <label>
            <span>Base Delay</span>
            <select bind:value={config.retry.baseDelay} on:change={handleChange}>
              <option value={500}>500ms</option>
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
            </select>
          </label>
        </div>
        <div class="option-row">
          <label>
            <span>Max Delay</span>
            <select bind:value={config.retry.maxDelay} on:change={handleChange}>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
              <option value={120000}>2m</option>
              <option value={300000}>5m</option>
            </select>
          </label>
        </div>
      </div>

      <!-- Preview -->
      <div class="retry-preview">
        <span class="preview-label">Retry delays:</span>
        <span class="preview-values">
          {#each Array(config.retry.maxRetries) as _, i}
            {#if config.retry.strategy === 'fixed'}
              {formatDelay(Math.min(config.retry.baseDelay, config.retry.maxDelay))}
            {:else if config.retry.strategy === 'linear'}
              {formatDelay(Math.min(config.retry.baseDelay * (i + 1), config.retry.maxDelay))}
            {:else}
              {formatDelay(Math.min(config.retry.baseDelay * Math.pow(2, i), config.retry.maxDelay))}
            {/if}
            {#if i < config.retry.maxRetries - 1},{/if}
          {/each}
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  .parallel-config {
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    padding: 16px;
  }

  .parallel-config h3 {
    font-size: 15px;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .parallel-config h4 {
    font-size: 13px;
    margin: 12px 0 8px;
    color: var(--text-secondary, #a0a0b0);
  }

  /* Resource Panel */
  .resource-panel {
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .resource-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #a0a0b0);
  }

  .btn-refresh {
    padding: 4px 8px;
    font-size: 11px;
    background: transparent;
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 4px;
    color: var(--text-secondary, #a0a0b0);
    cursor: pointer;
  }

  .btn-refresh:hover {
    background: var(--bg-secondary, #1a1a2e);
  }

  .resource-info {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .resource-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .resource-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-secondary, #a0a0b0);
  }

  .resource-value {
    font-size: 13px;
    font-weight: 500;
  }

  .recommendation-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .btn-rec {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 8px;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-rec.safe {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .btn-rec.safe:hover, .btn-rec.safe.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
  }

  .btn-rec.recommended {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .btn-rec.recommended:hover, .btn-rec.recommended.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
  }

  .btn-rec.aggressive {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .btn-rec.aggressive:hover, .btn-rec.aggressive.active {
    background: rgba(245, 158, 11, 0.2);
    border-color: #f59e0b;
  }

  .btn-label {
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  .btn-value {
    font-size: 18px;
    font-weight: 700;
  }

  .btn-rec.safe .btn-value { color: #10b981; }
  .btn-rec.recommended .btn-value { color: #6366f1; }
  .btn-rec.aggressive .btn-value { color: #f59e0b; }

  .config-section {
    margin-bottom: 16px;
  }

  .config-section label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .label-text {
    font-size: 13px;
    color: var(--text-secondary, #a0a0b0);
  }

  .label-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-color, #6366f1);
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 3px;
    outline: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--accent-color, #6366f1);
    border-radius: 50%;
    cursor: pointer;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  .radio-group {
    display: grid;
    gap: 8px;
  }

  .radio-group.horizontal {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  }

  .radio-item {
    display: flex;
    flex-direction: column;
    padding: 10px;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 6px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.2s;
  }

  .radio-item.selected {
    border-color: var(--accent-color, #6366f1);
  }

  .radio-item.compact {
    padding: 8px;
    text-align: center;
  }

  .radio-item input {
    display: none;
  }

  .radio-label {
    font-size: 13px;
    font-weight: 500;
  }

  .radio-desc {
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
    margin-top: 2px;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
  }

  .checkbox-row input {
    width: 16px;
    height: 16px;
  }

  .retry-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  .option-row label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-row span {
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  .option-row input,
  .option-row select {
    padding: 6px 8px;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 4px;
    color: inherit;
    font-size: 13px;
  }

  .option-row input[type="number"] {
    width: 60px;
  }

  .retry-preview {
    margin-top: 12px;
    padding: 8px;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 4px;
    font-size: 12px;
  }

  .preview-label {
    color: var(--text-secondary, #a0a0b0);
    margin-right: 8px;
  }

  .preview-values {
    color: var(--accent-color, #6366f1);
  }

  /* Performance Settings */
  .performance-option {
    margin-bottom: 16px;
  }

  .performance-option .checkbox-row {
    margin-bottom: 4px;
  }

  .option-label {
    font-weight: 500;
  }

  .option-badge {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .option-badge.fast {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .option-desc {
    margin: 0;
    padding-left: 24px;
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
  }

  .blocking-section {
    margin-top: 12px;
  }

  .blocking-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
    margin-top: 8px;
  }

  .blocking-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    background: var(--bg-tertiary, #2d2d44);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .blocking-item:hover {
    border-color: var(--border-color, #3d3d54);
  }

  .blocking-item.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-color, #6366f1);
  }

  .blocking-item input {
    display: none;
  }

  .blocking-icon {
    font-size: 18px;
  }

  .blocking-label {
    font-size: 11px;
    font-weight: 500;
  }

  .blocking-save {
    font-size: 9px;
    color: #10b981;
    font-weight: 600;
  }

  .blocking-hint {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-secondary, #a0a0b0);
    font-style: italic;
  }

  .performance-presets {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #2d2d44);
  }

  .preset-label {
    font-size: 12px;
    color: var(--text-secondary, #a0a0b0);
  }

  .btn-preset {
    padding: 6px 12px;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-preset:hover {
    background: var(--border-color, #3d3d54);
    border-color: var(--accent-color, #6366f1);
  }
</style>
