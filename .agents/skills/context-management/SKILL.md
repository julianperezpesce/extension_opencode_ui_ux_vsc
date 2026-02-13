---
name: context-management
description: Context management system for OpenCode DragonFu extension. Includes adding files, drag-drop, path resolution, and sending context to backend.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# Context Management Guide

The context management system allows users to add files, folders, and code snippets to the chat context.

## Architecture Overview

```
User Action
    │
    ├─► Click Right → AddToContextCommand → PathInserter → CommunicationBridge → Webview
    │
    ├─► Button "📄 +" → context.addCurrentFile → CommunicationBridge → insertPaths → Webview
    │
    ├─► Browse → context.requestFile → showOpenDialog → insertPaths → Webview
    │
    └─► Drag & Drop → context.addFile → CommunicationBridge → Webview
```

## Adding Files to Context

### Method 1: Click Right (Explorer)

```typescript
// AddToContextCommand.ts
static async handleExplorerContext(uri: vscode.Uri): Promise<void> {
  const paths = await this.collectFilePaths(uri)
  PathInserter.insertPaths(paths)
}
```

### Method 2: Click Right (Editor)

```typescript
// AddToContextCommand.ts
static async handleEditorContext(): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor
  if (activeEditor) {
    const filePath = activeEditor.document.uri.fsPath
    PathInserter.insertPaths([filePath])
  }
}
```

### Method 3: Chat Button

```typescript
// chat-view.ts → addCurrentFileToContext()
vscode.postMessage({
  type: 'context.addCurrentFile'
})

// CommunicationBridge.ts → context.addCurrentFile
const activeEditor = vscode.window.activeTextEditor
const filePath = activeEditor.document.uri.fsPath
this.insertPaths([filePath])
```

### Method 4: Browse Files

```typescript
// CommunicationBridge.ts → context.requestFile
const files = await vscode.window.showOpenDialog({
  canSelectFiles: true,
  canSelectFolders: true,
  canSelectMany: true
})
const paths = files.map(f => f.fsPath)
this.insertPaths(paths)
```

### Method 5: Drag & Drop

```typescript
// chat-view.ts → handleDrop()
this.requestAddFileToContext(filePath, name)

// CommunicationBridge.ts → context.addFile
const normalized = this.normalizePath(filePath)
this.insertPaths([normalized])
```

## Path Resolution

### Problem

Files can come as:
- Relative: `package.json`
- Absolute: `/home/julian/project/package.json`
- POSIX: `/home/julian/project/package.json`

### Solution: resolveContextPath

```typescript
private async resolveContextPath(rawPath: string): Promise<string | null> {
  // 1. If already absolute, use it
  if (path.isAbsolute(resolvedPath)) {
    return path.normalize(resolvedPath)
  }

  // 2. Try workspace folders
  for (const folder of workspaceFolders) {
    const candidate = path.join(folder.uri.fsPath, resolvedPath)
    if (await fileExists(candidate)) {
      return path.normalize(candidate)
    }
  }

  // 3. Fallback paths for development mode
  const fallback = path.join("/home/julian", resolvedPath)
  // ...
}
```

## Sending Context with Messages

### Webview → Extension

```typescript
// chat-view.ts → sendMessage()
vscode.postMessage({
  type: 'chat.send',
  text: content,
  context: contextItems,
  options: { includeFullContext: boolean }
})
```

### Extension → Backend

```typescript
// WebviewController.ts → handleChatSend()
const parts = [{ type: "text", text }]

for (const item of context) {
  if (item.type === 'file') {
    const resolvedPath = await this.resolveContextPath(item.path)
    const content = await this.readFileContent(resolvedPath)

    // Truncate if needed
    const maxLength = config.get("context.maxFileChars", 50000)
    const truncated = content.length > maxLength
      ? content.slice(0, maxLength) + "\n[...truncated...]"
      : content

    parts.push({
      type: 'text',
      text: `\n\n[Context: ${item.path}]\n\`\`\`\n${truncated}\n\`\`\``
    })
  }
}

// Send to OpenCode backend
await fetch(`${baseUrl}/session/${sessionId}/prompt_async`, {
  method: "POST",
  body: JSON.stringify({ parts })
})
```

## Context Item Structure

```typescript
interface ContextItem {
  id: string
  type: 'file' | 'folder' | 'code'
  path: string
  name: string
  lineStart?: number
  lineEnd?: number
  content?: string
}
```

## Configuration

### Max File Chars

In `package.json`:

```json
{
  "configuration": {
    "properties": {
      "opencode.context.maxFileChars": {
        "type": "number",
        "default": 50000,
        "description": "Max characters to include from context file"
      }
    }
  }
}
```

Usage:

```typescript
const config = vscode.workspace.getConfiguration("opencode")
const maxLength = config.get<number>("context.maxFileChars", 50000)
```

## UI Components

### Context Badges

```typescript
// chat-view.ts
this.contextItems.map(item => html`
  <div class="context-badge ${item.type}">
    ${item.type === 'file' ? '📄' : '📁'}
    <span>${item.name}</span>
    <span class="remove-btn" @click="${() => removeContextItem(item.id)}">×</span>
  </div>
`)
```

### Toggle Full/None

```typescript
// Toggle state
@state()
private includeFullContext = false

// In render
<button class="toggle-btn ${this.includeFullContext ? 'active' : ''}"
    @click="${this.toggleFullContext}">
  ${this.includeFullContext ? '●' : '○'}
  ${this.includeFullContext ? 'Full' : 'None'}
</button>
```

## Flow Summary

1. **User adds file** → PathInserter.insertPaths(paths)
2. **CommunicationBridge** normalizes and sends to webview
3. **Webview** displays as badge in input area
4. **User sends message** → context sent with message
5. **WebviewController** resolves paths, reads content
6. **Content** sent to OpenCode backend with prompt

## Adding New Context Methods

To add a new way to add context:

1. Add handler in `CommunicationBridge.ts`
2. Send message type from webview if needed
3. Use `insertPaths()` to add to webview
4. Webview automatically displays badge

Example:

```typescript
case "context.addUrl":
  const url = message.url
  // Fetch URL content
  const content = await fetch(url).then(r => r.text())
  // Add as context
  this.insertPaths([url])
  break
```
