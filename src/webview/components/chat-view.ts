import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea, vsCodeTag } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea(), vsCodeTag());

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

@customElement('chat-view')
export class ChatView extends LitElement {
    @state()
    private messages: ChatMessage[] = [];

    @state()
    private inputValue = '';

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
                <vscode-text-area
                    placeholder="Ask OpenCode (Try /help)..."
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
                        Send
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
        if (!this.inputValue.trim()) return;

        const content = this.inputValue;
        this.addMessage('user', content);
        this.inputValue = '';
        this.isThinking = true;

        // Dispatch event to VS Code extension
        this.dispatchMessageToExtension(content);
    }

    private addMessage(role: 'user' | 'assistant', content: string) {
        this.messages = [
            ...this.messages,
            {
                id: Date.now().toString(),
                role,
                content,
                timestamp: Date.now()
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
    }

    // Communication with Extension
    private dispatchMessageToExtension(text: string) {
        // @ts-ignore
        const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;
        if (vscode) {
            vscode.postMessage({
                type: 'chat.send',
                text: text
            });
        } else {
            console.log('Mock send:', text);
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
}
