/**
 * Delete Files Strategy - Handles when files are deleted
 */

import { BaseFallbackStrategy } from './base-fallback-strategy.mjs';

export class DeleteFilesStrategy extends BaseFallbackStrategy {
  canHandle({ deleted }) {
    return deleted > 0;
  }

  getMessage() {
    return 'chore: remove files';
  }
}
