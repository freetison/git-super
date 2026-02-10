/**
 * OAuth 2.0 Flow Implementations
 * Supports Device Code Flow and Authorization Code with PKCE
 */

import { createHash, randomBytes } from 'node:crypto';

/**
 * Device Code Flow (best for CLI applications)
 * https://oauth.net/2/device-flow/
 */
export class DeviceCodeFlow {
  constructor(options = {}) {
    this.clientId = options.clientId;
    this.deviceAuthEndpoint = options.deviceAuthEndpoint;
    this.tokenEndpoint = options.tokenEndpoint;
    this.scopes = options.scopes || [];
    this.pollInterval = options.pollInterval || 5000; // 5 seconds default
    this.onUserCode = options.onUserCode; // Callback(url, userCode)
  }

  /**
   * Initiate device authorization
   * @returns {Promise<Object>} Device code response
   */
  async initiate() {
    const response = await fetch(this.deviceAuthEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope: this.scopes.join(' '),
      }),
    });

    if (!response.ok) {
      throw new Error(`Device authorization failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    /*
     * Response format:
     * {
     *   device_code: "...",
     *   user_code: "ABCD-EFGH",
     *   verification_uri: "https://github.com/login/device",
     *   verification_uri_complete: "https://github.com/login/device?user_code=ABCD-EFGH",
     *   expires_in: 900,
     *   interval: 5
     * }
     */
    
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: data.verification_uri_complete || data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval || 5,
    };
  }

  /**
   * Poll for token after user authorization
   * @param {string} deviceCode - Device code from initiate()
   * @param {number} interval - Poll interval in seconds
   * @returns {Promise<Object>} Token response
   */
  async pollForToken(deviceCode, interval = 5) {
    const pollInterval = interval * 1000;
    const maxAttempts = 180; // 15 minutes max (180 * 5s)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      try {
        const response = await fetch(this.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        const data = await response.json();

        // Check for errors
        if (data.error) {
          if (data.error === 'authorization_pending') {
            // User hasn't authorized yet, continue polling
            continue;
          } else if (data.error === 'slow_down') {
            // Server asking us to slow down, increase interval
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else if (data.error === 'expired_token') {
            throw new Error('Device code expired. Please try again.');
          } else if (data.error === 'access_denied') {
            throw new Error('User denied authorization.');
          } else {
            throw new Error(`Authorization error: ${data.error} - ${data.error_description || ''}`);
          }
        }

        // Success! Return tokens
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          scope: data.scope,
        };
      } catch (error) {
        if (error.message.includes('Authorization error') || 
            error.message.includes('expired') || 
            error.message.includes('denied')) {
          throw error;
        }
        // Network error or other issue, continue polling
        console.warn(`Polling attempt ${attempt + 1} failed: ${error.message}`);
      }
    }

    throw new Error('Authorization timeout. Please try again.');
  }

  /**
   * Complete flow: initiate + display + poll
   * @returns {Promise<Object>} Token response
   */
  async execute() {
    // Step 1: Initiate
    const deviceAuth = await this.initiate();

    // Step 2: Display code to user
    if (this.onUserCode) {
      await this.onUserCode(deviceAuth.verificationUriComplete, deviceAuth.userCode);
    }

    // Step 3: Poll for token
    return await this.pollForToken(deviceAuth.deviceCode, deviceAuth.interval);
  }
}

/**
 * Authorization Code Flow with PKCE (for browser-based flows)
 * https://oauth.net/2/pkce/
 */
export class PKCEFlow {
  constructor(options = {}) {
    this.clientId = options.clientId;
    this.authEndpoint = options.authEndpoint;
    this.tokenEndpoint = options.tokenEndpoint;
    this.redirectUri = options.redirectUri || 'http://localhost:8080/callback';
    this.scopes = options.scopes || [];
  }

  /**
   * Generate code verifier (random string)
   * @private
   */
  _generateCodeVerifier() {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate code challenge from verifier
   * @private
   */
  _generateCodeChallenge(verifier) {
    return createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Generate state for CSRF protection
   * @private
   */
  _generateState() {
    return randomBytes(16).toString('base64url');
  }

  /**
   * Build authorization URL
   * @returns {Object} { url, codeVerifier, state }
   */
  buildAuthUrl() {
    const codeVerifier = this._generateCodeVerifier();
    const codeChallenge = this._generateCodeChallenge(codeVerifier);
    const state = this._generateState();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `${this.authEndpoint}?${params.toString()}`;

    return { url, codeVerifier, state };
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {string} codeVerifier - Code verifier from buildAuthUrl
   * @returns {Promise<Object>} Token response
   */
  async exchangeCode(code, codeVerifier) {
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }
}

/**
 * Simple OAuth helper for opening browser
 */
export async function openBrowser(url) {
  try {
    // Try to use 'open' package if available
    const open = require('open');
    await open(url);
    return true;
  } catch {
    // Fallback: manual instruction
    return false;
  }
}
