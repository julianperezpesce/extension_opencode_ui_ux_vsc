export interface MessagePart {
  type: "text" | "code" | "diff";
  content: string;
  language?: string;
}

export interface ParsedMessage {
  parts: MessagePart[];
  hasCode: boolean;
  hasDiff: boolean;
}

export function parseMessageForActions(text: string): ParsedMessage {
  const parts: MessagePart[] = [];
  let hasCode = false;
  let hasDiff = false;
  
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    
    const language = match[1] || "plaintext";
    const code = match[2];
    
    hasCode = true;
    
    if (code.includes("+") || code.includes("-") || code.startsWith("- ") || code.startsWith("+ ")) {
      hasDiff = true;
      parts.push({ type: "diff", content: code, language });
    } else {
      parts.push({ type: "code", content: code, language });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }
  
  if (parts.length === 0) {
    parts.push({ type: "text", content: text });
  }
  
  return { parts, hasCode, hasDiff };
}

export function extractCodeFromMessage(text: string): string {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const codes: string[] = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codes.push(match[1]);
  }
  
  return codes.join("\n\n");
}

export function detectMessageType(text: string): "explain" | "fix" | "test" | "general" {
  const lower = text.toLowerCase();
  
  if (lower.includes("explica") || lower.includes("explain")) {
    return "explain";
  }
  if (lower.includes("corrige") || lower.includes("fix") || lower.includes("error")) {
    return "fix";
  }
  if (lower.includes("test") || lower.includes("prueba")) {
    return "test";
  }
  
  return "general";
}

export function getEmojiForType(type: string): string {
  switch (type) {
    case "explain":
      return "💡";
    case "fix":
      return "🔧";
    case "test":
      return "🧪";
    default:
      return "🤖";
  }
}
