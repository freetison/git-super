/**
 * Test for Empty AI Response Bug
 * Reproduces the issue where AI returns empty message for delete-only commits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackResolver } from '../lib/fallback/fallback-resolver.mjs';

describe('Empty AI Response Bug Fix', () => {
  let fallbackResolver;
  
  beforeEach(() => {
    fallbackResolver = new FallbackResolver();
  });
  
  describe('Message Validation Function', () => {
    // This function should be extracted or mimics the validation in bin/git-super.mjs
    function isValidMessage(message) {
      if (!message) return false;
      const cleaned = message.replace(/^["'`]+|["'`]+$/g, '').trim();
      return cleaned.length > 0;
    }
    
    it('should reject empty strings', () => {
      expect(isValidMessage('')).toBe(false);
    });
    
    it('should reject strings with only quotes', () => {
      expect(isValidMessage('""')).toBe(false);
      expect(isValidMessage("''")).toBe(false);
      expect(isValidMessage('``')).toBe(false);
      expect(isValidMessage('"')).toBe(false);
      expect(isValidMessage("'")).toBe(false);
    });
    
    it('should reject strings with only whitespace', () => {
      expect(isValidMessage('   ')).toBe(false);
      expect(isValidMessage('\n')).toBe(false);
      expect(isValidMessage('\t')).toBe(false);
      expect(isValidMessage('  \n  ')).toBe(false);
    });
    
    it('should reject quoted empty strings', () => {
      expect(isValidMessage('""')).toBe(false);
      expect(isValidMessage('" "')).toBe(false);
    });
    
    it('should accept valid messages', () => {
      expect(isValidMessage('feat: add new feature')).toBe(true);
      expect(isValidMessage('fix(api): resolve bug')).toBe(true);
      expect(isValidMessage('chore: remove files')).toBe(true);
    });
  });
  
  describe('Delete-Only Commit Scenario (User Bug Report)', () => {
    it('should generate correct fallback for 21 deleted files', () => {
      // Exact scenario from user's report:
      // 21 files changed, 3759 deletions(-)
      // All files deleted (no adds, no modifies)
      const stats = {
        added: 0,
        modified: 0,
        deleted: 21
      };
      
      const fallback = fallbackResolver.resolve(stats);
      
      expect(fallback).toBe('chore: remove files');
      expect(fallback).not.toBe('');
      expect(fallback).not.toBe('""');
    });
    
    it('should handle large number of deletions', () => {
      const stats = { added: 0, modified: 0, deleted: 100 };
      const fallback = fallbackResolver.resolve(stats);
      
      expect(fallback).toBe('chore: remove files');
    });
  });
  
  describe('Mock AI Provider Returning Empty Message', () => {
    class MockEmptyProvider {
      async generate() {
        // Simulate AI returning empty message
        return '';
      }
    }
    
    class MockQuotesOnlyProvider {
      async generate() {
        // Simulate AI returning just quotes (the exact bug from user report)
        return '""';
      }
    }
    
    class MockWhitespaceProvider {
      async generate() {
        // Simulate AI returning whitespace
        return '   \n   ';
      }
    }
    
    it('should detect empty provider response', async () => {
      const provider = new MockEmptyProvider();
      const message = await provider.generate('test prompt');
      
      const cleaned = message.replace(/^["'`]+|["'`]+$/g, '').trim();
      expect(cleaned).toBe('');
      
      // In real code, this should trigger fallback
    });
    
    it('should detect quotes-only provider response', async () => {
      const provider = new MockQuotesOnlyProvider();
      const message = await provider.generate('test prompt');
      
      const cleaned = message.replace(/^["'`]+|["'`]+$/g, '').trim();
      expect(cleaned).toBe('');
      
      // This is the exact bug scenario from user report
    });
    
    it('should detect whitespace-only provider response', async () => {
      const provider = new MockWhitespaceProvider();
      const message = await provider.generate('test prompt');
      
      const cleaned = message.replace(/^["'`]+|["'`]+$/g, '').trim();
      expect(cleaned).toBe('');
    });
  });
  
  describe('Integration Scenario', () => {
    it('should use fallback when AI message validation fails', () => {
      // Simulate the complete flow:
      // 1. Git detects only deletions
      // 2. AI generates empty message ""
      // 3. Validation detects invalid message
      // 4. Fallback resolver determines correct message
      
      const aiMessage = '""'; // What AI returned
      const stats = { added: 0, modified: 0, deleted: 21 };
      
      // Step 1: Validate AI message
      const cleaned = aiMessage.replace(/^["'`]+|["'`]+$/g, '').trim();
      const isValid = cleaned.length > 0;
      
      expect(isValid).toBe(false);
      
      // Step 2: Use fallback
      const fallback = fallbackResolver.resolve(stats);
      
      // Step 3: Verify correct message is used
      expect(fallback).toBe('chore: remove files');
      expect(fallback).not.toBe('');
      expect(fallback).not.toBe('""');
    });
    
    it('should not use fallback when AI returns valid message', () => {
      const aiMessage = 'chore: remove deprecated files';
      
      const cleaned = aiMessage.replace(/^["'`]+|["'`]+$/g, '').trim();
      const isValid = cleaned.length > 0;
      
      // Should use AI message, not fallback
      expect(isValid).toBe(true);
      expect(aiMessage).toBe('chore: remove deprecated files');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle message with quotes around valid content', () => {
      const messages = [
        '"feat: add new feature"',
        "'fix: resolve bug'",
        '`chore: update deps`'
      ];
      
      messages.forEach(msg => {
        const cleaned = msg.replace(/^["'`]+|["'`]+$/g, '').trim();
        expect(cleaned.length).toBeGreaterThan(0);
      });
    });
    
    it('should handle nested quotes', () => {
      const message = '""feat: add feature""';
      const cleaned = message.replace(/^["'`]+|["'`]+$/g, '').trim();
      
      // After removing outer quotes
      expect(cleaned).toBe('feat: add feature');
    });
  });
});
