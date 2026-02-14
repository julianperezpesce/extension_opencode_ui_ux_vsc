import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeButton());

@customElement('range-dialog')
export class RangeDialog extends LitElement {
    @property({ type: Boolean })
    open = false;

    @property({ type: String })
    filePath = '';

    @property({ type: Number })
    totalLines = 0;

    @state()
    private startLine = '';

    @state()
    private endLine = '';

    static styles = css`
        :host {
            display: block;
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
    `;

    render() {
        if (!this.open) return null;

        return html`
            <div class="range-dialog-overlay" @click="${this.handleCancel}"></div>
            <div class="range-dialog">
                <div class="range-dialog-title">Select Line Range</div>
                <div class="range-dialog-message">
                    The file is too large. Please specify the line range to use for the command.
                    <br><br>
                    File: ${this.filePath}<br>
                    Total lines: ${this.totalLines}
                </div>
                <div class="range-dialog-inputs">
                    <input 
                        type="text" 
                        class="range-dialog-input" 
                        placeholder="Start line" 
                        .value="${this.startLine}"
                        @input="${(e: any) => this.startLine = e.target.value}"
                    />
                    <span>to</span>
                    <input 
                        type="text" 
                        class="range-dialog-input" 
                        placeholder="End line" 
                        .value="${this.endLine}"
                        @input="${(e: any) => this.endLine = e.target.value}"
                    />
                </div>
                <div class="range-dialog-buttons">
                    <vscode-button appearance="secondary" @click="${this.handleCancel}">Cancel</vscode-button>
                    <vscode-button appearance="primary" @click="${this.handleApply}">Apply</vscode-button>
                </div>
            </div>
        `;
    }

    private handleApply() {
        const startLine = parseInt(this.startLine, 10);
        const endLine = parseInt(this.endLine, 10);

        if (isNaN(startLine) || isNaN(endLine) || startLine > endLine) {
            this.dispatchEvent(new CustomEvent('error', {
                detail: { message: 'Invalid line range. Please enter valid start and end line numbers.' },
                bubbles: true,
                composed: true
            }));
            return;
        }

        this.dispatchEvent(new CustomEvent('apply', {
            detail: { startLine, endLine },
            bubbles: true,
            composed: true
        }));

        this.startLine = '';
        this.endLine = '';
    }

    private handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel', {
            bubbles: true,
            composed: true
        }));
        this.startLine = '';
        this.endLine = '';
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'range-dialog': RangeDialog;
    }
}
