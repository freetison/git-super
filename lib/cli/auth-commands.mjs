/**
 * CLI Authentication Commands
 * Handles auth login, logout, status, and context management
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { getConfigPath, listOrganizations, loadConfig } from '../config/config-loader.mjs';
import { ProviderRegistry } from '../providers/provider-registry.mjs';
import { openBrowser } from '../auth/oauth-flows.mjs';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Handle 'auth login' command
 */
export async function handleAuthLogin(args) {
  const providerName = args.provider || args.p;
  const orgId = args.org || args.o;

  if (!providerName) {
    log('Usage: git super auth login --provider <name> [--org <org-id>]', 'yellow');
    log('\nAvailable OAuth providers:', 'bright');
    log('  • github-copilot     GitHub Copilot Enterprise', 'cyan');
    log('  • azure-openai       Azure OpenAI with Azure AD', 'cyan');
    log('  • generic-oidc       Generic OIDC provider', 'cyan');
    return;
  }

  try {
    // Load config for the specified org (if provided)
    let config = loadConfig();
    
    if (orgId && config.organizations) {
      const orgConfig = config.organizations[orgId];
      if (!orgConfig) {
        throw new Error(`Organization '${orgId}' not found in config`);
      }
      config = { ...config, ...orgConfig };
      log(`\n🏢 Using organization: ${orgConfig.name || orgId}`, 'cyan');
    }

    // Get provider instance
    const registry = new ProviderRegistry(config);
    
    // Create provider if not in registry (force initialization)
    let provider;
    try {
      provider = registry.get(providerName);
    } catch {
      // Provider not auto-registered, try to create it manually
      const { GitHubCopilotProvider } = await import('../providers/github-copilot-provider.mjs');
      const { AzureOpenAIProvider } = await import('../providers/azure-openai-provider.mjs');
      const { GenericOIDCProvider } = await import('../providers/generic-oidc-provider.mjs');
      
      switch (providerName) {
        case 'github-copilot':
          provider = new GitHubCopilotProvider(config);
          break;
        case 'azure-openai':
          provider = new AzureOpenAIProvider(config);
          break;
        case 'generic-oidc':
          provider = new GenericOIDCProvider(config);
          break;
        default:
          throw new Error(`Provider '${providerName}' is not an OAuth provider or doesn't exist`);
      }
    }

    if (!provider.initiateAuth) {
      throw new Error(`Provider '${providerName}' does not support OAuth authentication`);
    }

    log(`\n🔐 Initiating OAuth authentication for ${providerName}...`, 'bright');
    
    // Step 1: Initiate device code flow
    const deviceAuth = await provider.initiateAuth();
    
    // Step 2: Display code to user
    log(`\n📝 User Code: ${colors.bright}${deviceAuth.userCode}${colors.reset}`, 'green');
    log(`\n🌐 Verification URL: ${colors.cyan}${deviceAuth.verificationUri}${colors.reset}`);
    
    // Try to open browser
    const opened = await openBrowser(deviceAuth.verificationUriComplete || deviceAuth.verificationUri);
    
    if (opened) {
      log('\n✅ Browser opened. Please complete authentication in your browser.', 'green');
    } else {
      log('\n⚠️  Could not open browser automatically. Please open the URL above manually.', 'yellow');
    }
    
    log(`\n⏳ Waiting for authorization (expires in ${Math.floor(deviceAuth.expiresIn / 60)} minutes)...`, 'cyan');
    
    // Step 3: Poll for token
    await provider.completeAuth(deviceAuth.deviceCode, deviceAuth.interval);
    
    log('\n✅ Authentication successful!', 'green');
    
    // Show token info
    const tokenInfo = await provider.tokenManager.getTokenInfo();
    if (tokenInfo?.expiresAt) {
      const expiresAt = new Date(tokenInfo.expiresAt);
      log(`   Token valid until: ${expiresAt.toLocaleString()}`, 'cyan');
    }
    
    log(`\n💡 You can now use: git super`, 'bright');
    
  } catch (error) {
    log(`\n❌ Authentication failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Handle 'auth logout' command
 */
export async function handleAuthLogout(args) {
  const providerName = args.provider || args.p;
  const all = args.all || args.a;

  const config = loadConfig();
  const registry = new ProviderRegistry(config);

  try {
    if (all) {
      // Logout from all OAuth providers
      log('\n🔓 Logging out from all providers...', 'yellow');
      
      for (const [name, provider] of registry.providers) {
        if (provider.tokenManager) {
          try {
            await provider.tokenManager.revokeToken();
            log(`   ✅ ${name}`, 'green');
          } catch (error) {
            log(`   ⚠️  ${name}: ${error.message}`, 'yellow');
          }
        }
      }
      
      log('\n✅ Logged out from all providers', 'green');
    } else if (providerName) {
      // Logout from specific provider
      const provider = registry.get(providerName);
      
      if (!provider.tokenManager) {
        throw new Error(`Provider '${providerName}' does not use OAuth authentication`);
      }
      
      log(`\n🔓 Logging out from ${providerName}...`, 'yellow');
      await provider.tokenManager.revokeToken();
      log('✅ Successfully logged out', 'green');
    } else {
      // Logout from current provider
      const currentProvider = registry.get(config.aiProvider);
      
      if (!currentProvider.tokenManager) {
        throw new Error(`Current provider '${config.aiProvider}' does not use OAuth authentication`);
      }
      
      log(`\n🔓 Logging out from ${config.aiProvider}...`, 'yellow');
      await currentProvider.tokenManager.revokeToken();
      log('✅ Successfully logged out', 'green');
    }
  } catch (error) {
    log(`\n❌ Logout failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Handle 'auth status' command
 */
export async function handleAuthStatus() {
  const config = loadConfig();
  const registry = new ProviderRegistry(config);

  log('\n📊 Authentication Status\n', 'bright');
  
  // Show active context
  if (config.activeOrg) {
    const orgConfig = config.organizations?.[config.activeOrg];
    log(`Active Context: ${colors.cyan}${orgConfig?.name || config.activeOrg}${colors.reset}`);
  }
  
  log(`Current Provider: ${colors.cyan}${config.aiProvider}${colors.reset}`);
  log(`Model: ${colors.cyan}${config.aiModel}${colors.reset}\n`);

  // Check each OAuth provider
  for (const [name, provider] of registry.providers) {
    if (provider.tokenManager) {
      const tokenInfo = await provider.tokenManager.getTokenInfo();
      
      if (tokenInfo?.hasToken) {
        const status = tokenInfo.isValid ? '✅' : '❌';
        const statusText = tokenInfo.isValid ? 'Valid' : 'Expired';
        const expiresAt = tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString() : 'N/A';
        
        log(`${status} ${colors.bright}${name}${colors.reset}: ${statusText}`, tokenInfo.isValid ? 'green' : 'red');
        log(`   Expires: ${expiresAt}`, 'cyan');
      } else {
        log(`⚪ ${colors.bright}${name}${colors.reset}: Not authenticated`, 'yellow');
      }
    } else {
      // API key provider
      if (name === config.aiProvider) {
        const hasKey = await provider.authStrategy?.isValid();
        const status = hasKey ? '✅' : '❌';
        const statusText = hasKey ? 'API key configured' : 'No API key';
        log(`${status} ${colors.bright}${name}${colors.reset}: ${statusText}`, hasKey ? 'green' : 'red');
      }
    }
  }
  
  console.log();
}

/**
 * Handle 'context' commands
 */
export async function handleContext(args) {
  const subcommand = args._[1]; // 'list', 'switch', 'create'
  const config = loadConfig();

  switch (subcommand) {
    case 'list':
    case 'ls':
      handleContextList();
      break;
      
    case 'switch':
    case 'sw':
      handleContextSwitch(args);
      break;
      
    case 'create':
      log('Context creation wizard not yet implemented', 'yellow');
      log('For now, edit ~/.gitsuperrc manually to add new contexts', 'cyan');
      break;
      
    default:
      // No subcommand: show current context
      handleContextCurrent();
  }
}

function handleContextList() {
  const orgs = listOrganizations();
  
  if (orgs.length === 0) {
    log('\n⚠️  No organizations configured', 'yellow');
    log('Add organizations to ~/.gitsuperrc to use multi-context mode\n', 'cyan');
    return;
  }
  
  log('\n📋 Available Contexts:\n', 'bright');
  
  for (const org of orgs) {
    const marker = org.isActive ? '* ' : '  ';
    const color = org.isActive ? 'green' : 'cyan';
    log(`${marker}${colors[color]}${org.id}${colors.reset} (${org.name})`, color);
    log(`   Provider: ${org.aiProvider}/${org.aiModel}`, 'cyan');
  }
  
  console.log();
}

function handleContextCurrent() {
  const config = loadConfig();
  
  log('\n📍 Current Context\n', 'bright');
  
  if (config.activeOrg) {
    const orgConfig = config.organizations?.[config.activeOrg];
    log(`Organization: ${colors.cyan}${orgConfig?.name || config.activeOrg}${colors.reset}`);
  } else {
    log('Mode: Legacy (no organizations)', 'yellow');
  }
  
  log(`Provider: ${colors.cyan}${config.aiProvider}${colors.reset}`);
  log(`Model: ${colors.cyan}${config.aiModel}${colors.reset}`);
  
  console.log();
}

function handleContextSwitch(args) {
  const targetOrg = args._[2] || args.org || args.o;
  
  if (!targetOrg) {
    log('Usage: git super context switch <org-id>', 'yellow');
    return;
  }
  
  try {
    const configPath = getConfigPath();
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    if (!config.organizations || !config.organizations[targetOrg]) {
      throw new Error(`Organization '${targetOrg}' not found`);
    }
    
    // Update active org
    config.activeOrg = targetOrg;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    const orgConfig = config.organizations[targetOrg];
    log(`\n✅ Switched to: ${colors.green}${orgConfig.name || targetOrg}${colors.reset}`, 'green');
    log(`   Provider: ${orgConfig.aiProvider}/${orgConfig.aiModel}`, 'cyan');
    console.log();
    
  } catch (error) {
    log(`\n❌ Failed to switch context: ${error.message}`, 'red');
    process.exit(1);
  }
}
