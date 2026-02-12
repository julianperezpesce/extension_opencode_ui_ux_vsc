import * as fs from "fs"
import * as path from "path"
import * as os from "os"

/**
 * Binary extraction utility - mirrors ResourceExtractor.kt
 * Handles OS/architecture detection and binary extraction from extension resources
 */
export class ResourceExtractor {
  private static readonly STABLE_DIR = "opencode-bin"
  private static readonly STALE_PREFIX = "opencode-"

  /**
   * Extract the appropriate opencode binary for the current platform.
   * Uses a deterministic path so the binary is reused across launches and
   * only re-copied when the source file size changes (e.g. extension update).
   * @param extensionPath Path to the extension directory
   * @returns Promise resolving to the path of the extracted binary
   */
  static async extractBinary(extensionPath: string): Promise<string> {
    const osType = this.detectOS()
    const arch = this.detectArchitecture()

    const binaryName = osType === "windows" ? "opencode.exe" : "opencode"

    const binaryPath = path.join(extensionPath, "resources", "bin", osType, arch, binaryName)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found for platform ${osType}/${arch} at ${binaryPath}`)
    }

    const stableDir = path.join(os.tmpdir(), this.STABLE_DIR)
    await fs.promises.mkdir(stableDir, { recursive: true })
    const destPath = path.join(stableDir, binaryName)

    try {
      await fs.promises.copyFile(binaryPath, destPath)
    } catch (e: any) {
      // Binary may be in use – continue with existing copy
      console.log(`[ResourceExtractor] Could not overwrite binary (may be in use): ${e?.code || e}`)
    }

    if (osType !== "windows") {
      await this.makeExecutable(destPath)
    }

    // Best-effort cleanup of stale random temp files from previous versions
    this.cleanupStaleTempFiles().catch(() => {})

    return destPath
  }

  /**
   * Remove stale opencode-* temp files/dirs left by older plugin versions.
   */
  private static async cleanupStaleTempFiles(): Promise<void> {
    const tmpDir = os.tmpdir()
    const entries = await fs.promises.readdir(tmpDir)
    for (const entry of entries) {
      if (!entry.startsWith(this.STALE_PREFIX) || entry === this.STABLE_DIR) continue
      // Match old random pattern: opencode-<timestamp>-<random> or opencode-<random-dir>
      if (!/^opencode-\d/.test(entry)) continue
      const full = path.join(tmpDir, entry)
      try {
        const stat = await fs.promises.stat(full)
        if (stat.isDirectory()) {
          await fs.promises.rm(full, { recursive: true, force: true })
        } else {
          await fs.promises.unlink(full)
        }
      } catch {
        // ignore – file may be in use or already removed
      }
    }
  }

  /**
   * Detect the current operating system
   * @returns OS identifier (windows, macos, linux)
   */
  private static detectOS(): string {
    const platform = os.platform()

    switch (platform) {
      case "win32":
        return "windows"
      case "darwin":
        return "macos"
      case "linux":
        return "linux"
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * Detect the current architecture
   * @returns Architecture identifier (amd64, arm64)
   */
  private static detectArchitecture(): string {
    const arch = os.arch()

    switch (arch) {
      case "x64":
        return "amd64"
      case "arm64":
        return "arm64"
      default:
        throw new Error(`Unsupported architecture: ${arch}`)
    }
  }

  /**
   * Make a file executable (Unix-like systems)
   * @param filePath Path to the file to make executable
   */
  private static async makeExecutable(filePath: string): Promise<void> {
    try {
      await fs.promises.chmod(filePath, 0o755)
    } catch (error) {
      throw new Error(`Failed to make file executable: ${error}`)
    }
  }
}
