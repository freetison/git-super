# Testing Guide

## 🧪 Test Suite

git-super includes comprehensive unit tests for all design pattern implementations.

### Test Coverage

```
✅ Config Loader (Object Mapping Pattern)   - 91.25%
✅ Fallback Strategies (Strategy Pattern)   - 100%
✅ AI Providers (Strategy + Registry)       - 95.74%
```

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-run on changes)
pnpm test:watch

# Coverage report
pnpm test:coverage
```

---

## 📁 Test Structure

```
__tests__/
├── config-loader.test.mjs       # Config loading & env var mapping
├── providers.test.mjs            # AI provider strategy pattern
├── fallback.test.mjs             # Fallback message strategies
├── cli-integration.test.mjs      # CLI integration tests
├── empty-message-bug.test.mjs    # Empty AI response validation
├── auth-strategy.test.mjs        # Authentication strategies
├── credential-store.test.mjs     # Credential storage
├── oauth-flows.test.mjs          # OAuth flow handling
└── token-manager.test.mjs        # Token management
```

---

## 🎯 Test Categories

### Config Loader Tests (9 tests)

Tests the layered configuration approach:
- ✅ Default configuration loading
- ✅ Environment variable overrides
- ✅ Layered priority (env > file > defaults)
- ✅ Object mapping pattern validation

**Key validations:**
- No if-else chains for env var processing
- Declarative mapping approach
- Correct precedence order

---

### Provider Tests (19 tests)

Tests the AI provider strategy pattern:

**Base Provider:**
- ✅ Abstract class contract
- ✅ Must implement generate()
- ✅ Provider name extraction

**Ollama Provider:**
- ✅ Response cleaning (quotes, markdown, code blocks)
- ✅ Model fallback selection
- ✅ API error handling
- ✅ Model auto-detection

**Anthropic Provider:**
- ✅ API key validation
- ✅ Message generation
- ✅ Response formatting

**OpenAI Provider:**
- ✅ API key validation
- ✅ Message generation
- ✅ Response formatting

**Provider Registry:**
- ✅ Provider registration
- ✅ Provider resolution by name
- ✅ Custom provider support
- ✅ Strategy pattern validation (no if-else)

---

### Fallback Tests (30 tests)

Tests the fallback strategy pattern:

**Base Strategy:**
- ✅ Abstract class contract
- ✅ Must implement canHandle()
- ✅ Must implement getMessage()

**Add Files Strategy:**
- ✅ Handles pure file additions
- ✅ Rejects when modifications present
- ✅ Returns correct message: `feat: add new files`

**Modify Files Strategy:**
- ✅ Handles file modifications
- ✅ Works with additions/deletions
- ✅ Returns correct message: `refactor: update code`

**Delete Files Strategy:**
- ✅ Handles file deletions
- ✅ Works with additions
- ✅ Returns correct message: `chore: remove files`

**Fallback Resolver:**
- ✅ Strategy selection by priority
- ✅ Default message fallback
- ✅ Custom strategy support
- ✅ Edge cases (zeros, negatives, missing props)
- ✅ Pattern validation (no if-else chains)

---

### Empty Message Bug Tests (14 tests)

Tests validation of AI-generated messages to ensure fallback is used when AI returns invalid responses:

**Message Validation:**
- ✅ Rejects empty strings
- ✅ Rejects strings with only quotes (`""`, `''`, ` `` `)
- ✅ Rejects strings with only whitespace
- ✅ Accepts valid commit messages

**Delete-Only Commit Scenario:**
- ✅ Handles 21+ deleted files (user bug report scenario)
- ✅ Generates correct fallback: `chore: remove files`
- ✅ Handles large number of deletions

**Mock AI Provider Tests:**
- ✅ Detects empty provider responses
- ✅ Detects quotes-only responses (bug scenario)
- ✅ Detects whitespace-only responses

**Integration Scenarios:**
- ✅ Uses fallback when AI validation fails
- ✅ Uses AI message when valid
- ✅ Handles edge cases (nested quotes, wrapped messages)

**Bug Fix:** Previously, when AI returned `""` (empty quotes) for delete-only commits, the system would use that invalid message. Now it properly validates and falls back to `chore: remove files`.

---

## 🔍 What the Tests Validate

### 1. **No IF-ELSE Chains**
Tests ensure the codebase uses:
- **Object mapping** for configuration
- **Strategy pattern** for providers
- **Strategy pattern** for fallback messages

### 2. **Gang of Four Patterns**
- ✅ Strategy Pattern (providers & fallbacks)
- ✅ Factory/Registry Pattern (provider registry)
- ✅ Template Method (base classes)

### 3. **SOLID Principles**
- ✅ Single Responsibility (each class does one thing)
- ✅ Open/Closed (extend without modifying)
- ✅ Liskov Substitution (all providers interchangeable)

---

## 📊 Coverage Report

Run `pnpm test:coverage` to see detailed coverage:

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
lib/config         |   91.25 |    85.71 |     100 |   91.25 |
lib/fallback       |     100 |      100 |     100 |     100 |
lib/providers      |   95.74 |    78.57 |     100 |   95.74 |
-------------------|---------|----------|---------|---------|
```

HTML coverage report is generated in `coverage/` directory.

---

## 🚀 Adding New Tests

### For a New Provider:

```javascript
import { BaseAIProvider } from '../lib/providers/base-provider.mjs';

describe('MyNewProvider', () => {
  it('should generate message successfully', async () => {
    const provider = new MyNewProvider({ apiKey: 'test' });
    const message = await provider.generate('test prompt');
    expect(message).toBeTruthy();
  });
});
```

### For a New Fallback Strategy:

```javascript
import { BaseFallbackStrategy } from '../lib/fallback/base-fallback-strategy.mjs';

describe('MyNewStrategy', () => {
  it('should handle specific case', () => {
    const strategy = new MyNewStrategy();
    expect(strategy.canHandle({ myCondition: true })).toBe(true);
  });
  
  it('should return correct message', () => {
    const strategy = new MyNewStrategy();
    expect(strategy.getMessage()).toBe('expected: message');
  });
});
```

---

## 🐛 Debugging Tests

```bash
# Run specific test file
pnpm vitest __tests__/providers.test.mjs

# Run tests matching pattern
pnpm vitest -t "Ollama Provider"

# Debug mode
pnpm vitest --inspect-brk
```

---

## ✅ Pre-commit Checklist

Before committing changes:

```bash
# 1. Run all tests
pnpm test

# 2. Check coverage
pnpm test:coverage

# 3. Verify no if-else chains introduced
# 4. Ensure SOLID principles maintained
```

---

## 📈 Test Metrics

- **Total Tests:** 171
- **Passing:** 171 ✅
- **Test Files:** 9
- **Average Coverage:** 95%+
- **Test Execution:** <20s

---

## 🎓 Test Philosophy

Tests follow these principles:

1. **Fast:** All tests run in under 1 second
2. **Isolated:** Each test is independent
3. **Deterministic:** Same input = same output
4. **Pattern-focused:** Validates design patterns applied
5. **Edge-case aware:** Tests boundary conditions

---

## 🔗 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Design Patterns](https://refactoring.guru/design-patterns)
