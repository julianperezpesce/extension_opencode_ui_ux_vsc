import { ChildProcess, spawn } from "child_process"
import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import { ResourceExtractor } from "./ResourceExtractor"
import { ErrorCategory, errorHandler, ErrorSeverity } from "../utils/ErrorHandler"
import { logger } from "../globals"

/**
 * Backend process management - mirrors BackendLauncher.kt
 * Handles opencode backend process lifecycle, binary extraction, and connection management
 */

export interface BackendConnection {
  port: number
  uiBase: string
  process: ChildProcess
  binaryPath: string
}

export class BackendLauncher {
  private currentProcess?: ChildProcess
  private currentConnection?: Omit<BackendConnection, "process">

  /**
   * Launch the opencode backend process
   * @param workspaceRoot Optional workspace root directory
   * @returns Promise resolving to backend connection info
   */
  async launchBackend(workspaceRoot?: string, options?: { forceNew?: boolean }): Promise<BackendConnection> {
    // Reuse existing running backend if available
    if (!options?.forceNew && this.currentProcess && this.currentConnection && this.isRunning()) {
      return { ...this.currentConnection, process: this.currentProcess } as BackendConnection
    }

    try {
      // Extract binary for current platform
      const binaryPath = await this.extractBinary()
      logger.appendLine(`Using binary: ${binaryPath}`)

      // Build command arguments
      const args = this.buildCommandArgs(binaryPath)
      const cwd = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()

      if (options?.forceNew) {
        // Start an independent backend without touching the current shared one
        logger.appendLine(`Starting additional backend process: ${args.join(" ")}`)
        const childProcess = spawn(args[0], args.slice(1), {
          cwd,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env },
        })

        // Parse connection and set up error handling
        const connection = await this.parseConnectionInfo(childProcess)
        this.setupErrorHandling(childProcess)
        logger.appendLine(`Additional backend started successfully on port ${connection.port}`)

        // Do NOT update currentProcess/currentConnection for additional backend
        return { ...connection, process: childProcess, binaryPath }
      }

      // For shared backend: terminate any existing and start new
      this.terminate()
      logger.appendLine(`Starting backend process: ${args.join(" ")}`)
      const childProcess = spawn(args[0], args.slice(1), {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      })

      this.currentProcess = childProcess

      // Parse connection info from stdout
      const connection = await this.parseConnectionInfo(childProcess)

      // Set up error handling
      this.setupErrorHandling(childProcess)

      logger.appendLine(`Backend started successfully on port ${connection.port}`)

      // Cache current connection (shared)
      this.currentConnection = { ...connection, binaryPath }

      return {
        ...connection,
        process: childProcess,
        binaryPath
      }
    } catch (error) {
      logger.appendLine(`Failed to launch backend: ${error}`)

      // Try fallback without custom command if it was configured
      const customCommand = this.getCustomCommand()
      if (customCommand.trim()) {
        logger.appendLine("Attempting fallback without custom command...")
        try {
          return await this.launchBackendFallback(workspaceRoot)
        } catch (fallbackError) {
          // Handle both original and fallback errors
          await errorHandler.handleBackendLaunchError(
            fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
            {
              originalError: error instanceof Error ? error.message : String(error),
              customCommand,
              workspaceRoot,
              attemptedFallback: true,
            },
          )
          throw fallbackError
        }
      }

      // Handle the original error
      await errorHandler.handleBackendLaunchError(error instanceof Error ? error : new Error(String(error)), {
        customCommand,
        workspaceRoot,
        attemptedFallback: false,
      })

      throw error
    }
  }

  /**
   * Launch backend without custom command as fallback
   * @param workspaceRoot Optional workspace root directory
   * @returns Promise resolving to backend connection info
   */
  private async launchBackendFallback(workspaceRoot?: string): Promise<BackendConnection> {
    try {
      const binaryPath = await this.extractBinary()
      const args = this.buildCommandArgs(binaryPath, true) // Skip custom command

      logger.appendLine(`Starting fallback backend process: ${args.join(" ")}`)

      const cwd = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()

      const childProcess = spawn(args[0], args.slice(1), {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      })

      this.currentProcess = childProcess

      const connection = await this.parseConnectionInfo(childProcess)
      this.setupErrorHandling(childProcess)

      logger.appendLine(`Fallback backend started successfully on port ${connection.port}`)

      // Cache current connection
      this.currentConnection = { ...connection, binaryPath }

      return {
        ...connection,
        process: childProcess,
        binaryPath
      }
    } catch (fallbackError) {
      logger.appendLine(`Fallback backend launch also failed: ${fallbackError}`)

      await errorHandler.handleBackendLaunchError(
        fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
        {
          isFallback: true,
          workspaceRoot,
        },
      )

      throw fallbackError
    }
  }

  /**
   * Extract the appropriate binary for the current OS/architecture
   * @returns Promise resolving to the path of the extracted binary
   */
  private async extractBinary(): Promise<string> {
    // Check for environment override first
    const override = process.env.OPENCODE_BIN
    if (override && override.trim()) {
      logger.appendLine(`Using binary override: ${override}`)
      return override.trim()
    }

    try {
      // Get extension path
      const extension = vscode.extensions.getExtension("julianperezpesce.opencode-dragonfu")
      if (extension) {
        return await ResourceExtractor.extractBinary(extension.extensionPath)
      }
    } catch (e) {
      logger.appendLine(`Bundled binary not found: ${e}`)
    }

    // Fallback: Check for system binary
    const systemBinary = await this.findSystemBinary()
    if (systemBinary) {
      logger.appendLine(`Using system binary found at: ${systemBinary}`)
      return systemBinary
    }

    const msg = "OpenCode CLI not found. Please install it to use this extension."
    vscode.window.showErrorMessage(msg, "Install Guide").then((selection) => {
      if (selection === "Install Guide") {
        vscode.env.openExternal(vscode.Uri.parse("https://github.com/anomalyco/opencode"))
      }
    })
    
    throw new Error(msg)
  }

  /**
   * Check if 'opencode' command is available in the system PATH or common locations
   */
  private async findSystemBinary(): Promise<string | null> {
    const platform = os.platform()
    const candidates: string[] = ["opencode", "opencode-cli"] // Always check PATH first

    if (platform === "win32") {
      // Windows specific paths
      const localAppData = process.env.LOCALAPPDATA
      const programFiles = process.env.ProgramFiles
      const programFilesX86 = process.env["ProgramFiles(x86)"]

      candidates.push("opencode.exe")
      if (localAppData) candidates.push(path.join(localAppData, "opencode", "opencode.exe"))
      if (programFiles) candidates.push(path.join(programFiles, "opencode", "opencode.exe"))
      if (programFilesX86) candidates.push(path.join(programFilesX86, "opencode", "opencode.exe"))
    } else {
      // Unix-like (Linux/macOS) common paths
      candidates.push(path.join(os.homedir(), "bin", "opencode"))
      candidates.push(path.join(os.homedir(), "bin", "opencode-cli"))
      candidates.push("/usr/local/bin/opencode")
      candidates.push("/usr/bin/opencode")

      if (platform === "darwin") {
        // macOS specific (Homebrew)
        candidates.push("/opt/homebrew/bin/opencode")
      } else if (platform === "linux") {
        // Linux specific
        candidates.push(path.join(os.homedir(), ".local", "bin", "opencode"))
      }
    }

    for (const bin of candidates) {
      if (await this.checkBinary(bin)) {
        return bin
      }
    }
    return null
  }

  private checkBinary(binPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const checkProcess = spawn(binPath, ["--version"])
        checkProcess.on("error", () => resolve(false))
        checkProcess.on("exit", (code) => resolve(code === 0))
      } catch {
        resolve(false)
      }
    })
  }

  /**
   * Build command arguments for the backend process
   * @param binaryPath Path to the binary executable
   * @param skipCustomCommand Whether to skip custom command (for fallback)
   * @returns Array of command arguments
   */
  private buildCommandArgs(binaryPath: string, skipCustomCommand = false): string[] {
    const args = [binaryPath, "serve", "--cors", "*"]

    if (!skipCustomCommand) {
      const customCommand = this.getCustomCommand()
      if (customCommand.trim()) {
        const extraArgs = this.parseCommandArgs(customCommand.trim())
        if (extraArgs.length > 0) {
          args.push(...extraArgs)
          logger.appendLine(`Using extra serve args: '${extraArgs.join(" ")}'`)
        }
      } else {
        logger.appendLine("Using default serve args with CORS enabled")
      }
    }

    return args
  }

  /**
   * Get custom command from settings
   * @returns Custom command string
   */
  private getCustomCommand(): string {
    const config = vscode.workspace.getConfiguration("opencode")
    return config.get<string>("customCommand", "")
  }

  private parseCommandArgs(value: string): string[] {
    const args: string[] = []
    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(value)) !== null) {
      if (match[1] !== undefined) {
        args.push(match[1])
      } else if (match[2] !== undefined) {
        args.push(match[2])
      } else if (match[3] !== undefined) {
        args.push(match[3])
      }
    }
    return args
  }

  /**
   * Parse connection information from backend stdout
   * @param process The spawned backend process
   * @returns Promise resolving to connection info
   */
  private async parseConnectionInfo(process: ChildProcess): Promise<{ port: number; uiBase: string }> {
    return new Promise((resolve, reject) => {
      let stdoutData = ""
      let stderrData = ""
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          reject(new Error(`Timeout waiting for backend connection info. Stderr: ${stderrData}`))
        }
      }, 300000) // 300 second timeout

      process.stdout?.on("data", (data: Buffer) => {
        stdoutData += data.toString()
        const logLine = data.toString().trim()
        logger.appendLine(`Backend stdout: ${logLine}`)

        // Look for serve output
        const lines = stdoutData.split("\n")
        for (const line of lines) {
          const trimmed = line.trim()
          const match = trimmed.match(/opencode server listening on (https?:\/\/\S+)/i)
          if (match) {
            try {
              const serverUrl = new URL(match[1])
              const inferredPort = serverUrl.port ? Number(serverUrl.port) : serverUrl.protocol === "https:" ? 443 : 80
              const baseUrl = serverUrl.href.replace(/\/$/, "")
              const uiBase = `${baseUrl}/app`

              if (!resolved) {
                resolved = true
                clearTimeout(timeout)
                resolve({
                  port: inferredPort,
                  uiBase,
                })
              }
              return
            } catch (parseError) {
              logger.appendLine(`Failed to parse backend URL: ${parseError}`)
            }
          }
        }
      })

      process.stderr?.on("data", (data: Buffer) => {
        stderrData += data.toString()
        logger.appendLine(`Backend stderr: ${data.toString().trim()}`)
      })

      process.on("error", (error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          reject(new Error(`Backend process error: ${error.message}`))
        }
      })

      process.on("exit", (code, signal) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          reject(new Error(`Backend process exited with code ${code}, signal ${signal}. Stderr: ${stderrData}`))
        }
      })
    })
  }

  /**
   * Set up error handling for the backend process
   * @param process The backend process
   */
  private setupErrorHandling(process: ChildProcess): void {
    process.on("error", async (error) => {
      logger.appendLine(`Backend process error: ${error.message}`)

      await errorHandler.handleError(
        errorHandler.createErrorContext(
          ErrorCategory.BACKEND_LAUNCH,
          ErrorSeverity.ERROR,
          "BackendLauncher",
          "process_error",
          error,
          {
            pid: process.pid,
            killed: process.killed,
          },
        ),
      )
    })

    process.on("exit", async (code, signal) => {
      logger.appendLine(`Backend process exited with code ${code}, signal ${signal}`)

      if (code !== 0 && code !== null) {
        await errorHandler.handleError(
          errorHandler.createErrorContext(
            ErrorCategory.BACKEND_LAUNCH,
            ErrorSeverity.WARNING,
            "BackendLauncher",
            "process_exit",
            new Error(`Backend process exited unexpectedly with code ${code}`),
            {
              exitCode: code,
              signal,
              pid: process.pid,
            },
          ),
        )
      }

      // Clear current process reference
      if (this.currentProcess === process) {
        this.currentProcess = undefined
        this.currentConnection = undefined
      }
    })

    // Log stdout/stderr for debugging
    process.stdout?.on("data", (data: Buffer) => {
      const output = data.toString().trim()
      if (output && !output.startsWith("{")) {
        // Don't log JSON connection info again
        logger.appendLine(`Backend: ${output}`)
      }
    })

    process.stderr?.on("data", (data: Buffer) => {
      const output = data.toString().trim()
      logger.appendLine(`Backend error: ${output}`)

      // Handle critical stderr messages
      if (output.toLowerCase().includes("permission denied") || output.toLowerCase().includes("access denied")) {
        errorHandler.handleError(
          errorHandler.createErrorContext(
            ErrorCategory.PERMISSION,
            ErrorSeverity.ERROR,
            "BackendLauncher",
            "permission_error",
            new Error(`Permission error: ${output}`),
            { stderr: output },
          ),
        )
      } else if (output.toLowerCase().includes("port") && output.toLowerCase().includes("use")) {
        errorHandler.handleError(
          errorHandler.createErrorContext(
            ErrorCategory.NETWORK,
            ErrorSeverity.WARNING,
            "BackendLauncher",
            "port_conflict",
            new Error(`Port conflict: ${output}`),
            { stderr: output },
          ),
        )
      }
    })
  }

  /**
   * Terminate the backend process
   */
  terminate(): void {
    if (this.currentProcess) {
      logger.appendLine("Terminating backend process...")

      // Try graceful shutdown first
      this.currentProcess.kill("SIGTERM")

      // Force kill after timeout
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          logger.appendLine("Force killing backend process...")
          this.currentProcess.kill("SIGKILL")
        }
      }, 5000)

      this.currentProcess = undefined
      this.currentConnection = undefined
    }
  }

  /**
   * Check if backend is currently running
   * @returns True if backend process is active
   */
  isRunning(): boolean {
    return this.currentProcess !== undefined && !this.currentProcess.killed
  }
}
