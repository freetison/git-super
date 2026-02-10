/**
 * Tests for Token Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenManager } from '../lib/auth/token-manager.mjs';

// Mock CredentialStore
vi.mock('../lib/auth/credential-store.mjs', () => ({
  CredentialStore: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('TokenManager', () => {
  let tokenManager;
  let mockCredentialStore;

  beforeEach(() => {
    // Create token manager
    tokenManager = new TokenManager('test-provider', {
      clientId: 'test-client-id',
      scopes: ['read', 'write'],
      tokenEndpoint: 'https://auth.example.com/token',
    });

    // Get mock credential store instance
    mockCredentialStore = tokenManager.credentialStore;

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('should return token from cache', async () => {
      tokenManager.tokenCache = { accessToken: 'cached-token' };

      const token = await tokenManager.getAccessToken();
      expect(token).toBe('cached-token');
    });

    it('should load token from storage if not cached', async () => {
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'stored-token',
      });

      const token = await tokenManager.getAccessToken();
      expect(token).toBe('stored-token');
      expect(mockCredentialStore.get).toHaveBeenCalledWith('git-super-test-provider');
    });

    it('should return null if no token available', async () => {
      mockCredentialStore.get.mockResolvedValue(null);

      const token = await tokenManager.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('hasValidToken', () => {
    it('should return false if no token', async () => {
      mockCredentialStore.get.mockResolvedValue(null);

      const isValid = await tokenManager.hasValidToken();
      expect(isValid).toBe(false);
    });

    it('should return true if token not expired', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'valid-token',
        expiresAt: futureDate,
      });

      const isValid = await tokenManager.hasValidToken();
      expect(isValid).toBe(true);
    });

    it('should return false if token expired', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'expired-token',
        expiresAt: pastDate,
      });

      const isValid = await tokenManager.hasValidToken();
      expect(isValid).toBe(false);
    });

    it('should return true if no expiry info', async () => {
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'token-without-expiry',
      });

      const isValid = await tokenManager.hasValidToken();
      expect(isValid).toBe(true);
    });
  });

  describe('storeTokens', () => {
    it('should store tokens with expiration', async () => {
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: 'read write',
      };

      await tokenManager.storeTokens(tokens);

      expect(mockCredentialStore.set).toHaveBeenCalledWith(
        'git-super-test-provider',
        expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          tokenType: 'Bearer',
          scope: 'read write',
          expiresAt: expect.any(String),
          issuedAt: expect.any(String),
        })
      );

      // Verify expiration is set correctly (within 1 second tolerance)
      const storedData = mockCredentialStore.set.mock.calls[0][1];
      const expectedExpiry = Date.now() + 3600000;
      const actualExpiry = new Date(storedData.expiresAt).getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });

    it('should update token cache', async () => {
      const tokens = {
        accessToken: 'new-token',
        expiresIn: 3600,
      };

      await tokenManager.storeTokens(tokens);

      expect(tokenManager.tokenCache).toMatchObject({
        accessToken: 'new-token',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockCredentialStore.get.mockResolvedValue({
        refreshToken: 'valid-refresh-token',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });

      const result = await tokenManager.refreshToken();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
      // Verify body is URL SearchParams with refresh grant
      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(URLSearchParams);
      expect(callArgs.body.get('grant_type')).toBe('refresh_token');
    });

    it('should return false if no refresh token', async () => {
      mockCredentialStore.get.mockResolvedValue(null);

      const result = await tokenManager.refreshToken();
      expect(result).toBe(false);
    });

    it('should return false if refresh fails', async () => {
      mockCredentialStore.get.mockResolvedValue({
        refreshToken: 'invalid-refresh-token',
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await tokenManager.refreshToken();
      expect(result).toBe(false);
    });

    it('should prevent concurrent refresh requests', async () => {
      mockCredentialStore.get.mockResolvedValue({
        refreshToken: 'valid-refresh-token',
      });

      global.fetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                access_token: 'new-token',
                expires_in: 3600,
              }),
            });
          }, 100);
        })
      );

      // Start two refresh operations simultaneously
      const promise1 = tokenManager.refreshToken();
      const promise2 = tokenManager.refreshToken();

      await Promise.all([promise1, promise2]);

      // Should only call fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token on server and clear storage', async () => {
      tokenManager.tokenCache = { accessToken: 'token-to-revoke' };

      global.fetch.mockResolvedValue({
        ok: true,
      });

      await tokenManager.revokeToken('https://auth.example.com/revoke');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/revoke',
        expect.objectContaining({
          method: 'POST',
        })
      );
      // Verify body contains token
      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(URLSearchParams);
      expect(callArgs.body.get('token')).toBe('token-to-revoke');

      expect(mockCredentialStore.delete).toHaveBeenCalledWith('git-super-test-provider');
      expect(tokenManager.tokenCache).toBeNull();
    });

    it('should clear storage even if server revocation fails', async () => {
      tokenManager.tokenCache = { accessToken: 'token-to-revoke' };

      global.fetch.mockRejectedValue(new Error('Network error'));

      await tokenManager.revokeToken('https://auth.example.com/revoke');

      expect(mockCredentialStore.delete).toHaveBeenCalled();
      expect(tokenManager.tokenCache).toBeNull();
    });
  });

  describe('getTokenInfo', () => {
    it('should return token information', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'test-token',
        expiresAt: futureDate,
        scope: 'read write',
        issuedAt: new Date().toISOString(),
      });

      const info = await tokenManager.getTokenInfo();

      expect(info).toMatchObject({
        hasToken: true,
        expiresAt: futureDate,
        scope: 'read write',
        isValid: true,
      });
    });

    it('should return null if no token', async () => {
      mockCredentialStore.get.mockResolvedValue(null);

      const info = await tokenManager.getTokenInfo();
      expect(info).toBeNull();
    });
  });

  describe('needsRefresh', () => {
    it('should return true if expires within threshold', async () => {
      // Token expires in 4 minutes (less than 5 minute threshold)
      const soonDate = new Date(Date.now() + 4 * 60 * 1000).toISOString();
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'test-token',
        expiresAt: soonDate,
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(true);
    });

    it('should return false if expires later', async () => {
      // Token expires in 10 minutes (more than 5 minute threshold)
      const laterDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'test-token',
        expiresAt: laterDate,
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(false);
    });

    it('should return false if no expiry info', async () => {
      mockCredentialStore.get.mockResolvedValue({
        accessToken: 'test-token',
      });

      const needsRefresh = await tokenManager.needsRefresh();
      expect(needsRefresh).toBe(false);
    });
  });
});
