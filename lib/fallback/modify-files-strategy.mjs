/**
 * Modify Files Strategy - Handles when files are modified
 */

import { BaseFallbackStrategy } from './base-fallback-strategy.mjs';

export class ModifyFilesStrategy extends BaseFallbackStrategy {
  canHandle({ modified }) {
    return modified > 0;
  }

  getMessage() {
    return 'refactor: update code';
  }
}
