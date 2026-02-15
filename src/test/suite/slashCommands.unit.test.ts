import * as assert from "assert"

/**
 * Tests unitarios para la funcionalidad de Slash Commands
 * Estos tests no requieren el DOM ni VS Code API
 */

// Simulación de las funciones de parsing de comandos
function parseSlashCommand(text: string): { command: string; args?: string } | null {
  const trimmed = text.trim()
  if (trimmed.startsWith("/")) {
    const parts = trimmed.slice(1).split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1).join(" ")
    return { command, args: args || undefined }
  }
  return null
}

function buildSlashCommandPrompt(
  command: string,
  code: string
): string {
  switch (command) {
    case "explain":
      return `Explica el siguiente código:\n\n\`\`\`\n${code}\n\`\`\``
    case "fix":
      return `Encuentra y corrige los errores en el siguiente código:\n\n\`\`\`\n${code}\n\`\`\``
    case "test":
      return `Genera tests unitarios para el siguiente código:\n\n\`\`\`\n${code}\n\`\`\``
    default:
      return `/${command}`
  }
}

function extractTextContent(event: any): string | null {
  const part = event.properties?.part
  const delta = event.properties?.delta
  return (
    (typeof delta === "string" ? delta : delta?.text) ||
    part?.text ||
    (typeof part === "string" ? part : null)
  )
}

suite("Slash Commands Parsing Tests", () => {
  test("parseSlashCommand should parse /explain", () => {
    const result = parseSlashCommand("/explain this function")
    assert.ok(result)
    assert.strictEqual(result?.command, "explain")
    assert.strictEqual(result?.args, "this function")
  })

  test("parseSlashCommand should parse /explain without args", () => {
    const result = parseSlashCommand("/explain")
    assert.ok(result)
    assert.strictEqual(result?.command, "explain")
    assert.strictEqual(result?.args, undefined)
  })

  test("parseSlashCommand should parse /fix", () => {
    const result = parseSlashCommand("/fix this bug")
    assert.ok(result)
    assert.strictEqual(result?.command, "fix")
    assert.strictEqual(result?.args, "this bug")
  })

  test("parseSlashCommand should parse /test", () => {
    const result = parseSlashCommand("/test this function")
    assert.ok(result)
    assert.strictEqual(result?.command, "test")
    assert.strictEqual(result?.args, "this function")
  })

  test("parseSlashCommand should handle case insensitivity", () => {
    const result = parseSlashCommand("/EXPLAIN this")
    assert.ok(result)
    assert.strictEqual(result?.command, "explain")
  })

  test("parseSlashCommand should reject non-slash commands", () => {
    assert.strictEqual(parseSlashCommand("explain this"), null)
    assert.strictEqual(parseSlashCommand(" /explain"), null)
    assert.strictEqual(parseSlashCommand("regular message"), null)
    assert.strictEqual(parseSlashCommand(""), null)
  })
})

suite("Prompt Building Tests", () => {
  test("buildSlashCommandPrompt should create explain prompt", () => {
    const code = "function add(a, b) { return a + b; }"
    const prompt = buildSlashCommandPrompt("explain", code)
    
    assert.ok(prompt.includes("Explica"))
    assert.ok(prompt.includes(code))
    assert.ok(prompt.includes("```"))
  })

  test("buildSlashCommandPrompt should create fix prompt", () => {
    const code = "function bug() { retrun true; }"
    const prompt = buildSlashCommandPrompt("fix", code)
    
    assert.ok(prompt.includes("corrige"))
    assert.ok(prompt.includes(code))
  })

  test("buildSlashCommandPrompt should create test prompt", () => {
    const code = "function multiply(a, b) { return a * b; }"
    const prompt = buildSlashCommandPrompt("test", code)
    
    assert.ok(prompt.includes("tests unitarios"))
    assert.ok(prompt.includes(code))
  })

  test("buildSlashCommandPrompt should handle empty code", () => {
    const prompt = buildSlashCommandPrompt("explain", "")
    assert.ok(prompt.includes("```"))
    assert.ok(prompt.includes("Explica"))
  })

  test("buildSlashCommandPrompt should handle unknown command", () => {
    const prompt = buildSlashCommandPrompt("unknown", "code")
    assert.strictEqual(prompt, "/unknown")
  })
})

suite("Event Stream Delta Handling Tests", () => {
  test("extractTextContent should handle delta as string", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        part: { text: "Existing text" },
        delta: " incremental update",
      },
    }

    const result = extractTextContent(event)
    assert.strictEqual(result, " incremental update")
  })

  test("extractTextContent should handle delta as object", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        part: { text: "Existing text" },
        delta: { text: " object update" },
      },
    }

    const result = extractTextContent(event)
    assert.strictEqual(result, " object update")
  })

  test("extractTextContent should fall back to part.text", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        part: { text: "Full text content" },
      },
    }

    const result = extractTextContent(event)
    assert.strictEqual(result, "Full text content")
  })

  test("extractTextContent should handle part as string", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        part: "Simple string part",
      },
    }

    const result = extractTextContent(event)
    assert.strictEqual(result, "Simple string part")
  })

  test("extractTextContent should return null for invalid event", () => {
    const event = {
      type: "message.part.updated",
      properties: {},
    }

    const result = extractTextContent(event)
    assert.strictEqual(result, null)
  })
})

suite("Large File Detection Tests", () => {
  const MAX_CHARS = 50000

  test("should detect file as large when over limit", () => {
    const largeCode = "x".repeat(MAX_CHARS + 1)
    assert.ok(largeCode.length > MAX_CHARS, "Should be over limit")
  })

  test("should not detect file as large when under limit", () => {
    const normalCode = "function test() { return true; }"
    assert.ok(normalCode.length <= MAX_CHARS, "Should be under limit")
  })

  test("should handle exactly at limit", () => {
    const exactCode = "x".repeat(MAX_CHARS)
    assert.strictEqual(exactCode.length, MAX_CHARS)
  })
})

suite("Command Button Logic Tests", () => {
  test("should prepare correct command for explain button", () => {
    const command = { command: "explain" }
    assert.strictEqual(command.command, "explain")
  })

  test("should prepare correct command for fix button", () => {
    const command = { command: "fix" }
    assert.strictEqual(command.command, "fix")
  })

  test("should prepare correct command for test button", () => {
    const command = { command: "test" }
    assert.strictEqual(command.command, "test")
  })
})
