# Changelog

All notable changes to the OpenCode VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec2.0.0.html).

### [26.2.8] - 2026-02-08

- Favorites models
- Improved resource extraction to use deterministic paths and cleanup stale temp files
- Fixed drag&drop file in Remote-SSH on Windows and Linux
- Multi instance management fix
- Enhance CSP handling for Remote-SSH compatibility

### [26.2.7] - 2026-02-07

- Add command execution support with / command prefix
- Fixed empty plugin content when dragging plugin between sidebars
- Fix drag&drop for v1.108+ - needs shift key hold
- Enhance error handling to differentiate external errors from extension-specific ones
- Changed communication between UI <-> IDE to HTTP + SSE

### [26.2.1] - 2026-02-01

- Fix for Copy to clipboard button
- Improved positioning of reference popup (@ action)
- Fixed empty plugin content when dragging plugin between sidebars
- Updated OpenCode to v1.1.48

### [26.1.29] - 2026-01-29

- Fixed copy & paste in VS Code for Mac OS

### [26.1.27] - 2026-01-27

- apply_patch tool fallback count for Changed Files panel
- removed forbidden getPluginId()
- fixed not showing tooltips

### [26.1.24] - 2026-01-24

- Share / Unshare session
- Added button"Copy to clipboard" message content
- Removed rendering internal message "patch" - thanks to caiqy
- Files changed panel now provide stats from OpenCode server - thanks to caiqy
- Improved availability of "Retry" button for failed session
- Updated OpenCode to v1.1.34

### [26.1.17] - 2026-01-17

- Added support for "Question" tool
- Added model "variants" - reasoning effort
- Fixed Agents modes list
- Fixed some models name on Recent list
- Updated OpenCode to v1.1.24

### [26.1.11] - 2026-01-11

- Session errors now display in the chat instead of toast
- Session Retry: Added retry functionality for failed sessions
- Updated OpenCode to v1.1.11

### [26.1.5] - 2026-01-05

- Updated OpenCode to v1.1.2

### [26.1.2] - 2026-01-02

- OAuth Instructions: Support for provider-specific instructions during OAuth flow
- Token Usage Stats: Display token usage breakdown and cost in a popover for assistant messages
- Updated OpenCode to v1.0.223

## [25.12.29] - 2025-12-29

- Updated OpenCode to v1.0.207

## [25.12.21] - 2025-12-21

- Updated OpenCode to v1.0.184

## [25.12.16] - 2025-12-16

- Updated OpenCode to v1.0.163

## [25.12.5] - 2025-12-05

- Auto refresh files in IDE on edit/write
- New panel with all modified files in session
- New panel with all TODOs in session
- Fixed placement of Model/Agent selector
- Updated OpenCode to v1.0.133

## [25.11.30] - 2025-11-30

- Updated OpenCode to v1.0.121
- Fixed working directory as server start directory, not git root

## [25.11.24] - 2025-11-24

- UI improvements

## [25.11.20] - 2025-11-20

- Providers can be configured from Settings panel - can be added/removed, also OAuth
- Fixed context size bug when session what aborted
- Fix session error toasts and display session state messages
- Updated OpenCode to v1.0.80

## [25.11.19] - 2025-11-19

- Updated OpenCode to v1.0.78

## [25.11.18] - 2025-11-18

### Added

- First release of the OpenCode VSCode plugin, based on OpenCode v1.0.68

### Features

- **Backend Management**: Automatic extraction and launching of opencode binaries
- **UI Integration**: Embedded web UI using VSCode's Webview API
- **IDE Commands**: Context menu actions for adding files/folders to terminal context
- **File Operations**: Drag-and-drop support and path insertion utilities
- **Cross-Platform**: Support for Windows, macOS, and Linux with appropriate binaries
