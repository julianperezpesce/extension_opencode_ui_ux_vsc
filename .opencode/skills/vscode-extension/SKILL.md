---
name: vscode-extension
description: VS Code extension development patterns for OpenCode DragonFu. Includes extension structure, webview communication, commands, and lifecycle management.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# VS Code Extension Development Guide

This extension follows specific patterns for VS Code extension development.

## Extension Structure

```
src/
├── extension.ts           # Main entry point (activate/deactivate)
├── ui/
│   ├── WebviewManager.ts    # Creates webview panels
│   ├── WebviewController.ts # Handles webview lifecycle & messaging
│   ├── CommunicationBridge.ts # Message passing bridge
│   ├── ActivityBarProvider.ts # Sidebar webview provider
│   └── IdeBridgeServer.ts   # SSE server for webview
├── backend/
│   └── BackendLauncher.ts   # Manages OpenCode backend process
├── commands/
│   ├── AddToContextCommand.ts
│   ├── AddLinesToContextCommand.ts
│   └── PastePathCommand.ts
├── settings/
│   └── SettingsManager.ts
├── utils/
│   ├── ErrorHandler.ts
│   ├── FileMonitor.ts
│   └── PathInserter.ts
└── webview/              # Frontend code
    ├── main.ts
    ├── components/
    │   └── chat-view.ts
    └── styles.css
```

## Extension Lifecycle

### Activation

```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("OpenCode extension is now active")
  context.subscriptions.push(logger)

  // Create and initialize extension
  extensionInstance = new OpenCodeExtension()
  await extensionInstance.initialize(context)

  // Register diagnostic command
  const diagnosticCommand = vscode.commands.registerCommand(
    "opencode.showDiagnostics",
    async () => { await errorHandler.showDiagnosticInfo() }
  )
  context.subscriptions.push(diagnosticCommand)
}
```

### Deactivation

```typescript
export function deactivate(): void {
  console.log("OpenCode extension is being deactivated")

  if (extensionInstance) {
    extensionInstance.dispose()
    extensionInstance = undefined
  }
}
```

## Webview Communication

### Extension → Webview

```typescript
// Using CommunicationBridge
this.communicationBridge.sendMessage({
  type: "chat.receive",
  text: "Hello from extension"
})

this.communicationBridge.sendMessage({
  type: "insertPaths",
  payload: { paths: ["/path/to/file"] }
})
```

### Webview → Extension

```typescript
// From webview
vscode.postMessage({
  type: "chat.send",
  text: "Hello from webview",
  context: []
})

// Handle in CommunicationBridge
case "chat.send":
  await this.handleChatSend(message.text, message.context)
  break
```

## Registering Commands

### Basic Command

```typescript
const openPanelCommand = vscode.commands.registerCommand(
  "opencode.openPanel",
  async () => {
    await this.handleOpenPanel({ forceNewBackend: true })
  }
)
context.subscriptions.push(openPanelCommand)
```

### Command with URI

```typescript
const addFileToContextCommand = vscode.commands.registerCommand(
  "opencode.addFileToContext",
  async (uri?: vscode.Uri) => {
    await this.handleAddFileToContext(uri)
  }
)
```

## Webview Providers

### ActivityBarProvider (Sidebar)

```typescript
export class ActivityBarProvider implements vscode.WebviewViewProvider {
  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "resources"),
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
      ],
    }

    // Initialize controller
    this.controller = new WebviewController({...})
    await this.controller.load(this.connection)
  }
}
```

## Package.json Configuration

### Contributes

```json
{
  "contributes": {
    "commands": [
      {
        "command": "opencode.openPanel",
        "title": "OpenCode: Open Panel"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "opencode.addLinesToContext",
          "when": "editorHasSelection"
        }
      ],
      "explorer/context": [
        {
          "command": "opencode.addFileToContext"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "opencode",
          "title": "OpenCode",
          "icon": "resources/icon.png"
        }
      ]
    },
    "views": {
      "opencode": [
        {
          "id": "main",
          "type": "webview"
        }
      ]
    }
  }
}
```

## Best Practices

### 1. Always Dispose Resources

```typescript
dispose(): void {
  logger.appendLine("Disposing...")

  this.controller?.dispose()
  this.backendLauncher?.terminate()
  this.settingsManager?.dispose()

  this.context?.subscriptions.forEach(d => d.dispose())
}
```

### 2. Use Subscriptions

```typescript
// Add to subscriptions for automatic cleanup
context.subscriptions.push(logger)
context.subscriptions.push(command)
context.subscriptions.push(disposable)
```

### 3. Handle Workspace Changes

```typescript
vscode.workspace.onDidChangeConfiguration(async () => {
  // Reload settings
  await this.settingsManager.reload()
})
```

### 4. Async Operations in Activation

```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Always await async initialization
  await extensionInstance.initialize(context)
}
```

## Common Patterns

### Opening a File

```typescript
const document = await vscode.workspace.openTextDocument(uri)
await vscode.window.showTextDocument(document)
```

### Showing Messages

```typescript
vscode.window.showErrorMessage("Error: " + message)
vscode.window.showWarningMessage("Warning: " + message)
vscode.window.showInformationMessage("Info: " + message)
```

### File Operations

```typescript
// Read
const bytes = await vscode.workspace.fs.readFile(uri)
const content = Buffer.from(bytes).toString('utf-8')

// Write
await vscode.workspace.fs.writeFile(uri, Buffer.from(content))

// Stat
const stat = await vscode.workspace.fs.stat(uri)
```

### Getting Active Editor

```typescript
const editor = vscode.window.activeTextEditor
if (editor) {
  const document = editor.document
  const filePath = document.uri.fsPath
}
```

## Debugging Extension

### Using Console

```typescript
console.log("Extension activated")
console.error("Error:", error)
```

### Using Output Channel

```typescript
logger.appendLine("Initialization complete")
```

### Extension Development Host

Run with F5 or:
```bash
code --extensionDevelopmentPath=/path/to/extension
```

## Testing

Run tests:
```bash
npm test
```

Run specific test:
```bash
npm run test:script
```
