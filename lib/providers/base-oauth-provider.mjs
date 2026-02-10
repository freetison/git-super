/**
 * Base OAuth Provider
 * Extended base for providers using OAuth authentication
 */

import { BaseAIProvider } from './base-provider.mjs';
import { OAuthAuthStrategy } from '../auth/auth-strategy.mjs';

export class BaseOAuthProvider extends BaseAIProvider {
  constructor(config, tokenManager) {
    super(config);
    this.tokenManager = tokenManager;
    this.authStrategy = new OAuthAuthStrategy(config, tokenManager);
  }

  /**
   * Get authentication headers (with automatic token refresh)
   * @returns {Promise<Object>}
   */
  async getAuthHeaders() {
    return await this.authStrategy.getAuthHeaders();
  }

  /**
   * Check if authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    return await this.authStrategy.isValid();
  }

  /**
   * Get common headers for API requests
   * @returns {Object}
   */
  getCommonHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make authenticated API request
   * @param {string} url - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>}
   */
  async authenticatedFetch(url, options = {}) {
    const authHeaders = await this.getAuthHeaders();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getCommonHeaders(),
        ...authHeaders,
        ...(options.headers || {}),
      },
    });

    return response;
  }
}
