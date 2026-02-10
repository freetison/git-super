/**
 * Tests for Authentication Strategies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  BaseAuthStrategy, 
  ApiKeyAuthStrategy, 
  OAuthAuthStrategy, 
  NoAuthStrategy 
} from '../lib/auth/auth-strategy.mjs';
import { TokenManager } from '../lib/auth/token-manager.mjs';

describe('BaseAuthStrategy', () => {
  it('should throw error if getAuthHeaders not implemented', async () => {
    const strategy = new BaseAuthStrategy({});
    
    await expect(strategy.getAuthHeaders()).rejects.toThrow(
      'Method getAuthHeaders() must be implemented by subclass'
    );
  });

  it('should throw error if isValid not implemented', async () => {
    const strategy = new BaseAuthStrategy({});
    
    await expect(strategy.isValid()).rejects.toThrow(
      'Method isValid() must be implemented by subclass'
    );
  });

  it('should return strategy name', () => {
    const strategy = new BaseAuthStrategy({});
    expect(strategy.getName()).toBe('BaseAuthStrategy');
  });
});

describe('ApiKeyAuthStrategy', () => {
  let config;

  beforeEach(() => {
    config = {
      anthropicKey: 'test-api-key',
      openaiKey: 'test-openai-key',
    };
  });

  it('should return auth headers with simple key format', async () => {
    const strategy = new ApiKeyAuthStrategy(config, {
      keyName: 'anthropicKey',
      headerName: 'x-api-key',
      headerFormat: '{key}',
    });

    const headers = await strategy.getAuthHeaders();
    expect(headers).toEqual({
      'x-api-key': 'test-api-key',
    });
  });

  it('should return auth headers with Bearer token format', async () => {
    const strategy = new ApiKeyAuthStrategy(config, {
      keyName: 'openaiKey',
      headerName: 'Authorization',
      headerFormat: 'Bearer {key}',
    });

    const headers = await strategy.getAuthHeaders();
    expect(headers).toEqual({
      'Authorization': 'Bearer test-openai-key',
    });
  });

  it('should throw error if API key not configured', async () => {
    const strategy = new ApiKeyAuthStrategy({}, {
      keyName: 'missingKey',
      headerName: 'Authorization',
      headerFormat: 'Bearer {key}',
    });

    await expect(strategy.getAuthHeaders()).rejects.toThrow(
      'missingKey is not configured'
    );
  });

  it('should validate API key exists', async () => {
    const strategy = new ApiKeyAuthStrategy(config, {
      keyName: 'anthropicKey',
      headerName: 'x-api-key',
      headerFormat: '{key}',
    });

    expect(await strategy.isValid()).toBe(true);
  });

  it('should return false if API key missing', async () => {
    const strategy = new ApiKeyAuthStrategy({}, {
      keyName: 'missingKey',
      headerName: 'x-api-key',
      headerFormat: '{key}',
    });

    expect(await strategy.isValid()).toBe(false);
  });
});

describe('OAuthAuthStrategy', () => {
  let mockTokenManager;
  let config;

  beforeEach(() => {
    config = {};
    mockTokenManager = {
      hasValidToken: vi.fn(),
      getAccessToken: vi.fn(),
      refreshToken: vi.fn(),
    };
  });

  it('should return auth headers with Bearer token', async () => {
    mockTokenManager.hasValidToken.mockResolvedValue(true);
    mockTokenManager.getAccessToken.mockResolvedValue('test-access-token');

    const strategy = new OAuthAuthStrategy(config, mockTokenManager);
    const headers = await strategy.getAuthHeaders();

    expect(headers).toEqual({
      'Authorization': 'Bearer test-access-token',
    });
  });

  it('should refresh token if expired', async () => {
    mockTokenManager.hasValidToken.mockResolvedValue(false);
    mockTokenManager.refreshToken.mockResolvedValue(true);
    mockTokenManager.getAccessToken.mockResolvedValue('new-access-token');

    const strategy = new OAuthAuthStrategy(config, mockTokenManager);
    const headers = await strategy.getAuthHeaders();

    expect(mockTokenManager.refreshToken).toHaveBeenCalled();
    expect(headers).toEqual({
      'Authorization': 'Bearer new-access-token',
    });
  });

  it('should throw error if token expired and refresh fails', async () => {
    mockTokenManager.hasValidToken.mockResolvedValue(false);
    mockTokenManager.refreshToken.mockResolvedValue(false);

    const strategy = new OAuthAuthStrategy(config, mockTokenManager);

    await expect(strategy.getAuthHeaders()).rejects.toThrow(
      'OAuth token expired and could not be refreshed'
    );
  });

  it('should throw error if no token available', async () => {
    mockTokenManager.hasValidToken.mockResolvedValue(true);
    mockTokenManager.getAccessToken.mockResolvedValue(null);

    const strategy = new OAuthAuthStrategy(config, mockTokenManager);

    await expect(strategy.getAuthHeaders()).rejects.toThrow(
      'No valid OAuth token available'
    );
  });

  it('should validate token exists', async () => {
    mockTokenManager.hasValidToken.mockResolvedValue(true);

    const strategy = new OAuthAuthStrategy(config, mockTokenManager);
    expect(await strategy.isValid()).toBe(true);
  });

  it('should return false if no valid token', async () => {
    mockTokenManager.hasValidToken.mockResolvedValue(false);

    const strategy = new OAuthAuthStrategy(config, mockTokenManager);
    expect(await strategy.isValid()).toBe(false);
  });
});

describe('NoAuthStrategy', () => {
  it('should return empty auth headers', async () => {
    const strategy = new NoAuthStrategy({});
    const headers = await strategy.getAuthHeaders();

    expect(headers).toEqual({});
  });

  it('should always be valid', async () => {
    const strategy = new NoAuthStrategy({});
    expect(await strategy.isValid()).toBe(true);
  });

  it('should return strategy name', () => {
    const strategy = new NoAuthStrategy({});
    expect(strategy.getName()).toBe('NoAuthStrategy');
  });
});
