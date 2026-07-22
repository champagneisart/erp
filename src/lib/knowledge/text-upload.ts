const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const MAX_TEXT_BYTES = 512_000; // ~500 KB — genoeg voor lange richtlijnen

export function isTextKnowledgeFile(fileName: string, mimeType?: string | null): boolean {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (!mimeType) return false;
  return mimeType.startsWith("text/") || mimeType === "application/markdown";
}

export function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function readTextFromBuffer(bytes: Buffer, maxBytes = MAX_TEXT_BYTES): string {
  if (bytes.length > maxBytes) {
    throw new Error("Tekstbestand is te groot (max. 500 KB)");
  }
  const text = bytes.toString("utf-8").trim();
  if (!text) throw new Error("Bestand bevat geen tekst");
  return text;
}

export async function readUploadText(file: File): Promise<string> {
  if (file.size > MAX_TEXT_BYTES) {
    throw new Error("Tekstbestand is te groot (max. 500 KB)");
  }
  const text = await file.text();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Bestand bevat geen tekst");
  return trimmed;
}

/** Beperk tokens bij injectie in prompts — ruwe markdown mag groter zijn in DB. */
export function truncateForPrompt(text: string, maxChars = 6000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[… ingekort voor AI-context]`;
}
