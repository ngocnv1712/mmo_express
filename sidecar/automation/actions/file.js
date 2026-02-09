/**
 * File Operations Actions
 * Read/Write files in various formats (text, JSON, CSV, Excel)
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Parse CSV string to array of objects
 */
function parseCSV(content, options = {}) {
  const { delimiter = ',', hasHeader = true } = options;
  const lines = content.trim().split('\n');

  if (lines.length === 0) return [];

  const parseRow = (row) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rows = lines.map(parseRow);

  if (hasHeader && rows.length > 0) {
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
  }

  return rows;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV(data, options = {}) {
  const { delimiter = ',', includeHeader = true } = options;

  if (!Array.isArray(data) || data.length === 0) return '';

  const escapeCell = (cell) => {
    const str = String(cell ?? '');
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = Object.keys(data[0]);
  const lines = [];

  if (includeHeader) {
    lines.push(headers.map(escapeCell).join(delimiter));
  }

  for (const row of data) {
    lines.push(headers.map(h => escapeCell(row[h])).join(delimiter));
  }

  return lines.join('\n');
}

/**
 * Read File action
 */
const readFile = {
  name: 'Read File',
  description: 'Read contents from a file',
  icon: '📖',
  category: 'file',
  configSchema: {
    filePath: {
      type: 'string',
      required: true,
      label: 'File Path',
      description: 'Path to the file to read',
      placeholder: '/path/to/file.txt',
    },
    format: {
      type: 'select',
      label: 'Format',
      description: 'File format',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'text', label: 'Plain Text' },
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
      ],
    },
    encoding: {
      type: 'string',
      label: 'Encoding',
      default: 'utf-8',
      description: 'File encoding',
    },
    csvDelimiter: {
      type: 'string',
      label: 'CSV Delimiter',
      default: ',',
      description: 'Delimiter for CSV files',
    },
    csvHasHeader: {
      type: 'boolean',
      label: 'CSV Has Header',
      default: true,
      description: 'First row is header',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      description: 'Variable to store file content',
      placeholder: 'fileContent',
    },
  },

  async execute(context, config) {
    const { filePath, format = 'auto', encoding = 'utf-8', csvDelimiter = ',', csvHasHeader = true, outputVariable } = config;

    try {
      const resolvedPath = path.resolve(filePath);
      const content = await fs.readFile(resolvedPath, encoding);

      let result;
      let detectedFormat = format;

      if (format === 'auto') {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') detectedFormat = 'json';
        else if (ext === '.csv') detectedFormat = 'csv';
        else detectedFormat = 'text';
      }

      switch (detectedFormat) {
        case 'json':
          result = JSON.parse(content);
          break;
        case 'csv':
          result = parseCSV(content, { delimiter: csvDelimiter, hasHeader: csvHasHeader });
          break;
        default:
          result = content;
      }

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, result);
      }

      return {
        success: true,
        filePath: resolvedPath,
        format: detectedFormat,
        data: result,
        size: content.length,
        rowCount: Array.isArray(result) ? result.length : undefined,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Write File action
 */
const writeFile = {
  name: 'Write File',
  description: 'Write content to a file',
  icon: '📝',
  category: 'file',
  configSchema: {
    filePath: {
      type: 'string',
      required: true,
      label: 'File Path',
      description: 'Path to the file to write',
      placeholder: '/path/to/file.txt',
    },
    content: {
      type: 'string',
      required: true,
      label: 'Content',
      description: 'Content to write (or variable name)',
      multiline: true,
    },
    format: {
      type: 'select',
      label: 'Format',
      description: 'Output format',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'text', label: 'Plain Text' },
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
      ],
    },
    mode: {
      type: 'select',
      label: 'Write Mode',
      default: 'overwrite',
      options: [
        { value: 'overwrite', label: 'Overwrite' },
        { value: 'append', label: 'Append' },
      ],
    },
    encoding: {
      type: 'string',
      label: 'Encoding',
      default: 'utf-8',
    },
    csvDelimiter: {
      type: 'string',
      label: 'CSV Delimiter',
      default: ',',
    },
    createDirectory: {
      type: 'boolean',
      label: 'Create Directory',
      default: true,
      description: 'Create parent directories if they don\'t exist',
    },
  },

  async execute(context, config) {
    const {
      filePath,
      content,
      format = 'auto',
      mode = 'overwrite',
      encoding = 'utf-8',
      csvDelimiter = ',',
      createDirectory = true,
    } = config;

    try {
      const resolvedPath = path.resolve(filePath);

      // Create directory if needed
      if (createDirectory) {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      }

      let detectedFormat = format;
      if (format === 'auto') {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') detectedFormat = 'json';
        else if (ext === '.csv') detectedFormat = 'csv';
        else detectedFormat = 'text';
      }

      let output;
      switch (detectedFormat) {
        case 'json':
          output = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          break;
        case 'csv':
          output = Array.isArray(content) ? toCSV(content, { delimiter: csvDelimiter }) : String(content);
          break;
        default:
          output = String(content);
      }

      if (mode === 'append') {
        await fs.appendFile(resolvedPath, output + '\n', encoding);
      } else {
        await fs.writeFile(resolvedPath, output, encoding);
      }

      return {
        success: true,
        filePath: resolvedPath,
        format: detectedFormat,
        mode,
        bytesWritten: Buffer.byteLength(output, encoding),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Append to CSV action
 */
const appendToCSV = {
  name: 'Append to CSV',
  description: 'Append a row to a CSV file',
  icon: '📊',
  category: 'file',
  configSchema: {
    filePath: {
      type: 'string',
      required: true,
      label: 'File Path',
      description: 'Path to the CSV file',
    },
    row: {
      type: 'json',
      required: true,
      label: 'Row Data',
      description: 'Object with column values',
      placeholder: '{"name": "John", "email": "john@example.com"}',
    },
    delimiter: {
      type: 'string',
      label: 'Delimiter',
      default: ',',
    },
    createIfNotExists: {
      type: 'boolean',
      label: 'Create If Not Exists',
      default: true,
    },
  },

  async execute(context, config) {
    const { filePath, row, delimiter = ',', createIfNotExists = true } = config;

    try {
      const resolvedPath = path.resolve(filePath);
      let fileExists = true;

      try {
        await fs.access(resolvedPath);
      } catch {
        fileExists = false;
      }

      const rowData = typeof row === 'string' ? JSON.parse(row) : row;
      const headers = Object.keys(rowData);

      const escapeCell = (cell) => {
        const str = String(cell ?? '');
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      let content = '';

      if (!fileExists && createIfNotExists) {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        content = headers.map(escapeCell).join(delimiter) + '\n';
      }

      content += headers.map(h => escapeCell(rowData[h])).join(delimiter) + '\n';

      await fs.appendFile(resolvedPath, content, 'utf-8');

      return {
        success: true,
        filePath: resolvedPath,
        rowAdded: rowData,
        fileCreated: !fileExists,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * File Exists action
 */
const fileExists = {
  name: 'File Exists',
  description: 'Check if a file exists',
  icon: '❓',
  category: 'file',
  configSchema: {
    filePath: {
      type: 'string',
      required: true,
      label: 'File Path',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      description: 'Variable to store result (true/false)',
    },
  },

  async execute(context, config) {
    const { filePath, outputVariable } = config;

    try {
      const resolvedPath = path.resolve(filePath);
      let exists = true;

      try {
        await fs.access(resolvedPath);
      } catch {
        exists = false;
      }

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, exists);
      }

      return { success: true, exists, filePath: resolvedPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Delete File action
 */
const deleteFile = {
  name: 'Delete File',
  description: 'Delete a file',
  icon: '🗑️',
  category: 'file',
  configSchema: {
    filePath: {
      type: 'string',
      required: true,
      label: 'File Path',
    },
    ignoreNotFound: {
      type: 'boolean',
      label: 'Ignore If Not Found',
      default: true,
    },
  },

  async execute(context, config) {
    const { filePath, ignoreNotFound = true } = config;

    try {
      const resolvedPath = path.resolve(filePath);

      try {
        await fs.unlink(resolvedPath);
        return { success: true, deleted: true, filePath: resolvedPath };
      } catch (error) {
        if (error.code === 'ENOENT' && ignoreNotFound) {
          return { success: true, deleted: false, filePath: resolvedPath, message: 'File not found' };
        }
        throw error;
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * List Files action
 */
const listFiles = {
  name: 'List Files',
  description: 'List files in a directory',
  icon: '📁',
  category: 'file',
  configSchema: {
    directory: {
      type: 'string',
      required: true,
      label: 'Directory Path',
    },
    pattern: {
      type: 'string',
      label: 'Filter Pattern',
      description: 'File extension filter (e.g., .csv, .json)',
      placeholder: '.csv',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      description: 'Variable to store file list',
    },
  },

  async execute(context, config) {
    const { directory, pattern, outputVariable } = config;

    try {
      const resolvedPath = path.resolve(directory);
      let files = await fs.readdir(resolvedPath);

      if (pattern) {
        files = files.filter(f => f.endsWith(pattern));
      }

      const fullPaths = files.map(f => path.join(resolvedPath, f));

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, fullPaths);
      }

      return {
        success: true,
        directory: resolvedPath,
        files: fullPaths,
        count: files.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

module.exports = {
  'file-read': readFile,
  'file-write': writeFile,
  'file-append-csv': appendToCSV,
  'file-exists': fileExists,
  'file-delete': deleteFile,
  'file-list': listFiles,
};
