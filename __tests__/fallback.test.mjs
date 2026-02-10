/**
 * Tests for Fallback Strategies - Strategy Pattern
 */

import { describe, it, expect } from 'vitest';
import { BaseFallbackStrategy } from '../lib/fallback/base-fallback-strategy.mjs';
import { AddFilesStrategy } from '../lib/fallback/add-files-strategy.mjs';
import { ModifyFilesStrategy } from '../lib/fallback/modify-files-strategy.mjs';
import { DeleteFilesStrategy } from '../lib/fallback/delete-files-strategy.mjs';
import { FallbackResolver } from '../lib/fallback/fallback-resolver.mjs';

describe('Base Fallback Strategy', () => {
  it('should throw error if canHandle() not implemented', () => {
    const strategy = new BaseFallbackStrategy();
    
    expect(() => strategy.canHandle({})).toThrow(
      'BaseFallbackStrategy must implement canHandle(stats)'
    );
  });

  it('should throw error if getMessage() not implemented', () => {
    const strategy = new BaseFallbackStrategy();
    
    expect(() => strategy.getMessage()).toThrow(
      'BaseFallbackStrategy must implement getMessage()'
    );
  });

  it('should return strategy name', () => {
    class TestStrategy extends BaseFallbackStrategy {}
    const strategy = new TestStrategy();
    
    expect(strategy.getName()).toBe('TestStrategy');
  });
});

describe('Add Files Strategy', () => {
  const strategy = new AddFilesStrategy();

  it('should handle when only files are added', () => {
    const stats = { added: 5, modified: 0, deleted: 0 };
    
    expect(strategy.canHandle(stats)).toBe(true);
  });

  it('should not handle when files are modified', () => {
    const stats = { added: 5, modified: 2, deleted: 0 };
    
    expect(strategy.canHandle(stats)).toBe(false);
  });

  it('should not handle when files are deleted', () => {
    const stats = { added: 5, modified: 0, deleted: 1 };
    
    expect(strategy.canHandle(stats)).toBe(false);
  });

  it('should not handle when no files are added', () => {
    const stats = { added: 0, modified: 2, deleted: 1 };
    
    expect(strategy.canHandle(stats)).toBe(false);
  });

  it('should return correct message', () => {
    expect(strategy.getMessage()).toBe('feat: add new files');
  });
});

describe('Modify Files Strategy', () => {
  const strategy = new ModifyFilesStrategy();

  it('should handle when files are modified', () => {
    const stats = { added: 0, modified: 3, deleted: 0 };
    
    expect(strategy.canHandle(stats)).toBe(true);
  });

  it('should handle when files are modified with additions', () => {
    const stats = { added: 2, modified: 3, deleted: 0 };
    
    expect(strategy.canHandle(stats)).toBe(true);
  });

  it('should handle when files are modified with deletions', () => {
    const stats = { added: 0, modified: 3, deleted: 1 };
    
    expect(strategy.canHandle(stats)).toBe(true);
  });

  it('should not handle when no files are modified', () => {
    const stats = { added: 2, modified: 0, deleted: 1 };
    
    expect(strategy.canHandle(stats)).toBe(false);
  });

  it('should return correct message', () => {
    expect(strategy.getMessage()).toBe('refactor: update code');
  });
});

describe('Delete Files Strategy', () => {
  const strategy = new DeleteFilesStrategy();

  it('should handle when files are deleted', () => {
    const stats = { added: 0, modified: 0, deleted: 3 };
    
    expect(strategy.canHandle(stats)).toBe(true);
  });

  it('should handle when files are deleted with additions', () => {
    const stats = { added: 2, modified: 0, deleted: 3 };
    
    expect(strategy.canHandle(stats)).toBe(true);
  });

  it('should not handle when no files are deleted', () => {
    const stats = { added: 2, modified: 3, deleted: 0 };
    
    expect(strategy.canHandle(stats)).toBe(false);
  });

  it('should return correct message', () => {
    expect(strategy.getMessage()).toBe('chore: remove files');
  });
});

describe('Fallback Resolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new FallbackResolver();
  });

  describe('Strategy Resolution', () => {
    it('should resolve AddFilesStrategy for only additions', () => {
      const stats = { added: 5, modified: 0, deleted: 0 };
      const message = resolver.resolve(stats);
      
      expect(message).toBe('feat: add new files');
    });

    it('should resolve ModifyFilesStrategy for modifications', () => {
      const stats = { added: 0, modified: 3, deleted: 0 };
      const message = resolver.resolve(stats);
      
      expect(message).toBe('refactor: update code');
    });

    it('should resolve DeleteFilesStrategy for deletions', () => {
      const stats = { added: 0, modified: 0, deleted: 2 };
      const message = resolver.resolve(stats);
      
      expect(message).toBe('chore: remove files');
    });

    it('should prioritize delete over modify', () => {
      const stats = { added: 0, modified: 2, deleted: 1 };
      const message = resolver.resolve(stats);
      
      // Should match DeleteFilesStrategy first
      expect(message).toBe('chore: remove files');
    });

    it('should use default message when no strategy matches', () => {
      const stats = { added: 0, modified: 0, deleted: 0 };
      const message = resolver.resolve(stats);
      
      expect(message).toBe('chore: update');
    });
  });

  describe('Strategy Priority', () => {
    it('should check strategies in defined order', () => {
      // AddFiles is most specific (all zeros except added)
      const addStats = { added: 1, modified: 0, deleted: 0 };
      expect(resolver.resolve(addStats)).toBe('feat: add new files');
      
      // Delete before Modify in priority
      const deleteStats = { added: 0, modified: 1, deleted: 1 };
      expect(resolver.resolve(deleteStats)).toBe('chore: remove files');
      
      // Modify catches anything with modifications
      const modifyStats = { added: 1, modified: 1, deleted: 0 };
      expect(resolver.resolve(modifyStats)).toBe('refactor: update code');
    });
  });

  describe('Extensibility', () => {
    it('should allow adding custom strategies', () => {
      class RenameStrategy extends BaseFallbackStrategy {
        canHandle({ renamed }) {
          return renamed > 0;
        }
        getMessage() {
          return 'refactor: rename files';
        }
      }
      
      resolver.addStrategy(new RenameStrategy());
      const message = resolver.resolve({ renamed: 2 });
      
      expect(message).toBe('refactor: rename files');
    });

    it('should allow changing default message', () => {
      resolver.setDefaultMessage('chore: misc changes');
      const message = resolver.resolve({ added: 0, modified: 0, deleted: 0 });
      
      expect(message).toBe('chore: misc changes');
    });
  });

  describe('Pattern Validation', () => {
    it('should eliminate if-else chains (Strategy Pattern)', () => {
      // This test validates the pattern: resolver delegates to strategies
      const testCases = [
        { stats: { added: 1, modified: 0, deleted: 0 }, expected: 'feat: add new files' },
        { stats: { added: 0, modified: 1, deleted: 0 }, expected: 'refactor: update code' },
        { stats: { added: 0, modified: 0, deleted: 1 }, expected: 'chore: remove files' },
      ];
      
      testCases.forEach(({ stats, expected }) => {
        const message = resolver.resolve(stats);
        expect(message).toBe(expected);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle all zeros', () => {
      const message = resolver.resolve({ added: 0, modified: 0, deleted: 0 });
      expect(message).toBe('chore: update');
    });

    it('should handle negative numbers gracefully', () => {
      const message = resolver.resolve({ added: -1, modified: 0, deleted: 0 });
      expect(message).toBe('chore: update');
    });

    it('should handle missing properties', () => {
      const message = resolver.resolve({});
      expect(message).toBe('chore: update');
    });

    it('should handle all operations at once', () => {
      const stats = { added: 5, modified: 3, deleted: 2 };
      const message = resolver.resolve(stats);
      
      // Should prioritize delete (based on strategy order)
      expect(message).toBe('chore: remove files');
    });
  });
});
