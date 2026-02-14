import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface ContextItem {
    id: string;
    type: 'file' | 'folder' | 'code';
    path: string;
    name: string;
    lineStart?: number;
    lineEnd?: number;
    content?: string;
}

@customElement('context-bar')
export class ContextBar extends LitElement {
    @property({ type: Array })
    items: ContextItem[] = [];

    @property({ type: Object })
    currentFile: { path: string; name: string } | null = null;

    @property({ type: Boolean })
    includeFullContext = false;

    static styles = css`
        :host {
            display: block;
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
    `;

    render() {
        return html`
            <div class="context-controls">
                ${this.currentFile ? html`
                    <button class="add-file-btn" @click="${this.handleAddCurrentFile}" title="Add current file to context">
                        📄 + ${this.currentFile.name}
                    </button>
                ` : ''}
                <button class="add-file-btn" @click="${this.handleBrowse}" title="Select file to add">
                    📁 Browse...
                </button>
                <button class="toggle-btn ${this.includeFullContext ? 'active' : ''}" @click="${this.handleToggle}" title="Send full file contents">
                    <span class="toggle-icon">${this.includeFullContext ? '●' : '○'}</span>
                    ${this.includeFullContext ? 'Full' : 'None'}
                </button>
            </div>

            ${this.items.length > 0 ? html`
                <div class="context-area">
                    ${this.items.map(item => html`
                        <div class="context-badge ${item.type}" 
                             title="${item.path}${item.lineStart ? `:${item.lineStart}${item.lineEnd ? `-${item.lineEnd}` : ''}` : ''}">
                            ${this.getIcon(item.type)}
                            <span>${item.name}${item.lineStart ? `:${item.lineStart}${item.lineEnd ? `-${item.lineEnd}` : ''}` : ''}</span>
                            <span class="remove-btn" @click="${() => this.handleRemove(item.id)}">×</span>
                        </div>
                    `)}
                </div>
            ` : ''}
        `;
    }

    private getIcon(type: string): string {
        switch (type) {
            case 'file': return '📄';
            case 'folder': return '📁';
            case 'code': return '📜';
            default: return '📄';
        }
    }

    private handleAddCurrentFile() {
        this.dispatchEvent(new CustomEvent('add-current-file', {
            bubbles: true,
            composed: true
        }));
    }

    private handleBrowse() {
        this.dispatchEvent(new CustomEvent('browse-files', {
            bubbles: true,
            composed: true
        }));
    }

    private handleToggle() {
        this.dispatchEvent(new CustomEvent('toggle-full-context', {
            bubbles: true,
            composed: true
        }));
    }

    private handleRemove(id: string) {
        this.dispatchEvent(new CustomEvent('remove-item', {
            detail: { id },
            bubbles: true,
            composed: true
        }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'context-bar': ContextBar;
    }
}
