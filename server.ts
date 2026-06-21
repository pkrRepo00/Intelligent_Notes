import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import { AIEngine, Priority } from "./server/aiEngine";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Get singleton of resilient AIEngine
  const aiEngine = AIEngine.getInstance();

  // Expose Live Telemetry Status dashboard API
  app.get("/api/ai-telemetry", (req, res) => {
    res.json(aiEngine.getTelemetry());
  });

  // Test custom provider connection
  app.post("/api/test-provider", async (req, res) => {
    const { providerId, model, apiKey, baseUrl } = req.body;
    try {
      const { executeUniversalRequest } = require("./server/orchestrator");
      const resp = await executeUniversalRequest({
        providerId,
        model,
        apiKey: apiKey === 'dummy' ? (process.env.GEMINI_API_KEY || '') : apiKey,
        baseUrl,
        prompt: "Respond with the word 'PONG'. No other text."
      });
      res.json(resp);
    } catch (e: any) {
      console.error('Test fail:', e);
      res.status(400).json({ error: e.message || "Failed to ping provider" });
    }
  });

  // API Route for fetching models dynamically
  app.post("/api/provider-models", async (req, res) => {
    try {
      const { providerId, baseUrl, apiKey } = req.body;
      if (!providerId) return res.status(400).json({ error: "providerId is required" });
      const { fetchProviderModels } = await import("./server/modelsFetcher");
      const models = await fetchProviderModels(providerId, baseUrl, apiKey);
      res.json({ models });
    } catch (err: any) {
      console.error("/api/provider-models error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch models" });
    }
  });

  // Pull new Ollama model
  app.post("/api/pull-model", async (req, res) => {
    try {
      const { modelName, baseUrl } = req.body;
      const ollamaUrl = (baseUrl || "http://127.0.0.1:11434").replace(/[\/]v1.*/g, '') + "/api/pull";
      const { validateSafeUrl } = await import("./server/security.js");
      validateSafeUrl(ollamaUrl);
      const resp = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, stream: false }),
        redirect: 'error'
      });
      if (!resp.ok) throw new Error("Ollama pull failed");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for Gemini analysis
  app.post("/api/analyze-note", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      const providerOptions = req.headers['x-ai-provider'] ? {
        providerId: req.headers['x-ai-provider'],
        model: req.headers['x-ai-model'],
        apiKey: req.headers['x-ai-apikey'],
        baseUrl: req.headers['x-ai-baseurl']
      } : undefined;

      const prompt = `Analyze the following note. Provide a concise title, a brief summary (max 2 sentences), an array of 1 to 4 highly relevant category tags (like 'Idea', 'Task', 'Personal', 'Work', 'Finance', 'Meeting', etc.), and a hex color code that fits the vibe.

Note content:
"""
${content}
"""`;

      const payload = {
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A short, fitting title for the note. Max 5 words.",
              },
              summary: {
                type: Type.STRING,
                description: "A short summary of the note, max 2 sentences.",
              },
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: "List of 1-4 short categories/tags for the note.",
              },
              keywords: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: "List of 3-6 unique searchable keywords.",
              },
              color: {
                type: Type.STRING,
                description: "A hex color code representing the category/vibe (e.g. #3b82f6 for work).",
              }
            },
            required: ["title", "summary", "categories", "keywords", "color"],
          },
        },
      };

      const result = await aiEngine.enqueueTask("analyze-note", prompt, payload, Priority.HIGH, providerOptions);
      res.json(result);
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze note" });
    }
  });

  // API Route for highly optimized, rate-limit safe batched Gemini analysis
  app.post("/api/analyze-notes-batch", async (req, res) => {
    try {
      const { notes } = req.body;
      if (!Array.isArray(notes) || notes.length === 0) {
        return res.status(400).json({ error: "Array of notes is required" });
      }

      const providerOptions = req.headers['x-ai-provider'] ? {
        providerId: req.headers['x-ai-provider'],
        model: req.headers['x-ai-model'],
        apiKey: req.headers['x-ai-apikey'],
        baseUrl: req.headers['x-ai-baseurl']
      } : undefined;

      const formattedNotesInput = notes.map((n, idx) => {
        return `--- Note Index: ${idx} ---
Title Hint: ${n.title || ""}
Content: ${n.content || ""}`;
      }).join("\n\n");

      const prompt = `You are organizing a batch of imported notes/tasks.
For each note in the batch below, analyze the content and generate:
1. An enriched title (up to 5 words, fitting and informative).
2. A brief 1-2 sentence summary.
3. 1 to 4 highly relevant category tags (e.g. 'Idea', 'Task', 'Personal', 'Work', 'Finance', 'Meeting').
4. A hex color code that fits the category (e.g. #3b82f6 for Work, #10b981 for Idea, #ef4444 for Critical, #d97706 for Tasks, #8b5cf6 for Personal).
5. 3 to 6 unique searchable keywords.

Please process every item. Return a JSON object with a single top-level key "results", containing an array of objects matching the given schema.

Notes to analyze:
${formattedNotesInput}`;

      const payload = {
        notes,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: {
                      type: Type.INTEGER,
                      description: "The 0-based Note Index as provided in the input.",
                    },
                    title: {
                      type: Type.STRING,
                    },
                    summary: {
                      type: Type.STRING,
                    },
                    categories: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    color: {
                      type: Type.STRING,
                    },
                    keywords: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    }
                  },
                  required: ["index", "title", "summary", "categories", "color", "keywords"],
                }
              }
            },
            required: ["results"],
          },
        },
      };

      const result = await aiEngine.enqueueTask("analyze-batch", prompt, payload, Priority.LOW, providerOptions);
      res.json(result);
    } catch (err: any) {
      console.error("Gemini Batch API Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze notes in batch" });
    }
  });

  // API Route for document import
  app.post("/api/import-document", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      console.log("[import-document] Running local deterministic splitting...");
      const { splitDocumentIntoNotes } = await import("./server/documentParser");
      const parsedNotes = splitDocumentIntoNotes(content);

      // Now we have the locally split text chunks. We can map them into the expected DraftNote schema.
      const formatted = parsedNotes.map((n) => ({
         title: n.title,
         content: n.content,
         summary: n.content.split(".").slice(0, 2).join(".") + ".",
         categories: ["Imported Chunk"],
         color: "#4b5563",
         folder: "Imports",
         keywords: ["import"],
         relatedIndices: []
      }));

      // NOTE: Instead of sending to Gemini right now, we return the rough structure to frontend.
      // The frontend can then choose to batch-process them with AI, or just show them natively.
      res.json({ notes: formatted });
    } catch (err: any) {
      console.error("Local Document Regex Import Error:", err);
      res.status(500).json({ error: err.message || "Failed to parse document" });
    }
  });

  // API Route for extracting plain text from DOCX files
  app.post("/api/extract-text", async (req, res) => {
    try {
      const { base64Data } = req.body;
      if (!base64Data || typeof base64Data !== "string") {
        return res.status(400).json({ error: "base64Data is required" });
      }

      const buffer = Buffer.from(base64Data, "base64");
      const result = await mammoth.extractRawText({ buffer });
      
      res.json({ text: result.value || "" });
    } catch (err: any) {
      console.error("DOCX extraction error:", err);
      res.status(500).json({ error: err.message || "Failed to extract text from document" });
    }
  });

  // API Route for document import by base64 (helps to parse any format like PDF)
  app.post("/api/import-document-base64", async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body;
      if (!base64Data || typeof base64Data !== "string") {
        return res.status(400).json({ error: "base64Data is required" });
      }

      const buffer = Buffer.from(base64Data, "base64");
      const { extractTextFromBuffer, splitDocumentIntoNotes } = await import("./server/documentParser");
      
      const cleanText = await extractTextFromBuffer(buffer, mimeType || "");
      console.log(`[import-document-base64] Extracted text from ${fileName}, length: ${cleanText.length}. Running native chunking...`);

      const parsedNotes = splitDocumentIntoNotes(cleanText);

      const formatted = parsedNotes.map((n) => ({
         title: n.title,
         content: n.content,
         summary: n.content.length > 50 ? n.content.substring(0, 47) + "..." : n.content,
         categories: ["Imported Chunk"],
         color: "#4b5563",
         folder: "Imports",
         keywords: ["import"],
         relatedIndices: []
      }));

      res.json({ notes: formatted });
    } catch (err: any) {
      console.error("Local Document Native Parsing Base64 Error:", err);
      res.status(500).json({ error: err.message || "Failed to parse document natively" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
