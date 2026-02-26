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

### Phase 14: Profile Groups (Đã bỏ)
~~- [ ] Create/Edit/Delete groups~~
~~- [ ] Assign profiles to groups~~

### Phase 15: Account Warm-up 🆕
Tự động "làm nóng" tài khoản mới để tránh bị ban.

#### 15.1 Warm-up Schedule Schema
```javascript
{
  id: 'warmup-xxx',
  name: 'Facebook Warm-up 21 ngày',
  platform: 'facebook',           // facebook, tiktok, google, instagram, etc.
  totalDays: 21,                  // Tổng số ngày warm-up
  phases: [
    {
      name: 'Phase 1 - Làm quen',
      days: [1, 7],               // Ngày 1-7
      dailyActions: {
        login: true,
        scrollFeed: { min: 5, max: 10 },      // phút
        like: { min: 2, max: 5 },             // số lượng
        comment: { min: 0, max: 1 },
        post: { min: 0, max: 0 },
        addFriend: { min: 0, max: 0 },
        joinGroup: { min: 0, max: 0 }
      }
    },
    {
      name: 'Phase 2 - Tương tác nhẹ',
      days: [8, 14],              // Ngày 8-14
      dailyActions: {
        login: true,
        scrollFeed: { min: 10, max: 15 },
        like: { min: 5, max: 10 },
        comment: { min: 1, max: 3 },
        post: { min: 0, max: 1 },
        addFriend: { min: 2, max: 5 },
        joinGroup: { min: 0, max: 1 }
      }
    },
    {
      name: 'Phase 3 - Hoạt động bình thường',
      days: [15, 21],             // Ngày 15-21
      dailyActions: {
        login: true,
        scrollFeed: { min: 15, max: 20 },
        like: { min: 10, max: 20 },
        comment: { min: 3, max: 5 },
        post: { min: 1, max: 2 },
        addFriend: { min: 3, max: 5 },
        joinGroup: { min: 1, max: 2 }
      }
    }
  ],
  // Thời gian chạy hàng ngày
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['09:00', '14:00', '20:00'],   // Chạy 3 lần/ngày
    randomDelay: 30                        // ±30 phút random
  },
  createdAt: '...',
  updatedAt: '...'
}
```

#### 15.2 Warm-up Progress Tracking
```javascript
{
  id: 'progress-xxx',
  warmupId: 'warmup-xxx',
  profileId: 'profile-xxx',
  profileName: 'Account FB 001',
  startDate: '2024-01-01',
  currentDay: 5,                  // Đang ở ngày thứ 5
  currentPhase: 1,                // Phase 1
  status: 'running',              // pending, running, paused, completed, failed
  dailyLogs: [
    {
      day: 1,
      date: '2024-01-01',
      actions: { login: 1, scrollFeed: 7, like: 3, comment: 0 },
      status: 'completed'
    },
    // ...
  ],
  nextRunAt: '2024-01-06T09:00:00',
  completedAt: null
}
```

#### 15.3 Database Tables
```sql
-- Warm-up templates
CREATE TABLE warmup_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  total_days INTEGER DEFAULT 21,
  phases TEXT NOT NULL,           -- JSON array of phases
  schedule TEXT,                  -- JSON schedule config
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Warm-up progress per profile
CREATE TABLE warmup_progress (
  id TEXT PRIMARY KEY,
  warmup_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  profile_name TEXT,
  start_date TEXT NOT NULL,
  current_day INTEGER DEFAULT 1,
  current_phase INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  daily_logs TEXT,                -- JSON array of daily logs
  next_run_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warmup_id) REFERENCES warmup_templates(id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);
```

#### 15.4 API Endpoints
```javascript
// Warm-up Templates
createWarmupTemplate(template)    // Tạo template mới
getWarmupTemplates()              // Lấy danh sách templates
getWarmupTemplate(id)             // Lấy chi tiết template
updateWarmupTemplate(id, data)    // Cập nhật template
deleteWarmupTemplate(id)          // Xóa template
duplicateWarmupTemplate(id)       // Nhân bản template

// Warm-up Progress
startWarmup(templateId, profileIds)   // Bắt đầu warm-up cho profiles
pauseWarmup(progressId)               // Tạm dừng
resumeWarmup(progressId)              // Tiếp tục
stopWarmup(progressId)                // Dừng hẳn
getWarmupProgress(progressId)         // Lấy tiến độ
getActiveWarmups()                    // Lấy các warm-up đang chạy
getWarmupsByProfile(profileId)        // Warm-up của 1 profile

// Warm-up Execution
executeWarmupDay(progressId)          // Chạy actions cho ngày hiện tại
getWarmupStats()                      // Thống kê tổng quan
```

#### 15.5 Pre-built Templates
| Platform | Days | Phases | Description |
|----------|------|--------|-------------|
| Facebook | 21 | 3 | Login → Like → Comment → Post → Add friends |
| TikTok | 14 | 2 | Watch → Like → Comment → Follow → Post |
| Instagram | 21 | 3 | Browse → Like → Comment → Follow → Post |
| Google | 7 | 2 | Search → Browse → Watch YouTube |
| Twitter/X | 14 | 2 | Browse → Like → Retweet → Tweet |

#### 15.6 UI Components
```
┌─────────────────────────────────────────────────────────┐
│ 🔥 Account Warm-up                                      │
├─────────────────────────────────────────────────────────┤
│ Templates:                                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ 📘 Facebook │ │ 🎵 TikTok  │ │ 📷 Instagram │        │
│ │ 21 days     │ │ 14 days    │ │ 21 days      │        │
│ │ 3 phases    │ │ 2 phases   │ │ 3 phases     │        │
│ │ [Select]    │ │ [Select]   │ │ [Select]     │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                         │
│ Active Warm-ups:                                        │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Profile: Account FB 001                           │  │
│ │ Template: Facebook 21 days                        │  │
│ │ Progress: Day 5/21 (Phase 1)   ████░░░░░░ 24%    │  │
│ │ Next run: Today 14:00          [Pause] [Stop]    │  │
│ ├───────────────────────────────────────────────────┤  │
│ │ Profile: Account FB 002                           │  │
│ │ Template: Facebook 21 days                        │  │
│ │ Progress: Day 12/21 (Phase 2)  ██████░░░░ 57%    │  │
│ │ Next run: Today 09:30          [Pause] [Stop]    │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ [+ Start New Warm-up]                                  │
└─────────────────────────────────────────────────────────┘
```

#### 15.7 Files
- [x] `sidecar/warmup/schema.js` - Warm-up schema & validation
- [x] `sidecar/warmup/templates.js` - Pre-built templates
- [x] `sidecar/warmup/executor.js` - Execute daily actions
- [x] `sidecar/warmup/scheduler.js` - Schedule warm-up runs
- [x] `sidecar/warmup/login.js` - Hybrid login handler (cookies + credentials)
- [x] `sidecar/warmup/index.js` - Module exports
- [x] `sidecar/database/index.js` - Database operations (updated)
- [x] `sidecar/database/migrate.js` - DB tables (updated)
- [x] `sidecar/index.js` - API endpoints (updated)
- [x] `frontend/src/lib/warmup/WarmupDashboard.svelte`
- [x] `frontend/src/lib/warmup/WarmupProgress.svelte`
- [x] `frontend/src/lib/api.js` - API functions (updated)
- [x] `frontend/src/App.svelte` - Warmup tab (updated)
- [ ] `frontend/src/lib/warmup/WarmupTemplateEditor.svelte` (optional)

### Phase 16: Enterprise Features
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
