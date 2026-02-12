import * as assert from "assert"
import { SettingsManager } from "../../settings/SettingsManager"

suite("SettingsManager Test Suite", () => {
  let settingsManager: SettingsManager

  setup(() => {
    settingsManager = new SettingsManager()
  })

  teardown(() => {
    settingsManager.dispose()
  })

  test("should create SettingsManager instance", () => {
    assert.ok(settingsManager instanceof SettingsManager)
  })

  test("should return default settings", () => {
    const defaults = SettingsManager.getDefaults()

    assert.strictEqual(typeof defaults.customCommand, "string")
    assert.strictEqual(defaults.customCommand, "")
  })

  test("should get settings without throwing", () => {
    assert.doesNotThrow(() => {
      const settings = settingsManager.getSettings()
      assert.ok(settings)
      assert.ok(typeof settings.customCommand === "string")
    })
  })

  test("should handle dispose without throwing", () => {
    assert.doesNotThrow(() => {
      settingsManager.dispose()
    })
  })

  test("should handle multiple dispose calls", () => {
    assert.doesNotThrow(() => {
      settingsManager.dispose()
      settingsManager.dispose()
    })
  })
})
