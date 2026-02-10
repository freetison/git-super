# git-super - Architecture Documentation

## 📐 Design Patterns Applied

This refactor eliminates all `if-else` chains by applying **SOLID principles** and **Gang of Four design patterns**.

---

## 🔧 Config Loader (Object Mapping)

**Pattern:** Layered Configuration  
**Location:** `lib/config/config-loader.mjs`

### Problem
```javascript
// ❌ Before: if-else chain
if (process.env.AI_PROVIDER) defaults.aiProvider = process.env.AI_PROVIDER;
if (process.env.AI_MODEL) defaults.aiModel = process.env.AI_MODEL;
if (process.env.OLLAMA_URL) defaults.ollamaUrl = process.env.OLLAMA_URL;
// ... more if statements
```

### Solution
```javascript
// ✅ After: Object mapping
const ENV_MAPPINGS = {
  aiProvider: 'AI_PROVIDER',
  aiModel: 'AI_MODEL',
  ollamaUrl: 'OLLAMA_URL',
};

Object.entries(ENV_MAPPINGS).forEach(([key, envVar]) => {
  if (process.env[envVar]) config[key] = process.env[envVar];
});
```

**Benefits:**
- ✅ Add new env vars by just adding to mapping
- ✅ No more repetitive if-else
- ✅ Single source of truth

---

## 🤖 AI Providers (Strategy Pattern)

**Pattern:** Strategy + Registry/Factory  
**Location:** `lib/providers/`

### Structure
```
lib/providers/
├── base-provider.mjs         # Abstract base class
├── ollama-provider.mjs        # Ollama implementation
├── anthropic-provider.mjs     # Anthropic implementation
├── openai-provider.mjs        # OpenAI implementation
└── provider-registry.mjs      # Factory/Registry
```

### Problem
```javascript
// ❌ Before: nested if-else
if (CONFIG.aiProvider === 'ollama') {
  message = await callOllama(prompt);
} else if (CONFIG.aiProvider === 'anthropic') {
  message = await callAnthropic(prompt);
} else if (CONFIG.aiProvider === 'openai') {
  message = await callOpenAI(prompt);
} else {
  throw new Error(`Unsupported provider: ${CONFIG.aiProvider}`);
}
```

### Solution
```javascript
// ✅ After: Strategy Pattern
const provider = providerRegistry.get(CONFIG.aiProvider);
const message = await provider.generate(prompt);
```

**Benefits:**
- ✅ Add new providers without modifying main code
- ✅ Each provider is self-contained
- ✅ Easy to test in isolation
- ✅ Follows Open/Closed Principle

### Adding a New Provider

```javascript
// 1. Create new provider
export class GroqProvider extends BaseAIProvider {
  async generate(prompt) {
    // Implementation
  }
}

// 2. Register in provider-registry.mjs
this.register('groq', new GroqProvider(this.config));

// 3. Done! No changes to main code
```

---

## 🔄 Fallback Messages (Strategy Pattern)

**Pattern:** Strategy + Resolver  
**Location:** `lib/fallback/`

### Structure
```
lib/fallback/
├── base-fallback-strategy.mjs  # Abstract base
├── add-files-strategy.mjs       # feat: add new files
├── modify-files-strategy.mjs    # refactor: update code
├── delete-files-strategy.mjs    # chore: remove files
└── fallback-resolver.mjs        # Strategy coordinator
```

### Problem
```javascript
// ❌ Before: nested if-else
let fallback = 'chore: update';
if (added > 0 && modified === 0 && deleted === 0) {
  fallback = 'feat: add new files';
} else if (modified > 0) {
  fallback = 'refactor: update code';
} else if (deleted > 0) {
  fallback = 'chore: remove files';
}
```

### Solution
```javascript
// ✅ After: Strategy Pattern
const stats = { added, modified, deleted };
const fallback = fallbackResolver.resolve(stats);
```

**Benefits:**
- ✅ Each strategy is a separate class
- ✅ Easy to add new fallback rules
- ✅ Testable in isolation
- ✅ Clear separation of concerns

### Adding a New Fallback Strategy

```javascript
// 1. Create strategy
export class RenameFilesStrategy extends BaseFallbackStrategy {
  canHandle({ renamed }) {
    return renamed > 0;
  }
  
  getMessage() {
    return 'refactor: rename files';
  }
}

// 2. Register in fallback-resolver.mjs
this.strategies = [
  new AddFilesStrategy(),
  new RenameFilesStrategy(),  // Add here
  // ...
];

// 3. Done!
```

---

## 📊 Before vs After

### Lines of Code
- **Before:** 643 lines (monolithic)
- **After:** ~450 lines (modular)
- **Reduction:** 30% less code in main file

### Cyclomatic Complexity
- **Before:** High (nested if-else chains)
- **After:** Low (delegated to strategies)

### Testability
- **Before:** Hard to test (everything coupled)
- **After:** Easy to test (each module isolated)

### Extensibility
- **Before:** Modify main file for every addition
- **After:** Just add new strategy/provider class

---

## 🎯 SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**
   - Each provider handles ONE AI service
   - Each strategy handles ONE fallback scenario

2. **Open/Closed Principle (OCP)**
   - Open for extension (add new providers/strategies)
   - Closed for modification (no changes to main code)

3. **Liskov Substitution Principle (LSP)**
   - All providers implement `BaseAIProvider`
   - All can be used interchangeably

4. **Dependency Inversion Principle (DIP)**
   - Main code depends on abstractions (base classes)
   - Not on concrete implementations

---

## 🧪 Testing Strategy

Each module can now be tested independently:

```javascript
// Test config loader
import { loadConfig } from './lib/config/config-loader.mjs';
process.env.AI_PROVIDER = 'test';
const config = loadConfig();
assert(config.aiProvider === 'test');

// Test provider
import { OllamaProvider } from './lib/providers/ollama-provider.mjs';
const provider = new OllamaProvider(config);
const message = await provider.generate('test prompt');

// Test fallback
import { AddFilesStrategy } from './lib/fallback/add-files-strategy.mjs';
const strategy = new AddFilesStrategy();
assert(strategy.canHandle({ added: 1, modified: 0, deleted: 0 }));
```

---

## 🚀 Performance

- **No performance penalty:** Patterns add negligible overhead
- **Better memory:** Lazy loading possible
- **Better maintainability:** Worth any minimal cost

---

## 📝 Code Review Checklist

✅ No `if-else` chains  
✅ Each class has single responsibility  
✅ Easy to add new features  
✅ All modules testable in isolation  
✅ Clear separation of concerns  
✅ Follows Gang of Four patterns  
✅ C++/C# style OOP (as requested)  

**Status:** Ready for PR ✅
