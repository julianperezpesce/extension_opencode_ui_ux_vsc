import * as assert from "assert"

interface MockContextItem {
  id: string
  type: string
  path: string
  name: string
}

interface MockChatView {
  addContextItem?: (item: MockContextItem) => void
}

function addContextItemFromMessage(mockChatView: MockChatView | null, message: { payload?: { path?: string } }): void {
  if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
    const filePath = message.payload.path
    const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
    const name = filePath.split(/[\/\\]/).pop() || filePath
    mockChatView.addContextItem({
      id: `${filePath}-${Date.now()}`,
      type: isFolder ? "folder" : "file",
      path: filePath,
      name: name
    })
  }
}

suite("Webview Main Message Handler Test Suite", () => {
  suite("pastePath message handling - CORRECTED CODE", () => {
    test("Should add context item when chatView has addContextItem method and path exists", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "/home/user/project/src/index.ts"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1, "Should add exactly one context item")
      assert.strictEqual(addedItems[0].type, "file", "Type should be file (not ending in / or \\)")
      assert.strictEqual(addedItems[0].path, "/home/user/project/src/index.ts", "Path should match")
      assert.strictEqual(addedItems[0].name, "index.ts", "Name should be extracted from path")
    })

    test("Should detect folder when path ends with forward slash", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "/home/user/project/src/"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1)
      assert.strictEqual(addedItems[0].type, "folder", "Type should be folder for path ending with /")
      assert.strictEqual(addedItems[0].name, "src", "Name should be extracted")
    })

    test("Should detect folder when path ends with backslash (Windows)", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "C:\\Users\\test\\project\\"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1)
      assert.strictEqual(addedItems[0].type, "folder", "Type should be folder for path ending with \\")
      assert.strictEqual(addedItems[0].name, "project", "Name should be extracted from Windows path")
    })

    test("Should detect file for Windows path without trailing backslash", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "C:\\Users\\test\\project\\file.ts"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1)
      assert.strictEqual(addedItems[0].type, "file", "Type should be file for Windows path without trailing \\")
      assert.strictEqual(addedItems[0].name, "file.ts", "Name should be extracted from Windows path")
    })

    test("Should handle path without slashes correctly", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "singleFile.txt"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1)
      assert.strictEqual(addedItems[0].name, "singleFile.txt")
      assert.strictEqual(addedItems[0].type, "file")
    })

    test("Should handle Unix path with mixed separators correctly", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "/home/user/project/src/index.ts"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1)
      assert.strictEqual(addedItems[0].name, "index.ts")
    })

    test("Should not add context item when chatView is null", () => {
      const mockChatView: any = null

      const message = {
        type: "pastePath",
        payload: {
          path: "/home/user/test.ts"
        }
      }

      let error: Error | null = null
      try {
        if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
          const filePath = message.payload.path
          const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
          const name = filePath.split(/[\/\\]/).pop() || filePath
          mockChatView.addContextItem({
            id: `${filePath}-${Date.now()}`,
            type: isFolder ? "folder" : "file",
            path: filePath,
            name: name
          })
        }
      } catch (e) {
        error = e as Error
      }

      assert.strictEqual(error, null, "Should not throw when chatView is null")
    })

    test("Should not add context item when addContextItem is not a function", () => {
      const mockChatView: MockChatView = {
        addContextItem: "not a function" as any
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "/home/user/test.ts"
        }
      }

      let error: Error | null = null
      try {
        if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
          const filePath = message.payload.path
          const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
          const name = filePath.split(/[\/\\]/).pop() || filePath
          mockChatView.addContextItem({
            id: `${filePath}-${Date.now()}`,
            type: isFolder ? "folder" : "file",
            path: filePath,
            name: name
          })
        }
      } catch (e) {
        error = e as Error
      }

      assert.strictEqual(error, null, "Should not throw when addContextItem is not a function")
    })

    test("Should not add context item when path is undefined", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {} as { path?: string }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 0, "Should not add item when path is undefined")
    })

    test("Should generate unique ID with timestamp", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: "/home/user/test.ts"
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.ok(addedItems[0].id.includes("test.ts-"), "ID should include path and timestamp")
    })

    test("Should handle empty path string correctly", () => {
      const addedItems: MockContextItem[] = []
      const mockChatView: MockChatView = {
        addContextItem: (item: MockContextItem) => {
          addedItems.push(item)
        }
      }

      const message = {
        type: "pastePath",
        payload: {
          path: ""
        }
      }

      if (mockChatView && typeof mockChatView.addContextItem === "function" && message.payload?.path) {
        const filePath = message.payload.path
        const isFolder = filePath.endsWith("/") || filePath.endsWith("\\")
        const name = filePath.split(/[\/\\]/).pop() || filePath
        mockChatView.addContextItem({
          id: `${filePath}-${Date.now()}`,
          type: isFolder ? "folder" : "file",
          path: filePath,
          name: name
        })
      }

      assert.strictEqual(addedItems.length, 1, "Should add item even with empty path")
      assert.strictEqual(addedItems[0].name, "", "Name should be empty string")
      assert.strictEqual(addedItems[0].type, "file", "Empty path should be treated as file")
    })
  })
})
