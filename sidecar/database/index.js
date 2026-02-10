/**
 * SQLite Database Manager for Sidecar
 * Replaces JSON file storage with SQLite
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./migrate');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'mmo-express.db');

class SidecarDB {
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.db = new Database(DB_FILE);
    this.db.pragma('journal_mode = WAL');

    // Initialize schema
    initDatabase(this.db);

    console.log('[DB] SQLite database initialized:', DB_FILE);
  }

  // ============ WORKFLOWS ============

  getWorkflows() {
    const stmt = this.db.prepare(`
      SELECT * FROM workflows ORDER BY updated_at DESC
    `);
    return stmt.all().map(this.parseWorkflow);
  }

  getWorkflow(id) {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.parseWorkflow(row) : null;
  }

  createWorkflow(workflow) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO workflows (id, name, description, tags, steps, variables, settings, status, last_run_at, run_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      workflow.id,
      workflow.name,
      workflow.description || '',
      JSON.stringify(workflow.tags || []),
      JSON.stringify(workflow.steps || []),
      JSON.stringify(workflow.variables || []),
      JSON.stringify(workflow.settings || {}),
      workflow.status || 'active',
      workflow.lastRunAt || '',
      workflow.runCount || 0,
      workflow.createdAt || now,
      workflow.updatedAt || now
    );
    return this.getWorkflow(workflow.id);
  }

  updateWorkflow(workflow) {
    const stmt = this.db.prepare(`
      UPDATE workflows SET
        name = ?, description = ?, tags = ?, steps = ?, variables = ?, settings = ?,
        status = ?, last_run_at = ?, run_count = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      workflow.name,
      workflow.description || '',
      JSON.stringify(workflow.tags || []),
      JSON.stringify(workflow.steps || []),
      JSON.stringify(workflow.variables || []),
      JSON.stringify(workflow.settings || {}),
      workflow.status || 'active',
      workflow.lastRunAt || '',
      workflow.runCount || 0,
      new Date().toISOString(),
      workflow.id
    );
    return this.getWorkflow(workflow.id);
  }

  deleteWorkflow(id) {
    // Also delete associated schedules
    this.db.prepare('DELETE FROM schedules WHERE workflow_id = ?').run(id);
    this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return true;
  }

  parseWorkflow(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      tags: JSON.parse(row.tags || '[]'),
      steps: JSON.parse(row.steps || '[]'),
      variables: JSON.parse(row.variables || '[]'),
      settings: JSON.parse(row.settings || '{}'),
      status: row.status,
      lastRunAt: row.last_run_at,
      runCount: row.run_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ============ SCHEDULES ============

  getSchedules() {
    const stmt = this.db.prepare(`
      SELECT s.*, w.name as workflow_name, w.steps as workflow_steps, w.variables as workflow_variables
      FROM schedules s
      LEFT JOIN workflows w ON s.workflow_id = w.id
      ORDER BY s.updated_at DESC
    `);
    return stmt.all().map(this.parseSchedule.bind(this));
  }

  getSchedule(id) {
    const stmt = this.db.prepare(`
      SELECT s.*, w.name as workflow_name, w.steps as workflow_steps, w.variables as workflow_variables
      FROM schedules s
      LEFT JOIN workflows w ON s.workflow_id = w.id
      WHERE s.id = ?
    `);
    const row = stmt.get(id);
    return row ? this.parseSchedule(row) : null;
  }

  getEnabledSchedules() {
    const stmt = this.db.prepare(`
      SELECT s.*, w.name as workflow_name, w.steps as workflow_steps, w.variables as workflow_variables
      FROM schedules s
      LEFT JOIN workflows w ON s.workflow_id = w.id
      WHERE s.enabled = 1
      ORDER BY s.next_run ASC
    `);
    return stmt.all().map(this.parseSchedule.bind(this));
  }

  createSchedule(schedule) {
    const now = new Date().toISOString();

    // Ensure workflow exists
    if (schedule.workflow) {
      const existingWf = this.getWorkflow(schedule.workflow.id);
      if (!existingWf) {
        this.createWorkflow(schedule.workflow);
      } else {
        this.updateWorkflow(schedule.workflow);
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO schedules (
        id, name, description, workflow_id, cron, cron_description,
        enabled, run_on_start, max_retries, timeout, profile_ids, parallel_config,
        last_run, last_status, last_error, next_run,
        run_count, success_count, failure_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      schedule.id,
      schedule.name,
      schedule.description || '',
      schedule.workflow?.id || schedule.workflowId,
      schedule.cron,
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
      schedule.createdAt || now,
      schedule.updatedAt || now
    );
    return this.getSchedule(schedule.id);
  }

  updateSchedule(schedule) {
    // Update workflow if provided
    if (schedule.workflow) {
      const existingWf = this.getWorkflow(schedule.workflow.id);
      if (!existingWf) {
        this.createWorkflow(schedule.workflow);
      } else {
        this.updateWorkflow(schedule.workflow);
      }
    }

    const stmt = this.db.prepare(`
      UPDATE schedules SET
        name = ?, description = ?, workflow_id = ?, cron = ?, cron_description = ?,
        enabled = ?, run_on_start = ?, max_retries = ?, timeout = ?,
        profile_ids = ?, parallel_config = ?,
        last_run = ?, last_status = ?, last_error = ?, next_run = ?,
        run_count = ?, success_count = ?, failure_count = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      schedule.name,
      schedule.description || '',
      schedule.workflow?.id || schedule.workflowId,
      schedule.cron,
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
      new Date().toISOString(),
      schedule.id
    );
    return this.getSchedule(schedule.id);
  }

  deleteSchedule(id) {
    this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return true;
  }

  updateScheduleStatus(id, status, error = null) {
    const stmt = this.db.prepare(`
      UPDATE schedules SET
        last_run = ?, last_status = ?, last_error = ?,
        run_count = run_count + 1,
        success_count = success_count + ?,
        failure_count = failure_count + ?,
        updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      new Date().toISOString(),
      status,
      error || '',
      status === 'success' ? 1 : 0,
      status === 'failure' ? 1 : 0,
      new Date().toISOString(),
      id
    );
  }

  updateScheduleNextRun(id, nextRun) {
    this.db.prepare('UPDATE schedules SET next_run = ? WHERE id = ?')
      .run(nextRun, id);
  }

  parseSchedule(row) {
    const schedule = {
      id: row.id,
      name: row.name,
      description: row.description,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      cron: row.cron,
      cronDescription: row.cron_description,
      enabled: row.enabled === 1,
      runOnStart: row.run_on_start === 1,
      maxRetries: row.max_retries,
      timeout: row.timeout,
      profileIds: JSON.parse(row.profile_ids || '[]'),
      parallelConfig: JSON.parse(row.parallel_config || '{}'),
      lastRun: row.last_run,
      lastStatus: row.last_status,
      lastError: row.last_error,
      nextRun: row.next_run,
      runCount: row.run_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    // Include workflow data if available
    if (row.workflow_steps) {
      schedule.workflow = {
        id: row.workflow_id,
        name: row.workflow_name,
        steps: JSON.parse(row.workflow_steps || '[]'),
        variables: JSON.parse(row.workflow_variables || '[]')
      };
    }

    return schedule;
  }

  // ============ EXECUTION HISTORY ============

  createExecution(execution) {
    const stmt = this.db.prepare(`
      INSERT INTO execution_history (
        id, schedule_id, workflow_id, profile_id, profile_name,
        status, error, started_at, finished_at, duration,
        steps_completed, total_steps, logs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      execution.id,
      execution.scheduleId || '',
      execution.workflowId,
      execution.profileId,
      execution.profileName || '',
      execution.status,
      execution.error || '',
      execution.startedAt,
      execution.finishedAt || '',
      execution.duration || 0,
      execution.stepsCompleted || 0,
      execution.totalSteps || 0,
      JSON.stringify(execution.logs || [])
    );
    return execution;
  }

  getExecutions(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_history
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset).map(this.parseExecution);
  }

  getExecutionsBySchedule(scheduleId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_history
      WHERE schedule_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);
    return stmt.all(scheduleId, limit).map(this.parseExecution);
  }

  getExecutionStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM execution_history').get().count;
    const success = this.db.prepare("SELECT COUNT(*) as count FROM execution_history WHERE status = 'success'").get().count;
    const failure = this.db.prepare("SELECT COUNT(*) as count FROM execution_history WHERE status = 'failure'").get().count;
    const avgDuration = this.db.prepare("SELECT AVG(duration) as avg FROM execution_history WHERE status = 'success'").get().avg || 0;

    return {
      total,
      success,
      failure,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgDuration: Math.round(avgDuration)
    };
  }

  deleteOldExecutions(days = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM execution_history
      WHERE datetime(started_at) < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(days);
    return result.changes;
  }

  parseExecution(row) {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      workflowId: row.workflow_id,
      profileId: row.profile_id,
      profileName: row.profile_name,
      status: row.status,
      error: row.error,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      duration: row.duration,
      stepsCompleted: row.steps_completed,
      totalSteps: row.total_steps,
      logs: JSON.parse(row.logs || '[]')
    };
  }

  // ============ UTILITIES ============

  close() {
    this.db.close();
  }
}

// Singleton instance
let instance = null;

function getDB() {
  if (!instance) {
    instance = new SidecarDB();
  }
  return instance;
}

module.exports = { SidecarDB, getDB };
