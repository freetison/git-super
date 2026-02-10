/**
 * Base AI Provider - Strategy Pattern interface
 * All AI providers must extend this class
 */

export class BaseAIProvider {
  constructor(config, authStrategy = null) {
    this.config = config;
    this.authStrategy = authStrategy;
  }

  /**
   * Generate a commit message from a prompt
   * @param {string} prompt - The prompt to send to the AI
   * @returns {Promise<string>} - The generated message
   * @throws {Error} - Must be implemented by subclasses
   */
  async generate(prompt) {
    throw new Error(`${this.constructor.name} must implement generate(prompt)`);
  }

  /**
   * Get the provider name (used for logging)
   * @returns {string}
   */
  getName() {
    return this.constructor.name.replace('Provider', '').toLowerCase();
  }
}
