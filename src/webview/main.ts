import './components/chat-message';
import './components/chat-view';
import './components/diff-preview';
import { ChatView } from './components/chat-view';

let diffPreview: any = null;

// Add listener for incoming messages from the extension host
window.addEventListener('message', event => {
    console.log('[Main] Message received from extension:', event.data);
    const message = event.data;
    const chatView = document.querySelector('chat-view') as any;

    console.log('[Main] Processing message type:', message?.type);
    switch (message.type) {
        case 'chat.receive':
            if (chatView && typeof chatView.receiveMessage === 'function') {
                chatView.receiveMessage(message.text);
            }
            break;

        case 'chat.streaming':
            if (chatView && typeof chatView.handleServerEvent === 'function') {
                chatView.handleServerEvent({ type: 'chat.streaming', text: message.text });
            }
            break;

        // Diff preview handling
        case 'diff.show':
            // content has the assistant's response with code
            showDiffPreview(message.content);
            break;

        case 'diff.close':
            hideDiffPreview();
            break;

        case 'diff.applyCode':
            // Send to extension to apply the code
            const vscode = (window as any).vscode;
            if (vscode) {
                vscode.postMessage({
                    type: 'diff.applyCode',
                    code: message.code,
                    fileName: message.fileName
                });
            }
            hideDiffPreview();
            break;

        // Context management messages
        case 'insertPaths':
            if (chatView && typeof chatView.addContextPaths === 'function' && message.payload?.paths) {
                console.log('[Main] Adding context paths:', message.payload.paths);
                chatView.addContextPaths(message.payload.paths);
            }
            break;

        case 'pastePath':
            if (chatView && typeof chatView.addContextItem === 'function' && message.payload?.path) {
                const filePath = message.payload.path;
                const isFolder = filePath.endsWith('/') || filePath.endsWith('\\');
                const name = filePath.split(/[\/\\]/).pop() || filePath;
                console.log('[Main] Pasting context path:', filePath);
                chatView.addContextItem({
                    id: `${filePath}-${Date.now()}`,
                    type: isFolder ? 'folder' : 'file',
                    path: filePath,
                    name: name
                });
            }
            break;

        case 'updateCurrentFile':
            if (chatView && typeof chatView.setCurrentFile === 'function') {
                console.log('[Main] Updating current file:', message.path, message.name);
                chatView.setCurrentFile(message.path, message.name);
            }
            break;

        case 'theme.update':
            console.log('Theme update received:', message.theme);
            if (message.theme === 'dragonfu') {
                document.body.classList.add('dragonfu-theme');
            } else {
                document.body.classList.remove('dragonfu-theme');
            }
            break;

        case 'editor.selection':
            if (chatView && typeof chatView.setEditorSelection === 'function') {
                console.log('[Main] Editor selection received:', message);
                chatView.setEditorSelection(message.selection || null);
            }
            break;

        case 'range.dialog':
            if (chatView && typeof chatView.showRangeDialog === 'function') {
                console.log('[Main] Range dialog request:', message);
            }
            break;

        case 'connection.status':
            if (chatView && typeof chatView.handleServerEvent === 'function') {
                console.log('[Main] Connection status:', message);
                chatView.handleServerEvent({
                    type: 'connection.status',
                    connected: message.connected,
                    reused: message.reused,
                });
            }
            break;
    }
});

// Signal that UI is ready
// @ts-ignore
const vscode = window.vscode;
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

function showDiffPreview(content: string) {
    // Extract code from the content
    const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1] : content;
    
    // Create diff preview element if it doesn't exist
    if (!diffPreview) {
        diffPreview = document.createElement('diff-preview');
    }
    
    // Show the code as "fixed" (we don't have the original in this context)
    diffPreview.setDiff(code, code, 'preview.ts');
    
    // Add to document if not already there
    if (!document.body.contains(diffPreview)) {
        document.body.appendChild(diffPreview);
    }
    
    // Show the diff preview
    diffPreview.style.display = 'block';
    
    // Hide chat view
    const chatView = document.querySelector('chat-view');
    if (chatView) {
        (chatView as HTMLElement).style.display = 'none';
    }
}

function hideDiffPreview() {
    if (diffPreview) {
        diffPreview.style.display = 'none';
    }
    
    // Show chat view again
    const chatView = document.querySelector('chat-view');
    if (chatView) {
        (chatView as HTMLElement).style.display = 'flex';
    }
}
