# OpenCode DragonFu - Developer Guide for Agents

This document provides essential information for AI agents operating in the `extension_opencode_ui_ux_vsc` repository.

## 1. Project Overview

**OpenCode DragonFu** is a Visual Studio Code extension that integrates the OpenCode CLI with a custom "DragonFu" UI theme. It features a webview-based interface for chat and interaction with the OpenCode backend.

## 2. Environment & Setup

- **Language:** TypeScript (Target: ES2020)
- **Runtime:** Node.js (via VS Code Extension Host)
- **Package Manager:** `pnpm` (version 9+)
- **Build System:** `tsc` (TypeScript Compiler) + `esbuild` (for Webview)

## 3. Key Commands

### Build & Compile
- **Full Compile:** `npm run compile` (Compiles both src and test configs)
- **Production Compile:** `npm run compile:production`
- **Watch Mode:** `npm run watch`
- **Build Webview:** `npm run build:webview` (Bundles `src/webview/main.ts` to `out/webview.js`)

### Linting
- **Lint:** `npm run lint` (ESLint on `src` directory)

### Testing
- **Run All Tests:** `npm test` (Runs `vscode-test`)
- **Run Test Script:** `npm run test:script` (Executes `./scripts/test.sh`)
- **Running a Single Test:**
  To run a specific test file or suite, you typically need to modify the test runner configuration or use the VS Code Debugger "Extension Tests" launch configuration.
  *Agent Note:* If you need to verify a specific fix, it is often easier to create a temporary test file in `src/test/` and run the full suite, or use the debugger if interactive.

### Packaging
- **Package Extension:** `npm run package` (Builds webview, compiles, and packages to `.vsix`)

## 4. Code Style & Conventions

### TypeScript Configuration
- **Strict Mode:** Enabled (`"strict": true` in `tsconfig.json`)
- **Module Resolution:** `node`
- **Target:** `ES2020`
- **Implicit Any:** Forbidden. Always define types.

### Formatting & Naming
- **Indentation:** 2 spaces (implied from existing code).
- **Quotes:** Double quotes `"` generally used for imports and strings.
- **Semicolons:** Omitted (ASI) based on `src/extension.ts` style.
- **Classes:** PascalCase (e.g., `OpenCodeExtension`, `WebviewManager`).
- **Methods/Variables:** camelCase (e.g., `initializeComponents`, `backendLauncher`).
- **Private Members:** No `_` prefix observed. Use `private` keyword.

### Imports
- Use standard ES imports: `import * as vscode from "vscode"` or named imports.
- Avoid circular dependencies.
- Use relative paths for internal modules (e.g., `./ui/WebviewManager`).

### Asynchronous Programming
- Use `async/await` pattern over raw Promises.
- Ensure all Promises are awaited or handled properly to avoid unhandled rejections.

### Error Handling
- Use the centralized `errorHandler` utility (`src/utils/ErrorHandler`).
- **Pattern:**
  ```typescript
  try {
    // ... operation
  } catch (error) {
    logger.appendLine(`Failed to ...: ${error}`)
    await errorHandler.handleError(
      errorHandler.createErrorContext(
        ErrorCategory.COMMAND_EXECUTION, // Choose appropriate category
        ErrorSeverity.ERROR,
        "ClassName",
        "methodName",
        error instanceof Error ? error : new Error(String(error)),
        { contextParam: "value" } // Additional context
      )
    )
    // Re-throw if necessary for caller to handle
  }
  ```

### Logging
- Use the centralized `logger` utility (`src/globals`).
- **Pattern:** `logger.appendLine("Log message here")`
- Log significant lifecycle events (initialization, activation, disposal) and errors.

## 5. Project Structure

- `src/`
  - `extension.ts`: Main entry point (`activate`, `deactivate`).
  - `ui/`: UI logic (`WebviewManager`, `WebviewController`, `ActivityBarProvider`).
  - `webview/`: Frontend code for the webview (`main.ts`, components).
    - **Note:** This directory is excluded from the main `tsconfig.json` and built separately with `esbuild`.
  - `backend/`: Interaction with the OpenCode CLI (`BackendLauncher`).
  - `settings/`: Configuration management (`SettingsManager`).
  - `utils/`: Utilities (`ErrorHandler`, `FileMonitor`, `PathInserter`).
  - `commands/`: Command handlers (`AddToContextCommand`, etc.).
  - `test/`: Integration and unit tests.
- `out/`: Compiled JavaScript output.
- `resources/`: Static assets (icons, HTML templates).

## 6. Architecture Highlights

### Webview Management
- The extension uses a `WebviewManager` to handle the chat interface.
- Communication between the extension (backend) and webview (frontend) is handled via a message passing bridge (`CommunicationBridge` / `WebviewController`).
- **Cache Busting:** The webview URL often includes a `v=` parameter to force updates when the extension version changes.

### Backend Process
- The extension manages a separate process for the OpenCode backend (`opencode serve`).
- `BackendLauncher` handles spawning, finding binaries, and connection info.

### Error Handling Strategy
- Errors are categorized (`COMMAND_EXECUTION`, `NETWORK`, etc.).
- Critical errors during activation may dispose of the extension instance to ensure a clean state.

## 7. Development Workflow Tips

1.  **Changes to `src/webview/`:** Require running `npm run build:webview` to take effect in the extension.
2.  **Changes to `src/**/*.ts`:** Require `npm run compile` (or `watch` task).
3.  **Debugging:** Use the "Run Extension" launch configuration in VS Code. This starts a new Extension Host window with the extension loaded.
4.  **Logs:** Check the "OpenCode" output channel for logs generated by `logger`.

## 8. Agent Behavior Rules

- **Files:** Always read the file content before editing.
- **Safety:** Do not modify `package-lock.json` unless adding dependencies.
- **Verification:** Run `npm run compile` after making changes to TypeScript files to ensure type safety.
- **Context:** When fixing bugs, check `src/utils/ErrorHandler.ts` to see if a specific error category applies.

## 9. Development Plan

This document is used to maintain context across sessions. At the start of each session, simply say:
> "Continuamos con la Fase X. Revisa el plan en @AGENTS.md"

---

### Fase 1: Setup Básico
- [x] Configuración inicial del proyecto VS Code Extension
- [x] Estructura de directorios
- [x] Hello world básico

### Fase 2: Comunicación Core
- [x] WebviewManager básico
- [x] CommunicationBridge
- [x] Message passing entre extensión y webview

### Fase 3: Backend Integration
- [x] BackendLauncher
- [x] Proceso hijo para OpenCode
- [x] Chat SSE streaming
- [x] Auto-detección de backend existente (puerto 4096)

### Fase 4: UI/UX Improvements *(COMPLETA)*
- [x] Slash commands (/explain, /fix, /test)
- [x] Diff preview con Volver/Descartar
- [x] Markdown rendering con highlight.js
- [x] Botones condicionales (Copy/Preview solo para fix/test)
- [x] Estilos sin neon (confort visual)
- [x] Connection status indicator en UI

### Fase 5: Testing y Refactorización *(COMPLETA)*
- [x] Refactorización de clases grandes (ChatView: 1233 -> 1163 líneas)
- [x] Separar componentes del webview en archivos individuales
- [ ] Tests unitarios
- [ ] Manejo de errores mejorado
- [ ] Logging estructurado

### Fase 6: Features Avanzados *(pendiente)*
- [ ] Apply button (escribir cambios a archivos)
- [ ] Más slash commands
- [ ] Mejoras de accesibilidad
- [ ] Tema claro/oscuro
- [ ] Soporte para múltiples archivos en diff
- [ ] Notificaciones

---

## Mejoras Identificadas (Backlog)

Ideas y mejoras que surgen durante el desarrollo:

### Alta Prioridad
- [ ] Implementar Apply button para escribir cambios reales a archivos
- [ ] Tests unitarios con Mocha/Jest

### Media Prioridad
- [ ] Refactorizar ChatView en múltiples componentes
- [ ] Agregar más slash commands (/refactor, /optimize, etc.)
- [ ] Sistema de notificaciones toast

### Baja Prioridad / Ideas
- [ ] Tema claro/oscuro
- [ ] Soporte drag & drop de múltiples archivos
- [ ] Historial de conversaciones
- [ ] Exportar conversación a markdown

---

**Última actualización:** Fase 4 completada - Ahora en Fase 5: Testing y Refactorización
**Para iniciar una nueva sesión:** "Continuamos con la Fase X. Revisa el plan en @AGENTS.md"
