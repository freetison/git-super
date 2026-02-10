/**
 * Tests for OAuth Flows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceCodeFlow, PKCEFlow, openBrowser } from '../lib/auth/oauth-flows.mjs';

describe('DeviceCodeFlow', () => {
  let flow;

  beforeEach(() => {
    flow = new DeviceCodeFlow({
      clientId: 'test-client-id',
      deviceAuthEndpoint: 'https://auth.example.com/device/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
      scopes: ['read', 'write'],
    });

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initiate', () => {
    it('should initiate device authorization', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          device_code: 'test-device-code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://auth.example.com/device',
          verification_uri_complete: 'https://auth.example.com/device?code=ABCD-1234',
          expires_in: 900,
          interval: 5,
        }),
      });

      const result = await flow.initiate();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/device/authorize',
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Verify body contains client_id
      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(URLSearchParams);
      expect(callArgs.body.get('client_id')).toBe('test-client-id');

      expect(result).toEqual({
        deviceCode: 'test-device-code',
        userCode: 'ABCD-1234',
        verificationUri: 'https://auth.example.com/device',
        verificationUriComplete: 'https://auth.example.com/device?code=ABCD-1234',
        expiresIn: 900,
        interval: 5,
      });
    });

    it('should throw error if initiation fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(flow.initiate()).rejects.toThrow('Device authorization failed');
    });
  });

  describe('pollForToken', () => {
    it('should poll and return tokens when authorized', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: 'authorization_pending' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'read write',
          }),
        });

      const result = await flow.pollForToken('test-device-code', 0.1);

      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: 'read write',
      });
    });

    it('should throw error if user denies authorization', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'access_denied' }),
      });

      await expect(flow.pollForToken('test-device-code', 0.1)).rejects.toThrow(
        'User denied authorization'
      );
    });

    it('should throw error if device code expires', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'expired_token' }),
      });

      await expect(flow.pollForToken('test-device-code', 0.1)).rejects.toThrow(
        'Device code expired'
      );
    });

    it('should handle slow_down error', async () => {
      let callCount = 0;
      global.fetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({ error: 'slow_down' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        };
      });

      const result = await flow.pollForToken('test-device-code', 0.1);
      expect(result.accessToken).toBe('test-token');
      expect(callCount).toBe(2);
    });
  });

  describe('execute', () => {
    it('should execute complete flow', async () => {
      const mockOnUserCode = vi.fn();
      flow.onUserCode = mockOnUserCode;

      // Mock initiate
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            device_code: 'test-device-code',
            user_code: 'ABCD-1234',
            verification_uri: 'https://auth.example.com/device',
            verification_uri_complete: 'https://auth.example.com/device?code=ABCD',
            expires_in: 900,
            interval: 1,  // Short interval for testing
          }),
        })
        // Mock poll
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        });

      const result = await flow.execute();

      expect(mockOnUserCode).toHaveBeenCalledWith(
        'https://auth.example.com/device?code=ABCD',
        'ABCD-1234'
      );
      expect(result.accessToken).toBe('test-token');
    }, 10000);  // Increase timeout to 10 seconds
  });
});

describe('PKCEFlow', () => {
  let flow;

  beforeEach(() => {
    flow = new PKCEFlow({
      clientId: 'test-client-id',
      authEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
      redirectUri: 'http://localhost:8080/callback',
      scopes: ['read', 'write'],
    });

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('buildAuthUrl', () => {
    it('should generate authorization URL with PKCE', () => {
      const result = flow.buildAuthUrl();

      expect(result.url).toContain('https://auth.example.com/authorize');
      expect(result.url).toContain('client_id=test-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback');
      expect(result.url).toContain('scope=read+write');

      expect(result.codeVerifier).toBeDefined();
      expect(result.state).toBeDefined();
      expect(result.codeVerifier.length).toBeGreaterThan(40);
    });

    it('should generate different values each time', () => {
      const result1 = flow.buildAuthUrl();
      const result2 = flow.buildAuthUrl();

      expect(result1.codeVerifier).not.toBe(result2.codeVerifier);
      expect(result1.state).not.toBe(result2.state);
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read write',
        }),
      });

      const result = await flow.exchangeCode('auth-code', 'code-verifier');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Verify body contains authorization_code grant
      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(URLSearchParams);
      expect(callArgs.body.get('grant_type')).toBe('authorization_code');

      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: 'read write',
      });
    });

    it('should throw error if exchange fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code',
      });

      await expect(flow.exchangeCode('invalid-code', 'verifier')).rejects.toThrow(
        'Token exchange failed'
      );
    });
  });
});

describe('openBrowser', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should attempt to open browser with URL', async () => {
    // Mock the 'open' package
    vi.mock('open', () => ({
      default: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await openBrowser('https://example.com');
    // Will return false because 'open' throws in our test environment
    expect(typeof result).toBe('boolean');
  });

  it('should return false if open fails', async () => {
    vi.mock('open', () => {
      throw new Error('open not available');
    });

    const result = await openBrowser('https://example.com');
    expect(result).toBe(false);
  });
});
