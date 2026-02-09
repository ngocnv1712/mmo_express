use rusqlite::{Connection, params, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

// ============ Database Types ============

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbProfile {
    pub id: String,
    pub name: String,

    // Browser
    #[serde(rename = "browserType")]
    pub browser_type: String,
    #[serde(rename = "browserVersion")]
    pub browser_version: String,
    #[serde(rename = "userAgent")]
    pub user_agent: String,

    // OS
    pub os: String,
    pub platform: String,

    // Screen
    #[serde(rename = "viewportWidth")]
    pub viewport_width: i32,
    #[serde(rename = "viewportHeight")]
    pub viewport_height: i32,
    #[serde(rename = "screenWidth")]
    pub screen_width: i32,
    #[serde(rename = "screenHeight")]
    pub screen_height: i32,
    #[serde(rename = "colorDepth")]
    pub color_depth: i32,
    #[serde(rename = "pixelRatio")]
    pub pixel_ratio: f64,

    // Timezone & Locale
    #[serde(rename = "timezoneMode")]
    pub timezone_mode: String,
    pub timezone: String,
    #[serde(rename = "localeMode")]
    pub locale_mode: String,
    pub locale: String,
    pub language: String,
    pub country: String,

    // Hardware
    #[serde(rename = "cpuCores")]
    pub cpu_cores: i32,
    #[serde(rename = "deviceMemory")]
    pub device_memory: i32,
    #[serde(rename = "maxTouchPoints")]
    pub max_touch_points: i32,

    // WebGL
    #[serde(rename = "webglImageMode")]
    pub webgl_image_mode: String,
    #[serde(rename = "webglMetadataMode")]
    pub webgl_metadata_mode: String,
    #[serde(rename = "webglVendor")]
    pub webgl_vendor: String,
    #[serde(rename = "webglRenderer")]
    pub webgl_renderer: String,

    // Fingerprint Noise
    #[serde(rename = "canvasNoise")]
    pub canvas_noise: f64,
    #[serde(rename = "audioNoise")]
    pub audio_noise: f64,
    #[serde(rename = "clientRectsNoise")]
    pub client_rects_noise: f64,

    // WebRTC
    #[serde(rename = "webrtcMode")]
    pub webrtc_mode: String,
    #[serde(rename = "webrtcPublicIP")]
    pub webrtc_public_ip: String,

    // Geolocation
    #[serde(rename = "geoMode")]
    pub geo_mode: String,
    #[serde(rename = "geoLatitude")]
    pub geo_latitude: f64,
    #[serde(rename = "geoLongitude")]
    pub geo_longitude: f64,
    #[serde(rename = "geoAccuracy")]
    pub geo_accuracy: f64,

    // Media Devices
    #[serde(rename = "mediaDevicesMode")]
    pub media_devices_mode: String,
    #[serde(rename = "fakeCameras")]
    pub fake_cameras: i32,
    #[serde(rename = "fakeMicrophones")]
    pub fake_microphones: i32,
    #[serde(rename = "fakeSpeakers")]
    pub fake_speakers: i32,

    // Privacy
    #[serde(rename = "doNotTrack")]
    pub do_not_track: bool,
    #[serde(rename = "blockWebRTC")]
    pub block_webrtc: bool,
    #[serde(rename = "blockCanvas")]
    pub block_canvas: bool,
    #[serde(rename = "blockAudioContext")]
    pub block_audio_context: bool,
    #[serde(rename = "blockImages")]
    pub block_images: bool,
    #[serde(rename = "blockMedia")]
    pub block_media: bool,

    // Lists (JSON strings)
    pub fonts: String,
    pub plugins: String,
    #[serde(rename = "speechVoices")]
    pub speech_voices: String,

    // Relations
    #[serde(rename = "proxyId")]
    pub proxy_id: String,
    #[serde(rename = "groupId")]
    pub group_id: String,
    #[serde(rename = "platformTags")]
    pub platform_tags: String,

    // Notes
    pub notes: String,
    pub bookmarks: String,

    // Status
    pub status: String,
    #[serde(rename = "lastUsedAt")]
    pub last_used_at: String,
    #[serde(rename = "lastIP")]
    pub last_ip: String,

    // Metadata
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbProxy {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub proxy_type: String,
    pub host: String,
    pub port: i32,
    pub username: String,
    pub password: String,
    pub country: String,
    pub city: String,
    pub status: String,
    #[serde(rename = "lastTestedAt")]
    pub last_tested_at: String,
    #[serde(rename = "lastIP")]
    pub last_ip: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbWorkflow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub blocks: String,           // JSON string of workflow blocks
    pub variables: String,        // JSON string of workflow variables
    pub settings: String,         // JSON string of workflow settings
    pub status: String,           // active, inactive
    #[serde(rename = "lastRunAt")]
    pub last_run_at: String,
    #[serde(rename = "runCount")]
    pub run_count: i32,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbGroup {
    pub id: String,
    pub name: String,
    pub color: String,
    pub description: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

// ============ Database State ============

pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_path = get_database_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Profiles table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                browser_type TEXT DEFAULT 'chrome',
                browser_version TEXT DEFAULT '120',
                user_agent TEXT,
                os TEXT DEFAULT 'windows',
                platform TEXT DEFAULT 'Win32',
                viewport_width INTEGER DEFAULT 1920,
                viewport_height INTEGER DEFAULT 1080,
                screen_width INTEGER DEFAULT 1920,
                screen_height INTEGER DEFAULT 1080,
                color_depth INTEGER DEFAULT 24,
                pixel_ratio REAL DEFAULT 1.0,
                timezone_mode TEXT DEFAULT 'auto',
                timezone TEXT DEFAULT 'America/New_York',
                locale_mode TEXT DEFAULT 'auto',
                locale TEXT DEFAULT 'en-US',
                language TEXT DEFAULT 'en-US,en',
                country TEXT DEFAULT 'US',
                cpu_cores INTEGER DEFAULT 8,
                device_memory INTEGER DEFAULT 8,
                max_touch_points INTEGER DEFAULT 0,
                webgl_image_mode TEXT DEFAULT 'noise',
                webgl_metadata_mode TEXT DEFAULT 'custom',
                webgl_vendor TEXT,
                webgl_renderer TEXT,
                canvas_noise REAL DEFAULT 0.02,
                audio_noise REAL DEFAULT 0.0001,
                client_rects_noise REAL DEFAULT 0.1,
                webrtc_mode TEXT DEFAULT 'replace',
                webrtc_public_ip TEXT DEFAULT '',
                geo_mode TEXT DEFAULT 'query',
                geo_latitude REAL DEFAULT 0,
                geo_longitude REAL DEFAULT 0,
                geo_accuracy REAL DEFAULT 100,
                media_devices_mode TEXT DEFAULT 'real',
                fake_cameras INTEGER DEFAULT 1,
                fake_microphones INTEGER DEFAULT 1,
                fake_speakers INTEGER DEFAULT 1,
                do_not_track INTEGER DEFAULT 0,
                block_webrtc INTEGER DEFAULT 0,
                block_canvas INTEGER DEFAULT 0,
                block_audio_context INTEGER DEFAULT 0,
                block_images INTEGER DEFAULT 0,
                block_media INTEGER DEFAULT 0,
                fonts TEXT DEFAULT '[]',
                plugins TEXT DEFAULT '[]',
                speech_voices TEXT DEFAULT '[]',
                proxy_id TEXT DEFAULT '',
                group_id TEXT DEFAULT '',
                platform_tags TEXT DEFAULT '[]',
                notes TEXT DEFAULT '',
                bookmarks TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                last_used_at TEXT DEFAULT '',
                last_ip TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Proxies table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS proxies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                proxy_type TEXT DEFAULT 'http',
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT DEFAULT '',
                password TEXT DEFAULT '',
                country TEXT DEFAULT '',
                city TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                last_tested_at TEXT DEFAULT '',
                last_ip TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Workflows table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                blocks TEXT DEFAULT '[]',
                variables TEXT DEFAULT '{}',
                settings TEXT DEFAULT '{}',
                status TEXT DEFAULT 'active',
                last_run_at TEXT DEFAULT '',
                run_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Groups table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#3b82f6',
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Create indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_group ON profiles(group_id)", [])
            .map_err(|e| e.to_string())?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_proxy ON profiles(proxy_id)", [])
            .map_err(|e| e.to_string())?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status)", [])
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    // ============ Profile CRUD ============

    pub fn create_profile(&self, profile: &DbProfile) -> Result<DbProfile, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO profiles (
                id, name, browser_type, browser_version, user_agent, os, platform,
                viewport_width, viewport_height, screen_width, screen_height, color_depth, pixel_ratio,
                timezone_mode, timezone, locale_mode, locale, language, country,
                cpu_cores, device_memory, max_touch_points,
                webgl_image_mode, webgl_metadata_mode, webgl_vendor, webgl_renderer,
                canvas_noise, audio_noise, client_rects_noise,
                webrtc_mode, webrtc_public_ip,
                geo_mode, geo_latitude, geo_longitude, geo_accuracy,
                media_devices_mode, fake_cameras, fake_microphones, fake_speakers,
                do_not_track, block_webrtc, block_canvas, block_audio_context, block_images, block_media,
                fonts, plugins, speech_voices,
                proxy_id, group_id, platform_tags,
                notes, bookmarks, status, last_used_at, last_ip,
                created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
                ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
                ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40,
                ?41, ?42, ?43, ?44, ?45, ?46, ?47, ?48, ?49, ?50,
                ?51, ?52, ?53, ?54, ?55, ?56, ?57
            )",
            params![
                profile.id, profile.name, profile.browser_type, profile.browser_version, profile.user_agent,
                profile.os, profile.platform,
                profile.viewport_width, profile.viewport_height, profile.screen_width, profile.screen_height,
                profile.color_depth, profile.pixel_ratio,
                profile.timezone_mode, profile.timezone, profile.locale_mode, profile.locale, profile.language, profile.country,
                profile.cpu_cores, profile.device_memory, profile.max_touch_points,
                profile.webgl_image_mode, profile.webgl_metadata_mode, profile.webgl_vendor, profile.webgl_renderer,
                profile.canvas_noise, profile.audio_noise, profile.client_rects_noise,
                profile.webrtc_mode, profile.webrtc_public_ip,
                profile.geo_mode, profile.geo_latitude, profile.geo_longitude, profile.geo_accuracy,
                profile.media_devices_mode, profile.fake_cameras, profile.fake_microphones, profile.fake_speakers,
                profile.do_not_track, profile.block_webrtc, profile.block_canvas, profile.block_audio_context,
                profile.block_images, profile.block_media,
                profile.fonts, profile.plugins, profile.speech_voices,
                profile.proxy_id, profile.group_id, profile.platform_tags,
                profile.notes, profile.bookmarks, profile.status, profile.last_used_at, profile.last_ip,
                profile.created_at, profile.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(profile.clone())
    }

    pub fn get_profiles(&self) -> Result<Vec<DbProfile>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT
                id, name, browser_type, browser_version, user_agent, os, platform,
                viewport_width, viewport_height, screen_width, screen_height, color_depth, pixel_ratio,
                timezone_mode, timezone, locale_mode, locale, language, country,
                cpu_cores, device_memory, max_touch_points,
                webgl_image_mode, webgl_metadata_mode, webgl_vendor, webgl_renderer,
                canvas_noise, audio_noise, client_rects_noise,
                webrtc_mode, webrtc_public_ip,
                geo_mode, geo_latitude, geo_longitude, geo_accuracy,
                media_devices_mode, fake_cameras, fake_microphones, fake_speakers,
                do_not_track, block_webrtc, block_canvas, block_audio_context, block_images, block_media,
                fonts, plugins, speech_voices,
                proxy_id, group_id, platform_tags,
                notes, bookmarks, status, last_used_at, last_ip,
                created_at, updated_at
            FROM profiles ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;

        let profiles = stmt.query_map([], |row| {
            Ok(DbProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                browser_type: row.get(2)?,
                browser_version: row.get(3)?,
                user_agent: row.get(4)?,
                os: row.get(5)?,
                platform: row.get(6)?,
                viewport_width: row.get(7)?,
                viewport_height: row.get(8)?,
                screen_width: row.get(9)?,
                screen_height: row.get(10)?,
                color_depth: row.get(11)?,
                pixel_ratio: row.get(12)?,
                timezone_mode: row.get(13)?,
                timezone: row.get(14)?,
                locale_mode: row.get(15)?,
                locale: row.get(16)?,
                language: row.get(17)?,
                country: row.get(18)?,
                cpu_cores: row.get(19)?,
                device_memory: row.get(20)?,
                max_touch_points: row.get(21)?,
                webgl_image_mode: row.get(22)?,
                webgl_metadata_mode: row.get(23)?,
                webgl_vendor: row.get(24)?,
                webgl_renderer: row.get(25)?,
                canvas_noise: row.get(26)?,
                audio_noise: row.get(27)?,
                client_rects_noise: row.get(28)?,
                webrtc_mode: row.get(29)?,
                webrtc_public_ip: row.get(30)?,
                geo_mode: row.get(31)?,
                geo_latitude: row.get(32)?,
                geo_longitude: row.get(33)?,
                geo_accuracy: row.get(34)?,
                media_devices_mode: row.get(35)?,
                fake_cameras: row.get(36)?,
                fake_microphones: row.get(37)?,
                fake_speakers: row.get(38)?,
                do_not_track: row.get(39)?,
                block_webrtc: row.get(40)?,
                block_canvas: row.get(41)?,
                block_audio_context: row.get(42)?,
                block_images: row.get(43)?,
                block_media: row.get(44)?,
                fonts: row.get(45)?,
                plugins: row.get(46)?,
                speech_voices: row.get(47)?,
                proxy_id: row.get(48)?,
                group_id: row.get(49)?,
                platform_tags: row.get(50)?,
                notes: row.get(51)?,
                bookmarks: row.get(52)?,
                status: row.get(53)?,
                last_used_at: row.get(54)?,
                last_ip: row.get(55)?,
                created_at: row.get(56)?,
                updated_at: row.get(57)?,
            })
        }).map_err(|e| e.to_string())?;

        profiles.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    pub fn get_profile(&self, id: &str) -> Result<Option<DbProfile>, String> {
        let profiles = self.get_profiles()?;
        Ok(profiles.into_iter().find(|p| p.id == id))
    }

    pub fn update_profile(&self, profile: &DbProfile) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE profiles SET
                name = ?2, browser_type = ?3, browser_version = ?4, user_agent = ?5,
                os = ?6, platform = ?7,
                viewport_width = ?8, viewport_height = ?9, screen_width = ?10, screen_height = ?11,
                color_depth = ?12, pixel_ratio = ?13,
                timezone_mode = ?14, timezone = ?15, locale_mode = ?16, locale = ?17, language = ?18, country = ?19,
                cpu_cores = ?20, device_memory = ?21, max_touch_points = ?22,
                webgl_image_mode = ?23, webgl_metadata_mode = ?24, webgl_vendor = ?25, webgl_renderer = ?26,
                canvas_noise = ?27, audio_noise = ?28, client_rects_noise = ?29,
                webrtc_mode = ?30, webrtc_public_ip = ?31,
                geo_mode = ?32, geo_latitude = ?33, geo_longitude = ?34, geo_accuracy = ?35,
                media_devices_mode = ?36, fake_cameras = ?37, fake_microphones = ?38, fake_speakers = ?39,
                do_not_track = ?40, block_webrtc = ?41, block_canvas = ?42, block_audio_context = ?43,
                block_images = ?44, block_media = ?45,
                fonts = ?46, plugins = ?47, speech_voices = ?48,
                proxy_id = ?49, group_id = ?50, platform_tags = ?51,
                notes = ?52, bookmarks = ?53, status = ?54, last_used_at = ?55, last_ip = ?56,
                updated_at = ?57
            WHERE id = ?1",
            params![
                profile.id, profile.name, profile.browser_type, profile.browser_version, profile.user_agent,
                profile.os, profile.platform,
                profile.viewport_width, profile.viewport_height, profile.screen_width, profile.screen_height,
                profile.color_depth, profile.pixel_ratio,
                profile.timezone_mode, profile.timezone, profile.locale_mode, profile.locale, profile.language, profile.country,
                profile.cpu_cores, profile.device_memory, profile.max_touch_points,
                profile.webgl_image_mode, profile.webgl_metadata_mode, profile.webgl_vendor, profile.webgl_renderer,
                profile.canvas_noise, profile.audio_noise, profile.client_rects_noise,
                profile.webrtc_mode, profile.webrtc_public_ip,
                profile.geo_mode, profile.geo_latitude, profile.geo_longitude, profile.geo_accuracy,
                profile.media_devices_mode, profile.fake_cameras, profile.fake_microphones, profile.fake_speakers,
                profile.do_not_track, profile.block_webrtc, profile.block_canvas, profile.block_audio_context,
                profile.block_images, profile.block_media,
                profile.fonts, profile.plugins, profile.speech_voices,
                profile.proxy_id, profile.group_id, profile.platform_tags,
                profile.notes, profile.bookmarks, profile.status, profile.last_used_at, profile.last_ip,
                profile.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_profile(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ============ Proxy CRUD ============

    pub fn create_proxy(&self, proxy: &DbProxy) -> Result<DbProxy, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO proxies (
                id, name, proxy_type, host, port, username, password,
                country, city, status, last_tested_at, last_ip, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                proxy.id, proxy.name, proxy.proxy_type, proxy.host, proxy.port,
                proxy.username, proxy.password, proxy.country, proxy.city,
                proxy.status, proxy.last_tested_at, proxy.last_ip,
                proxy.created_at, proxy.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(proxy.clone())
    }

    pub fn get_proxies(&self) -> Result<Vec<DbProxy>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, proxy_type, host, port, username, password,
                    country, city, status, last_tested_at, last_ip, created_at, updated_at
             FROM proxies ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;

        let proxies = stmt.query_map([], |row| {
            Ok(DbProxy {
                id: row.get(0)?,
                name: row.get(1)?,
                proxy_type: row.get(2)?,
                host: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                password: row.get(6)?,
                country: row.get(7)?,
                city: row.get(8)?,
                status: row.get(9)?,
                last_tested_at: row.get(10)?,
                last_ip: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        }).map_err(|e| e.to_string())?;

        proxies.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    pub fn get_proxy(&self, id: &str) -> Result<Option<DbProxy>, String> {
        let proxies = self.get_proxies()?;
        Ok(proxies.into_iter().find(|p| p.id == id))
    }

    pub fn update_proxy(&self, proxy: &DbProxy) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE proxies SET
                name = ?2, proxy_type = ?3, host = ?4, port = ?5,
                username = ?6, password = ?7, country = ?8, city = ?9,
                status = ?10, last_tested_at = ?11, last_ip = ?12, updated_at = ?13
            WHERE id = ?1",
            params![
                proxy.id, proxy.name, proxy.proxy_type, proxy.host, proxy.port,
                proxy.username, proxy.password, proxy.country, proxy.city,
                proxy.status, proxy.last_tested_at, proxy.last_ip, proxy.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_proxy(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM proxies WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ============ Workflow CRUD ============

    pub fn create_workflow(&self, workflow: &DbWorkflow) -> Result<DbWorkflow, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO workflows (
                id, name, description, blocks, variables, settings,
                status, last_run_at, run_count, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                workflow.id, workflow.name, workflow.description,
                workflow.blocks, workflow.variables, workflow.settings,
                workflow.status, workflow.last_run_at, workflow.run_count,
                workflow.created_at, workflow.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(workflow.clone())
    }

    pub fn get_workflows(&self) -> Result<Vec<DbWorkflow>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, description, blocks, variables, settings,
                    status, last_run_at, run_count, created_at, updated_at
             FROM workflows ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;

        let workflows = stmt.query_map([], |row| {
            Ok(DbWorkflow {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                blocks: row.get(3)?,
                variables: row.get(4)?,
                settings: row.get(5)?,
                status: row.get(6)?,
                last_run_at: row.get(7)?,
                run_count: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;

        workflows.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    pub fn get_workflow(&self, id: &str) -> Result<Option<DbWorkflow>, String> {
        let workflows = self.get_workflows()?;
        Ok(workflows.into_iter().find(|w| w.id == id))
    }

    pub fn update_workflow(&self, workflow: &DbWorkflow) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE workflows SET
                name = ?2, description = ?3, blocks = ?4, variables = ?5, settings = ?6,
                status = ?7, last_run_at = ?8, run_count = ?9, updated_at = ?10
            WHERE id = ?1",
            params![
                workflow.id, workflow.name, workflow.description,
                workflow.blocks, workflow.variables, workflow.settings,
                workflow.status, workflow.last_run_at, workflow.run_count, workflow.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_workflow(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM workflows WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ============ Group CRUD ============

    pub fn create_group(&self, group: &DbGroup) -> Result<DbGroup, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO groups (id, name, color, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                group.id, group.name, group.color, group.description,
                group.created_at, group.updated_at
            ],
        ).map_err(|e| e.to_string())?;

        Ok(group.clone())
    }

    pub fn get_groups(&self) -> Result<Vec<DbGroup>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, color, description, created_at, updated_at
             FROM groups ORDER BY name ASC"
        ).map_err(|e| e.to_string())?;

        let groups = stmt.query_map([], |row| {
            Ok(DbGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        }).map_err(|e| e.to_string())?;

        groups.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    pub fn update_group(&self, group: &DbGroup) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE groups SET name = ?2, color = ?3, description = ?4, updated_at = ?5
             WHERE id = ?1",
            params![group.id, group.name, group.color, group.description, group.updated_at],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_group(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        // Also clear group_id from profiles
        conn.execute("UPDATE profiles SET group_id = '' WHERE group_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM groups WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ============ Helpers ============

fn get_database_path() -> Result<PathBuf, String> {
    let project_dirs = directories::ProjectDirs::from("com", "mmo", "express")
        .ok_or("Could not determine data directory")?;

    let data_dir = project_dirs.data_dir();
    Ok(data_dir.join("mmo-express.db"))
}
