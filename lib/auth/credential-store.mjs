/**
 * Secure Credential Storage
 * Stores OAuth tokens and sensitive data using OS keychain or encrypted file
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';

/**
 * Credential store with keychain fallback to encrypted file
 */
export class CredentialStore {
  constructor() {
    this.keytarAvailable = this._checkKeytar();
    this.storageDir = join(homedir(), '.gitsuper');
    this.storageFile = join(this.storageDir, 'credentials.enc');
    
    // Ensure storage directory exists
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Check if keytar is available
   * @private
   */
  _checkKeytar() {
    try {
      // Try to import keytar (optional dependency)
      // This will be installed separately by users who want OS keychain integration
      const keytar = require('keytar');
      return !!keytar;
    } catch {
      return false;
    }
  }

  /**
   * Get encryption key from machine-specific data
   * @private
   */
  _getEncryptionKey() {
    // Create a machine-specific key using hostname and homedir
    const { hostname } = require('node:os');
    const machineId = `${hostname()}-${homedir()}`;
    
    // Derive key using PBKDF2
    const salt = 'git-super-credential-store-v1';
    return pbkdf2Sync(machineId, salt, 100000, 32, 'sha256');
  }

  /**
   * Encrypt data
   * @private
   */
  _encrypt(data) {
    const key = this._getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted,
    };
  }

  /**
   * Decrypt data
   * @private
   */
  _decrypt(encrypted) {
    const key = this._getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Get credential from storage
   * @param {string} service - Service name (e.g., 'git-super-github-copilot')
   * @returns {Promise<Object|null>}
   */
  async get(service) {
    // Try keytar first if available
    if (this.keytarAvailable) {
      try {
        const keytar = require('keytar');
        const data = await keytar.getPassword(service, 'default');
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.warn(`Keytar read failed, falling back to file: ${error.message}`);
      }
    }

    // Fallback to encrypted file
    return this._getFromFile(service);
  }

  /**
   * Store credential
   * @param {string} service - Service name
   * @param {Object} data - Credential data
   */
  async set(service, data) {
    // Try keytar first if available
    if (this.keytarAvailable) {
      try {
        const keytar = require('keytar');
        await keytar.setPassword(service, 'default', JSON.stringify(data));
        return;
      } catch (error) {
        console.warn(`Keytar write failed, falling back to file: ${error.message}`);
      }
    }

    // Fallback to encrypted file
    this._setInFile(service, data);
  }

  /**
   * Delete credential
   * @param {string} service - Service name
   */
  async delete(service) {
    // Try keytar first if available
    if (this.keytarAvailable) {
      try {
        const keytar = require('keytar');
        await keytar.deletePassword(service, 'default');
      } catch (error) {
        console.warn(`Keytar delete failed: ${error.message}`);
      }
    }

    // Also delete from file
    this._deleteFromFile(service);
  }

  /**
   * Get from encrypted file
   * @private
   */
  _getFromFile(service) {
    if (!existsSync(this.storageFile)) {
      return null;
    }

    try {
      const content = readFileSync(this.storageFile, 'utf8');
      const allData = this._decrypt(JSON.parse(content));
      return allData[service] || null;
    } catch (error) {
      console.error(`Error reading credentials file: ${error.message}`);
      return null;
    }
  }

  /**
   * Set in encrypted file
   * @private
   */
  _setInFile(service, data) {
    let allData = {};

    // Read existing data
    if (existsSync(this.storageFile)) {
      try {
        const content = readFileSync(this.storageFile, 'utf8');
        allData = this._decrypt(JSON.parse(content));
      } catch (error) {
        console.warn(`Could not read existing credentials: ${error.message}`);
      }
    }

    // Update data
    allData[service] = data;

    // Encrypt and write
    const encrypted = this._encrypt(allData);
    writeFileSync(this.storageFile, JSON.stringify(encrypted), { mode: 0o600 });
  }

  /**
   * Delete from encrypted file
   * @private
   */
  _deleteFromFile(service) {
    if (!existsSync(this.storageFile)) {
      return;
    }

    try {
      const content = readFileSync(this.storageFile, 'utf8');
      const allData = this._decrypt(JSON.parse(content));
      
      delete allData[service];
      
      const encrypted = this._encrypt(allData);
      writeFileSync(this.storageFile, JSON.stringify(encrypted), { mode: 0o600 });
    } catch (error) {
      console.error(`Error deleting from credentials file: ${error.message}`);
    }
  }

  /**
   * Get storage method being used
   * @returns {string} 'keytar' or 'file'
   */
  getStorageMethod() {
    return this.keytarAvailable ? 'keytar' : 'file';
  }
}
