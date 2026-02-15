import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit';
import { extractCodeFromMessage } from '../utils/markdown-renderer';

provideVSCodeDesignSystem().register(vsCodeButton());

interface DiffLine {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    lineNumber?: number;
}

@customElement('diff-preview')
export class DiffPreview extends LitElement {
    @property({ type: String })
    originalCode = '';

    @property({ type: String })
    fixedCode = '';

    @property({ type: String })
    fileName = 'preview.ts';

    @property({ type: String })
    filePath = '';

    @state()
    private viewMode: 'split' | 'unified' = 'unified';

    static styles = css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
            font-size: var(--vscode-font-size);
        }

        .diff-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .diff-actions-left {
            display: flex;
            gap: 0.5rem;
        }

        .back-btn {
            padding: 0.4rem 0.75rem;
            font-size: 0.8rem;
            border: 1px solid var(--vscode-activityBar-activeBorder);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-weight: 500;
        }

        .back-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .diff-title {
            font-weight: 600;
            font-size: 0.9rem;
        }

        .diff-actions {
            display: flex;
            gap: 0.5rem;
        }

        .view-toggle {
            display: flex;
            gap: 0.25rem;
        }

        .view-toggle button {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            border-radius: 3px;
        }

        .view-toggle button.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .view-toggle button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .diff-container {
            display: flex;
            height: calc(100% - 50px);
            overflow: hidden;
        }

        .diff-split {
            display: flex;
            width: 100%;
            height: 100%;
        }

        .diff-pane {
            flex: 1;
            overflow: auto;
            padding: 0;
        }

        .diff-pane-header {
            padding: 0.5rem 1rem;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-size: 0.8rem;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .diff-pane-header.before {
            color: var(--vscode-charts-red);
        }

        .diff-pane-header.after {
            color: var(--vscode-charts-green);
        }

        .diff-lines {
            padding: 0;
            margin: 0;
            list-style: none;
        }

        .diff-line {
            display: flex;
            padding: 0 1rem;
            min-height: 1.5rem;
            line-height: 1.5rem;
            font-size: 0.9rem;
        }

        .diff-line.added {
            background-color: rgba(0, 255, 136, 0.1);
        }

        .diff-line.removed {
            background-color: rgba(255, 0, 85, 0.1);
        }

        .line-number {
            min-width: 40px;
            color: var(--vscode-editorLineNumber-foreground);
            text-align: right;
            padding-right: 1rem;
            user-select: none;
            opacity: 0.7;
        }

        .line-content {
            flex: 1;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .line-prefix {
            min-width: 20px;
            font-weight: bold;
        }

        .added .line-prefix {
            color: var(--vscode-charts-green);
        }

        .removed .line-prefix {
            color: var(--vscode-charts-red);
        }

        .buttons-bar {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border-top: 1px solid var(--vscode-widget-border);
            background-color: var(--vscode-editor-background);
        }

        .apply-btn {
            background-color: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-charts-green);
            color: var(--vscode-charts-green);
            padding: 0.4rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 0.3rem;
            transition: background-color 0.2s;
        }

        .apply-btn:hover {
            background-color: rgba(0, 255, 136, 0.15);
        }

        .discard-btn {
            background-color: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-secondaryForeground);
            padding: 0.4rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: background-color 0.2s;
        }

        .discard-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    `;

    render() {
        const originalLines = this.originalCode.split('\n');
        const fixedLines = this.fixedCode.split('\n');

        return html`
            <div class="diff-header">
                <div class="diff-actions-left">
                    <button class="back-btn" @click="${this.handleBack}">
                        ← Volver
                    </button>
                </div>
                <div class="diff-title">📄 ${this.fileName} - Preview de cambios</div>
                <div class="diff-actions">
                    <div class="view-toggle">
                        <button 
                            class="${this.viewMode === 'unified' ? 'active' : ''}"
                            @click="${() => this.viewMode = 'unified'}"
                        >Unified</button>
                        <button 
                            class="${this.viewMode === 'split' ? 'active' : ''}"
                            @click="${() => this.viewMode = 'split'}"
                        >Split</button>
                    </div>
                </div>
            </div>

            <div class="diff-container">
                ${this.viewMode === 'split' 
                    ? this.renderSplitView(originalLines, fixedLines)
                    : this.renderUnifiedView(originalLines, fixedLines)
                }
            </div>

            <div class="buttons-bar">
                <button class="discard-btn" @click="${this.handleDiscard}">
                    ❌ Descartar
                </button>
                <button class="apply-btn" @click="${this.handleApply}">
                    ✅ Aplicar cambios
                </button>
            </div>
        `;
    }

    private renderSplitView(originalLines: string[], fixedLines: string[]) {
        return html`
            <div class="diff-split">
                <div class="diff-pane">
                    <div class="diff-pane-header before">❌ Antes</div>
                    <ul class="diff-lines">
                        ${originalLines.map((line, i) => html`
                            <li class="diff-line ${line.startsWith('-') ? 'removed' : ''}">
                                <span class="line-number">${i + 1}</span>
                                <span class="line-prefix">${line.startsWith('-') ? '-' : ' '}</span>
                                <span class="line-content">${line.replace(/^[+-]\s?/, '')}</span>
                            </li>
                        `)}
                    </ul>
                </div>
                <div class="diff-pane">
                    <div class="diff-pane-header after">✅ Después</div>
                    <ul class="diff-lines">
                        ${fixedLines.map((line, i) => html`
                            <li class="diff-line ${line.startsWith('+') ? 'added' : ''}">
                                <span class="line-number">${i + 1}</span>
                                <span class="line-prefix">${line.startsWith('+') ? '+' : ' '}</span>
                                <span class="line-content">${line.replace(/^[+-]\s?/, '')}</span>
                            </li>
                        `)}
                    </ul>
                </div>
            </div>
        `;
    }

    private renderUnifiedView(originalLines: string[], fixedLines: string[]) {
        const allLines: DiffLine[] = [];
        
        originalLines.forEach((line, i) => {
            allLines.push({
                type: line.startsWith('-') ? 'removed' : 'unchanged',
                content: line.replace(/^[+-]\s?/, ''),
                lineNumber: i + 1
            });
        });

        fixedLines.forEach((line, i) => {
            if (line.startsWith('+')) {
                allLines.push({
                    type: 'added',
                    content: line.replace(/^[+-]\s?/, ''),
                    lineNumber: originalLines.length + i + 1
                });
            }
        });

        return html`
            <div class="diff-pane" style="width: 100%;">
                <ul class="diff-lines">
                    ${allLines.map(line => html`
                        <li class="diff-line ${line.type}">
                            <span class="line-number">${line.lineNumber || ''}</span>
                            <span class="line-prefix">${line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                            <span class="line-content">${line.content}</span>
                        </li>
                    `)}
                </ul>
            </div>
        `;
    }

    private handleApply() {
        console.log('[DiffPreview] Apply clicked - filePath:', this.filePath, 'fileName:', this.fileName);
        // Dispatch event for main.ts to handle
        window.dispatchEvent(new CustomEvent('message', {
            detail: { type: 'diff.applyCode', code: this.fixedCode, fileName: this.fileName, filePath: this.filePath }
        }));
        this.close();
    }

    private handleBack() {
        this.close();
    }

    private handleDiscard() {
        this.close();
    }

    private close() {
        // Directly hide diff preview and show chat view (no need to go through extension)
        if (this.style.display !== 'none') {
            this.style.display = 'none';
        }
        
        // Show chat view
        const chatView = document.querySelector('chat-view') as any;
        if (chatView && chatView.style) {
            chatView.style.display = 'flex';
        }
    }

    public setDiff(original: string, fixed: string, fileName: string, filePath: string = '') {
        this.originalCode = original;
        this.fixedCode = fixed;
        this.fileName = fileName;
        this.filePath = filePath;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'diff-preview': DiffPreview;
    }
}
