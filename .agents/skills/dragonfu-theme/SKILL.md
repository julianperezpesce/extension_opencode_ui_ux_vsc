---
name: dragonfu-theme
description: DragonFu theme implementation for OpenCode extension. Includes CSS variables, color scheme, component styling, and webview theming.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# DragonFu Theme Guide

The DragonFu theme is a dark/neon aesthetic for the OpenCode extension webview.

## Color Scheme

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Neon Cyan | `#00f3ff` | Assistant messages, borders |
| Neon Magenta/Fuchsia | `#ff00ff` | Active toggles, highlights |
| Neon Yellow | `#ffee00` | Warnings, folder icons |
| Neon Green | `#00ff88` | Success, code icons |
| Neon Purple | `#bf00ff` | Accents |

### Background Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Dark Base | `#0d0d0d` | Main background |
| Dark Surface | `#1a1a1a` | Cards, panels |
| Dark Elevated | `#252525` | Elevated elements |

### Text Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Text | `#ffffff` | Main text |
| Secondary Text | `#b0b0b0` | Descriptions |
| Muted Text | `#666666` | Placeholders |

## CSS Variables

### Global Variables (styles.css)

```css
:root {
  /* Neon colors */
  --dragonfu-neon-cyan: #00f3ff;
  --dragonfu-neon-magenta: #ff00ff;
  --dragonfu-neon-yellow: #ffee00;
  --dragonfu-neon-green: #00ff88;
  --dragonfu-neon-purple: #bf00ff;

  /* Backgrounds */
  --dragonfu-bg-base: #0d0d0d;
  --dragonfu-bg-surface: #1a1a1a;
  --dragonfu-bg-elevated: #252525;

  /* Glow effects */
  --dragonfu-glow-cyan: 0 0 10px rgba(0, 243, 255, 0.5);
  --dragonfu-glow-magenta: 0 0 10px rgba(255, 0, 255, 0.5);
  --dragonfu-glow-green: 0 0 10px rgba(0, 255, 136, 0.5);
}
```

## Webview Theme Application

### Initial Theme Load

The theme is applied via message from extension:

```typescript
// Extension sends theme
this.communicationBridge.sendMessage({
  type: "theme.update",
  theme: "dragonfu"
})
```

### Webview Receives Theme

```typescript
// main.ts
case "theme.update":
  if (message.theme === "dragonfu") {
    document.body.classList.add("dragonfu-theme")
  }
  break
```

## Component Styling

### Chat Messages

```css
.message.user {
  background-color: var(--vscode-editor-background);
  border-right: 3px solid var(--dragonfu-neon-cyan);
}

.message.assistant {
  background-color: var(--vscode-editor-inactiveSelectionBackground);
  border-left: 3px solid var(--dragonfu-neon-cyan);
  box-shadow: var(--dragonfu-glow-cyan);
}
```

### Context Badges

```css
.context-badge.file {
  border-left-color: var(--dragonfu-neon-cyan);
  background-color: rgba(0, 243, 255, 0.1);
}

.context-badge.folder {
  border-left-color: var(--dragonfu-neon-yellow);
  background-color: rgba(255, 238, 0, 0.1);
}

.context-badge.code {
  border-left-color: var(--dragonfu-neon-green);
  background-color: rgba(0, 255, 136, 0.1);
}
```

### Toggle Button

```css
.toggle-btn {
  background-color: #333;
  color: #888;
}

.toggle-btn.active {
  background-color: var(--dragonfu-neon-magenta);
  box-shadow: var(--dragonfu-glow-magenta);
  color: white;
}
```

### Thinking Indicator

```css
.message.assistant.thinking {
  border-left: 3px solid var(--dragonfu-neon-purple);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## Using Theme in Components

### Via :host-context

```css
:host-context(.dragonfu-theme) .element {
  border-color: var(--dragonfu-neon-cyan);
}
```

### Via Global CSS

```css
.dragonfu-theme .chat-container {
  background-color: var(--dragonfu-bg-base);
}

.dragonfu-theme .message.assistant {
  border-left-color: var(--dragonfu-neon-cyan);
}
```

## Glow Effects

### Subtle Glow

```css
.glow-subtle {
  box-shadow: 0 0 5px rgba(0, 243, 255, 0.3);
}
```

### Medium Glow

```css
.glow-medium {
  box-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
}
```

### Strong Glow

```css
.glow-strong {
  box-shadow: 0 0 20px rgba(255, 0, 255, 0.7);
}
```

## VS Code Theme Integration

The webview uses VS Code theme variables alongside DragonFu:

```css
/* VS Code variables */
--vscode-editor-background
--vscode-editor-foreground
--vscode-activityBar-activeBorder
--vscode-badge-background
--vscode-badge-foreground

/* DragonFu overrides */
.dragonfu-theme {
  --vscode-editor-background: var(--dragonfu-bg-base);
}
```

## Adding New Components

When adding new UI components, always include DragonFu styling:

```typescript
// In Lit component styles
static styles = css`
  :host {
    display: block;
  }

  .element {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border);
  }

  :host-context(.dragonfu-theme) .element {
    border-color: var(--dragonfu-neon-cyan);
    box-shadow: var(--dragonfu-glow-cyan);
  }
`
```

## Theme Toggle

Currently the theme is set from extension but could be made toggleable:

```typescript
// In WebviewController
const config = vscode.workspace.getConfiguration('opencode')
const theme = config.get('theme', 'dragonfu')

this.communicationBridge.sendMessage({
  type: "theme.update",
  theme: theme
})
```

## Best Practices

1. **Always use VS Code variables as fallback**
   ```css
   color: var(--vscode-editor-foreground, #fff)
   ```

2. **Add glow effects sparingly**
   - Too many glows reduce impact

3. **Use theme context for conditional styling**
   ```css
   :host-context(.dragonfu-theme) { ... }
   ```

4. **Test both light and dark VS Code themes**
   - Ensure readability in both

## File Locations

- Main styles: `src/webview/styles.css`
- Component styles: `src/webview/components/*.ts`
- Theme config: `package.json` → `opencode.theme`
