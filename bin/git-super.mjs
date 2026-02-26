#!/usr/bin/env node
/**
 * @theia-core/git-super - AI-powered git commits with customizable templates
 * 
 * Automates: git add . → AI-generated commit → git push
 * Works with ANY git repository (Node.js, Python, Java, C++, etc.)
 * 
 * Usage:
 *   git super              # add + commit + push
 *   git super --no-push    # add + commit only (no push)
 *   git super --dry-run    # preview message without committing
 *   git super --amend      # amend last commit with new AI message
 *   git super --no-verify  # skip pre-commit hooks (not recommended)
 *   git super --init       # create config file with defaults
 * 
 * Installation:
 *   npm install -g @theia-core/git-super
 *   git config --global alias.super '!git-super'
 *   git super --init  # Optional: customize config
 * 
 * Configuration:
 *   Edit ~/.gitsuperrc to customize:
 *   - Message templates (Jira, Linear, GitHub issues)
 *   - Commit types and max length
 *   - AI provider defaults
 * 
 * Environment Variables:
 *   AI_PROVIDER   - AI provider: 'ollama' (default), 'anthropic', 'openai'
 *   AI_MODEL      - Model to use (default: 'mistral:latest' for Ollama)
 *   OLLAMA_URL    - Ollama API URL (default: http://localhost:11434)
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Import refactored modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { loadConfig } from '../lib/config/config-loader.mjs';
import { ProviderRegistry } from '../lib/providers/provider-registry.mjs';
import { FallbackResolver } from '../lib/fallback/fallback-resolver.mjs';
import { handleAuthLogin, handleAuthLogout, handleAuthStatus, handleContext } from '../lib/cli/auth-commands.mjs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = loadConfig();
const providerRegistry = new ProviderRegistry(CONFIG);
const fallbackResolver = new FallbackResolver();

// Parse command line args
const args = process.argv.slice(2);

// Check for auth/context commands first (before flags parsing)
const command = args[0];
if (command === 'auth') {
  const subcommand = args[1];
  const parsedArgs = parseArgs(args.slice(2));
  parsedArgs._ = [command, subcommand];
  
  (async () => {
    switch (subcommand) {
      case 'login':
        await handleAuthLogin(parsedArgs);
        break;
      case 'logout':
        await handleAuthLogout(parsedArgs);
        break;
      case 'status':
        await handleAuthStatus();
        break;
      default:
        log('Usage: git super auth <login|logout|status>', 'yellow');
        log('\nCommands:', 'bright');
        log('  login   --provider <name> [--org <id>]  Authenticate with OAuth provider', 'cyan');
        log('  logout  [--provider <name>] [--all]     Log out from provider(s)', 'cyan');
        log('  status                                   Show authentication status', 'cyan');
    }
    process.exit(0);
  })();
} else if (command === 'context' || command === 'ctx') {
  const parsedArgs = parseArgs(args.slice(1));
  parsedArgs._ = [command, ...parsedArgs._];
  
  handleContext(parsedArgs);
  process.exit(0);
}

// Traditional flags for normal git super flow
const flags = {
  dryRun: args.includes('--dry-run'),
  noPush: args.includes('--no-push'),
  amend: args.includes('--amend'),
  noVerify: args.includes('--no-verify') || args.includes('-no-verify'),
  init: args.includes('--init'),
  help: args.includes('--help') || args.includes('-h'),
  all: args.includes('--all'),
};

// Simple args parser for auth commands
function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

// ============================================================================
// UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    if (options.silent) {
      return null;
    }
    throw error;
  }
}

function getRepoName() {
  try {
    const remote = exec('git config --get remote.origin.url', { silent: true });
    if (remote) {
      return basename(remote.trim().replace(/\.git$/, ''));
    }
  } catch {}
  
  return basename(process.cwd());
}

function hasChanges() {
  const status = exec('git status --porcelain', { silent: true });
  return status && status.trim().length > 0;
}

function getGitDiff() {
  try {
    // Get staged changes (most important)
    const staged = exec('git diff --cached', { silent: true }) || '';
    
    // Get unstaged changes
    const unstaged = exec('git diff', { silent: true }) || '';
    
    // Get status with renames and file types
    const status = exec('git status --short', { silent: true }) || '';
    
    // For better context, also get summary stats
    const statSummary = exec('git diff --cached --stat', { silent: true }) || '';
    
    // Combine diff with stat summary for better AI context
    let combinedDiff = staged || unstaged;
    
    // If diff is empty but we have status, append stat summary
    if (combinedDiff.trim().length === 0 && statSummary.trim().length > 0) {
      combinedDiff = `Stat summary:\n${statSummary}\n\n${combinedDiff}`;
    }
    
    return {
      diff: combinedDiff,
      status,
      hasStaged: staged.length > 0,
      hasUnstaged: unstaged.length > 0,
    };
  } catch (error) {
    return { diff: '', status: '', hasStaged: false, hasUnstaged: false };
  }
}

// ============================================================================
// TEMPLATE HELPERS
// ============================================================================

function extractType(msg) {
  const match = msg.match(/^(\w+)(?:\(|:)/);
  return match ? match[1] : 'chore';
}

function extractScope(msg) {
  const match = msg.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
}

function applyTemplate(message, template) {
  if (!template) return message;
  
  const type = extractType(message);
  const scope = extractScope(message);
  
  // Extract just the description part
  let description = message;
  const typeScorMatch = message.match(/^[^:]+:\s*(.+)$/);
  if (typeScorMatch) {
    description = typeScorMatch[1];
  }
  
  return template
    .replace('{message}', description)
    .replace('{type}', type)
    .replace('{scope}', scope)
    .replace('{ticket}', CONFIG.ticketNumber || '');
}

// ============================================================================
// AI PROVIDERS
// ============================================================================

async function generateCommitMessage(diff, status, repoName) {
  // Extract filenames and analyze change types
  const lines = status.split('\n').filter(l => l.trim());
  const files = lines.map(l => l.substring(3).trim()).slice(0, 10);
  
  // Calculate statistics for better prompt context
  const stats = {
    added: lines.filter(l => l.startsWith('A ')).length,
    modified: lines.filter(l => l.startsWith('M ') || l.startsWith(' M')).length,
    deleted: lines.filter(l => l.startsWith('D ')).length,
  };
  
  const totalFiles = stats.added + stats.modified + stats.deleted;
  
  // Build change summary for AI context
  const changeSummary = [];
  if (stats.added > 0) changeSummary.push(`${stats.added} added`);
  if (stats.modified > 0) changeSummary.push(`${stats.modified} modified`);
  if (stats.deleted > 0) changeSummary.push(`${stats.deleted} deleted`);
  
  const hasTemplate = CONFIG.messageTemplate && CONFIG.messageTemplate.includes('{message}');
  
  const prompt = `Generate a git commit message following Conventional Commits format.

Repository: ${repoName}
Change summary: ${totalFiles} files changed (${changeSummary.join(', ')})

Files changed (first 10):
${files.join('\n')}

Diff (first 6000 chars):
${diff.substring(0, 6000)}

${diff.trim().length === 0 ? 'Note: Diff is empty (likely file deletions or binary changes). Use file list and change summary above.' : ''}

Rules:
- Format: ${hasTemplate ? 'type(scope): description (will be inserted in template)' : 'type(scope): description'}
- Types: ${CONFIG.commitRules.types.join(', ')}
- Max ${CONFIG.commitRules.maxLength} characters
- Focus on WHAT changed, not HOW
- Be specific but concise
- NO quotes, NO explanations, NO extra text
- ALWAYS generate a message, even if diff is empty

Output ONLY the commit message:`;

  log('🤖 Generating AI message...', 'cyan');
  
  try {
    // Use Strategy Pattern - get provider from registry
    const provider = providerRegistry.get(CONFIG.aiProvider);
    let message = await provider.generate(prompt);
    
    // Validate message is not empty/invalid
    // Clean common quote patterns and whitespace
    const cleanedMessage = message.replace(/^["'`]+|["'`]+$/g, '').trim();
    
    if (!cleanedMessage || cleanedMessage.length === 0) {
      throw new Error('AI returned empty or invalid message');
    }
    
    // Apply template if configured
    if (CONFIG.messageTemplate) {
      message = applyTemplate(message, CONFIG.messageTemplate);
    }
    
    // Validate length
    if (message.length > CONFIG.commitRules.maxLength) {
      log(`⚠️  Message too long (${message.length}>${CONFIG.commitRules.maxLength}), truncating`, 'yellow');
      message = message.substring(0, CONFIG.commitRules.maxLength);
    }
    
    return message;
    
  } catch (error) {
    log(`⚠️  Error generating message: ${error.message}`, 'yellow');
    
    // Use Strategy Pattern for fallback selection
    const lines = status.split('\n').filter(l => l.trim());
    const stats = {
      added: lines.filter(l => l.startsWith('A ')).length,
      modified: lines.filter(l => l.startsWith('M ')).length,
      deleted: lines.filter(l => l.startsWith('D ')).length,
    };
    
    let fallback = fallbackResolver.resolve(stats);
    
    // Apply template to fallback too
    if (CONFIG.messageTemplate) {
      fallback = applyTemplate(fallback, CONFIG.messageTemplate);
    }
    
    log(`Using fallback message: "${fallback}"`, 'yellow');
    return fallback;
  }
}

// ============================================================================
// AI Provider implementations moved to lib/providers/
// - OllamaProvider: lib/providers/ollama-provider.mjs
// - AnthropicProvider: lib/providers/anthropic-provider.mjs
// - OpenAIProvider: lib/providers/openai-provider.mjs
// ============================================================================

// ============================================================================
// INIT CONFIG
// ============================================================================

function initConfig() {
  const configPath = join(homedir(), '.gitsuperrc');
  
  if (existsSync(configPath)) {
    log('\n⚠️  Config already exists:', 'yellow');
    log(`   ${configPath}\n`, 'bright');
    
    try {
      const current = JSON.parse(readFileSync(configPath, 'utf-8'));
      log(JSON.stringify(current, null, 2), 'cyan');
    } catch (error) {
      log(`Error reading config: ${error.message}`, 'red');
    }
    
    log('\n💡 Edit manually or delete to recreate\n', 'yellow');
    return;
  }
  
  const template = {
    "$comment": "git-super configuration - Edit this file to customize behavior",
    "aiProvider": "ollama",
    "aiModel": "mistral:latest",
    "ollamaUrl": "http://localhost:11434",
    "messageTemplate": null,
    "ticketNumber": "",
    "commitRules": {
      "types": ["feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build"],
      "maxLength": 72,
      "allowEmptyScope": true
    },
    "_examples": {
      "$comment": "Copy one of these to 'messageTemplate' above",
      "jira": "VTT-3020: {type}({scope}): {message}",
      "linear": "LIN-{ticket}: {type}({scope}): {message}",
      "github": "#{ticket}: {type}({scope}): {message}",
      "simple": "{type}: {message}",
      "default": null
    }
  };
  
  log('\n📝 Creating config at:', 'cyan');
  log(`   ${configPath}\n`, 'bright');
  
  try {
    writeFileSync(configPath, JSON.stringify(template, null, 2));
    
    log('✅ Config file created!\n', 'green');
    log('Edit to customize:', 'cyan');
    log('  • messageTemplate - Add Jira/Linear/GitHub prefixes', 'blue');
    log('  • commitRules     - Customize types and max length', 'blue');
    log('  • aiProvider      - Change AI provider (ollama/anthropic/openai)', 'blue');
    log('\nExample template:', 'bright');
    log('  "messageTemplate": "VTT-3020: {type}({scope}): {message}"', 'cyan');
    log('\nVariables:', 'bright');
    log('  {message} - AI-generated description', 'blue');
    log('  {type}    - Commit type (feat, fix, etc.)', 'blue');
    log('  {scope}   - Commit scope (if any)', 'blue');
    log('  {ticket}  - Value from ticketNumber config', 'blue');
    log(`\n📄 File: ${configPath}\n`, 'magenta');
  } catch (error) {
    log(`\n❌ Error creating config: ${error.message}`, 'red');
    process.exit(1);
  }
}

// ============================================================================
// --all: RUN GIT-SUPER ACROSS ALL REPOS IN WORKSPACE
// ============================================================================

/**
 * Scan `root` for git repositories up to `maxDepth` directory levels deep.
 * Does NOT recurse into a found git repo (avoids nested repos).
 * Skips hidden dirs and node_modules.
 */
function findGitRepos(root, maxDepth = 3) {
  const repos = [];
  function scan(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const isRepo = entries.some((e) => e.isDirectory() && e.name === '.git');
    if (isRepo && depth > 0) {
      // Found a sub-repo — add it and don't recurse further inside it
      repos.push(dir);
      return;
    }
    // Always recurse from root (depth 0), and into non-repo dirs
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        scan(join(dir, entry.name), depth + 1);
      }
    }
  }
  scan(root, 0);
  return repos;
}

async function runAll() {
  log('\n✨ git-super --all: scanning workspace for repos...\n', 'cyan');

  const root = process.cwd();
  const repos = findGitRepos(root, 3);

  if (repos.length === 0) {
    log('ℹ️  No git repositories found (depth ≤ 3)', 'yellow');
    process.exit(0);
  }

  log(`📦 Found ${repos.length} repo(s):\n`, 'bright');
  repos.forEach((r) => log(`   ${r.replace(root, '.')}`, 'blue'));
  log('');

  // Forward relevant flags (except --all itself), normalizing single-dash long flags
  const passForward = args
    .filter((a) => a !== '--all')
    .map((a) => (a === '-no-verify' ? '--no-verify' : a));

  const results = { ok: [], skipped: [], failed: [] };

  for (const repo of repos) {
    const label = repo.replace(root, '.') || '.';
    log(`\n${'─'.repeat(60)}`, 'cyan');
    log(`📂 ${label}`, 'bright');

    const result = spawnSync(process.execPath, [__filename, ...passForward], {
      cwd: repo,
      stdio: 'inherit',
      env: process.env,
    });

    if (result.status === 0) {
      results.ok.push(label);
    } else if (result.status === null) {
      log(`⚠️  Spawn error in ${label}`, 'yellow');
      results.failed.push(label);
    } else {
      // exit code > 0 usually means "nothing to commit" or a real error — skip
      results.skipped.push(label);
    }
  }

  // Summary
  log(`\n${'═'.repeat(60)}`, 'cyan');
  log('\n📊 Summary:', 'bright');
  log(`   ✅ Committed+pushed : ${results.ok.length}`, 'green');
  log(`   ⏭️  Skipped (no changes): ${results.skipped.length}`, 'yellow');
  if (results.failed.length) {
    log(`   ❌ Errors           : ${results.failed.length}`, 'red');
    results.failed.forEach((r) => log(`      • ${r}`, 'red'));
  }
  log('');
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function showHelp() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║          git-super - AI-Powered Git Commits         ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');
  
  log('Usage:', 'bright');
  log('  git super              # Stage, commit with AI message, push', 'blue');
  log('  git super --init       # Create config file with defaults', 'blue');
  log('  git super --dry-run    # Preview AI message without committing', 'blue');
  log('  git super --no-push    # Commit but don\'t push', 'blue');
  log('  git super --amend      # Amend last commit with new AI message', 'blue');
  log('  git super --no-verify  # Skip pre-commit hooks', 'blue');
  log('  git super --all        # Run on every repo found in workspace (depth ≤ 3)', 'blue');
  log('  git super --help       # Show this help\n', 'blue');
  
  log('Authentication (OAuth/SSO):', 'bright');
  log('  git super auth login --provider <name>  # Authenticate with OAuth', 'blue');
  log('  git super auth status                   # Show auth status', 'blue');
  log('  git super auth logout [--provider name] # Log out', 'blue');
  log('', '');
  log('  OAuth Providers:', 'cyan');
  log('    • github-copilot    GitHub Copilot Enterprise', 'blue');
  log('    • azure-openai      Azure OpenAI with Azure AD', 'blue');
  log('    • generic-oidc      Generic OIDC provider\n', 'blue');
  
  log('Multi-Organization Context:', 'bright');
  log('  git super context              # Show current context', 'blue');
  log('  git super context list         # List all contexts', 'blue');
  log('  git super context switch <id>  # Switch to context\n', 'blue');
  
  log('Configuration:', 'bright');
  log('  Edit ~/.gitsuperrc to customize:', 'blue');
  log('  • Message templates (Jira, Linear, GitHub issues)', 'blue');
  log('  • Commit types and max length', 'blue');
  log('  • AI provider defaults', 'blue');
  log('  • Multiple organization contexts (enterprise)\n', 'blue');
  
  log('Environment Variables:', 'bright');
  log('  API Key Providers:', 'cyan');
  log('    AI_PROVIDER         - ollama, anthropic, openai', 'blue');
  log('    AI_MODEL            - model name/version', 'blue');
  log('    OLLAMA_URL          - http://localhost:11434 (default)', 'blue');
  log('    ANTHROPIC_API_KEY   - Anthropic API key', 'blue');
  log('    OPENAI_API_KEY      - OpenAI API key', 'blue');
  log('', '');
  log('  OAuth/Enterprise:', 'cyan');
  log('    GITHUB_ORG          - GitHub organization', 'blue');
  log('    AZURE_TENANT_ID     - Azure AD tenant ID', 'blue');
  log('    AZURE_CLIENT_ID     - Azure application client ID', 'blue');
  log('    AZURE_OPENAI_ENDPOINT - Azure OpenAI resource endpoint', 'blue');
  log('    OIDC_ISSUER         - OIDC issuer URL', 'blue');
  log('    OIDC_CLIENT_ID      - OIDC client ID\n', 'blue');
  
  log('Examples:', 'bright');
  log('  # Basic usage (Ollama local)', 'blue');
  log('  git super\n', 'green');
  
  log('  # Authenticate with Azure OpenAI (enterprise)', 'blue');
  log('  git super auth login --provider azure-openai', 'green');
  log('  git super  # Now uses Azure OpenAI with SSO\n', 'green');
  
  log('  # Setup custom templates', 'blue');
  log('  git super --init', 'green');
  log('  # Edit ~/.gitsuperrc: "messageTemplate": "VTT-3020: {type}: {message}"', 'cyan');
  log('  git super  # Now all commits have VTT-3020 prefix\n', 'green');
  
  log('  # Preview message', 'blue');
  log('  git super --dry-run\n', 'green');
  
  log('  # Use Claude', 'blue');
  log('  AI_PROVIDER=anthropic git super\n', 'green');
  
  log('  # Use different Ollama model', 'blue');
  log('  AI_MODEL=qwen2.5-coder git super\n', 'green');
  
  log('Installation:', 'bright');
  log('  npm install -g @theia-core/git-super', 'blue');
  log('  git config --global alias.super \'!git-super\'', 'blue');
  log('  git super --init  # Optional: customize config\n', 'blue');
  
  log('Works with ANY git repo (Node.js, Python, Java, C++, etc.)\n', 'cyan');
}

async function main() {
  if (flags.init) {
    initConfig();
    process.exit(0);
  }

  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  if (flags.all) {
    await runAll();
    process.exit(0);
  }

  log('\n✨ git-super - AI-powered commits\n', 'cyan');

  // Check if in git repo
  try {
    exec('git rev-parse --git-dir', { silent: true });
  } catch {
    log('❌ Not a git repository', 'red');
    process.exit(1);
  }

  const repoName = getRepoName();
  log(`📦 Repository: ${repoName}`, 'blue');

  // Check for changes
  if (!hasChanges()) {
    log('ℹ️  No changes to commit', 'yellow');
    process.exit(0);
  }

  try {
    // Stage all changes if not amending
    if (!flags.amend) {
      log('\n→ git add .', 'bright');
      exec('git add .');
    }

    // Get diff
    const { diff, status, hasStaged, hasUnstaged } = getGitDiff();

    if (!diff || (!hasStaged && !flags.amend)) {
      log('ℹ️  No changes to commit', 'yellow');
      process.exit(0);
    }

    // Generate commit message
    const message = await generateCommitMessage(diff, status, repoName);
    log(`\n📝 Commit message:\n`, 'magenta');
    log(`   "${message}"\n`, 'bright');

    // Dry run - stop here
    if (flags.dryRun) {
      log('🔍 Dry run mode - no commit made', 'yellow');
      process.exit(0);
    }

    // Commit
    const commitFlags = [];
    if (flags.amend) commitFlags.push('--amend');
    if (flags.noVerify) commitFlags.push('--no-verify');
    
    const commitCmd = `git commit ${commitFlags.join(' ')} -m "${message.replace(/"/g, '\\"')}"`;
    log(`→ git commit${flags.amend ? ' --amend' : ''}${flags.noVerify ? ' --no-verify' : ''}`, 'bright');
    
    try {
      exec(commitCmd);
    } catch (error) {
      log('\n❌ Commit failed (possibly rejected by pre-commit hooks)', 'red');
      process.exit(1);
    }

    log('✅ Commit successful', 'green');

    // Push
    if (!flags.noPush && !flags.amend) {
      log('\n→ git push origin HEAD', 'bright');
      try {
        exec('git push origin HEAD');
        log('✅ Push successful', 'green');
      } catch (error) {
        log('❌ Push failed', 'red');
        log('Commit was successful but push failed. Run git push manually.', 'yellow');
        process.exit(1);
      }
    } else if (flags.amend) {
      log('\n💡 Tip: Use `git push --force-with-lease` to push amended commit', 'yellow');
    } else {
      log('\n💡 Commit successful (not pushed)', 'yellow');
    }

    log('\n✨ Done!\n', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
