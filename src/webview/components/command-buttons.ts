import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('command-buttons')
export class CommandButtons extends LitElement {
    static styles = css`
        :host {
            display: block;
        }

        .context-controls {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
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
    `;

    render() {
        return html`
            <div class="context-controls">
                <button class="command-btn explain" @click="${this.handleExplain}" title="Explain selected code">
                    💡 Explain
                </button>
                <button class="command-btn fix" @click="${this.handleFix}" title="Fix errors in selected code">
                    🔧 Fix
                </button>
                <button class="command-btn test" @click="${this.handleTest}" title="Generate tests for selected code">
                    🧪 Test
                </button>
            </div>
        `;
    }

    private handleExplain() {
        this.dispatchEvent(new CustomEvent('command', {
            detail: { command: 'explain' },
            bubbles: true,
            composed: true
        }));
    }

    private handleFix() {
        this.dispatchEvent(new CustomEvent('command', {
            detail: { command: 'fix' },
            bubbles: true,
            composed: true
        }));
    }

    private handleTest() {
        this.dispatchEvent(new CustomEvent('command', {
            detail: { command: 'test' },
            bubbles: true,
            composed: true
        }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'command-buttons': CommandButtons;
    }
}
