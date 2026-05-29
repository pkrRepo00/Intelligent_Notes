import { GoogleGenAI, Type } from "@google/genai";

export enum Priority {
  HIGH = 1,   // Single interactive note creation/updates
  MEDIUM = 2, // Document splits / imports
  LOW = 3     // Batch analysis chunks
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface TelemetryStats {
  queueSize: number;
  activeCalls: number;
  tokensAvailable: number;
  circuitState: CircuitState;
  cacheHits: number;
  totalCalls: number;
  rateLimit429Errors: number;
  totalFallbackCount: number;
  totalRetries: number;
  recentLogs: LogEntry[];
}

interface QueueItem {
  prompt: string;
  payload: any;
  priority: Priority;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  attempts: number;
  modelChainIndex: number;
  createdAt: number;
  type: "analyze-note" | "analyze-batch" | "import-doc"; providerOptions?: any;
}

/**
 * Normalizes and hashes strings for prompt/content deduplication caching.
 */
function getSimpleHash(str: string): string {
  let hash = 0;
  const normalized = str.trim().toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "cache_" + Math.abs(hash).toString(36);
}

/**
 * Intelligent regex/rule-based deterministic notes summarizer and metadata extractor.
 * This runs locally with 0ms latency in fallback mode when API limits are exhausted.
 */
export function localAnalyzeFallback(content: string, titleHint?: string) {
  const cleanContent = content.trim();
  
  // Title derivation
  let title = titleHint || "";
  if (!title) {
    const lines = cleanContent.split("\n").map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    // If the first clean line is reasonably short, use it as title
    if (firstLine && firstLine.length < 50 && !firstLine.includes("###") && !firstLine.includes("**")) {
      title = firstLine;
    } else {
      const words = cleanContent.split(/\s+/).slice(0, 5).join(" ");
      title = words ? words + "..." : "Untitled Note";
    }
  }
  // Strip Markdown markers from title
  title = title.replace(/[#*`[\]]/g, "").trim().slice(0, 45);

  // Summary derivation
  const sentences = cleanContent.match(/[^.!?]+[.!?]+/g) || [cleanContent];
  const firstTwo = sentences.slice(0, 2).map(s => s.trim()).join(" ");
  const summary = firstTwo ? (firstTwo.length > 120 ? firstTwo.slice(0, 117) + "..." : firstTwo) : "Note text processed locally using lightweight heuristics.";

  // Category tags & Vibe matches
  const textLower = cleanContent.toLowerCase();
  const categories: string[] = [];
  let color = "#6b7280"; // Neutral Slate Slate

  if (textLower.includes("call") || textLower.includes("meeting") || textLower.includes("zoom") || textLower.includes("sync") || textLower.includes("discuss")) {
    categories.push("Meeting");
    color = "#8b5cf6"; // Purple
  }
  if (textLower.includes("buy") || textLower.includes("price") || textLower.includes("purchase") || textLower.includes("cost") || textLower.includes("invoice") || textLower.includes("spend") || textLower.includes("finance")) {
    categories.push("Finance");
    color = "#ef4444"; // Red (critical budget/finance items)
  }
  if (textLower.includes("todo") || textLower.includes("task") || textLower.includes("checklist") || textLower.includes("due") || textLower.includes("deadline") || textLower.includes("schedule")) {
    categories.push("Task");
    color = "#d97706"; // Amber Amber
  }
  if (textLower.includes("idea") || textLower.includes("creative") || textLower.includes("design") || textLower.includes("project") || textLower.includes("growth")) {
    categories.push("Idea");
    color = "#10b981"; // Emerald Emerald
  }
  if (textLower.includes("study") || textLower.includes("exam") || textLower.includes("lecture") || textLower.includes("class") || textLower.includes("course") || textLower.includes("quiz")) {
    categories.push("Study");
    color = "#3b82f6"; // Royal Blue Blue
  }

  if (categories.length === 0) {
    categories.push("Personal");
    color = "#4b5563"; // Cool Charcoal Gray
  }

  // Keywords processing
  const stopWords = new Set(["the", "and", "a", "of", "to", "is", "in", "it", "that", "this", "your", "for", "with", "on", "as", "are", "from", "at", "be", "an", "have", "not", "this", "their", "there", "about"]);
  const matchedWords = cleanContent.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase().split(/\s+/);
  const uniqueWords = Array.from(new Set(matchedWords))
    .filter(w => w.length > 5 && !stopWords.has(w))
    .slice(0, 5);

  return {
    title,
    summary,
    categories,
    color,
    keywords: uniqueWords.length > 0 ? uniqueWords : ["note"]
  };
}

/**
 * Intelligent regex/rule-based deterministic document separator fallback.
 */
export function localSplitDocumentFallback(content: string) {
  // Split by headings, markdown divider lines, numeric bullet points or paragraph gaps
  const sections = content.split(/(?=#{1,3}\s+)|(?=\n-{3,}\n)|(?=\n\d+\.\s+)/g);
  let validSections = sections.map(s => s.trim()).filter(s => s.length > 15);
  
  if (validSections.length <= 1) {
    // Fall back to split by paragraphs if single block
    const paras = content.split(/\n\s*\n+/g).map(p => p.trim()).filter(p => p.length > 15);
    if (paras.length > 1) {
      return paras.map((p, idx) => {
        const fallback = localAnalyzeFallback(p, `Section ${idx + 1}`);
        return {
          content: p,
          ...fallback,
          folder: "Local Heuristics",
          relatedIndices: []
        };
      });
    }
  }

  if (validSections.length === 0) {
    validSections = [content];
  }

  return validSections.map((sect, idx) => {
    let headingMatch = sect.match(/^#{1,3}\s+(.*)/);
    let titleHint = headingMatch ? headingMatch[1].trim() : `Section ${idx + 1}`;
    titleHint = titleHint.replace(/^[#\s]+/, "");

    const fallback = localAnalyzeFallback(sect, titleHint);
    return {
      content: sect,
      ...fallback,
      folder: "Local Heuristics",
      relatedIndices: []
    };
  });
}

/**
 * Resilient AIEngine with Token Bucket Rate Limiting, Priority Queues, Circuit Breaker, Caching & Deduplication.
 */
export class AIEngine {
  private static instance: AIEngine;
  
  // Model Fallback chain
  private readonly modelChain = [
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash"
  ];

  // Global Memory Cache
  private cache = new Map<string, any>();
  
  // In-Flight Request Merging Map (Key -> Promise)
  private inFlightRequests = new Map<string, Promise<any>>();

  // Priority queue
  private queue: QueueItem[] = [];
  
  // Token Bucket Config: Prevents going over 15 RPM (Requests Per Minute)
  private maxTokens = 12; // Leave a safe margin below 15
  private tokens = 12;
  private refillIntervalMs = 5000; // Refill 1 token every 5 seconds (12 requests per minute)
  
  // Circuit Breaker State
  private circuitState: CircuitState = "CLOSED";
  private failureCount = 0;
  private failureThreshold = 3;
  private lastFailureTime = 0;
  private circuitCooldownMs = 30000; // 30 seconds cooldown when tripped

  // Active concurrently executing API calls
  private activeCalls = 0;

  // Trackers
  private cacheHitsCount = 0;
  private totalCallsCount = 0;
  private total429ErrorsCount = 0;
  private totalFallbackCount = 0;
  private totalRetriesCount = 0;
  private logs: LogEntry[] = [];

  private aiInstance: GoogleGenAI | null = null;

  private constructor() {
    this.addLog("info", "AI Production Engine initialized.");
    
    // Start continuous Token Refill Timer
    setInterval(() => {
      this.refillToken();
    }, this.refillIntervalMs);

    // Continuous Queue Runner tick
    setInterval(() => {
      this.processNextInQueue();
    }, 150);
  }

  public static getInstance(): AIEngine {
    if (!AIEngine.instance) {
      AIEngine.instance = new AIEngine();
    }
    return AIEngine.instance;
  }

  public getTelemetry(): TelemetryStats {
    // If circuit is OPEN, check if cooldown has elapsed
    this.checkCircuitHealth();

    return {
      queueSize: this.queue.length,
      activeCalls: this.activeCalls,
      tokensAvailable: Math.floor(this.tokens),
      circuitState: this.circuitState,
      cacheHits: this.cacheHitsCount,
      totalCalls: this.totalCallsCount,
      rateLimit429Errors: this.total429ErrorsCount,
      totalFallbackCount: this.totalFallbackCount,
      totalRetries: this.totalRetriesCount,
      recentLogs: [...this.logs].slice(-25) // Return last 25 logs
    };
  }

  private addLog(level: "info" | "warn" | "error", message: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    this.logs.push(entry);
    if (this.logs.length > 200) {
      this.logs.shift(); // Evict oldest
    }
    console.log(`[AIEngine ${level.toUpperCase()}] ${message}`);
  }

  private refillToken() {
    if (this.tokens < this.maxTokens) {
      this.tokens = Math.min(this.maxTokens, this.tokens + 1);
    }
  }

  private checkCircuitHealth() {
    if (this.circuitState === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.circuitCooldownMs) {
        this.circuitState = "HALF_OPEN";
        this.addLog("warn", "Circuit Breaker cooldown ended. Status: HALF_OPEN.");
      }
    }
  }

  /**
   * Cleans white spacing, removes repeated symbols/markdown indicators, and shortens prompt inputs to optimize token footprint.
   */
  private preprocessContent(content: string): string {
    if (!content) return "";
    return content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n") // Collapse massive paragraph gaps
      .replace(/[ \t]{2,}/g, " ")   // Smooth excessive spaces
      .slice(0, 100000)            // Truncate to a practical high ceiling
      .trim();
  }

  /**
   * Main API wrapper endpoint used by Route Handlers.
   * Regulates through queue + circuit breakers + caching.
   */
  public async enqueueTask(
    type: "analyze-note" | "analyze-batch" | "import-doc",
    prompt: string,
    payload: any,
    priority: Priority = Priority.MEDIUM, providerOptions?: any
  ): Promise<any> {
    
    // 1. Clean and optimize input prompt to minimize token bills & rate burdens
    const optimizedPrompt = this.preprocessContent(prompt || "");
    const cacheKey = getSimpleHash(type + "|||" + optimizedPrompt);

    // 2. Query Memory Cache Layer
    if (this.cache.has(cacheKey)) {
      this.cacheHitsCount++;
      const cached = this.cache.get(cacheKey);
      this.addLog("info", `Cache Hit! Returning quick optimized response for hash ${cacheKey}.`);
      return cached;
    }

    // 3. Merging in-flight requests for identical prompts
    if (this.inFlightRequests.has(cacheKey)) {
      this.addLog("info", `Duplicate Request Detected. Merging client call with pending in-flight operation ${cacheKey}.`);
      return this.inFlightRequests.get(cacheKey)!;
    }

    // 4. Create and return queue promise
    const taskPromise = new Promise((resolve, reject) => {
      this.queue.push({
        prompt: optimizedPrompt,
        payload,
        priority,
        resolve,
        reject,
        attempts: 0,
        modelChainIndex: 0,
        createdAt: Date.now(),
        type,
        providerOptions
      });
      // Sort immediately by priority (Highest Priority = Lowest number) and then by creation time
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.createdAt - b.createdAt;
      });
      this.addLog("info", `Queued ${type} request (Priority: ${Priority[priority]} / Queue Depth: ${this.queue.length}).`);
    });

    // Share this promise so concurrently repeating clicks pull identical resolutions
    this.inFlightRequests.set(cacheKey, taskPromise);
    
    try {
      const result = await taskPromise;
      // Store in Cache on successful retrieval
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Internal processor checking token bucket availability and circuit health.
   */
  private async processNextInQueue() {
    this.checkCircuitHealth();

    if (this.queue.length === 0) return;

    // Search the queue for items with safe, custom user/Pro API keys
    let itemIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const qItem = this.queue[i];
      const hasCustomApiKey = !!(qItem.providerOptions && qItem.providerOptions.apiKey);
      if (hasCustomApiKey) {
        itemIndex = i;
        break;
      }
    }

    if (itemIndex !== -1) {
      // Dequeue the custom keyed item and execute it immediately, bypassing global circuit-breaker and global token-bucket
      const item = this.queue.splice(itemIndex, 1)[0];
      this.activeCalls++;
      this.totalCallsCount++;
      this.addLog("info", `Bypassing global rate limits and circuit controls for custom API Key: ProviderID [${item.providerOptions?.providerId}].`);
      this.executeAIPipeline(item);
      return;
    }

    // Default flow for server-managed tasks
    if (this.circuitState === "OPEN") {
      // Circuit represents exhaustive API restrictions. Trigger automatic local preprocessed fallback immediately so the UI is responsive.
      const oldestOpenItem = this.queue.shift();
      if (oldestOpenItem) {
        this.addLog("warn", "Circuit OPEN. Diverting request to Deterministic Hybrid Fallback instantly.");
        this.resolveLocalFallback(oldestOpenItem);
      }
      return;
    }

    // Check if Rate Limit Tokens are available
    if (this.tokens < 1) {
      // Token exhausted. Rate limit regulated. Let tasks wait in queue until refill ticks.
      return;
    }

    // Dequeue highest priority item
    const item = this.queue.shift();
    if (!item) return;

    // Consume Rate Limit Token
    this.tokens--;
    this.activeCalls++;
    this.totalCallsCount++;

    this.executeAIPipeline(item);
  }

  /**
   * Fires the actual API request to Gemini with model fallback arrays.
   */
  private async executeAIPipeline(item: QueueItem) {
    if (item.providerOptions) {
      if (!item.providerOptions.apiKey && item.providerOptions.providerId !== 'gemini') {
        this.activeCalls--;
        item.reject(new Error("API key is required for provider: " + item.providerOptions.providerId));
        return;
      }
    } else if (!process.env.GEMINI_API_KEY) {
      this.activeCalls--;
      const err = new Error("GEMINI_API_KEY is missing");
      this.addLog("error", "AI Platform missing API Key credentials.");
      item.reject(err);
      return;
    }

    try {
      let responseText = "";
      let activeModel = this.modelChain[item.modelChainIndex];

      if (item.providerOptions) {
        // Universal Orchestrator Route
        const { executeUniversalRequest } = require('./orchestrator');
        activeModel = item.providerOptions.model || activeModel;
        this.addLog("info", `Analyzing via Custom Gateway: ${item.providerOptions.providerId} / ${activeModel} (Priority ${Priority[item.priority]})`);
        
        let systemPrompt = "";
        if (item.payload && item.payload.contents && Array.isArray(item.payload.contents) && typeof item.payload.contents[0] === 'string') {
          systemPrompt = item.payload.contents[0]; 
        }

        let isSafeBaseUrl = true;
        if (item.providerOptions.baseUrl) {
          try {
            const urlObj = new URL(item.providerOptions.baseUrl);
            isSafeBaseUrl = urlObj.hostname === 'generativelanguage.googleapis.com' || urlObj.hostname.endsWith('.googleapis.com');
          } catch {
            isSafeBaseUrl = false;
          }
        }
        const req = {
          providerId: item.providerOptions.providerId,
          model: activeModel,
          apiKey: item.providerOptions.apiKey || (item.providerOptions.providerId === 'gemini' && isSafeBaseUrl ? process.env.GEMINI_API_KEY : ''),
          baseUrl: item.providerOptions.baseUrl,
          systemPrompt: systemPrompt,
          prompt: item.prompt,
          responseFormat: (item.payload?.config?.responseMimeType === "application/json" ? "json" : "text") as "json" | "text"
        };
        const uRes = await executeUniversalRequest(req);
        responseText = uRes.text;
      } else {
        // Default Google AI Native Route
        if (!this.aiInstance) {
          this.aiInstance = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              }
            }
          });
        }

        this.addLog("info", `Analyzing via Native Gemini (${activeModel}) (Priority ${Priority[item.priority]})`);

        const fullParams = {
          ...item.payload,
          model: activeModel,
          contents: item.prompt
        };

        const aiResponse = await this.aiInstance.models.generateContent(fullParams);
        responseText = aiResponse.text || "";
      }
      
      this.activeCalls--;

      if (responseText) {
        // Success!
        this.addLog("info", `Successfully processed AI Pipeline.`);
        
        // Reset failures if circuit closing
        if (this.circuitState === "HALF_OPEN") {
          this.circuitState = "CLOSED";
          this.failureCount = 0;
          this.addLog("info", "Circuit Breaker successfully closed. Normal service resumed.");
        }

        try {
          // Clean standard markdown JSON backticks to avoid parsing errors
          let cleanText = responseText.trim();
          if (cleanText.startsWith("```json")) {
            cleanText = cleanText.substring(7);
          } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.substring(3);
          }
          if (cleanText.endsWith("```")) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
          }
          
          const parsed = JSON.parse(cleanText.trim());
          item.resolve(parsed);
        } catch (_) {
          // Fallback to text string response
          item.resolve({ text: responseText });
        }
      } else {
         throw new Error("Empty text block replied from AI API");
      }

    } catch (err: any) {
      this.activeCalls--;
      
      const errMsg = err?.message || String(err);
      const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
      
      if (isRateLimit) {
        this.total429ErrorsCount++;
        this.addLog("warn", `Gemini Rate Limit (429) Error on API attempt: ${errMsg}`);
        
        const hasCustomApiKey = !!(item.providerOptions && item.providerOptions.apiKey);
        if (!hasCustomApiKey) {
          this.failureCount++;
          this.lastFailureTime = Date.now();
          // Immediately trip circuit breaker so all concurrent/future general calls bypass Gemini API
          this.circuitState = "OPEN";
          this.addLog("error", "Default API Key rate limit or quota exhausted. Tripping Circuit Breaker and activating deterministic safety fallback.");
        } else {
          this.addLog("warn", "Custom User/Pro API Key rate limit encountered. Resolving local fallback for this task only.");
        }
        
        this.resolveLocalFallback(item);
        return;
      }

      // Re-enqueue or fallback logic for non-quota/transient errors
      item.attempts++;
      this.totalRetriesCount++;

      // Try fallback models in our active model fall-over chain
      if (item.modelChainIndex < this.modelChain.length - 1) {
        item.modelChainIndex++;
        this.addLog("warn", `Falling back to model [${this.modelChain[item.modelChainIndex]}] for retry...`);
        // Put back in high priority to avoid waiting
        this.queue.unshift(item);
      } else {
        // We exhausted all models! Let's trigger deterministic rule fallback
        this.addLog("error", "Exhausted all Gemini models in chain. Triggering deterministic safety fallback.");
        this.resolveLocalFallback(item);
      }
    }
  }

  /**
   * Resolves a queued request using local preprocessors without calling Google.
   */
  private resolveLocalFallback(item: QueueItem) {
    this.totalFallbackCount++;
    try {
      if (item.type === "analyze-note") {
        // payload content is extracted from the prompt
        const cleanContent = item.prompt;
        const result = localAnalyzeFallback(cleanContent);
        this.addLog("info", `Resolved analyze-note locally via Hybrid algorithm: "${result.title}"`);
        item.resolve(result);
      } else if (item.type === "import-doc") {
        const result = localSplitDocumentFallback(item.prompt);
        this.addLog("info", `Resolved split-doc locally via separation heuristic: Split into ${result.length} notes.`);
        item.resolve({ notes: result });
      } else if (item.type === "analyze-batch") {
        // Extract objects
        const notesArray = item.payload.notes || [];
        const fallbackResults = notesArray.map((n: any, idx: number) => {
          const processed = localAnalyzeFallback(n.content || "", n.title);
          return {
            index: idx,
            ...processed
          };
        });
        this.addLog("info", `Resolved analyze-batch locally via batch analytics.`);
        item.resolve({ results: fallbackResults });
      } else {
         item.reject(new Error("Unknown queue type resolved. Failed fallback."));
      }
    } catch (e: any) {
      this.addLog("error", `Fallback engine critical error: ${e.message}`);
      item.reject(e);
    }
  }
}
