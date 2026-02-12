import * as vscode from "vscode"
import { spawn } from "child_process"
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

      this.communicationBridge.setChatSendCallback(async (text: string) => {
        await this.handleChatSend(text)
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
            if (this.bridgeSessionId) {
              // Normalize paths for cross-platform consistency (especially Windows)
              const normalizedFiles = files.map((f) => this.normalizePath(f)).filter((f): f is string => f !== null)
              const normalizedCurrent = current ? this.normalizePath(current) : undefined
              bridgeServer.send(this.bridgeSessionId, {
                type: "updateOpenedFiles",
                payload: { openedFiles: normalizedFiles, currentFile: normalizedCurrent },
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

      this.webview.html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};">
          <link href="${stylesUri}" rel="stylesheet">
          <title>OpenCode UX+</title>
      </head>
      <body class="${initialThemeClass}">
          <chat-view></chat-view>
          <script type="module" src="${scriptUri}"></script>
          <script>
              window.opencodeConfig = {
                  backendUrl: "${externalUi.toString()}",
                  bridgeUrl: "${externalBridge.toString()}",
                  bridgeToken: "${session.token}"
              };
          </script>
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

  private async handleChatSend(text: string): Promise<void> {
    try {
      if (!this.connection) {
        throw new Error("No backend connection available")
      }

      logger.appendLine(`Sending chat to opencode run: ${text}`)
      
      // FIX: Session ID must start with "ses" according to OpenCode validation
      const sessionId = `ses-${Date.now()}`
      const args = ["run", "--session", sessionId, text]
      
      // Use the resolved binary path from the backend connection
      const binaryPath = this.connection.binaryPath
      logger.appendLine(`Spawning: ${binaryPath} ${args.join(" ")}`)

      // Debug notification
      // vscode.window.showInformationMessage(`OpenCode: Spawning process...`)

      const child = spawn(binaryPath, args, {
        shell: false, // Disable shell for direct control
        env: { ...process.env, FORCE_COLOR: "0" } // Try to force no color
      })

      // IMPORTANT: Close stdin to prevent process from hanging waiting for input
      child.stdin.end()

      let fullOutput = ""
      
      const logWithTime = (msg: string) => {
        const time = new Date().toLocaleTimeString()
        logger.appendLine(`[${time}] ${msg}`)
      }

      // Timeout to kill process if it hangs (30s)
      const timeout = setTimeout(() => {
        logWithTime("Timeout reached. Killing process.")
        child.kill()
        if (this.communicationBridge) {
          this.communicationBridge.sendMessage({
            type: "error",
            // @ts-ignore
            command: "chat.error",
            text: "Error: Request timed out (30s)."
          })
        }
      }, 30000)

      child.stdout.on("data", (data) => {
        const chunk = data.toString()
        fullOutput += chunk
        logWithTime(`stdout chunk: ${chunk.length} chars`)
      })

      child.stderr.on("data", (data) => {
        const chunk = data.toString()
        fullOutput += chunk // Combine stderr into output
        logWithTime(`stderr chunk: ${chunk.length} chars`)
      })

      child.on("close", (code) => {
        clearTimeout(timeout)
        logWithTime(`Process finished with code ${code}`)
        
        if (this.communicationBridge) {
          // Basic ANSI strip regex
          const cleanText = fullOutput.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
          
          const finalText = cleanText.trim() || (code === 0 ? "Done (no output)." : "Error executing command (no output).")
          
          this.communicationBridge.sendMessage({
            type: "chat.receive",
            text: finalText,
            // @ts-ignore
            command: "chat.receive"
          })
        }
      })

      child.on("error", (err) => {
        clearTimeout(timeout)
        logWithTime(`Failed to spawn opencode run: ${err}`)
        if (this.communicationBridge) {
          this.communicationBridge.sendMessage({
            type: "error",
            // @ts-ignore
            command: "chat.error",
            text: `Failed to spawn process: ${err.message}`
          })
        }
      })

    } catch (error) {
      logger.appendLine(`Error handling chat send: ${error}`)
      if (this.communicationBridge) {
        this.communicationBridge.sendMessage({
          type: "error",
          // @ts-ignore
          command: "chat.error",
          text: `Failed to send message: ${error}`
        })
      }
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
