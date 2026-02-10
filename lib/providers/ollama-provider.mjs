/**
 * Ollama AI Provider implementation
 */

import { BaseAIProvider } from './base-provider.mjs';
import { NoAuthStrategy } from '../auth/auth-strategy.mjs';

export class OllamaProvider extends BaseAIProvider {
  constructor(config) {
    // Ollama doesn't need authentication (local server)
    super(config, new NoAuthStrategy(config));
  }

  async generate(prompt) {
    let modelToUse = this.config.aiModel;
    
    let response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    });

    // If model not found, try to find an alternative
    if (response.status === 404) {
      const availableModels = await this.getAvailableModels();
      
      if (availableModels.length === 0) {
        throw new Error(`Ollama is running but no models are installed. Install one with: ollama pull mistral`);
      }
      
      modelToUse = this.findBestModel(availableModels);
      console.log(`  ℹ️  Model '${this.config.aiModel}' not found, using '${modelToUse}'`);
      
      // Retry with available model
      response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.cleanResponse(data.response);
  }

  async getAvailableModels() {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map(m => m.name) || [];
    } catch {
      return [];
    }
  }

  findBestModel(availableModels) {
    const preferredModels = [
      'qwen2.5-coder',
      'deepseek-coder',
      'codellama',
      'mistral',
      'llama3',
      'llama2'
    ];
    
    return preferredModels.find(m => 
      availableModels.some(a => a.startsWith(m))
    ) || availableModels[0];
  }

  cleanResponse(response) {
    let message = response.trim()
      .replace(/^["'`]|["'`]$/g, '')       // Remove quotes
      .replace(/^\*\*|\*\*$/g, '')          // Remove bold markdown
      .replace(/^```.*\n?|\n?```$/g, '')    // Remove code blocks
      .split('\n')[0]                       // Take first line only
      .trim();
    
    // If message looks invalid, return generic
    if (message.length > 100 || 
        message.toLowerCase().includes('based on') || 
        message.toLowerCase().includes('appears')) {
      return 'chore: update files';
    }
    
    return message;
  }
}
