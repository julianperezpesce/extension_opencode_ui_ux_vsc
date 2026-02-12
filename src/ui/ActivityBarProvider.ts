import * as vscode from "vscode"
import { BackendConnection, BackendLauncher } from "../backend/BackendLauncher"
import { SettingsManager } from "../settings/SettingsManager"
import { errorHandler } from "../utils/ErrorHandler"
import { WebviewController } from "./WebviewController"
import { logger } from "../globals"
import { PathInserter } from "../utils/PathInserter"

function withCacheBuster(url: string, version: string): string {
  if (url.includes("v=")) {
    return url
  }

  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}v=${encodeURIComponent(version)}`
}

/**
 * Webview view provider for the OpenCode activity bar view.
 */
export class ActivityBarProvider implements vscode.WebviewViewProvider {
  dispose(): void {
    try {
      this.controller?.dispose()
    } catch {}
    this.controller = undefined
    this.view = undefined
  }
  private context: vscode.ExtensionContext
  private backendLauncher: BackendLauncher
  private settingsManager: SettingsManager

  private connection?: BackendConnection
  private controller?: WebviewController
  private view?: vscode.WebviewView
  private uiState: any

  constructor(context: vscode.ExtensionContext, backendLauncher: BackendLauncher, settingsManager: SettingsManager) {
    this.context = context
    this.backendLauncher = backendLauncher
    this.settingsManager = settingsManager
  }

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    logger.appendLine("resolveWebviewView called - initializing or reinitializing webview")

    // When webview is moved between sidebars, VS Code destroys the old webview
    // and calls resolveWebviewView with a new WebviewView instance.
    // We need to dispose the old controller and reinitialize with the new webview.
    if (this.controller) {
      logger.appendLine("Disposing existing controller for webview reinitialization")
      try {
        this.controller.dispose()
      } catch {}
      this.controller = undefined
    }

    // Store reference to current view
    this.view = webviewView

    // Listen for the webview being disposed (e.g., when moved or closed)
    webviewView.onDidDispose(() => {
      logger.appendLine("WebviewView disposed")
      const bridge = this.controller?.getCommunicationBridge()
      if (this.controller) {
        try {
          this.controller.dispose()
        } catch {}
        this.controller = undefined
      }

      // Remove this bridge from PathInserter registry; it will fall back to another if available
      try {
        if (bridge) {
          PathInserter.removeCommunicationBridge(bridge)
        }
      } catch {}
      this.view = undefined
    })

    // Configure webview options
    // WebviewView does not support retainContextWhenHidden in code.
    // Use package.json contributes.views or registration options instead.
    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "resources"),
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
      ],
    }

    // Track view visibility/activeness for command routing
    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible) return
      const bridge = this.controller?.getCommunicationBridge()
      if (bridge) PathInserter.setCommunicationBridge(bridge)
    })

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Starting OpenCode...",
        cancellable: false,
      },
      async (progress) => {
        try {
          // Reuse existing backend connection if available (e.g., when webview is moved between sidebars)
          if (!this.connection) {
            progress.report({ increment: 0, message: "Launching backend..." })
            const connection = await this.backendLauncher.launchBackend()
            this.connection = connection

            // Cache busting: force web UI reload after extension updates
            connection.uiBase = withCacheBuster(connection.uiBase, this.context.extension.packageJSON.version)
          } else {
            logger.appendLine("Reusing existing backend connection for webview reinitialization")
            progress.report({ increment: 0, message: "Reconnecting to backend..." })
          }

          progress.report({ increment: 50, message: "Loading web UI..." })
          this.controller = new WebviewController({
            webview: webviewView.webview,
            context: this.context,
            settingsManager: this.settingsManager,
            uiGetState: async () => this.uiState,
            uiSetState: async (state) => {
              this.uiState = state
            },
          })
          await this.controller.load(this.connection)

          // Prefer routing commands to this view when visible
          if (webviewView.visible) {
            const bridge = this.controller.getCommunicationBridge()
            if (bridge) PathInserter.setCommunicationBridge(bridge)
          }

          // no-op

          progress.report({ increment: 100, message: "Ready!" })
          logger.appendLine("Webview initialization complete")
        } catch (error) {
          await errorHandler.handleWebviewLoadError(error instanceof Error ? error : new Error(String(error)))
          throw error
        }
      },
    )
  }
}
