import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';

// Handle CJS/ESM interop for pdf-parse
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

// Stage 1: Fast Heuristic Document Splitting
// Replaces the slow and token-heavy Gemini parsing for structure extraction

export interface ParsedNote {
  title: string;
  content: string;
  originalIndex: number;
}

export async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType.includes("officedocument.wordprocessingml") || mimeType.includes("docx")) {
    return await parseDocxBuffer(buffer);
  }
  
  if (mimeType.includes("pdf")) {
      const data = await pdfParse(buffer);
      return data.text || "";
  }
  
  return buffer.toString("utf-8");
}

export function splitDocumentIntoNotes(text: string): ParsedNote[] {
  // Very robust determinist logic for splitting
  const content = text.replace(/\r\n/g, '\n');
  
  // 1. Try to split by markdown headers (### or #)
  const headerSplit = content.split(/(?=^#{1,4}\s+)/m);
  if (headerSplit.length > 2) {
      return processSegments(headerSplit);
  }
  
  // 2. Try to split by markdown horizontal rules (--- or ***)
  const hrSplit = content.split(/^[-*_]{3,}\s*$/m);
  if (hrSplit.length > 2) {
      return processSegments(hrSplit);
  }
  
  // 3. Try to split by date-like headers (Jan 1, 2023 or 2023-01-01)
  const dateSplit = content.split(/(?=^\d{4}-\d{2}-\d{2}\b|^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/m);
  if (dateSplit.length > 2) {
      return processSegments(dateSplit);
  }
  
  // 4. Try to split by large paragraph gaps (3 or more newlines)
  const gapSplit = content.split(/\n{3,}/);
  if (gapSplit.length > 2) {
      return processSegments(gapSplit);
  }
  
  // Fallback: whole document is one note (or chunk it if strictly needed, but let's just make it one)
  return processSegments([content]);
}

function processSegments(segments: string[]): ParsedNote[] {
  let notes: ParsedNote[] = [];
  let index = 0;
  
  for (const seg of segments) {
    let cleanText = seg.trim();
    if (!cleanText || cleanText.length < 10) continue; // Skip noise
    
    let title = "";
    const lines = cleanText.split('\n');
    const firstLine = lines[0].trim();
    
    // Extract title from headers
    if (firstLine.startsWith('#')) {
       title = firstLine.replace(/^#+\s*/, '');
       // Remove header from content to avoid duplication if desired, or keep it. Let's keep it but trim.
    } else {
       // Just take the first few words
       const words = firstLine.split(' ');
       title = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
    }
    
    title = title.replace(/[*_]/g, ''); // Remove some markdown from title
    
    notes.push({
      title: title.slice(0, 60),
      content: cleanText,
      originalIndex: index++
    });
  }
  
  return notes;
}
