import { marked } from "marked";
import { highlightCode, processCodeBlocks } from "./code-highlighter";
import { parseMessageForActions, extractCodeFromMessage, detectMessageType, getEmojiForType } from "./message-parser";

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

export function renderMarkdown(text: string): string {
  if (!text) return "";
  
  const escaped = escapeHtml(text);
  const html = marked.parse(escaped) as string;
  const withCode = processCodeBlocks(html);
  
  return withCode;
}

export { parseMessageForActions, extractCodeFromMessage, detectMessageType, getEmojiForType };
