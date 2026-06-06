import { GoogleGenAI } from "@google/genai";
import { validateProviderUrl } from "./security.js";

export interface NormalizedModel {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  family?: string;
  size?: string;
  quantization?: string;
}

export async function fetchProviderModels(providerId: string, baseUrl?: string, apiKey?: string): Promise<NormalizedModel[]> {
  try {
    validateProviderUrl(baseUrl);

    if (providerId === 'gemini') {
      const key = apiKey || process.env.GEMINI_API_KEY || "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=\${key}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gemini list models failed: " + res.status);
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name,
        provider: 'gemini',
        contextLength: m.inputTokenLimit,
      }));
    }

    if (providerId === 'ollama') {
      const ollamaUrl = (baseUrl || "http://127.0.0.1:11434").replace(/[\/]v1.*/g, '').replace(/[\/]api[\/]tags.*/g, '') + "/api/tags";
      const res = await fetch(ollamaUrl);
      if (!res.ok) throw new Error(`Ollama API Error: \${res.status}`);
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama',
        family: m.details?.family || 'unknown',
        size: m.details?.parameter_size,
        quantization: m.details?.quantization_level
      }));
    }

    if (providerId === 'anthropic') {
      return [
        { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextLength: 200000 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextLength: 200000 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', contextLength: 200000 }
      ];
    }

    // OpenAI Compatible
    let openaiBase = baseUrl || "https://api.openai.com/v1";
    if (openaiBase.endsWith('/chat/completions')) openaiBase = openaiBase.replace('/chat/completions', '');
    
    let path = "/models";

    const res = await fetch(openaiBase + path, {
      headers: {
        "Authorization": `Bearer \${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) throw new Error(`\${providerId} list models failed: \${res.status} \${await res.text()}`);
    const data = await res.json();
    return (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      provider: providerId,
      contextLength: m.context_length || m.top_provider?.context_length,
    }));

  } catch (err: any) {
    console.error(`Fetch Models Error (\${providerId}):`, err);
    throw new Error(`Failed to fetch models for \${providerId}: \${err.message}`);
  }
}
