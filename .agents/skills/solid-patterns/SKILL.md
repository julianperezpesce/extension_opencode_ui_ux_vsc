---
name: solid-patterns
description: SOLID principles and best practices for OpenCode DragonFu extension. Includes single responsibility, dependency injection, and clean architecture patterns.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  project: extension_opencode_ui_ux_vsc
---

# SOLID Principles & Best Practices

This guide covers SOLID principles and architecture patterns used in the OpenCode DragonFu extension.

## Single Responsibility Principle (SRP)

### Definition
A class should have only one reason to change.

### Good Examples

```typescript
// BAD - Multiple responsibilities
class UserManager {
  saveUser(user: User) { /* save to DB */ }
  sendEmail(user: User) { /* send email */ }
  generateReport(user: User) { /* generate report */ }
}

// GOOD - Separate responsibilities
class UserRepository {
  saveUser(user: User): Promise<void> { /* save to DB */ }
}

class UserNotifier {
  sendEmail(user: User): Promise<void> { /* send email */ }
}

class UserReporter {
  generateReport(user: User): string { /* generate report */ }
}
```

### In This Project

```typescript
// Each class has one responsibility
class BackendLauncher     // Only manages backend process
class WebviewController    // Only manages webview lifecycle
class CommunicationBridge // Only handles message passing
class FileMonitor         // Only monitors file changes
```

## Open/Closed Principle (OCP)

### Definition
Software entities should be open for extension but closed for modification.

### Example

```typescript
// BAD - Must modify to add new message types
class MessageHandler {
  handleMessage(msg: Message) {
    if (msg.type === 'chat') this.handleChat(msg)
    else if (msg.type === 'file') this.handleFile(msg)
    // Need to modify every time
  }
}

// GOOD - Add new handlers without modifying existing code
interface MessageHandler {
  canHandle(msg: Message): boolean
  handle(msg: Message): Promise<void>
}

class ChatMessageHandler implements MessageHandler {
  canHandle(msg: Message) { return msg.type === 'chat' }
  handle(msg: Message) { /* handle chat */ }
}

class MessageProcessor {
  private handlers: MessageHandler[] = []

  addHandler(handler: MessageHandler) {
    this.handlers.push(handler)
  }

  async process(msg: Message) {
    for (const handler of this.handlers) {
      if (handler.canHandle(msg)) {
        return handler.handle(msg)
      }
    }
  }
}
```

## Liskov Substitution Principle (LSP)

### Definition
Objects of a superclass should be replaceable with objects of its subclasses.

### Example

```typescript
interface Repository<T> {
  save(item: T): Promise<void>
  findById(id: string): Promise<T | null>
}

class UserRepository implements Repository<User> {
  async save(user: User): Promise<void> { /* ... */ }
  async findById(id: string): Promise<User | null> { /* ... */ }
}

class InMemoryUserRepository implements Repository<User> {
  async save(user: User): Promise<void> { /* ... */ }
  async findById(id: string): Promise<User | null> { /* ... */ }
}

// Can swap implementations without breaking
function useRepository(repo: Repository<User>) {
  // Works with both implementations
}
```

## Interface Segregation Principle (ISP)

### Definition
Prefer small, specific interfaces over large, general ones.

### Example

```typescript
// BAD - Large interface
interface Service {
  connect(): void
  disconnect(): void
  sendMessage(msg: string): void
  receiveMessage(): string
  // Many methods not needed by all clients
}

// GOOD - Small, focused interfaces
interface Connectable {
  connect(): void
  disconnect(): void
}

interface Messagable {
  sendMessage(msg: string): void
  receiveMessage(): string
}

class ChatService implements Connectable, Messagable {
  // Implement only what we need
}
```

## Dependency Inversion Principle (DIP)

### Definition
Depend on abstractions, not on concretions.

### Example

```typescript
// BAD - Direct dependency on concrete class
class WebviewController {
  private logger = new Logger()  // Hard to swap

  sendMessage(text: string) {
    this.logger.log(text)
    // ...
  }
}

// GOOD - Depend on abstraction
class WebviewController {
  private logger: Logger  // Interface, not concrete

  constructor(logger: Logger) {
    this.logger = logger
  }

  sendMessage(text: string) {
    this.logger.log(text)
    // ...
  }
}

interface Logger {
  log(message: string): void
}

class ConsoleLogger implements Logger {
  log(message: string) { console.log(message) }
}

class FileLogger implements Logger {
  log(message: string) { /* write to file */ }
}
```

### In This Project

```typescript
// SettingsManager is injected, not hardcoded
class ActivityBarProvider {
  constructor(
    private backendLauncher: BackendLauncher,
    private settingsManager: SettingsManager
  ) {}
}
```

## Additional Patterns

### Singleton (Use Sparingly)

```typescript
class ErrorHandler {
  private static instance: ErrorHandler

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  private constructor() {} // Prevent instantiation
}
```

### Factory Pattern

```typescript
interface WebviewFactory {
  create(): Webview
}

class ActivityBarFactory implements WebviewFactory {
  create(): Webview {
    return new ActivityBarWebview()
  }
}
```

### Observer Pattern

```typescript
class EventEmitter<T> {
  private listeners: ((data: T) => void)[] = []

  subscribe(listener: (data: T) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  emit(data: T) {
    this.listeners.forEach(l => l(data))
  }
}

// Usage in FileMonitor
class FileMonitor {
  private changeEmitter = new EventEmitter<FileChange>()

  onFilesChanged(callback: (files: string[]) => void) {
    return this.changeEmitter.subscribe(callback)
  }
}
```

### Builder Pattern

```typescript
class MessageBuilder {
  private message: Message = { type: 'text', content: '' }

  setType(type: string): this {
    this.message.type = type
    return this
  }

  setContent(content: string): this {
    this.message.content = content
    return this
  }

  setContext(context: ContextItem[]): this {
    this.message.context = context
    return this
  }

  build(): Message {
    return { ...this.message }
  }
}

// Usage
const message = new MessageBuilder()
  .setType('chat.send')
  .setContent('Hello')
  .setContext([])
  .build()
```

## Code Organization

### File Structure

```
src/
├── domain/           # Business logic
│   ├── entities/
│   └── services/
├── infrastructure/   # External concerns
│   ├── http/
│   └── storage/
├── ui/              # UI components
│   ├── components/
│   └── controllers/
└── application/     # Use cases
```

### Class Organization

```typescript
// 1. Imports
import * as vscode from "vscode"
import { logger } from "../globals"

// 2. Interfaces
interface MyInterface {
  method(): Promise<void>
}

// 3. Types
type MyType = string | number

// 4. Constants
const DEFAULT_TIMEOUT = 5000

// 5. Class
export class MyClass implements MyInterface {
  // Private fields
  private disposed = false

  // Constructor
  constructor(private dependency: Dependency) {}

  // Public methods
  async method(): Promise<void> {
    // implementation
  }

  // Private methods
  private helper(): void {
    // implementation
  }

  // Cleanup
  dispose(): void {
    this.disposed = true
  }
}
```

## Naming Conventions

### Classes
```typescript
// PascalCase
class WebviewController
class ChatMessage
class ErrorHandler
```

### Methods
```typescript
// camelCase with verbs
async handleChatSend(text: string): Promise<void>
function processData(): void
getUserById(id: string): User | null
```

### Variables
```typescript
// camelCase
const userName = "John"
const isActive = true
const messageItems = []
```

### Constants
```typescript
// UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
const DEFAULT_TIMEOUT = 5000

// For objects, use static readonly
static readonly DEFAULT_OPTIONS = { ... }
```

## Error Handling Patterns

### Result Type Pattern

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.findUser(id)
    return { ok: true, value: user }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}

// Usage
const result = await fetchUser("123")
if (result.ok) {
  console.log(result.value.name)
} else {
  console.error(result.error.message)
}
```

### Guard Clauses

```typescript
// BAD - Nested conditions
function process(user: User | null) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        // do something
      }
    }
  }
}

// GOOD - Guard clauses
function process(user: User | null) {
  if (!user) return
  if (!user.isActive) return
  if (!user.hasPermission) return

  // do something
}
```

## Testing Patterns

### AAA (Arrange, Act, Assert)

```typescript
test("should add item to context", () => {
  // Arrange
  const contextManager = new ContextManager()

  // Act
  contextManager.addItem({ id: "1", type: "file" })

  // Assert
  expect(contextManager.getItems()).toHaveLength(1)
})
```

### Mocking

```typescript
test("should call logger on error", () => {
  const mockLogger = vi.fn()
  const handler = new ErrorHandler(mockLogger)

  handler.handleError(new Error("test"))

  expect(mockLogger).toHaveBeenCalled()
})
```

## Quick Reference

| Principle | Short Description |
|-----------|------------------|
| SRP | One class = one responsibility |
| OCP | Open for extension, closed for modification |
| LSP | Subclasses can replace parent classes |
| ISP | Small interfaces > large interfaces |
| DIP | Depend on abstractions, not concretions |
