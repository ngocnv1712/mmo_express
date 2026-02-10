# MMO Express - Implementation Plan

## Overview
Anti-detect browser tool built with Tauri 2 + Svelte 5 + Playwright.
Cross-platform (Windows, Linux, macOS) with native performance.

## Tech Stack
| Component | Technology | Ly do |
|-----------|------------|-------|
| Backend | Tauri 2 (Rust) | Native performance, nho |
| Frontend | Svelte 5 + CSS | Reactive, fast, modern |
| Browser | Playwright | Multi-browser (Chromium, Firefox, WebKit) |
| Sidecar | Node.js | Playwright integration |
| Database | SQLite | Don gian, portable |

## Key Metrics

| Metric | Target | Status |
|--------|--------|--------|
| RAM per profile | < 50MB | ✅ ~30-40MB per context |
| Bot detection | < 5% detected | ✅ Passes sannysoft, pixelscan |
| Proxy auth | 100% working | ✅ HTTP/HTTPS/SOCKS5 |
| Mobile emulation | Accurate | ✅ 25+ device presets |
| Startup time | < 5 seconds | ✅ ~2-3 seconds |
| Binary size | Reasonable | ✅ 12MB standalone |

---

## Project Structure

```
mmo-express/
├── frontend/               # Tauri + Svelte 5 frontend
│   ├── src/
│   │   ├── App.svelte
│   │   └── lib/
│   │       ├── api.js
│   │       ├── ProfileList.svelte
│   │       ├── ProfileEditor.svelte
│   │       ├── ProxyList.svelte
│   │       ├── SessionList.svelte
│   │       ├── ResourceModal.svelte
│   │       └── automation/
│   │           ├── AutomationBuilder.svelte
│   │           ├── ActionPalette.svelte
│   │           ├── WorkflowCanvas.svelte
│   │           ├── PropertyPanel.svelte
│   │           ├── VariableEditor.svelte
│   │           ├── ExecutionLog.svelte
│   │           ├── ConditionBuilder.svelte
│   │           └── DebugPanel.svelte
│   │
│   └── src-tauri/          # Rust backend
│       ├── src/
│       │   ├── main.rs
│       │   ├── database.rs
│       │   ├── profile.rs
│       │   ├── proxy.rs
│       │   └── sidecar.rs
│       └── Cargo.toml
│
├── sidecar/                # Node.js Playwright sidecar
│   ├── index.js
│   ├── stealth.js
│   ├── browser/engines.js
│   ├── profile/devices.js
│   ├── geo/lookup.js
│   ├── extension/manager.js
│   ├── cookie/manager.js
│   ├── test/runner.js
│   ├── scheduler/scheduler.js
│   └── automation/
│       ├── index.js
│       ├── executor.js
│       ├── variables.js
│       └── actions/
│           ├── navigation.js
│           ├── interaction.js
│           ├── wait.js
│           ├── data.js
│           ├── control.js
│           ├── utility.js
│           ├── file.js
│           ├── http.js
│           ├── googlesheets.js
│           └── ai.js
│
├── data/                   # Runtime data (gitignored)
│   ├── profiles.db
│   ├── schedules.json
│   └── screenshots/
│
└── PLAN.md
```

---

## Implementation Progress

### Phase 1: Core Anti-Detect ✅
- [x] Stealth modules (navigator, canvas, webgl, webrtc, audio, timezone, screen)
- [x] Profile schema (50+ configurable fields)
- [x] Random profile generator
- [x] 9 preset templates (Windows, Mac, Linux, Mobile)
- [x] Playwright sidecar integration

### Phase 2: Multi-Browser & Mobile ✅
- [x] Chromium, Firefox, WebKit support
- [x] 25+ mobile device presets (iPhone, Samsung, Pixel, iPad)
- [x] Browser engine selector in UI

### Phase 3: Proxy System ✅
- [x] HTTP, HTTPS, SOCKS5 support
- [x] Proxy authentication
- [x] Geo auto-detection (60+ countries)
- [x] Auto timezone/locale from proxy IP
- [x] Proxy testing + status tracking

### Phase 4: Database & Storage ✅
- [x] SQLite integration (Tauri rusqlite)
- [x] Profile CRUD
- [x] Proxy CRUD
- [x] 20+ Tauri commands

### Phase 5: Frontend UI ✅
- [x] ProfileList + ProxyList + SessionList
- [x] Profile cards with detailed info
- [x] Dark theme UI
- [x] Tab navigation

### Phase 6: Resource Management ✅
- [x] Login credentials per platform
- [x] 10 platforms: Facebook, Zalo, TikTok, Gmail, Shopee, Telegram, Instagram, Twitter, YouTube, LinkedIn
- [x] Resource CRUD
- [x] Cookie import/export (JSON, Netscape, Base64)

### Phase 7: Extension Manager ✅
- [x] Import extensions from .crx files
- [x] Import unpacked extensions (folder)
- [x] Enable/disable extensions
- [x] Extension list UI
- [x] Per-profile extensions

---

## Phase 8: Advanced Automation ✅

### Action Types (54+ actions)

| Category | Actions |
|----------|---------|
| **Navigation** | navigate, back, forward, reload, new-tab, close-tab, switch-tab |
| **Interaction** | click, type, scroll, hover, select, check, focus, press-key, clear |
| **Wait** | wait-time, wait-element, wait-network, wait-navigation, wait-text, wait-url |
| **Data** | extract, screenshot, log, evaluate, get-text, get-attribute, count-elements |
| **Control** | condition, loop, for-each, while, break, continue, try-catch, stop |
| **Variables** | set-variable, random-choice, random-phone, random-number, random-text |
| **File** | read-file, write-file, append-csv, file-exists, delete-file, list-files |
| **HTTP** | http-request, http-get, http-post, download-file, parse-json |
| **Google Sheets** | sheets-read, sheets-write, sheets-append, sheets-clear |
| **AI** | openai-chat, claude-chat, gemini-chat, deepseek-chat, ai-extract |

### Variable System
- Built-in: `{{profile.id}}`, `{{session.url}}`, `{{timestamp}}`, `{{random}}`
- Loop: `{{loop.index}}`, `{{loop.count}}`, `{{loop.first}}`, `{{loop.last}}`
- Transforms: `uppercase`, `lowercase`, `trim`, `split`, `replace`, `base64`

### Execution Features
- [x] Real-time execution log
- [x] Duration tracking per action
- [x] Cancel execution button
- [x] Debug mode with breakpoints
- [x] Step-by-step execution
- [x] Condition builder UI
- [x] Error handling (stop, continue, retry)

---

## Phase 9: Scheduler ✅
- [x] Cron-based scheduling
- [x] 13 schedule presets (every minute, hourly, daily, weekly, monthly)
- [x] Schedule config in Workflow Save modal
- [x] Enable/disable schedules per workflow
- [x] Profile selection per schedule
- [x] Last run status tracking
- [x] Next run time calculation
- [x] Workflow persistence (luu workflow vao schedule)
- [x] Profile caching cho sidecar
- [x] Auto-run khi sidecar khoi dong

---

## Phase 10: Workflow Management ✅
- [x] Workflow list view (khi vao tab Automation)
- [x] Action buttons: Run, Edit, Debug, Duplicate, Export, Delete
- [x] Workflow tags
- [x] Search/filter workflows
- [x] Tag-based filtering
- [x] Schedule status indicators on cards
- [x] Profile search/filter (cho 1000+ profiles)
- [x] Profile pagination (load them 50)
- [x] Schedule enable/profile selection doc lap

---

## Upcoming Phases

### Phase 11: Database Migration ✅
- [x] Migrate schedules từ JSON sang SQLite
- [x] Migrate workflows sang SQLite
- [x] Data migration tool (`sidecar/database/migrate.js`)
- [x] SQLite database module (`sidecar/database/index.js`)
- [x] Rust backend: schedules, execution_history tables
- [x] Tauri commands for schedules and execution history
- [ ] Backup/restore UI (optional)

### Phase 12: Reporting & Analytics ✅
- [x] Execution history trong DB (execution_history table)
- [x] Success/failure statistics (getExecutionStats API)
- [x] Charts & graphs (7-day bar chart)
- [x] Export reports (CSV) - PDF optional
- [x] ReportingDashboard.svelte component
- [x] Cleanup old executions (cleanupExecutions API)

### Phase 13: Advanced Scheduler ✅

#### 13.1 Parallel Executor ✅
```
┌─────────────────────────────────────────────────────┐
│ Single Browser - Multi Context Architecture         │
├─────────────────────────────────────────────────────┤
│ Chrome (1 process)              ~150MB base         │
│ ├─ Context 1 (Profile A)        +40MB              │
│ ├─ Context 2 (Profile B)        +40MB              │
│ ├─ Context 3 (Profile C)        +40MB              │
│ └─ ... (up to 50-100 contexts)                     │
└─────────────────────────────────────────────────────┘
RAM: 150MB + (N × 40MB) vs N × 300MB (old way)
```

**Files:**
- [x] `sidecar/scheduler/parallel.js` - Parallel execution controller
- [x] `sidecar/scheduler/queue.js` - Queue management
- [x] `sidecar/scheduler/retry.js` - Retry strategies

**Config Schema:**
```javascript
{
  execution: {
    maxConcurrent: 3,        // 1-10 profiles at once
    queueMode: 'fifo',       // fifo | lifo | random | priority
    delayBetween: 1000,      // ms between profile starts
    timeout: 300000,         // 5 min timeout per profile
    stopOnError: false,      // stop all on first error
    headless: false,         // run browsers in headless mode
  },
  blocking: {
    images: false,           // block image loading
    media: false,            // block video/audio
    fonts: false,            // block web fonts
    css: false,              // block stylesheets
    trackers: false,         // block known trackers
  },
  retry: {
    maxRetries: 3,
    strategy: 'exponential', // none | fixed | exponential | linear
    baseDelay: 1000,
    maxDelay: 60000,
    retryOn: ['timeout', 'network_error', 'element_not_found']
  },
  priority: 'normal'         // critical | high | normal | low | idle
}
```

#### 13.2 Queue System ✅
- [x] FIFO/LIFO/Random/Priority queue modes
- [x] Real-time queue status
- [x] Add/remove profiles from queue
- [x] Pause/resume queue
- [x] Skip current profile

#### 13.3 Retry Strategies ✅
| Strategy | Formula | Example (base=1s) |
|----------|---------|-------------------|
| `none` | - | No retry |
| `fixed` | base | 1s → 1s → 1s |
| `linear` | base × attempt | 1s → 2s → 3s |
| `exponential` | base × 2^attempt | 1s → 2s → 4s → 8s |

#### 13.4 Notifications ✅
**Channels:**
- [x] Telegram Bot
- [x] Discord Webhook
- [x] Custom Webhook

**Events:**
- `onStart` - Workflow started
- `onComplete` - All profiles done
- `onSuccess` - Profile succeeded
- `onFailure` - Profile failed
- `onRetry` - Retrying profile

**Config:**
```javascript
{
  notifications: {
    enabled: true,
    channels: [
      { type: 'telegram', botToken: '...', chatId: '...' },
      { type: 'discord', webhookUrl: '...' },
      { type: 'webhook', url: '...', headers: {} }
    ],
    events: {
      onStart: false,
      onComplete: true,
      onSuccess: false,
      onFailure: true,
      onRetry: true
    }
  }
}
```

#### 13.5 UI Components ✅
- [x] `ParallelExecutionConfig.svelte` - Config parallel/blocking/retry trong Save modal
- [x] Workflow card hien thi: concurrent, headless, blocking info
- [x] `ExecutionMonitor.svelte` - Real-time execution dashboard
- [x] `NotificationConfig.svelte` - Notification settings
- [x] `sidecar/notifications.js` - Notification manager module

**Execution Monitor UI:**
```
┌─────────────────────────────────────────────────────┐
│ 🚀 Running: Login Facebook         [Pause] [Stop]  │
├─────────────────────────────────────────────────────┤
│ Progress: 5/20 profiles            ████░░░░░ 25%   │
│ Elapsed: 2m 30s | ETA: 7m 30s                      │
├─────────────────────────────────────────────────────┤
│ Slot 1: Profile-A  ████████░░ 80%  Step 8/10      │
│ Slot 2: Profile-B  ██████████ ✓    Done           │
│ Slot 3: Profile-C  ███░░░░░░░ 30%  Step 3/10      │
├─────────────────────────────────────────────────────┤
│ Queue (15): Profile-D, Profile-E, Profile-F, ...   │
│ Completed (2): ✓ Profile-B, ✓ Profile-X           │
│ Failed (0): -                                      │
└─────────────────────────────────────────────────────┘
```

### Phase 14: Profile Groups
- [ ] Create/Edit/Delete groups
- [ ] Assign profiles to groups
- [ ] Launch all profiles in group
- [ ] Filter profiles by group
- [ ] Group colors/icons

### Phase 15: Enterprise Features
- [ ] License System (Hardware ID, online validation)
- [ ] Security (Encrypted database, password protection)
- [ ] Multi-language UI (Vietnamese, English, Chinese)
- [ ] Cloud Sync (profiles, workflows, multi-device)
- [ ] Team Collaboration (accounts, sharing, permissions)

---

## Database Schema

### profiles
```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  browser TEXT DEFAULT 'chromium',
  os TEXT DEFAULT 'windows',
  user_agent TEXT,
  viewport_width INTEGER DEFAULT 1920,
  viewport_height INTEGER DEFAULT 1080,
  timezone TEXT,
  locale TEXT,
  cpu_cores INTEGER DEFAULT 8,
  device_memory INTEGER DEFAULT 8,
  webgl_vendor TEXT,
  webgl_renderer TEXT,
  canvas_noise REAL DEFAULT 0.02,
  audio_noise REAL DEFAULT 0.0001,
  proxy_id TEXT,
  group_name TEXT,
  tags TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### proxies
```sql
CREATE TABLE proxies (
  id TEXT PRIMARY KEY,
  name TEXT,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  type TEXT DEFAULT 'http',
  username TEXT,
  password TEXT,
  status TEXT DEFAULT 'unknown',
  last_checked_at TEXT,
  last_ip TEXT,
  last_country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### workflows (Planned)
```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  steps TEXT NOT NULL,
  variables TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### schedules (Planned)
```sql
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  profile_ids TEXT,
  cron TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  last_status TEXT,
  next_run TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Build & Run

```bash
# Development
cd frontend && npm run dev      # Frontend (port 5173)
cd sidecar && node index.js     # Sidecar (port 3456)

# Or use Tauri dev
cd frontend && npm run tauri dev

# Production build
cd frontend && npm run tauri build

# Linux GTK fix (for snap environments)
unset GTK_PATH && npm run tauri dev
```

### Release Artifacts
| File | Size | Platform |
|------|------|----------|
| `mmo-express` | 12 MB | Linux standalone |
| `MMO Express_1.0.0_amd64.deb` | 26 MB | Debian/Ubuntu |
| `MMO Express-1.0.0-1.x86_64.rpm` | 26 MB | Fedora/RHEL |

---

## Git Repository
https://github.com/ngocnv1712/mmo_express.git

---

## Notes
- Sidecar runs on port 3456 (HTTP API for dev, IPC for production)
- Sessions auto-cleanup when browser window is closed
- Supports Chromium, Firefox, WebKit via Playwright
- Profiles luu trong SQLite, schedules hien tai luu trong JSON
- Screenshots luu trong data/screenshots/
