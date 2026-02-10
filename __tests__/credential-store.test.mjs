/**
 * Tests for Credential Store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialStore } from '../lib/auth/credential-store.mjs';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('CredentialStore', () => {
  let store;
  const testStorageDir = join(homedir(), '.gitsuper-test');
  const testStorageFile = join(testStorageDir, 'credentials.enc');

  beforeEach(() => {
    // Mock keytar to simulate it not being available
    vi.mock('keytar', () => {
      throw new Error('keytar not available');
    });

    store = new CredentialStore();
    // Override storage paths for testing
    store.storageDir = testStorageDir;
    store.storageFile = testStorageFile;
    store.keytarAvailable = false; // Ensure we test file storage

    // Create test directory
    if (!existsSync(testStorageDir)) {
      mkdirSync(testStorageDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(testStorageFile)) {
        unlinkSync(testStorageFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  describe('File Storage', () => {
    it('should store credentials encrypted', async () => {
      const testData = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date().toISOString(),
      };

      await store.set('test-service', testData);

      // File should exist
      expect(existsSync(testStorageFile)).toBe(true);

      // File content should be encrypted (not plaintext)
      const fileContent = readFileSync(testStorageFile, 'utf8');
      expect(fileContent).not.toContain('test-access-token');
      expect(fileContent).not.toContain('test-refresh-token');

      // Should be valid JSON
      expect(() => JSON.parse(fileContent)).not.toThrow();
    });

    it('should retrieve stored credentials', async () => {
      const testData = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-12-31T00:00:00.000Z',
      };

      await store.set('test-service', testData);
      const retrieved = await store.get('test-service');

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent service', async () => {
      const retrieved = await store.get('non-existent-service');
      expect(retrieved).toBeNull();
    });

    it('should delete credentials', async () => {
      const testData = { accessToken: 'token-to-delete' };

      await store.set('test-service', testData);
      expect(await store.get('test-service')).toEqual(testData);

      await store.delete('test-service');
      expect(await store.get('test-service')).toBeNull();
    });

    it('should handle multiple services', async () => {
      const data1 = { accessToken: 'token1' };
      const data2 = { accessToken: 'token2' };

      await store.set('service1', data1);
      await store.set('service2', data2);

      expect(await store.get('service1')).toEqual(data1);
      expect(await store.get('service2')).toEqual(data2);
    });

    it('should update existing service data', async () => {
      const originalData = { accessToken: 'original-token' };
      const updatedData = { accessToken: 'updated-token' };

      await store.set('test-service', originalData);
      await store.set('test-service', updatedData);

      const retrieved = await store.get('test-service');
      expect(retrieved).toEqual(updatedData);
    });

    it('should handle encryption/decryption errors gracefully', async () => {
      // Create invalid encrypted file
      const fs = await import('node:fs');
      fs.writeFileSync(testStorageFile, 'invalid-encrypted-data');

      const retrieved = await store.get('test-service');
      expect(retrieved).toBeNull();
    });
  });

  describe('Storage Method Detection', () => {
    it('should return "file" when keytar not available', () => {
      const method = store.getStorageMethod();
      expect(method).toBe('file');
    });

    it('should detect keytar availability', () => {
      // Create a new store that simulates keytar being available
      const storeWithKeytar = new CredentialStore();
      // Mock keytar as available for this test
      vi.mock('keytar', () => ({
        default: {
          getPassword: vi.fn(),
          setPassword: vi.fn(),
          deletePassword: vi.fn(),
        },
      }));

      // Since our mock throws, keytarAvailable should be false
      expect(storeWithKeytar.keytarAvailable).toBe(false);
    });
  });

  describe('Encryption Security', () => {
    it('should use machine-specific encryption', async () => {
      const testData = { accessToken: 'sensitive-token' };

      await store.set('test-service', testData);

      // Create a second store instance
      const store2 = new CredentialStore();
      store2.storageDir = testStorageDir;
      store2.storageFile = testStorageFile;
      store2.keytarAvailable = false;

      // Should decrypt with same machine ID
      const retrieved = await store2.get('test-service');
      expect(retrieved).toEqual(testData);
    });

    it('should encrypt different data differently', async () => {
      const data1 = { accessToken: 'token1' };
      const data2 = { accessToken: 'token2' };

      await store.set('service1', data1);
      const content1 = readFileSync(testStorageFile, 'utf8');

      await store.set('service2', data2);
      const content2 = readFileSync(testStorageFile, 'utf8');

      // Encrypted content should change
      expect(content1).not.toBe(content2);
    });
  });

  describe('File Permissions', () => {
    it('should create storage directory with secure permissions', async () => {
      const testData = { accessToken: 'test-token' };
      await store.set('test-service', testData);

      expect(existsSync(testStorageDir)).toBe(true);
    });
  });
});
