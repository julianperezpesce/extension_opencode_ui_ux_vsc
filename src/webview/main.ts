import './components/chat-view';
import { ChatView } from './components/chat-view';

// Add listener for incoming messages from the extension host
window.addEventListener('message', event => {
    const message = event.data;
    const chatView = document.querySelector('chat-view') as any; // Cast to any to avoid strict type issues for now
    
    switch (message.command) {
        case 'chat.receive':
            if (chatView && typeof chatView.receiveMessage === 'function') {
                chatView.receiveMessage(message.text);
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
const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;
if (vscode) {
    vscode.postMessage({ type: 'ui.ready' });
} else {
    console.log('Running in browser mode (no VS Code API)');
}
