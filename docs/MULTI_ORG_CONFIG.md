# Multi-Organization Configuration Example

This file demonstrates how to configure `git-super` with multiple organizational contexts, supporting both API keys and OAuth/SSO authentication.

## Configuration File Location

`~/.gitsuperrc`

## Multi-Organization Configuration

```json
{
  "$comment": "Multi-organization configuration for git-super",
  "activeOrg": "work",
  
  "organizations": {
    "work": {
      "name": "Company ABC Corp - Azure OpenAI",
      "aiProvider": "azure-openai",
      "aiModel": "gpt-4",
      "azureTenantId": "your-tenant-id",
      "azureClientId": "your-client-id",
      "azureResourceEndpoint": "https://your-company.openai.azure.com",
      "azureDeploymentName": "gpt-4",
      "messageTemplate": "JIRA-{ticket}: {type}({scope}): {message}",
      "ticketNumber": "3020"
    },
    
    "github-projects": {
      "name": "Open Source Projects - GitHub Copilot",
      "aiProvider": "github-copilot",
      "aiModel": "gpt-4-turbo",
      "githubOrg": "my-org",
      "githubClientId": "your-github-app-client-id",
      "messageTemplate": "#{ticket}: {type}: {message}"
    },
    
    "personal": {
      "name": "Personal Projects - Anthropic",
      "aiProvider": "anthropic",
      "aiModel": "claude-3-5-sonnet-20241022",
      "anthropicKey": "${ANTHROPIC_API_KEY}",
      "messageTemplate": null
    },
    
    "local": {
      "name": "Local Development - Ollama",
      "aiProvider": "ollama",
      "aiModel": "llama3.2:latest",
      "ollamaUrl": "http://localhost:11434",
      "messageTemplate": null
    },
    
    "custom-enterprise": {
      "name": "Custom Enterprise SSO",
      "aiProvider": "generic-oidc",
      "aiModel": "custom-model",
      "oidcIssuer": "https://auth.company.com",
      "oidcClientId": "your-client-id",
      "oidcScopes": ["openid", "profile", "email", "api"],
      "oidcApiEndpoint": "https://ai.company.com/v1/chat/completions",
      "messageTemplate": "TICKET-{ticket}: {type}: {message}"
    }
  },
  
  "commitRules": {
    "types": ["feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build"],
    "maxLength": 72,
    "allowEmptyScope": true
  }
}
```

## Legacy (Flat) Configuration

For backward compatibility, you can still use flat configuration without organizations:

```json
{
  "aiProvider": "ollama",
  "aiModel": "mistral:latest",
  "ollamaUrl": "http://localhost:11434",
  "messageTemplate": null,
  "ticketNumber": "",
  "commitRules": {
    "types": ["feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build"],
    "maxLength": 72,
    "allowEmptyScope": true
  }
}
```

## Usage Examples

### Switch Between Contexts

```bash
# List available contexts
git super context list

# Switch to work context (Azure OpenAI)
git super context switch work

# Switch to local development (Ollama)
git super context switch local

# View current context
git super context
```

### Authenticate with OAuth

```bash
# Authenticate with Azure OpenAI (requires context with azure-openai provider)
git super auth login --provider azure-openai

# Authenticate with GitHub Copilot
git super auth login --provider github-copilot

# Check authentication status
git super auth status

# Logout
git super auth logout --provider azure-openai

# Logout from all providers
git super auth logout --all
```

### Normal Usage

```bash
# Just use git super as normal - it uses the active context
git super

# The tool automatically:
# 1. Uses the provider from active context
# 2. Handles OAuth token refresh if needed
# 3. Applies the message template from that context
```

## Provider-Specific Configuration

### Azure OpenAI

Required fields:
- `azureTenantId`: Azure AD tenant ID
- `azureClientId`: Azure application client ID
- `azureResourceEndpoint`: Your Azure OpenAI endpoint URL
- `azureDeploymentName`: Deployment name (usually same as model)

Environment variables (optional):
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_OPENAI_ENDPOINT`

### GitHub Copilot Enterprise

Required fields:
- `githubOrg`: GitHub organization name
- `githubClientId`: GitHub OAuth app client ID (or use default)

Environment variables (optional):
- `GITHUB_ORG`
- `GITHUB_CLIENT_ID`

### Generic OIDC

Required fields:
- `oidcIssuer`: OAuth 2.0 issuer URL
- `oidcClientId`: OAuth client ID
- `oidcApiEndpoint`: Your AI service API endpoint

Optional fields:
- `oidcScopes`: Array of OAuth scopes (default: ["openid", "profile", "email"])
- `oidcTokenEndpoint`: Token endpoint (auto-discovered if not set)
- `oidcDeviceAuthEndpoint`: Device authorization endpoint (auto-discovered if not set)

Environment variables (optional):
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_API_ENDPOINT`

### API Key Providers (Anthropic, OpenAI)

Required fields:
- `anthropicKey` or `openaiKey` (can use `${ENV_VAR}` syntax)

Environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

### Ollama (Local)

Required fields:
- `ollamaUrl`: Ollama server URL (default: http://localhost:11434)

Environment variables:
- `OLLAMA_URL`

## Security Notes

1. **Never commit API keys to git**. Use environment variable syntax: `"anthropicKey": "${ANTHROPIC_API_KEY}"`

2. **OAuth tokens are stored securely**:
   - macOS: Keychain
   - Windows: Credential Manager
   - Linux: libsecret/gnome-keyring
   - Fallback: Encrypted file in `~/.gitsuper/credentials.enc`

3. **Optional keytar installation** for OS keychain integration:
   ```bash
   npm install -g keytar
   ```
   If not installed, encrypted file storage is used automatically.

## Troubleshooting

### Check authentication status
```bash
git super auth status
```

### Re-authenticate if token expired
```bash
git super auth login --provider azure-openai
```

### Check which storage method is being used
```bash
# With DEBUG env var
DEBUG=git-super:auth git super auth status
```

### Switch to a working context
```bash
git super context list
git super context switch local  # Use local Ollama
```
