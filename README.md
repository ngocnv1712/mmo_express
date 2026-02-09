# MMO Express

Anti-detect browser tool with multi-profile management, built with Tauri + Svelte + Playwright.

## Features

- **Anti-Detect Stealth**: 9 stealth modules (navigator, canvas, webgl, webrtc, audio, timezone, screen, clientRects, mediaDevices)
- **Multi-Browser Support**: Chromium, Firefox, WebKit engines
- **Mobile Emulation**: 25+ device presets (iPhone, Samsung, Pixel, iPad)
- **Proxy Support**: HTTP/HTTPS/SOCKS5 with authentication
- **Geo Auto-Detection**: Automatic timezone/locale from proxy IP
- **No-Code Automation**: 40+ action blocks with visual workflow builder
- **Cookie Management**: Import/Export in JSON, Netscape, EditThisCookie, Base64 formats
- **Extension Support**: Load CRX or unpacked extensions

## Quick Start

### Prerequisites

- Node.js 20+
- Rust + Cargo
- Tauri CLI: `cargo install tauri-cli`

### Development

```bash
# Install dependencies
cd frontend && npm install
cd ../sidecar && npm install

# Run development
cd frontend
./run-dev.sh
# or: unset GTK_PATH && npm run tauri dev
```

### Production Build

```bash
cd frontend
unset GTK_PATH && npm run tauri build
```

### Release Artifacts

```
release/
├── mmo-express                        # Standalone binary (12MB)
├── MMO Express_1.0.0_amd64.deb        # Debian/Ubuntu (26MB)
└── MMO Express-1.0.0-1.x86_64.rpm     # Fedora/RHEL (26MB)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MMO EXPRESS                               │
├──────────────────┬──────────────────┬───────────────────────┤
│   Frontend       │   Tauri Backend  │   Playwright Sidecar  │
│   (Svelte)       │   (Rust/SQLite)  │   (Node.js)           │
├──────────────────┼──────────────────┼───────────────────────┤
│ • ProfileList    │ • 20 Commands    │ • Stealth Modules     │
│ • SessionList    │ • Database CRUD  │ • Multi-Browser       │
│ • ProxyList      │ • IPC Bridge     │ • Automation Engine   │
│ • WorkflowBuilder│                  │ • Cookie/Extension    │
└──────────────────┴──────────────────┴───────────────────────┘
```

## Project Structure

```
mmo-express/
├── frontend/                 # Tauri + Svelte app
│   ├── src/                  # Svelte components
│   │   └── lib/
│   │       └── automation/   # Workflow Builder UI
│   └── src-tauri/            # Rust backend
│
├── sidecar/                  # Playwright automation engine
│   ├── stealth/              # 9 anti-detect modules
│   ├── profile/              # Profile system
│   ├── automation/           # 40+ action blocks
│   ├── browser/              # Multi-browser support
│   ├── geo/                  # Geo detection
│   ├── cookie/               # Cookie management
│   ├── extension/            # Extension management
│   └── test/                 # Test suite
│
└── release/                  # Production builds
```

## Automation Actions

| Category | Actions |
|----------|---------|
| **Navigation** | navigate, go-back, go-forward, refresh, new-tab, close-tab, switch-tab |
| **Interaction** | click, type, fill, select, check, upload, hover, scroll, press-key, focus, clear |
| **Wait** | wait-element, wait-time, wait-navigation, wait-network, wait-text, wait-url, wait-function |
| **Data** | get-text, get-attribute, get-url, screenshot, cookies, evaluate, set-variable, calculate |
| **Control** | condition, loop-elements, loop-count, loop-while, try-catch, call-workflow, stop, log |
| **Advanced** | javascript, http-request, random, clipboard, dialog, download, smart-delay, assert |

## Variable System

```
{{profile.name}}              # Profile name
{{session.url}}               # Current URL
{{timestamp}}                 # Unix timestamp
{{random}}                    # Random number
{{loop.index}}                # Current loop index

# With transforms
{{profile.name | uppercase}}
{{price | round}}
{{text | truncate:50}}
{{data | base64}}
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Svelte 5, Vite 7 |
| Desktop | Tauri 2, Rust |
| Database | SQLite (rusqlite) |
| Automation | Playwright |
| Runtime | Node.js 20+ |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture diagrams
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Implementation details

## License

MIT
