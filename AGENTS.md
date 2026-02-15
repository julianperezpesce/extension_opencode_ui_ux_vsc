# OpenCode DragonFu - Developer Guide

Project: VS Code extension integrating OpenCode CLI with custom DragonFu UI.

## Project Structure

```
src/
├── extension.ts          # Entry point (activate/deactivate)
├── ui/                  # UI management
│   ├── WebviewManager   # Panel lifecycle
│   ├── WebviewController # Shared controller
│   ├── CommunicationBridge # Message bridge
│   ├── IdeBridgeServer  # SSE server
│   └── ActivityBarProvider
├── webview/             # Frontend (Lit components)
│   ├── main.ts         # Entry
│   ├── components/     # chat-view, diff-preview, etc.
│   └── utils/          # message-handler, markdown-renderer
├── backend/             # BackendLauncher, ResourceExtractor
├── settings/            # SettingsManager
├── utils/               # ErrorHandler, FileMonitor, PathInserter
└── commands/            # AddToContextCommand, PastePathCommand
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Full compile (src + test) |
| `npm run build:webview` | Build webview bundle |
| `npm run watch` | Watch mode |
| `npm run package` | Package to .vsix |

## Architecture

See `ARCHITECTURE.md` for detailed diagrams and flow documentation.

```
VSCode Extension <-> OpenCode Backend <-> Webview UI
```

### Communication Flow
- **postMessage**: Extension <-> Webview
- **SSE**: Backend -> Extension (streaming)
- **HTTP**: Extension -> Backend API

## Code Conventions

- **TypeScript**: Strict mode, no implicit any
- **Classes**: PascalCase
- **Methods/Variables**: camelCase
- **Error Handling**: Use `errorHandler` from `src/utils/ErrorHandler.ts`
- **Logging**: Use `logger` from `src/globals`

## Development Plan

At session start, say: *"Continuamos con la Fase X. Revisa el plan en @AGENTS.md"*

### Fase 1: Setup ✓
### Fase 2: Core Communication ✓
### Fase 3: Backend Integration ✓
### Fase 4: UI/UX Improvements ✓
### Fase 5: Testing & Refactor ✓ (partial)
### Fase 6: Advanced Features (pending)

- [ ] Apply button
- [ ] More slash commands
- [ ] Tests unitarios
- [ ] Tema claro/oscuro
