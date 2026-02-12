import * as vscode from "vscode"
import { errorHandler } from "../utils/ErrorHandler"
/**
 * Settings management - mirrors OpenCodeSettings.kt and OpenCodeConfigurable.kt
 * Handles VSCode configuration integration and real-time synchronization
 */

export interface OpenCodeSettings {
  customCommand: string
}

/**
 * Default settings values matching JetBrains plugin defaults
 */
const DEFAULT_SETTINGS: OpenCodeSettings = {
  customCommand: "",
}

export class SettingsManager {
  private static readonly SECTION = "opencode"
  private changeListeners: ((settings: OpenCodeSettings) => void)[] = []
  private configurationListener?: vscode.Disposable

  /**
   * Get current settings from VSCode configuration
   * @returns Current OpenCode settings with validation and defaults
   */
  getSettings(): OpenCodeSettings {
    try {
      const config = vscode.workspace.getConfiguration(SettingsManager.SECTION)

      // Get values with validation and defaults
      const customCommand = config.get<string>("customCommand", DEFAULT_SETTINGS.customCommand)
      // Validate and sanitize values
      const validatedSettings: OpenCodeSettings = {
        customCommand: typeof customCommand === "string" ? customCommand : DEFAULT_SETTINGS.customCommand,
      }

      return validatedSettings
    } catch (error) {
      console.error("Failed to get settings, using defaults:", error)
      return { ...DEFAULT_SETTINGS }
    }
  }

  /**
   * Update a specific setting in VSCode configuration
   * @param key Setting key
   * @param value Setting value
   * @param target Configuration target (Global, Workspace, or WorkspaceFolder)
   */
  async updateSetting(
    key: keyof OpenCodeSettings,
    value: any,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(SettingsManager.SECTION)

      // Validate the value based on the key
      const validatedValue = this.validateSettingValue(key, value)

      await config.update(key, validatedValue, target)

      // Notify listeners of the change
      const updatedSettings = this.getSettings()
      this.notifyListeners(updatedSettings)
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error)

      await errorHandler.handleSettingsError(error instanceof Error ? error : new Error(String(error)), {
        key,
        value,
        target,
      })

      throw error
    }
  }

  /**
   * Update multiple settings at once
   * @param settings Partial settings object with values to update
   * @param target Configuration target
   */

  /**
   * Add a listener for settings changes
   * @param listener Callback function for settings changes
   * @returns Disposable to remove the listener
   */
  onSettingsChange(listener: (settings: OpenCodeSettings) => void): vscode.Disposable {
    this.changeListeners.push(listener)

    return new vscode.Disposable(() => {
      const index = this.changeListeners.indexOf(listener)
      if (index >= 0) {
        this.changeListeners.splice(index, 1)
      }
    })
  }

  /**
   * Initialize settings monitoring for configuration changes
   * @returns Disposable to stop monitoring
   */
  initialize(): vscode.Disposable {
    // Clean up existing listener if any
    if (this.configurationListener) {
      this.configurationListener.dispose()
    }

    // Listen for configuration changes
    this.configurationListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(SettingsManager.SECTION)) {
        const updatedSettings = this.getSettings()
        this.notifyListeners(updatedSettings)
      }
    })

    return this.configurationListener
  }

  /**
   * Validate a setting value based on its key
   * @param key Setting key
   * @param value Value to validate
   * @returns Validated value or default if invalid
   */
  private validateSettingValue(key: keyof OpenCodeSettings, value: any): any {
    switch (key) {
      case "customCommand":
        return typeof value === "string" ? value : DEFAULT_SETTINGS.customCommand
      default:
        throw new Error(`Unknown setting key: ${key}`)
    }
  }

  /**
   * Notify all listeners of settings changes
   * @param settings Updated settings
   */
  private notifyListeners(settings: OpenCodeSettings): void {
    for (const listener of this.changeListeners) {
      try {
        listener(settings)
      } catch (error) {
        console.error("Error in settings change listener:", error)
      }
    }
  }

  /**
   * Get default settings
   * @returns Default settings object
   */
  static getDefaults(): OpenCodeSettings {
    return { ...DEFAULT_SETTINGS }
  }

  /**
   * Dispose of the settings manager and clean up resources
   */
  dispose(): void {
    if (this.configurationListener) {
      this.configurationListener.dispose()
      this.configurationListener = undefined
    }
    this.changeListeners = []
  }
}
