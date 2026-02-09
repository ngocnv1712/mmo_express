/**
 * Cron Parser
 * Parse cron expressions and calculate next run times
 * Format: minute hour dayOfMonth month dayOfWeek
 */

/**
 * Parse a cron field (handles *, ranges, steps, lists)
 */
function parseField(field, min, max) {
  const values = new Set();
  const parts = field.split(',');

  for (const part of parts) {
    const [range, step] = part.split('/');
    const stepNum = step ? parseInt(step, 10) : 1;

    if (range === '*') {
      for (let i = min; i <= max; i += stepNum) {
        values.add(i);
      }
    } else if (range.includes('-')) {
      const [start, end] = range.split('-').map(n => parseInt(n, 10));
      for (let i = start; i <= end; i += stepNum) {
        values.add(i);
      }
    } else {
      values.add(parseInt(range, 10));
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * Parse a cron expression into its components
 */
function parseCron(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error('Invalid cron expression: Expected 5 fields');
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return {
    minutes: parseField(minute, 0, 59),
    hours: parseField(hour, 0, 23),
    daysOfMonth: parseField(dayOfMonth, 1, 31),
    months: parseField(month, 1, 12),
    daysOfWeek: parseField(dayOfWeek, 0, 6),
  };
}

/**
 * Check if a date matches a cron expression
 */
function matchesCron(date, cronParts) {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return (
    cronParts.minutes.includes(minute) &&
    cronParts.hours.includes(hour) &&
    cronParts.daysOfMonth.includes(dayOfMonth) &&
    cronParts.months.includes(month) &&
    cronParts.daysOfWeek.includes(dayOfWeek)
  );
}

/**
 * Get the next run time after a given date
 */
function getNextRun(cronExpression, afterDate = new Date()) {
  const cronParts = parseCron(cronExpression);

  const next = new Date(afterDate);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  const maxIterations = 2 * 365 * 24 * 60;
  let iterations = 0;

  while (iterations < maxIterations) {
    if (matchesCron(next, cronParts)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
    iterations++;
  }

  return null;
}

/**
 * Get human-readable description of cron expression
 */
function describeCron(expression) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (expression === '* * * * *') return 'Every minute';
  if (expression === '0 * * * *') return 'Every hour';
  if (expression === '0 0 * * *') return 'Every day at midnight';

  if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every ' + minute.slice(2) + ' minutes';
  }

  if (minute === '0' && hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every ' + hour.slice(2) + ' hours';
  }

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const time = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
    return 'Daily at ' + time;
  }

  return expression;
}

/**
 * Validate a cron expression
 */
function validateCron(expression) {
  try {
    parseCron(expression);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Common cron presets
 */
const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Daily at 12 PM', value: '0 12 * * *' },
  { label: 'Daily at 6 PM', value: '0 18 * * *' },
  { label: 'Weekly (Sunday)', value: '0 0 * * 0' },
  { label: 'Weekly (Monday)', value: '0 9 * * 1' },
  { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
  { label: 'First of month', value: '0 0 1 * *' },
];

module.exports = {
  parseCron,
  matchesCron,
  getNextRun,
  describeCron,
  validateCron,
  CRON_PRESETS,
};
