/**
 * Unified message type definitions for VSCode plugin communication
 * These match the message format expected by the web UI MessageDispatcher
 */

export interface BaseMessage {
  type: string
  timestamp?: number
}

export interface InsertPathsMessage extends BaseMessage {
  type: "insertPaths"
  paths: string[]
}

export interface PastePathMessage extends BaseMessage {
  type: "pastePath"
  path: string
}

export interface UpdateOpenedFilesMessage extends BaseMessage {
  type: "updateOpenedFiles"
  openedFiles?: string[]
  currentFile?: string | null
}

export interface ChatReceiveMessage extends BaseMessage {
  type: "chat.receive"
  text: string
  command?: string
}

export interface ChatStreamingMessage extends BaseMessage {
  type: "chat.streaming"
  text: string
}

export interface ErrorMessage extends BaseMessage {
  type: "error"
  text: string
  command?: string
}

export type UnifiedMessage =
  | InsertPathsMessage
  | PastePathMessage
  | UpdateOpenedFilesMessage
  | ChatReceiveMessage
  | ChatStreamingMessage
  | ErrorMessage

/**
 * Interface for plugin communication using unified message protocol
 */
export interface PluginCommunicator {
  sendMessage(message: UnifiedMessage): void
  insertPaths(paths: string[]): void
  pastePath(path: string): void
  updateOpenedFiles(files: string[], current?: string): void
}
