/**
 * HTTP Request Actions
 * Make HTTP requests (GET, POST, PUT, DELETE)
 */

/**
 * HTTP Request action
 */
const httpRequest = {
  name: 'HTTP Request',
  description: 'Make an HTTP request to an API endpoint',
  icon: '🌐',
  category: 'http',
  configSchema: {
    url: {
      type: 'string',
      required: true,
      label: 'URL',
      description: 'The URL to request',
      placeholder: 'https://api.example.com/data',
    },
    method: {
      type: 'select',
      label: 'Method',
      default: 'GET',
      options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'DELETE', label: 'DELETE' },
      ],
    },
    headers: {
      type: 'json',
      label: 'Headers',
      description: 'Request headers as JSON object',
      placeholder: '{"Authorization": "Bearer token"}',
    },
    body: {
      type: 'string',
      label: 'Request Body',
      description: 'Request body (for POST, PUT, PATCH)',
      multiline: true,
    },
    bodyType: {
      type: 'select',
      label: 'Body Type',
      default: 'json',
      options: [
        { value: 'json', label: 'JSON' },
        { value: 'form', label: 'Form Data' },
        { value: 'text', label: 'Plain Text' },
      ],
    },
    timeout: {
      type: 'number',
      label: 'Timeout (ms)',
      default: 30000,
      min: 1000,
      max: 120000,
    },
    followRedirects: {
      type: 'boolean',
      label: 'Follow Redirects',
      default: true,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      description: 'Variable to store response',
      placeholder: 'response',
    },
    outputStatusVariable: {
      type: 'string',
      label: 'Status Variable',
      description: 'Variable to store status code',
      placeholder: 'statusCode',
    },
  },

  async execute(context, config) {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      bodyType = 'json',
      timeout = 30000,
      followRedirects = true,
      outputVariable,
      outputStatusVariable,
    } = config;

    try {
      const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;

      const fetchOptions = {
        method,
        headers: { ...parsedHeaders },
        redirect: followRedirects ? 'follow' : 'manual',
        signal: AbortSignal.timeout(timeout),
      };

      // Add body for non-GET requests
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        switch (bodyType) {
          case 'json':
            fetchOptions.headers['Content-Type'] = fetchOptions.headers['Content-Type'] || 'application/json';
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            break;
          case 'form':
            fetchOptions.headers['Content-Type'] = fetchOptions.headers['Content-Type'] || 'application/x-www-form-urlencoded';
            if (typeof body === 'object') {
              fetchOptions.body = new URLSearchParams(body).toString();
            } else {
              fetchOptions.body = body;
            }
            break;
          default:
            fetchOptions.body = String(body);
        }
      }

      const startTime = Date.now();
      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      // Get response body
      const contentType = response.headers.get('content-type') || '';
      let responseData;

      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Store in variables
      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, responseData);
      }

      if (outputStatusVariable && context.variables?.store) {
        context.variables.store.set(outputStatusVariable, response.status);
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        duration,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * GET Request (simplified)
 */
const httpGet = {
  name: 'HTTP GET',
  description: 'Make a GET request',
  icon: '📥',
  category: 'http',
  configSchema: {
    url: {
      type: 'string',
      required: true,
      label: 'URL',
      placeholder: 'https://api.example.com/data',
    },
    headers: {
      type: 'json',
      label: 'Headers',
      placeholder: '{}',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      placeholder: 'response',
    },
  },

  async execute(context, config) {
    return httpRequest.execute(context, { ...config, method: 'GET' });
  },
};

/**
 * POST Request (simplified)
 */
const httpPost = {
  name: 'HTTP POST',
  description: 'Make a POST request',
  icon: '📤',
  category: 'http',
  configSchema: {
    url: {
      type: 'string',
      required: true,
      label: 'URL',
      placeholder: 'https://api.example.com/data',
    },
    body: {
      type: 'json',
      required: true,
      label: 'Body',
      description: 'Request body as JSON',
      placeholder: '{"key": "value"}',
    },
    headers: {
      type: 'json',
      label: 'Headers',
      placeholder: '{}',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      placeholder: 'response',
    },
  },

  async execute(context, config) {
    return httpRequest.execute(context, { ...config, method: 'POST', bodyType: 'json' });
  },
};

/**
 * Download File
 */
const httpDownload = {
  name: 'Download File',
  description: 'Download a file from URL',
  icon: '⬇️',
  category: 'http',
  configSchema: {
    url: {
      type: 'string',
      required: true,
      label: 'URL',
      description: 'URL of the file to download',
    },
    savePath: {
      type: 'string',
      required: true,
      label: 'Save Path',
      description: 'Path to save the downloaded file',
      placeholder: '/path/to/file.pdf',
    },
    headers: {
      type: 'json',
      label: 'Headers',
      placeholder: '{}',
    },
    timeout: {
      type: 'number',
      label: 'Timeout (ms)',
      default: 60000,
    },
  },

  async execute(context, config) {
    const { url, savePath, headers = {}, timeout = 60000 } = config;
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;

      const response = await fetch(url, {
        headers: parsedHeaders,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const buffer = await response.arrayBuffer();
      const resolvedPath = path.resolve(savePath);

      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, Buffer.from(buffer));

      return {
        success: true,
        filePath: resolvedPath,
        size: buffer.byteLength,
        contentType: response.headers.get('content-type'),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Parse JSON Response
 */
const parseJson = {
  name: 'Parse JSON',
  description: 'Parse a JSON string into an object',
  icon: '🔍',
  category: 'http',
  configSchema: {
    input: {
      type: 'string',
      required: true,
      label: 'JSON String',
      description: 'JSON string or variable to parse',
      multiline: true,
    },
    path: {
      type: 'string',
      label: 'JSON Path',
      description: 'Optional path to extract (e.g., "data.items[0].name")',
      placeholder: 'data.items',
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      required: true,
    },
  },

  async execute(context, config) {
    const { input, path: jsonPath, outputVariable } = config;

    try {
      let data = typeof input === 'string' ? JSON.parse(input) : input;

      // Extract nested path if specified
      if (jsonPath) {
        const parts = jsonPath.replace(/\[(\d+)\]/g, '.$1').split('.');
        for (const part of parts) {
          if (data && typeof data === 'object') {
            data = data[part];
          } else {
            data = undefined;
            break;
          }
        }
      }

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, data);
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

module.exports = {
  'http-request': httpRequest,
  'http-get': httpGet,
  'http-post': httpPost,
  'http-download': httpDownload,
  'json-parse': parseJson,
};
