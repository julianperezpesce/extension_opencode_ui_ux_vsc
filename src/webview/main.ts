import './components/chat-view';
import { ChatView } from './components/chat-view';

// Add listener for incoming messages from the extension host
window.addEventListener('message', event => {
    console.log('[Main] Message received from extension:', event.data);
    const message = event.data;
    const chatView = document.querySelector('chat-view') as any; // Cast to any to avoid strict type issues for now

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

        // Context management messages
        case 'insertPaths':
            if (chatView && typeof chatView.addContextPaths === 'function' && message.payload?.paths) {
                console.log('[Main] Adding context paths:', message.payload.paths);
                chatView.addContextPaths(message.payload.paths);
            }
            break;

        case 'pastePath':
            if (chatView && typeof chatView.addContextItem === 'function' && message.payload?.path) {
                console.log('[Main] Pasting context path:', message.payload.path);
                chatView.addContextItem({
                    id: `${message.payload.path}-${Date.now()}`,
                    type: 'folder',
                    path: message.payload.path,
                    name: message.payload.path.split('/').pop() || message.payload.path
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
