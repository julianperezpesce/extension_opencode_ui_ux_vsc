---
name: logging
description: Centralized logging patterns for OpenCode DragonFu extension. Includes logger usage, console patterns, and debugging techniques.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# Logging Guide

This project uses a centralized logger for extension-side logging and console.log for webview-side logging.

## Extension Side: Using Logger

### Import the Logger

```typescript
import { logger } from "../globals"
```

### Basic Logging

```typescript
// Information
logger.appendLine("Operation started")

// With interpolation
logger.appendLine(`Processing ${count} items`)

// Errors
logger.appendLine(`Error occurred: ${error}`)
```

### Logging Best Practices

1. **Log significant lifecycle events**
```typescript
logger.appendLine("Initializing OpenCode extension...")
logger.appendLine("Core components initialized")
logger.appendLine("Extension commands registered successfully")
```

2. **Log before risky operations**
```typescript
logger.appendLine(`Reading file: ${filePath}`)
const content = await readFile(filePath)
logger.appendLine(`File read successfully: ${content.length} bytes`)
```

3. **Log errors with context**
```typescript
logger.appendLine(`Error in handleChatSend: ${errorMessage}`)
logger.appendLine(`Stack: ${errorStack}`)
```

4. **Log state changes**
```typescript
logger.appendLine(`Settings changed: ${JSON.stringify(settings)}`)
logger.appendLine(`Webview visibility changed: ${visible}`)
```

## Webview Side: Using Console

### Console Methods

```typescript
// Standard logging
console.log('[ChatView] Message received:', message)

// Debug info
console.log('[Main] Processing message type:', message?.type)

// Warnings
console.warn('[Webview] Invalid state:', state)

// Errors
console.error('[Webview] Error processing:', error)
```

### Webview Message Flow Logging

Always prefix webview logs with context:

```typescript
// From extension to webview
console.log('[CommunicationBridge] Sending message:', message)

// From webview to extension
console.log('[ChatView] Posting message:', message)

// Event handling
console.log('[ChatView] Processing event:', event.type)
```

## VS Code Output Channel

### Accessing Logs

1. Open VS Code
2. Go to **View > Output**
3. Select **OpenCode** from the dropdown

### Common Log Patterns

```
[WebviewController] handleChatSend: hola with 1 context items
[CommunicationBridge] Chat send case matched
[CommunicationBridge] Executing callback with context
[WebviewController] resolveContextPath (absolute): /path/to/file -> /path/to/file
[WebviewController] Added file context: /path/to/file
```

## Debugging Tips

### Enable Debug Logging

Add verbose logging in critical paths:

```typescript
// Detailed path resolution logging
logger.appendLine(`[WebviewController] resolveContextPath START: "${rawPath}"`)
logger.appendLine(`[WebviewController] resolveContextPath: workspaceFolders = ${JSON.stringify(ws)}`)
logger.appendLine(`[WebviewController] resolveContextPath (workspace): "${rawPath}" -> "${resolved}"`)
```

### Console Debugging in Webview

Open DevTools in VS Code:
1. Right-click in webview
2. Select **Inspect**
3. Use Console tab for logging

### Network Debugging

For HTTP/SSE issues:

```typescript
logger.appendLine(`Connecting to event stream: ${eventUrl}`)
logger.appendLine(`Event stream connected (status: ${res.statusCode})`)
logger.appendLine(`Received event: ${event.type}`)
```

## Logging Conventions

### Prefix Standards

| Component | Prefix |
|-----------|--------|
| WebviewController | `[WebviewController]` |
| CommunicationBridge | `[CommunicationBridge]` |
| ChatView | `[ChatView]` |
| Main (webview) | `[Main]` |
| BackendLauncher | `[BackendLauncher]` |
| FileMonitor | `[FileMonitor]` |

### Log Levels (Implied)

- **ERROR**: Error messages with stack traces
- **INFO**: Operation starts/completes, state changes
- **DEBUG**: Detailed flow, path resolution, etc.

### Message Format

```
[Component] Action: Details
```

Examples:
```
[WebviewController] handleChatSend: analyze file... with 1 context items
[CommunicationBridge] context.addCurrentFile received
[ChatView] Context item added: {id, path, type}
```

## Console vs Logger

| Aspect | console.log | logger.appendLine |
|--------|-------------|-------------------|
| Location | Browser DevTools | VS Code Output |
| Use for | Webview debugging | Extension debugging |
| Format | JSON/prettified | Plain text |
| Persistence | Session only | Full log |

## Example: Complete Logging Flow

```typescript
import { logger } from "../globals"

// Extension side
logger.appendLine("Starting operation...")

try {
  logger.appendLine(`Processing file: ${filePath}`)
  const result = await processFile(filePath)
  logger.appendLine(`Operation completed: ${result}`)
} catch (error) {
  logger.appendLine(`ERROR: ${error}`)
  throw error
}
```

```typescript
// Webview side
console.log('[ChatView] Attempting to send message:', text)
try {
  vscode.postMessage({ type: 'chat.send', text, context })
  console.log('[ChatView] Message posted successfully')
} catch (err) {
  console.error('[ChatView] Error posting message:', err)
}
```

## Log Output Locations

1. **Extension Host**: View > Output > OpenCode
2. **Webview**: Right-click > Inspect > Console
3. **Backend**: Terminal where `opencode serve` is running

## Finding Logs

Search for specific patterns:
- `handleChatSend` - Chat message handling
- `resolveContextPath` - Context path resolution
- `insertPaths` - Context insertion
- `Event stream` - SSE connection issues
