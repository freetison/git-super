# @theia-core/git-super

> AI-powered git commits with one command. Works with **any** git repository (Node.js, Python, Java, C++, etc.)

Automates the workflow: `git add .` → AI-generated commit message → `git commit` → `git push`

## Features

- ✨ **AI-powered commit messages** using Ollama (local), Claude, or GPT
- 🎯 **Customizable templates** - Add Jira tickets, Linear issues, or custom prefixes
- 📝 **Conventional Commits** format by default
- 🌍 **Framework-agnostic** - Works with any git repo, not just Node.js
- 🔧 **Zero dependencies** - Pure Node.js
- ⚡ **Fast** - No compilation, direct execution

## Installation

### From Verdaccio (Local Testing)

```bash
npm install -g @theia-core/git-super --registry http://localhost:4873
git config --global alias.super '!git-super'
```

### From npm (Public)

```bash
npm install -g @theia-core/git-super
git config --global alias.super '!git-super'
```

## Quick Start

```bash
# Make changes to your code
git super              # Stage, commit with AI message, and push
```

## Usage

```bash
git super              # add + commit + push
git super --no-push    # add + commit only (no push)
git super --dry-run    # preview message without committing
git super --amend      # amend last commit with new AI message
git super --no-verify  # skip pre-commit hooks
git super --init       # create config file with defaults
git super --help       # show help
```

## Configuration

### Create Config File

```bash
git super --init
```

This creates `~/.gitsuperrc` with customizable settings:

```json
{
  "aiProvider": "ollama",
  "aiModel": "mistral:latest",
  "ollamaUrl": "http://localhost:11434",
  "messageTemplate": null,
  "commitRules": {
    "types": ["feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build"],
    "maxLength": 72,
    "allowEmptyScope": true
  }
}
```

### Message Templates

Add custom prefixes to all commit messages:

```json
{
  "messageTemplate": "VTT-3020: {type}({scope}): {message}"
}
```

**Template Variables:**
- `{message}` - AI-generated description
- `{type}` - Commit type (feat, fix, etc.)
- `{scope}` - Commit scope (if any)
- `{ticket}` - Custom ticket number (set via `ticketNumber` config)

**Examples:**

```json
// Jira tickets
"messageTemplate": "VTT-3020: {type}({scope}): {message}"
// Output: VTT-3020: feat(auth): add OAuth login

// Linear issues
"messageTemplate": "LIN-{ticket}: {type}({scope}): {message}"

// GitHub issues
"messageTemplate": "#{ticket}: {type}({scope}): {message}"

// Simple prefix
"messageTemplate": "PROJECT: {type}: {message}"

// No template (default Conventional Commits)
"messageTemplate": null
```

### Environment Variables

Override config file settings:

```bash
AI_PROVIDER=anthropic git super     # Use Claude
AI_MODEL=llama3.2 git super          # Use different Ollama model
OLLAMA_URL=http://remote:11434 git super  # Remote Ollama instance
```

## AI Providers

### Ollama (Default - Local & Free)

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull mistral`
3. Run: `git super`

**Recommended models:**
- `qwen2.5-coder` - Best for code
- `deepseek-coder` - Great for commits
- `mistral` - Fast and accurate
- `codellama` - Good all-rounder

### Anthropic Claude

```bash
export ANTHROPIC_API_KEY='sk-ant-...'
AI_PROVIDER=anthropic git super
```

### OpenAI GPT

```bash
export OPENAI_API_KEY='sk-...'
AI_PROVIDER=openai git super
```

## Examples

### Basic Workflow

```bash
# Make changes
echo "new feature" > feature.js

# One command does everything
git super
# ✨ Output:
# → git add .
# 🤖 Generating AI message...
# 📝 Commit message: "feat(core): add new feature implementation"
# → git commit
# ✅ Commit successful
# → git push origin HEAD
# ✅ Push successful
```

### With Custom Template

```bash
git super --init
# Edit ~/.gitsuperrc: "messageTemplate": "PROJ-123: {type}: {message}"

git super
# Output: "PROJ-123: feat: add authentication module"
```

### Preview Before Committing

```bash
git super --dry-run
# Shows AI-generated message without committing
```

### Commit Without Pushing

```bash
git super --no-push
# Useful for local branches or when you want to amend later
```

## Configuration Priority

Settings are applied in this order (later overrides earlier):

1. Built-in defaults
2. `~/.gitsuperrc` (global config)
3. Environment variables
4. Command-line flags

## Use Cases

### Team Standards

Create a shared config template for your team:

```json
{
  "messageTemplate": "TEAM-{ticket}: {type}({scope}): {message}",
  "commitRules": {
    "types": ["feat", "fix", "docs", "refactor", "test", "chore"],
    "maxLength": 100
  }
}
```

### Multiple Projects

Different teams, different prefixes - just edit `~/.gitsuperrc` when switching contexts or set per-project ENV vars.

### Non-Node.js Projects

Works perfectly with **any** language:

```bash
# Python project
cd my-python-app/
git super  # ✅ Works!

# Java project
cd my-java-app/
git super  # ✅ Works!

# C++ project
cd my-cpp-app/
git super  # ✅ Works!
```

## Troubleshooting

### Ollama not found

```bash
# Check if Ollama is running
curl http://localhost:11434

# Start Ollama
ollama serve

# Install a model
ollama pull mistral
```

### Model not found

The tool auto-detects available models. If your configured model isn't found, it will suggest alternatives.

### Commit rejected by hooks

```bash
git super --no-verify  # Skip pre-commit hooks (use with caution)
```

## Development

```bash
# Clone repo
git clone https://github.com/Theia-plataform/theia-core-packages
cd theia-core-packages/packages/git-super

# Install globally for testing
npm install -g .

# Test
git super --help
```

## License

MIT © Angel Sola

## Contributing

Issues and PRs welcome at [theia-core-packages](https://github.com/Theia-plataform/theia-core-packages)

## Related

- Part of the [@theia-core](https://github.com/Theia-plataform/theia-core-packages) package ecosystem
- Works standalone - no Theia dependencies required

---

## Testing Session ✅

Follow this quick testing session to verify package behavior and CI readiness.

1. **Prerequisites**
   - Ensure Verdaccio is running: `curl http://localhost:4873`
   - Ensure Ollama is running: `curl http://localhost:11434` (or set `AI_PROVIDER`/API keys for remote providers)

2. **Publish locally**
   - `npm publish --registry http://localhost:4873`

3. **Install & verify**
   - `npm install -g @theia-core/git-super --registry http://localhost:4873`
   - `git super --help` to confirm installation

4. **Basic checks (dry-run & commit)**
   - `git super --init` creates `~/.gitsuperrc`
   - In a test repo: `git super --dry-run` to preview message
   - `git super --no-push` to commit locally without pushing

5. **Templates & env vars**
   - Edit `~/.gitsuperrc` `messageTemplate` (e.g., Jira or custom prefixes) and test with changes
   - Override settings with env vars like `AI_PROVIDER`, `AI_MODEL`, `OLLAMA_URL`

6. **Cross-language smoke tests**
   - Run `git super --dry-run` in Python, Java, and C++ repos (no build required) to ensure language-agnostic behavior

7. **Edge cases & error handling**
   - Non-git directory: expect a clear "Not a git repository" message
   - No changes: expect "No changes to commit"
   - Ollama or provider down: expect graceful fallback messaging

8. **Validation & limits**
   - Test `commitRules.maxLength` (e.g., set to a small number) to verify truncation/warnings

9. **Success criteria ✅**
   - Package publishes to Verdaccio and installs globally
   - `--init` creates a valid `~/.gitsuperrc`
   - `--dry-run` shows expected AI messages
   - Templates and template variables apply correctly
   - Works across different languages and with alternate AI providers
   - Clear error messages and fallback behavior when providers fail

For a full, step-by-step testing workflow and troubleshooting tips, see the repository's testing docs or the original `TESTING.md` (now consolidated into this README).
