/**
 * Anthropic AI Provider implementation
 */

import { BaseAIProvider } from './base-provider.mjs';
import { ApiKeyAuthStrategy } from '../auth/auth-strategy.mjs';

export class AnthropicProvider extends BaseAIProvider {
  constructor(config) {
    // Use API Key authentication strategy
    const authStrategy = new ApiKeyAuthStrategy(config, {
      keyName: 'anthropicKey',
      headerName: 'x-api-key',
      headerFormat: '{key}',
    });
    super(config, authStrategy);
  }

  async generate(prompt) {
    // Get auth headers from strategy
    const authHeaders = await this.authStrategy.getAuthHeaders();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.aiModel || 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text.trim().replace(/^["']|["']$/g, '');
  }
}
