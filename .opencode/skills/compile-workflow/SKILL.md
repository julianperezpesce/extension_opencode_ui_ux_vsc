---
name: compile-workflow
description: Compilation and build workflow for OpenCode DragonFu extension. Includes npm scripts, TypeScript compilation, webview bundling, and debugging.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# Compile & Build Workflow Guide

This document covers all build processes for the OpenCode DragonFu extension.

## npm Scripts

### Full Compilation

```bash
npm run compile
```

Runs:
1. `tsc -p ./` - Compiles src/ TypeScript
2. `tsc -p ./tsconfig.test.json` - Compiles test/ TypeScript

### Webview Build

```bash
npm run build:webview
```

Runs esbuild to bundle:
- Input: `src/webview/main.ts`
- Output: `out/webview.js`
- Format: IIFE (Immediately Invoked Function Expression)

### Watch Mode

```bash
npm run watch
```

Watches for file changes and recompiles automatically.

### Package Extension

```bash
npm run package
```

Creates a `.vsix` file for distribution:
1. Builds webview
2. Compiles TypeScript
3. Creates package

### Lint

```bash
npm run lint
```

Runs ESLint on src/ directory.

## TypeScript Compilation

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "outDir": "./out",
    "rootDir": "./src",
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "src/webview", "src/test"]
}
```

### Webview tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "outDir": "./out",
    "rootDir": "./src/webview"
  },
  "include": ["src/webview/**/*"]
}
```

## Common Build Errors

### "Cannot find module"

**Cause:** Missing dependency or incorrect import path.

**Solution:**
```bash
npm install
```

Check import paths:
```typescript
// BAD
import { something } from "../utils"

// GOOD
import { something } from "../utils/ErrorHandler"
```

### "Expression is always true"

**Cause:** TypeScript strict mode detected unreachable code.

**Solution:**
```typescript
// BAD
if (this.connection && this.connection !== null) {

// GOOD
if (this.connection) {
```

### "Object literal may only specify known properties"

**Cause:** Adding properties not in interface.

**Solution:**
```typescript
// If property is dynamic:
const obj = {...} as KnownType & { [key: string]: unknown }

// Or extend the interface:
interface ExtendedType extends KnownType {
  newProperty: string
}
```

### "Cannot read properties of undefined"

**Cause:** Accessing property on possibly undefined value.

**Solution:**
```typescript
// BAD
const name = user.name

// GOOD
const name = user?.name ?? 'default'

// Or
if (user) {
  const name = user.name
}
```

## Development Workflow

### 1. Make Code Changes

Edit files in `src/` or `src/webview/`

### 2. Compile TypeScript

```bash
npm run compile
```

### 3. Build Webview (if changed)

```bash
npm run build:webview
```

### 4. Test Extension

#### Option A: Development Host
```bash
code --extensionDevelopmentPath=/path/to/extension
```

#### Option B: Package & Install
```bash
npm run package
code --install-extension ./opencode-dragonfu-1.0.0.vsix --force
```

## Webview Bundling

### esbuild Configuration

```javascript
// build-webview.js
esbuild({
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  outfile: 'out/webview.js',
  format: 'iife',
  minify: true,
  sourcemap: false,
  target: ['es2020'],
  platform: 'browser'
})
```

### Key Points

- **Format: IIFE** - Creates self-invoking function for webview
- **Platform: browser** - Uses DOM APIs
- **Minify: true** - Reduces file size
- **Bundle: true** - Includes all dependencies

## Testing

### Run Tests

```bash
npm test
```

### Run Specific Test

Modify test runner or use VS Code debugger:
- "Extension Tests" configuration

### Test Commands

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm test
```

## Debugging

### Extension Host

1. Press F5 in VS Code
2. Opens new window with extension loaded
3. Set breakpoints in src/ files

### Webview

1. Right-click in webview → Inspect
2. Use DevTools Console for logging
3. Set breakpoints in webview sources

### Backend (OpenCode)

Terminal where running:
```bash
opencode serve --cors *
```

## Clean Build

If having issues, clean and rebuild:

```bash
rm -rf out/
rm -rf node_modules/.cache
npm run compile
npm run build:webview
```

## CI/CD (Future)

```yaml
# .github/workflows/build.yml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run compile
      - run: npm run build:webview
      - run: npm run package
```

## Quick Reference

| Task | Command |
|------|---------|
| Compile TS | `npm run compile` |
| Build webview | `npm run build:webview` |
| Both | `npm run compile && npm run build:webview` |
| Watch | `npm run watch` |
| Package | `npm run package` |
| Lint | `npm run lint` |
| Test | `npm test` |
