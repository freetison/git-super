/**
 * Base Fallback Strategy - Strategy Pattern interface
 * All fallback strategies must extend this class
 */

export class BaseFallbackStrategy {
  /**
   * Check if this strategy can handle the given file stats
   * @param {Object} stats - File change statistics
   * @param {number} stats.added - Number of added files
   * @param {number} stats.modified - Number of modified files
   * @param {number} stats.deleted - Number of deleted files
   * @returns {boolean}
   */
  canHandle(stats) {
    throw new Error(`${this.constructor.name} must implement canHandle(stats)`);
  }

  /**
   * Get the fallback commit message
   * @returns {string}
   */
  getMessage() {
    throw new Error(`${this.constructor.name} must implement getMessage()`);
  }

  /**
   * Get strategy name (for debugging)
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }
}
