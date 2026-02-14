import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea());

@customElement('chat-input')
export class ChatInput extends LitElement {
    @property({ type: String })
    placeholder = "Ask OpenCode...";

    @property({ type: Number })
    contextCount = 0;

    @state()
    private inputValue = '';

    @state()
    private isDragOver = false;

    static styles = css`
        :host {
            display: block;
        }

        .input-area {
            padding: 1rem;
            border-top: 1px solid var(--vscode-widget-border);
            background-color: var(--vscode-editor-background);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
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
            <div class="drop-zone"
                class="${this.isDragOver ? 'drag-over' : ''}"
                @dragover="${this.handleDragOver}"
                @drop="${this.handleDrop}"
                @dragleave="${this.handleDragLeave}">
                Drop files here or type your message
            </div>

            <vscode-text-area
                placeholder="${this.placeholder}"
                resize="vertical"
                rows="3"
                .value="${this.inputValue}"
                @input="${this.handleInput}"
                @keydown="${this.handleKeydown}"
            ></vscode-text-area>

            <div class="actions">
                <vscode-button appearance="secondary" @click="${this.handleClear}">
                    Clear
                </vscode-button>
                <vscode-button appearance="primary" @click="${this.handleSend}">
                    Send ${this.contextCount > 0 ? html`(${this.contextCount})` : ''}
                </vscode-button>
            </div>
        `;
    }

    private handleInput(e: CustomEvent) {
        this.inputValue = (e.target as HTMLTextAreaElement).value;
    }

    private handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSend();
        }
    }

    private handleSend() {
        if (!this.inputValue.trim()) return;

        this.dispatchEvent(new CustomEvent('send-message', {
            detail: { text: this.inputValue },
            bubbles: true,
            composed: true
        }));

        this.inputValue = '';
    }

    private handleClear() {
        this.dispatchEvent(new CustomEvent('clear-chat', {
            bubbles: true,
            composed: true
        }));
    }

    private handleDragOver(e: DragEvent) {
        e.preventDefault();
        this.isDragOver = true;
    }

    private handleDragLeave(e: DragEvent) {
        e.preventDefault();
        this.isDragOver = false;
    }

    private handleDrop(e: DragEvent) {
        e.preventDefault();
        this.isDragOver = false;

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).map(file => ({
                path: (file as any).path || file.name,
                name: file.name
            }));

            this.dispatchEvent(new CustomEvent('files-dropped', {
                detail: { files },
                bubbles: true,
                composed: true
            }));
        }
    }

    public getValue(): string {
        return this.inputValue;
    }

    public clear() {
        this.inputValue = '';
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'chat-input': ChatInput;
    }
}
