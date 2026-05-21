import { DraftNote } from "../components/SmartImportWorkbench";

export interface ParsedTakeoutEntry {
  title: string;
  content: string;
  summary: string;
  categories: string[];
  color: string;
  folder: string;
  keywords: string[];
  createdAt?: number;
  isPinned?: boolean;
  isArchived?: boolean;
}

// Map Google Keep color names to sleek custom tailwind hex values
const KEEP_COLORS: Record<string, string> = {
  DEFAULT: "#6b7280", // Slate-gray
  BLUE: "#3b82f6",   // Blue
  RED: "#ef4444",    // Red
  GRAY: "#4b5563",   // Cool gray
  GREEN: "#10b981",  // Green
  ORANGE: "#f59e0b", // Orange/Amber
  YELLOW: "#eab308", // Yellow
  TEAL: "#14b8a6",   // Teal
  CERULEAN: "#06b6d4", // Cyan
  PINK: "#ec4899",   // Pink
  PURPLE: "#8b5cf6", // Purple
  BROWN: "#b45309",  // Brown
};

/**
 * Checks if a parsed JSON object resembles a Google Takeout / Keep structure.
 */
export function isTakeoutJson(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  
  // Single Keep Note detection
  if (
    "textContent" in data || 
    "listContent" in data || 
    "userEditedTimestampUsec" in data || 
    "createdTimestampUsec" in data
  ) {
    return true;
  }

  // Google Tasks detection
  if (data.kind?.includes("tasks#") || (Array.isArray(data.items) && data.items.some((i: any) => i.kind?.includes("tasks#")))) {
    return true;
  }

  // Deep array check
  if (Array.isArray(data)) {
    return data.some(item => isTakeoutJson(item));
  }

  return false;
}

/**
 * Format timestamp in microseconds to a human-readable date.
 */
function formatMicroseconds(usec: number | undefined): string {
  if (!usec) return "";
  try {
    const date = new Date(usec / 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return "";
  }
}

/**
 * Main parser logic for processing Google Takeout files.
 * Handles Keep notes, Tasks, nested loops, duplicate removal, invalid entries filtering, etc.
 */
export function parseTakeoutJson(data: any, fileName: string): ParsedTakeoutEntry[] {
  const fileBaseName = fileName.replace(/\.[^/.]+$/, "");
  const entries: ParsedTakeoutEntry[] = [];

  // Helper function to extract Google Keep Notes
  function parseKeepItem(item: any): ParsedTakeoutEntry | null {
    if (!item || typeof item !== "object") return null;

    // Check if it has any note-bearing info
    const hasText = typeof item.textContent === "string" && item.textContent.trim().length > 0;
    const hasList = Array.isArray(item.listContent) && item.listContent.length > 0;
    
    if (!hasText && !hasList) {
      return null; // Empty or invalid Keep entry
    }

    const title = (item.title?.trim()) || formatMicroseconds(item.createdTimestampUsec) || fileBaseName || "Untitled Note";
    const labels: string[] = Array.isArray(item.labels) ? item.labels.map((l: any) => l.name).filter(Boolean) : [];
    
    // Construct rich markdown contents
    let markdownParts: string[] = [];

    if (hasText) {
      markdownParts.push(item.textContent.trim());
    }

    if (hasList) {
      markdownParts.push("### Checklist:\n" + item.listContent.map((li: any) => {
        const checkbox = li.isChecked ? "[x]" : "[ ]";
        return `- ${checkbox} ${li.text || ""}`;
      }).join("\n"));
    }

    // Preserve metadata (Creation & Edit dates, Links, Attachments)
    const metaParts: string[] = [];
    if (item.createdTimestampUsec) {
      metaParts.push(`**Created:** ${formatMicroseconds(item.createdTimestampUsec)}`);
    }
    if (item.userEditedTimestampUsec) {
      metaParts.push(`**Last Edited:** ${formatMicroseconds(item.userEditedTimestampUsec)}`);
    }
    if (labels.length > 0) {
      metaParts.push(`**Tags:** ${labels.map(l => `#${l}`).join(", ")}`);
    }

    if (Array.isArray(item.attachments) && item.attachments.length > 0) {
      metaParts.push(`\n**📎 Attachments:**`);
      item.attachments.forEach((att: any) => {
        metaParts.push(`- *${att.filePath || "Attachment"} (${att.mimetype || "unknown-type"})*`);
      });
    }

    if (Array.isArray(item.annotations) && item.annotations.length > 0) {
      metaParts.push(`\n**🔗 Web Links:**`);
      item.annotations.forEach((ann: any) => {
        if (ann.url) {
          metaParts.push(`- [${ann.title || ann.url}](${ann.url}) Source: ${ann.sourceType || "web"}`);
        }
      });
    }

    if (metaParts.length > 0) {
      markdownParts.push(`\n---\n*Google Takeout Metadata:*\n` + metaParts.join("\n"));
    }

    const colorKey = String(item.color || "DEFAULT").toUpperCase();
    const hexColor = KEEP_COLORS[colorKey] || "#6b7280";

    const extractedCategories = [...labels];
    if (extractedCategories.length === 0) {
      extractedCategories.push("Keep Export");
    }

    // Default static fallback summaries & keywords; will be enriched by AI
    const content = markdownParts.join("\n\n");
    const summary = item.textContent ? item.textContent.slice(0, 100).trim() + "..." : "Google Keep checklist import containing tasks.";
    
    return {
      title,
      content,
      summary,
      categories: extractedCategories,
      color: hexColor,
      folder: "Keep Import",
      keywords: ["google-keep", "takeout", ...labels.map(l => l.toLowerCase())],
      createdAt: item.createdTimestampUsec ? item.createdTimestampUsec / 1000 : Date.now(),
      isPinned: !!item.isPinned,
      isArchived: !!item.isArchived,
    };
  }

  // Helper function to extract Tasks from Takeout structures
  function parseTaskItem(item: any, listTitle: string): ParsedTakeoutEntry | null {
    if (!item?.title) return null;

    let content = item.notes?.trim() || "No additional task notes.";
    const meta: string[] = [];
    
    if (item.status) {
      meta.push(`**Status:** ${item.status === "completed" ? "✅ Completed" : "⏳ Pending"}`);
    }
    if (item.due) {
      meta.push(`**Due Date:** ${new Date(item.due).toLocaleDateString()}`);
    }
    if (item.completed) {
      meta.push(`**Completed At:** ${new Date(item.completed).toLocaleString()}`);
    }
    if (item.updated) {
      meta.push(`**Last Updated:** ${new Date(item.updated).toLocaleString()}`);
    }

    content += `\n\n---\n*Task Metadata:*\n` + meta.join("\n");

    return {
      title: item.title,
      content,
      summary: `Google Task from ${listTitle}. Due: ${item.due ? new Date(item.due).toLocaleDateString() : 'N/A'}.`,
      categories: ["Google Tasks", item.status || "needsAction"],
      color: item.status === "completed" ? "#10b981" : "#d97706",
      folder: `Tasks: ${listTitle}`,
      keywords: ["google-tasks", "takeout", listTitle.toLowerCase().replace(/\s+/g, '-')],
      createdAt: item.updated ? new Date(item.updated).getTime() : Date.now()
    };
  }

  // Tree walker to handle nested or legacy Takeout structures recursive parsing
  function scanNode(node: any, depth = 0): void {
    if (!node || depth > 8) return; // safety stop

    // Match Single Google Keep File format
    if (node.textContent !== undefined || node.listContent !== undefined) {
      const parsed = parseKeepItem(node);
      if (parsed) entries.push(parsed);
      return;
    }

    // Match Google Tasks format
    if (node.kind === "tasks#taskList" && Array.isArray(node.items)) {
      const listTitle = node.title || "My Tasks";
      node.items.forEach((task: any) => {
        const parsed = parseTaskItem(task, listTitle);
        if (parsed) entries.push(parsed);
      });
      return;
    }

    // Match bookmarks or contacts lists
    if (Array.isArray(node)) {
      // Loop array items
      node.forEach((item: any) => {
        if (item && typeof item === "object") {
          // If a direct Keep item inside array
          if (item.textContent !== undefined || item.listContent !== undefined || item.createdTimestampUsec !== undefined) {
            const parsed = parseKeepItem(item);
            if (parsed) entries.push(parsed);
          } else if (item.url && item.name) {
            // Bookmark structure
            entries.push({
              title: item.name,
              content: `Bookmark Link: [${item.name}](${item.url})\n\nAdded: ${item.date_added ? new Date(parseInt(item.date_added)/1000).toLocaleString() : 'Date N/A'}\nFolder path: ${item.path || 'Root'}`,
              summary: `Chrome Bookmark: ${item.url}`,
              categories: ["Bookmarks", "Chrome"],
              color: "#3b82f6",
              folder: "Chrome Bookmarks",
              keywords: ["chrome-bookmark", "takeout", "links"],
              createdAt: item.date_added ? parseInt(item.date_added)/1000 : Date.now()
            });
          } else {
            scanNode(item, depth + 1);
          }
        }
      });
    } else if (typeof node === "object") {
      // Traverse object keys
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (value && typeof value === "object") {
          scanNode(value, depth + 1);
        }
      }
    }
  }

  // Execute scanning
  scanNode(data);

  // Validation 1: Filter null and corrupted entries with no content titles
  let validEntries = entries.filter(e => e.title && e.content?.trim().length > 0);

  // Validation 2: Deduplicate entries (Strict comparison based on Title + Content Hash)
  const uniqueTitles = new Map<string, Set<string>>();
  validEntries = validEntries.filter(entry => {
    const titleKey = entry.title.trim().toLowerCase();

    let contentSet = uniqueTitles.get(titleKey);
    if (!contentSet) {
      contentSet = new Set<string>();
      uniqueTitles.set(titleKey, contentSet);
    }

    const contentKey = entry.content.trim().toLowerCase();
    if (contentSet.has(contentKey)) {
      return false; // Remove duplicate
    }
    contentSet.add(contentKey);
    return true;
  });

  return validEntries;
}
