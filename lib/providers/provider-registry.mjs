/**
 * Provider Registry - Factory/Registry Pattern
 * Manages AI provider instances and resolves them by name
 */

import { OllamaProvider } from './ollama-provider.mjs';
import { AnthropicProvider } from './anthropic-provider.mjs';
import { OpenAIProvider } from './openai-provider.mjs';
import { GitHubCopilotProvider } from './github-copilot-provider.mjs';
import { AzureOpenAIProvider } from './azure-openai-provider.mjs';
import { GenericOIDCProvider } from './generic-oidc-provider.mjs';

export class ProviderRegistry {
  constructor(config) {
    this.providers = new Map();
    this.config = config;
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  initializeProviders() {
    // API Key based providers
    this.register('ollama', new OllamaProvider(this.config));
    this.register('anthropic', new AnthropicProvider(this.config));
    this.register('openai', new OpenAIProvider(this.config));
    
    // OAuth/SSO providers (lazy initialization to avoid errors if not configured)
    try {
      if (this.config.githubClientId || this.config.githubOrg) {
        this.register('github-copilot', new GitHubCopilotProvider(this.config));
      }
    } catch (error) {
      // GitHub Copilot not configured, skip
    }
    
    try {
      if (this.config.azureClientId && this.config.azureResourceEndpoint) {
        this.register('azure-openai', new AzureOpenAIProvider(this.config));
      }
    } catch (error) {
      // Azure OpenAI not configured, skip
    }
    
    try {
      if (this.config.oidcIssuer && this.config.oidcClientId) {
        this.register('generic-oidc', new GenericOIDCProvider(this.config));
      }
    } catch (error) {
      // Generic OIDC not configured, skip
    }
  }

  /**
   * Register a provider with a name
   * @param {string} name - Provider identifier
   * @param {BaseAIProvider} provider - Provider instance
   */
  register(name, provider) {
    this.providers.set(name, provider);
  }

  /**
   * Get a provider by name
   * @param {string} name - Provider identifier
   * @returns {BaseAIProvider}
   * @throws {Error} If provider not found
   */
  get(name) {
    const provider = this.providers.get(name);
    
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Provider '${name}' not found. Available providers: ${available}`
      );
    }
    
    return provider;
  }

  /**
   * Check if a provider exists
   * @param {string} name - Provider identifier
   * @returns {boolean}
   */
  has(name) {
    return this.providers.has(name);
  }

  /**
   * Get all registered provider names
   * @returns {string[]}
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }
}
