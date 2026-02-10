# OAuth/SSO Enterprise Authentication

This document explains how to set up and use OAuth/SSO authentication with git-super for enterprise environments.

## Overview

git-super now supports OAuth 2.0 / SSO authentication for enterprise AI providers, allowing you to authenticate using your company's Single Sign-On instead of managing API keys.

**Supported Providers:**
- **Azure OpenAI** with Azure AD (Microsoft Entra ID)
- **GitHub Copilot Enterprise** with GitHub OAuth
- **Generic OIDC** for any OpenID Connect compliant provider

## Quick Start

### 1. Configure Your Provider

Edit `~/.gitsuperrc`:

```json
{
  "aiProvider": "azure-openai",
  "aiModel": "gpt-4",
  "azureTenantId": "your-tenant-id",
  "azureClientId": "your-client-id",
  "azureResourceEndpoint": "https://your-company.openai.azure.com",
  "azureDeploymentName": "gpt-4"
}
```

### 2. Authenticate

```bash
git super auth login --provider azure-openai
```

This will:
1. Display a user code (e.g., `ABCD-1234`)
2. Open your browser to the authentication page
3. Wait for you to complete authentication
4. Store the OAuth token securely

### 3. Use git-super Normally

```bash
git super
```

The tool automatically handles token refresh if needed.

## Provider Setup Guides

### Azure OpenAI with Azure AD

#### Prerequisites

1. Azure OpenAI resource deployed
2. Azure AD application registered with:
   - Public client flows enabled
   - Redirect URI: `http://localhost` (for device code flow)
   - API permissions: `Cognitive Services User` role

#### Configuration

```json
{
  "aiProvider": "azure-openai",
  "aiModel": "gpt-4",
  "azureTenantId": "12345678-1234-1234-1234-123456789abc",
  "azureClientId": "87654321-4321-4321-4321-cba987654321",
  "azureResourceEndpoint": "https://my-company.openai.azure.com",
  "azureDeploymentName": "gpt-4"
}
```

#### Environment Variables (Alternative)

```bash
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-client-id"
export AZURE_OPENAI_ENDPOINT="https://your-company.openai.azure.com"
```

#### Authentication

```bash
# Authenticate
git super auth login --provider azure-openai

# Browser opens to:
# https://login.microsoftonline.com/your-tenant/oauth2/v2.0/device
# Enter the code shown in terminal

# Check status
git super auth status
```

### GitHub Copilot Enterprise

#### Prerequisites

1. GitHub organization with Copilot Enterprise license
2. GitHub OAuth app (or use default GitHub CLI client)

#### Configuration

```json
{
  "aiProvider": "github-copilot",
  "aiModel": "gpt-4-turbo",
  "githubOrg": "my-organization",
  "githubClientId": "Iv1.xxxxxxxxxxxx"
}
```

#### Environment Variables (Alternative)

```bash
export GITHUB_ORG="my-organization"
export GITHUB_CLIENT_ID="Iv1.xxxxxxxxxxxx"  # Optional, has default
```

#### Authentication

```bash
# Authenticate
git super auth login --provider github-copilot

# Browser opens to: https://github.com/login/device
# Enter the code shown in terminal

# Check status
git super auth status
```

**Note:** GitHub Copilot's commit message generation API may not be publicly available yet. This provider is prepared for when the API becomes available.

### Generic OIDC Provider

For any OAuth 2.0 / OpenID Connect compliant identity provider.

#### Prerequisites

1. OIDC-compliant identity provider (Okta, Auth0, Keycloak, etc.)
2. OAuth client configured with:
   - Device authorization grant enabled
   - Required scopes for your AI API

#### Configuration

```json
{
  "aiProvider": "generic-oidc",
  "aiModel": "custom-model",
  "oidcIssuer": "https://auth.company.com",
  "oidcClientId": "your-client-id",
  "oidcScopes": ["openid", "profile", "email", "ai-api"],
  "oidcApiEndpoint": "https://ai.company.com/v1/chat/completions"
}
```

#### Environment Variables (Alternative)

```bash
export OIDC_ISSUER="https://auth.company.com"
export OIDC_CLIENT_ID="your-client-id"
export OIDC_API_ENDPOINT="https://ai.company.com/v1/chat/completions"
```

#### Authentication

```bash
# Authenticate
git super auth login --provider generic-oidc

# Follow the device code flow prompts

# Check status
git super auth status
```

## Token Storage

OAuth tokens are stored securely using your operating system's credential manager:

- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: libsecret (GNOME Keyring, KWallet)

### Using OS Keychain (Recommended)

Install `keytar` for native OS keychain integration:

```bash
npm install -g keytar
```

### Fallback: Encrypted File Storage

If `keytar` is not available, tokens are stored in an encrypted file:
- Location: `~/.gitsuper/credentials.enc`
- Encryption: AES-256-CBC
- Key derivation: PBKDF2 from machine-specific data

The file is automatically created with restricted permissions (0600).

## Authentication Commands

### Login

```bash
# Authenticate with a provider
git super auth login --provider <provider-name>

# Authenticate with specific organization context
git super auth login --provider azure-openai --org work
```

### Status

```bash
# Show authentication status for all providers
git super auth status

# Output example:
# 📊 Authentication Status
#
# Active Context: work (Company ABC Corp)
# Current Provider: azure-openai
# Model: gpt-4
#
# ✅ azure-openai: Valid
#    Expires: 2/11/2026, 10:00:00 AM
# ⚪ github-copilot: Not authenticated
# ✅ anthropic: API key configured
```

### Logout

```bash
# Logout from current provider
git super auth logout

# Logout from specific provider
git super auth logout --provider azure-openai

# Logout from all providers
git super auth logout --all
```

## Token Lifecycle

### Automatic Token Refresh

git-super automatically refreshes OAuth tokens when:
- Token expires within 5 minutes
- Token is expired but refresh token is valid

No user intervention needed for refresh.

### Token Expiration

If token refresh fails or refresh token is expired:

```bash
# Error message will indicate re-authentication needed
❌ OAuth token expired and could not be refreshed.
Please re-authenticate with: git super auth login --provider azure-openai
```

### Manual Token Refresh

Tokens are refreshed automatically on use. To check status:

```bash
git super auth status
```

## Multi-Organization Workflow

Combine OAuth with multi-organization contexts:

```json
{
  "activeOrg": "work",
  "organizations": {
    "work": {
      "name": "Work - Azure OpenAI",
      "aiProvider": "azure-openai",
      "azureTenantId": "...",
      "azureClientId": "...",
      "azureResourceEndpoint": "..."
    },
    "personal": {
      "name": "Personal - Anthropic",
      "aiProvider": "anthropic",
      "anthropicKey": "${ANTHROPIC_API_KEY}"
    }
  }
}
```

### Workflow

```bash
# Switch to work context
git super context switch work

# Authenticate (if not already)
git super auth login --provider azure-openai

# Use normally
git super

# Switch to personal projects
git super context switch personal

# Use with API key (no auth needed)
git super
```

## CI/CD Integration

### Service Principals (Azure)

For automated pipelines, use service principal credentials instead of interactive OAuth:

```bash
# Set environment variables in CI
export AZURE_TENANT_ID="..."
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."  # Service principal secret
```

### GitHub Actions

For GitHub Actions, use GitHub App authentication:

```yaml
- name: Setup git-super
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    npm install -g @theia-core/git-super
    git super --version
```

### Disable Interactive Flows

For CI/CD, ensure authentication is already configured or use API keys:

```bash
# Use API key in CI instead of OAuth
export OPENAI_API_KEY="${{ secrets.OPENAI_API_KEY }}"
export AI_PROVIDER="openai"
```

## Troubleshooting

### Browser Doesn't Open

If browser fails to open automatically:

```bash
# Manually open the URL shown in terminal
# https://github.com/login/device

# Enter the user code displayed
```

### Token Storage Issues

Check which storage method is being used:

```bash
# Check keytar availability
node -e "console.log(require('keytar'))"

# If error, keytar not installed - using encrypted file fallback
```

### Organization / Permission Errors

Ensure you have proper access:

```bash
# Azure: Check you have "Cognitive Services User" role
# GitHub: Check you're member of the organization with Copilot license
```

### Network / Firewall Issues

Corporate firewalls may block OAuth endpoints:

```bash
# Check connectivity
curl https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration

# If blocked, contact IT to whitelist:
# - login.microsoftonline.com (Azure)
# - github.com (GitHub)
# - Your OIDC issuer domain
```

### Clear Stored Credentials

```bash
# Logout to clear tokens
git super auth logout --all

# Manually delete credential file (if using fallback)
rm ~/.gitsuper/credentials.enc

# Re-authenticate
git super auth login --provider azure-openai
```

## Security Best Practices

1. **Use OS keychain** - Install `keytar` for better security than file encryption

2. **Limit token scopes** - Only request necessary OAuth scopes

3. **Regular re-authentication** - For sensitive environments, periodically re-authenticate

4. **Separate contexts** - Use different contexts for work/personal to avoid mixing credentials

5. **Audit access** - Regularly review OAuth app authorizations in your IdP

6. **Protect config file** - Ensure `~/.gitsuperrc` has proper permissions:
   ```bash
   chmod 600 ~/.gitsuperrc
   ```

7. **Don't commit tokens** - Never commit OAuth tokens or refresh tokens to git

8. **Use short-lived tokens** - Configure your OAuth provider for shorter token lifetimes in sensitive environments

## Support

For issues specific to OAuth/SSO:
- Check `git super auth status` for detailed error messages
- Review IdP (Azure AD / GitHub) logs for authentication failures
- Ensure OAuth app configuration matches requirements
- Test connectivity to OAuth endpoints

For provider-specific issues:
- **Azure**: Check Azure AD app registration and API permissions
- **GitHub**: Verify organization Copilot license and membership
- **Generic OIDC**: Confirm OIDC discovery endpoint is accessible
