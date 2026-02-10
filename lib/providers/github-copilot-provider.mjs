/**
 * GitHub Copilot Enterprise Provider
 * Uses GitHub OAuth for authentication
 */

import { BaseOAuthProvider } from './base-oauth-provider.mjs';
import { TokenManager } from '../auth/token-manager.mjs';
import { DeviceCodeFlow } from '../auth/oauth-flows.mjs';

export class GitHubCopilotProvider extends BaseOAuthProvider {
  constructor(config) {
    // Create token manager for GitHub OAuth
    const tokenManager = new TokenManager('github-copilot', {
      clientId: config.githubClientId || 'Iv1.b507a08c87ecfe98', // GitHub CLI client ID
      scopes: ['read:user', 'read:org'], // Copilot scopes may vary
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
    });

    super(config, tokenManager);
    this.githubOrg = config.githubOrg;
  }

  /**
   * Initiate device code flow for GitHub authentication
   * @returns {Promise<Object>} Device authorization details
   */
  async initiateAuth() {
    const flow = new DeviceCodeFlow({
      clientId: this.tokenManager.clientId,
      deviceAuthEndpoint: 'https://github.com/login/device/code',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      scopes: this.tokenManager.scopes,
    });

    return await flow.initiate();
  }

  /**
   * Complete device code flow
   * @param {string} deviceCode - Device code from initiateAuth
   * @param {number} interval - Poll interval in seconds
   */
  async completeAuth(deviceCode, interval) {
    const flow = new DeviceCodeFlow({
      clientId: this.tokenManager.clientId,
      deviceAuthEndpoint: 'https://github.com/login/device/code',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      scopes: this.tokenManager.scopes,
    });

    const tokens = await flow.pollForToken(deviceCode, interval);
    await this.tokenManager.storeTokens(tokens);
  }

  /**
   * Generate commit message using GitHub Copilot
   * Note: This is a conceptual implementation
   * Real GitHub Copilot API may differ or require enterprise access
   */
  async generate(prompt) {
    // GitHub Copilot doesn't have a public API for commit message generation yet
    // This is a placeholder that would use GitHub's model endpoint when available
    
    // For now, we'll use GitHub Models (preview) or return a helpful message
    const isAuthenticated = await this.isAuthenticated();
    
    if (!isAuthenticated) {
      throw new Error(
        'GitHub Copilot Enterprise authentication required. ' +
        'Please authenticate with: git super auth login --provider github-copilot'
      );
    }

    try {
      // Attempt to use GitHub Models API (if available)
      // https://github.blog/2024-05-21-github-models-a-new-generation-of-ai-models/
      const response = await this.authenticatedFetch(
        'https://models.inference.ai.azure.com/chat/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            model: this.config.aiModel || 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub Copilot API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    } catch (error) {
      throw new Error(
        `GitHub Copilot is not fully available yet for commit generation. ` +
        `Original error: ${error.message}\n\n` +
        `Note: GitHub Copilot Enterprise API for commit messages may require ` +
        `special access or may use a different endpoint. Please check GitHub's ` +
        `documentation for the latest API details.`
      );
    }
  }

  /**
   * Get provider display name
   */
  getName() {
    return 'github-copilot';
  }
}
