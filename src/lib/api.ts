import { collection, doc, query, where, orderBy, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from './firebase';
import { Note } from '../types';

const NOTES_COLLECTION = 'notes';

export function subscribeToNotes(
  userId: string,
  onUpdate: (notes: Note[]) => void,
  onError: (error: Error) => void
) {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where("ownerId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const notes: Note[] = [];
    snapshot.forEach((doc) => {
      notes.push({ id: doc.id, ...doc.data() } as Note);
    });
    onUpdate(notes);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.LIST, NOTES_COLLECTION);
    } catch (e: any) {
      onError(e);
    }
  });
}

export async function createNote(
  noteContent: string,
  noteTitle?: string,
  isConfidential?: boolean,
  customData?: Partial<Note>
): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) {
        console.error("[createNote] No authenticated user found");
        throw new Error("Not authenticated");
    }

    const noteRef = doc(collection(db, NOTES_COLLECTION));
    const now = Date.now();
    
    console.log(`[createNote] Generating payload for title: "${noteTitle}" (Confidential: ${isConfidential})`);

    // Base note without AI categorizations yet (unless confidential or custom data is provided)
    const newNote: Omit<Note, 'id'> = {
        title: noteTitle || (isConfidential ? "Confidential Note" : ""),
        content: noteContent,
        ownerId: userId,
        createdAt: now,
        updatedAt: now,
        categories: isConfidential ? ['Confidential', 'Private'] : (customData?.categories || []),
        summary: isConfidential ? "Content hidden to preserve privacy." : (customData?.summary || ""),
        isConfidential: isConfidential || false,
        color: isConfidential ? "#52525B" : (customData?.color || "#3b82f6"),
        folder: customData?.folder || "Unclassified",
        keywords: customData?.keywords || [],
    };

    // Clean any potentially undefined values safely
    const cleanNote = JSON.parse(JSON.stringify(newNote));

    console.log(`[createNote] Database write started for document ID: ${noteRef.id}`, cleanNote);

    try {
        await setDoc(noteRef, cleanNote);
        console.log(`[createNote] Database write success for document ID: ${noteRef.id}`);
        return noteRef.id;
    } catch (e) {
        console.error(`[createNote] Database write failure for document ID: ${noteRef.id}`, e);
        handleFirestoreError(e, OperationType.CREATE, NOTES_COLLECTION);
        throw e;
    }
}

export const getActiveProviderConfig = () => {
    try {
        const activeId = localStorage.getItem('active_ai_provider') || 'gemini';
        const stored = localStorage.getItem('ai_providers');
        if (stored) {
            const providers = JSON.parse(stored);
            return providers.find((p: any) => p.id === activeId) || null;
        }
    } catch(e) {}
    return null;
};

export const getAIHeaders = () => {
    const config = getActiveProviderConfig();
    const configHeaders: Record<string, string> = {
        "Content-Type": "application/json"
    };
    if (config) {
        configHeaders["x-ai-provider"] = config.id;
        configHeaders["x-ai-model"] = config.model || '';
        if (config.apiKey) configHeaders["x-ai-apikey"] = config.apiKey;
        if (config.baseUrl) configHeaders["x-ai-baseurl"] = config.baseUrl;
    }
    return configHeaders;
};

export async function processNoteWithAI(noteId: string, content: string) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");

    try {
        const analyzeRes = await fetch('/api/analyze-note', {
            method: 'POST',
            headers: getAIHeaders(),
            body: JSON.stringify({ content })
        });
        
        if (!analyzeRes.ok) {
            let errMsg = analyzeRes.statusText;
            try {
                const errData = await analyzeRes.json();
                if (errData && errData.error) {
                    errMsg = errData.error;
                }
            } catch (_) {}
            throw new Error(`Failed to analyze note: ${errMsg || "Unknown API Error"}`);
        }

        const analysis = await analyzeRes.json();
        
        let updateData: any = { updatedAt: Date.now() };

        if (analysis.text && !analysis.title) {
            // Unstructured fallback mapping
            updateData.title = "Unstructured Analysis";
            updateData.summary = analysis.text.substring(0, 100) + "...";
            updateData.categories = ["Raw Notes"];
            updateData.color = "#6b7280";
        } else {
            updateData.title = analysis.title || "Untitled Processing";
            updateData.summary = analysis.summary || "";
            updateData.categories = analysis.categories || [];
            updateData.keywords = analysis.keywords || [];
            updateData.color = analysis.color || "#8b5cf6";
        }

        // Update the note in firestore
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        await updateDoc(noteRef, updateData);

    } catch(e) {
        console.error("AI Processing failed:", e);
    }
}

export async function importDocumentNotes(content: string): Promise<any[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");

    try {
        const analyzeRes = await fetch('/api/import-document', {
            method: 'POST',
            headers: getAIHeaders(),
            body: JSON.stringify({ content })
        });
        
        if (!analyzeRes.ok) {
            let errMsg = analyzeRes.statusText;
            try {
                const errData = await analyzeRes.json();
                if (errData && errData.error) {
                    errMsg = errData.error;
                }
            } catch (_) {}
            throw new Error(`Failed to process document: ${errMsg || "Unknown API Error"}`);
        }

        const analysis = await analyzeRes.json();
        return analysis.notes || [];

    } catch(e) {
         console.error("AI Document Import failed:", e);
         throw e;
    }
}

export async function importDocumentNotesBase64(base64Data: string, mimeType: string, fileName: string): Promise<any[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");

    try {
        const analyzeRes = await fetch('/api/import-document-base64', {
            method: 'POST',
            headers: getAIHeaders(),
            body: JSON.stringify({ base64Data, mimeType, fileName })
        });
        
        if (!analyzeRes.ok) {
            let errMsg = analyzeRes.statusText;
            try {
                const errData = await analyzeRes.json();
                if (errData && errData.error) {
                    errMsg = errData.error;
                }
            } catch (_) {}
            throw new Error(`Failed to process document: ${errMsg || "Unknown API Error"}`);
        }

        const analysis = await analyzeRes.json();
        return analysis.notes || [];

    } catch(e) {
         console.error("AI Document Import Base64 failed:", e);
         throw e;
    }
}

export async function extractDocxText(base64Data: string): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");

    try {
        const res = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data })
        });
        
        if (!res.ok) {
            throw new Error(`Failed to extract DOCX text: ${res.statusText}`);
        }

        const data = await res.json();
        return data.text || "";
    } catch(e) {
        console.error("extractDocxText failed:", e);
        throw e;
    }
}

export async function updateNoteData(noteId: string, updates: Partial<Note>) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");

    try {
        const cleanedUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        await updateDoc(noteRef, {
            ...cleanedUpdates,
            updatedAt: Date.now()
        });
    } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, NOTES_COLLECTION);
        throw e;
    }
}

export async function deleteNote(noteId: string) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");
    
    // ALWAYS GET USER CONFIRMATION BEFORE CALLING THIS!
    try {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        await deleteDoc(noteRef);
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, NOTES_COLLECTION);
        throw e;
    }
}
