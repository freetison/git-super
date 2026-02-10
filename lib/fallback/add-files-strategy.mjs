/**
 * Add Files Strategy - Handles when only new files are added
 */

import { BaseFallbackStrategy } from './base-fallback-strategy.mjs';

export class AddFilesStrategy extends BaseFallbackStrategy {
  canHandle({ added, modified, deleted }) {
    return added > 0 && modified === 0 && deleted === 0;
  }

  getMessage() {
    return 'feat: add new files';
  }
}
