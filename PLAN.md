# MMO Express - Implementation Plan

## Overview
Anti-detect browser tool built with Tauri 2 + Svelte 5 + Playwright.
Cross-platform (Windows, Linux, macOS) with native performance.

## Tech Stack
- **Backend**: Tauri 2 (Rust)
- **Frontend**: Svelte 5 + CSS
- **Browser Engine**: Playwright (Chromium, Firefox, WebKit)
- **Sidecar**: Node.js + Playwright
- **Database**: SQLite (via Tauri)

---

## Implementation Progress

### Phase 1: Core Foundation - DONE
- [x] Project setup (Tauri 2, Svelte 5)
- [x] Database layer (SQLite via Tauri)
- [x] Profile model and CRUD operations
- [x] Preset profiles (9 presets: Windows, Mac, Linux, Mobile)
- [x] Random profile generator
- [x] Browser launcher via Playwright sidecar
- [x] Stealth scripts (anti-detect)
- [x] Fingerprint injection (Canvas, WebGL, Audio, Navigator)
- [x] Frontend UI (Svelte 5)
- [x] Profile cards with detailed info display

### Phase 2: Proxy Manager - DONE
- [x] Proxy model (HTTP, HTTPS, SOCKS5)
- [x] Proxy CRUD operations
- [x] Proxy testing (connectivity, IP, location)
- [x] Bulk import proxies
- [x] Integrate proxy with browser launcher
- [x] Proxy UI components
- [x] Profile-Proxy linking

### Phase 3: Multi-browser Sessions - DONE
- [x] Session manager (multiple browsers simultaneously)
- [x] Session tracking (running/stopped status)
- [x] Stop individual/all sessions
- [x] Auto-cleanup when browser closed (page.on('close'))
- [x] Sessions UI component
- [x] Multi-browser support (Chromium, Firefox, WebKit)

### Phase 4: Cookie Management - DONE
- [x] Cookie export from session (JSON format)
- [x] Cookie import to session
- [x] Netscape cookie format support
- [x] Base64 format support
- [x] Clear cookies
- [x] Cookie UI modal

### Phase 5: Resource Management - DONE
- [x] Profile resources (login credentials per platform)
- [x] 10 platforms: Facebook, Zalo, TikTok, Gmail, Shopee, Telegram, Instagram, Twitter, YouTube, LinkedIn
- [x] Resource CRUD operations
- [x] Resource count display on profile cards
- [x] ResourceModal UI component

### Phase 6: Fingerprint Testing - DONE
- [x] Test fingerprint modal
- [x] Quick launch to test sites (BrowserLeaks, PixelScan, CreepJS, etc.)
- [x] 8 test sites integrated

### Phase 7: Basic Automation - DONE
- [x] Workflow builder UI (drag & drop)
- [x] Action palette with categories
- [x] Visual workflow canvas
- [x] Property panel for action config
- [x] Save/Load workflows
- [x] Export/Import workflows (JSON)
- [x] Profile selector for workflow execution
- [x] Batch run on multiple profiles

---

## Phase 8: Advanced Automation - DONE

### Variable System - DONE
- [x] Variable Editor UI (VariableEditor.svelte)
- [x] Support types: string, number, boolean, array, object
- [x] Add/Edit/Delete variables
- [x] Default values
- [x] {{variable}} substitution syntax

### Execution Features - DONE
- [x] Execution History (localStorage, can migrate to DB)
- [x] Real-time Execution Log panel (ExecutionLog.svelte)
- [x] Duration tracking per action
- [x] Cancel execution button
- [x] Step-by-Step Execution (debug mode) - DebugPanel.svelte

### Control Flow - DONE
- [x] Condition Builder UI (ConditionBuilder.svelte)
- [x] If/Else blocks (via control.js)
- [x] Loop/ForEach/While (via control.js)
- [x] Break/Continue (via control.js)

### Error Handling - DONE
- [x] onError handling (stop, continue, retry) in PropertyPanel
- [x] Screenshot on error option
- [x] Retry count and delay configuration

### Utility Actions (utility.js) - DONE
- [x] Clipboard actions (copy, paste, get)
- [x] Random generators (text, number, email, phone, UUID, choice)
- [x] String operations (split, join, replace, substring, regex-match, regex-replace)
- [x] Array operations (push, pop, get, length, filter, sort, shuffle)

### File Operations (file.js) - DONE
- [x] Read file (text, JSON, CSV)
- [x] Write file (text, JSON, CSV)
- [x] Append to CSV
- [x] File exists check
- [x] Delete file
- [x] List files in directory

### HTTP Actions (http.js) - DONE
- [x] HTTP Request (GET, POST, PUT, PATCH, DELETE)
- [x] HTTP GET (simplified)
- [x] HTTP POST (simplified)
- [x] Download file from URL
- [x] Parse JSON response

### Google Sheets (googlesheets.js) - DONE
- [x] Read Google Sheet
- [x] Write Google Sheet
- [x] Append to Google Sheet
- [x] Clear Google Sheet range
- [x] Get Sheet info/metadata

### AI Integration (ai.js) - DONE
- [x] OpenAI Chat (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
- [x] Claude Chat (Claude 3.5 Sonnet, Haiku, Opus)
- [x] Gemini Chat (Gemini 1.5 Flash, Pro, 2.0 Flash)
- [x] DeepSeek Chat (Chat, Coder, Reasoner)
- [x] Generic AI Chat (multi-provider)
- [x] AI Extract (structured data extraction)

---

## Phase 9: Scheduler - DONE
- [x] Schedule workflows to run at specific times
- [x] Cron-like expressions (daily, hourly, weekly, custom)
- [x] Scheduler daemon (checks every minute)
- [x] Schedule config integrated into Workflow Save modal
- [x] Cron builder with presets (13 common presets)
- [x] Enable/disable schedules per workflow
- [x] Profile selection per schedule
- [x] Last run status tracking
- [x] Next run time calculation

---

## Phase 10: Extension Manager - TODO
- [ ] Import extensions from .crx files
- [ ] Import unpacked extensions
- [ ] Enable/disable extensions
- [ ] Link extensions to profiles
- [ ] Extension list UI

---

## Phase 11: Profile Groups - TODO
- [ ] Create/Edit/Delete groups
- [ ] Assign profiles to groups
- [ ] Launch all profiles in group
- [ ] Filter profiles by group
- [ ] Group colors/icons

---

## Phase 12: Enterprise Features - TODO

### License System
- [ ] Hardware ID binding
- [ ] Online validation
- [ ] Trial mode
- [ ] License management UI

### Security
- [ ] Encrypted database
- [ ] Password protection
- [ ] Secure credential storage

### Multi-language UI
- [ ] Vietnamese
- [ ] English
- [ ] Chinese
- [ ] Language selector

### Cloud Sync
- [ ] Sync profiles to cloud
- [ ] Sync workflows to cloud
- [ ] Multi-device support
- [ ] Backup/Restore

### Team Collaboration
- [ ] User accounts
- [ ] Shared profiles/workflows
- [ ] Permissions/roles

---

## Current File Structure

```
mmo-express/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── database.rs     # SQLite operations
│   │   ├── profile.rs      # Profile management
│   │   ├── proxy.rs        # Proxy management
│   │   └── sidecar.rs      # Playwright sidecar communication
│   └── Cargo.toml
│
├── frontend/               # Svelte 5 frontend
│   └── src/
│       ├── App.svelte
│       └── lib/
│           ├── api.js              # API functions + presets
│           ├── ProfileList.svelte  # Profile cards + actions
│           ├── ProfileEditor.svelte
│           ├── ProxyList.svelte
│           ├── ProxyEditor.svelte
│           ├── SessionList.svelte
│           ├── ResourceModal.svelte
│           └── automation/
│               ├── AutomationBuilder.svelte  # Main builder + schedule config
│               ├── ActionPalette.svelte      # Action categories
│               ├── WorkflowCanvas.svelte     # Visual canvas
│               ├── PropertyPanel.svelte      # Property editor
│               ├── VariableEditor.svelte     # Variable management
│               ├── ExecutionLog.svelte       # Real-time logs
│               ├── ExecutionHistory.svelte   # History viewer
│               ├── ConditionBuilder.svelte   # Condition UI
│               └── DebugPanel.svelte         # Step-by-step debug
│
├── sidecar/                # Node.js Playwright sidecar
│   ├── index.js            # Main sidecar (HTTP + IPC)
│   ├── stealth.js          # Anti-detect scripts
│   ├── browser/
│   │   └── engines.js      # Multi-browser support
│   ├── profile/
│   │   └── devices.js      # Device presets
│   ├── geo/
│   │   └── lookup.js       # Geo/timezone lookup
│   ├── extension/
│   │   └── manager.js
│   ├── cookie/
│   │   └── manager.js
│   ├── test/
│   │   └── runner.js       # Anti-detect tests
│   ├── scheduler/
│   │   ├── cronParser.js   # Cron expression parsing
│   │   └── scheduler.js    # Schedule management
│   └── automation/
│       ├── index.js        # Workflow manager
│       ├── executor.js     # Workflow executor + debug mode
│       ├── variables.js    # Variable store
│       └── actions/
│           ├── index.js        # Action registry
│           ├── navigation.js   # Navigate, back, forward, refresh
│           ├── interaction.js  # Click, type, select, hover
│           ├── wait.js         # Wait, waitForSelector, waitForURL
│           ├── data.js         # Extract, screenshot, evaluate
│           ├── control.js      # If/else, loop, break, continue
│           ├── utility.js      # Clipboard, random, string, array
│           ├── file.js         # Read/write files, CSV
│           ├── http.js         # HTTP requests, download
│           ├── googlesheets.js # Google Sheets API
│           ├── ai.js           # OpenAI, Claude, Gemini, DeepSeek
│           └── advanced.js     # Evaluate JS, custom actions
│
└── PLAN.md                 # This file
```

---

## Priority Order

### Completed
- [x] Variable Editor UI
- [x] Execution History
- [x] Real-time Execution Log
- [x] More automation actions (60+ actions)
- [x] Condition Builder UI
- [x] Step-by-Step Execution (Debug Mode)
- [x] File operations, HTTP, Google Sheets, AI

### Next Up (Phase 9-11)
1. **Scheduler** - Schedule workflows to run automatically
2. **Extension Manager** - Chrome extensions per profile
3. **Profile Groups** - Organize profiles

### Future (Phase 12)
4. License System
5. Multi-language UI
6. Cloud Sync
7. Team Collaboration

---

## Build & Run

```bash
# Development
cd frontend && npm run dev
cd sidecar && node index.js

# Or use Tauri dev
npm run tauri dev

# Production build
npm run tauri build
```

---

## Notes
- Sidecar runs on port 3456 (HTTP API)
- Sessions auto-cleanup when browser window is closed
- Supports Chromium, Firefox, WebKit via Playwright
