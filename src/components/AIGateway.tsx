import React, { useState, useEffect } from 'react';
import { X, Check, Server, Key, AlertCircle, Activity, Search, Cpu, Database, Cloud } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ProviderConfig {
  id: string;
  name: string;
  model: string;
  baseUrl?: string;
  apiKey: string;
  enabled: boolean;
  type: 'cloud' | 'local';
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: 'gemini', name: 'Google Gemini', model: 'gemini-3.5-flash', apiKey: '', enabled: true, type: 'cloud' },
  { id: 'ollama', name: 'Ollama (Local)', model: 'llama3', baseUrl: 'http://127.0.0.1:11434', apiKey: 'none', enabled: true, type: 'local' },
  { id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', apiKey: '', enabled: false, type: 'cloud' },
  { id: 'anthropic', name: 'Anthropic', model: 'claude-3-5-sonnet-20240620', apiKey: '', enabled: false, type: 'cloud' },
  { id: 'groq', name: 'Groq', model: 'llama-3.1-8b-instant', baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', enabled: false, type: 'cloud' },
  { id: 'openrouter', name: 'OpenRouter', model: 'meta-llama/llama-3.1-8b-instruct:free', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', enabled: false, type: 'cloud' }
];

export function AIGateway({ onClose }: { onClose: () => void }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeProviderId, setActiveProviderId] = useState('gemini');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [fetchingModelsId, setFetchingModelsId] = useState<string | null>(null);
  
  const [tab, setTab] = useState<'providers' | 'models'>('providers');
  
  // Model Discovery State
  const [discoveredModels, setDiscoveredModels] = useState<any[]>([]);
  const [ollamaPullName, setOllamaPullName] = useState('');
  const [isPulling, setIsPulling] = useState(false);

  const handlePullOllama = async () => {
    if (!ollamaPullName) return;
    setIsPulling(true);
    try {
      const resp = await fetch('/api/pull-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: ollamaPullName, baseUrl: providers.find(p => p.id === 'ollama')?.baseUrl })
      });
      if (resp.ok) {
        alert('Successfully pulled ' + ollamaPullName);
        setOllamaPullName('');
        // re-fetch 
        const provider = providers.find(p => p.id === 'ollama');
        if (provider) handleFetchModels(provider);
      } else {
        alert('Failed to pull');
      }
    } catch(e: any) { alert(e.message); }
    setIsPulling(false);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all'|'local'|'cloud'>('all');

  useEffect(() => {
    const stored = localStorage.getItem('ai_providers');
    if (stored) {
      setProviders(JSON.parse(stored));
    } else {
      setProviders(DEFAULT_PROVIDERS);
    }
    const currentProv = localStorage.getItem('active_ai_provider');
    if (currentProv) {
      setActiveProviderId(currentProv);
    }
  }, []);

  const saveSettings = (newProviders: ProviderConfig[], activeId: string) => {
    setProviders(newProviders);
    setActiveProviderId(activeId);
    localStorage.setItem('ai_providers', JSON.stringify(newProviders));
    localStorage.setItem('active_ai_provider', activeId);
  };

  const updateProvider = (id: string, updates: Partial<ProviderConfig>) => {
    const updated = providers.map(p => p.id === id ? { ...p, ...updates } : p);
    saveSettings(updated, activeProviderId);
  };

  const handleTestConnection = async (provider: ProviderConfig) => {
    setTestingId(provider.id);
    try {
      const resp = await fetch('/api/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          model: provider.model,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey || "dummy"
        })
      });

      const res = await resp.json();
      if (resp.ok) {
        alert(`Success! Pinged \${provider.name} \${provider.model}. Token count: \${res.usage?.totalTokens || 0}`);
      } else {
        alert(`Connection failed: \${res.error}`);
      }
    } catch (err: any) {
      alert(`Error testing connection: \${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleFetchModels = async (provider: ProviderConfig) => {
    setFetchingModelsId(provider.id);
    try {
      const resp = await fetch('/api/provider-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey || "dummy"
        })
      });

      const res = await resp.json();
      if (resp.ok && res.models) {
        // Merge with existing discovered models
        setDiscoveredModels(prev => {
          const others = prev.filter(m => m.provider !== provider.id);
          return [...others, ...res.models.map((m: any) => ({ ...m, providerType: provider.type }))];
        });
        setTab('models');
      } else {
        alert(`Failed to fetch models: \${res.error}`);
      }
    } catch (err: any) {
      alert(`Error fetching models: \${err.message}`);
    } finally {
      setFetchingModelsId(null);
    }
  };

  const setAsActiveModel = (modelId: string, providerId: string) => {
    updateProvider(providerId, { model: modelId });
    setActiveProviderId(providerId);
    saveSettings(providers.map(p => p.id === providerId ? { ...p, model: modelId } : p), providerId);
    setTab('providers');
  };

  const currentModelsView = discoveredModels.filter(m => {
    if (selectedFilter !== 'all' && m.providerType !== selectedFilter) return false;
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !m.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 ">
      <div className="bg-white/95 backdrop-blur-xl max-w-4xl w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-slate-200/60 ring-1 ring-black/5">
        
        {/* Header Options */}
        <div className="px-6 py-5 border-b border-slate-200/50 flex items-center justify-between bg-slate-50/50">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              AI Gateways & Models
            </h2>
            <p className="text-sm text-slate-500 font-medium">Manage Cloud & Local AI Infrastructure</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button 
              onClick={() => setTab('providers')}
              className={cn("px-4 py-1.5 text-sm font-semibold rounded-md transition-all", tab === 'providers' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Gateways
            </button>
            <button 
              onClick={() => setTab('models')}
              className={cn("px-4 py-1.5 text-sm font-semibold rounded-md transition-all", tab === 'models' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Model Registry
            </button>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          
          {tab === 'providers' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 flex gap-3 text-amber-800 text-sm leading-relaxed shadow-sm">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p>
                  Connect <strong>Local Ollama</strong> instances for privacy and offline usage, or configure <strong>Cloud Providers</strong>. API Keys are stored locally in your browser.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {providers.map(provider => (
                  <div 
                    key={provider.id} 
                    className={cn(
                      "border rounded-xl p-5 transition-all bg-white relative overflow-hidden",
                      activeProviderId === provider.id ? "border-indigo-500 ring-1 ring-indigo-500/50 shadow-md" : "border-slate-200 hover:border-indigo-300 shadow-sm"
                    )}
                  >
                    {activeProviderId === provider.id && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    )}
                    
                    <div className="flex gap-3 mb-4">
                       <button 
                        onClick={() => saveSettings(providers, provider.id)}
                        className={cn(
                          "w-5 h-5 shrink-0 rounded-full border flex flex-col items-center justify-center mt-0.5 transition-colors",
                           activeProviderId === provider.id ? "bg-indigo-600 border-indigo-600" : "border-slate-300 hover:border-indigo-500"
                        )}
                      >
                        {activeProviderId === provider.id && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 tracking-tight">{provider.name}</h3>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase",
                            provider.type === 'local' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {provider.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3.5 pl-8">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model ID</label>
                        <input 
                          className="w-full text-sm border border-slate-200 rounded-md shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 font-mono text-slate-800"
                          value={provider.model}
                          onChange={(e) => updateProvider(provider.id, { model: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Key className="w-3 h-3" /> API Key
                        </label>
                        <input 
                          type="password"
                          className="w-full text-sm border border-slate-200 rounded-md shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 font-mono text-slate-800"
                          value={provider.apiKey}
                          onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                          placeholder={provider.id === 'gemini' ? "Blank to use server env key" : (provider.type === 'local' ? "Usually not needed" : "sk-...")}
                        />
                      </div>

                      {(provider.type === 'local' || ['openai', 'groq', 'openrouter'].includes(provider.id)) && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base URL</label>
                          <input 
                            className="w-full text-sm border border-slate-200 rounded-md shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 font-mono text-slate-500 bg-slate-50"
                            value={provider.baseUrl || ""}
                            onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
                            placeholder={provider.type === 'local' ? "http://127.0.0.1:11434" : "https://api..."}
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button 
                          onClick={() => handleFetchModels(provider)}
                          disabled={fetchingModelsId === provider.id || (!provider.apiKey && provider.id !== 'gemini' && provider.type !== 'local')}
                          className="text-[11px] font-bold px-3 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {fetchingModelsId === provider.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                          Fetch Models
                        </button>
                        <button 
                          onClick={() => handleTestConnection(provider)}
                          disabled={testingId === provider.id || (!provider.apiKey && provider.id !== 'gemini' && provider.type !== 'local')}
                          className="text-[11px] font-bold px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {testingId === provider.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                          Test
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'models' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  placeholder="Pull new Ollama model (e.g. llama3)"
                  className="flex-1 border px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 rounded text-sm"
                  value={ollamaPullName}
                  onChange={e => setOllamaPullName(e.target.value)}
                />
                <button 
                  onClick={handlePullOllama}
                  disabled={isPulling || !ollamaPullName}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-bold shadow-sm"
                >
                  {isPulling ? 'Downloading...' : 'Pull ↓'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search discovered models..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <select 
                  value={selectedFilter}
                  onChange={e => setSelectedFilter(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Models</option>
                  <option value="local">Local Only (Ollama)</option>
                  <option value="cloud">Cloud Only</option>
                </select>
              </div>

              {discoveredModels.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Database className="w-12 h-12 mb-3 text-slate-300" />
                  <h3 className="text-lg font-bold text-slate-700">No Models Fetched</h3>
                  <p className="text-sm">Go back to the Gateways tab and click 'Fetch Models' on a provider.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pb-4">
                  {currentModelsView.map((model, idx) => (
                    <div key={`\${model.provider}-\${model.id}-\${idx}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-800 text-sm break-words leading-tight">{model.name}</h4>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase whitespace-nowrap",
                            model.providerType === 'local' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {model.providerType === 'local' ? 'Local' : 'Cloud'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{model.provider}</span>
                          {model.contextLength && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{(model.contextLength / 1000).toFixed(0)}k ctx</span>}
                          {model.size && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{model.size}</span>}
                          {model.quantization && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{model.quantization}</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => setAsActiveModel(model.id, model.provider)}
                        className="w-full py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Set as Active Model
                      </button>
                    </div>
                  ))}
                  {currentModelsView.length === 0 && (
                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">No models match your search.</div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-md">
            <Check className="w-4 h-4" /> Save & Close
          </button>
        </div>

      </div>
    </div>
  );
}
