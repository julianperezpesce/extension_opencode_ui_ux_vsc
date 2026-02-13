import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea, vsCodeTag, vsCodeBadge } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea(), vsCodeTag(), vsCodeBadge());

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    context?: ContextItem[];
}

interface ContextItem {
    id: string;
    type: 'file' | 'folder' | 'code';
    path: string;
    name: string;
    lineStart?: number;
    lineEnd?: number;
    content?: string;
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

        /* DragonFu specific overrides come from :host-context or global styles */
        :host-context(.dragonfu-theme) .message.assistant {
            border-left: 3px solid var(--dragonfu-neon-cyan);
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.1);
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
                    <div class="message ${msg.role}">
                        <div class="content">${msg.content}</div>
                    </div>
                `)}
                ${this.isThinking ? html`
                    <div class="message assistant thinking">
                        <vscode-tag>Thinking...</vscode-tag>
                    </div>
                ` : ''}
            </div>

            <div class="input-area">
                <div class="context-controls">
                    ${this.currentFile ? html`
                        <button class="add-file-btn" @click="${this.addCurrentFileToContext}" title="Add current file to context">
                            📄 + ${this.currentFile.name}
                        </button>
                    ` : ''}
                    <button class="add-file-btn" @click="${this.requestFileSelection}" title="Select file to add">
                        📁 Browse...
                    </button>
                    <button class="toggle-btn ${this.includeFullContext ? 'active' : ''}" @click="${this.toggleFullContext}" title="Send full file contents">
                        <span class="toggle-icon">${this.includeFullContext ? '●' : '○'}</span>
                        ${this.includeFullContext ? 'Full' : 'None'}
                    </button>
                </div>

                ${this.contextItems.length > 0 ? html`
                    <div class="context-area">
                        ${this.contextItems.map(item => html`
                            <div class="context-badge ${item.type}" title="${item.path}${item.lineStart ? `:${item.lineStart}${item.lineEnd ? `-${item.lineEnd}` : ''}` : ''}">
                                ${item.type === 'file' ? '📄' : item.type === 'folder' ? '📁' : '📜'}
                                <span>${item.name}${item.lineStart ? `:${item.lineStart}${item.lineEnd ? `-${item.lineEnd}` : ''}` : ''}</span>
                                <span class="remove-btn" @click="${() => this.removeContextItem(item.id)}">×</span>
                            </div>
                        `)}
                    </div>
                ` : ''}

                <div class="drop-zone" @dragover="${this.handleDragOver}" @drop="${this.handleDrop}" @dragleave="${this.handleDragLeave}">
                    Drop files here or type your message
                </div>

                <vscode-text-area
                    placeholder="Ask OpenCode (Try /help, @filename, or drag files)..."
                    resize="vertical"
                    rows="3"
                    .value="${this.inputValue}"
                    @input="${this.handleInput}"
                    @keydown="${this.handleKeydown}"
                ></vscode-text-area>

                <div class="actions">
                    <vscode-button appearance="secondary" @click="${this.clearChat}">
                        Clear
                    </vscode-button>
                    <vscode-button appearance="primary" @click="${this.sendMessage}">
                        Send ${this.contextItems.length > 0 ? html`(${this.contextItems.length})` : ''}
                    </vscode-button>
                </div>
            </div>
        `;
    }

    private handleInput(e: any) {
        this.inputValue = e.target.value;
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
        
        // Add message with context
        this.addMessage('user', content, this.contextItems);
        this.inputValue = '';
        this.isThinking = true;

        // Get current context and clear it for next message
        const currentContext = [...this.contextItems];
        this.contextItems = [];

        // Dispatch event to VS Code extension
        this.dispatchMessageToExtension(content, currentContext);
    }

    private addMessage(role: 'user' | 'assistant', content: string, context?: ContextItem[]) {
        this.messages = [
            ...this.messages,
            {
                id: Date.now().toString(),
                role,
                content,
                timestamp: Date.now(),
                context: context
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

    // Drag and drop handlers
    private handleDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
        const dropZone = this.shadowRoot?.querySelector('.drop-zone');
        dropZone?.classList.add('drag-over');
    }

    private handleDragLeave(e: DragEvent) {
        e.preventDefault();
        const dropZone = this.shadowRoot?.querySelector('.drop-zone');
        dropZone?.classList.remove('drag-over');
    }

    private handleDrop(e: DragEvent) {
        e.preventDefault();
        const dropZone = this.shadowRoot?.querySelector('.drop-zone');
        dropZone?.classList.remove('drag-over');

        // First check for files from file system
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                const filePath = (file as any).path || file.name;
                const name = file.name;

                // Request the extension to resolve this file path properly
                this.requestAddFileToContext(filePath, name);
            });
        }
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
            this.messages = [...this.messages];
            this.requestUpdate();
        } else {
            this.addMessage('assistant', content);
        }
    }
}
