/**
 * AI Integration Actions
 * Support for OpenAI, Claude, Gemini, DeepSeek
 */

const AI_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
};

/**
 * OpenAI Chat Completion
 */
const openaiChat = {
  name: 'OpenAI Chat',
  description: 'Send a message to OpenAI GPT models',
  icon: '🤖',
  category: 'ai',
  configSchema: {
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
      description: 'OpenAI API key',
    },
    model: {
      type: 'select',
      label: 'Model',
      default: 'gpt-4o-mini',
      options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ],
    },
    prompt: {
      type: 'string',
      required: true,
      label: 'Prompt',
      description: 'Message to send',
      multiline: true,
    },
    systemPrompt: {
      type: 'string',
      label: 'System Prompt',
      description: 'System message (optional)',
      multiline: true,
    },
    maxTokens: {
      type: 'number',
      label: 'Max Tokens',
      default: 1000,
      min: 1,
      max: 128000,
    },
    temperature: {
      type: 'number',
      label: 'Temperature',
      default: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
      placeholder: 'aiResponse',
    },
  },

  async execute(context, config) {
    const {
      apiKey,
      model = 'gpt-4o-mini',
      prompt,
      systemPrompt,
      maxTokens = 1000,
      temperature = 0.7,
      outputVariable,
    } = config;

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(AI_ENDPOINTS.openai, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      const content = data.choices?.[0]?.message?.content || '';

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, content);
      }

      return {
        success: true,
        content,
        model: data.model,
        usage: data.usage,
        finishReason: data.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Claude Chat
 */
const claudeChat = {
  name: 'Claude Chat',
  description: 'Send a message to Anthropic Claude',
  icon: '🧠',
  category: 'ai',
  configSchema: {
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
      description: 'Anthropic API key',
    },
    model: {
      type: 'select',
      label: 'Model',
      default: 'claude-3-5-sonnet-20241022',
      options: [
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      ],
    },
    prompt: {
      type: 'string',
      required: true,
      label: 'Prompt',
      multiline: true,
    },
    systemPrompt: {
      type: 'string',
      label: 'System Prompt',
      multiline: true,
    },
    maxTokens: {
      type: 'number',
      label: 'Max Tokens',
      default: 1000,
      min: 1,
      max: 8192,
    },
    temperature: {
      type: 'number',
      label: 'Temperature',
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.1,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
    },
  },

  async execute(context, config) {
    const {
      apiKey,
      model = 'claude-3-5-sonnet-20241022',
      prompt,
      systemPrompt,
      maxTokens = 1000,
      temperature = 0.7,
      outputVariable,
    } = config;

    try {
      const body = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      const response = await fetch(AI_ENDPOINTS.claude, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      const content = data.content?.[0]?.text || '';

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, content);
      }

      return {
        success: true,
        content,
        model: data.model,
        usage: data.usage,
        stopReason: data.stop_reason,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Google Gemini
 */
const geminiChat = {
  name: 'Gemini Chat',
  description: 'Send a message to Google Gemini',
  icon: '✨',
  category: 'ai',
  configSchema: {
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
      description: 'Google AI API key',
    },
    model: {
      type: 'select',
      label: 'Model',
      default: 'gemini-1.5-flash',
      options: [
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
      ],
    },
    prompt: {
      type: 'string',
      required: true,
      label: 'Prompt',
      multiline: true,
    },
    systemPrompt: {
      type: 'string',
      label: 'System Prompt',
      multiline: true,
    },
    maxTokens: {
      type: 'number',
      label: 'Max Tokens',
      default: 1000,
    },
    temperature: {
      type: 'number',
      label: 'Temperature',
      default: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
    },
  },

  async execute(context, config) {
    const {
      apiKey,
      model = 'gemini-1.5-flash',
      prompt,
      systemPrompt,
      maxTokens = 1000,
      temperature = 0.7,
      outputVariable,
    } = config;

    try {
      const url = `${AI_ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`;

      const contents = [{ role: 'user', parts: [{ text: prompt }] }];

      const body = {
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      };

      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, content);
      }

      return {
        success: true,
        content,
        model,
        finishReason: data.candidates?.[0]?.finishReason,
        usage: data.usageMetadata,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * DeepSeek Chat
 */
const deepseekChat = {
  name: 'DeepSeek Chat',
  description: 'Send a message to DeepSeek',
  icon: '🔮',
  category: 'ai',
  configSchema: {
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
      description: 'DeepSeek API key',
    },
    model: {
      type: 'select',
      label: 'Model',
      default: 'deepseek-chat',
      options: [
        { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        { value: 'deepseek-coder', label: 'DeepSeek Coder' },
        { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
      ],
    },
    prompt: {
      type: 'string',
      required: true,
      label: 'Prompt',
      multiline: true,
    },
    systemPrompt: {
      type: 'string',
      label: 'System Prompt',
      multiline: true,
    },
    maxTokens: {
      type: 'number',
      label: 'Max Tokens',
      default: 1000,
    },
    temperature: {
      type: 'number',
      label: 'Temperature',
      default: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
    },
  },

  async execute(context, config) {
    const {
      apiKey,
      model = 'deepseek-chat',
      prompt,
      systemPrompt,
      maxTokens = 1000,
      temperature = 0.7,
      outputVariable,
    } = config;

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(AI_ENDPOINTS.deepseek, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      const content = data.choices?.[0]?.message?.content || '';

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, content);
      }

      return {
        success: true,
        content,
        model: data.model,
        usage: data.usage,
        finishReason: data.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Generic AI Chat (supports multiple providers)
 */
const aiChat = {
  name: 'AI Chat',
  description: 'Send a message to any supported AI provider',
  icon: '💬',
  category: 'ai',
  configSchema: {
    provider: {
      type: 'select',
      required: true,
      label: 'Provider',
      options: [
        { value: 'openai', label: 'OpenAI' },
        { value: 'claude', label: 'Claude' },
        { value: 'gemini', label: 'Gemini' },
        { value: 'deepseek', label: 'DeepSeek' },
      ],
    },
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
    },
    model: {
      type: 'string',
      label: 'Model',
      description: 'Model name (optional, uses default)',
    },
    prompt: {
      type: 'string',
      required: true,
      label: 'Prompt',
      multiline: true,
    },
    systemPrompt: {
      type: 'string',
      label: 'System Prompt',
      multiline: true,
    },
    maxTokens: {
      type: 'number',
      label: 'Max Tokens',
      default: 1000,
    },
    temperature: {
      type: 'number',
      label: 'Temperature',
      default: 0.7,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
    },
  },

  async execute(context, config) {
    const { provider } = config;

    switch (provider) {
      case 'openai':
        return openaiChat.execute(context, config);
      case 'claude':
        return claudeChat.execute(context, config);
      case 'gemini':
        return geminiChat.execute(context, config);
      case 'deepseek':
        return deepseekChat.execute(context, config);
      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  },
};

/**
 * Extract with AI
 */
const aiExtract = {
  name: 'AI Extract',
  description: 'Extract structured data from text using AI',
  icon: '🔍',
  category: 'ai',
  configSchema: {
    provider: {
      type: 'select',
      required: true,
      label: 'Provider',
      options: [
        { value: 'openai', label: 'OpenAI' },
        { value: 'claude', label: 'Claude' },
        { value: 'gemini', label: 'Gemini' },
        { value: 'deepseek', label: 'DeepSeek' },
      ],
    },
    apiKey: {
      type: 'string',
      required: true,
      label: 'API Key',
    },
    text: {
      type: 'string',
      required: true,
      label: 'Text to Extract From',
      multiline: true,
    },
    schema: {
      type: 'json',
      required: true,
      label: 'Output Schema',
      description: 'JSON schema for the expected output',
      placeholder: '{"name": "string", "email": "string", "phone": "string"}',
    },
    instructions: {
      type: 'string',
      label: 'Additional Instructions',
      multiline: true,
    },
    outputVariable: {
      type: 'string',
      label: 'Output Variable',
    },
  },

  async execute(context, config) {
    const { provider, apiKey, text, schema, instructions, outputVariable } = config;

    const schemaStr = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);

    const prompt = `Extract the following information from the text below and return it as a valid JSON object matching this schema:

Schema:
${schemaStr}

${instructions ? `Additional instructions: ${instructions}\n` : ''}
Text to extract from:
"""
${text}
"""

Return ONLY the JSON object, no explanations or markdown.`;

    const result = await aiChat.execute(context, {
      provider,
      apiKey,
      prompt,
      systemPrompt: 'You are a data extraction assistant. Extract structured data from text and return valid JSON only.',
      temperature: 0.3,
    });

    if (!result.success) {
      return result;
    }

    try {
      // Try to parse the response as JSON
      let content = result.content.trim();

      // Remove markdown code blocks if present
      if (content.startsWith('```json')) {
        content = content.slice(7);
      } else if (content.startsWith('```')) {
        content = content.slice(3);
      }
      if (content.endsWith('```')) {
        content = content.slice(0, -3);
      }

      const extracted = JSON.parse(content.trim());

      if (outputVariable && context.variables?.store) {
        context.variables.store.set(outputVariable, extracted);
      }

      return { success: true, data: extracted };
    } catch (parseError) {
      return {
        success: false,
        error: 'Failed to parse AI response as JSON',
        rawResponse: result.content,
      };
    }
  },
};

module.exports = {
  'ai-openai': openaiChat,
  'ai-claude': claudeChat,
  'ai-gemini': geminiChat,
  'ai-deepseek': deepseekChat,
  'ai-chat': aiChat,
  'ai-extract': aiExtract,
};
