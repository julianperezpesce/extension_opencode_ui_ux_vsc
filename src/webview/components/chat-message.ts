import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { renderMarkdown } from '../utils/markdown-renderer';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    context?: ContextItem[];
    type?: 'explain' | 'fix' | 'test' | 'general';
    hasCode?: boolean;
    hasDiff?: boolean;
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

@customElement('chat-message')
export class ChatMessageElement extends LitElement {
    @property({ type: Object })
    message!: ChatMessage;

    @property({ type: Boolean })
    showActions = false;

    @property({ type: String, attribute: 'role' })
    role: string = 'assistant';

    static styles = css`
        :host {
            display: block;
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

        .message.system {
            align-self: center;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px dashed var(--vscode-widget-border);
            font-size: 0.9em;
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

        :host-context(.dragonfu-theme) .message.assistant {
            border-left: 3px solid var(--dragonfu-neon-cyan);
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.1);
        }
    `;

    render() {
        const emoji = this.message.role === 'assistant' ? this.getEmoji() : '';

        return html`
            <div class="message ${this.message.role} ${this.message.type || ''}">
                ${this.message.role === 'assistant' ? html`
                    <div class="message-header">
                        <span class="message-emoji">${emoji}</span>
                    </div>
                ` : ''}
                <div class="content" .innerHTML="${renderMarkdown(this.message.content)}"></div>
                ${this.renderActions()}
            </div>
        `;
    }

    private getEmoji(): string {
        switch (this.message.type) {
            case 'explain': return '💡';
            case 'fix': return '🔧';
            case 'test': return '🧪';
            default: return '🤖';
        }
    }

    private renderActions() {
        if (!this.showActions) return null;

        const isAssistant = this.message.role === 'assistant';
        const hasCode = this.message.hasCode;
        const isExplain = this.message.type === 'explain';
        const isFixOrTest = this.message.type === 'fix' || this.message.type === 'test';

        if (!isAssistant || !hasCode || isExplain) return null;

        return html`
            <div class="message-actions">
                <button class="action-btn" @click="${this.handleCopy}" title="Copy code">
                    📋 Copy
                </button>
                ${isFixOrTest ? html`
                    <button class="action-btn apply" @click="${this.handlePreview}" title="Preview changes">
                        👁️ Preview
                    </button>
                ` : ''}
            </div>
        `;
    }

    private handleCopy() {
        this.dispatchEvent(new CustomEvent('copy-code', {
            detail: { content: this.message.content },
            bubbles: true,
            composed: true
        }));
    }

    private handlePreview() {
        this.dispatchEvent(new CustomEvent('show-preview', {
            detail: { message: this.message },
            bubbles: true,
            composed: true
        }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'chat-message': ChatMessageElement;
    }
}
