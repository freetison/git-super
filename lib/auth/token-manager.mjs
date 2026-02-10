/**
 * OAuth Token Manager
 * Handles token lifecycle: get, refresh, validate, revoke
 */

import { CredentialStore } from './credential-store.mjs';

/**
 * Manages OAuth tokens with automatic refresh
 */
export class TokenManager {
  constructor(providerId, options = {}) {
    this.providerId = providerId;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret; // Optional (not needed for PKCE/device flow)
    this.scopes = options.scopes || [];
    this.tokenEndpoint = options.tokenEndpoint;
    this.refreshEndpoint = options.refreshEndpoint || options.tokenEndpoint;
    
    // Token storage
    this.credentialStore = new CredentialStore();
    
    // Token cache (in-memory for current process)
    this.tokenCache = null;
    
    // Refresh lock to prevent race conditions
    this.refreshPromise = null;
    
    // Preemptive refresh threshold (5 minutes before expiry)
    this.refreshThreshold = options.refreshThreshold || 5 * 60 * 1000;
  }

  /**
   * Get service name for credential storage
   * @private
   */
  _getServiceName() {
    return `git-super-${this.providerId}`;
  }

  /**
   * Get access token (from cache or storage)
   * @returns {Promise<string|null>}
   */
  async getAccessToken() {
    // Try cache first
    if (this.tokenCache?.accessToken) {
      return this.tokenCache.accessToken;
    }

    // Load from secure storage
    const stored = await this.credentialStore.get(this._getServiceName());
    if (stored?.accessToken) {
      this.tokenCache = stored;
      return stored.accessToken;
    }

    return null;
  }

  /**
   * Get refresh token
   * @returns {Promise<string|null>}
   */
  async getRefreshToken() {
    const stored = await this.credentialStore.get(this._getServiceName());
    return stored?.refreshToken || null;
  }

  /**
   * Check if we have a valid token
   * @returns {Promise<boolean>}
   */
  async hasValidToken() {
    const token = await this.getAccessToken();
    if (!token) {
      return false;
    }

    // Check expiration
    const stored = await this.credentialStore.get(this._getServiceName());
    if (!stored?.expiresAt) {
      return true; // No expiry info, assume valid
    }

    const now = Date.now();
    const expiresAt = new Date(stored.expiresAt).getTime();
    
    return expiresAt > now;
  }

  /**
   * Check if token needs refresh soon
   * @returns {Promise<boolean>}
   */
  async needsRefresh() {
    const stored = await this.credentialStore.get(this._getServiceName());
    if (!stored?.expiresAt) {
      return false;
    }

    const now = Date.now();
    const expiresAt = new Date(stored.expiresAt).getTime();
    
    // Needs refresh if expires within threshold
    return (expiresAt - now) < this.refreshThreshold;
  }

  /**
   * Store tokens securely
   * @param {Object} tokens - Token data
   * @param {string} tokens.accessToken - Access token
   * @param {string} [tokens.refreshToken] - Refresh token
   * @param {number} [tokens.expiresIn] - Expiry in seconds
   */
  async storeTokens(tokens) {
    const data = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType || 'Bearer',
      scope: tokens.scope || this.scopes.join(' '),
      issuedAt: new Date().toISOString(),
    };

    // Calculate expiration time
    if (tokens.expiresIn) {
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
      data.expiresAt = expiresAt.toISOString();
    }

    // Store in secure credential store
    await this.credentialStore.set(this._getServiceName(), data);
    
    // Update cache
    this.tokenCache = data;
  }

  /**
   * Refresh the access token using refresh token
   * @returns {Promise<boolean>} True if refresh succeeded
   */
  async refreshToken() {
    // Prevent concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal refresh implementation
   * @private
   */
  async _doRefresh() {
    const refreshToken = await this.getRefreshToken();
    
    if (!refreshToken) {
      return false; // No refresh token available
    }

    try {
      const response = await fetch(this.refreshEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          ...(this.clientSecret && { client_secret: this.clientSecret }),
        }),
      });

      if (!response.ok) {
        console.error(`Token refresh failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const tokens = await response.json();
      await this.storeTokens(tokens);
      
      return true;
    } catch (error) {
      console.error(`Error refreshing token: ${error.message}`);
      return false;
    }
  }

  /**
   * Revoke tokens and clear storage
   * @param {string} [revokeEndpoint] - Optional revoke endpoint
   */
  async revokeToken(revokeEndpoint) {
    const accessToken = await this.getAccessToken();
    
    // Try to revoke on server if endpoint provided
    if (revokeEndpoint && accessToken) {
      try {
        await fetch(revokeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: accessToken,
            client_id: this.clientId,
          }),
        });
      } catch (error) {
        console.warn(`Failed to revoke token on server: ${error.message}`);
      }
    }

    // Clear local storage
    await this.credentialStore.delete(this._getServiceName());
    this.tokenCache = null;
  }

  /**
   * Get token info for status display
   * @returns {Promise<Object|null>}
   */
  async getTokenInfo() {
    const stored = await this.credentialStore.get(this._getServiceName());
    
    if (!stored) {
      return null;
    }

    return {
      hasToken: !!stored.accessToken,
      expiresAt: stored.expiresAt,
      scope: stored.scope,
      issuedAt: stored.issuedAt,
      isValid: await this.hasValidToken(),
    };
  }
}
