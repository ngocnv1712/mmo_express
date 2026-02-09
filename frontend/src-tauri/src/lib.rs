use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use std::sync::atomic::{AtomicU64, Ordering};

mod database;
use database::{Database, DbProfile, DbProxy, DbWorkflow, DbGroup};

// ============ Types ============

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(rename = "viewportWidth")]
    pub viewport_width: Option<i32>,
    #[serde(rename = "viewportHeight")]
    pub viewport_height: Option<i32>,
    pub locale: Option<String>,
    pub timezone: Option<String>,
    #[serde(rename = "geoLatitude")]
    pub geo_latitude: Option<f64>,
    #[serde(rename = "geoLongitude")]
    pub geo_longitude: Option<f64>,
    #[serde(rename = "blockImages")]
    pub block_images: Option<bool>,
    #[serde(rename = "blockMedia")]
    pub block_media: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxyConfig {
    pub host: String,
    pub port: i32,
    #[serde(rename = "type")]
    pub proxy_type: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SidecarResponse {
    pub id: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<String>,
}

// ============ State ============

pub struct SidecarState {
    process: Arc<Mutex<Option<Child>>>,
    request_id: AtomicU64,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            request_id: AtomicU64::new(1),
        }
    }
}

// ============ Database State ============

pub struct DatabaseState {
    db: Database,
}

impl DatabaseState {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            db: Database::new()?,
        })
    }
}

// ============ Sidecar Communication ============

fn start_sidecar() -> Result<Child, String> {
    // In development, run node directly
    #[cfg(debug_assertions)]
    {
        let sidecar_path = std::env::current_dir()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or("No parent directory")?
            .parent()
            .ok_or("No parent directory")?
            .join("sidecar")
            .join("index.js");

        Command::new("node")
            .arg(sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to start sidecar: {}", e))
    }

    // In production, run the bundled binary
    #[cfg(not(debug_assertions))]
    {
        let exe_dir = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or("No parent directory")?
            .to_path_buf();

        #[cfg(target_os = "windows")]
        let sidecar_name = "sidecar.exe";
        #[cfg(not(target_os = "windows"))]
        let sidecar_name = "sidecar";

        let sidecar_path = exe_dir.join(sidecar_name);

        Command::new(sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to start sidecar: {}", e))
    }
}

fn send_command(state: &SidecarState, command: &str, args: Vec<Value>) -> Result<Value, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    // Start sidecar if not running
    if process_guard.is_none() {
        *process_guard = Some(start_sidecar()?);
    }

    let process = process_guard.as_mut().ok_or("Sidecar not running")?;
    let id = state.request_id.fetch_add(1, Ordering::SeqCst);

    // Build request
    let request = json!({
        "id": id,
        "command": command,
        "args": args
    });

    // Send to stdin
    let stdin = process.stdin.as_mut().ok_or("No stdin")?;
    writeln!(stdin, "{}", request.to_string()).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;

    // Read from stdout
    let stdout = process.stdout.as_mut().ok_or("No stdout")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    reader.read_line(&mut line).map_err(|e| e.to_string())?;

    // Parse response
    let response: SidecarResponse = serde_json::from_str(&line)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(error) = response.error {
        return Err(error);
    }

    Ok(response.result.unwrap_or(Value::Null))
}

// ============ Tauri Commands ============

#[tauri::command]
fn init_browser(state: State<SidecarState>, headless: Option<bool>) -> Result<Value, String> {
    let args = vec![json!({ "headless": headless.unwrap_or(false) })];
    send_command(&state, "init", args)
}

#[tauri::command]
fn create_session(
    state: State<SidecarState>,
    profile: Profile,
    proxy: Option<ProxyConfig>,
) -> Result<Value, String> {
    let args = vec![json!(profile), json!(proxy)];
    send_command(&state, "createSession", args)
}

#[tauri::command]
fn navigate_session(state: State<SidecarState>, session_id: String, url: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(url)];
    send_command(&state, "navigate", args)
}

#[tauri::command]
fn close_session(state: State<SidecarState>, session_id: String) -> Result<Value, String> {
    let args = vec![json!(session_id)];
    send_command(&state, "closeSession", args)
}

#[tauri::command]
fn get_sessions(state: State<SidecarState>) -> Result<Value, String> {
    send_command(&state, "getSessions", vec![])
}

#[tauri::command]
fn shutdown_browser(state: State<SidecarState>) -> Result<Value, String> {
    send_command(&state, "shutdown", vec![])
}

#[tauri::command]
fn export_cookies(state: State<SidecarState>, session_id: String) -> Result<Value, String> {
    let args = vec![json!(session_id)];
    send_command(&state, "exportCookies", args)
}

#[tauri::command]
fn import_cookies(state: State<SidecarState>, session_id: String, cookies: Value) -> Result<Value, String> {
    let args = vec![json!(session_id), cookies];
    send_command(&state, "importCookies", args)
}

#[tauri::command]
fn evaluate_script(state: State<SidecarState>, session_id: String, script: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(script)];
    send_command(&state, "evaluate", args)
}

#[tauri::command]
fn take_screenshot(state: State<SidecarState>, session_id: String, path: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(path)];
    send_command(&state, "screenshot", args)
}

// ============ Extension Commands ============

#[tauri::command]
fn list_extensions(state: State<SidecarState>) -> Result<Value, String> {
    send_command(&state, "listExtensions", vec![])
}

#[tauri::command]
fn import_extension(state: State<SidecarState>, source_path: String, extension_id: Option<String>) -> Result<Value, String> {
    let args = vec![json!(source_path), json!(extension_id)];
    send_command(&state, "importExtension", args)
}

#[tauri::command]
fn import_extension_crx(state: State<SidecarState>, crx_path: String) -> Result<Value, String> {
    let args = vec![json!(crx_path)];
    send_command(&state, "importExtensionCRX", args)
}

#[tauri::command]
fn remove_extension(state: State<SidecarState>, extension_id: String) -> Result<Value, String> {
    let args = vec![json!(extension_id)];
    send_command(&state, "removeExtension", args)
}

// ============ Advanced Cookie Commands ============

#[tauri::command]
fn export_cookies_format(state: State<SidecarState>, session_id: String, format: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(format)];
    send_command(&state, "exportCookiesFormat", args)
}

#[tauri::command]
fn import_cookies_string(state: State<SidecarState>, session_id: String, cookie_string: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(cookie_string)];
    send_command(&state, "importCookiesString", args)
}

#[tauri::command]
fn save_cookies_to_file(state: State<SidecarState>, session_id: String, file_path: String, format: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(file_path), json!(format)];
    send_command(&state, "saveCookiesToFile", args)
}

#[tauri::command]
fn load_cookies_from_file(state: State<SidecarState>, session_id: String, file_path: String) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(file_path)];
    send_command(&state, "loadCookiesFromFile", args)
}

#[tauri::command]
fn clear_cookies(state: State<SidecarState>, session_id: String, domain: Option<String>) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(domain)];
    send_command(&state, "clearCookies", args)
}

// ============ Utility Commands ============

#[tauri::command]
fn get_devices(state: State<SidecarState>) -> Result<Value, String> {
    send_command(&state, "getDevices", vec![])
}

#[tauri::command]
fn get_engines(state: State<SidecarState>) -> Result<Value, String> {
    send_command(&state, "getEngines", vec![])
}

#[tauri::command]
fn geo_lookup(state: State<SidecarState>, ip: Option<String>) -> Result<Value, String> {
    let args = vec![json!(ip)];
    send_command(&state, "geoLookup", args)
}

// ============ Testing Commands ============

#[tauri::command]
fn run_antidetect_test(state: State<SidecarState>, session_id: String, expected_timezone: Option<String>) -> Result<Value, String> {
    let args = vec![json!(session_id), json!({ "expectedTimezone": expected_timezone })];
    send_command(&state, "runAntidetectTest", args)
}

#[tauri::command]
fn run_quick_benchmark(state: State<SidecarState>, session_id: String) -> Result<Value, String> {
    let args = vec![json!(session_id)];
    send_command(&state, "runQuickBenchmark", args)
}

#[tauri::command]
fn run_full_benchmark(state: State<SidecarState>, engine: Option<String>) -> Result<Value, String> {
    let args = vec![json!(engine.unwrap_or_else(|| "chromium".to_string()))];
    send_command(&state, "runFullBenchmark", args)
}

#[tauri::command]
fn run_test_suite(state: State<SidecarState>, session_id: String, run_detection_sites: Option<bool>, run_full_benchmark: Option<bool>) -> Result<Value, String> {
    let args = vec![json!(session_id), json!({
        "runDetectionSites": run_detection_sites.unwrap_or(false),
        "runFullBenchmark": run_full_benchmark.unwrap_or(false)
    })];
    send_command(&state, "runTestSuite", args)
}

#[tauri::command]
fn run_detection_site_test(state: State<SidecarState>, session_id: String, site_url: String, timeout: Option<u32>) -> Result<Value, String> {
    let args = vec![json!(session_id), json!(site_url), json!(timeout.unwrap_or(30000))];
    send_command(&state, "runDetectionSiteTest", args)
}

#[tauri::command]
fn get_detection_sites(state: State<SidecarState>) -> Result<Value, String> {
    send_command(&state, "getDetectionSites", vec![])
}

// ============ Database Commands - Profiles ============

#[tauri::command]
fn db_create_profile(state: State<DatabaseState>, profile: DbProfile) -> Result<DbProfile, String> {
    state.db.create_profile(&profile)
}

#[tauri::command]
fn db_get_profiles(state: State<DatabaseState>) -> Result<Vec<DbProfile>, String> {
    state.db.get_profiles()
}

#[tauri::command]
fn db_get_profile(state: State<DatabaseState>, id: String) -> Result<Option<DbProfile>, String> {
    state.db.get_profile(&id)
}

#[tauri::command]
fn db_update_profile(state: State<DatabaseState>, profile: DbProfile) -> Result<(), String> {
    state.db.update_profile(&profile)
}

#[tauri::command]
fn db_delete_profile(state: State<DatabaseState>, id: String) -> Result<(), String> {
    state.db.delete_profile(&id)
}

// ============ Database Commands - Proxies ============

#[tauri::command]
fn db_create_proxy(state: State<DatabaseState>, proxy: DbProxy) -> Result<DbProxy, String> {
    state.db.create_proxy(&proxy)
}

#[tauri::command]
fn db_get_proxies(state: State<DatabaseState>) -> Result<Vec<DbProxy>, String> {
    state.db.get_proxies()
}

#[tauri::command]
fn db_get_proxy(state: State<DatabaseState>, id: String) -> Result<Option<DbProxy>, String> {
    state.db.get_proxy(&id)
}

#[tauri::command]
fn db_update_proxy(state: State<DatabaseState>, proxy: DbProxy) -> Result<(), String> {
    state.db.update_proxy(&proxy)
}

#[tauri::command]
fn db_delete_proxy(state: State<DatabaseState>, id: String) -> Result<(), String> {
    state.db.delete_proxy(&id)
}

// ============ Database Commands - Workflows ============

#[tauri::command]
fn db_create_workflow(state: State<DatabaseState>, workflow: DbWorkflow) -> Result<DbWorkflow, String> {
    state.db.create_workflow(&workflow)
}

#[tauri::command]
fn db_get_workflows(state: State<DatabaseState>) -> Result<Vec<DbWorkflow>, String> {
    state.db.get_workflows()
}

#[tauri::command]
fn db_get_workflow(state: State<DatabaseState>, id: String) -> Result<Option<DbWorkflow>, String> {
    state.db.get_workflow(&id)
}

#[tauri::command]
fn db_update_workflow(state: State<DatabaseState>, workflow: DbWorkflow) -> Result<(), String> {
    state.db.update_workflow(&workflow)
}

#[tauri::command]
fn db_delete_workflow(state: State<DatabaseState>, id: String) -> Result<(), String> {
    state.db.delete_workflow(&id)
}

// ============ Database Commands - Groups ============

#[tauri::command]
fn db_create_group(state: State<DatabaseState>, group: DbGroup) -> Result<DbGroup, String> {
    state.db.create_group(&group)
}

#[tauri::command]
fn db_get_groups(state: State<DatabaseState>) -> Result<Vec<DbGroup>, String> {
    state.db.get_groups()
}

#[tauri::command]
fn db_update_group(state: State<DatabaseState>, group: DbGroup) -> Result<(), String> {
    state.db.update_group(&group)
}

#[tauri::command]
fn db_delete_group(state: State<DatabaseState>, id: String) -> Result<(), String> {
    state.db.delete_group(&id)
}

// ============ App Entry ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = DatabaseState::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(SidecarState::new())
        .manage(db_state)
        .invoke_handler(tauri::generate_handler![
            // Sidecar commands
            init_browser,
            create_session,
            navigate_session,
            close_session,
            get_sessions,
            shutdown_browser,
            export_cookies,
            import_cookies,
            evaluate_script,
            take_screenshot,
            // Extensions
            list_extensions,
            import_extension,
            import_extension_crx,
            remove_extension,
            // Advanced Cookies
            export_cookies_format,
            import_cookies_string,
            save_cookies_to_file,
            load_cookies_from_file,
            clear_cookies,
            // Utilities
            get_devices,
            get_engines,
            geo_lookup,
            // Testing
            run_antidetect_test,
            run_quick_benchmark,
            run_full_benchmark,
            run_test_suite,
            run_detection_site_test,
            get_detection_sites,
            // Database - Profiles
            db_create_profile,
            db_get_profiles,
            db_get_profile,
            db_update_profile,
            db_delete_profile,
            // Database - Proxies
            db_create_proxy,
            db_get_proxies,
            db_get_proxy,
            db_update_proxy,
            db_delete_proxy,
            // Database - Workflows
            db_create_workflow,
            db_get_workflows,
            db_get_workflow,
            db_update_workflow,
            db_delete_workflow,
            // Database - Groups
            db_create_group,
            db_get_groups,
            db_update_group,
            db_delete_group,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
