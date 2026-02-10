/**
 * Tests for AI Providers - Strategy Pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAIProvider } from '../lib/providers/base-provider.mjs';
import { OllamaProvider } from '../lib/providers/ollama-provider.mjs';
import { AnthropicProvider } from '../lib/providers/anthropic-provider.mjs';
import { OpenAIProvider } from '../lib/providers/openai-provider.mjs';
import { ProviderRegistry } from '../lib/providers/provider-registry.mjs';

describe('Base AI Provider', () => {
  it('should throw error if generate() not implemented', async () => {
    const provider = new BaseAIProvider({});
    
    await expect(provider.generate('test')).rejects.toThrow(
      'BaseAIProvider must implement generate(prompt)'
    );
  });

  it('should return provider name', () => {
    class TestProvider extends BaseAIProvider {}
    const provider = new TestProvider({});
    
    expect(provider.getName()).toBe('test');
  });
});

describe('Ollama Provider', () => {
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      aiModel: 'mistral:latest',
      ollamaUrl: 'http://localhost:11434',
    };
    
    global.fetch = vi.fn();
  });

  it('should clean response correctly', () => {
    const provider = new OllamaProvider(mockConfig);
    
    // Test quote removal
    expect(provider.cleanResponse('"feat: test"')).toBe('feat: test');
    expect(provider.cleanResponse("'feat: test'")).toBe('feat: test');
    
    // Test bold markdown removal
    expect(provider.cleanResponse('**feat: test**')).toBe('feat: test');
    
    // Test multiline - only first line taken
    expect(provider.cleanResponse('feat: test\nExtra line')).toBe('feat: test');
  });

  it('should return generic message for invalid responses', () => {
    const provider = new OllamaProvider(mockConfig);
    
    // Too long
    const longMsg = 'a'.repeat(101);
    expect(provider.cleanResponse(longMsg)).toBe('chore: update files');
    
    // Explanatory text
    expect(provider.cleanResponse('Based on the changes...')).toBe('chore: update files');
    expect(provider.cleanResponse('It appears that...')).toBe('chore: update files');
  });

  it('should find best model from available models', () => {
    const provider = new OllamaProvider(mockConfig);
    const available = ['llama2', 'codellama', 'mistral'];
    
    const best = provider.findBestModel(available);
    expect(best).toBe('codellama'); // Higher priority in list
  });

  it('should fallback to first model if no preferred found', () => {
    const provider = new OllamaProvider(mockConfig);
    const available = ['unknown-model'];
    
    const best = provider.findBestModel(available);
    expect(best).toBe('unknown-model');
  });

  it('should generate message successfully', async () => {
    const provider = new OllamaProvider(mockConfig);
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: 'feat: add new feature' }),
    });
    
    const message = await provider.generate('test prompt');
    expect(message).toBe('feat: add new feature');
  });

  it('should handle model not found and retry', async () => {
    const provider = new OllamaProvider(mockConfig);
    
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ models: [{ name: 'mistral' }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ response: 'feat: test' }),
      });
    });
    
    const message = await provider.generate('test');
    expect(message).toBe('feat: test');
  });
});

describe('Anthropic Provider', () => {
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      anthropicKey: 'test-key',
      aiModel: 'claude-sonnet-4-20250514',
    };
    
    global.fetch = vi.fn();
  });

  it('should throw error if API key not configured', async () => {
    const provider = new AnthropicProvider({});
    
    await expect(provider.generate('test')).rejects.toThrow(
      'anthropicKey is not configured'
    );
  });

  it('should generate message successfully', async () => {
    const provider = new AnthropicProvider(mockConfig);
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'feat: add feature' }],
      }),
    });
    
    const message = await provider.generate('test prompt');
    expect(message).toBe('feat: add feature');
  });

  it('should remove quotes from response', async () => {
    const provider = new AnthropicProvider(mockConfig);
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '"feat: test"' }],
      }),
    });
    
    const message = await provider.generate('test');
    expect(message).toBe('feat: test');
  });
});

describe('OpenAI Provider', () => {
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      openaiKey: 'test-key',
      aiModel: 'gpt-4',
    };
    
    global.fetch = vi.fn();
  });

  it('should throw error if API key not configured', async () => {
    const provider = new OpenAIProvider({});
    
    await expect(provider.generate('test')).rejects.toThrow(
      'openaiKey is not configured'
    );
  });

  it('should generate message successfully', async () => {
    const provider = new OpenAIProvider(mockConfig);
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'feat: add feature' } }],
      }),
    });
    
    const message = await provider.generate('test prompt');
    expect(message).toBe('feat: add feature');
  });
});

describe('Provider Registry', () => {
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      aiProvider: 'ollama',
      aiModel: 'mistral:latest',
      ollamaUrl: 'http://localhost:11434',
    };
  });

  it('should initialize with all providers', () => {
    const registry = new ProviderRegistry(mockConfig);
    
    expect(registry.has('ollama')).toBe(true);
    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('openai')).toBe(true);
  });

  it('should get provider by name', () => {
    const registry = new ProviderRegistry(mockConfig);
    
    const provider = registry.get('ollama');
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('should throw error for unknown provider', () => {
    const registry = new ProviderRegistry(mockConfig);
    
    expect(() => registry.get('unknown')).toThrow(
      "Provider 'unknown' not found"
    );
  });

  it('should list available providers', () => {
    const registry = new ProviderRegistry(mockConfig);
    
    const available = registry.getAvailableProviders();
    expect(available).toContain('ollama');
    expect(available).toContain('anthropic');
    expect(available).toContain('openai');
  });

  it('should allow registering custom providers', () => {
    const registry = new ProviderRegistry(mockConfig);
    
    class CustomProvider extends BaseAIProvider {
      async generate() {
        return 'custom message';
      }
    }
    
    registry.register('custom', new CustomProvider(mockConfig));
    
    expect(registry.has('custom')).toBe(true);
    expect(registry.get('custom')).toBeInstanceOf(CustomProvider);
  });

  it('should eliminate if-else chains (Strategy Pattern)', () => {
    const registry = new ProviderRegistry(mockConfig);
    
    // This test validates the pattern: no if-else needed
    const providers = ['ollama', 'anthropic', 'openai'];
    
    providers.forEach(name => {
      const provider = registry.get(name);
      expect(provider).toBeDefined();
      expect(provider.generate).toBeTypeOf('function');
    });
  });
});
