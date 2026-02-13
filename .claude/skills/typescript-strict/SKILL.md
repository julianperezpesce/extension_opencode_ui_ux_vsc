---
name: typescript-strict
description: TypeScript strict mode patterns and conventions for OpenCode DragonFu extension. Includes type definitions, interfaces, async patterns, and common pitfalls to avoid.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# TypeScript Strict Mode Guide

This project uses strict TypeScript configuration. All code must follow these patterns.

## TypeScript Configuration

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "noImplicitThis": true
}
```

## Always Define Types

### ❌ DON'T use implicit `any`
```typescript
// BAD
function processData(data) {
  return data.name;
}
```

### ✅ DO define types explicitly
```typescript
// GOOD
interface UserData {
  name: string;
  age: number;
}

function processData(data: UserData): string {
  return data.name;
}
```

## Use Interface over Type for Objects

### ❌ DON'T use type for object shapes
```typescript
// BAD
type User = {
  id: number;
  name: string;
};
```

### ✅ DO use interface
```typescript
// GOOD
interface User {
  id: number;
  name: string;
}
```

## Nullable Types

### ❌ DON'T use `| null` unnecessarily
```typescript
// BAD
function getName(user: User | null): string | null {
  return user?.name ?? null;
}
```

### ✅ DO use optional chaining and nullish coalescing
```typescript
// GOOD
function getName(user: User | null): string {
  return user?.name ?? 'Unknown';
}
```

## Async/Await Patterns

### ❌ DON'T use raw Promises when not needed
```typescript
// BAD
function fetchData(): Promise<Data> {
  return new Promise((resolve, reject) => {
    // complex logic
  });
}
```

### ✅ DO use async/await
```typescript
// GOOD
async function fetchData(): Promise<Data> {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch: ${error}`);
  }
}
```

## Optional Parameters

### ❌ DON'T use `| undefined`
```typescript
// BAD
function greet(name: string | undefined): string {
  return `Hello, ${name ?? 'World'}`;
}
```

### ✅ DO use optional parameter with `?`
```typescript
// GOOD
function greet(name?: string): string {
  return `Hello, ${name ?? 'World'}`;
}
```

## Return Types

### ❌ DON'T omit return types for functions
```typescript
// BAD
function calculate(a: number, b: number) {
  return a + b;
}
```

### ✅ DO always define return types
```typescript
// GOOD
function calculate(a: number, b: number): number {
  return a + b;
}
```

## Common Patterns in This Project

### State Management
```typescript
@state()
private messages: ChatMessage[] = [];

@state()
private inputValue = '';
```

### Property Definitions
```typescript
@property({ type: Boolean })
isThinking = false;

@property({ type: String })
initialTheme = 'dragonfu';
```

### Event Handlers
```typescript
private handleClick(event: MouseEvent): void {
  event.preventDefault();
  // handler logic
}
```

## Error: "Object literal may only specify known properties"

This error occurs when adding properties not defined in the interface.

### Solution
1. Check the interface definition
2. Add the property to the interface
3. Or use type assertion if property is dynamically added

```typescript
// If you need to add dynamic properties:
const message = {
  type: 'chat.send',
  text: content,
  timestamp: Date.now(),
  // Add unknown property:
} as UnifiedMessage & { [key: string]: unknown };
```

## Error: "Expression is always true/false"

This happens with strict null checks.

### Solution
```typescript
// BAD
if (this.connection) {
  this.connection.send(data);
}

// GOOD - use optional chaining
this.connection?.send(data);
```

## Running Type Check

```bash
npm run compile
```

This runs `tsc -p ./` which validates all TypeScript files.
