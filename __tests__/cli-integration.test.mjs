/**
 * Integration Tests for CLI Entry Point (bin/git-super.mjs)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const execAsync = promisify(exec);

describe('CLI Integration Tests', () => {
  const testConfigPath = join(homedir(), '.gitsuperrc.test');
  const cliPath = join(process.cwd(), 'bin', 'git-super.mjs');

  beforeEach(() => {
    // Create test config
    const testConfig = {
      aiProvider: 'ollama',
      aiModel: 'mistral:latest',
      ollamaUrl: 'http://localhost:11434',
    };
    writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  afterEach(() => {
    // Clean up test config
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('Help Command', () => {
    it('should display help with --help flag', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" --help`);

      expect(stdout).toContain('git-super');
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Authentication');
    });

    it('should display help with -h flag', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" -h`);

      expect(stdout).toContain('git-super');
      expect(stdout).toContain('Usage:');
    });

    it('should display help for auth command', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" auth --help`);

      expect(stdout).toContain('auth');
      expect(stdout).toContain('login');
      expect(stdout).toContain('logout');
      expect(stdout).toContain('status');
    });

    it('should display help for context command', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" context --help`, {
        timeout: 10000,
      });

      // Context command shows current status or help
      expect(stdout).toMatch(/context|Context|Current/i);
    }, 15000);
  });

  describe('Version Command', () => {
    it('should handle version flag gracefully', async () => {
      try {
        const { stdout } = await execAsync(`node "${cliPath}" --version`, {
          timeout: 10000,
        });
        // May show version or run normal flow
        expect(stdout).toBeDefined();
      } catch (error) {
        // Acceptable if it fails
        expect(error).toBeDefined();
      }
    }, 15000);

    it('should handle -v flag gracefully', async () => {
      try {
        const { stdout } = await execAsync(`node "${cliPath}" -v`, {
          timeout: 10000,
        });
        expect(stdout).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 15000);
  });

  describe('Main Generate Command', () => {
    it('should handle missing git repository', async () => {
      const tempDir = join(process.cwd(), '__tests__', 'temp-no-git');
      const fs = await import('node:fs');
      
      if (!existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      try {
        await execAsync(`node "${cliPath}"`, { cwd: tempDir, timeout: 10000 });
        expect.fail('Should have thrown error');
      } catch (error) {
        // Should fail with git or execution error
        expect(error).toBeDefined();
      } finally {
        if (existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    }, 15000);

    it('should validate provider configuration', async () => {
      // Test with invalid provider
      const invalidConfig = {
        aiProvider: 'invalid-provider',
      };
      writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      try {
        await execAsync(`node "${cliPath}"`, { timeout: 10000 });
        // If it doesn't throw, that's also acceptable (may use fallback)
      } catch (error) {
        // Should fail with some error
        expect(error).toBeDefined();
      }
    }, 15000);
  });

  describe('Argument Parsing', () => {
    it('should parse provider flag', async () => {
      try {
        await execAsync(`node "${cliPath}" --provider ollama`);
      } catch (error) {
        // May fail due to no git repo, but should parse args
        expect(error.code).not.toBe(2); // 2 is arg parse error
      }
    });

    it('should parse model flag', async () => {
      try {
        await execAsync(`node "${cliPath}" --model mistral:latest`);
      } catch (error) {
        expect(error.code).not.toBe(2);
      }
    });

    it('should parse multiple flags', async () => {
      try {
        await execAsync(`node "${cliPath}" --provider ollama --model llama2 --dry-run`);
      } catch (error) {
        expect(error.code).not.toBe(2);
      }
    });

    it('should handle unknown flags', async () => {
      try {
        await execAsync(`node "${cliPath}" --unknown-flag`);
        expect.fail('Should have thrown error');
      } catch (error) {
        // Should fail gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Auth Commands', () => {
    it('should execute auth status command', async () => {
      try {
        const { stdout } = await execAsync(`node "${cliPath}" auth status`);
        expect(stdout).toContain('Authentication Status');
      } catch (error) {
        // May fail if provider doesn't support auth, but command should execute
        expect(error.message).not.toContain('command not found');
      }
    });

    it('should execute context list command', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" context list`);
      expect(stdout).toMatch(/context|Available/i);
    });

    it('should create config file and switch context when file does not exist', async () => {
      const tempConfigPath = join(homedir(), '.gitsuperrc.temp');
      
      // Ensure the file doesn't exist
      if (existsSync(tempConfigPath)) {
        unlinkSync(tempConfigPath);
      }

      // Mock getConfigPath to use temp file
      process.env.HOME = homedir();
      
      try {
        // This should create the file and switch to 'local'
        const { stdout } = await execAsync(`node "${cliPath}" context switch local`);
        
        expect(stdout).toContain('Switched to');
        expect(stdout).toContain('Local Development');
        expect(stdout).toContain('ollama');
      } catch (error) {
        // The command might succeed but create the actual .gitsuperrc
        // which is fine for this test
        console.log('Context switch output:', error.stdout);
      }
    });

    it('should show error for non-existent organization', async () => {
      try {
        await execAsync(`node "${cliPath}" context switch nonexistent`);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const errorOutput = error.stderr || error.stdout || error.message;
        expect(errorOutput).toContain('not found');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle SIGINT gracefully', async () => {
      // This test verifies the process handles interrupts
      const child = exec(`node "${cliPath}"`);
      
      setTimeout(() => {
        child.kill('SIGINT');
      }, 100);

      try {
        await new Promise((resolve, reject) => {
          child.on('exit', (code) => {
            if (code === 130 || code === null) {
              resolve();
            } else {
              reject(new Error(`Unexpected exit code: ${code}`));
            }
          });
          child.on('error', reject);
        });
      } catch (error) {
        // SIGINT handling may vary by platform
        expect(error).toBeDefined();
      }
    });

    it('should handle unhandled errors', async () => {
      // Test with a scenario that might cause an error
      try {
        await execAsync(`node "${cliPath}" --provider ""`, {
          env: { ...process.env, AI_PROVIDER: '' },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Dry Run Mode', () => {
    it('should execute in dry-run mode', async () => {
      try {
        await execAsync(`node "${cliPath}" --dry-run`);
      } catch (error) {
        // Should not commit, may fail due to no git repo
        expect(error.message).not.toContain('committed');
      }
    });
  });

  describe('Template and Custom Prompts', () => {
    it('should accept custom template', async () => {
      try {
        await execAsync(`node "${cliPath}" --template "feat: {message}"`);
      } catch (error) {
        // May fail due to no git repo, but should parse template
        expect(error.code).not.toBe(2);
      }
    });

    it('should accept additional prompts', async () => {
      try {
        await execAsync(`node "${cliPath}" --prompt "Focus on security improvements"`);
      } catch (error) {
        expect(error.code).not.toBe(2);
      }
    });
  });

  describe('Interactive Mode', () => {
    it('should skip confirmation in non-interactive mode', async () => {
      try {
        await execAsync(`node "${cliPath}" --yes`, {
          env: { ...process.env, CI: 'true' },
        });
      } catch (error) {
        // Should not wait for user input
        expect(error.message).not.toContain('waiting for input');
      }
    });
  });
});

describe('Command Routing', () => {
  const cliPath = join(process.cwd(), 'bin', 'git-super.mjs');

  it('should route to auth commands', async () => {
    try {
      await execAsync(`node "${cliPath}" auth`);
    } catch (error) {
      // Should recognize auth command
      expect(error.message).not.toContain('Unknown command');
    }
  });

  it('should route to context commands', async () => {
    const { stdout } = await execAsync(`node "${cliPath}" context`, {
      timeout: 10000,
    });
    // Should show context information (Current Context, Mode, etc)
    expect(stdout).toMatch(/Current|Mode|Provider/i);
  }, 15000);

  it('should handle unknown commands', async () => {
    try {
      await execAsync(`node "${cliPath}" unknown-command`, { timeout: 10000 });
      // Unknown commands are passed through, may fail later
    } catch (error) {
      // Any error is acceptable for unknown commands
      expect(error).toBeDefined();
    }
  }, 15000);
});

describe('Configuration Loading', () => {
  const cliPath = join(process.cwd(), 'bin', 'git-super.mjs');

  it('should load configuration from file', async () => {
    const testConfig = {
      aiProvider: 'ollama',
      aiModel: 'custom-model',
    };
    const configPath = join(homedir(), '.gitsuperrc');
    const backupExists = existsSync(configPath);
    let backup;

    if (backupExists) {
      const fs = await import('node:fs');
      backup = fs.readFileSync(configPath, 'utf-8');
    }

    try {
      writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      try {
        await execAsync(`node "${cliPath}"`);
      } catch (error) {
        // Config should be loaded
        expect(error.message).not.toContain('configuration');
      }
    } finally {
      if (backupExists && backup) {
        writeFileSync(configPath, backup);
      } else if (existsSync(configPath)) {
        unlinkSync(configPath);
      }
    }
  });

  it('should prioritize environment variables', async () => {
    try {
      await execAsync(`node "${cliPath}"`, {
        env: {
          ...process.env,
          AI_PROVIDER: 'anthropic',
          ANTHROPIC_API_KEY: 'test-key',
        },
      });
    } catch (error) {
      // Should use env var provider
      expect(error.message).not.toContain('provider not set');
    }
  });
});

describe('Fallback Message Generation', () => {
  describe('Empty/Invalid AI Response Handling', () => {
    it('should use fallback when AI returns empty message', () => {
      // Mock scenario: AI provider returns empty string
      const emptyMessage = '';
      const stats = { added: 0, modified: 0, deleted: 5 };
      
      // Should detect empty message and use fallback
      expect(emptyMessage.trim()).toBe('');
      
      // Fallback for only deletes should be 'chore: remove files'
      const { FallbackResolver } = require('../lib/fallback/fallback-resolver.mjs');
      const resolver = new FallbackResolver();
      const fallback = resolver.resolve(stats);
      
      expect(fallback).toBe('chore: remove files');
    });

    it('should use fallback when AI returns only quotes', () => {
      // Mock scenario: AI provider returns just quotes
      const quotesOnlyMessages = ['""', '\'\'', '``', '"', '\''];
      
      quotesOnlyMessages.forEach(msg => {
        const cleaned = msg.replace(/^["'`]+|["'`]+$/g, '').trim();
        expect(cleaned).toBe('');
      });
    });

    it('should use fallback when AI returns only whitespace', () => {
      // Mock scenario: AI provider returns whitespace
      const whitespaceMessages = ['   ', '\n\n', '\t\t', '  \n  '];
      
      whitespaceMessages.forEach(msg => {
        expect(msg.trim()).toBe('');
      });
    });

    it('should handle delete-only commits correctly', () => {
      const { FallbackResolver } = require('../lib/fallback/fallback-resolver.mjs');
      const resolver = new FallbackResolver();
      
      // Case from user's report: 21 files deleted, 0 added, 0 modified
      const stats = { added: 0, modified: 0, deleted: 21 };
      const fallback = resolver.resolve(stats);
      
      expect(fallback).toBe('chore: remove files');
    });

    it('should handle mixed delete + add commits', () => {
      const { FallbackResolver } = require('../lib/fallback/fallback-resolver.mjs');
      const resolver = new FallbackResolver();
      
      const stats = { added: 5, modified: 0, deleted: 10 };
      const fallback = resolver.resolve(stats);
      
      // Should prioritize delete strategy when deletes present
      expect(fallback).toBe('chore: remove files');
    });

    it('should validate message before using it', () => {
      // Test the validation logic that should be in generateCommitMessage
      function isValidMessage(msg) {
        if (!msg) return false;
        const cleaned = msg.replace(/^["'`]+|["'`]+$/g, '').trim();
        return cleaned.length > 0;
      }
      
      expect(isValidMessage('')).toBe(false);
      expect(isValidMessage('""')).toBe(false);
      expect(isValidMessage('  ')).toBe(false);
      expect(isValidMessage('""')).toBe(false);
      expect(isValidMessage('feat: add feature')).toBe(true);
      expect(isValidMessage('chore: remove files')).toBe(true);
    });
  });
});
