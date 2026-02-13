---
name: error-handling
description: Centralized error handling patterns for OpenCode DragonFu extension. Includes ErrorHandler usage, error categories, severity levels, and best practices.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# Error Handling Guide

This project uses a centralized ErrorHandler utility. All errors should go through this system for consistent handling.

## Error Categories

Use the appropriate category for each error type:

```typescript
enum ErrorCategory {
  COMMAND_EXECUTION = "commandExecution",
  NETWORK = "network",
  FILE_OPERATION = "fileOperation",
  BACKEND_LAUNCH = "backendLaunch",
  WEBVIEW_LOAD = "webviewLoad",
  COMMUNICATION = "communication",
  UNKNOWN = "unknown"
}
```

## Error Severity Levels

```typescript
enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical"
}
```

## Using ErrorHandler

### Basic Error Handling

```typescript
import { errorHandler } from "../utils/ErrorHandler"
import { logger } from "../globals"

try {
  // risky operation
} catch (error) {
  await errorHandler.handleError(
    errorHandler.createErrorContext(
      ErrorCategory.COMMAND_EXECUTION,
      ErrorSeverity.ERROR,
      "ClassName",
      "methodName",
      error instanceof Error ? error : new Error(String(error)),
      { contextParam: "value" }
    )
  )
}
```

### File Operation Errors

```typescript
import { errorHandler } from "../utils/ErrorHandler"

try {
  await vscode.workspace.fs.readFile(uri)
} catch (error) {
  await errorHandler.handleFileOperationError(
    error instanceof Error ? error : new Error(String(error)),
    {
      operation: "readFile",
      filePath: uri.fsPath,
      hasUri: true
    }
  )
}
```

### Backend Launch Errors

```typescript
try {
  await backendLauncher.launchBackend()
} catch (error) {
  await errorHandler.handleBackendLaunchError(error, {
    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  })
}
```

### Webview Load Errors

```typescript
try {
  await webviewController.load(connection)
} catch (error) {
  await errorHandler.handleWebviewLoadError(error instanceof Error ? error : new Error(String(error)))
}
```

## Creating Error Context

Always include contextual information:

```typescript
const context = errorHandler.createErrorContext(
  ErrorCategory.NETWORK,
  ErrorSeverity.ERROR,
  "WebviewController",
  "handleChatSend",
  error instanceof Error ? error : new Error(String(error)),
  {
    sessionId: this.sessionId,
    messageLength: text.length,
    hasContext: context?.length > 0
  }
)
```

## User-Facing Errors

For errors that users should see:

```typescript
vscode.window.showErrorMessage(`Failed to send message: ${errorMessage}`)
```

For warnings:

```typescript
vscode.window.showWarningMessage("No active file available to add to context")
```

For informational messages:

```typescript
vscode.window.showInformationMessage("File added to context successfully")
```

## Best Practices

### 1. Always Use ErrorHandler
- Don't catch errors silently
- Pass all errors through errorHandler

### 2. Include Context
- Add relevant information to help debug
- Include file paths, operation names, etc.

### 3. Use Appropriate Category
- NETWORK for HTTP/connection errors
- FILE_OPERATION for file system errors
- COMMAND_EXECUTION for VS Code command failures
- COMMUNICATION for message passing issues

### 4. Handle Async Errors
- Always await errorHandler calls
- Errors in async functions can be unhandled

### 5. Log Before Handling
- Use logger.appendLine() for debugging context

```typescript
logger.appendLine(`Error in operation: ${error}`)
await errorHandler.handleError(...)
```

## Common Error Patterns

### Network Errors
```typescript
case "fetch failed":
  await errorHandler.handleError(
    errorHandler.createErrorContext(
      ErrorCategory.NETWORK,
      ErrorSeverity.ERROR,
      "WebviewController",
      "handleChatSend",
      error,
      { url: apiUrl, status: response.status }
    )
  )
```

### File Not Found
```typescript
case "EntryNotFound":
  await errorHandler.handleFileOperationError(error, {
    operation: "readFile",
    filePath: fileUri.fsPath
  })
```

### Permission Denied
```typescript
case "PermissionDenied":
  await errorHandler.handleFileOperationError(error, {
    operation: "writeFile",
    filePath: fileUri.fsPath
  })
```

## Error Handler Location

The ErrorHandler is located at:
- `/src/utils/ErrorHandler.ts`

## Example: Complete Error Handling

```typescript
import * as vscode from "vscode"
import { errorHandler } from "../utils/ErrorHandler"
import { ErrorCategory, ErrorSeverity } from "../utils/ErrorHandler"
import { logger } from "../globals"

async function riskyOperation(uri: vscode.Uri): Promise<string> {
  try {
    logger.appendLine(`Reading file: ${uri.fsPath}`)
    const bytes = await vscode.workspace.fs.readFile(uri)
    return Buffer.from(bytes).toString('utf-8')
  } catch (error) {
    logger.appendLine(`Error reading file: ${error}`)

    await errorHandler.handleFileOperationError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: "readFile",
        filePath: uri.fsPath,
        hasUri: true
      }
    )

    throw error // Re-throw after handling
  }
}
```
