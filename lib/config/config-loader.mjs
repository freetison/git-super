/**
 * Configuration loader with layered approach (no if-else chains)
 * Layers: defaults → file config → environment variables
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Map environment variables to config keys
 */
const ENV_MAPPINGS = {
  aiProvider: 'AI_PROVIDER',
  aiModel: 'AI_MODEL',
  ollamaUrl: 'OLLAMA_URL',
  anthropicKey: 'ANTHROPIC_API_KEY',
  openaiKey: 'OPENAI_API_KEY',
  
  // OAuth / Enterprise configs
  githubOrg: 'GITHUB_ORG',
  githubClientId: 'GITHUB_CLIENT_ID',
  azureTenantId: 'AZURE_TENANT_ID',
  azureClientId: 'AZURE_CLIENT_ID',
  azureResourceEndpoint: 'AZURE_OPENAI_ENDPOINT',
  oidcIssuer: 'OIDC_ISSUER',
  oidcClientId: 'OIDC_CLIENT_ID',
  oidcApiEndpoint: 'OIDC_API_ENDPOINT',
  
  // Active organization context
  activeOrg: 'GIT_SUPER_ACTIVE_ORG',
};

/**
 * Default configuration values
 */
function getDefaults() {
  return {
    aiProvider: 'ollama',
    aiModel: 'mistral:latest',
    ollamaUrl: 'http://localhost:11434',
    messageTemplate: null,
    ticketNumber: '',
    commitRules: {
      types: ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'build'],
      maxLength: 72,
      allowEmptyScope: true
    }
  };
}

/**
 * Load configuration from file
 */
function loadFileConfig(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Error reading config file: ${error.message}`);
    return {};
  }
}

/**
 * Apply environment variable overrides using object mapping
 */
function applyEnvOverrides(config) {
  const overrides = {};
  
  Object.entries(ENV_MAPPINGS).forEach(([key, envVar]) => {
    const value = process.env[envVar];
    if (value !== undefined) {
      overrides[key] = value;
    }
  });
  
  return { ...config, ...overrides };
}

/**
 * Load configuration with layered approach
 * Priority: ENV vars > file config > defaults
 * 
 * Supports two modes:
 * 1. Legacy mode: flat config (backward compatible)
 * 2. Multi-org mode: organizations with active context
 */
export function loadConfig() {
  const configPath = join(homedir(), '.gitsuperrc');
  
  // Layer 1: Defaults
  let config = getDefaults();
  
  // Layer 2: File config
  const fileConfig = loadFileConfig(configPath);
  
  // Check if using multi-org configuration
  if (fileConfig.organizations) {
    // Multi-org mode: load active organization context
    const activeOrg = fileConfig.activeOrg || Object.keys(fileConfig.organizations)[0];
    const orgConfig = fileConfig.organizations[activeOrg];
    
    if (orgConfig) {
      // Merge: defaults <- org config <- global fallbacks
      config = {
        ...config,
        ...orgConfig,
        activeOrg,
        organizations: fileConfig.organizations, // Keep for context switching
      };
    } else {
      console.warn(`⚠️  Active organization '${activeOrg}' not found in config, using defaults`);
    }
  } else {
    // Legacy mode: flat config (backward compatible)
    config = { ...config, ...fileConfig };
  }
  
  // Layer 3: Environment variables (highest priority)
  config = applyEnvOverrides(config);
  
  return config;
}

/**
 * Get configuration path
 * @returns {string}
 */
export function getConfigPath() {
  return join(homedir(), '.gitsuperrc');
}

/**
 * List all available organizations from config
 * @returns {Array<Object>} Array of { id, name, aiProvider, aiModel }
 */
export function listOrganizations() {
  const configPath = getConfigPath();
  const fileConfig = loadFileConfig(configPath);
  
  if (!fileConfig.organizations) {
    return [];
  }
  
  return Object.entries(fileConfig.organizations).map(([id, org]) => ({
    id,
    name: org.name || id,
    aiProvider: org.aiProvider || 'ollama',
    aiModel: org.aiModel || 'unknown',
    isActive: id === fileConfig.activeOrg,
  }));
}

/**
 * Get active organization ID
 * @returns {string|null}
 */
export function getActiveOrg() {
  const configPath = getConfigPath();
  const fileConfig = loadFileConfig(configPath);
  return fileConfig.activeOrg || null;
}
