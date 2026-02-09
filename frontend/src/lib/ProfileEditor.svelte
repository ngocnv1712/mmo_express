<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { createNewProfile, updateProfile, getProxies, getPresetList, getPreset } from './api.js';

  export let profile = null;

  const dispatch = createEventDispatcher();

  let activeTab = 'overview';
  let saving = false;
  let proxies = [];

  // Presets
  let presets = [];
  let selectedPreset = 'random';

  // Form data
  let form = profile ? { ...profile } : {
    name: '',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'windows',
    platform: 'Win32',
    userAgent: '',
    viewportWidth: 1920,
    viewportHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1.0,
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    language: 'vi-VN,vi,en-US,en',
    cpuCores: 8,
    deviceMemory: 16,
    maxTouchPoints: 0,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    canvasNoise: 0.025,
    audioNoise: 0.0005,
    webrtcMode: 'replace',
    geoMode: 'query',
    proxyId: '',
    notes: ''
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'network', label: 'Network' },
    { id: 'advanced', label: 'Advanced' }
  ];

  const osOptions = [
    { id: 'windows', label: 'Windows', icon: '🪟' },
    { id: 'macos', label: 'MacOS', icon: '🍎' },
    { id: 'linux', label: 'Linux', icon: '🐧' },
    { id: 'android', label: 'Android', icon: '🤖' },
    { id: 'ios', label: 'iOS', icon: '📱' }
  ];

  const browserVersions = {
    chrome: ['120', '121', '122', '123', '124', '125'],
    firefox: ['121', '122', '123', '124', '125'],
    edge: ['120', '121', '122', '123', '124'],
    safari: ['17.2', '17.1', '17.0', '16.6']
  };

  const browserTypesByOS = {
    windows: ['chrome', 'firefox', 'edge'],
    macos: ['chrome', 'firefox', 'safari', 'edge'],
    linux: ['chrome', 'firefox'],
    android: ['chrome'],
    ios: ['safari', 'chrome']
  };

  const platforms = {
    windows: 'Win32',
    macos: 'MacIntel',
    linux: 'Linux x86_64',
    android: 'Linux armv8l',
    ios: 'iPhone'
  };

  const webglPresets = {
    windows: [
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)', label: 'RTX 4090' },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)', label: 'RTX 3080' },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', label: 'RX 6800 XT' },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)', label: 'Intel UHD 770' }
    ],
    macos: [
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M3 Max, OpenGL 4.1)', label: 'M3 Max' },
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)', label: 'M2 Pro' },
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)', label: 'M1' }
    ],
    linux: [
      { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'NVIDIA GeForce RTX 4090/PCIe/SSE2', label: 'RTX 4090' },
      { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'NVIDIA GeForce RTX 3080/PCIe/SSE2', label: 'RTX 3080' }
    ],
    android: [
      { vendor: 'Qualcomm', renderer: 'Adreno (TM) 740', label: 'Adreno 740' },
      { vendor: 'ARM', renderer: 'Mali-G720 MC12', label: 'Mali-G720' }
    ],
    ios: [
      { vendor: 'Apple Inc.', renderer: 'Apple GPU', label: 'Apple GPU' }
    ]
  };

  const resolutionPresets = {
    windows: ['1920x1080', '2560x1440', '1366x768', '3840x2160'],
    macos: ['1440x900', '2560x1440', '2880x1800'],
    linux: ['1920x1080', '2560x1440', '1366x768'],
    android: ['412x915', '393x873', '360x800'],
    ios: ['390x844', '393x852', '430x932']
  };

  $: availableBrowsers = browserTypesByOS[form.os] || browserTypesByOS.windows;
  $: availableWebGL = webglPresets[form.os] || webglPresets.windows;
  $: availableResolutions = resolutionPresets[form.os] || resolutionPresets.windows;

  onMount(async () => {
    try {
      proxies = await getProxies() || [];
      presets = getPresetList() || [];
    } catch (e) {
      console.error('Failed to load proxies:', e);
    }

    if (!profile) {
      generateRandomFingerprint();
    }
  });

  // Apply preset to form
  function applyPreset(presetId) {
    if (presetId === 'random') {
      generateRandomFingerprint();
    } else {
      try {
        const preset = getPreset(presetId);
        if (preset) {
          // Apply all preset values to form
          form.name = preset.name || '';
          form.browserType = preset.browserType || 'chrome';
          form.browserVersion = preset.browserVersion || '120';
          form.os = preset.os || 'windows';
          form.platform = preset.platform || 'Win32';
          form.userAgent = preset.userAgent || '';
          form.viewportWidth = preset.viewportWidth || 1920;
          form.viewportHeight = preset.viewportHeight || 1080;
          form.screenWidth = preset.screenWidth || 1920;
          form.screenHeight = preset.screenHeight || 1080;
          form.colorDepth = preset.colorDepth || 24;
          form.pixelRatio = preset.pixelRatio || 1;
          form.timezone = preset.timezone || 'Asia/Ho_Chi_Minh';
          form.locale = preset.locale || 'vi-VN';
          form.language = preset.language || 'vi-VN,vi,en-US,en';
          form.cpuCores = preset.cpuCores || 8;
          form.deviceMemory = preset.deviceMemory || 8;
          form.maxTouchPoints = preset.maxTouchPoints || 0;
          form.webglVendor = preset.webglVendor || '';
          form.webglRenderer = preset.webglRenderer || '';
          form.canvasNoise = preset.canvasNoise || 0.025;
          form.audioNoise = preset.audioNoise || 0.0005;
          form.webrtcMode = preset.webrtcMode || 'replace';
          form.geoMode = preset.geoMode || 'query';
        }
      } catch (e) {
        console.error('Failed to load preset:', e);
      }
    }
  }

  // When preset selection changes
  function onPresetChange() {
    applyPreset(selectedPreset);
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateUserAgent(os, browser, version) {
    const templates = {
      windows: {
        chrome: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
        firefox: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`,
        edge: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`
      },
      macos: {
        chrome: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
        safari: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`,
        firefox: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`
      },
      linux: {
        chrome: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
        firefox: `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`
      },
      android: {
        chrome: `Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Mobile Safari/537.36`
      },
      ios: {
        safari: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Mobile/15E148 Safari/604.1`
      }
    };
    return templates[os]?.[browser] || templates.windows.chrome;
  }

  function generateRandomFingerprint() {
    const os = form.os;
    const browser = form.browserType;
    const version = form.browserVersion;

    form.userAgent = generateUserAgent(os, browser, version);
    form.platform = platforms[os] || 'Win32';

    // Random WebGL
    const webglList = webglPresets[os] || webglPresets.windows;
    const webgl = randomItem(webglList);
    form.webglVendor = webgl.vendor;
    form.webglRenderer = webgl.renderer;

    // Random screen
    const resStr = randomItem(resolutionPresets[os] || resolutionPresets.windows);
    const [w, h] = resStr.split('x').map(Number);
    form.viewportWidth = w;
    form.viewportHeight = h;
    form.screenWidth = w;
    form.screenHeight = h;

    // Random hardware
    const cores = os === 'android' || os === 'ios' ? [4, 8] : [4, 6, 8, 12, 16];
    const memory = os === 'android' || os === 'ios' ? [4, 6, 8] : [8, 16, 32];
    form.cpuCores = randomItem(cores);
    form.deviceMemory = randomItem(memory);
    form.maxTouchPoints = (os === 'android' || os === 'ios') ? randomItem([5, 10]) : 0;
    form.pixelRatio = (os === 'android' || os === 'ios') ? randomItem([2, 3]) : randomItem([1, 1.25, 2]);

    // Random noise
    form.canvasNoise = parseFloat((0.02 + Math.random() * 0.01).toFixed(4));
    form.audioNoise = parseFloat((0.0001 + Math.random() * 0.0009).toFixed(6));
  }

  function selectOS(os) {
    form.os = os;
    const available = browserTypesByOS[os] || browserTypesByOS.windows;
    if (!available.includes(form.browserType)) {
      form.browserType = available[0];
    }
    generateRandomFingerprint();
  }

  function applyResolution(resStr) {
    const [w, h] = resStr.split('x').map(Number);
    form.viewportWidth = w;
    form.viewportHeight = h;
    form.screenWidth = w;
    form.screenHeight = h;
  }

  function applyWebGL(preset) {
    form.webglVendor = preset.vendor;
    form.webglRenderer = preset.renderer;
  }

  async function save() {
    saving = true;
    try {
      if (profile?.id) {
        form.id = profile.id;
        await updateProfile(form);
      } else {
        await createNewProfile(form);
      }
      dispatch('save');
    } catch (e) {
      console.error('Failed to save profile:', e);
      alert('Failed to save profile: ' + e);
    }
    saving = false;
  }

  function cancel() {
    dispatch('close');
  }
</script>

<div class="page">
  <div class="page-header">
    <button class="back-btn" on:click={cancel}>
      <span>← Back</span>
    </button>
    <h2>{profile ? 'Edit Profile' : 'Create New Profile'}</h2>
    <div class="header-actions">
      <button type="button" class="btn" on:click={cancel}>Cancel</button>
      <button type="button" class="btn primary" on:click={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  </div>

  <div class="tabs">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        on:click={() => activeTab = tab.id}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="tab-content">
    {#if activeTab === 'overview'}
      {#if !profile}
        <div class="section">
          <h3>Quick Start - Select a Preset</h3>
          <div class="preset-selector">
            <label class="preset-option" class:selected={selectedPreset === 'random'}>
              <input type="radio" bind:group={selectedPreset} value="random" on:change={onPresetChange} />
              <div class="preset-content">
                <span class="preset-icon">🎲</span>
                <div class="preset-info">
                  <span class="preset-name">Random</span>
                  <span class="preset-desc">Auto-generate random fingerprint</span>
                </div>
              </div>
            </label>
            {#each presets as preset}
              <label class="preset-option" class:selected={selectedPreset === preset.id}>
                <input type="radio" bind:group={selectedPreset} value={preset.id} on:change={onPresetChange} />
                <div class="preset-content">
                  <span class="preset-icon">
                    {#if preset.os === 'windows'}🪟
                    {:else if preset.os === 'macos'}🍎
                    {:else if preset.os === 'linux'}🐧
                    {:else if preset.os === 'android'}🤖
                    {:else if preset.os === 'ios'}📱
                    {:else}💻
                    {/if}
                  </span>
                  <div class="preset-info">
                    <span class="preset-name">{preset.name}</span>
                    <span class="preset-desc">{preset.os} - {preset.browserType}</span>
                  </div>
                </div>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <div class="section">
        <h3>Profile Name</h3>
        <input type="text" bind:value={form.name} placeholder="Enter profile name..." />
      </div>

      <div class="section">
        <h3>Operating System</h3>
        <div class="os-grid">
          {#each osOptions as os}
            <button
              type="button"
              class="os-btn"
              class:active={form.os === os.id}
              on:click={() => selectOS(os.id)}
            >
              <span class="os-icon">{os.icon}</span>
              <span class="os-label">{os.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="section">
        <h3>Browser</h3>
        <div class="row">
          <div class="form-group">
            <label>Type</label>
            <select bind:value={form.browserType} on:change={generateRandomFingerprint}>
              {#each availableBrowsers as bt}
                <option value={bt}>{bt.charAt(0).toUpperCase() + bt.slice(1)}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label>Version</label>
            <select bind:value={form.browserVersion} on:change={generateRandomFingerprint}>
              {#each (browserVersions[form.browserType] || browserVersions.chrome) as ver}
                <option value={ver}>{ver}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>User Agent</h3>
        <textarea bind:value={form.userAgent} rows="3"></textarea>
        <button type="button" class="btn small" on:click={generateRandomFingerprint}>
          🎲 Regenerate
        </button>
      </div>

      <div class="section">
        <h3>Screen Resolution</h3>
        <div class="preset-row">
          {#each availableResolutions as res}
            <button
              type="button"
              class="preset-btn"
              class:active={`${form.viewportWidth}x${form.viewportHeight}` === res}
              on:click={() => applyResolution(res)}
            >
              {res}
            </button>
          {/each}
        </div>
        <div class="row">
          <div class="form-group">
            <label>Width</label>
            <input type="number" bind:value={form.viewportWidth} />
          </div>
          <div class="form-group">
            <label>Height</label>
            <input type="number" bind:value={form.viewportHeight} />
          </div>
        </div>
      </div>

    {:else if activeTab === 'network'}
      <div class="section">
        <h3>Proxy</h3>
        <select bind:value={form.proxyId}>
          <option value="">No Proxy</option>
          {#each proxies as proxy}
            <option value={proxy.id}>{proxy.name} ({proxy.host}:{proxy.port})</option>
          {/each}
        </select>
      </div>

      <div class="section">
        <h3>WebRTC</h3>
        <select bind:value={form.webrtcMode}>
          <option value="replace">Replace (Use Proxy IP)</option>
          <option value="disable">Disable</option>
          <option value="real">Real</option>
        </select>
      </div>

      <div class="section">
        <h3>Geolocation</h3>
        <select bind:value={form.geoMode}>
          <option value="query">Ask Permission</option>
          <option value="allow">Allow</option>
          <option value="block">Block</option>
        </select>
      </div>

    {:else if activeTab === 'advanced'}
      <div class="section">
        <h3>Hardware</h3>
        <div class="row">
          <div class="form-group">
            <label>CPU Cores</label>
            <input type="number" bind:value={form.cpuCores} min="1" max="64" />
          </div>
          <div class="form-group">
            <label>Memory (GB)</label>
            <input type="number" bind:value={form.deviceMemory} min="1" max="128" />
          </div>
          <div class="form-group">
            <label>Pixel Ratio</label>
            <input type="number" bind:value={form.pixelRatio} min="1" max="4" step="0.25" />
          </div>
        </div>
      </div>

      <div class="section">
        <h3>WebGL</h3>
        <div class="preset-row">
          {#each availableWebGL as preset}
            <button
              type="button"
              class="preset-btn"
              on:click={() => applyWebGL(preset)}
            >
              {preset.label}
            </button>
          {/each}
        </div>
        <div class="form-group">
          <label>Vendor</label>
          <input type="text" bind:value={form.webglVendor} />
        </div>
        <div class="form-group">
          <label>Renderer</label>
          <input type="text" bind:value={form.webglRenderer} />
        </div>
      </div>

      <div class="section">
        <h3>Fingerprint Noise</h3>
        <div class="row">
          <div class="form-group">
            <label>Canvas Noise</label>
            <input type="number" bind:value={form.canvasNoise} step="0.001" min="0" max="0.1" />
          </div>
          <div class="form-group">
            <label>Audio Noise</label>
            <input type="number" bind:value={form.audioNoise} step="0.0001" min="0" max="0.01" />
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Notes</h3>
        <textarea bind:value={form.notes} rows="4" placeholder="Add notes..."></textarea>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #1a1a2e;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
  }

  .back-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.5rem;
  }

  .back-btn:hover {
    color: #fff;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: 1.25rem;
    color: #e94560;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    background: #0f3460;
    border: 1px solid #0f3460;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover {
    background: #1a4a7a;
  }

  .btn.primary {
    background: #e94560;
    border-color: #e94560;
  }

  .btn.primary:hover {
    background: #d63850;
  }

  .btn.small {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tabs {
    display: flex;
    gap: 0;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    padding: 0 1.5rem;
  }

  .tab {
    background: transparent;
    border: none;
    color: #888;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab:hover {
    color: #fff;
  }

  .tab.active {
    color: #e94560;
    border-bottom-color: #e94560;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .section {
    margin-bottom: 1.5rem;
  }

  .section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .row {
    display: flex;
    gap: 1rem;
  }

  .form-group {
    flex: 1;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  input, select, textarea {
    width: 100%;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #fff;
    padding: 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #e94560;
  }

  textarea {
    resize: vertical;
    font-family: monospace;
    font-size: 0.85rem;
  }

  .os-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .os-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 80px;
  }

  .os-btn:hover {
    border-color: #e94560;
  }

  .os-btn.active {
    border-color: #e94560;
    background: #1a2a4e;
  }

  .os-icon {
    font-size: 1.5rem;
  }

  .os-label {
    font-size: 0.8rem;
    color: #ccc;
  }

  .preset-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .preset-btn {
    padding: 0.4rem 0.75rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    border-color: #e94560;
    color: #fff;
  }

  .preset-btn.active {
    background: #e94560;
    border-color: #e94560;
    color: #fff;
  }

  /* Preset Selector */
  .preset-selector {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
    max-height: 250px;
    overflow-y: auto;
    padding: 0.25rem;
  }

  .preset-option {
    display: flex;
    cursor: pointer;
    border: 2px solid #1a4a7a;
    border-radius: 8px;
    padding: 0.75rem;
    background: #0f3460;
    transition: all 0.2s;
  }

  .preset-option:hover {
    border-color: #e94560;
  }

  .preset-option.selected {
    border-color: #e94560;
    background: #1a2a4e;
  }

  .preset-option input {
    display: none;
  }

  .preset-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .preset-icon {
    font-size: 1.5rem;
  }

  .preset-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .preset-name {
    font-weight: 500;
    font-size: 0.85rem;
    color: #fff;
  }

  .preset-desc {
    font-size: 0.7rem;
    color: #888;
  }
</style>
