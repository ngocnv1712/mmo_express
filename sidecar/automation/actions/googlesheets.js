/**
 * Google Sheets Actions
 * Read/Write to Google Sheets using API
 *
 * Note: Requires Google Sheets API key or OAuth2 credentials
 * For simplicity, this uses API key with public sheets or service account
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Read Google Sheet
 */
const readSheet = {
  name: 'Read Google Sheet',
  description: 'Read data from a Google Sheet',
  icon: '📊',
  category: 'googlesheets',
  configSchema: {
    spreadsheetId: {
      type: 'string',
      required: true,
      label: 'Spreadsheet ID',
      description: 'The ID from the sheet URL',
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    },
    range: {
      type: 'string',
      required: true,
      label: 'Range',
      description: 'Sheet and range (e.g., Sheet1!A1:D10)',
      placeholder: 'Sheet1!A1:D100',
    },
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
      description: 'Google Sheets API key',
    },
    hasHeader: {
      type: 'boolean',
      label: 'First Row is Header',
      default: true,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      description: 'Variable to store the data',
      placeholder: 'sheetData',
    },
  },

  async execute(context, config) {
    const { spreadsheetId, range, apiKey, hasHeader = true, outputVariable } = config;

    try {
      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      const values = data.values || [];
      let result;

      if (hasHeader && values.length > 0) {
        const headers = values[0];
        result = values.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            obj[header] = row[i] || '';
          });
          return obj;
        });
      } else {
        result = values;
      }

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, result);
      }

      return {
        success: true,
        range: data.range,
        rowCount: result.length,
        data: result,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Write to Google Sheet
 */
const writeSheet = {
  name: 'Write Google Sheet',
  description: 'Write data to a Google Sheet',
  icon: '📝',
  category: 'googlesheets',
  configSchema: {
    spreadsheetId: {
      type: 'string',
      required: true,
      label: 'Spreadsheet ID',
    },
    range: {
      type: 'string',
      required: true,
      label: 'Range',
      description: 'Starting cell (e.g., Sheet1!A1)',
      placeholder: 'Sheet1!A1',
    },
    data: {
      type: 'json',
      required: true,
      label: 'Data',
      description: 'Array of objects or 2D array',
      multiline: true,
      placeholder: '[{"name": "John", "email": "john@example.com"}]',
    },
    accessToken: {
      type: 'string',
      required: true,
      label: 'Access Token',
      description: 'OAuth2 access token (API key cannot write)',
    },
    valueInputOption: {
      type: 'select',
      label: 'Input Option',
      default: 'USER_ENTERED',
      options: [
        { value: 'RAW', label: 'Raw (no parsing)' },
        { value: 'USER_ENTERED', label: 'User Entered (parse formulas)' },
      ],
    },
    includeHeader: {
      type: 'boolean',
      label: 'Include Header Row',
      default: true,
    },
  },

  async execute(context, config) {
    const {
      spreadsheetId,
      range,
      data,
      accessToken,
      valueInputOption = 'USER_ENTERED',
      includeHeader = true,
    } = config;

    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

      let values;
      if (Array.isArray(parsedData) && parsedData.length > 0 && typeof parsedData[0] === 'object' && !Array.isArray(parsedData[0])) {
        // Array of objects - convert to 2D array
        const headers = Object.keys(parsedData[0]);
        values = [];

        if (includeHeader) {
          values.push(headers);
        }

        for (const row of parsedData) {
          values.push(headers.map(h => row[h] ?? ''));
        }
      } else {
        values = parsedData;
      }

      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        updatedRange: result.updatedRange,
        updatedRows: result.updatedRows,
        updatedColumns: result.updatedColumns,
        updatedCells: result.updatedCells,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Append to Google Sheet
 */
const appendSheet = {
  name: 'Append to Google Sheet',
  description: 'Append rows to a Google Sheet',
  icon: '➕',
  category: 'googlesheets',
  configSchema: {
    spreadsheetId: {
      type: 'string',
      required: true,
      label: 'Spreadsheet ID',
    },
    range: {
      type: 'string',
      required: true,
      label: 'Range',
      description: 'Sheet name or range (e.g., Sheet1)',
      placeholder: 'Sheet1',
    },
    data: {
      type: 'json',
      required: true,
      label: 'Data',
      description: 'Row(s) to append',
      placeholder: '{"name": "John", "email": "john@example.com"}',
    },
    accessToken: {
      type: 'string',
      required: true,
      label: 'Access Token',
    },
    valueInputOption: {
      type: 'select',
      label: 'Input Option',
      default: 'USER_ENTERED',
      options: [
        { value: 'RAW', label: 'Raw' },
        { value: 'USER_ENTERED', label: 'User Entered' },
      ],
    },
  },

  async execute(context, config) {
    const { spreadsheetId, range, data, accessToken, valueInputOption = 'USER_ENTERED' } = config;

    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

      let values;
      if (Array.isArray(parsedData)) {
        if (parsedData.length > 0 && typeof parsedData[0] === 'object' && !Array.isArray(parsedData[0])) {
          const headers = Object.keys(parsedData[0]);
          values = parsedData.map(row => headers.map(h => row[h] ?? ''));
        } else {
          values = parsedData;
        }
      } else if (typeof parsedData === 'object') {
        const headers = Object.keys(parsedData);
        values = [headers.map(h => parsedData[h] ?? '')];
      } else {
        values = [[parsedData]];
      }

      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        updatedRange: result.updates?.updatedRange,
        updatedRows: result.updates?.updatedRows,
        updatedCells: result.updates?.updatedCells,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Clear Google Sheet Range
 */
const clearSheet = {
  name: 'Clear Google Sheet',
  description: 'Clear a range in a Google Sheet',
  icon: '🗑️',
  category: 'googlesheets',
  configSchema: {
    spreadsheetId: {
      type: 'string',
      required: true,
      label: 'Spreadsheet ID',
    },
    range: {
      type: 'string',
      required: true,
      label: 'Range',
      description: 'Range to clear (e.g., Sheet1!A2:D100)',
    },
    accessToken: {
      type: 'string',
      required: true,
      label: 'Access Token',
    },
  },

  async execute(context, config) {
    const { spreadsheetId, range, accessToken } = config;

    try {
      const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        clearedRange: result.clearedRange,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Get Sheet Info
 */
const getSheetInfo = {
  name: 'Get Sheet Info',
  description: 'Get metadata about a Google Sheet',
  icon: 'ℹ️',
  category: 'googlesheets',
  configSchema: {
    spreadsheetId: {
      type: 'string',
      required: true,
      label: 'Spreadsheet ID',
    },
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
    },
  },

  async execute(context, config) {
    const { spreadsheetId, apiKey, outputVariable } = config;

    try {
      const url = `${SHEETS_API_BASE}/${spreadsheetId}?key=${apiKey}&fields=properties,sheets.properties`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      const result = {
        title: data.properties?.title,
        locale: data.properties?.locale,
        timeZone: data.properties?.timeZone,
        sheets: data.sheets?.map(s => ({
          id: s.properties?.sheetId,
          title: s.properties?.title,
          index: s.properties?.index,
          rowCount: s.properties?.gridProperties?.rowCount,
          columnCount: s.properties?.gridProperties?.columnCount,
        })) || [],
      };

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, result);
      }

      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

module.exports = {
  'gsheet-read': readSheet,
  'gsheet-write': writeSheet,
  'gsheet-append': appendSheet,
  'gsheet-clear': clearSheet,
  'gsheet-info': getSheetInfo,
};
