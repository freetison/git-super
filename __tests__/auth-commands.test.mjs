/**
 * Integration Tests for Auth Commands
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleAuthLogin,
  handleAuthLogout,
  handleAuthStatus,
  handleContext,
} from '../lib/cli/auth-commands.mjs';
import * as readline from 'node:readline';

// Mock dependencies
vi.mock('../lib/providers/provider-registry.mjs', () => ({
  ProviderRegistry: {
    getProvider: vi.fn(),
  },
}));

vi.mock('../lib/config/config-loader.mjs', () => ({
  loadConfig: vi.fn(() => ({
    aiProvider: 'github-copilot',
    githubClientId: 'test-client-id',
  })),
  listOrganizations: vi.fn(() => ['default', 'work', 'personal']),
  getActiveOrg: vi.fn(() => 'work'),
}));

vi.mock('../lib/auth/oauth-flows.mjs', () => ({
  openBrowser: vi.fn().mockResolvedValue(true),
}));

describe('Auth Commands Integration', () => {
  let mockProvider;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(async () => {
    mockProvider = {
      name: 'GitHub Copilot',
      isAuthenticated: vi.fn(),
      initiateAuth: vi.fn(),
      completeAuth: vi.fn(),
      tokenManager: {
        revokeToken: vi.fn(),
      },
    };

    const { ProviderRegistry } = await import('../lib/providers/provider-registry.mjs');
    ProviderRegistry.getProvider.mockReturnValue(mockProvider);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleAuthLogin', () => {
    it('should successfully login with OAuth provider', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(false);
      mockProvider.initiateAuth.mockResolvedValue({
        deviceCode: 'test-device-code',
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
        verificationUriComplete: 'https://github.com/login/device?code=ABCD',
        interval: 5,
      });
      mockProvider.completeAuth.mockResolvedValue();

      await handleAuthLogin({});

      expect(mockProvider.initiateAuth).toHaveBeenCalled();
      expect(mockProvider.completeAuth).toHaveBeenCalledWith('test-device-code', 5);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully authenticated')
      );
    });

    it('should skip login if already authenticated', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);

      await handleAuthLogin({});

      expect(mockProvider.initiateAuth).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already authenticated')
      );
    });

    it('should handle login with --force flag', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);
      mockProvider.initiateAuth.mockResolvedValue({
        deviceCode: 'test-device-code',
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
        interval: 5,
      });
      mockProvider.completeAuth.mockResolvedValue();

      await handleAuthLogin({ force: true });

      expect(mockProvider.initiateAuth).toHaveBeenCalled();
    });

    it('should handle provider-specific login', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(false);
      mockProvider.initiateAuth.mockResolvedValue({
        deviceCode: 'test-device-code',
        userCode: 'ABCD-1234',
        verificationUri: 'https://auth.example.com/device',
        interval: 5,
      });
      mockProvider.completeAuth.mockResolvedValue();

      await handleAuthLogin({ provider: 'azure-openai' });

      expect(mockProvider.initiateAuth).toHaveBeenCalled();
    });

    it('should handle login errors', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(false);
      mockProvider.initiateAuth.mockRejectedValue(new Error('Network error'));

      await handleAuthLogin({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Authentication failed')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle non-OAuth providers', async () => {
      const nonOAuthProvider = {
        name: 'Ollama',
        isAuthenticated: vi.fn().mockResolvedValue(true),
      };

      const { ProviderRegistry } = await import('../lib/providers/provider-registry.mjs');
      ProviderRegistry.getProvider.mockReturnValue(nonOAuthProvider);

      await handleAuthLogin({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not require authentication')
      );
    });
  });

  describe('handleAuthLogout', () => {
    it('should successfully logout', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);
      mockProvider.tokenManager.revokeToken.mockResolvedValue();

      await handleAuthLogout({});

      expect(mockProvider.tokenManager.revokeToken).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully logged out')
      );
    });

    it('should handle logout when not authenticated', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(false);

      await handleAuthLogout({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not authenticated')
      );
    });

    it('should handle provider-specific logout', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);
      mockProvider.tokenManager.revokeToken.mockResolvedValue();

      await handleAuthLogout({ provider: 'github-copilot' });

      expect(mockProvider.tokenManager.revokeToken).toHaveBeenCalled();
    });

    it('should handle logout errors', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);
      mockProvider.tokenManager.revokeToken.mockRejectedValue(new Error('Network error'));

      await handleAuthLogout({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout failed')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle non-OAuth providers', async () => {
      const nonOAuthProvider = {
        name: 'Ollama',
        isAuthenticated: vi.fn().mockResolvedValue(true),
      };

      const { ProviderRegistry } = await import('../lib/providers/provider-registry.mjs');
      ProviderRegistry.getProvider.mockReturnValue(nonOAuthProvider);

      await handleAuthLogout({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not require authentication')
      );
    });
  });

  describe('handleAuthStatus', () => {
    it('should show authenticated status', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);
      mockProvider.tokenManager = {
        getTokenInfo: vi.fn().mockResolvedValue({
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      };

      await handleAuthStatus({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Authenticated')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('GitHub Copilot')
      );
    });

    it('should show not authenticated status', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(false);

      await handleAuthStatus({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not authenticated')
      );
    });

    it('should show status for specific provider', async () => {
      mockProvider.isAuthenticated.mockResolvedValue(true);

      await handleAuthStatus({ provider: 'azure-openai' });

      expect(mockProvider.isAuthenticated).toHaveBeenCalled();
    });

    it('should handle status check errors', async () => {
      mockProvider.isAuthenticated.mockRejectedValue(new Error('Network error'));

      await handleAuthStatus({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check authentication status')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show non-OAuth provider status', async () => {
      const nonOAuthProvider = {
        name: 'Ollama',
        isAuthenticated: vi.fn().mockResolvedValue(true),
      };

      const { ProviderRegistry } = await import('../lib/providers/provider-registry.mjs');
      ProviderRegistry.getProvider.mockReturnValue(nonOAuthProvider);

      await handleAuthStatus({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No authentication required')
      );
    });
  });

  describe('handleContext', () => {
    it('should list all contexts', async () => {
      const { listOrganizations, getActiveOrg } = await import(
        '../lib/config/config-loader.mjs'
      );

      await handleContext({ _: ['list'] });

      expect(listOrganizations).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available contexts')
      );
    });

    it('should show active context', async () => {
      await handleContext({ _: [] });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current context: work')
      );
    });

    it('should switch context', async () => {
      const fs = await import('node:fs');
      const writeFileSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const readFileSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          organizations: {
            work: { aiProvider: 'github-copilot' },
            personal: { aiProvider: 'anthropic' },
          },
          activeOrg: 'work',
        })
      );

      await handleContext({ _: ['use', 'personal'] });

      expect(writeFileSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Switched to context: personal')
      );

      readFileSpy.mockRestore();
      writeFileSpy.mockRestore();
    });

    it('should handle non-existent context', async () => {
      const fs = await import('node:fs');
      const readFileSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          organizations: {
            work: { aiProvider: 'github-copilot' },
          },
          activeOrg: 'work',
        })
      );

      await handleContext({ _: ['use', 'nonexistent'] });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Context not found')
      );

      readFileSpy.mockRestore();
    });

    it('should handle context errors', async () => {
      const { listOrganizations } = await import('../lib/config/config-loader.mjs');
      listOrganizations.mockImplementation(() => {
        throw new Error('Config error');
      });

      await handleContext({ _: ['list'] });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to manage context')
      );

      listOrganizations.mockImplementation(() => ['default', 'work', 'personal']);
    });
  });
});
