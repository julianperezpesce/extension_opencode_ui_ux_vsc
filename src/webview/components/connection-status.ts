import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('connection-status')
export class ConnectionStatus extends LitElement {
    @property({ type: Boolean })
    connected = false;

    @property({ type: Boolean })
    reused = false;

    static styles = css`
        :host {
            display: block;
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
    `;

    render() {
        const statusText = this.connected 
            ? (this.reused ? 'Existing' : 'New')
            : 'Connecting';
        
        const tooltipText = this.connected
            ? (this.reused ? 'Connected to existing backend' : 'Backend running')
            : 'Connecting...';

        return html`
            <div class="connection-status">
                <span class="connection-dot ${this.connected ? 'connected' : ''}" 
                      title="${tooltipText}">
                </span>
                <span class="connection-text">${statusText}</span>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'connection-status': ConnectionStatus;
    }
}
