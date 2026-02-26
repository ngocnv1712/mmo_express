<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { createNewProfile, updateProfile, getProxies, getPresetList, getPreset, listExtensions, getPlatforms, getProfileResources, createResource, updateResource, deleteResource, getSystemInfo } from './api.js';
  import { showAlert } from './stores/dialog.js';

  export let profile = null;

  const dispatch = createEventDispatcher();

  let activeTab = 'overview';
  let saving = false;
  let proxies = [];
  let extensions = [];

  // Actual OS for consistent fingerprinting
  let actualOS = 'linux'; // Default, will be updated from sidecar
  let systemInfo = null;

  // Presets
  let presets = [];
  let selectedPreset = 'random';

  // Form data
  // Default values for new profiles
  // Note: os will be overridden by actualOS from sidecar for consistency
  const defaultForm = {
    name: '',
    browserType: 'chrome',
    browserVersion: '120',
    os: 'linux', // Will be updated to actualOS on mount
    platform: 'Linux x86_64',
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
    blockCanvas: false,
    blockAudioContext: false,
    colorDepth: 24,
    webrtcMode: 'replace',
    mediaDevicesMode: 'real',
    doNotTrack: false,
    // Battery API
    batteryLevel: 0.85,
    batteryCharging: true,
    // Connection API
    connectionType: 'wifi',
    connectionRtt: 50,
    connectionDownlink: 10,
    geoMode: 'query',
    geoLatitude: 0,
    geoLongitude: 0,
    geoAccuracy: 100,
    timezoneMode: 'auto',
    localeMode: 'auto',
    proxyId: '',
    extensionIds: [],
    platformTags: [],
    notes: '',
    bookmarks: ''
  };

  // Merge profile with defaults to ensure all fields exist
  let form = profile ? { ...defaultForm, ...profile, platformTags: profile.platformTags || [], extensionIds: profile.extensionIds || [] } : { ...defaultForm };

  // Quick tags for platform selection
  const quickTags = ['facebook', 'tiktok', 'google', 'instagram', 'twitter', 'youtube', 'shopee', 'lazada', 'telegram', 'zalo'];
  let newTag = '';

  // Tabs - reorganized for better UX
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'network', label: 'Network' },
    { id: 'device', label: 'Device' },
    { id: 'fingerprint', label: 'Fingerprint' },
    { id: 'storage', label: 'Storage' },
    { id: 'resources', label: 'Resources' }
  ];

  // Dynamic check for extensions support
  $: supportsExtensions = ['chrome', 'chromium', 'edge'].includes(form.browserType);

  // Proxy modes
  let proxyMode = 'none'; // none, select, manual
  let proxyString = '';
  let proxyName = '';
  let proxyType = 'http';
  let selectedProxyId = '';
  let proxyCheckResult = null;
  let savingProxy = false;

  // Cookie
  let cookieInput = '';

  // Resources state
  let resourcePlatforms = [];
  let resources = [];
  let showResourceForm = false;
  let editingResource = null;
  let resourceForm = {
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
      facebook: '🔵',
      zalo: '💬',
      tiktok: '🎵',
      gmail: '📧',
      shopee: '🛒',
      telegram: '✈️',
      instagram: '📷',
      twitter: '🐦',
      youtube: '📺',
      linkedin: '💼'
    };
    return icons[platform] || '🌐';
  }

  function getPlatformInfo(platformId) {
    return resourcePlatforms.find(p => p.id === platformId);
  }

  function hasResourceField(platformId, field) {
    const platform = getPlatformInfo(platformId);
    return platform?.fields?.includes(field) || false;
  }

  function resetResourceForm() {
    resourceForm = {
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

  function startAddResource(platformId) {
    resetResourceForm();
    resourceForm.platform = platformId;
    editingResource = null;
    showResourceForm = true;
  }

  function startEditResource(resource) {
    resourceForm = {
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
    showResourceForm = true;
  }

  function cancelResourceForm() {
    showResourceForm = false;
    editingResource = null;
    resetResourceForm();
  }

  async function loadResources() {
    if (profile?.id) {
      resourcePlatforms = getPlatforms() || [];
      resources = await getProfileResources(profile.id) || [];
    }
  }

  async function saveResourceItem() {
    if (!profile?.id) return;

    const data = {
      profileId: profile.id,
      platform: resourceForm.platform,
      name: resourceForm.name || resourceForm.email || resourceForm.username || resourceForm.phone || '',
      username: resourceForm.username,
      email: resourceForm.email,
      phone: resourceForm.phone,
      password: resourceForm.password,
      twofa: resourceForm.twofa,
      recoveryEmail: resourceForm.recoveryEmail,
      token: resourceForm.token,
      session: resourceForm.session,
      autoLogin: resourceForm.autoLogin
    };

    try {
      if (editingResource) {
        data.id = editingResource.id;
        data.status = editingResource.status;
        await updateResource(data);
      } else {
        await createResource(data);
      }
      await loadResources();
      cancelResourceForm();
    } catch (e) {
      console.error('Failed to save resource:', e);
    }
  }

  async function handleDeleteResource(id) {
    const confirmed = await showConfirm('Delete this resource?', {
      title: 'Delete Resource',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      await deleteResource(id);
      await loadResources();
    } catch (e) {
      console.error('Failed to delete resource:', e);
    }
  }

  // Timezone & Locale modes
  let timezoneMode = 'auto';
  let localeMode = 'auto';

  const timezones = [
    'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
    'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Manila', 'Asia/Jakarta',
    'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Australia/Sydney', 'Australia/Melbourne'
  ];

  const locales = [
    'vi-VN', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'th-TH', 'id-ID', 'ms-MY'
  ];

  const webrtcModes = [
    { value: 'replace', label: 'Replace', description: 'Replace with proxy IP' },
    { value: 'disable', label: 'Disable', description: 'Disable WebRTC completely' },
    { value: 'real', label: 'Real', description: 'Use real IP' }
  ];

  const geoModes = [
    { value: 'query', label: 'Ask', description: 'Ask user permission' },
    { value: 'allow', label: 'Allow', description: 'Allow with custom location' },
    { value: 'block', label: 'Block', description: 'Block location requests' }
  ];

  // Screen, Hardware, Canvas, Audio modes
  let screenMode = 'custom';
  let hardwareMode = 'custom';
  let canvasMode = 'noise';
  let audioMode = 'noise';
  let webglMode = 'noise';

  // Realistic common PC configurations
  const commonPCConfigs = {
    windows: [
      { name: 'Office PC', cpu: 4, memory: 8, screen: '1920x1080', gpu: 'Intel UHD 630' },
      { name: 'Home PC', cpu: 6, memory: 16, screen: '1920x1080', gpu: 'GTX 1650' },
      { name: 'Gaming PC', cpu: 8, memory: 16, screen: '2560x1440', gpu: 'RTX 3060' },
      { name: 'Workstation', cpu: 12, memory: 32, screen: '2560x1440', gpu: 'RTX 3080' },
      { name: 'Laptop Basic', cpu: 4, memory: 8, screen: '1366x768', gpu: 'Intel UHD' },
      { name: 'Laptop Pro', cpu: 8, memory: 16, screen: '1920x1080', gpu: 'RTX 3050' },
    ],
    macos: [
      { name: 'MacBook Air M1', cpu: 8, memory: 8, screen: '2560x1600', gpu: 'Apple M1' },
      { name: 'MacBook Pro 14"', cpu: 10, memory: 16, screen: '3024x1964', gpu: 'Apple M2 Pro' },
      { name: 'MacBook Pro 16"', cpu: 12, memory: 32, screen: '3456x2234', gpu: 'Apple M2 Max' },
      { name: 'iMac 24"', cpu: 8, memory: 16, screen: '4480x2520', gpu: 'Apple M3' },
    ],
    linux: [
      { name: 'Developer PC', cpu: 8, memory: 16, screen: '1920x1080', gpu: 'GTX 1660' },
      { name: 'Server Workstation', cpu: 16, memory: 32, screen: '2560x1440', gpu: 'RTX 3070' },
    ],
    android: [
      { name: 'Samsung Galaxy S23', cpu: 8, memory: 8, screen: '1080x2340', gpu: 'Adreno 740' },
      { name: 'Xiaomi 13', cpu: 8, memory: 12, screen: '1080x2400', gpu: 'Adreno 730' },
      { name: 'Budget Phone', cpu: 8, memory: 4, screen: '720x1600', gpu: 'Mali-G57' },
    ],
    ios: [
      { name: 'iPhone 15 Pro', cpu: 6, memory: 8, screen: '1179x2556', gpu: 'Apple GPU' },
      { name: 'iPhone 14', cpu: 6, memory: 6, screen: '1170x2532', gpu: 'Apple GPU' },
      { name: 'iPad Pro 12.9"', cpu: 8, memory: 16, screen: '2048x2732', gpu: 'Apple GPU' },
    ]
  };

  // Get current OS configs
  $: currentOSConfigs = commonPCConfigs[form.os] || commonPCConfigs.windows;

  // Selected PC config name
  let selectedPCConfig = '';

  // Apply a common PC config
  function applyPCConfig(config) {
    selectedPCConfig = config.name;

    // Parse screen resolution
    const [w, h] = config.screen.split('x').map(Number);
    form.viewportWidth = w;
    form.viewportHeight = h;
    form.screenWidth = w;
    form.screenHeight = h;

    // Set hardware
    form.cpuCores = config.cpu;
    form.deviceMemory = config.memory;

    // Set touch points based on OS
    if (form.os === 'android' || form.os === 'ios') {
      form.maxTouchPoints = 10;
      form.pixelRatio = 3;
    } else {
      form.maxTouchPoints = 0;
      form.pixelRatio = 1;
    }

    // Set WebGL based on GPU name
    const gpuToWebGL = {
      // Windows
      'Intel UHD 630': { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'Intel UHD': { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'GTX 1650': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'GTX 1660': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'RTX 3050': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'RTX 3060': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'RTX 3070': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      'RTX 3080': { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      // Mac
      'Apple M1': { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)' },
      'Apple M2 Pro': { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)' },
      'Apple M2 Max': { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2 Max, OpenGL 4.1)' },
      'Apple M3': { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)' },
      // Mobile
      'Adreno 740': { vendor: 'Qualcomm', renderer: 'Adreno (TM) 740' },
      'Adreno 730': { vendor: 'Qualcomm', renderer: 'Adreno (TM) 730' },
      'Mali-G57': { vendor: 'ARM', renderer: 'Mali-G57 MC2' },
      'Apple GPU': { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
    };

    const webgl = gpuToWebGL[config.gpu];
    if (webgl) {
      form.webglVendor = webgl.vendor;
      form.webglRenderer = webgl.renderer;
    }

    // Set modes to custom since we're specifying values
    screenMode = 'custom';
    hardwareMode = 'custom';
    webglMode = 'noise';
  }

  // Get a random PC config for current OS
  function randomPCConfig() {
    const configs = currentOSConfigs;
    const config = configs[Math.floor(Math.random() * configs.length)];
    applyPCConfig(config);
  }

  // Available options for dropdowns (realistic values)
  const availableCpuCores = [2, 4, 6, 8, 10, 12, 16];
  const availableMemory = [4, 8, 12, 16, 32];
  const availablePixelRatios = [1, 1.25, 1.5, 2, 3];
  const availableColorDepths = [24, 32];

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

  // Best default values for anti-detect by OS
  const osDefaults = {
    windows: {
      platform: 'Win32',
      browserType: 'chrome',
      browserVersion: '122',
      // Screen - common Windows resolutions
      viewportWidth: 1920,
      viewportHeight: 1080,
      screenWidth: 1920,
      screenHeight: 1080,
      colorDepth: 24,
      pixelRatio: 1,
      // Hardware - typical Windows PC
      cpuCores: 8,
      deviceMemory: 16,
      maxTouchPoints: 0,
      // WebGL - common Windows GPU
      webglVendor: 'Google Inc. (NVIDIA)',
      webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)',
      // Fingerprint modes - best for anti-detect
      canvasNoise: 0.025,
      audioNoise: 0.0005,
      blockCanvas: false,
      blockAudioContext: false,
      webrtcMode: 'replace',
      geoMode: 'query',
      mediaDevicesMode: 'fake',
      doNotTrack: false, // Most users don't enable this
      // Timezone/Locale
      timezone: 'America/New_York',
      locale: 'en-US',
      language: 'en-US,en',
      // Battery - Desktop usually plugged in
      batteryLevel: 1.0,
      batteryCharging: true,
      // Connection - typical home broadband
      connectionType: 'wifi',
      connectionRtt: 50,
      connectionDownlink: 10
    },
    macos: {
      platform: 'MacIntel',
      browserType: 'chrome',
      browserVersion: '122',
      // Screen - MacBook/iMac resolutions
      viewportWidth: 1440,
      viewportHeight: 900,
      screenWidth: 2560,
      screenHeight: 1600,
      colorDepth: 30,
      pixelRatio: 2,
      // Hardware - typical Mac
      cpuCores: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      // WebGL - Apple GPU
      webglVendor: 'Google Inc. (Apple)',
      webglRenderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
      // Fingerprint modes
      canvasNoise: 0.025,
      audioNoise: 0.0005,
      blockCanvas: false,
      blockAudioContext: false,
      webrtcMode: 'replace',
      geoMode: 'query',
      mediaDevicesMode: 'fake',
      doNotTrack: false,
      // Timezone/Locale
      timezone: 'America/Los_Angeles',
      locale: 'en-US',
      language: 'en-US,en',
      // Battery - MacBook often on battery
      batteryLevel: 0.72,
      batteryCharging: false,
      // Connection - typical home/office wifi
      connectionType: 'wifi',
      connectionRtt: 50,
      connectionDownlink: 15
    },
    linux: {
      platform: 'Linux x86_64',
      browserType: 'chrome',
      browserVersion: '122',
      // Screen - common Linux resolutions
      viewportWidth: 1920,
      viewportHeight: 1080,
      screenWidth: 1920,
      screenHeight: 1080,
      colorDepth: 24,
      pixelRatio: 1,
      // Hardware - typical Linux workstation
      cpuCores: 8,
      deviceMemory: 16,
      maxTouchPoints: 0,
      // WebGL - Linux GPU
      webglVendor: 'Google Inc. (NVIDIA Corporation)',
      webglRenderer: 'NVIDIA GeForce GTX 1650/PCIe/SSE2',
      // Fingerprint modes
      canvasNoise: 0.025,
      audioNoise: 0.0005,
      blockCanvas: false,
      blockAudioContext: false,
      webrtcMode: 'replace',
      geoMode: 'query',
      mediaDevicesMode: 'fake',
      doNotTrack: false,
      // Timezone/Locale
      timezone: 'Europe/London',
      locale: 'en-GB',
      language: 'en-GB,en',
      // Battery - Linux desktop usually plugged in
      batteryLevel: 1.0,
      batteryCharging: true,
      // Connection - ethernet common for Linux workstations
      connectionType: 'ethernet',
      connectionRtt: 25,
      connectionDownlink: 50
    },
    android: {
      platform: 'Linux armv8l',
      browserType: 'chrome',
      browserVersion: '122',
      // Screen - common Android phone resolutions
      viewportWidth: 412,
      viewportHeight: 915,
      screenWidth: 1080,
      screenHeight: 2400,
      colorDepth: 24,
      pixelRatio: 2.625,
      // Hardware - typical Android phone
      cpuCores: 8,
      deviceMemory: 8,
      maxTouchPoints: 10,
      // WebGL - Qualcomm Adreno
      webglVendor: 'Qualcomm',
      webglRenderer: 'Adreno (TM) 730',
      // Fingerprint modes
      canvasNoise: 0.025,
      audioNoise: 0.0005,
      blockCanvas: false,
      blockAudioContext: false,
      webrtcMode: 'replace',
      geoMode: 'query',
      mediaDevicesMode: 'fake',
      doNotTrack: false,
      // Timezone/Locale - Vietnam common
      timezone: 'Asia/Ho_Chi_Minh',
      locale: 'vi-VN',
      language: 'vi-VN,vi,en-US,en',
      // Battery - Mobile phone typical usage
      batteryLevel: 0.68,
      batteryCharging: false,
      // Connection - mobile typically on wifi or 4g
      connectionType: 'wifi',
      connectionRtt: 75,
      connectionDownlink: 8
    },
    ios: {
      platform: 'iPhone',
      browserType: 'safari',
      browserVersion: '17.2',
      // Screen - iPhone resolutions
      viewportWidth: 390,
      viewportHeight: 844,
      screenWidth: 1170,
      screenHeight: 2532,
      colorDepth: 24,
      pixelRatio: 3,
      // Hardware - iPhone
      cpuCores: 6,
      deviceMemory: 4, // iOS reports 4GB max
      maxTouchPoints: 5,
      // WebGL - Apple GPU
      webglVendor: 'Apple Inc.',
      webglRenderer: 'Apple GPU',
      // Fingerprint modes
      canvasNoise: 0.025,
      audioNoise: 0.0005,
      blockCanvas: false,
      blockAudioContext: false,
      webrtcMode: 'replace',
      geoMode: 'query',
      mediaDevicesMode: 'fake',
      doNotTrack: false,
      // Timezone/Locale
      timezone: 'America/New_York',
      locale: 'en-US',
      language: 'en-US,en',
      // Battery - iPhone typical usage
      batteryLevel: 0.76,
      batteryCharging: false,
      // Connection - iPhone usually on wifi
      connectionType: 'wifi',
      connectionRtt: 60,
      connectionDownlink: 12
    }
  };

  // Apply OS defaults when OS changes
  function applyOSDefaults(os) {
    const defaults = osDefaults[os] || osDefaults.windows;

    // Apply all defaults
    form.platform = defaults.platform;
    form.browserType = defaults.browserType;
    form.browserVersion = defaults.browserVersion;
    form.viewportWidth = defaults.viewportWidth;
    form.viewportHeight = defaults.viewportHeight;
    form.screenWidth = defaults.screenWidth;
    form.screenHeight = defaults.screenHeight;
    form.colorDepth = defaults.colorDepth;
    form.pixelRatio = defaults.pixelRatio;
    form.cpuCores = defaults.cpuCores;
    form.deviceMemory = defaults.deviceMemory;
    form.maxTouchPoints = defaults.maxTouchPoints;
    form.webglVendor = defaults.webglVendor;
    form.webglRenderer = defaults.webglRenderer;
    form.canvasNoise = defaults.canvasNoise;
    form.audioNoise = defaults.audioNoise;
    form.blockCanvas = defaults.blockCanvas;
    form.blockAudioContext = defaults.blockAudioContext;
    form.webrtcMode = defaults.webrtcMode;
    form.geoMode = defaults.geoMode;
    form.mediaDevicesMode = defaults.mediaDevicesMode;
    form.doNotTrack = defaults.doNotTrack;
    // Battery
    form.batteryLevel = defaults.batteryLevel;
    form.batteryCharging = defaults.batteryCharging;
    // Connection
    form.connectionType = defaults.connectionType;
    form.connectionRtt = defaults.connectionRtt;
    form.connectionDownlink = defaults.connectionDownlink;

    // Only apply timezone/locale if in auto mode
    if (timezoneMode === 'manual') {
      form.timezone = defaults.timezone;
    }
    if (localeMode === 'manual') {
      form.locale = defaults.locale;
      form.language = defaults.language;
    }

    // Generate matching user agent
    form.userAgent = generateUserAgent(os, form.browserType, form.browserVersion);

    // Update UI modes
    screenMode = 'custom';
    hardwareMode = 'custom';
    canvasMode = form.blockCanvas ? 'block' : (form.canvasNoise > 0 ? 'noise' : 'real');
    audioMode = form.blockAudioContext ? 'block' : (form.audioNoise > 0 ? 'noise' : 'real');
    webglMode = 'noise';
    selectedPCConfig = '';
  }

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
    // Detect actual OS from client-side for warning purposes
    actualOS = detectClientOS();
    console.log('[ProfileEditor] Detected actual OS:', actualOS);

    try {
      // Fetch system info from sidecar
      const sysInfo = await getSystemInfo();
      if (sysInfo?.success && sysInfo.system) {
        systemInfo = sysInfo.system;
      }

      proxies = await getProxies() || [];
      presets = getPresetList() || [];
      resourcePlatforms = getPlatforms() || [];
      const extResult = await listExtensions();
      extensions = extResult?.extensions || [];

      // Load resources if editing existing profile
      if (profile?.id) {
        resources = await getProfileResources(profile.id) || [];
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }

    if (!profile) {
      // Use actual OS for new profiles to ensure consistency
      form.os = actualOS;
      generateRandomFingerprint();
    }

    // Initialize proxy mode based on profile
    if (profile?.proxyId) {
      proxyMode = 'select';
      selectedProxyId = profile.proxyId;
    }

    // Initialize timezone/locale modes from profile
    if (profile?.timezoneMode) {
      timezoneMode = profile.timezoneMode;
    }
    if (profile?.localeMode) {
      localeMode = profile.localeMode;
    }

    // Initialize extensionIds from profile (handle string JSON or array)
    if (profile?.extensionIds) {
      if (typeof profile.extensionIds === 'string') {
        try {
          form.extensionIds = JSON.parse(profile.extensionIds) || [];
        } catch {
          form.extensionIds = [];
        }
      } else if (Array.isArray(profile.extensionIds)) {
        form.extensionIds = [...profile.extensionIds];
      } else {
        form.extensionIds = [];
      }
    } else {
      form.extensionIds = [];
    }

    // Initialize platformTags from profile (handle string JSON or array)
    if (profile?.platformTags) {
      if (typeof profile.platformTags === 'string') {
        try {
          form.platformTags = JSON.parse(profile.platformTags) || [];
        } catch {
          form.platformTags = [];
        }
      } else if (Array.isArray(profile.platformTags)) {
        form.platformTags = [...profile.platformTags];
      } else {
        form.platformTags = [];
      }
    } else {
      form.platformTags = [];
    }
  });

  // Apply preset to form
  function applyPreset(presetId) {
    console.log('[applyPreset] presetId:', presetId, 'actualOS:', actualOS);
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
    console.log('[onPresetChange] selectedPreset:', selectedPreset, 'actualOS:', actualOS);
    applyPreset(selectedPreset);
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Only regenerate User Agent (not all fingerprint values)
  function regenerateUserAgent() {
    form.userAgent = generateUserAgent(form.os, form.browserType, form.browserVersion);
  }

  // Fingerprint verification sites
  const verificationSites = [
    { name: 'BrowserLeaks', url: 'https://browserleaks.com/canvas' },
    { name: 'CreepJS', url: 'https://abrahamjuliot.github.io/creepjs/' },
    { name: 'PixelScan', url: 'https://pixelscan.net/' },
    { name: 'IPLeak', url: 'https://ipleak.net/' }
  ];

  function openVerifySite(url) {
    window.open(url, '_blank');
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

  // Detect actual OS from client-side - this is reliable because the frontend runs on the real machine
  function detectClientOS() {
    const platform = navigator.platform?.toLowerCase() || '';
    const userAgent = navigator.userAgent?.toLowerCase() || '';

    if (platform.includes('win') || userAgent.includes('windows')) {
      return 'windows';
    } else if (platform.includes('mac') || userAgent.includes('macintosh')) {
      return 'macos';
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      return 'linux';
    } else if (userAgent.includes('android')) {
      return 'android';
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'ios';
    }
    return 'linux'; // Default fallback
  }

  function generateRandomFingerprint() {
    // Random OS selection - profiles can be used on different machines
    // User will see a warning if profile OS doesn't match actual OS
    const availableOS = ['windows', 'macos', 'linux'];
    const os = randomItem(availableOS);
    console.log('[generateRandomFingerprint] Random OS:', os, '(actual:', actualOS, ')');
    form.os = os;

    // Start with OS defaults then randomize some values
    const defaults = osDefaults[os] || osDefaults.linux;

    // Random browser version from available
    const versions = browserVersions[form.browserType] || browserVersions.chrome;
    form.browserVersion = randomItem(versions);

    // Generate user agent
    form.userAgent = generateUserAgent(os, form.browserType, form.browserVersion);
    form.platform = platforms[os] || 'Win32';

    // Random WebGL from presets
    const webglList = webglPresets[os] || webglPresets.windows;
    const webgl = randomItem(webglList);
    form.webglVendor = webgl.vendor;
    form.webglRenderer = webgl.renderer;

    // Random screen from presets
    const resStr = randomItem(resolutionPresets[os] || resolutionPresets.windows);
    const [w, h] = resStr.split('x').map(Number);
    form.viewportWidth = w;
    form.viewportHeight = h;
    form.screenWidth = w;
    form.screenHeight = h;

    // Random hardware within realistic ranges for OS
    const cores = os === 'android' || os === 'ios' ? [4, 6, 8] : [4, 6, 8, 12, 16];
    const memory = os === 'android' ? [4, 6, 8, 12] : os === 'ios' ? [4, 6, 8] : [8, 16, 32];
    form.cpuCores = randomItem(cores);
    form.deviceMemory = randomItem(memory);
    form.maxTouchPoints = (os === 'android' || os === 'ios') ? randomItem([5, 10]) : 0;
    form.pixelRatio = defaults.pixelRatio;
    form.colorDepth = defaults.colorDepth;

    // Best noise values for anti-detect
    form.canvasNoise = parseFloat((0.02 + Math.random() * 0.01).toFixed(4));
    form.audioNoise = parseFloat((0.0003 + Math.random() * 0.0004).toFixed(6));

    // Best anti-detect settings
    form.blockCanvas = false;
    form.blockAudioContext = false;
    form.webrtcMode = 'replace';
    form.geoMode = 'query';
    form.mediaDevicesMode = 'fake';
    form.doNotTrack = false;

    // Battery - varies by device type
    const isMobile = os === 'android' || os === 'ios';
    const isDesktop = os === 'windows' || os === 'linux';
    if (isDesktop) {
      // Desktop usually plugged in
      form.batteryLevel = Math.random() > 0.3 ? 1.0 : parseFloat((0.7 + Math.random() * 0.29).toFixed(2));
      form.batteryCharging = true;
    } else if (os === 'macos') {
      // MacBook varies
      form.batteryLevel = parseFloat((0.5 + Math.random() * 0.45).toFixed(2));
      form.batteryCharging = Math.random() > 0.6;
    } else {
      // Mobile devices - typical usage patterns
      form.batteryLevel = parseFloat((0.3 + Math.random() * 0.6).toFixed(2));
      form.batteryCharging = Math.random() > 0.7;
    }

    // Connection - varies by device type
    if (isDesktop && os === 'linux') {
      form.connectionType = Math.random() > 0.3 ? 'ethernet' : 'wifi';
      form.connectionRtt = randomItem([20, 25, 30, 35, 40]);
      form.connectionDownlink = randomItem([30, 50, 75, 100]);
    } else if (isMobile) {
      form.connectionType = Math.random() > 0.2 ? 'wifi' : 'cellular';
      form.connectionRtt = randomItem([50, 60, 75, 100, 120]);
      form.connectionDownlink = randomItem([5, 8, 10, 15, 20]);
    } else {
      form.connectionType = 'wifi';
      form.connectionRtt = randomItem([40, 50, 60, 75]);
      form.connectionDownlink = randomItem([10, 15, 20, 30]);
    }

    // Update UI modes
    screenMode = 'custom';
    hardwareMode = 'custom';
    canvasMode = 'noise';
    audioMode = 'noise';
    webglMode = 'noise';
  }

  function selectOS(os) {
    form.os = os;
    // Apply all OS-specific defaults for best anti-detect
    applyOSDefaults(os);
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
      showAlert('Failed to save profile: ' + e, { title: 'Save Failed', variant: 'danger' });
    }
    saving = false;
  }

  function cancel() {
    dispatch('close');
  }

  // Tag management
  function addTag() {
    if (newTag.trim() && !form.platformTags.includes(newTag.trim())) {
      form.platformTags = [...form.platformTags, newTag.trim()];
      newTag = '';
    }
  }

  function removeTag(tag) {
    form.platformTags = form.platformTags.filter(t => t !== tag);
  }

  function toggleTag(tag) {
    if (form.platformTags.includes(tag)) {
      removeTag(tag);
    } else {
      form.platformTags = [...form.platformTags, tag];
    }
  }

  // Proxy functions
  function selectProxy(id) {
    selectedProxyId = id;
    form.proxyId = id;
  }

  async function checkProxy() {
    proxyCheckResult = 'checking';
    try {
      // Get proxy to check
      let proxyToCheck = null;
      if (proxyMode === 'select' && selectedProxyId) {
        proxyToCheck = proxies.find(p => p.id === selectedProxyId);
      } else if (proxyMode === 'manual' && proxyString) {
        const parts = proxyString.split(':');
        proxyToCheck = {
          host: parts[0],
          port: parseInt(parts[1]) || 8080,
          username: parts[2] || '',
          password: parts[3] || '',
          type: proxyType
        };
      }

      if (!proxyToCheck) {
        proxyCheckResult = { success: false, error: 'No proxy selected' };
        return;
      }

      // Simple check - just show the proxy info
      proxyCheckResult = {
        success: true,
        ip: `${proxyToCheck.host}:${proxyToCheck.port}`,
        country: proxyToCheck.country || ''
      };
    } catch (e) {
      proxyCheckResult = { success: false, error: e.message || 'Check failed' };
    }
  }

  async function saveNewProxy() {
    if (!proxyString) return;
    savingProxy = true;
    try {
      const parts = proxyString.split(':');
      const newProxy = {
        name: proxyName || `Proxy ${parts[0]}`,
        host: parts[0],
        port: parseInt(parts[1]) || 8080,
        username: parts[2] || '',
        password: parts[3] || '',
        type: proxyType
      };
      // TODO: Call API to save proxy
      // await createProxy(newProxy);
      // await loadProxies();
      showAlert('Proxy saved successfully', { title: 'Success' });
      proxyString = '';
      proxyName = '';
    } catch (e) {
      showAlert('Failed to save proxy: ' + e, { title: 'Error', variant: 'danger' });
    }
    savingProxy = false;
  }

  // Update proxyId when mode or selection changes
  $: {
    if (proxyMode === 'none') {
      form.proxyId = '';
    } else if (proxyMode === 'select') {
      form.proxyId = selectedProxyId;
    }
  }

  // Randomize screen resolution
  function randomizeScreen() {
    const resStr = randomItem(resolutionPresets[form.os] || resolutionPresets.windows);
    const [w, h] = resStr.split('x').map(Number);
    form.viewportWidth = w;
    form.viewportHeight = h;
    form.screenWidth = w;
    form.screenHeight = h;
    form.pixelRatio = (form.os === 'android' || form.os === 'ios') ? randomItem([2, 3]) : randomItem([1, 1.25, 2]);
    form.colorDepth = 24;
  }

  // Randomize hardware
  function randomizeHardware() {
    const cores = (form.os === 'android' || form.os === 'ios') ? [4, 8] : [4, 6, 8, 12, 16];
    const memory = (form.os === 'android' || form.os === 'ios') ? [4, 6, 8] : [8, 16, 32];
    form.cpuCores = randomItem(cores);
    form.deviceMemory = randomItem(memory);
    form.maxTouchPoints = (form.os === 'android' || form.os === 'ios') ? randomItem([5, 10]) : 0;
  }

  // Update canvas mode based on form values
  function updateCanvasMode() {
    if (form.blockCanvas) {
      canvasMode = 'block';
    } else if (form.canvasNoise > 0) {
      canvasMode = 'noise';
    } else {
      canvasMode = 'real';
    }
  }

  // Update audio mode based on form values
  function updateAudioMode() {
    if (form.blockAudioContext) {
      audioMode = 'block';
    } else if (form.audioNoise > 0) {
      audioMode = 'noise';
    } else {
      audioMode = 'real';
    }
  }

  // Set canvas mode
  function setCanvasMode(mode) {
    canvasMode = mode;
    if (mode === 'real') {
      form.blockCanvas = false;
      form.canvasNoise = 0;
    } else if (mode === 'noise') {
      form.blockCanvas = false;
      form.canvasNoise = 0.025;
    } else {
      form.blockCanvas = true;
      form.canvasNoise = 0;
    }
  }

  // Set audio mode
  function setAudioMode(mode) {
    audioMode = mode;
    if (mode === 'real') {
      form.blockAudioContext = false;
      form.audioNoise = 0;
    } else if (mode === 'noise') {
      form.blockAudioContext = false;
      form.audioNoise = 0.0005;
    } else {
      form.blockAudioContext = true;
      form.audioNoise = 0;
    }
  }

  // Set WebGL mode
  function setWebglMode(mode) {
    webglMode = mode;
    if (mode === 'real') {
      form.webglVendor = '';
      form.webglRenderer = '';
    }
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
              class:recommended={os.id === actualOS}
              on:click={() => selectOS(os.id)}
            >
              <span class="os-icon">{os.icon}</span>
              <span class="os-label">{os.label}</span>
              {#if os.id === actualOS}
                <span class="recommended-badge">Recommended</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if form.os !== actualOS}
          <div class="os-warning">
            <span class="warning-icon">⚠️</span>
            <span>Selected OS ({form.os}) doesn't match your system ({actualOS}). This may cause fingerprint inconsistencies in fonts, rendering, and other browser properties.</span>
          </div>
        {/if}
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
        <div class="btn-row" style="margin-top: 0.5rem;">
          <button type="button" class="btn small" on:click={regenerateUserAgent}>
            🔄 Regenerate UA
          </button>
          <button type="button" class="btn small primary" on:click={generateRandomFingerprint}>
            🎲 Randomize All Fingerprint
          </button>
        </div>
      </div>

      <div class="section">
        <h3>Platform Tags</h3>
        <div class="tags-container">
          {#each form.platformTags as tag}
            <span class="tag">
              {tag}
              <button type="button" class="tag-remove" on:click={() => removeTag(tag)}>&times;</button>
            </span>
          {/each}
        </div>
        <div class="tag-input-row">
          <input
            type="text"
            bind:value={newTag}
            placeholder="Add custom tag..."
            on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <button type="button" class="btn small" on:click={addTag}>Add</button>
        </div>
        <div class="quick-tags">
          <span class="quick-label">Quick:</span>
          {#each quickTags as tag}
            <button
              type="button"
              class="quick-tag"
              class:selected={form.platformTags.includes(tag)}
              on:click={() => toggleTag(tag)}
            >
              {tag}
            </button>
          {/each}
        </div>
      </div>

      <!-- Verify Fingerprint - open test sites -->
      {#if profile}
        <div class="section">
          <h3>Verify Fingerprint</h3>
          <p class="section-desc">After starting browser, open these sites to verify fingerprint is working correctly</p>
          <div class="verify-sites">
            {#each verificationSites as site}
              <button type="button" class="verify-btn" on:click={() => openVerifySite(site.url)}>
                <span class="verify-icon">🔍</span>
                <span class="verify-name">{site.name}</span>
              </button>
            {/each}
          </div>
          <div class="auto-info" style="margin-top: 0.75rem;">
            <span class="info-icon">💡</span>
            <span>Start the profile first, then click a site above to verify fingerprint values match your config</span>
          </div>
        </div>
      {/if}

      <!-- Extensions in Overview like fingerprint-qa -->
      {#if supportsExtensions}
        <div class="section">
          <h3>Extensions</h3>
          {#if extensions.length === 0}
            <p class="empty-text">No extensions installed</p>
          {:else}
            <div class="extensions-list">
              {#each extensions as ext}
                <label class="extension-item" class:selected={(form.extensionIds || []).includes(ext.id)}>
                  <input
                    type="checkbox"
                    checked={(form.extensionIds || []).includes(ext.id)}
                    on:change={(e) => {
                      if (e.target.checked) {
                        form.extensionIds = [...(form.extensionIds || []), ext.id];
                      } else {
                        form.extensionIds = (form.extensionIds || []).filter(id => id !== ext.id);
                      }
                    }}
                  />
                  <span class="ext-name">{ext.name || ext.id}</span>
                  {#if ext.version}
                    <span class="ext-version">v{ext.version}</span>
                  {/if}
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

    {:else if activeTab === 'network'}
      <div class="section">
        <h3>Proxy</h3>
        <div class="proxy-modes">
          <label class="proxy-mode-option" class:selected={proxyMode === 'none'}>
            <input type="radio" bind:group={proxyMode} value="none" />
            <span>No Proxy</span>
          </label>
          <label class="proxy-mode-option" class:selected={proxyMode === 'select'}>
            <input type="radio" bind:group={proxyMode} value="select" />
            <span>Select from list</span>
          </label>
          <label class="proxy-mode-option" class:selected={proxyMode === 'manual'}>
            <input type="radio" bind:group={proxyMode} value="manual" />
            <span>Add new</span>
          </label>
        </div>
      </div>

      {#if proxyMode === 'select'}
        <div class="section">
          <h3>Select Proxy</h3>
          {#if proxies.length > 0}
            <div class="proxy-list">
              {#each proxies as p}
                <label class="proxy-item" class:selected={selectedProxyId === p.id}>
                  <input type="radio" bind:group={selectedProxyId} value={p.id} on:change={() => selectProxy(p.id)} />
                  <div class="proxy-item-info">
                    <span class="proxy-item-name">{p.name}</span>
                    <span class="proxy-item-detail">{(p.type || p.proxyType || 'http').toUpperCase()} - {p.host}:{p.port}</span>
                  </div>
                </label>
              {/each}
            </div>

            {#if selectedProxyId}
              <div class="proxy-actions">
                <button type="button" class="btn" on:click={checkProxy}>Check Proxy</button>
              </div>
            {/if}
          {:else}
            <div class="no-proxy-info">
              <span>No proxies available. Add new proxy below.</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if proxyMode === 'manual'}
        <div class="section">
          <h3>Add New Proxy</h3>
          <div class="form-group">
            <label>Proxy Type</label>
            <div class="proxy-types">
              <label class="proxy-type-option" class:selected={proxyType === 'http'}>
                <input type="radio" bind:group={proxyType} value="http" />
                <span>HTTP</span>
              </label>
              <label class="proxy-type-option" class:selected={proxyType === 'https'}>
                <input type="radio" bind:group={proxyType} value="https" />
                <span>HTTPS</span>
              </label>
              <label class="proxy-type-option" class:selected={proxyType === 'socks5'}>
                <input type="radio" bind:group={proxyType} value="socks5" />
                <span>SOCKS5</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>Proxy Name (optional)</label>
            <input type="text" bind:value={proxyName} placeholder="My Proxy VN" />
          </div>

          <div class="form-group">
            <label>Proxy (IP:Port:Username:Password)</label>
            <div class="proxy-input-row">
              <input
                type="text"
                bind:value={proxyString}
                placeholder="192.168.1.1:8080:user:pass"
                class="proxy-input"
              />
              <button type="button" class="btn" on:click={checkProxy}>Check</button>
              <button type="button" class="btn primary" on:click={saveNewProxy} disabled={savingProxy}>
                {savingProxy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          <p class="hint">Format: IP:Port or IP:Port:Username:Password</p>
        </div>
      {/if}

      {#if proxyMode !== 'none' && proxyCheckResult}
        <div class="section">
          <div class="proxy-result" class:success={proxyCheckResult.success} class:error={!proxyCheckResult.success && proxyCheckResult !== 'checking'} class:checking={proxyCheckResult === 'checking'}>
            {#if proxyCheckResult === 'checking'}
              <span>Checking...</span>
            {:else if proxyCheckResult.success}
              <span class="result-icon">✓</span>
              <span class="result-text">
                <strong>{proxyCheckResult.ip}</strong>
                {#if proxyCheckResult.country}
                  <span class="result-country">({proxyCheckResult.country})</span>
                {/if}
              </span>
            {:else}
              <span class="result-icon">✕</span>
              <span class="result-text">{proxyCheckResult.error}</span>
            {/if}
          </div>
        </div>
      {/if}

      {#if proxyMode === 'none'}
        <div class="section">
          <div class="no-proxy-info">
            <span>Using direct IP connection</span>
          </div>
        </div>
      {/if}

      <div class="section">
        <h3>WebRTC</h3>
        <div class="mode-options">
          {#each webrtcModes as mode}
            <label class="mode-option" class:selected={form.webrtcMode === mode.value}>
              <input type="radio" bind:group={form.webrtcMode} value={mode.value} />
              <div class="mode-content">
                <span class="mode-label">{mode.label}</span>
                <span class="mode-desc">{mode.description}</span>
              </div>
            </label>
          {/each}
        </div>
      </div>

      <div class="section">
        <h3>Geolocation</h3>
        <div class="mode-options">
          {#each geoModes as mode}
            <label class="mode-option" class:selected={form.geoMode === mode.value}>
              <input type="radio" bind:group={form.geoMode} value={mode.value} />
              <div class="mode-content">
                <span class="mode-label">{mode.label}</span>
                <span class="mode-desc">{mode.description}</span>
              </div>
            </label>
          {/each}
        </div>
        {#if form.geoMode === 'allow'}
          <div class="row" style="margin-top: 0.75rem;">
            <div class="form-group">
              <label>Latitude</label>
              <input type="number" bind:value={form.geoLatitude} step="0.000001" />
            </div>
            <div class="form-group">
              <label>Longitude</label>
              <input type="number" bind:value={form.geoLongitude} step="0.000001" />
            </div>
            <div class="form-group">
              <label>Accuracy (m)</label>
              <input type="number" bind:value={form.geoAccuracy} min="1" />
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'device'}
      <div class="section">
        <h3>Quick Setup - Common Devices</h3>
        <p class="section-desc">Select a popular device to auto-configure Screen, Hardware, and GPU</p>
        <div class="pc-configs-grid">
          {#each currentOSConfigs as config}
            <button
              type="button"
              class="pc-config-btn"
              class:active={selectedPCConfig === config.name}
              on:click={() => applyPCConfig(config)}
            >
              <span class="pc-name">{config.name}</span>
              <span class="pc-specs">{config.cpu} cores • {config.memory}GB • {config.screen}</span>
            </button>
          {/each}
          <button
            type="button"
            class="pc-config-btn random"
            on:click={randomPCConfig}
          >
            <span class="pc-name">Random</span>
            <span class="pc-specs">Pick random config</span>
          </button>
        </div>
      </div>

      <div class="section">
        <h3>Screen Resolution</h3>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={screenMode === 'custom'}>
            <input type="radio" bind:group={screenMode} value="custom" />
            <span class="fp-mode-label">Custom</span>
            <span class="fp-mode-desc">Choose resolution</span>
          </label>
          <label class="fp-mode" class:selected={screenMode === 'random'}>
            <input type="radio" bind:group={screenMode} value="random" on:change={randomizeScreen} />
            <span class="fp-mode-label">Random</span>
            <span class="fp-mode-desc">Random by OS</span>
          </label>
        </div>
        {#if screenMode === 'custom'}
          <div class="preset-row" style="margin-top: 0.75rem;">
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
          <div class="row" style="margin-top: 0.75rem;">
            <div class="form-group">
              <label>Width</label>
              <input type="number" bind:value={form.viewportWidth} />
            </div>
            <div class="form-group">
              <label>Height</label>
              <input type="number" bind:value={form.viewportHeight} />
            </div>
            <div class="form-group">
              <label>Color Depth</label>
              <select bind:value={form.colorDepth}>
                {#each availableColorDepths as depth}
                  <option value={depth}>{depth}-bit</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label>Pixel Ratio</label>
              <select bind:value={form.pixelRatio}>
                {#each availablePixelRatios as ratio}
                  <option value={ratio}>{ratio}x</option>
                {/each}
              </select>
            </div>
          </div>
        {:else}
          <div class="random-info">
            <div class="random-value">
              <span class="random-label">Resolution:</span>
              <span class="random-data">{form.viewportWidth} x {form.viewportHeight}</span>
            </div>
            <div class="random-value">
              <span class="random-label">Color Depth:</span>
              <span class="random-data">{form.colorDepth || 24}-bit</span>
            </div>
            <div class="random-value">
              <span class="random-label">Pixel Ratio:</span>
              <span class="random-data">{form.pixelRatio}x</span>
            </div>
            <button type="button" class="btn randomize-btn" on:click={randomizeScreen}>
              Randomize
            </button>
          </div>
        {/if}
      </div>

      <div class="section">
        <h3>Hardware</h3>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={hardwareMode === 'custom'}>
            <input type="radio" bind:group={hardwareMode} value="custom" />
            <span class="fp-mode-label">Custom</span>
            <span class="fp-mode-desc">Choose hardware</span>
          </label>
          <label class="fp-mode" class:selected={hardwareMode === 'random'}>
            <input type="radio" bind:group={hardwareMode} value="random" on:change={randomizeHardware} />
            <span class="fp-mode-label">Random</span>
            <span class="fp-mode-desc">Random by OS</span>
          </label>
        </div>
        {#if hardwareMode === 'custom'}
          <div class="row" style="margin-top: 0.75rem;">
            <div class="form-group">
              <label>CPU Cores</label>
              <select bind:value={form.cpuCores}>
                {#each availableCpuCores as cores}
                  <option value={cores}>{cores} cores</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label>Memory (GB)</label>
              <select bind:value={form.deviceMemory}>
                {#each availableMemory as mem}
                  <option value={mem}>{mem} GB</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label>Touch Points</label>
              <select bind:value={form.maxTouchPoints}>
                {#if form.os === 'android' || form.os === 'ios'}
                  <option value={5}>5 (Touch)</option>
                  <option value={10}>10 (Multi)</option>
                {:else}
                  <option value={0}>0 (Desktop)</option>
                  <option value={5}>5 (Touch)</option>
                  <option value={10}>10 (Multi)</option>
                {/if}
              </select>
            </div>
          </div>
        {:else}
          <div class="random-info">
            <div class="random-value">
              <span class="random-label">CPU Cores:</span>
              <span class="random-data">{form.cpuCores}</span>
            </div>
            <div class="random-value">
              <span class="random-label">Memory:</span>
              <span class="random-data">{form.deviceMemory} GB</span>
            </div>
            <div class="random-value">
              <span class="random-label">Touch Points:</span>
              <span class="random-data">{form.maxTouchPoints}</span>
            </div>
            <button type="button" class="btn randomize-btn" on:click={randomizeHardware}>
              Randomize
            </button>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'fingerprint'}
      <div class="section">
        <h3>Timezone</h3>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={timezoneMode === 'auto'}>
            <input type="radio" bind:group={timezoneMode} value="auto" on:change={() => form.timezoneMode = 'auto'} />
            <span class="fp-mode-label">Auto</span>
            <span class="fp-mode-desc">Detect from IP/Proxy</span>
          </label>
          <label class="fp-mode" class:selected={timezoneMode === 'manual'}>
            <input type="radio" bind:group={timezoneMode} value="manual" on:change={() => form.timezoneMode = 'manual'} />
            <span class="fp-mode-label">Manual</span>
            <span class="fp-mode-desc">Choose timezone</span>
          </label>
        </div>
        {#if timezoneMode === 'auto'}
          <div class="auto-info">
            <span class="info-icon">ℹ</span>
            <span>Timezone will be auto-detected from IP (proxy) when profile starts</span>
          </div>
        {:else}
          <div class="form-group" style="margin-top: 0.75rem;">
            <select bind:value={form.timezone}>
              {#each timezones as tz}
                <option value={tz}>{tz}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <div class="section">
        <h3>Language & Locale</h3>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={localeMode === 'auto'}>
            <input type="radio" bind:group={localeMode} value="auto" on:change={() => form.localeMode = 'auto'} />
            <span class="fp-mode-label">Auto</span>
            <span class="fp-mode-desc">Detect from IP/Proxy</span>
          </label>
          <label class="fp-mode" class:selected={localeMode === 'manual'}>
            <input type="radio" bind:group={localeMode} value="manual" on:change={() => form.localeMode = 'manual'} />
            <span class="fp-mode-label">Manual</span>
            <span class="fp-mode-desc">Choose locale/language</span>
          </label>
        </div>
        {#if localeMode === 'auto'}
          <div class="auto-info">
            <span class="info-icon">ℹ</span>
            <span>Locale/Language will be auto-detected from IP (proxy) when profile starts</span>
          </div>
        {:else}
          <div class="row" style="margin-top: 0.75rem;">
            <div class="form-group">
              <label>Locale</label>
              <select bind:value={form.locale}>
                {#each locales as l}
                  <option value={l}>{l}</option>
                {/each}
              </select>
            </div>
            <div class="form-group" style="flex: 2;">
              <label>Languages</label>
              <input type="text" bind:value={form.language} placeholder="vi-VN,vi,en-US,en" />
            </div>
          </div>
        {/if}
      </div>

      <div class="section">
        <h3>Canvas</h3>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={canvasMode === 'real'}>
            <input type="radio" bind:group={canvasMode} value="real" on:change={() => setCanvasMode('real')} />
            <span class="fp-mode-label">Real</span>
            <span class="fp-mode-desc">Use real canvas</span>
          </label>
          <label class="fp-mode" class:selected={canvasMode === 'noise'}>
            <input type="radio" bind:group={canvasMode} value="noise" on:change={() => setCanvasMode('noise')} />
            <span class="fp-mode-label">Noise</span>
            <span class="fp-mode-desc">Add noise to change fingerprint</span>
          </label>
          <label class="fp-mode" class:selected={canvasMode === 'block'}>
            <input type="radio" bind:group={canvasMode} value="block" on:change={() => setCanvasMode('block')} />
            <span class="fp-mode-label">Block</span>
            <span class="fp-mode-desc">Block completely</span>
          </label>
        </div>
      </div>

      <div class="section">
        <h3>Audio</h3>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={audioMode === 'real'}>
            <input type="radio" bind:group={audioMode} value="real" on:change={() => setAudioMode('real')} />
            <span class="fp-mode-label">Real</span>
            <span class="fp-mode-desc">Use real audio</span>
          </label>
          <label class="fp-mode" class:selected={audioMode === 'noise'}>
            <input type="radio" bind:group={audioMode} value="noise" on:change={() => setAudioMode('noise')} />
            <span class="fp-mode-label">Noise</span>
            <span class="fp-mode-desc">Add noise to change fingerprint</span>
          </label>
          <label class="fp-mode" class:selected={audioMode === 'block'}>
            <input type="radio" bind:group={audioMode} value="block" on:change={() => setAudioMode('block')} />
            <span class="fp-mode-label">Block</span>
            <span class="fp-mode-desc">Block completely</span>
          </label>
        </div>
      </div>

      <div class="section">
        <h3>Graphics Card (WebGL)</h3>
        <p class="section-desc">GPU info - auto-set by Quick Setup, or choose preset below</p>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={webglMode === 'noise'}>
            <input type="radio" bind:group={webglMode} value="noise" on:change={() => setWebglMode('noise')} />
            <span class="fp-mode-label">Custom</span>
            <span class="fp-mode-desc">Use selected GPU</span>
          </label>
          <label class="fp-mode" class:selected={webglMode === 'real'}>
            <input type="radio" bind:group={webglMode} value="real" on:change={() => setWebglMode('real')} />
            <span class="fp-mode-label">Real</span>
            <span class="fp-mode-desc">Use real machine GPU</span>
          </label>
        </div>
        {#if webglMode === 'noise'}
          <div class="preset-row" style="margin-top: 0.75rem;">
            {#each availableWebGL as preset}
              <button
                type="button"
                class="preset-btn"
                class:active={form.webglRenderer === preset.renderer}
                on:click={() => applyWebGL(preset)}
              >
                {preset.label}
              </button>
            {/each}
          </div>
          <div class="webgl-display">
            <span class="webgl-label">Current GPU:</span>
            <span class="webgl-value">{form.webglRenderer || 'Not set'}</span>
          </div>
        {/if}
      </div>

      <div class="section">
        <h3>Media Devices</h3>
        <p class="section-desc">Camera/Microphone enumeration - can reveal real hardware</p>
        <div class="fp-modes">
          <label class="fp-mode" class:selected={form.mediaDevicesMode === 'real'}>
            <input type="radio" bind:group={form.mediaDevicesMode} value="real" />
            <span class="fp-mode-label">Real</span>
            <span class="fp-mode-desc">Show real devices</span>
          </label>
          <label class="fp-mode" class:selected={form.mediaDevicesMode === 'fake'}>
            <input type="radio" bind:group={form.mediaDevicesMode} value="fake" />
            <span class="fp-mode-label">Fake</span>
            <span class="fp-mode-desc">Show fake devices</span>
          </label>
          <label class="fp-mode" class:selected={form.mediaDevicesMode === 'block'}>
            <input type="radio" bind:group={form.mediaDevicesMode} value="block" />
            <span class="fp-mode-label">Block</span>
            <span class="fp-mode-desc">Hide all devices</span>
          </label>
        </div>
      </div>

      <div class="section">
        <h3>Privacy Settings</h3>
        <div class="privacy-options">
          <label class="privacy-option">
            <input type="checkbox" bind:checked={form.doNotTrack} />
            <div class="privacy-content">
              <span class="privacy-label">Do Not Track</span>
              <span class="privacy-desc">Send DNT header to websites (navigator.doNotTrack = "1")</span>
            </div>
          </label>
        </div>
        <div class="auto-info" style="margin-top: 0.5rem;">
          <span class="info-icon">ℹ</span>
          <span>Fonts, Speech Voices, Client Rects are auto-protected based on selected OS</span>
        </div>
      </div>

      <div class="section">
        <h3>Battery & Connection</h3>
        <p class="hint">Spoof Battery API and Network Information API to prevent fingerprinting</p>

        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Battery Level</label>
            <div class="input-with-suffix">
              <input
                type="number"
                bind:value={form.batteryLevel}
                min="0"
                max="1"
                step="0.01"
                placeholder="0.85"
              />
              <span class="suffix">{Math.round((form.batteryLevel || 0.85) * 100)}%</span>
            </div>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={form.batteryCharging} />
              <span>Charging</span>
            </label>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Connection Type</label>
            <select bind:value={form.connectionType}>
              <option value="wifi">WiFi</option>
              <option value="ethernet">Ethernet</option>
              <option value="cellular">Cellular (4G)</option>
              <option value="3g">Cellular (3G)</option>
              <option value="2g">Cellular (2G)</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label>RTT (ms)</label>
            <input
              type="number"
              bind:value={form.connectionRtt}
              min="0"
              max="1000"
              placeholder="50"
            />
          </div>
          <div class="form-group" style="flex: 1;">
            <label>Downlink (Mbps)</label>
            <input
              type="number"
              bind:value={form.connectionDownlink}
              min="0"
              max="100"
              step="0.5"
              placeholder="10"
            />
          </div>
        </div>
        <div class="auto-info">
          <span class="info-icon">ℹ</span>
          <span>Typical values: WiFi (RTT: 50ms, 10Mbps) | Ethernet (RTT: 25ms, 50Mbps) | 4G (RTT: 75ms, 8Mbps)</span>
        </div>
      </div>

    {:else if activeTab === 'storage'}
      <div class="section">
        <h3>Import Cookie</h3>
        <p class="hint">Paste cookies in JSON or Netscape format</p>
        <div class="form-group">
          <textarea
            bind:value={cookieInput}
            rows="10"
            placeholder="Paste JSON or Netscape format cookies here..."
          ></textarea>
        </div>
        <div class="btn-row">
          <button type="button" class="btn">Import JSON</button>
          <button type="button" class="btn">Import Netscape</button>
          <button type="button" class="btn">Clear All</button>
        </div>
      </div>

      <div class="section">
        <h3>Notes</h3>
        <div class="form-group">
          <textarea
            bind:value={form.notes}
            rows="4"
            placeholder="Add notes about this profile..."
          ></textarea>
        </div>
      </div>

      <div class="section">
        <h3>Bookmarks</h3>
        <div class="form-group">
          <textarea
            bind:value={form.bookmarks}
            rows="6"
            placeholder="Add bookmarks (one per line)...
https://facebook.com
https://google.com
https://example.com"
          ></textarea>
          <small class="hint">Each line is one URL. Can add name: Facebook | https://facebook.com</small>
        </div>
      </div>

    {:else if activeTab === 'resources'}
      {#if !profile}
        <div class="section">
          <div class="empty-state">
            <p>Save the profile first to add resources.</p>
            <p class="hint">Resources are account credentials for different platforms (Facebook, TikTok, Gmail...)</p>
          </div>
        </div>
      {:else if showResourceForm}
        <!-- Add/Edit Resource Form -->
        <div class="section">
          <div class="resource-form-header">
            <h3>
              {getPlatformEmoji(resourceForm.platform)}
              {editingResource ? 'Edit' : 'Add'} {getPlatformInfo(resourceForm.platform)?.name || resourceForm.platform}
            </h3>
            <button type="button" class="btn small" on:click={cancelResourceForm}>Cancel</button>
          </div>

          <div class="form-group">
            <label>Display Name</label>
            <input type="text" bind:value={resourceForm.name} placeholder="Optional - auto-generated if empty" />
          </div>

          {#if hasResourceField(resourceForm.platform, 'username')}
            <div class="form-group">
              <label>Username</label>
              <input type="text" bind:value={resourceForm.username} placeholder="@username" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'email')}
            <div class="form-group">
              <label>Email</label>
              <input type="email" bind:value={resourceForm.email} placeholder="email@example.com" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'phone')}
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" bind:value={resourceForm.phone} placeholder="+84901234567" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'password')}
            <div class="form-group">
              <label>Password</label>
              <input type="password" bind:value={resourceForm.password} placeholder="Password" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'twofa')}
            <div class="form-group">
              <label>2FA Secret</label>
              <input type="text" bind:value={resourceForm.twofa} placeholder="TOTP secret key" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'recoveryEmail')}
            <div class="form-group">
              <label>Recovery Email</label>
              <input type="email" bind:value={resourceForm.recoveryEmail} placeholder="recovery@example.com" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'token')}
            <div class="form-group">
              <label>API Token</label>
              <input type="text" bind:value={resourceForm.token} placeholder="API Token" />
            </div>
          {/if}

          {#if hasResourceField(resourceForm.platform, 'session')}
            <div class="form-group">
              <label>Session String</label>
              <textarea bind:value={resourceForm.session} placeholder="Session data" rows="3"></textarea>
            </div>
          {/if}

          <div class="form-group checkbox-row">
            <label>
              <input type="checkbox" bind:checked={resourceForm.autoLogin} />
              Auto-login when opening profile
            </label>
          </div>

          <div class="btn-row">
            <button type="button" class="btn primary" on:click={saveResourceItem}>
              {editingResource ? 'Update' : 'Add'} Resource
            </button>
          </div>
        </div>
      {:else}
        <!-- Resource List -->
        <div class="section">
          <h3>Account Credentials</h3>
          {#if resources.length === 0}
            <div class="empty-state">
              <p>No resources added yet.</p>
              <p class="hint">Click a platform below to add login credentials.</p>
            </div>
          {:else}
            <div class="resource-list">
              {#each resources as resource}
                <div class="resource-item">
                  <div class="resource-icon">{getPlatformEmoji(resource.platform)}</div>
                  <div class="resource-info">
                    <div class="resource-name">{resource.name || resource.platform}</div>
                    <div class="resource-platform">{getPlatformInfo(resource.platform)?.name || resource.platform}</div>
                  </div>
                  <div class="resource-badges">
                    <span class="status-badge active">Active</span>
                    {#if resource.autoLogin}
                      <span class="auto-badge">Auto</span>
                    {/if}
                  </div>
                  <div class="resource-actions">
                    <button type="button" class="icon-btn" on:click={() => startEditResource(resource)} title="Edit">✏️</button>
                    <button type="button" class="icon-btn danger" on:click={() => handleDeleteResource(resource.id)} title="Delete">🗑️</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Platform Selector -->
        <div class="section">
          <h3>Add Resource</h3>
          <div class="platform-grid">
            {#each resourcePlatforms as platform}
              <button type="button" class="platform-btn" on:click={() => startAddResource(platform.id)}>
                <span class="platform-icon">{getPlatformEmoji(platform.id)}</span>
                <span class="platform-name">{platform.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
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

  .os-btn.recommended {
    border-color: #4ade80;
  }

  .os-btn.recommended.active {
    border-color: #e94560;
  }

  .recommended-badge {
    font-size: 0.6rem;
    background: #4ade80;
    color: #000;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    margin-top: 0.25rem;
  }

  .os-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #3d2a1a;
    border: 1px solid #f59e0b;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #fbbf24;
  }

  .warning-icon {
    flex-shrink: 0;
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

  /* Extensions Tab */
  .section-desc {
    color: #888;
    font-size: 0.85rem;
    margin-top: -0.5rem;
  }

  .empty-extensions {
    text-align: center;
    padding: 3rem;
    color: #888;
  }

  .empty-extensions .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-extensions .hint {
    font-size: 0.85rem;
    margin-top: 0.5rem;
    color: #666;
  }

  .extension-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .extension-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .extension-item:hover {
    border-color: #e94560;
  }

  .extension-item.selected {
    border-color: #e94560;
    background: #1a2a4e;
  }

  .extension-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .extension-item .ext-icon {
    width: 36px;
    height: 36px;
    background: #1a4a7a;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    color: #888;
  }

  .extension-item .ext-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .extension-item .ext-name {
    font-weight: 500;
    color: #fff;
  }

  .extension-item .ext-version {
    font-size: 0.75rem;
    color: #4CAF50;
  }

  .info-box {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    color: #aaa;
  }

  .info-box strong {
    color: #3b82f6;
  }

  /* Tags */
  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    min-height: 32px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #e94560;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #fff;
    text-transform: uppercase;
  }

  .tag-remove {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
    opacity: 0.7;
  }

  .tag-remove:hover {
    opacity: 1;
  }

  .tag-input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .tag-input-row input {
    flex: 1;
  }

  .quick-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .quick-label {
    font-size: 0.8rem;
    color: #888;
  }

  .quick-tag {
    padding: 0.3rem 0.6rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #888;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    text-transform: capitalize;
    transition: all 0.2s;
  }

  .quick-tag:hover {
    border-color: #e94560;
    color: #fff;
  }

  .quick-tag.selected {
    background: #e94560;
    border-color: #e94560;
    color: #fff;
  }

  /* Proxy modes */
  .proxy-modes {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .proxy-mode-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .proxy-mode-option:hover {
    border-color: #e94560;
  }

  .proxy-mode-option.selected {
    border-color: #e94560;
    background: #1a2a4e;
  }

  .proxy-mode-option input {
    display: none;
  }

  .proxy-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .proxy-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .proxy-item:hover {
    border-color: #3b82f6;
  }

  .proxy-item.selected {
    border-color: #3b82f6;
    background: #1a2a4e;
  }

  .proxy-item input {
    display: none;
  }

  .proxy-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .proxy-item-name {
    font-weight: 500;
    color: #fff;
  }

  .proxy-item-detail {
    font-size: 0.75rem;
    color: #888;
  }

  .proxy-types {
    display: flex;
    gap: 0.5rem;
  }

  .proxy-type-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .proxy-type-option:hover {
    border-color: #3b82f6;
  }

  .proxy-type-option.selected {
    border-color: #3b82f6;
    background: #1a2a4e;
  }

  .proxy-type-option input {
    display: none;
  }

  .proxy-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .proxy-input-row .proxy-input {
    flex: 1;
  }

  .proxy-actions {
    margin-top: 0.5rem;
  }

  .proxy-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .proxy-result.checking {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .proxy-result.success {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .proxy-result.error {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .result-icon {
    font-size: 1.1rem;
  }

  .result-country {
    color: #888;
    margin-left: 0.25rem;
  }

  .no-proxy-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 6px;
    color: #f59e0b;
    font-size: 0.9rem;
  }

  .btn-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .hint {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.5rem;
  }

  .empty-text {
    color: #888;
    font-style: italic;
  }

  /* Extensions list in Overview */
  .extensions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .extensions-list .extension-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .extensions-list .extension-item:hover {
    border-color: #3b82f6;
  }

  .extensions-list .extension-item.selected {
    border-color: #3b82f6;
    background: #1a2a4e;
  }

  .extensions-list .extension-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .extensions-list .ext-name {
    flex: 1;
    color: #fff;
  }

  .extensions-list .ext-version {
    font-size: 0.75rem;
    color: #4CAF50;
  }

  /* Fingerprint modes (Auto/Manual) */
  .fp-modes {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .fp-mode {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 140px;
  }

  .fp-mode:hover {
    border-color: #3b82f6;
  }

  .fp-mode.selected {
    border-color: #3b82f6;
    background: #1a2a4e;
  }

  .fp-mode input {
    display: none;
  }

  .fp-mode-label {
    font-weight: 500;
    color: #fff;
    margin-bottom: 0.25rem;
  }

  .fp-mode-desc {
    font-size: 0.75rem;
    color: #888;
  }

  .auto-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 6px;
    color: #60a5fa;
    font-size: 0.85rem;
    margin-top: 0.75rem;
  }

  .info-icon {
    font-size: 1rem;
  }

  /* Mode options (WebRTC, Geolocation) */
  .mode-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mode-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-option:hover {
    border-color: #3b82f6;
  }

  .mode-option.selected {
    border-color: #3b82f6;
    background: #1a2a4e;
  }

  .mode-option input {
    display: none;
  }

  .mode-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .mode-label {
    font-weight: 500;
    color: #fff;
  }

  .mode-desc {
    font-size: 0.75rem;
    color: #888;
  }

  /* Random info display */
  .random-info {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1rem;
    background: #0f3460;
    border-radius: 6px;
    margin-top: 0.75rem;
    align-items: center;
  }

  .random-value {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .random-label {
    font-size: 0.75rem;
    color: #888;
  }

  .random-data {
    font-weight: 500;
    color: #fff;
  }

  .randomize-btn {
    margin-left: auto;
    background: #3b82f6;
    border-color: #3b82f6;
  }

  .randomize-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
  }

  .section-desc {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 0.75rem;
  }

  /* Quick Setup - PC Configs */
  .pc-configs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem;
  }

  .pc-config-btn {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    background: #0f3460;
    border: 2px solid #1a4a7a;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .pc-config-btn:hover {
    border-color: #3b82f6;
  }

  .pc-config-btn.active {
    border-color: #3b82f6;
    background: #1a2a4e;
  }

  .pc-config-btn.random {
    border-style: dashed;
    background: rgba(59, 130, 246, 0.1);
  }

  .pc-config-btn.random:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  .pc-name {
    font-weight: 500;
    color: #fff;
    font-size: 0.9rem;
  }

  .pc-specs {
    font-size: 0.7rem;
    color: #888;
  }

  /* WebGL display */
  .webgl-display {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: #0f3460;
    border-radius: 6px;
    margin-top: 0.75rem;
  }

  .webgl-label {
    font-size: 0.75rem;
    color: #888;
  }

  .webgl-value {
    font-size: 0.85rem;
    color: #22c55e;
    font-family: monospace;
    word-break: break-all;
  }

  /* Privacy options */
  .privacy-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .privacy-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .privacy-option:hover {
    border-color: #3b82f6;
  }

  .privacy-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    cursor: pointer;
  }

  .privacy-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .privacy-label {
    font-weight: 500;
    color: #fff;
  }

  .privacy-desc {
    font-size: 0.75rem;
    color: #888;
  }

  /* Verify fingerprint buttons */
  .verify-sites {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .verify-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s;
  }

  .verify-btn:hover {
    background: #1a4a7a;
    border-color: #3b82f6;
  }

  .verify-icon {
    font-size: 1rem;
  }

  .verify-name {
    font-size: 0.85rem;
    font-weight: 500;
  }

  /* Resources Tab */
  .resource-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .resource-form-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .resource-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #0f3460;
    border-radius: 8px;
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

  .resource-badges {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .status-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .status-badge.active {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .auto-badge {
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.65rem;
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
    filter: brightness(1.5);
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
    border: 1px solid #1a4a7a;
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

  .checkbox-row {
    flex-direction: row !important;
  }

  .checkbox-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    cursor: pointer;
  }

  .checkbox-row input[type="checkbox"] {
    width: auto;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .empty-state p {
    margin: 0.5rem 0;
  }
</style>
