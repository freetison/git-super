/**
 * Authentication Strategy Pattern
 * Defines how different providers authenticate (API Keys vs OAuth)
 */

/**
 * Base authentication strategy (abstract)
 */
export class BaseAuthStrategy {
  constructor(config) {
    this.config = config;
  }

  /**
   * Get authentication headers for API requests
   * @returns {Promise<Object>} Headers object
   */
  async getAuthHeaders() {
    throw new Error('Method getAuthHeaders() must be implemented by subclass');
  }

  /**
   * Check if authentication is valid
   * @returns {Promise<boolean>}
   */
  async isValid() {
    throw new Error('Method isValid() must be implemented by subclass');
  }

  /**
   * Get strategy name for logging
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }
}

/**
 * API Key Authentication Strategy
 * Used by Anthropic, OpenAI (traditional API keys)
 */
export class ApiKeyAuthStrategy extends BaseAuthStrategy {
  constructor(config, options = {}) {
    super(config);
    this.keyName = options.keyName; // e.g., 'anthropicKey', 'openaiKey'
    this.headerName = options.headerName; // e.g., 'x-api-key', 'Authorization'
    this.headerFormat = options.headerFormat; // e.g., 'Bearer {key}', '{key}'
  }

  async getAuthHeaders() {
    const apiKey = this.config[this.keyName];
    
    if (!apiKey) {
      throw new Error(`${this.keyName} is not configured. Please set it via environment variable or config file.`);
    }

    const value = this.headerFormat 
      ? this.headerFormat.replace('{key}', apiKey)
      : apiKey;

    return {
      [this.headerName]: value,
    };
  }

  async isValid() {
    return !!this.config[this.keyName];
  }
}

/**
 * OAuth Authentication Strategy
 * Used by GitHub Copilot, Azure OpenAI, Claude Enterprise
 */
export class OAuthAuthStrategy extends BaseAuthStrategy {
  constructor(config, tokenManager) {
    super(config);
    this.tokenManager = tokenManager;
  }

  async getAuthHeaders() {
    // Ensure we have a valid token (refresh if needed)
    await this.ensureAuthenticated();
    
    const token = await this.tokenManager.getAccessToken();
    
    if (!token) {
      throw new Error('No valid OAuth token available. Please authenticate with: git super auth login');
    }

    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  async isValid() {
    return await this.tokenManager.hasValidToken();
  }

  /**
   * Ensure we have a valid token, refresh if needed
   * @private
   */
  async ensureAuthenticated() {
    if (!await this.tokenManager.hasValidToken()) {
      // Try to refresh
      const refreshed = await this.tokenManager.refreshToken();
      
      if (!refreshed) {
        throw new Error(
          'OAuth token expired and could not be refreshed. ' +
          'Please re-authenticate with: git super auth login'
        );
      }
    }
  }
}

/**
 * No Auth Strategy
 * Used by Ollama (local server, no authentication)
 */
export class NoAuthStrategy extends BaseAuthStrategy {
  async getAuthHeaders() {
    return {}; // No authentication headers needed
  }

  async isValid() {
    return true; // Always valid (local server)
  }
}
