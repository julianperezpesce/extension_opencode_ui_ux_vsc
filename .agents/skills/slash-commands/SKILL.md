---
name: slash-commands
description: Implementation of slash commands (/explain, /fix, /test) for OpenCode DragonFu extension. Includes command detection, editor selection, and prompt building patterns.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# Slash Commands Guide

Implementation of slash commands for the OpenCode DragonFu extension.

## Command Format

Commands start with `/` followed by the command name:

```
/explain
/fix
/test
```

## Architecture Overview

```
User types /explain in chat
       ↓
Webview detects command (parseSlashCommand)
       ↓
Webview sends 'editor.getSelection' to extension
       ↓
CommunicationBridge handles request
       ↓
Gets selection from active editor
       ↓
Returns selection to webview via 'editor.selection'
       ↓
Webview builds prompt with selection
       ↓
Sends to OpenCode backend
```

## Webview Implementation

### Detect Slash Command

```typescript
private parseSlashCommand(text: string): SlashCommand | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');
    return { command, args: args || undefined };
  }
  return null;
}
```

### Get Selection

```typescript
private requestEditorSelection(): void {
  vscode.postMessage({
    type: 'editor.getSelection'
  });
}
```

### Build Prompt

```typescript
private buildSlashCommandPrompt(command: SlashCommand, selection: EditorSelection): string {
  const codeContext = selection.text;

  switch (command.command) {
    case 'explain':
      return `Explica el siguiente código:\n\n\`\`\`\n${codeContext}\n\`\`\``;
    case 'fix':
      return `Encuentra y corrige los errores en el siguiente código:\n\n\`\`\`\n${codeContext}\n\`\`\``;
    case 'test':
      return `Genera tests unitarios para el siguiente código:\n\n\`\`\`\n${codeContext}\n\`\`\``;
    default:
      return `/${command.command} ${command.args || ''}`.trim();
  }
}
```

## Extension Implementation

### CommunicationBridge Handler

```typescript
case "editor.getSelection":
  try {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const filePath = editor.document.uri.fsPath;
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      this.sendMessage({
        type: 'editor.selection',
        selection: {
          text: selectedText,
          filePath: filePath,
          startLine: startLine,
          endLine: endLine
        },
        timestamp: Date.now()
      });
    } else {
      this.sendMessage({
        type: 'editor.selection',
        selection: null,
        timestamp: Date.now()
      });
    }
  } catch (e) {
    this.sendMessage({
      type: 'editor.selection',
      selection: null,
      timestamp: Date.now()
    });
  }
  break;
```

## Getting Editor Selection

```typescript
import * as vscode from 'vscode';

const editor = vscode.window.activeTextEditor;
if (editor) {
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const filePath = editor.document.uri.fsPath;
  const startLine = selection.start.line + 1; // 1-based
  const endLine = selection.end.line + 1;     // 1-based
}
```

## Message Types

### Webview → Extension

```typescript
{
  type: 'editor.getSelection'
}
```

### Extension → Webview

```typescript
{
  type: 'editor.selection',
  selection: {
    text: string,
    filePath?: string,
    startLine?: number,
    endLine?: number
  } | null,
  timestamp: number
}
```

## State Management

```typescript
@state()
private pendingSlashCommand: SlashCommand | null = null;

@state()
private waitingForSelection = false;
```

## Flow Summary

1. User types `/explain` in chat input
2. `sendMessage()` detects command starts with `/`
3. Sets `pendingSlashCommand` and `waitingForSelection = true`
4. Sends `editor.getSelection` to extension
5. Extension gets selection from `vscode.window.activeTextEditor`
6. Extension returns selection via `editor.selection` message
7. Webview receives selection, clears `waitingForSelection`
8. Builds prompt with selection text
9. Sends to OpenCode backend

## Adding New Commands

To add a new command like `/refactor`:

1. Add case to `buildSlashCommandPrompt`:
```typescript
case 'refactor':
  return `Refactoriza el siguiente código de forma eficiente:\n\n\`\`\`\n${codeContext}\n\`\`\``;
```

2. Update command list documentation

## Edge Cases

- **No active editor**: Return null selection, send command anyway
- **Empty selection**: Send command without selection context
- **Multiple selections**: VS Code API returns first selection only
- **Read-only file**: Selection works but apply won't work

## Error Handling

```typescript
if (!editor) {
  this.sendMessage({
    type: 'editor.selection',
    selection: null,
    timestamp: Date.now()
  });
  return;
}
```

## Testing

Test scenarios:
1. Command with selection
2. Command without selection
3. Command without active editor
4. Non-command message