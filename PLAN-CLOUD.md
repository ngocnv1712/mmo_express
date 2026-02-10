# MMO Express - Cloud & Enterprise Features Plan

## Overview

Kế hoạch triển khai các tính năng Cloud Sync, Team Collaboration và Distributed Execution cho MMO Express.

**Approach: Modular Design**
- Mặc định: **Single Mode** (Local-First) - miễn phí hoặc license cơ bản
- Upgrade: **Team Mode** (Cloud-Sync) - subscription

---

## Mode Comparison

| Feature | Single Mode | Team Mode |
|---------|-------------|-----------|
| Data Storage | Local (SQLite) | Cloud (Supabase) |
| Authentication | License check only | Full user account |
| Multi-device | ❌ | ✅ |
| Team sharing | ❌ | ✅ |
| Offline work | ✅ Full | ✅ With cache |
| Server cost | Minimal | Higher |
| Privacy | Maximum | Encrypted |
| Speed | Fastest | Fast |
| Price | Free / $9 | $29+ |

---

## Phase 0: Single Mode (Local-First) ⭐ PRIORITY

### 0.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SINGLE MODE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      YOUR LICENSE SERVER (Minimal)                   │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │    │
│  │  │  Auth API  │  │  License   │  │  Updates   │                     │    │
│  │  │ (login)    │  │  (verify)  │  │  (version) │                     │    │
│  │  └────────────┘  └────────────┘  └────────────┘                     │    │
│  │         │                                                            │    │
│  │         │  POST /auth/login                                          │    │
│  │         │  POST /license/verify                                      │    │
│  │         │  GET /updates/check                                        │    │
│  └─────────┼────────────────────────────────────────────────────────────┘    │
│            │                                                                  │
│            │ (Only auth/license - NO data sync)                              │
│            │                                                                  │
│  ┌─────────▼────────────────────────────────────────────────────────────┐    │
│  │                        USER'S MACHINE (All Data)                     │    │
│  │                                                                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │   Tauri     │  │   SQLite    │  │  Playwright │                  │    │
│  │  │   (Rust)    │  │   (Local)   │  │  (Sidecar)  │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  │        │                │                 │                          │    │
│  │        │    ┌───────────┴───────────┐    │                          │    │
│  │        │    │                       │    │                          │    │
│  │        ▼    ▼                       ▼    ▼                          │    │
│  │  ┌─────────────────────────────────────────────────────────┐        │    │
│  │  │                    LOCAL DATA                            │        │    │
│  │  │  • Profiles (fingerprint config)                        │        │    │
│  │  │  • Proxies (credentials)                                │        │    │
│  │  │  • Workflows (automation scripts)                       │        │    │
│  │  │  • Cookies (browser sessions)                           │        │    │
│  │  │  • Screenshots                                          │        │    │
│  │  └─────────────────────────────────────────────────────────┘        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 0.2 License Server (Minimal Backend)

**Chỉ cần 3 endpoints:**

```javascript
// server/routes/auth.js (Express)
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Verify credentials
  const user = await db.findUser(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check license
  const license = await db.getLicense(user.id);
  if (!license || license.expires_at < new Date()) {
    return res.status(403).json({ error: 'License expired' });
  }

  // Generate token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      plan: license.plan,  // 'single', 'team', 'enterprise'
      expiresAt: license.expires_at
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }  // Long-lived for offline use
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: license.plan,
      features: getFeatures(license.plan)
    }
  });
});

// POST /license/verify (periodic check)
router.post('/verify', authMiddleware, async (req, res) => {
  const license = await db.getLicense(req.user.userId);

  res.json({
    valid: license && license.expires_at > new Date(),
    plan: license?.plan,
    expiresAt: license?.expires_at,
    features: getFeatures(license?.plan)
  });
});

// GET /updates/check
router.get('/check', async (req, res) => {
  const { currentVersion, platform } = req.query;
  const latest = await db.getLatestVersion(platform);

  res.json({
    hasUpdate: latest.version !== currentVersion,
    latestVersion: latest.version,
    downloadUrl: latest.download_url,
    releaseNotes: latest.notes
  });
});

function getFeatures(plan) {
  const features = {
    single: {
      maxProfiles: 100,
      maxProxies: 50,
      maxWorkflows: 20,
      cloudSync: false,
      teamSharing: false,
      parallelExecution: 3,
      support: 'community'
    },
    pro: {
      maxProfiles: 500,
      maxProxies: 200,
      maxWorkflows: 100,
      cloudSync: true,
      teamSharing: false,
      parallelExecution: 10,
      support: 'email'
    },
    team: {
      maxProfiles: -1,  // unlimited
      maxProxies: -1,
      maxWorkflows: -1,
      cloudSync: true,
      teamSharing: true,
      parallelExecution: 50,
      support: 'priority'
    }
  };
  return features[plan] || features.single;
}
```

**Database schema (minimal):**
```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- licenses table
CREATE TABLE licenses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plan VARCHAR(50) NOT NULL,  -- single, pro, team
  license_key VARCHAR(255) UNIQUE,
  hardware_id VARCHAR(255),  -- Optional: lock to machine
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- app_versions table (for updates)
CREATE TABLE app_versions (
  id UUID PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  platform VARCHAR(50) NOT NULL,  -- windows, linux, macos
  download_url TEXT,
  notes TEXT,
  released_at TIMESTAMP DEFAULT NOW()
);
```

### 0.3 Client-Side License Check

```javascript
// sidecar/license/manager.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class LicenseManager {
  constructor(options) {
    this.serverUrl = options.serverUrl || 'https://api.mmoexpress.io';
    this.tokenFile = path.join(os.homedir(), '.mmo-express', 'license.json');
    this.token = null;
    this.user = null;
    this.features = null;
    this.offlineGracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  async init() {
    // Try to load saved token
    try {
      const data = await fs.readFile(this.tokenFile, 'utf-8');
      const saved = JSON.parse(data);
      this.token = saved.token;
      this.user = saved.user;
      this.features = saved.features;
      this.lastVerified = new Date(saved.lastVerified);

      // Check if can work offline
      if (this.canWorkOffline()) {
        console.log('[LICENSE] Working offline with cached license');
        return { success: true, offline: true };
      }
    } catch (e) {
      // No saved token
    }

    return { success: false, needsLogin: true };
  }

  canWorkOffline() {
    if (!this.token || !this.lastVerified) return false;

    const elapsed = Date.now() - this.lastVerified.getTime();
    return elapsed < this.offlineGracePeriod;
  }

  async login(email, password) {
    try {
      const response = await fetch(`${this.serverUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error };
      }

      const data = await response.json();
      this.token = data.token;
      this.user = data.user;
      this.features = data.user.features;
      this.lastVerified = new Date();

      // Save for offline use
      await this.saveToken();

      return { success: true, user: this.user };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  async verify() {
    if (!this.token) return { valid: false };

    try {
      const response = await fetch(`${this.serverUrl}/license/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        return { valid: false };
      }

      const data = await response.json();
      this.features = data.features;
      this.lastVerified = new Date();
      await this.saveToken();

      return { valid: data.valid, features: data.features };
    } catch (error) {
      // Network error - allow offline if within grace period
      return { valid: this.canWorkOffline(), offline: true };
    }
  }

  async saveToken() {
    const dir = path.dirname(this.tokenFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.tokenFile, JSON.stringify({
      token: this.token,
      user: this.user,
      features: this.features,
      lastVerified: this.lastVerified.toISOString()
    }));
  }

  async logout() {
    this.token = null;
    this.user = null;
    this.features = null;
    try {
      await fs.unlink(this.tokenFile);
    } catch (e) {}
  }

  // Feature checks
  checkLimit(feature, currentCount) {
    const limit = this.features?.[feature];
    if (limit === -1) return true;  // unlimited
    return currentCount < limit;
  }

  canUseCloudSync() {
    return this.features?.cloudSync === true;
  }

  canUseTeamSharing() {
    return this.features?.teamSharing === true;
  }
}

module.exports = LicenseManager;
```

### 0.4 Offline-First Data Storage

```javascript
// Tất cả data lưu local - không cần internet sau khi login

// sidecar/storage/local.js
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

class LocalStorage {
  constructor() {
    const dataDir = path.join(os.homedir(), '.mmo-express', 'data');
    this.db = new Database(path.join(dataDir, 'mmo-express.db'));
    this.initTables();
  }

  initTables() {
    this.db.exec(`
      -- Profiles
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        browser_type TEXT DEFAULT 'chromium',
        fingerprint_config TEXT,  -- JSON
        proxy_id TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Proxies
      CREATE TABLE IF NOT EXISTS proxies (
        id TEXT PRIMARY KEY,
        name TEXT,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        type TEXT DEFAULT 'http',
        username TEXT,
        password TEXT,
        status TEXT DEFAULT 'unknown',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Workflows
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps TEXT NOT NULL,  -- JSON
        variables TEXT,  -- JSON
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Profile Sessions (cookies, localStorage)
      CREATE TABLE IF NOT EXISTS profile_sessions (
        profile_id TEXT PRIMARY KEY,
        cookies TEXT,  -- JSON
        local_storage TEXT,  -- JSON
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Execution History
      CREATE TABLE IF NOT EXISTS execution_history (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        profile_ids TEXT,  -- JSON array
        status TEXT,
        started_at TEXT,
        completed_at TEXT,
        results TEXT  -- JSON
      );
    `);
  }

  // Profile methods
  getProfiles() {
    return this.db.prepare('SELECT * FROM profiles ORDER BY updated_at DESC').all();
  }

  getProfile(id) {
    return this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  }

  saveProfile(profile) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO profiles (id, name, browser_type, fingerprint_config, proxy_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      profile.id,
      profile.name,
      profile.browser_type,
      JSON.stringify(profile.fingerprint_config),
      profile.proxy_id,
      profile.status
    );
  }

  deleteProfile(id) {
    this.db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM profile_sessions WHERE profile_id = ?').run(id);
  }

  // Similar methods for proxies, workflows...
}

module.exports = LocalStorage;
```

### 0.5 Login UI (Svelte)

```svelte
<!-- src/lib/Login.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  export let sidecarUrl = 'http://localhost:3456';

  const dispatch = createEventDispatcher();

  let email = '';
  let password = '';
  let loading = false;
  let error = null;

  async function handleLogin() {
    loading = true;
    error = null;

    try {
      const response = await fetch(sidecarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email,
          password
        })
      });

      const result = await response.json();

      if (result.success) {
        dispatch('login', result.user);
      } else {
        error = result.error || 'Login failed';
      }
    } catch (err) {
      error = 'Cannot connect to server';
    } finally {
      loading = false;
    }
  }

  async function handleOfflineMode() {
    // Check if can work offline
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkOffline' })
    });

    const result = await response.json();

    if (result.canWorkOffline) {
      dispatch('login', { ...result.user, offline: true });
    } else {
      error = 'No valid offline license. Please login.';
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <h2>🔐 MMO Express</h2>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <form on:submit|preventDefault={handleLogin}>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          bind:value={email}
          placeholder="your@email.com"
          required
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          placeholder="••••••••"
          required
        />
      </div>

      <button type="submit" class="btn btn-primary" disabled={loading}>
        {loading ? '⏳ Logging in...' : '🚀 Login'}
      </button>
    </form>

    <div class="divider">or</div>

    <button class="btn btn-secondary" on:click={handleOfflineMode}>
      💾 Work Offline
    </button>

    <p class="hint">
      Don't have an account?
      <a href="https://mmoexpress.io/register" target="_blank">Register</a>
    </p>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: var(--bg-primary, #121212);
  }

  .login-card {
    background: var(--bg-secondary, #1a1a1a);
    padding: 40px;
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  h2 {
    text-align: center;
    margin-bottom: 24px;
    color: var(--text-primary, #fff);
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary, #888);
    font-size: 14px;
  }

  input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    background: var(--bg-tertiary, #252525);
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #2563eb);
  }

  .btn-secondary {
    background: var(--bg-tertiary, #252525);
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, #333);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .divider {
    text-align: center;
    margin: 16px 0;
    color: var(--text-secondary, #888);
    font-size: 12px;
  }

  .error-message {
    background: #f87171;
    color: white;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .hint {
    text-align: center;
    margin-top: 16px;
    color: var(--text-secondary, #888);
    font-size: 13px;
  }

  .hint a {
    color: var(--accent-color, #3b82f6);
    text-decoration: none;
  }
</style>
```

### 0.6 App Flow với License Check

```svelte
<!-- src/App.svelte -->
<script>
  import { onMount } from 'svelte';
  import Login from './lib/Login.svelte';
  import MainApp from './lib/MainApp.svelte';

  let user = null;
  let loading = true;
  let sidecarUrl = 'http://localhost:3456';

  onMount(async () => {
    // Check for existing session
    try {
      const response = await fetch(sidecarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkSession' })
      });

      const result = await response.json();

      if (result.loggedIn) {
        user = result.user;
      }
    } catch (err) {
      console.error('Failed to check session:', err);
    } finally {
      loading = false;
    }
  });

  function handleLogin(event) {
    user = event.detail;
  }

  async function handleLogout() {
    await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
    user = null;
  }
</script>

{#if loading}
  <div class="loading">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{:else if user}
  <MainApp {user} {sidecarUrl} on:logout={handleLogout} />
{:else}
  <Login {sidecarUrl} on:login={handleLogin} />
{/if}
```

### 0.7 Upgrade to Team Mode (Upsell)

```svelte
<!-- src/lib/UpgradeModal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  export let currentPlan = 'single';
  export let sidecarUrl;

  const dispatch = createEventDispatcher();

  let migrating = false;
  let progress = 0;
  let error = null;

  async function startMigration() {
    migrating = true;
    progress = 0;
    error = null;

    try {
      // Step 1: Export local data
      progress = 10;
      const localData = await exportLocalData();

      // Step 2: Upload to cloud
      progress = 30;
      await uploadToCloud(localData.profiles, 'profiles');

      progress = 50;
      await uploadToCloud(localData.proxies, 'proxies');

      progress = 70;
      await uploadToCloud(localData.workflows, 'workflows');

      progress = 90;
      await uploadToCloud(localData.sessions, 'sessions');

      // Step 3: Enable cloud sync
      progress = 100;
      await enableCloudSync();

      dispatch('upgraded');
    } catch (err) {
      error = err.message;
    } finally {
      migrating = false;
    }
  }

  async function exportLocalData() {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exportAllData' })
    });
    return response.json();
  }

  async function uploadToCloud(data, type) {
    // Upload to Supabase
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'uploadToCloud',
        type,
        data
      })
    });
    return response.json();
  }

  async function enableCloudSync() {
    const response = await fetch(sidecarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enableCloudSync' })
    });
    return response.json();
  }
</script>

<div class="upgrade-modal">
  <h2>⬆️ Upgrade to Team Plan</h2>

  <div class="features">
    <h3>What you'll get:</h3>
    <ul>
      <li>☁️ Cloud Sync across all devices</li>
      <li>👥 Team collaboration & sharing</li>
      <li>🔄 Real-time sync</li>
      <li>📊 Advanced analytics</li>
      <li>🚀 50 parallel executions</li>
      <li>💬 Priority support</li>
    </ul>
  </div>

  {#if migrating}
    <div class="migration-progress">
      <p>Migrating your data to cloud...</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
      <span>{progress}%</span>
    </div>
  {:else}
    <div class="pricing">
      <span class="price">$29</span>
      <span class="period">/month</span>
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <button class="btn btn-primary" on:click={startMigration}>
      🚀 Upgrade Now & Migrate Data
    </button>

    <p class="note">
      Your local data will be migrated to cloud storage.
      You can cancel anytime.
    </p>
  {/if}
</div>
```

### 0.8 Feature Gating

```javascript
// Kiểm tra feature trước khi cho phép action
// sidecar/middleware/featureGate.js

function checkFeature(user, feature) {
  const features = user.features;

  switch (feature) {
    case 'create_profile':
      const profileCount = db.getProfileCount();
      if (features.maxProfiles !== -1 && profileCount >= features.maxProfiles) {
        return {
          allowed: false,
          reason: `Profile limit reached (${features.maxProfiles}). Upgrade to create more.`
        };
      }
      break;

    case 'cloud_sync':
      if (!features.cloudSync) {
        return {
          allowed: false,
          reason: 'Cloud Sync is not available in your plan. Upgrade to Team plan.'
        };
      }
      break;

    case 'team_sharing':
      if (!features.teamSharing) {
        return {
          allowed: false,
          reason: 'Team Sharing requires Team plan.'
        };
      }
      break;

    case 'parallel_execution':
      const requestedParallel = arguments[2] || 1;
      if (requestedParallel > features.parallelExecution) {
        return {
          allowed: false,
          reason: `Max ${features.parallelExecution} parallel executions in your plan.`
        };
      }
      break;
  }

  return { allowed: true };
}

// Usage in command handler
case 'createProfile':
  const check = checkFeature(user, 'create_profile');
  if (!check.allowed) {
    return { success: false, error: check.reason, needUpgrade: true };
  }
  // ... create profile
  break;
```

---

## Architecture Evolution

### Current: Standalone App (No Cloud)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER'S MACHINE                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TAURI APP                                    │    │
│  │                                                                      │    │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │    │
│  │  │   Svelte     │◄──►│    Rust      │◄──►│   SQLite     │          │    │
│  │  │  Frontend    │    │   Backend    │    │   Database   │          │    │
│  │  └──────────────┘    └──────────────┘    └──────────────┘          │    │
│  │         │                   │                                       │    │
│  │         │                   │ IPC                                   │    │
│  │         │                   ▼                                       │    │
│  │         │            ┌──────────────┐                               │    │
│  │         │            │   Sidecar    │                               │    │
│  │         └───────────►│  (Node.js)   │                               │    │
│  │                      │  Playwright  │                               │    │
│  │                      └──────────────┘                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Data: profiles.db, schedules.json, screenshots/                            │
│  Location: ~/.mmo-express/ hoặc AppData                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

✅ Ưu điểm: Đơn giản, không cần server, miễn phí
❌ Nhược điểm: Không license, không sync, không team
```

---

### Phase 0: Single Mode (License Only)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LICENSE SERVER (Minimal)                             │
│                              (Your VPS)                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Node.js + PostgreSQL                         │    │
│  │                                                                      │    │
│  │  POST /auth/login        ─── Verify email/password                  │    │
│  │  POST /license/verify    ─── Check license valid                    │    │
│  │  GET  /updates/check     ─── Check app version                      │    │
│  │                                                                      │    │
│  │  Database: users, licenses, app_versions (3 tables)                 │    │
│  │  Cost: ~$5/month (smallest VPS)                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (chỉ khi login/verify)
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                            USER'S MACHINE                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TAURI APP                                    │    │
│  │                                                                      │    │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │    │
│  │  │   Svelte     │    │    Rust      │    │   SQLite     │          │    │
│  │  │  Frontend    │    │   Backend    │    │   (Local)    │          │    │
│  │  │  + Login UI  │    │  + License   │    │  ALL DATA    │          │    │
│  │  └──────────────┘    └──────────────┘    └──────────────┘          │    │
│  │         │                   │                   │                   │    │
│  │         │                   ▼                   │                   │    │
│  │         │            ┌──────────────┐          │                   │    │
│  │         └───────────►│   Sidecar    │◄─────────┘                   │    │
│  │                      │  (Node.js)   │                               │    │
│  │                      └──────────────┘                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Data vẫn 100% local, chỉ license check qua server                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

✅ Ưu điểm: License control, offline work (7 ngày), data private
✅ Server cost: Rất thấp (~$5/mo)
❌ Nhược điểm: Chưa sync, chưa team
```

---

### Phase 1: Cloud Sync (Pro Plan)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
│                         (Managed Backend)                                    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Supabase    │  │  PostgreSQL  │  │  Supabase    │  │  Supabase    │    │
│  │    Auth      │  │   Database   │  │   Storage    │  │  Realtime    │    │
│  │              │  │              │  │              │  │              │    │
│  │ • Email/Pass │  │ • users      │  │ • screenshots│  │ • Live sync  │    │
│  │ • Google     │  │ • profiles   │  │ • backups    │  │ • Presence   │    │
│  │ • JWT        │  │ • workflows  │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTPS + WebSocket
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   DEVICE 1      │          │   DEVICE 2      │          │   DEVICE 3      │
│   (Desktop)     │◄────────►│   (Laptop)      │◄────────►│   (VPS)         │
│                 │   Sync   │                 │   Sync   │                 │
│ ┌─────────────┐ │          │ ┌─────────────┐ │          │ ┌─────────────┐ │
│ │ Tauri App   │ │          │ │ Tauri App   │ │          │ │ Tauri App   │ │
│ │ + SyncMgr   │ │          │ │ + SyncMgr   │ │          │ │ + SyncMgr   │ │
│ └─────────────┘ │          │ └─────────────┘ │          │ └─────────────┘ │
│ SQLite (cache)  │          │ SQLite (cache)  │          │ SQLite (cache)  │
└─────────────────┘          └─────────────────┘          └─────────────────┘

✅ Ưu điểm: Multi-device sync, real-time, managed infrastructure
✅ Server cost: ~$25/mo (Supabase Pro) hoặc free tier
```

---

### Phase 2: Team Mode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SHARED DATABASE                              │    │
│  │                                                                      │    │
│  │  organizations ──► teams ──► team_members                           │    │
│  │        │                                                             │    │
│  │        ▼                                                             │    │
│  │  profiles (shared)    workflows (shared)    proxies (shared)        │    │
│  │  • org_id             • org_id              • org_id                │    │
│  │  • assigned_to        • created_by          • encrypted             │    │
│  │  • is_running                                                        │    │
│  │                                                                      │    │
│  │  Row Level Security (RLS):                                          │    │
│  │  • User chỉ thấy data của org mình                                  │    │
│  │  • Staff chỉ thấy profiles được assigned                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
            │    ADMIN      │ │   STAFF   │ │    VIEWER     │
            │ • Full access │ │ • Run only│ │ • Read only   │
            │ • Manage team │ │ • Assigned│ │ • View stats  │
            └───────────────┘ └───────────┘ └───────────────┘

✅ Ưu điểm: Collaboration, RBAC, Activity log
✅ Server cost: ~$25-50/mo
```

---

### Phase 3: Distributed Execution (Enterprise)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COORDINATOR SERVER                                 │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Task API   │  │ Task Queue   │  │   Workers    │  │  Monitoring  │    │
│  │              │  │   (Redis)    │  │   Registry   │  │  Dashboard   │    │
│  │ POST /exec   │  │              │  │              │  │              │    │
│  │ GET /status  │  │ ┌──────────┐ │  │ Worker 1: 3  │  │ Real-time    │    │
│  │              │  │ │ Task 1   │ │  │ Worker 2: 5  │  │ stats        │    │
│  │              │  │ │ Task 2   │ │  │ Worker 3: 2  │  │              │    │
│  │              │  │ └──────────┘ │  │ Total: 10    │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
            │  WORKER 1     │ │ WORKER 2  │ │  WORKER 3     │
            │  (Office)     │ │  (VPS)    │ │  (Home)       │
            │  3 browsers   │ │ 5 browsers│ │  2 browsers   │
            └───────────────┘ └───────────┘ └───────────────┘

100 profiles → Split → 10 workers → ~5 min (vs 30 min sequential)

✅ Ưu điểm: Massive parallel execution, fault tolerance
✅ Server cost: ~$125/mo
```

---

## Components by Phase

| Component | Current | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|-----------|:-------:|:-------:|:-------:|:-------:|:-------:|
| **Frontend** |
| Login UI | ❌ | ✅ | ✅ | ✅ | ✅ |
| Sync UI | ❌ | ❌ | ✅ | ✅ | ✅ |
| Team UI | ❌ | ❌ | ❌ | ✅ | ✅ |
| Monitor UI | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Sidecar** |
| LicenseManager | ❌ | ✅ | ✅ | ✅ | ✅ |
| SyncManager | ❌ | ❌ | ✅ | ✅ | ✅ |
| TeamManager | ❌ | ❌ | ❌ | ✅ | ✅ |
| WorkerAgent | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Server** |
| License API | ❌ | ✅ | ✅ | ✅ | ✅ |
| Supabase | ❌ | ❌ | ✅ | ✅ | ✅ |
| Coordinator | ❌ | ❌ | ❌ | ❌ | ✅ |
| Redis | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Infrastructure Cost by Phase

| Phase | Server | Database | Storage | Total/month |
|-------|--------|----------|---------|-------------|
| Current | $0 | $0 | $0 | **$0** |
| Phase 0 | $5 (VPS) | $0 (incl) | $0 | **~$5** |
| Phase 1 | $0 | $25 (Supabase) | $5 | **~$30** |
| Phase 2 | $0 | $25 | $10 | **~$35** |
| Phase 3 | $50 | $25 | $20 + Redis $30 | **~$125** |

---

## Migration Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT ──────► PHASE 0                                                    │
│                                                                              │
│  • Add LicenseManager to sidecar                                            │
│  • Add Login UI                                                             │
│  • Deploy minimal server (3 endpoints)                                      │
│  • NO database changes, NO breaking changes                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 0 ──────► PHASE 1                                                    │
│                                                                              │
│  • Setup Supabase project                                                   │
│  • Add SyncManager to sidecar                                               │
│  • User clicks "Enable Cloud Sync" → Migration                              │
│  • Keep SQLite as local cache                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 1 ──────► PHASE 2                                                    │
│                                                                              │
│  • Add org_id to existing tables                                            │
│  • Create teams/members tables                                              │
│  • Add TeamManager, RLS policies                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 2 ──────► PHASE 3                                                    │
│                                                                              │
│  • Deploy Coordinator + Redis                                               │
│  • Add WorkerAgent mode to sidecar                                          │
│  • Configure distributed workers                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview (Full System)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MMO EXPRESS CLOUD                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         COORDINATOR SERVER                            │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │   │
│  │  │  Auth API  │ │  Sync API  │ │  Task API  │ │  Team API  │        │   │
│  │  │   (JWT)    │ │            │ │            │ │            │        │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │   │
│  │         │              │              │              │               │   │
│  │         └──────────────┴──────────────┴──────────────┘               │   │
│  │                                 │                                     │   │
│  │  ┌──────────────────────────────┴──────────────────────────────┐     │   │
│  │  │                        DATA LAYER                            │     │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │     │   │
│  │  │  │ PostgreSQL │  │   Redis    │  │  S3/R2     │             │     │   │
│  │  │  │ (Main DB)  │  │  (Queue)   │  │ (Storage)  │             │     │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘             │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    │               │               │                        │
│            ┌───────┴───────┐ ┌─────┴─────┐ ┌───────┴───────┐               │
│            │   Client 1    │ │  Client 2 │ │   Client 3    │               │
│            │   (Desktop)   │ │  (Laptop) │ │    (VPS)      │               │
│            │               │ │           │ │               │               │
│            │ ┌───────────┐ │ │┌─────────┐│ │ ┌───────────┐ │               │
│            │ │  Worker   │ │ ││ Worker  ││ │ │  Worker   │ │               │
│            │ │ (3 slots) │ │ ││(2 slots)││ │ │ (5 slots) │ │               │
│            │ └───────────┘ │ │└─────────┘│ │ └───────────┘ │               │
│            └───────────────┘ └───────────┘ └───────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Cloud Sync (Basic)

### 1.1 User Authentication

**Files to create:**
```
server/
├── src/
│   ├── index.ts                 # Express server entry
│   ├── config.ts                # Environment config
│   ├── routes/
│   │   ├── auth.ts              # Auth routes
│   │   ├── sync.ts              # Sync routes
│   │   └── devices.ts           # Device management
│   ├── services/
│   │   ├── auth.service.ts      # Auth logic
│   │   ├── sync.service.ts      # Sync logic
│   │   └── token.service.ts     # JWT handling
│   ├── models/
│   │   ├── user.ts
│   │   ├── device.ts
│   │   └── sync-data.ts
│   └── middleware/
│       ├── auth.ts              # JWT middleware
│       └── rate-limit.ts
└── package.json

sidecar/
├── cloud/
│   ├── index.js                 # Cloud module entry
│   ├── auth.js                  # Login/register
│   ├── sync.js                  # Sync manager
│   └── storage.js               # Local token storage
```

**Database Schema:**
```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  storage_used BIGINT DEFAULT 0,
  storage_limit BIGINT DEFAULT 104857600,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  platform VARCHAR(50),
  app_version VARCHAR(20),
  last_sync TIMESTAMP,
  last_ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_name)
);

-- profiles table (với locking và assignment)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  browser_type VARCHAR(50) DEFAULT 'chromium',
  fingerprint_config JSONB,  -- User-Agent, Canvas, WebGL, etc.
  proxy_id UUID REFERENCES proxies(id),
  status VARCHAR(50) DEFAULT 'active',

  -- Locking fields
  is_running BOOLEAN DEFAULT false,
  running_by UUID REFERENCES users(id),
  running_on VARCHAR(255),  -- device_id
  running_since TIMESTAMP,

  -- Assignment
  assigned_to UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Profile sessions (cookies, localStorage)
CREATE TABLE profile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cookies_encrypted TEXT,  -- Encrypted cookie data
  storage_encrypted TEXT,  -- Encrypted localStorage
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- Profile assignments (many-to-many)
CREATE TABLE profile_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(50) DEFAULT 'run',  -- run, edit, full
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(profile_id, user_id)
);

-- refresh_tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**
```
POST   /api/auth/register        # Register new user
POST   /api/auth/login           # Login → JWT + refresh token
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/logout          # Invalidate refresh token
POST   /api/auth/forgot-password # Send reset email
POST   /api/auth/reset-password  # Reset with token

GET    /api/devices              # List user's devices
DELETE /api/devices/:id          # Remove device
```

**Implementation Tasks:**
- [ ] Setup Express + TypeScript server
- [ ] Setup PostgreSQL with migrations
- [ ] Implement user registration with email validation
- [ ] Implement login with JWT (access + refresh tokens)
- [ ] Implement device registration
- [ ] Add rate limiting
- [ ] Add password reset flow
- [ ] Client: Add login/register UI in Settings
- [ ] Client: Store tokens securely
- [ ] Client: Auto-refresh token before expiry

**Estimated: 3-4 days**

---

### 1.2 Basic Data Sync

**Database Schema:**
```sql
-- sync_data table (stores user's synced data)
CREATE TABLE sync_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL,  -- profiles, workflows, proxies, settings
  data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  checksum VARCHAR(64),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, data_type)
);

-- sync_history table (for conflict resolution)
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL,
  operation VARCHAR(20) NOT NULL,  -- full_sync, add, update, delete
  item_id VARCHAR(255),
  previous_checksum VARCHAR(64),
  new_checksum VARCHAR(64),
  device_id UUID REFERENCES devices(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**
```
GET    /api/sync/status          # Get sync status for all data types
GET    /api/sync/:type           # Get data (profiles, workflows, etc)
POST   /api/sync/:type           # Upload/replace data
GET    /api/sync/:type/checksum  # Get checksum only (fast check)
```

**Dữ liệu KHÔNG nên sync:**
```
❌ Chrome Cache folder (hàng GB, không cần thiết)
❌ Browser extensions binaries (tải lại từ CRX)
❌ Screenshot files (lưu local hoặc S3 riêng)
❌ Log files
```

**Dữ liệu NÊN sync:**
```
✅ Profile config (JSON) - fingerprint settings
✅ Cookies (encrypted) - duy trì session login
✅ LocalStorage (encrypted) - app state
✅ Workflow definitions (JSON)
✅ Proxy list (encrypted credentials)
```

**Sync Strategy (Full Sync):**
```javascript
// Client-side sync logic
async function syncData(dataType) {
  // 1. Get local data and calculate checksum
  const localData = await getLocalData(dataType);
  const localChecksum = calculateChecksum(localData);

  // 2. Get server checksum
  const serverStatus = await api.get(`/sync/${dataType}/checksum`);

  // 3. Compare
  if (serverStatus.checksum === localChecksum) {
    return { status: 'up-to-date' };
  }

  // 4. Determine direction based on timestamps
  if (serverStatus.updatedAt > localLastSync) {
    // Pull from server
    const serverData = await api.get(`/sync/${dataType}`);
    await saveLocalData(dataType, serverData);
    return { status: 'pulled', count: serverData.length };
  } else {
    // Push to server
    await api.post(`/sync/${dataType}`, { data: localData });
    return { status: 'pushed', count: localData.length };
  }
}
```

**Implementation Tasks:**
- [ ] Server: Implement sync endpoints
- [ ] Server: Add checksum calculation
- [ ] Server: Store sync history
- [ ] Client: Implement SyncManager class
- [ ] Client: Add sync button in UI
- [ ] Client: Show sync status indicator
- [ ] Client: Handle sync conflicts (last-write-wins initially)
- [ ] Client: Auto-sync on app start (if logged in)

**Estimated: 3-4 days**

---

### 1.3 Multi-Device Support

**Features:**
- Device registration và management
- Sync across multiple devices
- Device-specific settings
- Remote logout

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ☁️ Cloud Sync                                    [Sync Now]     │
├─────────────────────────────────────────────────────────────────┤
│ Status: ✅ Synced                    Last sync: 2 minutes ago   │
├─────────────────────────────────────────────────────────────────┤
│ Your Devices (3)                                                │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 🖥️ Office-PC (this device)                              │    │
│ │    Windows 11 • Last active: Now                        │    │
│ ├─────────────────────────────────────────────────────────┤    │
│ │ 💻 Home-Laptop                               [Remove]   │    │
│ │    Windows 10 • Last active: 2 hours ago                │    │
│ ├─────────────────────────────────────────────────────────┤    │
│ │ 🖥️ VPS-Server                                [Remove]   │    │
│ │    Ubuntu 22.04 • Last active: 5 minutes ago            │    │
│ └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│ Sync Settings                                                   │
│ ☑️ Auto-sync on startup                                         │
│ ☑️ Sync profiles                                                │
│ ☑️ Sync workflows                                               │
│ ☑️ Sync proxies                                                 │
│ ☐ Sync cookies (large data)                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Tasks:**
- [ ] Server: Track device info on login
- [ ] Server: Update last_sync on each sync
- [ ] Client: Show device list
- [ ] Client: Allow removing other devices
- [ ] Client: Add sync settings (what to sync)
- [ ] Client: Show sync progress

**Estimated: 2 days**

---

### 1.4 End-to-End Encryption (Optional)

**Flow:**
```
User Password → PBKDF2 → Encryption Key
                              │
                              ▼
Local Data → AES-256-GCM → Encrypted Data → Server
                              │
                              ▼
                    Server stores encrypted blob
                    (cannot read user data)
```

**Implementation:**
```javascript
class EncryptedSync {
  async deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
  }

  async decrypt(encrypted, key) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
      key,
      new Uint8Array(encrypted.data)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}
```

**Implementation Tasks:**
- [ ] Client: Implement encryption/decryption
- [ ] Client: Derive key from password
- [ ] Client: Store salt securely
- [ ] Server: Store encrypted blobs
- [ ] Handle key rotation

**Estimated: 2-3 days**

---

## Phase 2: Team Collaboration

### 2.1 Organization & Team Structure

**Database Schema:**
```sql
-- organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  owner_id UUID REFERENCES users(id),
  plan VARCHAR(50) DEFAULT 'team',
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

-- teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- team_members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',  -- owner, admin, member, viewer
  joined_at TIMESTAMP DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  UNIQUE(team_id, user_id)
);

-- invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Roles & Permissions:**
```javascript
const ROLES = {
  owner: {
    name: 'Owner',
    permissions: ['*']
  },
  admin: {
    name: 'Admin',
    permissions: [
      'team.invite',
      'team.remove',
      'team.settings',
      'resources.*'
    ]
  },
  member: {
    name: 'Member',
    permissions: [
      'resources.read',
      'resources.create',
      'resources.update',
      'executions.run'
    ]
  },
  viewer: {
    name: 'Viewer',
    permissions: [
      'resources.read',
      'executions.read'
    ]
  }
};
```

**API Endpoints:**
```
# Organizations
POST   /api/orgs                 # Create organization
GET    /api/orgs/:id             # Get org details
PUT    /api/orgs/:id             # Update org
DELETE /api/orgs/:id             # Delete org (owner only)

# Teams
POST   /api/orgs/:orgId/teams    # Create team
GET    /api/orgs/:orgId/teams    # List teams
PUT    /api/teams/:id            # Update team
DELETE /api/teams/:id            # Delete team

# Members
GET    /api/teams/:id/members    # List members
POST   /api/teams/:id/invite     # Invite member
PUT    /api/teams/:id/members/:userId  # Update role
DELETE /api/teams/:id/members/:userId  # Remove member

# Invitations
POST   /api/invitations/:token/accept  # Accept invite
DELETE /api/invitations/:id            # Cancel invite
```

**Implementation Tasks:**
- [ ] Server: Create org/team/member tables
- [ ] Server: Implement RBAC middleware
- [ ] Server: Implement invitation system
- [ ] Client: Add team management UI
- [ ] Client: Add invitation flow
- [ ] Client: Show team indicator in header

**Estimated: 3-4 days**

---

### 2.2 Resource Sharing

**Database Schema:**
```sql
-- shared_resources table
CREATE TABLE shared_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,  -- profile, workflow, proxy
  resource_id VARCHAR(255) NOT NULL,
  resource_data JSONB,  -- Cached resource data
  shared_by UUID REFERENCES users(id),
  permission VARCHAR(50) DEFAULT 'read',  -- read, edit, full
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, resource_type, resource_id)
);

-- resource_versions table (for tracking changes)
CREATE TABLE resource_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES shared_resources(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  changed_by UUID REFERENCES users(id),
  change_type VARCHAR(50),  -- create, update, delete
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**
```
# Sharing
POST   /api/teams/:id/share      # Share resource with team
DELETE /api/teams/:id/share/:resourceId  # Unshare

# Shared resources
GET    /api/teams/:id/resources  # List shared resources
GET    /api/teams/:id/resources/:type  # List by type
GET    /api/shared/:resourceId   # Get shared resource
PUT    /api/shared/:resourceId   # Update shared resource
```

**Implementation Tasks:**
- [ ] Server: Implement sharing endpoints
- [ ] Server: Track resource versions
- [ ] Client: Add "Share" button to profiles/workflows
- [ ] Client: Show shared resources in separate section
- [ ] Client: Handle permission checks
- [ ] Client: Show "shared by" indicator

**Estimated: 2-3 days**

---

### 2.3 Activity Log & Notifications

**Database Schema:**
```sql
-- activity_log table
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  resource_name VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_activity_org_time ON activity_log(org_id, created_at DESC);
CREATE INDEX idx_activity_team_time ON activity_log(team_id, created_at DESC);
```

**Activity Types:**
```javascript
const ACTIVITY_TYPES = {
  // Team
  'team.member_joined': 'Member joined team',
  'team.member_left': 'Member left team',
  'team.member_role_changed': 'Member role changed',

  // Resources
  'resource.shared': 'Resource shared',
  'resource.updated': 'Resource updated',
  'resource.deleted': 'Resource deleted',

  // Executions
  'execution.started': 'Workflow execution started',
  'execution.completed': 'Workflow execution completed',
  'execution.failed': 'Workflow execution failed'
};
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Team Activity                                    [Filter ▼]  │
├─────────────────────────────────────────────────────────────────┤
│ Today                                                            │
│ ├─ 🚀 John started "Login Facebook" on 50 profiles    2m ago   │
│ ├─ 📤 Jane shared workflow "Check Proxy"              15m ago  │
│ ├─ ✅ John's execution completed (48/50 success)      18m ago  │
│ └─ 👤 Bob joined the team                             1h ago   │
│                                                                  │
│ Yesterday                                                        │
│ ├─ 📝 Jane updated profile "Chrome-001"               Yesterday │
│ ├─ 🚀 Alice started "Register Account" on 20 profiles Yesterday │
│ └─ ❌ Alice's execution failed (network error)        Yesterday │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Tasks:**
- [ ] Server: Log all team activities
- [ ] Server: Activity query API with pagination
- [ ] Client: Activity feed component
- [ ] Client: Activity filters
- [ ] Client: Real-time activity updates (WebSocket)

**Estimated: 2 days**

---

### 2.4 Real-time Collaboration

**WebSocket Events:**
```javascript
// Server → Client events
const SERVER_EVENTS = {
  'resource.updated': { resourceId, updatedBy, changes },
  'resource.deleted': { resourceId, deletedBy },
  'execution.started': { executionId, workflowName, startedBy },
  'execution.progress': { executionId, progress, stats },
  'execution.completed': { executionId, results },
  'member.online': { userId, userName },
  'member.offline': { userId }
};

// Client → Server events
const CLIENT_EVENTS = {
  'subscribe': { teamId },
  'unsubscribe': { teamId },
  'typing': { resourceId }  // Show "user is editing..."
};
```

**Implementation:**
```javascript
// Server WebSocket handler
wss.on('connection', (ws, req) => {
  const user = authenticateWs(req);
  const teams = getUserTeams(user.id);

  // Join team rooms
  teams.forEach(team => ws.join(`team:${team.id}`));

  // Broadcast online status
  teams.forEach(team => {
    broadcast(`team:${team.id}`, {
      type: 'member.online',
      userId: user.id,
      userName: user.name
    });
  });

  ws.on('close', () => {
    teams.forEach(team => {
      broadcast(`team:${team.id}`, {
        type: 'member.offline',
        userId: user.id
      });
    });
  });
});
```

**Implementation Tasks:**
- [ ] Server: Setup WebSocket server
- [ ] Server: Room-based broadcasting
- [ ] Server: Online presence tracking
- [ ] Client: WebSocket connection manager
- [ ] Client: Real-time UI updates
- [ ] Client: Show online members
- [ ] Client: Show "editing" indicators

**Estimated: 3-4 days**

---

## Phase 3: Distributed Execution

### 3.1 Task Queue System

**Files to create:**
```
server/
├── src/
│   ├── queue/
│   │   ├── index.ts             # Queue manager
│   │   ├── task.ts              # Task model
│   │   └── strategies.ts        # Priority strategies
│   ├── routes/
│   │   ├── tasks.ts             # Task API
│   │   └── executions.ts        # Execution API
│   └── services/
│       ├── task.service.ts
│       └── execution.service.ts

sidecar/
├── worker/
│   ├── index.js                 # Worker entry
│   ├── agent.js                 # Worker agent
│   ├── executor.js              # Task executor
│   └── reporter.js              # Status reporter
```

**Task Schema:**
```javascript
const taskSchema = {
  id: 'string',           // Unique task ID
  executionId: 'string',  // Parent execution

  // Workflow
  workflowId: 'string',
  workflowName: 'string',
  workflowSteps: 'array',

  // Profile
  profileId: 'string',
  profileData: 'object',
  proxyData: 'object',

  // Config
  config: {
    headless: 'boolean',
    blocking: 'object',
    timeout: 'number',
    retryOnFail: 'boolean',
    maxRetries: 'number'
  },

  // Priority
  priority: 'string',     // critical, high, normal, low
  scheduledAt: 'date',
  deadline: 'date',

  // Routing
  preferredWorker: 'string',
  requiredCapabilities: 'array',

  // State
  status: 'string',       // pending, assigned, running, completed, failed
  assignedTo: 'string',
  attempts: 'number',

  // Timestamps
  createdAt: 'date',
  assignedAt: 'date',
  startedAt: 'date',
  completedAt: 'date',

  // Results
  result: 'object',
  lastError: 'string'
};
```

**Redis Queue Structure:**
```
mmo:tasks:pending     - Sorted Set (score = priority + timestamp)
mmo:tasks:processing  - Hash (taskId → task data)
mmo:tasks:completed   - Hash (taskId → result) [TTL: 24h]
mmo:tasks:failed      - Hash (taskId → error) [TTL: 7d]

mmo:workers:active    - Hash (workerId → worker info)
mmo:workers:heartbeat - Hash (workerId → timestamp)

mmo:executions:active - Set (executionIds)
mmo:execution:{id}    - Hash (execution details)
```

**API Endpoints:**
```
# Executions
POST   /api/executions           # Create new execution
GET    /api/executions           # List executions
GET    /api/executions/:id       # Get execution details
DELETE /api/executions/:id       # Cancel execution
GET    /api/executions/:id/tasks # List tasks in execution

# Tasks (for workers)
POST   /api/tasks/pull           # Worker pulls task
POST   /api/tasks/:id/heartbeat  # Worker heartbeat
POST   /api/tasks/:id/progress   # Report progress
POST   /api/tasks/:id/complete   # Task completed
POST   /api/tasks/:id/fail       # Task failed

# Workers
POST   /api/workers/register     # Register worker
GET    /api/workers              # List workers
DELETE /api/workers/:id          # Remove worker
```

**Implementation Tasks:**
- [ ] Server: Setup Redis connection
- [ ] Server: Implement TaskQueue class
- [ ] Server: Implement priority scoring
- [ ] Server: Create execution endpoint
- [ ] Server: Task pull with atomic operations
- [ ] Server: Task completion handling
- [ ] Server: Retry logic

**Estimated: 3-4 days**

---

### 3.2 Worker Agent

**Worker Agent Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                        WORKER AGENT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. REGISTER                                                     │
│     └─→ POST /api/workers/register                              │
│         { id, hostname, capabilities, maxConcurrent }           │
│                                                                  │
│  2. CONNECT WEBSOCKET                                           │
│     └─→ ws://coordinator/ws                                     │
│         - Receive pushed tasks                                  │
│         - Send heartbeats                                       │
│         - Report status                                         │
│                                                                  │
│  3. TASK LOOP                                                   │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  while (running) {                                   │    │
│     │    if (activeSlots < maxConcurrent) {               │    │
│     │      task = pullTask()                              │    │
│     │      if (task) executeTask(task)                    │    │
│     │    }                                                │    │
│     │    sleep(1000)                                      │    │
│     │  }                                                  │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                  │
│  4. EXECUTE TASK                                                │
│     ├─→ Create browser session                                  │
│     ├─→ Execute workflow steps                                  │
│     ├─→ Report progress (every 5s or on step change)           │
│     ├─→ Close session                                          │
│     └─→ Report complete/fail                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Worker Configuration:**
```javascript
// worker-config.json
{
  "workerId": "worker-office-pc",
  "coordinatorUrl": "https://api.mmoexpress.io",
  "maxConcurrent": 3,
  "capabilities": ["chromium", "firefox"],
  "autoStart": true,
  "heartbeatInterval": 5000,
  "taskPollInterval": 1000,
  "defaults": {
    "headless": false,
    "timeout": 300000
  }
}
```

**Implementation Tasks:**
- [ ] Sidecar: Create WorkerAgent class
- [ ] Sidecar: Implement registration
- [ ] Sidecar: Implement WebSocket connection
- [ ] Sidecar: Implement task pulling
- [ ] Sidecar: Implement task execution
- [ ] Sidecar: Implement progress reporting
- [ ] Sidecar: Implement heartbeat
- [ ] Sidecar: Handle graceful shutdown
- [ ] Client: Worker status UI
- [ ] Client: Enable/disable worker mode

**Estimated: 4-5 days**

---

### 3.3 Load Balancing

**Strategies:**
```javascript
// 1. Round Robin
class RoundRobinBalancer {
  selectWorker(workers, task) {
    const available = workers.filter(w => w.slots > 0);
    return available[this.index++ % available.length];
  }
}

// 2. Least Connections
class LeastConnectionsBalancer {
  selectWorker(workers, task) {
    return workers
      .filter(w => w.slots > 0)
      .sort((a, b) => b.slots - a.slots)[0];
  }
}

// 3. Weighted (by performance)
class WeightedBalancer {
  selectWorker(workers, task) {
    return workers
      .filter(w => w.slots > 0)
      .map(w => ({
        worker: w,
        score: this.calculateScore(w)
      }))
      .sort((a, b) => b.score - a.score)[0]?.worker;
  }

  calculateScore(worker) {
    return (worker.slots * 100) +
           ((1 - worker.cpuUsage) * 50) +
           (worker.successRate * 30);
  }
}

// 4. Affinity (sticky)
class AffinityBalancer {
  selectWorker(workers, task) {
    // Prefer same worker for same profile
    const preferred = this.affinityMap.get(task.profileId);
    if (preferred && workers.find(w => w.id === preferred)?.slots > 0) {
      return workers.find(w => w.id === preferred);
    }
    // Fallback to least connections
    return new LeastConnectionsBalancer().selectWorker(workers, task);
  }
}
```

**Implementation Tasks:**
- [ ] Server: Implement balancer interface
- [ ] Server: Implement all 4 strategies
- [ ] Server: Make strategy configurable
- [ ] Server: Track worker performance metrics
- [ ] Client: Show load distribution

**Estimated: 2 days**

---

### 3.4 Fault Tolerance

**Worker Health Check:**
```javascript
class WorkerHealthChecker {
  constructor(options) {
    this.heartbeatTimeout = options.heartbeatTimeout || 15000;
    this.checkInterval = options.checkInterval || 5000;
  }

  start() {
    setInterval(() => this.checkWorkers(), this.checkInterval);
  }

  async checkWorkers() {
    const workers = await getActiveWorkers();
    const now = Date.now();

    for (const worker of workers) {
      const lastHeartbeat = await getLastHeartbeat(worker.id);

      if (now - lastHeartbeat > this.heartbeatTimeout) {
        await this.handleUnresponsiveWorker(worker);
      }
    }
  }

  async handleUnresponsiveWorker(worker) {
    // 1. Mark offline
    await markWorkerOffline(worker.id);

    // 2. Re-queue tasks
    const tasks = await getWorkerTasks(worker.id);
    for (const task of tasks) {
      await requeueTask(task, { excludeWorker: worker.id });
    }

    // 3. Notify
    await notify('worker.offline', { worker, tasksRequeued: tasks.length });
  }
}
```

**Task Timeout Monitor:**
```javascript
class TaskTimeoutMonitor {
  start() {
    setInterval(() => this.checkTimeouts(), 10000);
  }

  async checkTimeouts() {
    const runningTasks = await getRunningTasks();
    const now = Date.now();

    for (const task of runningTasks) {
      const elapsed = now - new Date(task.startedAt).getTime();

      if (elapsed > task.config.timeout) {
        await this.handleTimeout(task);
      }
    }
  }

  async handleTimeout(task) {
    // 1. Force fail
    await failTask(task.id, 'timeout', task.attempts < task.config.maxRetries);

    // 2. Notify worker to kill
    await notifyWorker(task.assignedTo, 'cancel_task', { taskId: task.id });
  }
}
```

**Implementation Tasks:**
- [ ] Server: Worker health checker
- [ ] Server: Task timeout monitor
- [ ] Server: Auto re-queue on failure
- [ ] Server: Dead letter queue for repeatedly failed tasks
- [ ] Server: Alerting for failures
- [ ] Sidecar: Handle cancel signals
- [ ] Sidecar: Graceful task cancellation

**Estimated: 2-3 days**

---

### 3.5 Monitoring Dashboard

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Execution Monitor                                        [Live] 🔴      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WORKERS                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Office-PC    │ │ VPS-1        │ │ Home-PC      │ │ VPS-2        │       │
│  │ ● Online     │ │ ● Online     │ │ ● Online     │ │ ○ Offline    │       │
│  │ 2/3 ████░    │ │ 4/5 █████░░░ │ │ 1/2 ██░      │ │ 0/3          │       │
│  │ CPU: 45%     │ │ CPU: 62%     │ │ CPU: 28%     │ │              │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  CURRENT EXECUTION                                          [Pause] [Stop]  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚀 Login Facebook                                                    │   │
│  │ Progress: 45/100          ████████████████░░░░░░░░░░░░░░ 45%        │   │
│  │ ✅ 42 completed  │  🔄 7 running  │  ⏳ 48 queued  │  ❌ 3 failed  │   │
│  │ Elapsed: 12:30  │  ETA: 15:20  │  Avg: 16.7s/profile                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ACTIVE TASKS                                                                │
│  ┌──────────┬─────────────┬─────────────┬──────────┬───────────────────┐   │
│  │ Worker   │ Profile     │ Step        │ Duration │ Progress          │   │
│  ├──────────┼─────────────┼─────────────┼──────────┼───────────────────┤   │
│  │ Office   │ Chrome-001  │ 5/10 Type   │ 8.2s     │ ███████░░░ 70%   │   │
│  │ Office   │ Chrome-015  │ 2/10 Nav    │ 3.1s     │ ██░░░░░░░░ 20%   │   │
│  │ VPS-1    │ Firefox-003 │ 8/10 Click  │ 14.5s    │ █████████░ 90%   │   │
│  │ VPS-1    │ Chrome-022  │ 1/10 Nav    │ 1.2s     │ █░░░░░░░░░ 10%   │   │
│  │ Home     │ Chrome-008  │ 6/10 Wait   │ 11.3s    │ ████████░░ 80%   │   │
│  └──────────┴─────────────┴─────────────┴──────────┴───────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  RECENT RESULTS                                                              │
│  ✅ Chrome-007 completed in 15.2s (Office-PC)                    2s ago    │
│  ✅ Firefox-002 completed in 18.7s (VPS-1)                       5s ago    │
│  ❌ Chrome-012 failed: Element not found (VPS-1) [Retry 1/3]     8s ago    │
│  ✅ Chrome-006 completed in 14.1s (Home-PC)                      12s ago   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementation Tasks:**
- [ ] Server: Real-time stats API
- [ ] Server: WebSocket for live updates
- [ ] Client: ExecutionMonitor component
- [ ] Client: Worker status cards
- [ ] Client: Progress visualization
- [ ] Client: Task list with filtering
- [ ] Client: Result log with auto-scroll

**Estimated: 3-4 days**

---

## Phase 4: Pricing & Limits

### 4.1 Plan Structure

| Feature | Free | Pro ($9/mo) | Team ($29/mo) | Enterprise |
|---------|------|-------------|---------------|------------|
| Storage | 100MB | 1GB | 10GB | Unlimited |
| Devices | 1 | 5 | Unlimited | Unlimited |
| Sync | Basic | Full | Full | Full |
| Team members | - | - | 5 | Unlimited |
| Workers | 1 | 3 | 10 | Unlimited |
| Concurrent | 3 | 10 | 50 | Unlimited |
| Priority queue | - | ✓ | ✓ | ✓ |
| API access | - | - | ✓ | ✓ |
| Support | Community | Email | Priority | Dedicated |

### 4.2 Implementation

**Database:**
```sql
-- plans table
CREATE TABLE plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price_monthly INTEGER,  -- cents
  price_yearly INTEGER,
  limits JSONB NOT NULL,
  features JSONB NOT NULL
);

-- subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  org_id UUID REFERENCES organizations(id),
  plan_id VARCHAR(50) REFERENCES plans(id),
  status VARCHAR(50),  -- active, canceled, past_due
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- usage table
CREATE TABLE usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  org_id UUID REFERENCES organizations(id),
  metric VARCHAR(50),  -- storage, executions, api_calls
  value BIGINT,
  period_start TIMESTAMP,
  period_end TIMESTAMP
);
```

**Limit Enforcement:**
```javascript
async function checkLimits(userId, action) {
  const user = await getUser(userId);
  const plan = await getPlan(user.planId);
  const usage = await getUsage(userId);

  switch (action) {
    case 'add_device':
      if (usage.devices >= plan.limits.maxDevices) {
        throw new LimitError('Device limit reached');
      }
      break;

    case 'start_execution':
      if (usage.activeWorkers >= plan.limits.maxWorkers) {
        throw new LimitError('Worker limit reached');
      }
      break;

    case 'upload_data':
      if (usage.storage >= plan.limits.maxStorage) {
        throw new LimitError('Storage limit reached');
      }
      break;
  }
}
```

---

## Implementation Timeline

### Recommended Order (MVP First)

| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| **Phase 0**: Single Mode | 5-7 days | - | ⭐⭐⭐ FIRST |
| **Phase 1.1**: Auth (Supabase) | 2-3 days | Phase 0 | ⭐⭐⭐ |
| **Phase 1.2**: Basic Sync | 3-4 days | 1.1 | ⭐⭐⭐ |
| **Phase 1.3**: Multi-device | 2 days | 1.2 | ⭐⭐ |
| **Phase 1.4**: Encryption | 2-3 days | 1.2 | ⭐⭐ |
| **Phase 2.1**: Teams | 3-4 days | 1.1 | ⭐⭐ |
| **Phase 2.2**: Sharing | 2-3 days | 2.1 | ⭐⭐ |
| **Phase 2.3**: Activity | 2 days | 2.1 | ⭐ |
| **Phase 2.4**: Real-time | 3-4 days | 2.1 | ⭐ |
| **Phase 3.1**: Task Queue | 3-4 days | 1.1 | ⭐ |
| **Phase 3.2**: Worker Agent | 4-5 days | 3.1 | ⭐ |
| **Phase 3.3**: Load Balancing | 2 days | 3.2 | ⭐ |
| **Phase 3.4**: Fault Tolerance | 2-3 days | 3.2 | ⭐ |
| **Phase 3.5**: Monitoring | 3-4 days | 3.2 | ⭐ |

### Phased Rollout

```
Week 1-2: Phase 0 (Single Mode)
├── License server (3 endpoints)
├── Local SQLite storage
├── Login UI
├── Feature gating
└── Release: Single Plan ($0-9/mo)

Week 3-4: Phase 1 (Cloud Sync)
├── Supabase setup
├── Sync profiles/workflows
├── Multi-device
└── Release: Pro Plan ($9/mo)

Week 5-7: Phase 2 (Team)
├── Organizations & Teams
├── Resource sharing
├── Activity log
└── Release: Team Plan ($29/mo)

Week 8+: Phase 3 (Enterprise)
├── Distributed execution
├── Advanced monitoring
└── Release: Enterprise (Custom)
```

**Total estimated: 40-50 days**

---

## Tech Stack

### Option A: Self-hosted (Full Control)

| Component | Technology | Reason |
|-----------|------------|--------|
| Server | Node.js + Express + TypeScript | Consistent with sidecar |
| Database | PostgreSQL | Reliable, JSONB support |
| Queue | Redis | Fast, pub/sub, sorted sets |
| Auth | JWT + bcrypt | Standard, stateless |
| Storage | S3/R2 | Scalable, cheap |
| WebSocket | ws | Simple, fast |
| Payments | Stripe | Easy integration |

### Option B: BaaS (Faster Development) - RECOMMENDED for MVP

| Component | Technology | Reason |
|-----------|------------|--------|
| Backend | **Supabase** | All-in-one: Auth + DB + Realtime + Storage |
| Database | PostgreSQL (Supabase) | Managed, auto-backup |
| Auth | Supabase Auth | Email/Google/GitHub login built-in |
| Real-time | Supabase Realtime | Auto sync UI on data change |
| Storage | Supabase Storage | For screenshots, backups |
| Queue | Supabase Edge Functions + pg_cron | Serverless |
| Payments | Stripe | Easy integration |

**Lợi ích của Supabase:**
- Không cần setup server
- Real-time built-in (Svelte tự update UI)
- Row Level Security (RLS) cho permission
- Free tier đủ để test
- Scale dễ dàng

---

## Critical Features (Bổ sung)

### Profile Locking (Tránh xung đột)

**Vấn đề:** 2 người cùng mở 1 Profile → lỗi Session, mất Cookie.

**Giải pháp:**
```sql
-- Thêm vào profiles table
ALTER TABLE profiles ADD COLUMN is_running BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN running_by UUID REFERENCES users(id);
ALTER TABLE profiles ADD COLUMN running_on VARCHAR(255);  -- machine_id/device_id
ALTER TABLE profiles ADD COLUMN running_since TIMESTAMP;
```

**Lock Flow:**
```javascript
// Trước khi chạy Profile
async function acquireLock(profileId, userId, deviceId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_running: true,
      running_by: userId,
      running_on: deviceId,
      running_since: new Date().toISOString()
    })
    .eq('id', profileId)
    .eq('is_running', false)  // Chỉ lock nếu chưa ai lock
    .select();

  if (!data || data.length === 0) {
    throw new Error('Profile đang được sử dụng bởi người khác');
  }
  return true;
}

// Sau khi chạy xong
async function releaseLock(profileId) {
  await supabase
    .from('profiles')
    .update({
      is_running: false,
      running_by: null,
      running_on: null,
      running_since: null
    })
    .eq('id', profileId);
}

// Auto-release lock nếu quá 30 phút (timeout)
// Chạy bằng pg_cron hoặc scheduled function
```

**UI Indication:**
```svelte
{#if profile.is_running}
  <button disabled class="btn-locked">
    🔒 Đang chạy bởi {profile.running_by_name} trên {profile.running_on}
  </button>
{:else}
  <button on:click={() => runProfile(profile.id)}>▶️ Run</button>
{/if}
```

---

### Lazy Loading Strategy (Performance)

**Vấn đề:** Sync quá nhiều data → App lag, tốn bandwidth.

**Giải pháp: 3-tier Loading**

```
Tier 1: App Start (Instant)
├── Profile list (id, name, status, is_running)
├── Workflow list (id, name)
└── Team members (id, name, role)

Tier 2: On Demand (When user clicks)
├── Profile details (fingerprint config)
├── Workflow steps
└── Proxy details

Tier 3: Just Before Run (Lazy)
├── Cookies (có thể 100KB+)
├── Local storage data
└── Extension settings
```

**Implementation:**
```javascript
// Tier 1: App start - chỉ load metadata
async function loadProfileList() {
  return supabase
    .from('profiles')
    .select('id, name, browser_type, status, is_running, running_by')
    .order('updated_at', { ascending: false });
}

// Tier 2: User clicks profile - load config
async function loadProfileDetails(profileId) {
  return supabase
    .from('profiles')
    .select('*')  // Full config
    .eq('id', profileId)
    .single();
}

// Tier 3: Just before run - load sensitive data
async function loadProfileRunData(profileId) {
  const [cookies, localStorage] = await Promise.all([
    supabase.from('profile_cookies').select('*').eq('profile_id', profileId),
    supabase.from('profile_storage').select('*').eq('profile_id', profileId)
  ]);

  return { cookies: cookies.data, localStorage: localStorage.data };
}

// Workflow: Load steps only when editing/running
async function loadWorkflowSteps(workflowId) {
  return supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('order');
}
```

---

### Profile Assignment (assigned_to)

**Mục đích:** Admin giao Profile cho nhân viên cụ thể.

**Schema:**
```sql
-- Thêm vào profiles table
ALTER TABLE profiles ADD COLUMN assigned_to UUID REFERENCES users(id);
ALTER TABLE profiles ADD COLUMN assigned_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN assigned_by UUID REFERENCES users(id);

-- Hoặc nhiều người (many-to-many)
CREATE TABLE profile_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(50) DEFAULT 'run',  -- run, edit, full
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(profile_id, user_id)
);
```

**Permission Levels chi tiết:**
```javascript
const PERMISSIONS = {
  // Admin
  admin: {
    profiles: ['create', 'read', 'update', 'delete', 'assign', 'run'],
    proxies: ['create', 'read', 'update', 'delete', 'view_credentials'],
    workflows: ['create', 'read', 'update', 'delete', 'run'],
    team: ['invite', 'remove', 'change_role'],
    logs: ['read_all']
  },

  // Staff (Nhân viên)
  staff: {
    profiles: ['read_assigned', 'run_assigned'],  // Chỉ profile được giao
    proxies: ['read_assigned'],  // KHÔNG thấy username/password
    workflows: ['read', 'run'],
    team: [],
    logs: ['read_own']  // Chỉ xem log của mình
  },

  // Viewer (Xem báo cáo)
  viewer: {
    profiles: ['read_stats'],  // Chỉ xem số lượng, không chi tiết
    proxies: [],
    workflows: ['read'],
    team: [],
    logs: ['read_summary']
  }
};

// Hide sensitive data for Staff
function sanitizeProxyForStaff(proxy) {
  return {
    id: proxy.id,
    name: proxy.name,
    type: proxy.type,
    status: proxy.status,
    // KHÔNG trả về: host, port, username, password
  };
}
```

**UI cho Staff:**
```svelte
<!-- Staff chỉ thấy profiles được giao -->
{#each assignedProfiles as profile}
  <div class="profile-card">
    <span>{profile.name}</span>
    <span class="status">{profile.status}</span>

    <!-- Không hiện proxy details -->
    {#if profile.proxy_id}
      <span class="proxy-badge">🔒 Proxy attached</span>
    {/if}

    <button on:click={() => runProfile(profile.id)}>▶️ Run</button>
  </div>
{/each}
```

---

### Cookie Sync với Playwright

**Save cookies trước khi đóng:**
```javascript
// Trong sidecar
async function saveSessionToCloud(sessionId, profileId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // 1. Get cookies from Playwright context
  const cookies = await session.context.cookies();

  // 2. Get localStorage (optional)
  const localStorage = await session.page.evaluate(() => {
    const data = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      data[key] = window.localStorage.getItem(key);
    }
    return data;
  });

  // 3. Encrypt sensitive data (using Rust/Tauri)
  const encrypted = await invoke('encrypt_data', {
    data: JSON.stringify({ cookies, localStorage }),
    key: userMasterKey
  });

  // 4. Upload to cloud
  await supabase
    .from('profile_sessions')
    .upsert({
      profile_id: profileId,
      cookies_encrypted: encrypted,
      updated_at: new Date().toISOString()
    });
}
```

**Restore cookies khi mở:**
```javascript
async function restoreSessionFromCloud(profileId, context) {
  // 1. Download from cloud
  const { data } = await supabase
    .from('profile_sessions')
    .select('cookies_encrypted')
    .eq('profile_id', profileId)
    .single();

  if (!data?.cookies_encrypted) return;

  // 2. Decrypt (using Rust/Tauri)
  const decrypted = await invoke('decrypt_data', {
    data: data.cookies_encrypted,
    key: userMasterKey
  });

  const { cookies, localStorage } = JSON.parse(decrypted);

  // 3. Restore cookies to Playwright context
  if (cookies?.length > 0) {
    await context.addCookies(cookies);
  }

  // 4. Restore localStorage (on first page)
  if (localStorage && Object.keys(localStorage).length > 0) {
    const page = await context.newPage();
    await page.goto('about:blank');
    await page.evaluate((data) => {
      for (const [key, value] of Object.entries(data)) {
        window.localStorage.setItem(key, value);
      }
    }, localStorage);
  }
}
```

---

### Rust Encryption (Tauri)

**Tại sao Rust thay vì JS:**
- Nhanh hơn cho large data
- Khó reverse-engineer hơn
- Key không lộ trong memory JS

**Implementation (src-tauri/src/crypto.rs):**
```rust
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce
};
use argon2::{self, Config};
use rand::Rng;

#[tauri::command]
pub fn derive_key(password: &str, salt: &[u8]) -> Result<Vec<u8>, String> {
    let config = Config::default();
    argon2::hash_raw(password.as_bytes(), salt, &config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn encrypt_data(data: &str, key: &[u8]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| e.to_string())?;

    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 12] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, data.as_bytes())
        .map_err(|e| e.to_string())?;

    // Combine nonce + ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);

    Ok(base64::encode(result))
}

#[tauri::command]
pub fn decrypt_data(encrypted: &str, key: &[u8]) -> Result<String, String> {
    let data = base64::decode(encrypted)
        .map_err(|e| e.to_string())?;

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| e.to_string())?;

    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| e.to_string())?;

    String::from_utf8(plaintext)
        .map_err(|e| e.to_string())
}
```

**Gọi từ Frontend:**
```javascript
import { invoke } from '@tauri-apps/api/tauri';

// Derive key từ master password
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await invoke('derive_key', {
  password: masterPassword,
  salt: Array.from(salt)
});

// Encrypt
const encrypted = await invoke('encrypt_data', {
  data: JSON.stringify(sensitiveData),
  key: key
});

// Decrypt
const decrypted = await invoke('decrypt_data', {
  encrypted: encrypted,
  key: key
});
```

---

### Supabase Real-time Example (Svelte)

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';

  let profiles = [];
  let subscription;

  onMount(async () => {
    // Initial load (Tier 1 - metadata only)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, status, is_running, running_by');

    profiles = data || [];

    // Subscribe to real-time changes
    subscription = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',  // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            profiles = [...profiles, payload.new];
          } else if (payload.eventType === 'UPDATE') {
            profiles = profiles.map(p =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            );
          } else if (payload.eventType === 'DELETE') {
            profiles = profiles.filter(p => p.id !== payload.old.id);
          }
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  });
</script>

<!-- UI tự động cập nhật khi data thay đổi -->
{#each profiles as profile}
  <div class="profile-card" class:locked={profile.is_running}>
    <span>{profile.name}</span>
    {#if profile.is_running}
      <span class="status-badge">🔒 Running</span>
    {/if}
  </div>
{/each}
```

---

## Security Considerations

1. **Authentication**
   - JWT with short expiry (15m)
   - Refresh tokens stored in DB
   - Rate limiting on auth endpoints

2. **Data Protection**
   - E2E encryption (optional)
   - TLS everywhere
   - Input validation

3. **API Security**
   - API key for programmatic access
   - Request signing
   - IP whitelisting (enterprise)

4. **Infrastructure**
   - VPC isolation
   - WAF
   - DDoS protection

---

## Notes

- Start with Phase 1 (Cloud Sync) để có foundation
- Phase 2 và 3 có thể làm parallel sau khi Phase 1 done
- Consider self-hosted option cho enterprise customers
- Monitor costs carefully (Redis, storage, bandwidth)
