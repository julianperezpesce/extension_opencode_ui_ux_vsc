import * as vscode from "vscode"
import * as path from "path"
import { errorHandler } from "../utils/ErrorHandler"
import { PluginCommunicator, UnifiedMessage } from "../types/UnifiedMessage"
import { logger } from "../globals"
import type { bridgeServer as BridgeServerType } from "./IdeBridgeServer"

/**
 * Communication bridge between VSCode and WebUI
 * Handles bi-directional messaging and state synchronization
 * Combines functionality from multiple JetBrains classes:
 * - PathInserter.kt
 * - FontSizeSynchronizer.kt
 * - SessionCommandSynchronizer.kt
 * - OpenInIdeHandler.kt
 * - WebViewLoadHandler.kt
 */

export interface CommunicationBridgeOptions {
  webview?: vscode.Webview
  context?: vscode.ExtensionContext
  onStateChange?: (key: string, value: any) => Promise<void>
}

export class CommunicationBridge implements PluginCommunicator {
  private webview?: vscode.Webview
  private context?: vscode.ExtensionContext
  private onStateChange?: (key: string, value: any) => Promise<void>
  private messageHandlerDisposable?: vscode.Disposable
  private _bridgeSessionId?: string
  private _bridgeServer?: typeof BridgeServerType

  constructor(options: CommunicationBridgeOptions = {}) {
    this.webview = options.webview
    this.context = options.context
    this.onStateChange = options.onStateChange

    if (this.webview) {
      this.setupMessageHandlers()
    }
  }

  /**
   * Set the webview instance for communication
   * @param webview VSCode webview instance
   */
  setWebview(webview: vscode.Webview): void {
    // Clean up existing message handlers
    if (this.messageHandlerDisposable) {
      this.messageHandlerDisposable.dispose()
    }

    this.webview = webview

    if (webview) {
      this.setupMessageHandlers()
      logger.appendLine("Webview set and message handlers configured")
    } else {
      logger.appendLine("Webview cleared")
    }
  }

  /**
   * Set the extension context
   * @param context VSCode extension context
   */
  setContext(context: vscode.ExtensionContext): void {
    this.context = context
  }

  /**
   * Set the state change callback
   * @param callback Function to handle state changes
   */
  setStateChangeCallback(callback: (key: string, value: any) => Promise<void>): void {
    this.onStateChange = callback
  }

  /**
   * Set bridge session for routing ideBridge-type messages via SSE
   * @param sessionId Bridge session ID
   * @param server Bridge server instance
   */
  setBridgeSession(sessionId: string, server: typeof BridgeServerType): void {
    this._bridgeSessionId = sessionId
    this._bridgeServer = server
    logger.appendLine(`Bridge session set: ${sessionId}`)
  }

  /**
   * Send a message via the bridge server SSE (for ideBridge messages)
   */
  private sendViaBridge(type: string, payload: any): boolean {
    if (this._bridgeSessionId && this._bridgeServer) {
      this._bridgeServer.send(this._bridgeSessionId, { type, payload })
      return true
    }
    return false
  }

  // VSCode → WebUI communication methods

  /**
   * Send a unified message to the webview using postMessage protocol
   * @param message Unified message object
   */
  sendMessage(message: UnifiedMessage): void {
    try {
      if (!this.webview) {
        logger.appendLine("No webview available to send message")
        return
      }

      // Add timestamp if not present
      const messageWithMetadata = {
        ...message,
        timestamp: message.timestamp || Date.now(),
      }

      // Send message using webview.postMessage
      this.webview.postMessage(messageWithMetadata)

      //logger.appendLine(`Sent unified message: ${JSON.stringify(messageWithMetadata)}`);
    } catch (error) {
      logger.appendLine(`Error sending unified message: ${error}`)

      errorHandler.handleCommunicationError(error instanceof Error ? error : new Error(String(error)), {
        operation: "sendMessage",
        messageType: message.type,
      })
    }
  }

  /**
   * Send file paths to the web UI
   * Mirrors PathInserter.kt insertPaths functionality
   * @param paths Array of file paths to insert
   */
  insertPaths(paths: string[]): void {
    try {
      if (!paths || paths.length === 0) {
        logger.appendLine("No paths provided to insert")
        return
      }

      // Validate and normalize paths
      const validPaths = this.validatePaths(paths)

      if (validPaths.length === 0) {
        logger.appendLine("No valid paths to insert after validation")
        vscode.window.showWarningMessage("OpenCode: No valid paths to insert")
        return
      }

      // Route through bridge server SSE (required)
      if (!this.sendViaBridge("insertPaths", { paths: validPaths })) {
        logger.appendLine("Bridge session not set; cannot send insertPaths")
        return
      }

      logger.appendLine(`Inserted ${validPaths.length} paths via bridge: ${validPaths.join(", ")}`)
    } catch (error) {
      logger.appendLine(`Error inserting paths: ${error}`)

      errorHandler.handleCommunicationError(error instanceof Error ? error : new Error(String(error)), {
        operation: "insertPaths",
        paths,
        pathCount: paths?.length,
      })
    }
  }

  /**
   * Send directory path to the web UI for pasting
   * Mirrors PathInserter.kt pastePath functionality
   * @param path Directory path to paste
   */
  pastePath(path: string): void {
    try {
      if (!path || path.trim().length === 0) {
        logger.appendLine("No path provided to paste")
        return
      }

      // Validate and normalize the path
      const normalizedPath = this.normalizePath(path.trim())
      if (!normalizedPath) {
        logger.appendLine(`Invalid path to paste: ${path}`)
        vscode.window.showWarningMessage(`OpenCode: Invalid path - ${path}`)
        return
      }

      // Route through bridge server SSE (required)
      if (!this.sendViaBridge("pastePath", { path: normalizedPath })) {
        logger.appendLine("Bridge session not set; cannot send pastePath")
        return
      }

      logger.appendLine(`Pasted path via bridge: ${normalizedPath}`)
    } catch (error) {
      logger.appendLine(`Error pasting path: ${error}`)

      errorHandler.handleCommunicationError(error instanceof Error ? error : new Error(String(error)), {
        operation: "pastePath",
        path,
      })
    }
  }

  /**
   * Update opened files list in the web UI
   * Mirrors IdeOpenFilesUpdater.kt functionality
   * @param files Array of open file paths
   * @param current Currently active file path
   */
  updateOpenedFiles(files: string[], current?: string): void {
    try {
      if (!files) {
        files = []
      }

      // Validate and normalize file paths
      const validFiles = this.validatePaths(files)

      // Send unified message
      this.sendMessage({
        type: "updateOpenedFiles",
        openedFiles: validFiles,
        currentFile: current || null,
      })

      //logger.appendLine(`Updated opened files: ${validFiles.length} files, current: ${current || 'none'}`);
    } catch (error) {
      logger.appendLine(`Error updating opened files: ${error}`)
    }
  }

  /**
   * Set chips collapsed state in the web UI
   * @param collapsed Whether chips should be collapsed
   */

  // WebUI → VSCode communication handlers

  /**
   * Handle file open request from web UI
   * Mirrors OpenInIdeHandler.kt functionality
   * @param path File path to open (may include line numbers like "file.js:10-25")
   */
  async handleOpenFile(path: string): Promise<void> {
    try {
      if (!path || path.trim().length === 0) {
        logger.appendLine("No path provided to open")
        return
      }

      // Parse line range from path (mirrors JetBrains regex logic)
      const rangeRegex = /:(\d+)(?:-(\d+))?$/
      const match = rangeRegex.exec(path)
      let startLine: number | undefined
      let endLine: number | undefined
      let cleanPath = path

      if (match) {
        startLine = parseInt(match[1], 10)
        if (match[2]) {
          endLine = parseInt(match[2], 10)
        }
        cleanPath = path.replace(rangeRegex, "")
      }

      // Normalize and resolve the path
      const normalizedPath = this.normalizePath(cleanPath)
      if (!normalizedPath) {
        logger.appendLine(`Invalid path to open: ${cleanPath}`)
        vscode.window.showWarningMessage(`OpenCode: Invalid file path - ${cleanPath}`)
        return
      }

      // Convert to VSCode URI
      const fileUri = vscode.Uri.file(normalizedPath)

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(fileUri)
      } catch (error) {
        // File doesn't exist, try to refresh and find it
        logger.appendLine(`File not found, attempting to refresh: ${normalizedPath}`)
      }

      const document = await vscode.workspace.openTextDocument(fileUri)

      if (startLine !== undefined) {
        const startZero = Math.max(0, startLine - 1)
        let endZero = startZero
        if (endLine !== undefined) {
          endZero = Math.max(startZero, endLine - 1)
        }

        const lastIndex = document.lineCount > 0 ? document.lineCount - 1 : 0
        const clampedStart = Math.min(startZero, lastIndex)
        const clampedEnd = Math.min(endZero, lastIndex)

        const startPos = new vscode.Position(clampedStart, 0)
        const endLineObj = document.lineAt(clampedEnd)
        const endPos = endLineObj.range.end
        const range = new vscode.Range(startPos, endPos)

        try {
          const editor = await vscode.window.showTextDocument(document, {
            selection: range,
            viewColumn: vscode.ViewColumn.Active,
          })

          editor.selection = new vscode.Selection(range.start, range.end)
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter)

          if (endLine !== undefined) {
            logger.appendLine(`Opened file at lines ${startLine}-${endLine}: ${normalizedPath}`)
          } else {
            logger.appendLine(`Opened file at line ${startLine}: ${normalizedPath}`)
          }
        } catch (error) {
          logger.appendLine(`Failed to open file with line number, trying without: ${error}`)
          await vscode.window.showTextDocument(fileUri)
          logger.appendLine(`Opened file (fallback): ${normalizedPath}`)
        }
      } else {
        await vscode.window.showTextDocument(document)
        logger.appendLine(`Opened file: ${normalizedPath}`)
      }
    } catch (error) {
      logger.appendLine(`Error opening file: ${error}`)

      await errorHandler.handleFileOperationError(error instanceof Error ? error : new Error(String(error)), {
        operation: "openFile",
        filePath: path,
        hasLineNumbers: !!path.match(/:(\d+)(?:-(\d+))?$/),
      })
    }
  }

  /**
   * Handle url open request from web UI
   * @param url URL to open
   */
  async handleOpenUrl(url: string): Promise<void> {
    try {
      if (!url || url.trim().length === 0) {
        logger.appendLine("No url provided to open")
        return
      }

      await vscode.env.openExternal(vscode.Uri.parse(url))
      logger.appendLine(`Opened url: ${url}`)
    } catch (error) {
      logger.appendLine(`Error opening url: ${error}`)
      await errorHandler.handleCommunicationError(error instanceof Error ? error : new Error(String(error)), {
        operation: "openUrl",
        messageType: "openUrl",
      })
    }
  }

  /**
   * Handle reload path request from web UI - refreshes file from disk after AI agent modifies it
   * @param filePath File path to reload
   */
  async handleReloadPath(filePath: string): Promise<void> {
    try {
      if (!filePath || filePath.trim().length === 0) {
        logger.appendLine("No path provided to reload")
        return
      }

      const normalizedPath = this.normalizePath(filePath)
      if (!normalizedPath) {
        logger.appendLine(`Invalid path to reload: ${filePath}`)
        return
      }

      const fileUri = vscode.Uri.file(normalizedPath)

      // Check if file exists and refresh it
      try {
        await vscode.workspace.fs.stat(fileUri)
        // File exists - find open editors and refresh them
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.fsPath === fileUri.fsPath) {
            // Revert the document to reload from disk
            await vscode.commands.executeCommand("workbench.action.files.revert", editor.document.uri)
            logger.appendLine(`Reloaded file: ${normalizedPath}`)
            return
          }
        }
        // File not open in editor, no action needed
        logger.appendLine(`File not open in editor, skipping reload: ${normalizedPath}`)
      } catch {
        // File doesn't exist yet (new file), refresh workspace
        logger.appendLine(`File not found, refreshing workspace: ${normalizedPath}`)
      }
    } catch (error) {
      logger.appendLine(`Error reloading path: ${error}`)
    }
  }

  /**
   * Handle state change from web UI
   * @param key Setting key
   * @param value Setting value
   */
  async handleStateChange(key: string, value: any): Promise<void> {
    try {
      logger.appendLine(`Handling state change: ${key} = ${value}`)

      // Use the callback if provided
      if (this.onStateChange) {
        await this.onStateChange(key, value)
        return
      }

      // Fallback to direct configuration update
      const config = vscode.workspace.getConfiguration("opencode")

      switch (key) {
        case "customCommand":
          if (typeof value === "string") {
            await config.update("customCommand", value, vscode.ConfigurationTarget.Global)
            logger.appendLine(`Custom command updated to: ${value}`)
          } else {
            logger.appendLine(`Invalid customCommand value: ${value}`)
          }
          break
        default:
          logger.appendLine(`Unknown settings key: ${key}`)
      }
    } catch (error) {
      logger.appendLine(`Error handling state change: ${error}`)
    }
  }

  // Extended message handling callbacks
  private onUILoadedCallback?: (success: boolean, error?: string) => Promise<void>
  private onReadUris?: (uris: string[]) => Promise<void>

  /**
   * Set callback for UI loaded events
   */
  setUILoadedCallback(callback: (success: boolean, error?: string) => Promise<void>): void {
    this.onUILoadedCallback = callback
  }

  /**
   * Set callback for URI read requests
   */
  setReadUrisCallback(callback: (uris: string[]) => Promise<void>): void {
    this.onReadUris = callback
  }

  /**
   * Set up message handlers for webview communication
   * Consolidated handler for all webview message types
   * Mirrors WebViewLoadHandler.kt message handling setup
   */
  setupMessageHandlers(): void {
    if (!this.webview) {
      logger.appendLine("No webview available to set up message handlers")
      return
    }

    // Clean up existing handler
    if (this.messageHandlerDisposable) {
      this.messageHandlerDisposable.dispose()
    }

    this.messageHandlerDisposable = this.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.type) {
            case "openFile":
              await this.handleOpenFile(message.path)
              break

            case "openUrl":
              await this.handleOpenUrl(message.url)
              break

            case "settingsChanged":
              await this.handleStateChange(message.key, message.value)
              break

            case "bridgeValidation":
              logger.appendLine(`Bridge validation: ${message.success ? "success" : "failed"}`)
              if (!message.success && message.missingFunctions) {
                logger.appendLine(`Missing functions: ${message.missingFunctions.join(", ")}`)
              }
              break

            case "uiLoaded":
              logger.appendLine(`UI loaded: ${message.success ? "success" : "failed"}`)
              if (!message.success && message.error) {
                logger.appendLine(`UI load error: ${message.error}`)
              }
              // Call external callback if provided
              if (this.onUILoadedCallback) {
                await this.onUILoadedCallback(message.success, message.error)
              }
              break

            case "error":
              logger.appendLine(`Webview error: ${message.error}`)
              if (message.filename) {
                logger.appendLine(`  at ${message.filename}:${message.lineno}`)
              }
              break

            case "readUris":
              if (Array.isArray(message.uris)) {
                logger.appendLine(`URI read request: ${message.uris.length} URIs`)
                if (this.onReadUris) {
                  await this.onReadUris(message.uris)
                }
              }
              break

            case "executeCommand":
              try {
                const command: unknown = message.command
                const args: unknown[] = Array.isArray(message.args) ? message.args : []
                if (typeof command !== "string" || command.trim() === "") {
                  logger.appendLine("Invalid executeCommand message: missing command")
                  break
                }
                // Whitelist allowed commands for safety
                const allowed = new Set<string>([
                  "workbench.action.showCommands",
                  "workbench.action.quickOpen",
                  "workbench.action.files.save",
                  "editor.action.selectAll",
                  "workbench.action.files.newUntitledFile",
                  "actions.find",
                  "undo",
                  "redo",
                  // Clipboard actions for macOS handling
                  "editor.action.clipboardCopyAction",
                  "editor.action.clipboardCutAction",
                  "editor.action.clipboardPasteAction",
                ])
                const cmd = command as string // safe after type guard above
                if (!allowed.has(cmd)) {
                  logger.appendLine(`Blocked executeCommand for non-whitelisted command: ${cmd}`)
                  break
                }
                await vscode.commands.executeCommand(cmd, ...args)
                logger.appendLine(`Executed command from webview: ${cmd}`)
              } catch (e) {
                logger.appendLine(`Failed to execute command from webview: ${e}`)
              }
              break

            default:
              logger.appendLine(`Unknown message type: ${message.type}`)
          }
        } catch (error) {
          logger.appendLine(`Error handling message: ${error}`)
        }
      },
      undefined,
      this.context?.subscriptions,
    )

    logger.appendLine("Message handlers set up successfully")
  }

  // Private utility methods

  /**
   * Validate file paths before sending to web UI
   * @param paths Array of paths to validate
   * @returns Array of valid paths
   */
  private validatePaths(paths: string[]): string[] {
    const validPaths: string[] = []

    for (const rawPath of paths) {
      try {
        const normalizedPath = this.normalizePath(rawPath)
        if (normalizedPath) {
          validPaths.push(normalizedPath)
        } else {
          logger.appendLine(`Skipping invalid path: ${rawPath}`)
        }
      } catch (error) {
        logger.appendLine(`Error validating path ${rawPath}: ${error}`)
      }
    }

    return validPaths
  }

  /**
   * Normalize a file path for consistent handling
   * @param rawPath Raw path string
   * @returns Normalized path or null if invalid
   */
  private normalizePath(rawPath: string): string | null {
    try {
      if (!rawPath || rawPath.trim().length === 0) {
        return null
      }

      let normalizedPath = rawPath.trim()

      // Handle VSCode URI format
      if (normalizedPath.startsWith("file://")) {
        normalizedPath = vscode.Uri.parse(normalizedPath).fsPath
      }

      // Resolve relative paths against workspace
      if (!path.isAbsolute(normalizedPath)) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (workspaceFolder) {
          normalizedPath = path.resolve(workspaceFolder.uri.fsPath, normalizedPath)
        } else {
          // No workspace, can't resolve relative path
          return null
        }
      }

      // Normalize path separators
      normalizedPath = path.normalize(normalizedPath)

      // Convert to POSIX style for webview and testing consistency
      return normalizedPath.split(path.sep).join("/")
    } catch (error) {
      logger.appendLine(`Error normalizing path ${rawPath}: ${error}`)
      return null
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.messageHandlerDisposable) {
      this.messageHandlerDisposable.dispose()
      this.messageHandlerDisposable = undefined
    }

    this.webview = undefined
    this.context = undefined
    this.onStateChange = undefined

    logger.appendLine("CommunicationBridge disposed")
  }
}
