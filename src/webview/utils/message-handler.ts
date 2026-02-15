import { ChatView } from './components/chat-view';
import { createDiffManager } from './diff-manager';

let chatView: ChatView | null = null;
let diffManager: any = null;

export interface MessageHandlerConfig {
    onShowDiff?: (content: string) => void;
    onThemeUpdate?: (theme: string) => void;
    onContextAdd?: (paths: string[]) => void;
    onContextAddFile?: (path: string, name: string) => void;
    onContextUpdateCurrentFile?: (path: string, name: string) => void;
    onEditorSelection?: (selection: any) => void;
    onConnectionStatus?: (connected: boolean, reused: boolean) => void;
}

export function createMessageHandler(config: MessageHandlerConfig = {}) {
    function getChatView(): ChatView | null {
        if (!chatView) {
            chatView = document.querySelector('chat-view') as any;
        }
        return chatView;
    }

    function getDiffManager() {
        if (!diffManager) {
            diffManager = createDiffManager();
        }
        return diffManager;
    }

    return function handleMessage(message: any) {
        console.log('[Main] Processing message type:', message?.type);
        
        const chat = getChatView();

        switch (message.type) {
            case 'chat.receive':
                if (chat && typeof chat.receiveMessage === 'function') {
                    chat.receiveMessage(message.text);
                }
                break;

            case 'chat.streaming':
                if (chat && typeof chat.handleServerEvent === 'function') {
                    chat.handleServerEvent({ type: 'chat.streaming', text: message.text });
                }
                break;

            case 'diff.show':
                getDiffManager().show(message.content);
                break;

            case 'diff.close':
                getDiffManager().hide();
                break;

            case 'diff.applyCode':
                const vscode = (window as any).vscode;
                if (vscode) {
                    vscode.postMessage({
                        type: 'diff.applyCode',
                        code: message.code,
                        fileName: message.fileName
                    });
                }
                getDiffManager().hide();
                break;

            case 'insertPaths':
                if (chat && typeof chat.addContextPaths === 'function' && message.payload?.paths) {
                    console.log('[Main] Adding context paths:', message.payload.paths);
                    chat.addContextPaths(message.payload.paths);
                    if (config.onContextAdd) config.onContextAdd(message.payload.paths);
                }
                break;

            case 'pastePath':
                if (chat && typeof chat.addContextItem === 'function' && message.payload?.path) {
                    const filePath = message.payload.path;
                    const isFolder = filePath.endsWith('/') || filePath.endsWith('\\');
                    const name = filePath.split(/[\/\\]/).pop() || filePath;
                    console.log('[Main] Pasting context path:', filePath);
                    chat.addContextItem({
                        id: `${filePath}-${Date.now()}`,
                        type: isFolder ? 'folder' : 'file',
                        path: filePath,
                        name: name
                    });
                    if (config.onContextAddFile) config.onContextAddFile(filePath, name);
                }
                break;

            case 'updateCurrentFile':
                if (chat && typeof chat.setCurrentFile === 'function') {
                    console.log('[Main] Updating current file:', message.path, message.name);
                    chat.setCurrentFile(message.path, message.name);
                    if (config.onContextUpdateCurrentFile) {
                        config.onContextUpdateCurrentFile(message.path, message.name);
                    }
                }
                break;

            case 'theme.update':
                console.log('Theme update received:', message.theme);
                if (message.theme === 'dragonfu') {
                    document.body.classList.add('dragonfu-theme');
                } else {
                    document.body.classList.remove('dragonfu-theme');
                }
                if (config.onThemeUpdate) config.onThemeUpdate(message.theme);
                break;

            case 'editor.selection':
                if (chat && typeof chat.setEditorSelection === 'function') {
                    console.log('[Main] Editor selection received:', message);
                    chat.setEditorSelection(message.selection || null);
                    if (config.onEditorSelection) config.onEditorSelection(message.selection);
                }
                break;

            case 'range.dialog':
                if (chat && typeof (chat as any).showRangeDialog === 'function') {
                    console.log('[Main] Range dialog request:', message);
                }
                break;

            case 'connection.status':
                if (chat && typeof chat.handleServerEvent === 'function') {
                    console.log('[Main] Connection status:', message);
                    chat.handleServerEvent({
                        type: 'connection.status',
                        connected: message.connected,
                        reused: message.reused,
                    });
                    if (config.onConnectionStatus) {
                        config.onConnectionStatus(message.connected, message.reused);
                    }
                }
                break;
        }
    };
}

export function sendReady() {
    const vscode = (window as any).vscode;
    if (vscode) {
        console.log('[Main] Sending ui.ready message');
        try {
            vscode.postMessage({ type: 'ui.ready' });
            console.log('[Main] ui.ready message sent successfully');
        } catch (err) {
            console.error('[Main] Error sending ui.ready:', err);
        }
    } else {
        console.log('[Main] Running in browser mode (no VS Code API)');
    }
}
