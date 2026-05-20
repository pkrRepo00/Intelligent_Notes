import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  id: string;
  name: string;
  isCustomUrl?: boolean;
}

export type ProviderStatus = "connected" | "disconnected" | "error";

export interface OrchestrationRequest {
  providerId: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface OrchestrationResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

// Universal fetch adapter for OpenAI compatible APIs (OpenAI, Groq, DeepSeek, OpenRouter, Mistral, Local)
export async function fetchOpenAICompatible(req: OrchestrationRequest): Promise<OrchestrationResponse> {
  const url = req.baseUrl || "https://api.openai.com/v1/chat/completions";
  const body: any = {
    model: req.model,
    messages: [],
    temperature: req.temperature ?? 0.7,
  };
  
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  if (req.systemPrompt) {
    body.messages.push({ role: "system", content: req.systemPrompt });
  }
  body.messages.push({ role: "user", content: req.prompt });

  const headers: any = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${req.apiKey}`
  };
  
  // Specific headers for OpenRouter
  if (req.providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://aistudio.google.com";
    headers["X-Title"] = "AI Studio Build";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[${req.providerId}] API Error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices && data.choices[0] && data.choices[0].message.content;

  return {
    text: text || "",
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model || req.model,
    provider: req.providerId
  };
}

// Anthropic Adapter
export async function fetchAnthropic(req: OrchestrationRequest): Promise<OrchestrationResponse> {
  const url = "https://api.anthropic.com/v1/messages";
  const body: any = {
    model: req.model,
    max_tokens: req.maxTokens || 4096,
    temperature: req.temperature ?? 0.7,
    messages: [{ role: "user", content: req.prompt }]
  };

  if (req.systemPrompt) {
    body.system = req.systemPrompt;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[anthropic] API Error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  return {
    text,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    model: data.model || req.model,
    provider: req.providerId
  };
}

// Google Gemini Adapter
export async function fetchGemini(req: OrchestrationRequest): Promise<OrchestrationResponse> {
  const aiInstance = new GoogleGenAI({
    apiKey: req.apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });

  const fullPrompt = req.systemPrompt ? `${req.systemPrompt}\n\n${req.prompt}` : req.prompt;
  const config: any = {
     temperature: req.temperature ?? 0.7,
  };
  if (req.responseFormat === "json") {
     config.responseMimeType = "application/json";
  }

  const aiResponse = await aiInstance.models.generateContent({
    model: req.model,
    contents: fullPrompt,
    config
  });

  return {
    text: aiResponse.text || "",
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0, // SDK doesn't always expose this cleanly
    },
    model: req.model,
    provider: "gemini"
  };
}

export async function executeUniversalRequest(req: OrchestrationRequest): Promise<OrchestrationResponse> {
  switch (req.providerId) {
    case "anthropic":
      return fetchAnthropic(req);
    case "gemini":
      return fetchGemini(req);
    case "openai":
    case "groq":
    case "openrouter":
    case "deepseek":
    case "together":
    case "mistral":
    case "custom":
    default:
      return fetchOpenAICompatible(req);
  }
}
