import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea, vsCodeTag, vsCodeBadge } from '@vscode/webview-ui-toolkit';
import { renderMarkdown, parseMessageForActions, detectMessageType } from '../utils/markdown-renderer';
import { ChatMessage } from './chat-message';
import './chat-input';
import './connection-status';
import './context-bar';
import './command-buttons';
import './range-dialog';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea(), vsCodeTag(), vsCodeBadge());

interface ContextItem {
    id: string;
    type: 'file' | 'folder' | 'code';
    path: string;
    name: string;
    lineStart?: number;
    lineEnd?: number;
    content?: string;
}

interface SlashCommand {
    command: string;
    args?: string;
}

interface EditorSelection {
    text: string;
    filePath?: string;
    startLine?: number;
    endLine?: number;
}

@customElement('chat-view')
export class ChatView extends LitElement {
    @state()
    private messages: ChatMessage[] = [];

    @state()
    private inputValue = '';

    @state()
    private contextItems: ContextItem[] = [];

    @state()
    private currentFile: { path: string; name: string } | null = null;

    @state()
    private includeFullContext = false;

    @state()
    private pendingSlashCommand: SlashCommand | null = null;

    @state()
    private waitingForSelection = false;

    @state()
    private backendConnected = false;

    @state()
    private backendReused = false;

    @state()
    private lastUserCommandType: 'explain' | 'fix' | 'test' | null = null;

    @state()
    private showRangeDialog = false;

    @state()
    private pendingRangeCommand: SlashCommand | null = null;

    @state()
    private rangeDialogFileInfo: { path: string; totalLines: number } | null = null;

    @state()
    private rangeStart = '';

    @state()
    private rangeEnd = '';

    @property({ type: Boolean })
    isThinking = false;

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100vh;
            width: 100%;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        chat-message {
            display: block;
            width: 100%;
        }

        chat-message[role="user"] {
            align-self: flex-end;
        }

        chat-message[role="assistant"] {
            align-self: flex-start;
        }

        chat-message[role="system"] {
            align-self: center;
        }

        .message {
            max-width: 85%;
            padding: 0.8rem;
            border-radius: 6px;
            position: relative;
            line-height: 1.5;
            font-size: var(--vscode-font-size);
        }

        .message.user {
            align-self: flex-end;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-bottom-right-radius: 2px;
        }

        .message.assistant {
            align-self: flex-start;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom-left-radius: 2px;
            border-left: 3px solid var(--vscode-activityBar-activeBorder);
        }

        .message.assistant.explain {
            border-left-color: var(--vscode-charts-cyan);
        }

        .message.assistant.fix {
            border-left-color: var(--vscode-charts-red);
        }

        .message.assistant.test {
            border-left-color: var(--vscode-charts-green);
        }

        .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .message-emoji {
            font-size: 1.2rem;
        }

        .message .content {
            line-height: 1.6;
        }

        .message .content h1,
        .message .content h2,
        .message .content h3 {
            margin-top: 0.5rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }

        .message .content h1 { font-size: 1.4rem; }
        .message .content h2 { font-size: 1.2rem; }
        .message .content h3 { font-size: 1.1rem; }

        .message .content p {
            margin: 0.5rem 0;
        }

        .message .content ul,
        .message .content ol {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
        }

        .message .content li {
            margin: 0.25rem 0;
        }

        .message .content pre.code-block {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 0.75rem;
            margin: 0.5rem 0;
            overflow-x: auto;
            font-size: 0.9em;
        }

        .message .content code {
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
            background-color: var(--vscode-editor-wordHighlightBackground);
            padding: 0.1rem 0.3rem;
            border-radius: 3px;
            font-size: 0.9em;
        }

        .message .content pre code {
            background-color: transparent;
            padding: 0;
        }

        .message-actions {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.75rem;
            padding-top: 0.5rem;
            border-top: 1px solid var(--vscode-widget-border);
        }

        .action-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.3rem 0.6rem;
            border-radius: 4px;
            font-size: 0.75rem;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            transition: all 0.2s;
        }

        .action-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .action-btn.apply {
            background-color: rgba(0, 255, 136, 0.15);
            border-color: var(--vscode-charts-green);
            color: var(--vscode-charts-green);
        }

        .action-btn.apply:hover {
            background-color: rgba(0, 255, 136, 0.25);
        }

        :host-context(.dragonfu-theme) .action-btn.apply {
            background-color: rgba(0, 255, 136, 0.15);
            color: var(--dragonfu-neon-green, #00ff88);
            border-color: var(--dragonfu-neon-green, #00ff88);
        }

        :host-context(.dragonfu-theme) .action-btn.apply:hover {
            background-color: rgba(0, 255, 136, 0.25);
        }

        /* Highlight.js theme integration */
        .message .content .hljs {
            background: transparent;
            color: var(--vscode-editor-foreground);
        }

        .message .content .hljs-keyword,
        .message .content .hljs-selector-tag,
        .message .content .hljs-title {
            color: var(--vscode-charts-purple);
        }

        .message .content .hljs-string,
        .message .content .hljs-template-variable {
            color: var(--vscode-charts-red);
        }

        .message .content .hljs-comment {
            color: var(--vscode-editorLineNumber-foreground);
        }

        :host-context(.dragonfu-theme) .message .content .hljs-keyword,
        :host-context(.dragonfu-theme) .message .content .hljs-title {
            color: var(--dragonfu-neon-cyan, #00f3ff);
        }

        :host-context(.dragonfu-theme) .message .content .hljs-string {
            color: var(--dragonfu-neon-red, #ff0055);
        }

        /* DragonFu specific overrides come from :host-context or global styles */
        :host-context(.dragonfu-theme) .message.assistant {
            border-left: 3px solid var(--dragonfu-neon-cyan);
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.1);
        }

        .connection-status {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.3rem 1rem;
            font-size: 0.7rem;
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .connection-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--vscode-charts-yellow);
            transition: background-color 0.3s;
        }

        .connection-dot.connected {
            background-color: var(--vscode-charts-green);
        }

        :host-context(.dragonfu-theme) .connection-dot.connected {
            background-color: var(--dragonfu-neon-green, #00ff88);
            box-shadow: 0 0 6px var(--dragonfu-neon-green, #00ff88);
        }

        .connection-text {
            font-weight: 500;
        }

        .input-area {
            padding: 1rem;
            border-top: 1px solid var(--vscode-widget-border);
            background-color: var(--vscode-editor-background);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;
            color: var(--vscode-descriptionForeground);
        }

        vscode-text-area {
            width: 100%;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        .context-area {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            padding: 0.5rem 0;
            min-height: 2rem;
            align-items: center;
        }

        .context-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.2rem 0.5rem;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .context-badge:hover {
            opacity: 0.8;
        }

        .context-badge .remove-btn {
            margin-left: 0.2rem;
            cursor: pointer;
            font-weight: bold;
            opacity: 0.7;
        }

        .context-badge .remove-btn:hover {
            opacity: 1;
        }

        .context-badge.file {
            border-left: 3px solid var(--vscode-activityBar-activeBorder);
        }

        .context-badge.folder {
            border-left: 3px solid var(--vscode-charts-yellow);
        }

        .context-badge.code {
            border-left: 3px solid var(--vscode-charts-green);
        }

        :host-context(.dragonfu-theme) .context-badge.file {
            border-left-color: var(--dragonfu-neon-cyan, #00f3ff);
            background-color: rgba(0, 243, 255, 0.1);
        }

        :host-context(.dragonfu-theme) .context-badge.folder {
            border-left-color: var(--dragonfu-neon-yellow, #ffee00);
            background-color: rgba(255, 238, 0, 0.1);
        }

        :host-context(.dragonfu-theme) .context-badge.code {
            border-left-color: var(--dragonfu-neon-green, #00ff88);
            background-color: rgba(0, 255, 136, 0.1);
        }

        .context-controls {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
        }

        .add-file-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.2rem 0.5rem;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .add-file-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .add-file-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .toggle-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.3rem 0.6rem;
            border-radius: 20px;
            font-size: 0.75rem;
            border: none;
            background-color: #555;
            color: #ccc;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .toggle-btn:hover {
            background-color: #666;
        }

        .toggle-btn.active {
            background-color: #ff00ff;
            color: white;
            box-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
        }

        .toggle-icon {
            font-size: 0.85rem;
            line-height: 1;
        }

        :host-context(.dragonfu-theme) .toggle-btn.active {
            background-color: #ff00ff;
            box-shadow: 0 0 12px rgba(255, 0, 255, 0.7);
        }

        :host-context(.dragonfu-theme) .toggle-btn {
            background-color: #333;
            color: #888;
        }

        :host-context(.dragonfu-theme) .toggle-btn:hover {
            background-color: #444;
        }

        .command-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.25rem 0.6rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            transition: all 0.2s;
        }

        .command-btn:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .command-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .command-btn.explain {
            border-color: var(--vscode-charts-cyan);
        }

        .command-btn.fix {
            border-color: var(--vscode-charts-red);
        }

        .command-btn.test {
            border-color: var(--vscode-charts-green);
        }

        :host-context(.dragonfu-theme) .command-btn.explain {
            background-color: rgba(0, 243, 255, 0.15);
            color: var(--dragonfu-neon-cyan, #00f3ff);
            border-color: var(--dragonfu-neon-cyan, #00f3ff);
        }

        :host-context(.dragonfu-theme) .command-btn.fix {
            background-color: rgba(255, 0, 85, 0.15);
            color: var(--dragonfu-neon-red, #ff0055);
            border-color: var(--dragonfu-neon-red, #ff0055);
        }

        :host-context(.dragonfu-theme) .command-btn.test {
            background-color: rgba(0, 255, 136, 0.15);
            color: var(--dragonfu-neon-green, #00ff88);
            border-color: var(--dragonfu-neon-green, #00ff88);
        }

        :host-context(.dragonfu-theme) .command-btn.explain:hover:not(:disabled) {
            background-color: rgba(0, 243, 255, 0.25);
        }

        :host-context(.dragonfu-theme) .command-btn.fix:hover:not(:disabled) {
            background-color: rgba(255, 0, 85, 0.25);
        }

        :host-context(.dragonfu-theme) .command-btn.test:hover:not(:disabled) {
            background-color: rgba(0, 255, 136, 0.25);
        }

        .range-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            min-width: 400px;
        }

        .range-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 999;
        }

        .range-dialog-title {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--vscode-editor-foreground);
        }

        .range-dialog-message {
            font-size: 0.875rem;
            margin-bottom: 1rem;
            color: var(--vscode-descriptionForeground);
        }

        .range-dialog-inputs {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        .range-dialog-input {
            flex: 1;
            padding: 0.5rem;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: var(--vscode-input-foreground);
            font-size: 0.875rem;
        }

        .range-dialog-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
        }

        .drop-zone {
            border: 2px dashed var(--vscode-widget-border);
            border-radius: 4px;
            padding: 0.5rem;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 0.8rem;
            transition: all 0.2s;
        }

        .drop-zone.drag-over {
            border-color: var(--vscode-activityBar-activeBorder);
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
    `;

    render() {
        return html`
            <div class="chat-container">
                ${this.messages.map(msg => html`
                    <chat-message
                        .message="${msg}"
                        .showActions="${msg.role === 'assistant' && msg.hasCode && msg.type !== 'explain'}"
                        role="${msg.role}"
                        @copy-code="${(e: CustomEvent) => this.copyCodeToClipboard(e.detail.content)}"
                        @show-preview="${(e: CustomEvent) => this.showDiffPreview(e.detail.message)}"
                    ></chat-message>
                `)}
                ${this.isThinking ? html`
                    <div class="message assistant thinking">
                        <vscode-tag>Thinking...</vscode-tag>
                    </div>
                ` : ''}
            </div>

            <connection-status
                .connected="${this.backendConnected}"
                .reused="${this.backendReused}"
            ></connection-status>

            <div class="input-area">
                <context-bar
                    .items="${this.contextItems}"
                    .currentFile="${this.currentFile}"
                    .includeFullContext="${this.includeFullContext}"
                    @add-current-file="${this.addCurrentFileToContext}"
                    @browse-files="${this.requestFileSelection}"
                    @toggle-full-context="${this.toggleFullContext}"
                    @remove-item="${(e: CustomEvent) => this.removeContextItem(e.detail.id)}"
                ></context-bar>

                <command-buttons
                    @command="${this.handleCommand}"
                ></command-buttons>

                <chat-input
                    placeholder="Ask OpenCode (Try /help, @filename, or drag files)..."
                    .contextCount="${this.contextItems.length}"
                    @send-message="${this.handleSendMessage}"
                    @clear-chat="${this.handleClearChat}"
                    @files-dropped="${this.handleFilesDropped}"
                ></chat-input>
            </div>

            <range-dialog
                .open="${this.showRangeDialog}"
                .filePath="${this.rangeDialogFileInfo?.path || ''}"
                .totalLines="${this.rangeDialogFileInfo?.totalLines || 0}"
                @apply="${this.handleRangeApply}"
                @cancel="${this.closeRangeDialog}"
                @error="${(e: CustomEvent) => this.addMessage('system', '❌ ' + e.detail.message)}"
            ></range-dialog>
        `;
    }

    private handleInput(e: any) {
        this.inputValue = e.target.value;
    }

    private handleSendMessage(e: CustomEvent) {
        this.inputValue = e.detail.text;
        this.sendMessage();
    }

    private handleClearChat() {
        this.clearChat();
    }

    private handleFilesDropped(e: CustomEvent) {
        const files = e.detail.files;
        files.forEach((file: { path: string; name: string }) => {
            this.requestAddFileToContext(file.path, file.name);
        });
    }

    private handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    private sendMessage() {
        if (!this.inputValue.trim() && this.contextItems.length === 0) return;

        const content = this.inputValue;
        
        // Check if it's a slash command
        const slashCommand = this.parseSlashCommand(content);
        
        if (slashCommand) {
            // For slash commands, we need to get the editor selection first
            this.pendingSlashCommand = slashCommand;
            this.waitingForSelection = true;
            
            // Ask extension host for current editor selection
            this.requestEditorSelection();
            
            // Don't send yet, wait for selection
            return;
        }

        // Normal message flow - include context
        this.sendMessageWithContent(content, this.contextItems);
    }

    private sendMessageWithContent(content: string, includeContext: ContextItem[] = []): void {
        // Detect command type from user message for the response
        const messageType = detectMessageType(content);
        if (messageType !== 'general') {
            this.lastUserCommandType = messageType;
        }
        
        // Add message with context (only for normal messages, not slash commands)
        this.addMessage('user', content, includeContext);
        this.inputValue = '';
        this.isThinking = true;

        // Get current context and clear it for next message
        const currentContext = [...this.contextItems];
        this.contextItems = [];

        // Dispatch event to VS Code extension
        this.dispatchMessageToExtension(content, currentContext);
    }

    private sendSlashCommandWithoutContext(content: string): void {
        // For slash commands, send WITHOUT any context
        this.addMessage('user', content, []);
        this.inputValue = '';
        this.isThinking = true;

        // Store the command type for the assistant's response
        const slashCmd = this.parseSlashCommand(content);
        if (slashCmd) {
            this.lastUserCommandType = slashCmd.command as 'explain' | 'fix' | 'test';
        }

        // Clear context since we're not using it for slash commands
        this.contextItems = [];

        // Dispatch event to VS Code extension with empty context
        this.dispatchMessageToExtension(content, []);
    }

    private parseSlashCommand(text: string): SlashCommand | null {
        const trimmed = text.trim();
        if (trimmed.startsWith('/')) {
            const parts = trimmed.slice(1).split(/\s+/);
            const command = parts[0].toLowerCase();
            const args = parts.slice(1).join(' ');
            return { command, args: args || undefined };
        }
        return null;
    }

    private requestEditorSelection(): void {
        // @ts-ignore
        const vscode = window.vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'editor.getSelection'
            });
        }
    }

    public setEditorSelection(selection: EditorSelection | null): void {
        if (!this.waitingForSelection || !this.pendingSlashCommand) {
            return;
        }

        this.waitingForSelection = false;

        const command = this.pendingSlashCommand;
        this.pendingSlashCommand = null;

        if (selection && selection.text) {
            const textLength = selection.text.length;
            const maxChars = 50000;

            if (textLength > maxChars) {
                this.showLargeFileDialog(selection, command, textLength, maxChars);
                return;
            }

            const prompt = this.buildSlashCommandPrompt(command, selection);
            this.sendSlashCommandWithoutContext(prompt);
        } else {
            this.sendSlashCommandWithoutContext(`/${command.command} ${command.args || ''}`.trim());
        }
    }

    private showLargeFileDialog(selection: EditorSelection, command: SlashCommand, textLength: number, maxChars: number): void {
        this.rangeDialogFileInfo = {
            path: selection.filePath || 'Unknown file',
            totalLines: selection.endLine || 0
        };
        this.pendingRangeCommand = command;
        this.rangeStart = String(selection.startLine || 1);
        this.rangeEnd = String(selection.endLine || '');
        this.showRangeDialog = true;

        this.addMessage('system', `⚠️ The selected text is too large (${textLength} chars). ${command.command} command requires a smaller selection. Please specify a line range.`);
    }

    private closeRangeDialog() {
        this.showRangeDialog = false;
        this.rangeDialogFileInfo = null;
        this.rangeStart = '';
        this.rangeEnd = '';
        this.pendingRangeCommand = null;
    }

    private handleRangeApply(e: CustomEvent) {
        const { startLine, endLine } = e.detail;
        const command = this.pendingRangeCommand;
        this.closeRangeDialog();

        const prompt = this.buildSlashCommandPrompt(command!, {
            text: `[Lines ${startLine}-${endLine}]`,
            filePath: this.rangeDialogFileInfo?.path,
            startLine,
            endLine
        });
        this.sendSlashCommandWithoutContext(prompt);
    }

    private submitRangeDialog() {
        const startLine = parseInt(this.rangeStart, 10);
        const endLine = parseInt(this.rangeEnd, 10);

        if (isNaN(startLine) || isNaN(endLine) || startLine > endLine) {
            this.addMessage('system', '❌ Invalid line range. Please enter valid start and end line numbers.');
            return;
        }

        const command = this.pendingRangeCommand;
        this.closeRangeDialog();

        const prompt = this.buildSlashCommandPrompt(command!, {
            text: `[Lines ${startLine}-${endLine}]`,
            filePath: this.rangeDialogFileInfo?.path,
            startLine,
            endLine
        });
        this.sendSlashCommandWithoutContext(prompt);
    }

    private buildSlashCommandPrompt(command: SlashCommand, selection: EditorSelection): string {
        const codeContext = selection.text;
        
        switch (command.command) {
            case 'explain':
                return `Explica el siguiente código:\n\n\`\`\`\n${codeContext}\n\`\`\``;
            
            case 'fix':
                return `Encuentra y corrige los errores en el siguiente código:\n\n\`\`\`\n${codeContext}\n\`\`\``;
            
            case 'test':
                return `Genera tests unitarios para el siguiente código:\n\n\`\`\`\n${codeContext}\n\`\`\``;
            
            default:
                return `/${command.command} ${command.args || ''}`.trim();
        }
    }

    private addMessage(role: 'user' | 'assistant', content: string, context?: ContextItem[]) {
        const parsed = parseMessageForActions(content);
        
        // For assistant messages, use the last user command type if available
        let messageType = detectMessageType(content);
        if (role === 'assistant' && this.lastUserCommandType) {
            messageType = this.lastUserCommandType;
            // Clear after using
            this.lastUserCommandType = null;
        }
        
        this.messages = [
            ...this.messages,
            {
                id: Date.now().toString(),
                role,
                content,
                timestamp: Date.now(),
                context: context,
                type: messageType,
                hasCode: parsed.hasCode,
                hasDiff: parsed.hasDiff
            }
        ];
        this.requestUpdate();
        
        // Scroll to bottom
        setTimeout(() => {
            const container = this.shadowRoot?.querySelector('.chat-container');
            if (container) container.scrollTop = container.scrollHeight;
        }, 0);
    }

    private clearChat() {
        this.messages = [];
        this.isThinking = false;
        this.contextItems = [];
    }

    // Context management methods
    public addContextItem(item: ContextItem) {
        // Prevent duplicates
        const exists = this.contextItems.some(i => i.id === item.id || (i.path === item.path && i.lineStart === item.lineStart));
        if (!exists) {
            this.contextItems = [...this.contextItems, item];
            console.log('[ChatView] Context item added:', item);
        }
    }

    public addContextPaths(paths: string[]) {
        paths.forEach(filePath => {
            const isFolder = filePath.endsWith('/') || filePath.endsWith('\\');
            // Extract filename from path (handle both / and \)
            const pathParts = filePath.split(/[\/\\]/);
            const name = pathParts[pathParts.length - 1] || filePath;
            this.addContextItem({
                id: `${filePath}-${Date.now()}`,
                type: isFolder ? 'folder' : 'file',
                path: filePath,
                name: name
            });
        });
    }

    public removeContextItem(id: string) {
        this.contextItems = this.contextItems.filter(item => item.id !== id);
    }

    public clearContext() {
        this.contextItems = [];
    }

    public getContextItems(): ContextItem[] {
        return [...this.contextItems];
    }

    private requestAddFileToContext(filePath: string, name: string) {
        // @ts-ignore
        const vscode = window.vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'context.addFile',
                path: filePath,
                name: name
            });
        }
    }

    // Current file handling
    private addCurrentFileToContext() {
        // Delegate to extension to ensure consistent path handling
        // @ts-ignore
        const vscode = window.vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'context.addCurrentFile'
            });
        }
    }

    private requestFileSelection() {
        // @ts-ignore
        const vscode = window.vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'context.requestFile'
            });
        }
    }

    private toggleFullContext() {
        this.includeFullContext = !this.includeFullContext;
    }

    private handleCommand(e: CustomEvent) {
        this.executeSlashCommand(e.detail.command);
    }

    private handleExplain() {
        this.executeSlashCommand('explain');
    }

    private handleFix() {
        this.executeSlashCommand('fix');
    }

    private handleTest() {
        this.executeSlashCommand('test');
    }

    private executeSlashCommand(command: string) {
        const slashCommand: SlashCommand = { command };
        this.pendingSlashCommand = slashCommand;
        
        // Store command type for the response
        this.lastUserCommandType = command as 'explain' | 'fix' | 'test';
        
        this.waitingForSelection = true;
        this.requestEditorSelection();
    }

    public setCurrentFile(path: string | null, name: string | null) {
        if (path && name) {
            this.currentFile = { path, name };
        } else {
            this.currentFile = null;
        }
    }

    // Communication with Extension
    private dispatchMessageToExtension(text: string, context?: ContextItem[]) {
        console.log('[ChatView] Attempting to send message:', text, 'with context:', context);
        // @ts-ignore
        const vscode = window.vscode;
        if (vscode) {
            console.log('[ChatView] VS Code API acquired, posting message');
            try {
                vscode.postMessage({
                    type: 'chat.send',
                    text: text,
                    context: context,
                    options: {
                        includeFullContext: this.includeFullContext
                    }
                });
                console.log('[ChatView] Message posted successfully');
            } catch (err) {
                console.error('[ChatView] Error posting message:', err);
            }
        } else {
            console.error('[ChatView] VS Code: API NOT available - falling back to mock');
            // Mock response for testing
            setTimeout(() => {
                this.isThinking = false;
                this.addMessage('assistant', `Echo: ${text}`);
            }, 1000);
        }
    }

    // Exposed method to receive messages from extension
    public receiveMessage(text: string) {
        this.isThinking = false;
        this.addMessage('assistant', text);
    }
    
    public handleServerEvent(event: any) {
        console.log('[ChatView] Processing event:', event.type, event);
        
        switch (event.type) {
            case 'chat.response':
            case 'message.complete':
                if (event.text || event.content) {
                    this.isThinking = false;
                    this.addMessage('assistant', event.text || event.content);
                }
                break;
                
            case 'chat.streaming':
            case 'message.chunk':
                // Handle streaming responses
                if (event.text || event.content) {
                    this.updateLastAssistantMessage(event.text || event.content);
                }
                break;
                
            case 'connection.status':
                this.backendConnected = event.connected;
                this.backendReused = event.reused;
                console.log('[ChatView] Connection status:', event.connected, '(reused:', event.reused, ')');
                break;
                
            default:
                console.log('[ChatView] Unknown event type:', event.type);
        }
    }
    
    private updateLastAssistantMessage(content: string) {
        // Stop thinking indicator as soon as we start receiving content
        if (this.isThinking) {
            this.isThinking = false;
        }

        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = content;
            const parsed = parseMessageForActions(content);
            lastMsg.type = detectMessageType(content);
            lastMsg.hasCode = parsed.hasCode;
            lastMsg.hasDiff = parsed.hasDiff;
            this.messages = [...this.messages];
            this.requestUpdate();
        } else {
            this.addMessage('assistant', content);
        }
    }

    private async copyCodeToClipboard(content: string): Promise<void> {
        const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
        const codeToCopy = codeMatch ? codeMatch[1] : content;
        
        try {
            await navigator.clipboard.writeText(codeToCopy);
            this.addMessage('system', '✅ Code copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.addMessage('system', '❌ Failed to copy code');
        }
    }

    private requestApplyDiff(message: ChatMessage): void {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'diff.show',
                content: message.content,
                messageId: message.id
            });
        }
    }

    private showDiffPreview(message: ChatMessage): void {
        const vscode = (window as any).vscode;
        if (vscode) {
            vscode.postMessage({
                type: 'diff.show',
                content: message.content,
                messageId: message.id
            });
        }
    }
}
