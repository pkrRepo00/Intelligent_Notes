import React, { useState, useEffect, useMemo } from "react";
import { User } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ChevronDown, LogOut, Plus, Search, Sparkles, Tag, Trash2, Pin, Upload, FileText, Loader2, Lock, EyeOff, Folder, Undo, ChevronRight, X, Heart, Settings, Activity } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { NoteSearchEngine } from "../lib/SearchEngine";
import { formatDistanceToNow } from "date-fns";

import { Note } from "../types";
import { getNotesToUpdateOnRename } from "../lib/graphEngine";
import { subscribeToNotes, createNote, processNoteWithAI, deleteNote, updateNoteData, importDocumentNotesBase64, importDocumentNotes, extractDocxText, getAIHeaders } from "../lib/api";
import { logout } from "../lib/firebase";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { SmartImportWorkbench, DraftNote } from "./SmartImportWorkbench";
import { isTakeoutJson, parseTakeoutJson } from "../lib/takeoutParser";
import { CommandPalette } from "./CommandPalette";
const KnowledgeGraph = React.lazy(() => import('./KnowledgeGraph').then(module => ({ default: module.KnowledgeGraph })));
const CanvasView = React.lazy(() => import('./CanvasView').then(module => ({ default: module.CanvasView })));
import { PluginManager } from "../lib/PluginManager";
import { WikiMarkdown } from "./WikiMarkdown";
import { BacklinksPanel } from "./BacklinksPanel";
import { NoteDetailModal } from "./NoteDetailModal";
import { NoteCard } from "./NoteCard";
import { AIPipelineTelemetryPanel } from "./AIPipelineTelemetryPanel";
import { AIGateway } from "./AIGateway";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Smart Import States
  const [isDragging, setIsDragging] = useState(false);
  const [importStep, setImportStep] = useState<null | 'uploading' | 'analyzing' | 'separating' | 'organizing' | 'completed'>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatusDetail, setImportStatusDetail] = useState("");
  const [draftImportedNotes, setDraftImportedNotes] = useState<DraftNote[]>([]);
  const [activeImportFileName, setActiveImportFileName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [view, setView] = useState<'notes' | 'graph' | 'canvas'>('notes');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToNotes(
      user.uid,
      (updatedNotes) => setNotes(updatedNotes),
      (error) => console.error("Error fetching notes:", error)
    );
    return () => unsubscribe();
  }, [user.uid]);

  // Keep editingNote in sync with remote database updates
  useEffect(() => {
    if (editingNote) {
      const freshNote = notes.find(n => n.id === editingNote.id);
      if (freshNote) {
        // Only update if there's an actual data change to avoid infinite loops
        if (JSON.stringify(freshNote) !== JSON.stringify(editingNote)) {
          setEditingNote(freshNote);
        }
      } else {
        // If note was deleted remotely, close modal
        setEditingNote(null);
      }
    }
  }, [notes]);

  const [isAiManagerOpen, setIsAiManagerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      await processImportFiles(files);
    }
  };

  const processImportFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setImportError(null);
    setImportStatusDetail("");
    setDraftImportedNotes([]);

    try {
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const parsedNotes: DraftNote[] = [];

      const limitConcurrency = async <T, R>(
        items: T[],
        limit: number,
        fn: (item: T, idx: number) => Promise<R>
      ): Promise<R[]> => {
        const results: R[] = [];
        const executing: Promise<void>[] = [];
        for (let i = 0; i < items.length; i++) {
          const p = Promise.resolve().then(() => fn(items[i], i))
            .then((res) => { results[i] = res; });
          results.push(null as any);
          const e: Promise<void> = p.then(() => {
            executing.splice(executing.indexOf(e), 1);
          });
          executing.push(e);
          if (executing.length >= limit) {
            await Promise.race(executing);
          }
        }
        await Promise.all(executing);
        return results;
      };

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setActiveImportFileName(file.name);
        
        // Step 1: Uploading
        setImportStep('uploading');
        await delay(500); // UI transition ease

        // Step 2: Analyzing
        setImportStep('analyzing');

        const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isJson = file.name.endsWith('.json') || file.type.includes('json');
        const isCsv = file.name.endsWith('.csv') || file.type.includes('csv');
        const isText = file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md');

        let notesBatch: any[] = [];

        // If confidential, skip Gemini and parse locally
        if (isConfidential) {
          let textContent = "";
          if (isDocx) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            textContent = await extractDocxText(base64);
          } else {
            textContent = await file.text().catch(() => "");
          }
          
          notesBatch = [{
            title: file.name.replace(/\.[^/.]+$/, "") || "Confidential Document",
            content: textContent,
            summary: "Confidential private document processed locally.",
            categories: ["Confidential"],
            color: "#6b7280",
            folder: "Private Documents",
            keywords: ["private", "uploaded-file"],
            isConfidential: true,
            relatedIndices: []
          }];
        } else {
          // Process via AI split
          let textContent = "";
          if (isDocx) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            textContent = await extractDocxText(base64);
            
            // Step 3: Separating
            setImportStep('separating');
            const trimmed = textContent.slice(0, 150000);
            
            let success = false;
            let retryCount = 0;
            let lastErr: any = null;
            while (retryCount < 2 && !success) {
              try {
                notesBatch = await importDocumentNotes(trimmed);
                success = true;
              } catch (err: any) {
                lastErr = err;
                retryCount++;
                if (retryCount < 2) await delay(1500);
              }
            }
            if (!success) throw lastErr || new Error("Failed to split document");
          } else if (isText) {
            textContent = await file.text();
            
            // Step 3: Separating
            setImportStep('separating');
            const trimmed = textContent.slice(0, 150000);
            
            let success = false;
            let retryCount = 0;
            let lastErr: any = null;
            while (retryCount < 2 && !success) {
              try {
                notesBatch = await importDocumentNotes(trimmed);
                success = true;
              } catch (err: any) {
                lastErr = err;
                retryCount++;
                if (retryCount < 2) await delay(1500);
              }
            }
            if (!success) throw lastErr || new Error("Failed to split document");
          } else if (isJson) {
            const parsedText = await file.text();
            try {
              const data = JSON.parse(parsedText);
              
              if (isTakeoutJson(data)) {
                setImportStep('separating');
                setImportStatusDetail("Google Takeout structure detected. Parsing Keep checklists, bookmarks, and tasks...");
                await delay(400);

                const takeoutNotes = parseTakeoutJson(data, file.name);
                const totalNotes = takeoutNotes.length;

                if (totalNotes === 0) {
                  throw new Error("No valid notes or records found in the Google Takeout JSON file.");
                }

                if (isConfidential) {
                  setImportStatusDetail(`Bypassing AI analysis for ${totalNotes} confidential Keep / Takeout records...`);
                  notesBatch = takeoutNotes.map(n => ({
                    ...n,
                    summary: "Confidential document processed locally.",
                    categories: ["Confidential", ...n.categories],
                    color: "#6b7280",
                    isConfidential: true,
                    keywords: ["private", ...n.keywords],
                    relatedIndices: []
                  }));
                } else {
                  setImportStep('analyzing');
                  setImportStatusDetail(`Initiating secure batched AI analysis for ${totalNotes} Takeout records...`);
                  await delay(300);

                  const batchSize = 12;
                  const enrichedNotes: DraftNote[] = [];

                  for (let startIdx = 0; startIdx < totalNotes; startIdx += batchSize) {
                    const chunk = takeoutNotes.slice(startIdx, startIdx + batchSize);
                    const chunkNum = Math.floor(startIdx / batchSize) + 1;
                    const totalChunks = Math.ceil(totalNotes / batchSize);
                    
                    setImportStatusDetail(`AI processing batch ${chunkNum} of ${totalChunks} (${chunk.length} items)...`);

                    try {
                      const res = await fetch("/api/analyze-notes-batch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notes: chunk }),
                      });

                      if (!res.ok) {
                        throw new Error(`AI batch status ${res.status}`);
                      }

                      const resData = await res.json();
                      const resultsMap = new Map<number, any>();
                      if (Array.isArray(resData?.results)) {
                        resData.results.forEach((item: any) => {
                          if (item && typeof item.index === "number") {
                            resultsMap.set(item.index, item);
                          }
                        });
                      }

                      // Map results back
                      chunk.forEach((noteItem, idx) => {
                        const aiData = resultsMap.get(idx);
                        if (aiData) {
                          const generatedKeywords = Array.from(new Set([
                            ...(noteItem.keywords || []),
                            ...(aiData.categories || []).map((c: string) => c.toLowerCase()),
                            ...(aiData.title || "").toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)
                          ])).slice(0, 6);

                          enrichedNotes.push({
                            title: aiData.title || noteItem.title,
                            content: noteItem.content,
                            summary: aiData.summary || noteItem.summary,
                            categories: Array.isArray(aiData.categories) ? aiData.categories : noteItem.categories,
                            color: aiData.color || noteItem.color,
                            folder: noteItem.folder,
                            keywords: generatedKeywords,
                            relatedIndices: [],
                            isConfidential: false
                          });
                        } else {
                          // Individual local fallback inside successful batch responses
                          const localKeywords = Array.from(new Set([
                            ...(noteItem.keywords || []),
                            ...noteItem.categories.map((c: string) => c.toLowerCase()),
                            ...noteItem.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)
                          ])).slice(0, 6);

                          enrichedNotes.push({
                            title: noteItem.title,
                            content: noteItem.content,
                            summary: noteItem.summary,
                            categories: noteItem.categories,
                            color: noteItem.color,
                            folder: noteItem.folder,
                            keywords: localKeywords,
                            relatedIndices: [],
                            isConfidential: false
                          });
                        }
                      });

                    } catch (error) {
                      console.warn(`Fallback active for batch ${chunkNum}:`, error);
                      // Full automatic local fallback for this batch on error (e.g., 429, timeout)
                      chunk.forEach((noteItem) => {
                        const localKeywords = Array.from(new Set([
                          ...(noteItem.keywords || []),
                          ...noteItem.categories.map((c: string) => c.toLowerCase()),
                          ...noteItem.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4)
                        ])).slice(0, 6);

                        enrichedNotes.push({
                          title: noteItem.title,
                          content: noteItem.content,
                          summary: noteItem.summary,
                          categories: noteItem.categories,
                          color: noteItem.color,
                          folder: noteItem.folder,
                          keywords: localKeywords,
                          relatedIndices: [],
                          isConfidential: false
                        });
                      });
                    }
                  }

                  notesBatch = enrichedNotes;
                }
              } else {
                setImportStatusDetail("Standard JSON file found. Loading array/object notes structure...");
                if (Array.isArray(data)) {
                  notesBatch = data.map(item => ({
                    title: item.title || item.name || item.subject || "Imported JSON Note",
                    content: item.content || item.body || item.text || JSON.stringify(item, null, 2),
                    summary: item.summary || "Imported from JSON array structure.",
                    categories: item.categories || ["JSON"],
                    color: item.color || "#8b5cf6",
                    folder: item.folder || "JSON Import",
                    keywords: item.keywords || ["json-data"],
                    relatedIndices: item.relatedIndices || []
                  }));
                } else {
                  notesBatch = [{
                    title: data.title || file.name.replace(/\.[^/.]+$/, ""),
                    content: data.content || data.body || data.text || JSON.stringify(data, null, 2),
                    summary: data.summary || "Imported from JSON object structure.",
                    categories: data.categories || ["JSON"],
                    color: data.color || "#8b5cf6",
                    folder: data.folder || "JSON Import",
                    keywords: data.keywords || ["json-data"],
                    relatedIndices: data.relatedIndices || []
                  }];
                }
              }
            } catch (_) {
              setImportStep('separating');
              setImportStatusDetail("JSON corrupted or nested text. Attempting AI separation split...");
              notesBatch = await importDocumentNotes(parsedText.slice(0, 150000));
            }
          } else {
            // Unstructured Base64
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            // Step 3: Separating
            setImportStep('separating');
            let success = false;
            let retryCount = 0;
            let lastErr: any = null;
            while (retryCount < 2 && !success) {
              try {
                notesBatch = await importDocumentNotesBase64(base64, file.type || 'application/octet-stream', file.name);
                success = true;
              } catch (err: any) {
                lastErr = err;
                retryCount++;
                if (retryCount < 2) await delay(1500);
              }
            }
            if (!success) throw lastErr || new Error("Failed to split document");
          }
        }

        // Step 4: Organizing
        setImportStep('organizing');
        await delay(600); // Visual step timing

        // Push notes to drafts list
        parsedNotes.push(...notesBatch.map((n, idx) => ({
          title: n.title || `Extracted Topic ${idx + 1}`,
          content: n.content || "",
          summary: n.summary || "",
          categories: Array.isArray(n.categories) ? n.categories : [],
          color: n.color || "#3b82f6",
          folder: n.folder || "Unclassified",
          keywords: Array.isArray(n.keywords) ? n.keywords : [],
          relatedIndices: Array.isArray(n.relatedIndices) ? n.relatedIndices : [],
          isConfidential: isConfidential || n.isConfidential || false
        })));
      }

      setDraftImportedNotes(parsedNotes);
      setImportStep('completed');

    } catch (err: any) {
      console.error("Smart Import error:", err);
      setImportError(err.message || "Failed to process the document correctly. Please try again.");
      setImportStep(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    e.target.value = ''; // Reset input
    await processImportFiles(files);
  };

  const handleSaveImportedNotes = async (curatedNotes: DraftNote[]) => {
    console.log(`[Import Save] "Save Notes" clicked. Payload contains ${curatedNotes.length} curated notes.`);
    
    // Safety guard to avoid concurrent batches running
    if (isSubmitting) {
      console.warn("[Import Save] Already submitting notes. Ignoring duplicate trigger.");
      return;
    }
    
    setIsSubmitting(true);

    // Generic retry mechanism with delay
    const retryWithBackoff = async <T,>(
      fn: () => Promise<T>,
      retries = 3,
      delayMs = 1000
    ): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        if (retries <= 0) {
          throw error;
        }
        console.warn(`[Save Retry] Store write failed. Retrying... (${retries} retries left) in ${delayMs}ms. Error:`, error);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return retryWithBackoff(fn, retries - 1, delayMs * 2);
      }
    };

    try {
      console.log("[Import Save] Processing batch of parsed notes concurrently for maximum speed.");

      const savePromises = curatedNotes.map((item, index) => {
        return retryWithBackoff(async () => {
          const serialNo = index + 1;
          const totalNo = curatedNotes.length;
          
          console.log(`[Import Save] [Note ${serialNo}/${totalNo}] Initiating write for title "${item.title || 'Untitled'}"...`);
          
          const customMetadata = {
            categories: item.categories || [],
            summary: item.summary || "",
            color: item.color || "#3b82f6",
            folder: item.folder || "Unclassified",
            keywords: item.keywords || []
          };

          const noteId = await createNote(
            item.content,
            item.title,
            item.isConfidential || false,
            customMetadata
          );

          console.log(`[Import Save] [Note ${serialNo}/${totalNo}] Successfully written to database. Note ID: ${noteId}`);
          return noteId;
        }, 3, 1000);
      });

      // Wait for all saves to finish concurrently
      await Promise.all(savePromises);

      console.log(`[Import Save] Successfully committed all ${curatedNotes.length} note files into the database.`);
      toast.success(`Database write completed! successfully saved ${curatedNotes.length} notes.`);
      
      setDraftImportedNotes([]);
      setImportStep(null);
    } catch (err: any) {
      console.error("[Import Save] Atomic batch save failure:", err);
      toast.error(`Fatal Error saving notes: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isEnhancingNote, setIsEnhancingNote] = useState<boolean | string>(false);

  const handleAutoCategorizeEditingNote = async (overrideNote?: Note) => {
    const targetNote = overrideNote || editingNote;
    if (!targetNote || !targetNote.content) return;
    setIsEnhancingNote(targetNote.id);
    try {
        const analyzeRes = await fetch('/api/analyze-note', {
            method: 'POST',
            headers: getAIHeaders(),
            body: JSON.stringify({ content: targetNote.content })
        });
        
        if (!analyzeRes.ok) throw new Error("Failed to analyze");
        const analysis = await analyzeRes.json();
        
        const updated = {
            ...targetNote,
            title: analysis.title || targetNote.title,
            summary: analysis.summary || targetNote.summary,
            categories: analysis.categories || targetNote.categories,
            color: analysis.color || targetNote.color,
            keywords: analysis.keywords || targetNote.keywords,
        };
        
        // update remotely
        await updateNoteData(targetNote.id, updated);
        
        // update locally if it is the currently editing note
        if (editingNote && editingNote.id === targetNote.id) {
             setEditingNote(updated);
        }
    } catch(e) {
        console.error(e);
        toast.error("AI Categorization failed.");
    } finally {
        setIsEnhancingNote(false);
    }
  };


  const handleCreateNote = async () => {
    if (!draftContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const tempContent = draftContent;
      const tempTitle = draftTitle;
      const tempConfidential = isConfidential;
      setDraftContent("");
      setDraftTitle("");
      setIsConfidential(false);
      setIsDrafting(false);
      
      const newNoteId = await createNote(tempContent, tempTitle, tempConfidential);
      if (!tempConfidential) {
          // Process asynchronously
          processNoteWithAI(newNoteId, tempContent);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to create note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this note?");
    if (!confirmed) return;
    try {
      await deleteNote(noteId);
      toast.success("Note deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete note");
    }
  };

  const handleTogglePin = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateNoteData(note.id, { isPinned: !note.isPinned });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update note");
    }
  };

  // Derive categories for filter
  const allCategories = Array.from(
    new Set(notes.flatMap((n) => n.categories || []))
  ).sort();

  // Derive folders for filter
  const allFolders = Array.from(
    new Set(notes.map((n) => n.folder).filter(Boolean))
  ).sort();

  const dashboardSearchEngine = useMemo(() => {
    const engine = new NoteSearchEngine();
    engine.indexDocuments(notes);
    return engine;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (searchQuery.trim()) {
      const results = dashboardSearchEngine.search(searchQuery, {
        category: selectedCategory,
        folder: selectedFolder,
      });
      return results.map(r => r.note);
    }
    
    return notes.filter(n => {
      const matchesCategory = selectedCategory ? (n.categories || []).includes(selectedCategory) : true;
      const matchesFolder = selectedFolder ? n.folder === selectedFolder : true;
      return matchesCategory && matchesFolder;
    });
  }, [notes, searchQuery, selectedCategory, selectedFolder, dashboardSearchEngine]);

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-amber-500/30 relative"
    >
      {isDragging && (
        <div id="drag-drop-overlay" className="fixed inset-0 z-50 bg-[#050505]/90 backdrop-blur-md border-4 border-dashed border-amber-500/40 m-4 rounded-3xl flex flex-col items-center justify-center text-center pointer-events-none">
          <Upload className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-white tracking-tight">Drop your files here</h2>
          <p className="text-sm text-white/55 mt-2">We will automatically extract, separate, and catalog your concepts using AI.</p>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-[#080808]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 text-black rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-medium tracking-tight text-xl">Intelligent Notes</span>
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-1.5 bg-white/5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors sm:hidden flex items-center justify-center cursor-pointer"
              title="Search (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>

          <div 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex-1 max-w-md mx-8 relative hidden sm:block group cursor-pointer"
          >
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-amber-500/50 transition-colors" />
            <input
              type="text"
              readOnly
              placeholder="Search notes, insights, tags... (Cmd+K)"
              value={searchQuery}
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none transition-colors placeholder:text-white/40 text-white/80 cursor-pointer pointer-events-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-mono bg-white/10 border border-white/10 px-1.5 py-0.5 rounded text-white/60">⌘K</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 mr-2">
              <button
                onClick={() => setView('notes')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${view === 'notes' ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'}`}
              >
                Notes
              </button>
              <button
                onClick={() => setView('graph')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${view === 'graph' ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'}`}
              >
                Graph
              </button>
              <button
                onClick={() => setView('canvas')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${view === 'canvas' ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'}`}
              >
                Canvas
              </button>
            </div>
            <button
              onClick={() => setIsDrafting(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-black font-bold text-sm rounded-full hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              <Plus className="w-4 h-4" />
              New Note
            </button>
            <button
               onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  const existingDailyNote = notes.find(n => n.title === today);
                  if (existingDailyNote) {
                     setEditingNote(existingDailyNote);
                  } else {
                     setDraftTitle(today);
                     setDraftContent('# ' + today + '\n\n## Goals for today:\n- [ ] \n\n## Notes:\n- ');
                     setIsDrafting(true);
                  }
               }}
               className="text-[11px] font-bold uppercase tracking-wider text-white/70 bg-white/5 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors border border-white/10"
            >
               Daily Note
            </button>
            <button
               onClick={() => setIsAiManagerOpen(true)}
               className="text-[11px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full hover:bg-amber-500/20 transition-colors border border-amber-500/20 shadow-md shadow-black/20"
            >
               AI Models & Providers
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 flex items-center justify-center overflow-hidden border border-white/20">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-white">{user.email?.[0].toUpperCase()}</span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {isAiManagerOpen && (
        <AIGateway onClose={() => setIsAiManagerOpen(false)} />
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Telemetry Control Panel Row */}
        <div className="flex justify-end mb-6 max-w-2xl mx-auto">
          <button 
            onClick={() => setShowTelemetry(!showTelemetry)} 
            className="text-xs text-white/50 hover:text-white flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 border border-white/5 hover:border-white/10 rounded-full transition-all duration-200"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            {showTelemetry ? "Hide System Status" : "Monitor Resilient AI Engine"}
          </button>
        </div>

        {showTelemetry && (
          <div className="max-w-2xl mx-auto">
            <AIPipelineTelemetryPanel />
          </div>
        )}

        {/* Create Input */}
        <div className="mb-12 max-w-2xl mx-auto relative z-10">
          <div className="relative group bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-amber-500/50 transition-all duration-300 shadow-xl">
            {isDrafting && (
              <input
                type="text"
                placeholder="Title (optional)..."
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full bg-transparent p-5 pb-0 text-lg text-white font-medium outline-none placeholder:text-white/30"
                autoFocus
              />
            )}
            <textarea
              className="w-full bg-transparent text-white placeholder:text-white/40 p-5 outline-none resize-none min-h-[60px] leading-relaxed"
              placeholder="Dump your brain here... (Markdown supported) [[Use brackets for links]]"
              value={draftContent}
              onClick={() => setIsDrafting(true)}
              onChange={(e) => setDraftContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleCreateNote();
                }
              }}
              rows={isDrafting ? 5 : 1}
            />
            
            <AnimatePresence>
              {isDrafting && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-white/10 bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsConfidential(!isConfidential)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                        isConfidential 
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" 
                          : "text-white/40 hover:text-white/80 hover:bg-white/10"
                      )}
                      title="Keep this note strictly local & hidden from AI Analytics"
                    >
                      {isConfidential ? <EyeOff className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {isConfidential ? "Confidential" : "Standard"}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        setIsDrafting(false);
                        setDraftContent('');
                        setDraftTitle('');
                        setIsConfidential(false);
                      }}
                      className="text-white/40 border border-transparent hover:border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateNote}
                      disabled={isSubmitting || !draftContent.trim()}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-amber-950 px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      {isSubmitting ? (
                        <span className="w-4 h-4 border-2 border-amber-900/30 border-t-amber-900 rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                      Save Note
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Notebook Folders (Notebooks) Bar */}
        {allFolders.length > 0 && (
          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2 shrink-0">Notebooks:</span>
            <button
              onClick={() => setSelectedFolder(null)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest whitespace-nowrap transition-colors border",
                selectedFolder === null
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
              )}
            >
              All Notebooks
            </button>
            {allFolders.map(folder => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest whitespace-nowrap transition-colors border flex items-center gap-1.5",
                  selectedFolder === folder
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                )}
              >
                <Folder className="w-3 h-3 text-white/30" />
                {folder}
              </button>
            ))}
          </div>
        )}

        {/* Categories Bar */}
        {allCategories.length > 0 && (
          <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors border",
                selectedCategory === null
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
              )}
            >
              All Categories
            </button>
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors border flex items-center gap-1.5",
                  selectedCategory === cat
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                )}
              >
                <Tag className="w-3 h-3" />
                {cat}
              </button>
            ))}
          </div>
        )}

        {view === 'graph' ? (
          <div className="w-full h-[70vh] mb-12">
            <React.Suspense fallback={<div className="flex items-center justify-center p-24 text-white/50">Loading Graph...</div>}>
         <KnowledgeGraph notes={notes} onNodeClick={setEditingNote} />
       </React.Suspense>
          </div>
        ) : view === 'canvas' ? (
          <div className="w-full h-[75vh] mb-12 rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/5">
            <React.Suspense fallback={<div className="flex items-center justify-center p-24 text-white/50">Loading Canvas...</div>}>
         <CanvasView notes={notes} onOpenNote={setEditingNote} />
       </React.Suspense>
          </div>
        ) : (
        <>
        {/* Masonry-like Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                    <AnimatePresence>
            {sortedNotes.map((note) => (
              <NoteCard 
                key={note.id}
                note={note}
                notes={notes}
                onOpen={() => setEditingNote(note)}
                onTogglePin={handleTogglePin}
                onLinkClick={(title) => { 
                   const n = notes.find(n => n.title?.toLowerCase() === title.toLowerCase()); 
                   if (n) setEditingNote(n); 
                   else { setDraftTitle(title); setIsDrafting(true); } 
                }}
                onTagClick={(kw) => setSearchQuery(kw)}
                onDelete={(e) => { 
                   e.stopPropagation();
                   if (window.confirm('Delete note?')) deleteNote(note.id);
                }}
                onEnhance={(e) => {
                   e.stopPropagation();
                   handleAutoCategorizeEditingNote(note);
                }}
                isEnhancing={isEnhancingNote === note.id}
              />
            ))}
          </AnimatePresence>
          
          {sortedNotes.length === 0 && notes.length > 0 && (
              <div className="col-span-full py-20 text-center text-neutral-500 flex flex-col items-center">
                  <Search className="w-8 h-8 mb-4 opacity-20" />
                  <p>No notes found matching your search.</p>
              </div>
          )}
        </div>
        </>
        )}

      </main>

      {/* Smart Import overlay transitions step-by-step indicator */}
      {importStep !== null && importStep !== 'completed' && (
        <div id="import-loading-overlay" className="fixed inset-0 z-50 bg-[#050505]/90 backdrop-blur px-4 flex items-center justify-center">
          <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />
            <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-white/5 border-t-amber-500 animate-spin" />
              <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
            </div>
            
            <h3 className="text-lg font-bold text-white tracking-tight mb-2">Smart Import Processing</h3>
            <p className="text-xs text-white/40 mb-3 truncate max-w-xs block font-mono">File: {activeImportFileName}</p>
            {importStatusDetail && (
              <p className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/15 px-3 py-1.5 rounded-xl mb-5 leading-relaxed font-mono text-left max-h-16 overflow-y-auto custom-scrollbar">
                ⚡ {importStatusDetail}
              </p>
            )}
            
            <div className="space-y-3.5 text-left mb-6">
              {[
                { key: 'uploading', label: 'Extracting document text' },
                { key: 'analyzing', label: 'Analyzing content with AI' },
                { key: 'separating', label: 'Separating individual notes' },
                { key: 'organizing', label: 'Organizing into folders & tags' },
              ].map((step, idx) => {
                // Determine step indices to highlight completed states
                const stepOrder = ['uploading', 'analyzing', 'separating', 'organizing'];
                const currentIdx = stepOrder.indexOf(importStep);
                const isDone = currentIdx > idx;
                const isActive = importStep === step.key;
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] transition-all ${
                      isDone 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold' 
                        : isActive 
                        ? 'border-amber-500/50 text-amber-500 font-bold animate-pulse shadow shadow-amber-500/10' 
                        : 'border-white/10 text-white/20'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 stroke-[3]" /> : idx + 1}
                    </div>
                    <span className={`text-xs font-semibold ${
                      isDone || isActive ? 'text-white/80' : 'text-white/20'
                    }`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <span className="text-[9px] bg-amber-500/15 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-bold ml-auto animate-pulse uppercase tracking-wider scale-90">
                        Active
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {importError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-left flex flex-col gap-2 mb-4">
                <p className="text-xs text-rose-300 font-medium leading-relaxed font-mono">{importError}</p>
                <button 
                  onClick={() => {
                    setImportStep(null);
                    setImportError(null);
                  }}
                  className="bg-white/5 hover:bg-white/10 px-3 py-1 text-[10px] font-bold text-white uppercase rounded-md transition-colors"
                >
                  Close & Retry
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Import Workbench screen display */}
      {importStep === 'completed' && draftImportedNotes.length > 0 && (
        <SmartImportWorkbench
          initialNotes={draftImportedNotes}
          fileName={activeImportFileName}
          onClose={() => {
            setDraftImportedNotes([]);
            setImportStep(null);
          }}
          onSave={handleSaveImportedNotes}
        />
      )}

      {/* Dynamic Editing Modal / Detail Drawer for individual notes */}
      <AnimatePresence>
        {editingNote && (
          <NoteDetailModal
            note={editingNote}
            notes={notes}
            onClose={() => setEditingNote(null)}
            onLinkClick={(title) => { 
              const n = notes.find(n => n.title?.toLowerCase() === title.toLowerCase()); 
              if (n) setEditingNote(n); 
              else { 
                setEditingNote(null);
                setDraftTitle(title); 
                setIsDrafting(true); 
              } 
            }}
            onCreateLinkedNote={(title) => {
              setEditingNote(null);
              setDraftTitle(title);
              setIsDrafting(true);
            }}
            onOpenNote={setEditingNote}
            isEnhancingNote={isEnhancingNote === editingNote?.id}
            onAutoCategorize={handleAutoCategorizeEditingNote}
          />
        )}
      </AnimatePresence>
      <CommandPalette 
        notes={notes} 
        isOpen={isCommandPaletteOpen} 
        setIsOpen={setIsCommandPaletteOpen} 
        onOpenNote={setEditingNote} 
        onNewNote={() => setIsDrafting(true)} 
        onSwitchView={setView} 
      />
    </div>
  );
}
