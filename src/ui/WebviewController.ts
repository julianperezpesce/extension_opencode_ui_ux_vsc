import * as vscode from "vscode"
import * as http from "http"
import * as path from "path"
import { BackendConnection } from "../backend/BackendLauncher"
import { SettingsManager } from "../settings/SettingsManager"
import { CommunicationBridge } from "./CommunicationBridge"
import { FileMonitor } from "../utils/FileMonitor"
import { errorHandler } from "../utils/ErrorHandler"
import { PathInserter } from "../utils/PathInserter"
import { logger } from "../globals"
import { bridgeServer } from "./IdeBridgeServer"

/**
 * Shared webview controller to manage common UI lifecycle and messaging
 * Used by both WebviewManager (editor tab) and ActivityBarProvider (view tab)
 */
export interface WebviewControllerOptions {
  webview: vscode.Webview
  context: vscode.ExtensionContext
  settingsManager?: SettingsManager
  uiGetState?: () => Promise<any>
  uiSetState?: (state: any) => Promise<void>
}

export class WebviewController {
  private webview: vscode.Webview
  private context: vscode.ExtensionContext
  private settingsManager?: SettingsManager
  private communicationBridge?: CommunicationBridge
  private fileMonitor?: FileMonitor
  private connection?: BackendConnection
  private disposables: vscode.Disposable[] = []
  private bridgeSessionId: string | null = null
  private uiGetState?: () => Promise<any>
  private uiSetState?: (state: any) => Promise<void>

  constructor(opts: WebviewControllerOptions) {
    this.webview = opts.webview
    this.context = opts.context
    this.settingsManager = opts.settingsManager
    this.uiGetState = opts.uiGetState
    this.uiSetState = opts.uiSetState
  }

  getCommunicationBridge(): CommunicationBridge | undefined {
    return this.communicationBridge
  }

  async load(connection: BackendConnection): Promise<void> {
    this.connection = connection
    logger.appendLine('[WebviewController] load() started');

    try {
      // Initialize communication bridge
      this.communicationBridge = new CommunicationBridge({
        webview: this.webview,
        context: this.context,
      })

      // Configure callbacks for extended message handling

      this.communicationBridge.setReadUrisCallback(async (uris: string[]) => {
        await this.handleReadUris(uris)
      })

      this.communicationBridge.setChatSendCallback(async (text: string, context?: any[], options?: any) => {
        await this.handleChatSend(text, context, options)
      })

      // Make PathInserter aware of the active communication bridge
      // NOTE: PathInserter is now set by container visibility (editor panel / sidebar).

      // Create bridge session with handlers from CommunicationBridge
      const session = await bridgeServer.createSession(
        {
          openFile: (path) => this.communicationBridge!.handleOpenFile(path),
          openUrl: (url) => this.communicationBridge!.handleOpenUrl(url),
          reloadPath: (path) => this.communicationBridge!.handleReloadPath(path),
          clipboardWrite: async (text) => {
            await vscode.env.clipboard.writeText(text)
          },
          uiGetState: this.uiGetState,
          uiSetState: this.uiSetState,
        },
      )
      this.bridgeSessionId = session.sessionId

      // Tell CommunicationBridge to route ideBridge messages through SSE
      this.communicationBridge.setBridgeSession(session.sessionId, bridgeServer)

      // Initialize file monitor (best effort)
      try {
        this.fileMonitor = new FileMonitor()
        this.fileMonitor.startMonitoring((files: string[], current?: string) => {
          try {
            // Normalize paths for cross-platform consistency (especially Windows)
            const normalizedFiles = files.map((f) => this.normalizePath(f)).filter((f): f is string => f !== null)
            const normalizedCurrent = current ? this.normalizePath(current) : undefined

            // Send to bridge server
            if (this.bridgeSessionId) {
              bridgeServer.send(this.bridgeSessionId, {
                type: "updateOpenedFiles",
                payload: { openedFiles: normalizedFiles, currentFile: normalizedCurrent },
              })
            }

            // Send current file to webview for "Add current file" button
            // Use activeTextEditor.document.uri.fsPath directly - always absolute
            const activeEditor = vscode.window.activeTextEditor
            if (activeEditor && activeEditor.document.uri.scheme === "file" && this.communicationBridge) {
              const absolutePath = activeEditor.document.uri.fsPath
              const fileName = absolutePath.split('/').pop() || absolutePath
              this.communicationBridge.sendMessage({
                type: 'updateCurrentFile',
                path: absolutePath,
                name: fileName,
                timestamp: Date.now()
              })
            }
          } catch (e) {
            logger.appendLine(`updateOpenedFiles failed: ${e}`)
          }
        })
      } catch (e) {
        logger.appendLine(`FileMonitor init failed: ${e}`)
      }

      // Use asExternalUri for Remote-SSH compatibility
      const externalUi = await vscode.env.asExternalUri(vscode.Uri.parse(connection.uiBase))
      const externalBridge = await vscode.env.asExternalUri(vscode.Uri.parse(session.baseUrl))

      // Generate URIs for our compiled resources
      const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview.js');
      const scriptUri = this.webview.asWebviewUri(scriptPathOnDisk);
      
      const stylesPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview', 'styles.css');
      const stylesUri = this.webview.asWebviewUri(stylesPathOnDisk);

      // Initial Theme Config
      const config = vscode.workspace.getConfiguration('opencode');
      const theme = config.get<string>('theme', 'native'); 
      const initialThemeClass = theme === 'dragonfu' ? 'dragonfu-theme' : '';

      // CSP: Allow scripts/styles from our extension directory
      const cspSource = this.webview.cspSource;
      
      // Get the exact backend origin for connect-src
      const backendUrl = new URL(connection.uiBase);
      const backendOrigin = `${backendUrl.protocol}//${backendUrl.host}`;

      this.webview.html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; connect-src ${backendOrigin} http://127.0.0.1:* http://localhost:*;">
          <link href="${stylesUri}" rel="stylesheet">
          <title>OpenCode DragonFu</title>
      </head>
      <body class="${initialThemeClass}">
          <chat-view></chat-view>
          <script>
              // Set config BEFORE loading the main script
              window.opencodeConfig = {
                  backendUrl: "${externalUi.toString()}",
                  bridgeUrl: "${externalBridge.toString()}",
                  bridgeToken: "${session.token}"
              };
              
              // Debug: Verify VS Code API is available
              console.log('[Webview] Checking for VS Code API...');
              // @ts-ignore
              if (typeof acquireVsCodeApi === 'function') {
                  // @ts-ignore
                  window.vscode = acquireVsCodeApi();
                  console.log('[Webview] VS Code API acquired successfully');
              } else {
                  console.error('[Webview] VS Code API NOT available - acquireVsCodeApi is not a function');
              }
          </script>
          <script type="module" src="${scriptUri}"></script>
      </body>
      </html>`;

      // Message handling is now done entirely by CommunicationBridge

    } catch (error) {
      await errorHandler.handleWebviewLoadError(error instanceof Error ? error : new Error(String(error)), {
        connection,
      })
      throw error
    }
  }

  private sessionId: string | null = null

  private async getOrCreateSession(): Promise<string> {
    const uiBaseUrl = new URL(this.connection!.uiBase)
    const baseUrl = uiBaseUrl.origin

    // Try to get existing sessions first
    logger.appendLine('[WebviewController] Fetching existing sessions...');
    const sessionsResponse = await fetch(`${baseUrl}/session`)
    
    if (sessionsResponse.ok) {
      const sessions = await sessionsResponse.json() as Array<{id: string}>
      if (sessions && sessions.length > 0) {
        logger.appendLine(`[WebviewController] Found existing session: ${sessions[0].id}`)
        return sessions[0].id
      }
    }

    // Create a new session if none exists
    logger.appendLine('[WebviewController] Creating new session...');
    const createResponse = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "VS Code Chat" }),
    })

    if (!createResponse.ok) {
      throw new Error(`Failed to create session: ${createResponse.status}`)
    }

    const newSession = await createResponse.json() as {id: string}
    logger.appendLine(`[WebviewController] Created new session: ${newSession.id}`)
    return newSession.id
  }

  private async handleChatSend(text: string, context?: any[], options?: any): Promise<void> {
    try {
      logger.appendLine(`[WebviewController] handleChatSend: ${text.substring(0, 50)}... with ${context?.length || 0} context items`)
      
      if (!this.connection) {
        throw new Error("No backend connection available")
      }

      // Extract the base URL from uiBase
      const uiBaseUrl = new URL(this.connection.uiBase)
      const baseUrl = uiBaseUrl.origin

      // Get or create a session
      if (!this.sessionId) {
        this.sessionId = await this.getOrCreateSession()
      }

      const apiUrl = `${baseUrl}/session/${this.sessionId}/prompt_async`
      
      // Build parts array with text and context
      const parts: any[] = [{ type: "text", text }]
      
      // Add context items if provided
      if (context && context.length > 0) {
        for (const item of context) {
          if (item.type === 'file' || item.type === 'code') {
            // For files and code snippets, we need to read the content
            try {
              const resolvedPath = await this.resolveContextPath(item.path)
              if (!resolvedPath) {
                logger.appendLine(`[WebviewController] Could not resolve context path: ${item.path}`)
                parts.push({
                  type: 'text',
                  text: `\n\n[Context: ${item.path} - File not accessible]`
                })
                continue
              }

              const fileUri = vscode.Uri.file(resolvedPath)
              let content = ''
              
              // Check if file exists and read it
              try {
                await vscode.workspace.fs.stat(fileUri)
                const bytes = await vscode.workspace.fs.readFile(fileUri)
                content = Buffer.from(bytes).toString('utf-8')
                
                // If line range is specified, extract those lines
                if (item.lineStart !== undefined) {
                  const lines = content.split('\n')
                  const start = Math.max(0, item.lineStart - 1)
                  const end = item.lineEnd !== undefined ? Math.min(lines.length, item.lineEnd) : start + 1
                  content = lines.slice(start, end).join('\n')
                }
                
                // Limit content size to avoid overwhelming the context
                const config = vscode.workspace.getConfiguration("opencode")
                const maxContentLengthSetting = config.get<number>("context.maxFileChars", 50000)
                const includeFullContext = options?.includeFullContext === true
                const maxContentLength = includeFullContext ? 0 : maxContentLengthSetting
                let displayContent = content
                if (maxContentLength > 0 && content.length > maxContentLength) {
                  displayContent = content.substring(0, maxContentLength)
                  displayContent += `\n\n[... Content truncated, total length: ${content.length} chars ...]`
                }
                
                parts.push({
                  type: 'text',
                  text: `\n\n[Context: ${item.path}${item.lineStart ? `:${item.lineStart}${item.lineEnd ? `-${item.lineEnd}` : ''}` : ''}]\n\`\`\`\n${displayContent}\n\`\`\``
                })
                
                logger.appendLine(`[WebviewController] Added file context: ${item.path}`)
              } catch (err) {
                logger.appendLine(`[WebviewController] Could not read file ${item.path}: ${err}`)
                parts.push({
                  type: 'text',
                  text: `\n\n[Context: ${item.path} - File not accessible]`
                })
              }
            } catch (err) {
              logger.appendLine(`[WebviewController] Error processing context item: ${err}`)
            }
          } else if (item.type === 'folder') {
            parts.push({
              type: 'text',
              text: `\n\n[Context: Folder ${item.path}]`
            })
          }
        }
      }
      
      // Send message using the session API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parts }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      // Start listening to SSE events and forward to webview
      this.startEventStreamListener();
      
      logger.appendLine(`[WebviewController] Message sent successfully, waiting for response...`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      
      logger.appendLine(`[WebviewController] ERROR handling chat send: ${errorMessage}`);
      if (errorStack) {
        logger.appendLine(`[WebviewController] Stack: ${errorStack}`);
      }
      
      // Show user-facing error
      vscode.window.showErrorMessage(`Failed to send message: ${errorMessage}`);
      
      if (this.communicationBridge) {
        this.communicationBridge.sendMessage({
          type: "error",
          // @ts-ignore
          command: "chat.error",
          text: `Failed to send message: ${errorMessage}`
        })
      }
    }
  }

  private async resolveContextPath(rawPath: string | undefined): Promise<string | null> {
    // ALWAYS log at the start
    logger.appendLine(`[WebviewController] resolveContextPath START: "${rawPath}"`)
    
    try {
      if (!rawPath || rawPath.trim().length === 0) {
        logger.appendLine(`[WebviewController] resolveContextPath: empty path, returning null`)
        return null
      }

      let resolvedPath = rawPath.trim()

      if (resolvedPath.startsWith("file://")) {
        resolvedPath = vscode.Uri.parse(resolvedPath).fsPath
        logger.appendLine(`[WebviewController] resolveContextPath: converted from file://: "${resolvedPath}"`)
      }

      // If already absolute, just normalize and return
      if (path.isAbsolute(resolvedPath)) {
        const normalized = path.normalize(resolvedPath)
        logger.appendLine(`[WebviewController] resolveContextPath (absolute): "${rawPath}" -> "${normalized}"`)
        return normalized
      }

      logger.appendLine(`[WebviewController] resolveContextPath: path is relative: "${resolvedPath}"`)

      // Try all workspace folders to find the correct one
      const workspaceFolders = vscode.workspace.workspaceFolders
      logger.appendLine(`[WebviewController] resolveContextPath: workspaceFolders = ${JSON.stringify(workspaceFolders)}`)
      
      if (workspaceFolders && workspaceFolders.length > 0) {
        // Try each workspace folder to see if the file exists there
        for (const folder of workspaceFolders) {
          const candidate = path.join(folder.uri.fsPath, resolvedPath)
          logger.appendLine(`[WebviewController] resolveContextPath: trying workspace folder: "${candidate}"`)
          try {
            // Check if file exists
            await vscode.workspace.fs.stat(vscode.Uri.file(candidate))
            const normalized = path.normalize(candidate)
            logger.appendLine(`[WebviewController] resolveContextPath (workspace SUCCESS): "${rawPath}" -> "${normalized}"`)
            return normalized
          } catch (e) {
            logger.appendLine(`[WebviewController] resolveContextPath: file not in ${folder.uri.fsPath}: ${e}`)
            // File doesn't exist in this workspace, try next
          }
        }
      } else {
        logger.appendLine(`[WebviewController] resolveContextPath: no workspace folders, using fallback`)
      }

      // Fallback: try /home/julian as base (for development mode)
      const fallbackPath = path.join("/home/julian", resolvedPath)
      logger.appendLine(`[WebviewController] resolveContextPath: trying fallback: "${fallbackPath}"`)
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(fallbackPath))
        const normalized = path.normalize(fallbackPath)
        logger.appendLine(`[WebviewController] resolveContextPath (fallback SUCCESS): "${rawPath}" -> "${normalized}"`)
        return normalized
      } catch (e) {
        logger.appendLine(`[WebviewController] resolveContextPath: fallback failed: ${e}`)
      }

      // Last resort: assume it's in extension_opencode_ui_ux_vsc subfolder
      const lastResort = path.join("/home/julian/extension_opencode_ui_ux_vsc", resolvedPath)
      logger.appendLine(`[WebviewController] resolveContextPath: trying last resort: "${lastResort}"`)
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(lastResort))
        const normalized = path.normalize(lastResort)
        logger.appendLine(`[WebviewController] resolveContextPath (last resort SUCCESS): "${rawPath}" -> "${normalized}"`)
        return normalized
      } catch (e) {
        logger.appendLine(`[WebviewController] resolveContextPath: last resort failed: ${e}`)
      }

      logger.appendLine(`[WebviewController] Could not resolve path after all attempts: ${rawPath}`)
      return null
    } catch (err) {
      logger.appendLine(`[WebviewController] resolveContextPath ERROR for "${rawPath}": ${err}`)
      return null
    }
  }

  private eventStreamRequest?: http.ClientRequest

  private startEventStreamListener(): void {
    if (this.eventStreamRequest) {
      return;
    }

    if (!this.connection) {
      logger.appendLine('[WebviewController] No connection available for event stream');
      return;
    }

    const uiBaseUrl = new URL(this.connection.uiBase);
    const eventUrl = `${uiBaseUrl.origin}/event`;
    
    logger.appendLine(`[WebviewController] Connecting to event stream: ${eventUrl}`);
    
    try {
      this.eventStreamRequest = http.get(eventUrl, (res) => {
        logger.appendLine(`[WebviewController] Event stream connected (status: ${res.statusCode})`);
        
        if (res.statusCode !== 200) {
            vscode.window.showErrorMessage(`Failed to connect to OpenCode event stream (Status: ${res.statusCode})`);
            return;
        }

        let buffer = '';
        
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          // Keep the last partial line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              const data = line.trim().slice(6);
              // Skip keep-alive messages or empty data
              if (!data || data === '{}') continue;
              
              try {
                const eventData = JSON.parse(data);
                this.handleServerEvent(eventData);
              } catch (err) {
                logger.appendLine(`[WebviewController] Error parsing event: ${err}`);
              }
            }
          }
        });

        res.on('end', () => {
          logger.appendLine('[WebviewController] Event stream ended by server');
          this.eventStreamRequest = undefined;
        });
      });

      this.eventStreamRequest.on('error', (err) => {
        logger.appendLine(`[WebviewController] Event stream error: ${err.message}`);
        vscode.window.showErrorMessage(`OpenCode event stream error: ${err.message}`);
        this.eventStreamRequest = undefined;
      });
      
    } catch (err) {
      const msg = `Failed to create event stream request: ${err}`;
      logger.appendLine(`[WebviewController] ${msg}`);
      vscode.window.showErrorMessage(msg);
    }
  }

  private handleServerEvent(event: any): void {
    if (!this.communicationBridge) {
      return;
    }

    // Log all events for debugging
    logger.appendLine(`[WebviewController] Received event: ${event.type}`);

    switch (event.type) {
      // Handle standard message completion
      case 'chat.response':
      case 'message.complete':
        if (event.text || event.content) {
          this.communicationBridge.sendMessage({
            type: 'chat.receive',
            text: event.text || event.content
          });
        }
        break;
        
      // Handle standard streaming
      case 'chat.streaming':
      case 'message.chunk':
        if (event.text || event.content) {
          this.communicationBridge.sendMessage({
            type: 'chat.streaming',
            text: event.text || event.content
          });
        }
        break;

      // Handle OpenCode native streaming events
      case 'message.part.updated':
        // Check for text content in the part update
        const part = event.properties?.part;
        const delta = event.properties?.delta;
        
        // Priority to delta (incremental update), then full text if available
        const textContent = delta?.text || part?.text || (typeof part === 'string' ? part : null);

        if (textContent) {
          logger.appendLine(`[WebviewController] Sending streaming text: ${textContent.substring(0, 100)}...`);
          this.communicationBridge.sendMessage({
            type: 'chat.streaming',
            text: textContent
          });
        }
        break;

      case 'message.updated':
        // Metadata update, ignore
        break;
        
      default:
        // Ignore other events
    }
  }

  private async handleReadUris(uris: string[]): Promise<void> {
    try {
      logger.appendLine(`Reading ${uris.length} URIs from webview request`)

      // Separate files and directories for proper handling
      const filePaths: string[] = []
      const directoryPaths: string[] = []

      const results = await Promise.all(
        uris.map(async (u) => {
          try {
            const uri = vscode.Uri.parse(u)
            // For non-file URIs (e.g. vscode-remote://ssh-remote+host/path),
            // fsPath includes the authority as a UNC prefix (//ssh-remote+host/path)
            // which is not a valid filesystem path. Use uri.path instead.
            const filePath = uri.scheme === "file" ? uri.fsPath : uri.path
            // For vscode.workspace.fs operations, keep the original URI so the
            // remote extension host resolves the file on the correct machine
            // (works for file://, vscode-remote://, wsl://, etc.)
            const fileUri = uri

            try {
              const stat = await vscode.workspace.fs.stat(fileUri)
              if (stat.type === vscode.FileType.File) {
                filePaths.push(filePath)
              } else if (stat.type === vscode.FileType.Directory) {
                directoryPaths.push(filePath)
              }
            } catch {
              // If stat fails, assume it's a file
              filePaths.push(filePath)
            }

            // Create webview-safe URI for direct display
            const webviewUri = this.webview.asWebviewUri(fileUri)

            // Optionally read file contents as base64 for fallback
            let data: string | undefined
            try {
              const buf = await vscode.workspace.fs.readFile(fileUri)
              data = Buffer.from(buf).toString("base64")
            } catch {
              // File reading failed, but webviewUri might still work
            }

            return {
              uri: u,
              ok: true,
              webviewUri: String(webviewUri),
              data,
            }
          } catch (err) {
            return {
              uri: u,
              ok: false,
              error: String(err),
            }
          }
        }),
      )

      // Send results back to webview for display
      this.webview.postMessage({
        type: "readUrisResult",
        results,
      })

      // IMPORTANT: Call insertPaths for files and pastePath for directories
      if (this.communicationBridge) {
        if (filePaths.length > 0) {
          this.communicationBridge.insertPaths(filePaths)
          logger.appendLine(`Called insertPaths with ${filePaths.length} files`)
        }

        for (const dirPath of directoryPaths) {
          this.communicationBridge.pastePath(dirPath)
          logger.appendLine(`Called pastePath for directory: ${dirPath}`)
        }
      } else {
        logger.appendLine("Warning: No communication bridge available to call insertPaths/pastePath")
      }

      logger.appendLine(
        `Processed ${results.length} URIs: ${filePaths.length} files, ${directoryPaths.length} directories`,
      )
    } catch (error) {
      logger.appendLine(`Error handling readUris: ${error}`)

      // Send error response
      this.webview.postMessage({
        type: "readUrisResult",
        results: uris.map((uri) => ({
          uri,
          ok: false,
          error: "Failed to process URI request",
        })),
      })
    }
  }

  private buildUiUrlWithMode(base: string): string {
    let uiMode = "Terminal"
    try {
      const config = vscode.workspace.getConfiguration("opencode")
      uiMode = config.get<string>("uiMode", "Terminal")
    } catch {}
    return base.includes("?") ? `${base}&mode=${uiMode}` : `${base}?mode=${uiMode}`
  }

  private async generateHtmlContent(
    uiUrl: string,
    origins: { uiOrigin: string; bridgeOrigin: string },
  ): Promise<string> {
    const htmlUri = vscode.Uri.joinPath(this.context.extensionUri, "resources", "webview", "index.html")
    const bytes = await vscode.workspace.fs.readFile(htmlUri)
    let html = Buffer.from(bytes).toString("utf8")

    // Build dynamic CSP origins - include both specific origins and localhost fallbacks
    const cspOrigins = this.buildCspOrigins(origins.uiOrigin, origins.bridgeOrigin)

    html = html
      .replace(/\$\{uiUrl\}/g, uiUrl)
      .replace(/\$\{cspSource\}/g, this.webview.cspSource)
      .replace(/\$\{cspOrigins\}/g, cspOrigins)

    return html
  }

  private buildCspOrigins(uiOrigin: string, bridgeOrigin: string): string {
    // Collect unique origins, always include localhost fallbacks for compatibility
    const origins = new Set<string>([
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      "http://localhost:*",
      "https://localhost:*",
    ])

    // Add the actual resolved origins (handles Remote-SSH tunnels, codespaces, etc.)
    for (const origin of [uiOrigin, bridgeOrigin]) {
      try {
        const url = new URL(origin)
        // Add with wildcard port for flexibility
        origins.add(`${url.protocol}//${url.hostname}:*`)
        // Also add the exact origin
        origins.add(origin)
      } catch {
        // Skip invalid origins
      }
    }

    return Array.from(origins).join(" ")
  }

  private normalizePath(rawPath: string): string | null {
    try {
      if (!rawPath || rawPath.trim().length === 0) return null
      let p = rawPath.trim()
      if (p.startsWith("file://")) {
        p = vscode.Uri.parse(p).fsPath
      }
      // Normalize and convert to POSIX style for consistency
      const path = require("path")
      return path.normalize(p).split(path.sep).join("/")
    } catch {
      return null
    }
  }

  dispose(): void {
    try {
      this.fileMonitor?.stopMonitoring()
    } catch {}
    try {
      this.communicationBridge?.dispose()
    } catch {}
    // NOTE: container owns PathInserter pointer
    if (this.bridgeSessionId) {
      bridgeServer.removeSession(this.bridgeSessionId)
      this.bridgeSessionId = null
    }
    for (const d of this.disposables) {
      try {
        d.dispose()
      } catch {}
    }
    this.disposables = []
    this.communicationBridge = undefined
    this.fileMonitor = undefined
    this.connection = undefined
  }
}
