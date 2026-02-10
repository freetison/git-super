/**
 * Fallback Resolver - Coordinates fallback strategies
 * Uses Strategy Pattern to select appropriate message
 */

import { AddFilesStrategy } from './add-files-strategy.mjs';
import { ModifyFilesStrategy } from './modify-files-strategy.mjs';
import { DeleteFilesStrategy } from './delete-files-strategy.mjs';

export class FallbackResolver {
  constructor() {
    // Order matters: more specific strategies first
    this.strategies = [
      new AddFilesStrategy(),
      new DeleteFilesStrategy(),
      new ModifyFilesStrategy(),
    ];
    this.defaultMessage = 'chore: update';
  }

  /**
   * Resolve the appropriate fallback message based on file stats
   * @param {Object} stats - File change statistics
   * @param {number} stats.added - Number of added files
   * @param {number} stats.modified - Number of modified files
   * @param {number} stats.deleted - Number of deleted files
   * @returns {string} - The fallback commit message
   */
  resolve(stats) {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(stats)) {
        return strategy.getMessage();
      }
    }
    
    return this.defaultMessage;
  }

  /**
   * Add a custom strategy
   * @param {BaseFallbackStrategy} strategy - Strategy to add
   */
  addStrategy(strategy) {
    this.strategies.push(strategy);
  }

  /**
   * Set default message for when no strategy matches
   * @param {string} message - Default message
   */
  setDefaultMessage(message) {
    this.defaultMessage = message;
  }
}
