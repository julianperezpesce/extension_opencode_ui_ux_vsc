export interface DiffManager {
    show(content: string, filePath?: string | null, fileName?: string): void;
    hide(): void;
    isVisible(): boolean;
}

let diffPreview: any = null;
let chatView: any = null;
let currentFilePath: string | null = null;

export function createDiffManager(): DiffManager {
    function getDiffPreview() {
        if (!diffPreview) {
            diffPreview = document.createElement('diff-preview');
        }
        return diffPreview;
    }

    function getChatView() {
        if (!chatView) {
            chatView = document.querySelector('chat-view');
        }
        return chatView;
    }

    return {
        show(content: string, filePath?: string | null, fileName?: string) {
            const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
            const code = codeMatch ? codeMatch[1] : content;
            
            currentFilePath = filePath || null;
            
            const preview = getDiffPreview();
            preview.setDiff(code, code, fileName || 'preview.ts', filePath || '');
            
            if (!document.body.contains(preview)) {
                document.body.appendChild(preview);
            }
            
            preview.style.display = 'block';
            
            const chat = getChatView();
            if (chat) {
                (chat as HTMLElement).style.display = 'none';
            }
        },
        
        hide() {
            const preview = getDiffPreview();
            if (preview) {
                preview.style.display = 'none';
            }
            
            const chat = getChatView();
            if (chat) {
                (chat as HTMLElement).style.display = 'flex';
            }
        },
        
        isVisible() {
            return diffPreview !== null && diffPreview.style.display !== 'none';
        }
    };
}
