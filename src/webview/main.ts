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
const vscode = window.vscode || (window.acquireVsCodeApi ? window.acquireVsCodeApi() : null);
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
