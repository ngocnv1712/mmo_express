# MMO Express - System Architecture

## 1. Tổng quan hệ thống

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MMO EXPRESS APPLICATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (Svelte + Vite)                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Profile  │ │ Session  │ │  Proxy   │ │Extension │ │ Settings │  │   │
│  │  │   List   │ │   List   │ │   List   │ │   List   │ │          │  │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │   │
│  │       │            │            │            │            │         │   │
│  │       └────────────┴────────────┴────────────┴────────────┘         │   │
│  │                              │                                       │   │
│  │                     ┌────────▼────────┐                             │   │
│  │                     │   API Bridge    │                             │   │
│  │                     │   (api.js)      │                             │   │
│  │                     └────────┬────────┘                             │   │
│  └──────────────────────────────┼──────────────────────────────────────┘   │
│                                 │                                           │
│                        Tauri IPC (invoke)                                   │
│                                 │                                           │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │                         TAURI BACKEND (Rust)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │   Commands   │  │   Database   │  │    Sidecar Manager       │   │   │
│  │  │   (lib.rs)   │  │  (SQLite)    │  │    (SidecarState)        │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘   │   │
│  │         │                 │                      │                   │   │
│  └─────────┼─────────────────┼──────────────────────┼───────────────────┘   │
│            │                 │                      │                       │
│            │                 │          stdin/stdout (JSON-RPC)             │
│            │                 │                      │                       │
│  ┌─────────┼─────────────────┼──────────────────────▼───────────────────┐   │
│  │         │                 │      PLAYWRIGHT SIDECAR (Node.js)        │   │
│  │         │                 │  ┌─────────────────────────────────────┐ │   │
│  │         │                 │  │           Browser Engine            │ │   │
│  │         │                 │  │  ┌─────────┐  ┌─────────┐          │ │   │
│  │         │                 │  │  │Context 1│  │Context 2│  ...     │ │   │
│  │         │                 │  │  │(Profile)│  │(Profile)│          │ │   │
│  │         │                 │  │  └─────────┘  └─────────┘          │ │   │
│  │         │                 │  └─────────────────────────────────────┘ │   │
│  │         │                 │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │         │                 │  │ Stealth  │ │ Profile  │ │   Geo    │ │   │
│  │         │                 │  │ Module   │ │ Module   │ │  Lookup  │ │   │
│  │         │                 │  └──────────┘ └──────────┘ └──────────┘ │   │
│  └─────────┼─────────────────┼──────────────────────────────────────────┘   │
│            │                 │                                              │
└────────────┼─────────────────┼──────────────────────────────────────────────┘
             │                 │
             ▼                 ▼
      ┌──────────┐      ┌──────────┐
      │  Proxy   │      │ Database │
      │ Servers  │      │  (file)  │
      └──────────┘      └──────────┘
```

---

## 2. Component Architecture

### 2.1 Frontend Layer (Svelte)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND COMPONENTS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      App.svelte                          │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │Profiles │  │Sessions │  │ Proxies │  │Settings │    │    │
│  │  │   Tab   │  │   Tab   │  │   Tab   │  │   Tab   │    │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │    │
│  └───────┼────────────┼───────────┼────────────┼──────────┘    │
│          │            │           │            │                │
│          ▼            ▼           ▼            ▼                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ProfileList │ │SessionList │ │ ProxyList  │ │  Settings  │   │
│  │  .svelte   │ │  .svelte   │ │  .svelte   │ │  .svelte   │   │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────────────┘   │
│        │              │              │                          │
│        ▼              │              │                          │
│  ┌────────────┐       │              │                          │
│  │ProfileEdit │       │              │                          │
│  │  .svelte   │       │              │                          │
│  └────────────┘       │              │                          │
│                       │              │                          │
├───────────────────────┼──────────────┼──────────────────────────┤
│                       ▼              ▼                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      api.js (API Bridge)                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • initBrowser()      • createSession()                  │   │
│  │  • navigateSession()  • closeSession()                   │   │
│  │  • getSessions()      • shutdownBrowser()                │   │
│  │  • exportCookies()    • importCookies()                  │   │
│  │  • evaluateScript()   • takeScreenshot()                 │   │
│  │  • launchProfile()    • batchLaunch()                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  @tauri-apps/api    │
                    │     invoke()        │
                    └─────────────────────┘
```

### 2.2 Tauri Backend Layer (Rust)

```
┌─────────────────────────────────────────────────────────────────┐
│                      TAURI BACKEND (lib.rs)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    SidecarState (Mutex)                  │    │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │    │
│  │  │ process: Child  │  │ request_id: AtomicU64       │   │    │
│  │  │ (stdin/stdout)  │  │ (auto-increment)            │   │    │
│  │  └─────────────────┘  └─────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Tauri Commands                          │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  #[tauri::command]                                         │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │ init_browser │ │create_session│ │   navigate   │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │close_session │ │ get_sessions │ │   shutdown   │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │export_cookies│ │import_cookies│ │  evaluate    │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                  send_command() Function                   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  1. Lock SidecarState mutex                                │  │
│  │  2. Start sidecar if not running                           │  │
│  │  3. Build JSON request: { id, command, args }              │  │
│  │  4. Write to stdin + flush                                 │  │
│  │  5. Read response from stdout                              │  │
│  │  6. Parse JSON response                                    │  │
│  │  7. Return result or error                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Sidecar Layer (Node.js + Playwright)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYWRIGHT SIDECAR (index.js)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   IPC Communication                      │    │
│  │  ┌────────────┐        ┌────────────────────────────┐   │    │
│  │  │  readline  │◄──────►│  JSON-RPC over stdin/out   │   │    │
│  │  │ interface  │        │  { id, command, args }     │   │    │
│  │  └────────────┘        │  { id, result/error }      │   │    │
│  │                        └────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Command Handlers                        │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  handlers = {                                              │  │
│  │    init: initBrowser,       createSession,                 │  │
│  │    navigate,                closeSession,                  │  │
│  │    getSessions,             shutdown,                      │  │
│  │    exportCookies,           importCookies,                 │  │
│  │    evaluate,                screenshot,                    │  │
│  │  }                                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │               Browser Engine (playwright-extra)            │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              SHARED BROWSER INSTANCE                  │ │  │
│  │  │  (chromium.launch() - Single process)                 │ │  │
│  │  └───────────────────────┬──────────────────────────────┘ │  │
│  │                          │                                 │  │
│  │    ┌─────────────────────┼─────────────────────┐          │  │
│  │    │                     │                     │          │  │
│  │    ▼                     ▼                     ▼          │  │
│  │  ┌──────────┐      ┌──────────┐         ┌──────────┐     │  │
│  │  │ Context  │      │ Context  │         │ Context  │     │  │
│  │  │    1     │      │    2     │   ...   │    N     │     │  │
│  │  │(Profile1)│      │(Profile2)│         │(ProfileN)│     │  │
│  │  ├──────────┤      ├──────────┤         ├──────────┤     │  │
│  │  │• Cookies │      │• Cookies │         │• Cookies │     │  │
│  │  │• Storage │      │• Storage │         │• Storage │     │  │
│  │  │• Proxy   │      │• Proxy   │         │• Proxy   │     │  │
│  │  │• Stealth │      │• Stealth │         │• Stealth │     │  │
│  │  └────┬─────┘      └────┬─────┘         └────┬─────┘     │  │
│  │       │                 │                    │            │  │
│  │       ▼                 ▼                    ▼            │  │
│  │  ┌──────────┐      ┌──────────┐         ┌──────────┐     │  │
│  │  │  Page 1  │      │  Page 2  │         │  Page N  │     │  │
│  │  └──────────┘      └──────────┘         └──────────┘     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Stealth Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      STEALTH MODULE (/stealth)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     index.js (Main)                      │    │
│  │  buildStealthScript(profile) → Combined JavaScript       │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐       ┌────────────┐      ┌────────────┐       │
│  │ P0: CRITICAL│       │ P1: IMPORTANT│     │P2: ADDITIONAL│    │
│  └──────┬─────┘       └──────┬─────┘      └──────┬─────┘       │
│         │                    │                   │              │
│  ┌──────▼──────┐      ┌──────▼──────┐     ┌──────▼──────┐      │
│  │navigator.js │      │  audio.js   │     │clientRects  │      │
│  │• webdriver  │      │• AudioBuffer│     │  .js        │      │
│  │• platform   │      │• noise      │     │• getBounding│      │
│  │• CPU/RAM    │      └─────────────┘     │  ClientRect │      │
│  │• plugins    │                          └─────────────┘      │
│  └─────────────┘      ┌─────────────┐     ┌─────────────┐      │
│  ┌─────────────┐      │timezone.js  │     │mediaDevices │      │
│  │  webgl.js   │      │• Intl.Date  │     │  .js        │      │
│  │• vendor     │      │  TimeFormat │     │• fake cams  │      │
│  │• renderer   │      │• getTimezone│     │• fake mics  │      │
│  │• params     │      │  Offset     │     │• fake spkrs │      │
│  └─────────────┘      │• geolocation│     └─────────────┘      │
│  ┌─────────────┐      └─────────────┘                          │
│  │  canvas.js  │                                                │
│  │• toDataURL  │                                                │
│  │• toBlob     │                                                │
│  │• noise      │                                                │
│  └─────────────┘                                                │
│  ┌─────────────┐                                                │
│  │  screen.js  │                                                │
│  │• width/height│                                               │
│  │• colorDepth │                                                │
│  │• pixelRatio │                                                │
│  └─────────────┘                                                │
│  ┌─────────────┐                                                │
│  │  webrtc.js  │                                                │
│  │• disable    │                                                │
│  │• replace IP │                                                │
│  │• SDP modify │                                                │
│  └─────────────┘                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Profile Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROFILE MODULE (/profile)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     index.js (Export)                    │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐       ┌────────────┐      ┌────────────┐       │
│  │ schema.js  │       │generator.js│      │ presets.js │       │
│  └──────┬─────┘       └──────┬─────┘      └──────┬─────┘       │
│         │                    │                   │              │
│         ▼                    ▼                   ▼              │
│  ┌─────────────┐      ┌─────────────┐     ┌─────────────┐      │
│  │ Profile     │      │generateRand │     │ 9 Presets:  │      │
│  │ Structure:  │      │  om()       │     │             │      │
│  │             │      │             │     │• win-nvidia │      │
│  │• id, name   │      │generateWin  │     │• win-amd    │      │
│  │• browser    │      │  dows()     │     │• win-intel  │      │
│  │• os/platform│      │             │     │• win-firefox│      │
│  │• screen     │      │generateMac  │     │• mac-chrome │      │
│  │• timezone   │      │  OS()       │     │• mac-safari │      │
│  │• hardware   │      │             │     │• linux-chr  │      │
│  │• webgl      │      │generateLin  │     │• linux-ff   │      │
│  │• noise vals │      │  ux()       │     │• android    │      │
│  │• webrtc     │      └─────────────┘     └─────────────┘      │
│  │• geo        │                                                │
│  │• media      │      ┌─────────────────────────────────┐      │
│  │• privacy    │      │         Data Sets               │      │
│  │• fonts      │      ├─────────────────────────────────┤      │
│  │• proxy      │      │• User Agents (Win/Mac/Linux)    │      │
│  │• tags       │      │• GPU Database (NVIDIA/AMD/Intel)│      │
│  └─────────────┘      │• Resolutions (7 common)         │      │
│                       │• Geo Profiles (13 regions)      │      │
│  ┌─────────────┐      │• Fonts (Win/Mac/Linux)          │      │
│  │ Modes:      │      │• Speech Voices                  │      │
│  │• WebRTC:    │      └─────────────────────────────────┘      │
│  │  real/      │                                                │
│  │  replace/   │                                                │
│  │  disable    │                                                │
│  │• Geo:       │                                                │
│  │  real/allow/│                                                │
│  │  block/query│                                                │
│  │• Media:     │                                                │
│  │  real/fake/ │                                                │
│  │  block      │                                                │
│  └─────────────┘                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow Diagrams

### 5.1 Launch Profile Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │ Frontend │     │  Tauri   │     │ Sidecar  │
│  (UI)    │     │ (Svelte) │     │  (Rust)  │     │ (Node)   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ Click Launch   │                │                │
     │───────────────►│                │                │
     │                │                │                │
     │                │ launchProfile()│                │
     │                │───────────────►│                │
     │                │                │                │
     │                │                │ invoke('init') │
     │                │                │───────────────►│
     │                │                │                │
     │                │                │                │ Start Browser
     │                │                │                │ (if not running)
     │                │                │◄───────────────│
     │                │                │   { success }  │
     │                │                │                │
     │                │                │ invoke('create │
     │                │                │ _session')     │
     │                │                │───────────────►│
     │                │                │                │
     │                │                │                │ Create Context
     │                │                │                │ + Inject Stealth
     │                │                │                │ + Create Page
     │                │                │◄───────────────│
     │                │                │  {sessionId}   │
     │                │                │                │
     │                │                │ invoke('navig  │
     │                │                │ ate')          │
     │                │                │───────────────►│
     │                │                │                │
     │                │                │                │ page.goto(url)
     │                │                │◄───────────────│
     │                │                │   { success }  │
     │                │◄───────────────│                │
     │                │  Result        │                │
     │◄───────────────│                │                │
     │ Browser Opens  │                │                │
     │                │                │                │
```

### 5.2 Stealth Injection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEALTH INJECTION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐                                               │
│   │   Profile   │                                               │
│   │   Object    │                                               │
│   └──────┬──────┘                                               │
│          │                                                       │
│          ▼                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              buildStealthScript(profile)                 │   │
│   └───────────────────────────┬─────────────────────────────┘   │
│                               │                                  │
│          ┌────────────────────┼────────────────────┐            │
│          ▼                    ▼                    ▼            │
│   ┌────────────┐       ┌────────────┐      ┌────────────┐      │
│   │ Navigator  │       │   WebGL    │      │   Canvas   │      │
│   │  Script    │       │  Script    │      │  Script    │      │
│   └────────────┘       └────────────┘      └────────────┘      │
│          │                    │                   │             │
│          └────────────────────┼───────────────────┘             │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────┐                         │
│                    │ Combined Script  │                         │
│                    │ (20KB+ JS code)  │                         │
│                    └────────┬─────────┘                         │
│                             │                                    │
│                             ▼                                    │
│                    ┌──────────────────┐                         │
│                    │ context.addInit  │                         │
│                    │ Script(script)   │                         │
│                    └────────┬─────────┘                         │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Browser Page                          │   │
│   │  ┌─────────────────────────────────────────────────┐    │   │
│   │  │          Injected BEFORE page loads              │    │   │
│   │  │                                                  │    │   │
│   │  │  • navigator.webdriver = undefined               │    │   │
│   │  │  • navigator.platform = 'Win32'                  │    │   │
│   │  │  • WebGL vendor/renderer spoofed                 │    │   │
│   │  │  • Canvas toDataURL() adds noise                 │    │   │
│   │  │  • WebRTC IP replaced                            │    │   │
│   │  │  • Timezone overridden                           │    │   │
│   │  │  • ... more overrides                            │    │   │
│   │  └─────────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 IPC Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     IPC COMMUNICATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TAURI (Rust)                           SIDECAR (Node.js)       │
│  ┌─────────────┐                        ┌─────────────┐         │
│  │             │                        │             │         │
│  │  Command    │   stdin (write)        │  readline   │         │
│  │  Handler    │──────────────────────► │  interface  │         │
│  │             │                        │             │         │
│  │             │                        │             │         │
│  │  JSON:      │                        │  Parse:     │         │
│  │  {          │                        │  {          │         │
│  │   id: 1,    │                        │   id: 1,    │         │
│  │   command:  │                        │   command:  │         │
│  │   "create   │                        │   "create   │         │
│  │   Session", │                        │   Session", │         │
│  │   args: [   │                        │   args: []  │         │
│  │    profile, │                        │  }          │         │
│  │    proxy    │                        │             │         │
│  │   ]         │                        │     │       │         │
│  │  }          │                        │     ▼       │         │
│  │             │                        │  Execute    │         │
│  │             │                        │  Handler    │         │
│  │             │                        │             │         │
│  │             │   stdout (read)        │             │         │
│  │  BufReader  │◄────────────────────── │  console    │         │
│  │  read_line  │                        │  .log()     │         │
│  │             │                        │             │         │
│  │  JSON:      │                        │  JSON:      │         │
│  │  {          │                        │  {          │         │
│  │   id: 1,    │                        │   id: 1,    │         │
│  │   result: { │                        │   result: { │         │
│  │    success, │                        │    success, │         │
│  │    sessionId│                        │    sessionId│         │
│  │   }         │                        │   }         │         │
│  │  }          │                        │  }          │         │
│  │             │                        │             │         │
│  └─────────────┘                        └─────────────┘         │
│                                                                  │
│  Note: stderr is used for logging (console.error)               │
│        stdout is ONLY for JSON responses                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Memory Architecture (Browser Context)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE                           │
│              (Single Browser - Multi Context)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Traditional Approach (Selenium/Puppeteer):                     │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Browser 1    Browser 2    Browser 3    Browser 4      │     │
│  │  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐    │     │
│  │  │ 200MB  │   │ 200MB  │   │ 200MB  │   │ 200MB  │    │     │
│  │  └────────┘   └────────┘   └────────┘   └────────┘    │     │
│  │  Profile 1    Profile 2    Profile 3    Profile 4      │     │
│  │                                                        │     │
│  │  Total RAM: 800MB for 4 profiles                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  Playwright Browser Context Approach:                           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                  SHARED BROWSER (150MB)                 │     │
│  │  ┌──────────────────────────────────────────────────┐  │     │
│  │  │              Core Browser Process                 │  │     │
│  │  │  • V8 Engine (shared)                            │  │     │
│  │  │  • Renderer Process Manager                      │  │     │
│  │  │  • Network Stack (shared)                        │  │     │
│  │  └──────────────────────────────────────────────────┘  │     │
│  │                          │                              │     │
│  │    ┌─────────────────────┼─────────────────────┐       │     │
│  │    │                     │                     │       │     │
│  │    ▼                     ▼                     ▼       │     │
│  │  ┌──────┐            ┌──────┐            ┌──────┐     │     │
│  │  │ 30MB │            │ 30MB │            │ 30MB │     │     │
│  │  │Ctx 1 │            │Ctx 2 │            │Ctx 3 │     │     │
│  │  │──────│            │──────│            │──────│     │     │
│  │  │Cookie│            │Cookie│            │Cookie│     │     │
│  │  │Cache │            │Cache │            │Cache │     │     │
│  │  │State │            │State │            │State │     │     │
│  │  └──────┘            └──────┘            └──────┘     │     │
│  │  Profile1            Profile2            Profile3      │     │
│  │                                                        │     │
│  │  Total RAM: 150 + (30 × 3) = 240MB for 3 profiles     │     │
│  │             150 + (30 × 10) = 450MB for 10 profiles   │     │
│  │             150 + (30 × 100) = 3150MB for 100 profiles│     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                   RAM COMPARISON                        │     │
│  ├─────────────────┬──────────────┬───────────────────────┤     │
│  │    Profiles     │  Traditional │  Browser Context      │     │
│  ├─────────────────┼──────────────┼───────────────────────┤     │
│  │        4        │    800 MB    │      270 MB (-66%)    │     │
│  │       10        │   2000 MB    │      450 MB (-78%)    │     │
│  │       50        │  10000 MB    │     1650 MB (-84%)    │     │
│  │      100        │  20000 MB    │     3150 MB (-84%)    │     │
│  └─────────────────┴──────────────┴───────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. File Structure

```
mmo-express/
├── frontend/                          # Tauri + Svelte Frontend
│   ├── src/                           # Svelte source
│   │   ├── App.svelte                 # Main app component
│   │   ├── main.js                    # Entry point
│   │   └── lib/
│   │       ├── api.js                 # Tauri API bridge
│   │       ├── stores.js              # Svelte stores
│   │       ├── ProfileList.svelte     # Profile management
│   │       ├── SessionList.svelte     # Active sessions
│   │       ├── ProxyList.svelte       # Proxy management
│   │       └── automation/            # Workflow Builder UI
│   │           ├── index.js           # Module exports
│   │           ├── AutomationBuilder.svelte  # Main builder
│   │           ├── ActionPalette.svelte      # Action sidebar
│   │           ├── WorkflowCanvas.svelte     # Drag-drop canvas
│   │           ├── ActionBlock.svelte        # Action block
│   │           └── PropertyPanel.svelte      # Config editor
│   │
│   ├── src-tauri/                     # Tauri Rust backend
│   │   ├── src/
│   │   │   └── lib.rs                 # Main Tauri commands + DB
│   │   ├── Cargo.toml                 # Rust dependencies
│   │   └── tauri.conf.json            # Tauri config
│   │
│   ├── run-dev.sh                     # Dev script (fixes GTK)
│   ├── package.json                   # npm dependencies
│   └── vite.config.js                 # Vite config
│
├── sidecar/                           # Node.js Playwright Sidecar
│   ├── index.js                       # Main sidecar + HTTP server
│   │
│   ├── stealth/                       # Anti-detect modules (9 files)
│   │   ├── index.js                   # Main stealth builder
│   │   ├── navigator.js               # Navigator spoofing
│   │   ├── canvas.js                  # Canvas fingerprint
│   │   ├── webgl.js                   # WebGL spoofing
│   │   ├── webrtc.js                  # WebRTC protection
│   │   ├── audio.js                   # Audio fingerprint
│   │   ├── timezone.js                # Timezone/Geo
│   │   ├── screen.js                  # Screen properties
│   │   ├── clientRects.js             # ClientRects noise
│   │   └── mediaDevices.js            # Media devices
│   │
│   ├── profile/                       # Profile management
│   │   ├── index.js                   # Module exports
│   │   ├── schema.js                  # Profile schema (50+ fields)
│   │   ├── generator.js               # Random generator
│   │   ├── presets.js                 # 9 preset profiles
│   │   └── devices.js                 # 25+ mobile devices
│   │
│   ├── browser/                       # Multi-browser support
│   │   └── engines.js                 # Chromium/Firefox/WebKit
│   │
│   ├── geo/                           # Geo detection
│   │   ├── lookup.js                  # IP geo lookup
│   │   └── countries.js               # 60+ country mappings
│   │
│   ├── extension/                     # Extension management
│   │   └── manager.js                 # CRX/unpacked import
│   │
│   ├── cookie/                        # Cookie management
│   │   └── manager.js                 # JSON/Netscape/Base64
│   │
│   ├── automation/                    # No-Code Automation
│   │   ├── index.js                   # WorkflowManager
│   │   ├── executor.js                # WorkflowExecutor
│   │   ├── variables.js               # Variable system
│   │   └── actions/                   # 40+ action blocks
│   │       ├── index.js               # Action registry
│   │       ├── navigation.js          # 7 navigation actions
│   │       ├── interaction.js         # 11 interaction actions
│   │       ├── wait.js                # 7 wait actions
│   │       ├── data.js                # 13 data actions
│   │       ├── control.js             # 12 control flow actions
│   │       └── advanced.js            # 10 advanced actions
│   │
│   ├── test/                          # Testing suite
│   │   ├── antidetect.js              # Anti-detect tests
│   │   ├── benchmark.js               # Performance tests
│   │   ├── runner.js                  # Test orchestrator
│   │   └── cli.js                     # CLI runner
│   │
│   └── package.json                   # npm dependencies
│
├── release/                           # Production builds
│   ├── mmo-express                    # Standalone binary (12MB)
│   ├── MMO Express_1.0.0_amd64.deb    # Debian package (26MB)
│   └── MMO Express-1.0.0-1.x86_64.rpm # RPM package (26MB)
│
├── ARCHITECTURE.md                    # This file
├── IMPLEMENTATION_PLAN.md             # Implementation plan
└── README.md                          # Project documentation
```

---

## 8. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Svelte 5 | UI Framework |
| | Vite 7 | Build tool |
| | TailwindCSS | Styling |
| **App Shell** | Tauri 2 | Desktop app framework |
| | Rust | Backend language |
| | SQLite | Local database |
| **Automation** | Playwright | Browser automation |
| | Node.js 18+ | Runtime |
| | playwright-extra | Stealth plugin support |
| **Packaging** | pkg | Node.js to binary |
| | Tauri bundler | App packaging |

---

## 9. Security Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PROCESS ISOLATION                                           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • Tauri runs in separate process from sidecar         │     │
│  │  • Each browser context is isolated                    │     │
│  │  • No shared cookies/storage between contexts          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  2. DATA STORAGE                                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • SQLite database stored locally                      │     │
│  │  • Proxy credentials encrypted at rest                 │     │
│  │  • Session data isolated per profile                   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  3. NETWORK SECURITY                                            │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • WebRTC IP leak prevention                           │     │
│  │  • Proxy authentication support                        │     │
│  │  • DNS leak prevention via proxy                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  4. FINGERPRINT PROTECTION                                      │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • Unique fingerprint per profile                      │     │
│  │  • No automation detection markers                     │     │
│  │  • Consistent fingerprint across sessions              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Automation System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  NO-CODE AUTOMATION SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   WORKFLOW BUILDER UI                    │    │
│  │  ┌────────────┐  ┌────────────────┐  ┌──────────────┐  │    │
│  │  │  Action    │  │  Workflow      │  │  Property    │  │    │
│  │  │  Palette   │  │  Canvas        │  │  Panel       │  │    │
│  │  │  (40+      │  │  (Drag-Drop)   │  │  (Config)    │  │    │
│  │  │  actions)  │  │                │  │              │  │    │
│  │  └────────────┘  └────────────────┘  └──────────────┘  │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  WORKFLOW EXECUTOR                       │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  • Variable interpolation: {{profile.name | uppercase}} │    │
│  │  • Control flow: conditions, loops, try-catch           │    │
│  │  • Step-by-step execution with status tracking          │    │
│  │  • Batch execution on multiple profiles                 │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │                   ACTION CATEGORIES                      │    │
│  ├──────────────┬──────────────┬──────────────┬────────────┤    │
│  │ Navigation   │ Interaction  │    Wait      │    Data    │    │
│  │ ────────────│──────────────│──────────────│────────────│    │
│  │ • navigate  │ • click      │ • wait-elem  │ • get-text │    │
│  │ • go-back   │ • type       │ • wait-time  │ • get-attr │    │
│  │ • go-forward│ • fill       │ • wait-nav   │ • screenshot│   │
│  │ • refresh   │ • select     │ • wait-net   │ • cookies  │    │
│  │ • new-tab   │ • hover      │ • wait-text  │ • evaluate │    │
│  │ • close-tab │ • scroll     │ • wait-url   │ • set-var  │    │
│  │ • switch-tab│ • upload     │ • wait-func  │ • calculate│    │
│  ├──────────────┴──────────────┴──────────────┴────────────┤    │
│  │   Control Flow      │        Advanced                   │    │
│  │ ────────────────────│────────────────────────────────── │    │
│  │ • condition         │ • javascript                      │    │
│  │ • loop-elements     │ • http-request                    │    │
│  │ • loop-count        │ • random                          │    │
│  │ • loop-while        │ • clipboard                       │    │
│  │ • loop-array        │ • dialog                          │    │
│  │ • break/continue    │ • download                        │    │
│  │ • try-catch         │ • smart-delay                     │    │
│  │ • call-workflow     │ • assert                          │    │
│  │ • stop/log          │ • get-html                        │    │
│  └─────────────────────┴────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. Completed Phases & Future Extensions

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETED PHASES ✅                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Core Anti-Detect ✅                                   │
│  ├── 9 stealth modules (navigator, canvas, webgl, etc.)         │
│  ├── Profile system with 50+ fields                             │
│  └── 9 preset profiles                                          │
│                                                                  │
│  Phase 2: Multi-Browser & Mobile ✅                             │
│  ├── Chromium + Firefox + WebKit support                        │
│  ├── 25+ mobile device presets                                  │
│  └── Automatic engine selection                                 │
│                                                                  │
│  Phase 3: Advanced Proxy ✅                                     │
│  ├── HTTP/HTTPS/SOCKS5 with auth                                │
│  ├── Geo auto-detection from proxy IP                           │
│  └── 60+ country timezone/locale mappings                       │
│                                                                  │
│  Phase 4: Database & Storage ✅                                 │
│  ├── SQLite integration (rusqlite)                              │
│  ├── 20 Tauri commands                                          │
│  └── Profile/Proxy/Workflow CRUD                                │
│                                                                  │
│  Phase 5: Frontend UI ✅                                        │
│  ├── ProfileList, SessionList, ProxyList                        │
│  ├── Workflow Builder (drag-drop)                               │
│  └── Dark theme UI                                              │
│                                                                  │
│  Phase 6: Advanced Features ✅                                  │
│  ├── Extension management (CRX/unpacked)                        │
│  ├── Cookie import/export (4 formats)                           │
│  └── Batch operations                                           │
│                                                                  │
│  Phase 7: Testing & Optimization ✅                             │
│  ├── Anti-detect test suite                                     │
│  ├── Performance benchmarks                                     │
│  └── CLI test runner                                            │
│                                                                  │
│  Phase 8: No-Code Automation ✅                                 │
│  ├── 40+ action blocks                                          │
│  ├── Variable system with transforms                            │
│  ├── Control flow (conditions, loops, try-catch)                │
│  └── Visual workflow builder                                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    FUTURE EXTENSIONS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Optional Enhancements:                                         │
│  ├── Profile groups & tagging                                   │
│  ├── Cloud sync for profiles/workflows                          │
│  ├── REST API for external tools                                │
│  ├── Real-time session preview                                  │
│  ├── Workflow marketplace                                       │
│  ├── Team collaboration features                                │
│  └── Analytics & reporting dashboard                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
