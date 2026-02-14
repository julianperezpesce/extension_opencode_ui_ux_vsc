import './components/chat-message';
import './components/chat-view';
import './components/diff-preview';
import { createMessageHandler, sendReady } from './utils/message-handler';
import { createDiffManager } from './utils/diff-manager';

const messageHandler = createMessageHandler();
const diffManager = createDiffManager();

window.addEventListener('message', event => {
    console.log('[Main] Message received from extension:', event.data);
    messageHandler(event.data);
});

sendReady();
