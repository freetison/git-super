/**
 * OpenAI AI Provider implementation
 */

import { BaseAIProvider } from './base-provider.mjs';
import { ApiKeyAuthStrategy } from '../auth/auth-strategy.mjs';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    // Use API Key authentication strategy
    const authStrategy = new ApiKeyAuthStrategy(config, {
      keyName: 'openaiKey',
      headerName: 'Authorization',
      headerFormat: 'Bearer {key}',
    });
    super(config, authStrategy);
  }

  async generate(prompt) {
    // Get auth headers from strategy
    const authHeaders = await this.authStrategy.getAuthHeaders();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        model: this.config.aiModel || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
  }
}
