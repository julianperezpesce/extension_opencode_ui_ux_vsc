import * as vscode from "vscode"
import { WebviewController } from "./WebviewController"
// NOTE: The WebviewController now owns initialization and HTML generation; this manager delegates to it.
import { BackendConnection } from "../backend/BackendLauncher"
import { SettingsManager } from "../settings/SettingsManager"
import { CommunicationBridge } from "./CommunicationBridge"
import { errorHandler } from "../utils/ErrorHandler"
import { logger } from "../globals"
import { PathInserter } from "../utils/PathInserter"

/**
 * Webview management - handles VSCode webview panel lifecycle and content
 * Equivalent to webview portions of ChatToolWindowFactory.kt
 */

export class WebviewManager {
  private panel?: vscode.WebviewPanel
  private context?: vscode.ExtensionContext
  private connection?: BackendConnection
  private settingsManager?: SettingsManager
  private communicationBridge?: CommunicationBridge
  private controller?: WebviewController
  private uiState: any

  /**
   * Create and configure a webview panel for the OpenCode UI
   * @param context Extension context for resource access
   * @param settingsManager Settings manager for configuration handling
   * @returns The created webview panel
   */
  createWebviewPanel(context: vscode.ExtensionContext, settingsManager?: SettingsManager): vscode.WebviewPanel {
    this.context = context
    this.settingsManager = settingsManager

    // Dispose existing panel if it exists
    if (this.panel) {
      this.panel.dispose()
    }

    // Create webview panel with proper configuration
    this.panel = vscode.window.createWebviewPanel(
      "opencode", // Identifies the type of webview
      "OpenCode", // Title displayed in the tab
      vscode.ViewColumn.One, // Editor column to show the new webview panel in
      {
        // Enable JavaScript in the webview
        enableScripts: true,

        // Restrict the webview to only load content from specific sources
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "resources"),
          vscode.Uri.joinPath(context.extensionUri, "out"),
        ],

        // Retain context when webview is not visible
        retainContextWhenHidden: true,

        // Enable command URIs
        enableCommandUris: true,

        // Enable find widget
        enableFindWidget: true,
      },
    )

    // Set up webview options and CSP
    this.setupWebviewOptions()

    // Message handling is delegated to WebviewController via CommunicationBridge

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        logger.appendLine("Webview panel disposed")
        this.cleanup()
      },
      null,
      context.subscriptions,
    )

    // Handle visibility changes
    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.visible) {
          logger.appendLine("Webview panel became visible")
          const bridge = this.controller?.getCommunicationBridge()
          if (bridge) PathInserter.setCommunicationBridge(bridge)
        } else {
          logger.appendLine("Webview panel became hidden")
        }
      },
      null,
      context.subscriptions,
    )

    logger.appendLine("Webview panel created successfully")
    return this.panel
  }

  /**
   * Set up webview options and Content Security Policy
   */
  private setupWebviewOptions(): void {
    if (!this.panel) {
      return
    }

    // Configure Content Security Policy to allow the backend connection
    // This mirrors the security model from the JetBrains plugin
    const csp = [
      "default-src 'none'",
      "script-src 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* https://127.0.0.1:*",
      "style-src 'unsafe-inline' http://127.0.0.1:* https://127.0.0.1:*",
      "img-src 'self' data: http://127.0.0.1:* https://127.0.0.1:* https://*.vscode-cdn.net",
      "connect-src ws://127.0.0.1:* wss://127.0.0.1:* http://127.0.0.1:* https://127.0.0.1:*",
      "font-src 'self' data: http://127.0.0.1:* https://127.0.0.1:*",
      "media-src 'self' http://127.0.0.1:* https://127.0.0.1:*",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
    ].join("; ")

    logger.appendLine(`Setting CSP: ${csp}`)
  }

  /**
   * Load the web UI with backend connection information
   * @param connection Backend connection details
   */
  async loadWebUI(connection: BackendConnection): Promise<void> {
    try {
      if (!this.panel) {
        const error = new Error("Webview panel not created. Call createWebviewPanel first.")
        errorHandler.handleWebviewLoadError(error, {
          hasPanel: !!this.panel,
          connection: connection ? "provided" : "missing",
        })
        return
      }

      this.connection = connection
      logger.appendLine(`Loading web UI with connection: port=${connection.port}, uiBase=${connection.uiBase}`)

      // Delegate setup of bridge, DnD, file monitor, settings sync and HTML to shared controller
      this.controller = new WebviewController({
        webview: this.panel.webview,
        context: this.context!,
        settingsManager: this.settingsManager,
        uiGetState: async () => this.uiState,
        uiSetState: async (state) => {
          this.uiState = state
        },
      })
      // Load UI via controller
      await this.controller.load(connection)

      // Keep references for compatibility APIs (must be after load() which creates the bridge)
      this.communicationBridge = this.controller.getCommunicationBridge()

      // Prefer routing commands to this panel when visible
      if (this.panel.visible) {
        const bridge = this.controller.getCommunicationBridge()
        if (bridge) PathInserter.setCommunicationBridge(bridge)
      }

      // Get UI mode from settings with error handling
      let uiMode = "Terminal"
      try {
        const config = vscode.workspace.getConfiguration("opencode")
        uiMode = config.get<string>("uiMode", "Terminal")
      } catch (configError) {
        logger.appendLine(`Failed to get UI mode from settings, using default: ${configError}`)
      }

      // WebviewController loads HTML and handles initialization internally
      logger.appendLine("Web UI load delegated to WebviewController")
    } catch (error) {
      logger.appendLine(`Failed to load web UI: ${error}`)
      errorHandler.handleWebviewLoadError(error instanceof Error ? error : new Error(String(error)), { connection })
      throw error
    }
  }

  /**
   * Get the current webview panel
   * @returns The webview panel or undefined
   */
  getPanel(): vscode.WebviewPanel | undefined {
    return this.panel
  }

  /**
   * Check if the webview is currently visible
   * @returns True if webview is visible
   */
  isVisible(): boolean {
    return this.panel?.visible ?? false
  }

  /**
   * Reveal the webview panel
   * @param viewColumn Optional view column to show in
   */
  reveal(viewColumn?: vscode.ViewColumn): void {
    if (this.panel) {
      this.panel.reveal(viewColumn)
    }
  }

  /**
   * Get the communication bridge instance
   * @returns The communication bridge or undefined
   */
  getCommunicationBridge(): CommunicationBridge | undefined {
    return this.communicationBridge
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Grab bridge ref before controller.dispose() clears it
    const bridge = this.communicationBridge ?? this.controller?.getCommunicationBridge()

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
    if (this.communicationBridge) {
      this.communicationBridge.dispose()
      this.communicationBridge = undefined
    }
    this.panel = undefined
    this.connection = undefined
    this.settingsManager = undefined
  }

  /**
   * Dispose of the webview panel
   */
  dispose(): void {
    if (this.panel) {
      logger.appendLine("Disposing webview panel")
      this.panel.dispose()
    }
    this.cleanup()
  }
}
