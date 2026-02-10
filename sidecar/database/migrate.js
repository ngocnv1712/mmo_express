/**
 * Migration script: JSON → SQLite
 * Migrates schedules.json data to SQLite database
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEDULES_JSON = path.join(DATA_DIR, 'schedules.json');
const DB_FILE = path.join(DATA_DIR, 'mmo-express.db');

// Backup original JSON
function backupJSON() {
  if (fs.existsSync(SCHEDULES_JSON)) {
    const backupPath = SCHEDULES_JSON + '.backup.' + Date.now();
    fs.copyFileSync(SCHEDULES_JSON, backupPath);
    console.log('[MIGRATE] Backed up schedules.json to:', backupPath);
    return true;
  }
  return false;
}

// Initialize database schema
function initDatabase(db) {
  // Workflows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      steps TEXT DEFAULT '[]',
      variables TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      last_run_at TEXT DEFAULT '',
      run_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      workflow_id TEXT NOT NULL,
      cron TEXT NOT NULL,
      cron_description TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      run_on_start INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 0,
      timeout INTEGER DEFAULT 300000,
      profile_ids TEXT DEFAULT '[]',
      parallel_config TEXT DEFAULT '{}',
      last_run TEXT DEFAULT '',
      last_status TEXT DEFAULT '',
      last_error TEXT DEFAULT '',
      next_run TEXT DEFAULT '',
      run_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    )
  `);

  // Execution history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_history (
      id TEXT PRIMARY KEY,
      schedule_id TEXT DEFAULT '',
      workflow_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      profile_name TEXT DEFAULT '',
      status TEXT NOT NULL,
      error TEXT DEFAULT '',
      started_at TEXT NOT NULL,
      finished_at TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      steps_completed INTEGER DEFAULT 0,
      total_steps INTEGER DEFAULT 0,
      logs TEXT DEFAULT '[]'
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_schedules_workflow ON schedules(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
    CREATE INDEX IF NOT EXISTS idx_history_schedule ON execution_history(schedule_id);
    CREATE INDEX IF NOT EXISTS idx_history_workflow ON execution_history(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_history_started ON execution_history(started_at);
  `);

  console.log('[MIGRATE] Database schema initialized');
}

// Migrate data
function migrateData(db) {
  // Read JSON
  if (!fs.existsSync(SCHEDULES_JSON)) {
    console.log('[MIGRATE] No schedules.json found, nothing to migrate');
    return { workflows: 0, schedules: 0 };
  }

  const jsonData = JSON.parse(fs.readFileSync(SCHEDULES_JSON, 'utf8'));
  console.log('[MIGRATE] Found', jsonData.length, 'schedules in JSON');

  // Prepare statements
  const insertWorkflow = db.prepare(`
    INSERT OR REPLACE INTO workflows (
      id, name, description, tags, steps, variables, settings,
      status, last_run_at, run_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSchedule = db.prepare(`
    INSERT OR REPLACE INTO schedules (
      id, name, description, workflow_id, cron, cron_description,
      enabled, run_on_start, max_retries, timeout, profile_ids, parallel_config,
      last_run, last_status, last_error, next_run,
      run_count, success_count, failure_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let workflowCount = 0;
  let scheduleCount = 0;
  const workflowIds = new Set();

  // Transaction for atomicity
  const migrate = db.transaction(() => {
    for (const schedule of jsonData) {
      // Extract and insert workflow (avoid duplicates)
      if (schedule.workflow && !workflowIds.has(schedule.workflow.id)) {
        const wf = schedule.workflow;
        insertWorkflow.run(
          wf.id,
          wf.name || 'Untitled Workflow',
          wf.description || '',
          JSON.stringify(wf.tags || []),
          JSON.stringify(wf.steps || []),
          JSON.stringify(wf.variables || []),
          JSON.stringify(wf.settings || {}),
          'active',
          schedule.lastRun || '',
          schedule.runCount || 0,
          wf.createdAt || schedule.createdAt || new Date().toISOString(),
          wf.updatedAt || schedule.updatedAt || new Date().toISOString()
        );
        workflowIds.add(wf.id);
        workflowCount++;
      }

      // Insert schedule
      const workflowId = schedule.workflow?.id || schedule.workflowId;
      insertSchedule.run(
        schedule.id,
        schedule.name || 'Untitled Schedule',
        schedule.description || '',
        workflowId,
        schedule.cron || '0 * * * *',
        schedule.cronDescription || '',
        schedule.enabled ? 1 : 0,
        schedule.runOnStart ? 1 : 0,
        schedule.maxRetries || 0,
        schedule.timeout || 300000,
        JSON.stringify(schedule.profileIds || []),
        JSON.stringify(schedule.parallelConfig || {}),
        schedule.lastRun || '',
        schedule.lastStatus || '',
        schedule.lastError || '',
        schedule.nextRun || '',
        schedule.runCount || 0,
        schedule.successCount || 0,
        schedule.failureCount || 0,
        schedule.createdAt || new Date().toISOString(),
        schedule.updatedAt || new Date().toISOString()
      );
      scheduleCount++;
    }
  });

  migrate();

  return { workflows: workflowCount, schedules: scheduleCount };
}

// Main migration
function runMigration() {
  console.log('========================================');
  console.log('   MMO Express - Database Migration');
  console.log('   JSON → SQLite');
  console.log('========================================\n');

  // Backup
  backupJSON();

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Open database
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');

  try {
    // Initialize schema
    initDatabase(db);

    // Migrate data
    const result = migrateData(db);

    console.log('\n========================================');
    console.log('   Migration Complete!');
    console.log('========================================');
    console.log(`   Workflows migrated: ${result.workflows}`);
    console.log(`   Schedules migrated: ${result.schedules}`);
    console.log(`   Database: ${DB_FILE}`);
    console.log('========================================\n');

    return result;
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, initDatabase };
