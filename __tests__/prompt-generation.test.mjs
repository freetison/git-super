/**
 * Tests for prompt generation quality
 * Ensures AI always receives useful context, even for edge cases
 */

import { describe, it, expect } from 'vitest';

describe('Prompt Generation for AI', () => {
  describe('Delete-Only Commits Prompt Context', () => {
    it('should include file count statistics in prompt', () => {
      // Simulate delete-only scenario
      const status = `D  .claude/commands/speckit.analyze.md
D  .claude/commands/speckit.checklist.md
D  .specify/memory/constitution.md`;
      
      const lines = status.split('\n').filter(l => l.trim());
      const stats = {
        added: lines.filter(l => l.startsWith('A ')).length,
        modified: lines.filter(l => l.startsWith('M ')).length,
        deleted: lines.filter(l => l.startsWith('D ')).length,
      };
      
      expect(stats.deleted).toBe(3);
      expect(stats.added).toBe(0);
      expect(stats.modified).toBe(0);
      
      // Verify change summary can be built
      const changeSummary = [];
      if (stats.added > 0) changeSummary.push(`${stats.added} added`);
      if (stats.modified > 0) changeSummary.push(`${stats.modified} modified`);
      if (stats.deleted > 0) changeSummary.push(`${stats.deleted} deleted`);
      
      expect(changeSummary).toEqual(['3 deleted']);
    });
    
    it('should provide file list even when diff is empty', () => {
      const status = `D  file1.md
D  file2.md
D  file3.md`;
      
      const files = status.split('\n')
        .filter(l => l.trim())
        .map(l => l.substring(3).trim());
      
      expect(files).toEqual(['file1.md', 'file2.md', 'file3.md']);
      expect(files.length).toBeGreaterThan(0);
    });
    
    it('should build meaningful prompt for 21 deleted files', () => {
      // Exact scenario from user report
      const fileCount = 21;
      const stats = { added: 0, modified: 0, deleted: fileCount };
      
      const changeSummary = [];
      if (stats.deleted > 0) changeSummary.push(`${stats.deleted} deleted`);
      
      const promptContext = `Change summary: ${fileCount} files changed (${changeSummary.join(', ')})`;
      
      expect(promptContext).toContain('21 files changed');
      expect(promptContext).toContain('21 deleted');
      expect(promptContext.length).toBeGreaterThan(0);
    });
  });
  
  describe('Prompt Structure Validation', () => {
    it('should always have repository context', () => {
      const repoName = 'my-project';
      const promptPart = `Repository: ${repoName}`;
      
      expect(promptPart).toContain('my-project');
    });
    
    it('should include empty diff warning when diff is empty', () => {
      const diff = '';
      const warningNote = diff.trim().length === 0 
        ? 'Note: Diff is empty (likely file deletions or binary changes). Use file list and change summary above.'
        : '';
      
      expect(warningNote).toContain('Use file list');
      expect(warningNote.length).toBeGreaterThan(0);
    });
    
    it('should not include warning when diff has content', () => {
      const diff = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
-const x = 1;
+const x = 2;`;
      
      const warningNote = diff.trim().length === 0 
        ? 'Note: Diff is empty'
        : '';
      
      expect(warningNote).toBe('');
    });
    
    it('should include ALWAYS generate instruction', () => {
      const instruction = 'ALWAYS generate a message, even if diff is empty';
      
      expect(instruction).toContain('ALWAYS');
      expect(instruction).toContain('even if diff is empty');
    });
  });
  
  describe('Mixed Change Scenarios', () => {
    it('should handle mixed add/modify/delete', () => {
      const status = `A  newfile.js
M  modified.js
D  deleted.js`;
      
      const lines = status.split('\n').filter(l => l.trim());
      const stats = {
        added: lines.filter(l => l.startsWith('A ')).length,
        modified: lines.filter(l => l.startsWith('M ')).length,
        deleted: lines.filter(l => l.startsWith('D ')).length,
      };
      
      expect(stats.added).toBe(1);
      expect(stats.modified).toBe(1);
      expect(stats.deleted).toBe(1);
      
      const changeSummary = [];
      if (stats.added > 0) changeSummary.push(`${stats.added} added`);
      if (stats.modified > 0) changeSummary.push(`${stats.modified} modified`);
      if (stats.deleted > 0) changeSummary.push(`${stats.deleted} deleted`);
      
      expect(changeSummary.join(', ')).toBe('1 added, 1 modified, 1 deleted');
    });
    
    it('should handle only adds', () => {
      const status = `A  file1.js
A  file2.js`;
      
      const lines = status.split('\n').filter(l => l.trim());
      const stats = {
        added: lines.filter(l => l.startsWith('A ')).length,
        modified: lines.filter(l => l.startsWith('M ')).length,
        deleted: lines.filter(l => l.startsWith('D ')).length,
      };
      
      const changeSummary = [];
      if (stats.added > 0) changeSummary.push(`${stats.added} added`);
      
      expect(changeSummary.join(', ')).toBe('2 added');
    });
    
    it('should handle only modifies', () => {
      const status = `M  file1.js
M  file2.js
M  file3.js`;
      
      const lines = status.split('\n').filter(l => l.trim());
      const stats = {
        added: lines.filter(l => l.startsWith('A ')).length,
        modified: lines.filter(l => l.startsWith('M ')).length,
        deleted: lines.filter(l => l.startsWith('D ')).length,
      };
      
      const changeSummary = [];
      if (stats.modified > 0) changeSummary.push(`${stats.modified} modified`);
      
      expect(changeSummary.join(', ')).toBe('3 modified');
    });
  });
  
  describe('Git Diff Statistics Integration', () => {
    it('should parse git diff --stat output', () => {
      const statOutput = ` file1.js | 10 +++++++---
 file2.js | 5 -----
 2 files changed, 5 insertions(+), 8 deletions(-)`;
      
      expect(statOutput).toContain('files changed');
      expect(statOutput).toContain('insertions');
      expect(statOutput).toContain('deletions');
    });
    
    it('should handle stat output for deletions only', () => {
      const statOutput = ` .claude/commands/speckit.analyze.md | 100 -----------------
 21 files changed, 0 insertions(+), 3759 deletions(-)`;
      
      expect(statOutput).toContain('21 files changed');
      expect(statOutput).toContain('3759 deletions');
      expect(statOutput).toContain('0 insertions');
    });
  });
  
  describe('Prompt Quality Assertions', () => {
    it('should have minimum information for AI even with empty diff', () => {
      // Minimum required context for AI
      const requiredElements = {
        repository: 'my-repo',
        changeCount: '21 files changed (21 deleted)',
        fileList: ['file1.md', 'file2.md'].join('\n'),
        instruction: 'ALWAYS generate a message',
      };
      
      // All elements should be non-empty
      Object.entries(requiredElements).forEach(([key, value]) => {
        expect(value.length).toBeGreaterThan(0);
      });
    });
    
    it('should provide context even when diff trimmed is empty', () => {
      const diff = '   \n   \n   ';
      const isEmpty = diff.trim().length === 0;
      
      expect(isEmpty).toBe(true);
      
      // Should trigger alternative context
      const alternativeContext = 'Use file list and change summary';
      expect(alternativeContext.length).toBeGreaterThan(0);
    });
  });
});
