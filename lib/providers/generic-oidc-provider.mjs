/**
 * Generic OIDC (OpenID Connect) Provider
 * Supports any OAuth 2.0 / OIDC compliant identity provider
 */

import { BaseOAuthProvider } from './base-oauth-provider.mjs';
import { TokenManager } from '../auth/token-manager.mjs';
import { DeviceCodeFlow } from '../auth/oauth-flows.mjs';

export class GenericOIDCProvider extends BaseOAuthProvider {
  constructor(config) {
    const issuer = config.oidcIssuer;
    const clientId = config.oidcClientId;
    
    if (!issuer || !clientId) {
      throw new Error(
        'OIDC configuration required: OIDC_ISSUER and OIDC_CLIENT_ID must be set'
      );
    }

    // Create token manager
    const tokenManager = new TokenManager('generic-oidc', {
      clientId,
      scopes: config.oidcScopes || ['openid', 'profile', 'email'],
      tokenEndpoint: config.oidcTokenEndpoint || `${issuer}/oauth2/token`,
    });

    super(config, tokenManager);
    
    this.issuer = issuer;
    this.apiEndpoint = config.oidcApiEndpoint;
    this.deviceAuthEndpoint = config.oidcDeviceAuthEndpoint || `${issuer}/oauth2/device/authorize`;
    
    if (!this.apiEndpoint) {
      throw new Error(
        'OIDC API endpoint required: Set OIDC_API_ENDPOINT in config\n' +
        'This should be the endpoint where your AI service is hosted'
      );
    }
  }

  /**
   * Discover OIDC configuration from well-known endpoint
   * @returns {Promise<Object>}
   */
  async discoverConfig() {
    try {
      const response = await fetch(`${this.issuer}/.well-known/openid-configuration`);
      if (!response.ok) {
        throw new Error(`OIDC discovery failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`OIDC discovery failed: ${error.message}, using manual configuration`);
      return null;
    }
  }

  /**
   * Initiate device code flow
   */
  async initiateAuth() {
    const flow = new DeviceCodeFlow({
      clientId: this.tokenManager.clientId,
      deviceAuthEndpoint: this.deviceAuthEndpoint,
      tokenEndpoint: this.tokenManager.tokenEndpoint,
      scopes: this.tokenManager.scopes,
    });

    return await flow.initiate();
  }

  /**
   * Complete device code flow
   */
  async completeAuth(deviceCode, interval) {
    const flow = new DeviceCodeFlow({
      clientId: this.tokenManager.clientId,
      deviceAuthEndpoint: this.deviceAuthEndpoint,
      tokenEndpoint: this.tokenManager.tokenEndpoint,
      scopes: this.tokenManager.scopes,
    });

    const tokens = await flow.pollForToken(deviceCode, interval);
    await this.tokenManager.storeTokens(tokens);
  }

  /**
   * Generate commit message using generic OIDC-protected API
   */
  async generate(prompt) {
    const isAuthenticated = await this.isAuthenticated();
    
    if (!isAuthenticated) {
      throw new Error(
        'OIDC authentication required. ' +
        'Please authenticate with: git super auth login --provider generic-oidc'
      );
    }

    // Make request to configured API endpoint
    // This assumes a standard chat completions interface, but can be customized
    const response = await this.authenticatedFetch(this.apiEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        model: this.config.aiModel || 'default',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OIDC API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Try to extract message from common response formats
    if (data.choices && data.choices[0]?.message?.content) {
      // OpenAI-compatible format
      return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    } else if (data.content && Array.isArray(data.content) && data.content[0]?.text) {
      // Anthropic-compatible format
      return data.content[0].text.trim().replace(/^["']|["']$/g, '');
    } else if (data.response) {
      // Simple response format
      return data.response.trim().replace(/^["']|["']$/g, '');
    } else if (typeof data === 'string') {
      // Plain text response
      return data.trim().replace(/^["']|["']$/g, '');
    } else {
      throw new Error('Unexpected API response format');
    }
  }

  /**
   * Get provider display name
   */
  getName() {
    return 'generic-oidc';
  }
}
