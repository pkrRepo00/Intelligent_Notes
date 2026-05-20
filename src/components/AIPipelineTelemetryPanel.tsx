import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Cpu, Layers, RefreshCw, Terminal, HelpCircle, CheckCircle2 } from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface TelemetryStats {
  queueSize: number;
  activeCalls: number;
  tokensAvailable: number;
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  cacheHits: number;
  totalCalls: number;
  rateLimit429Errors: number;
  totalFallbackCount: number;
  totalRetries: number;
  recentLogs: LogEntry[];
}

export function AIPipelineTelemetryPanel() {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);

  async function fetchTelemetry() {
    try {
      const res = await fetch("/api/ai-telemetry");
      if (!res.ok) throw new Error("Could not fetch telemetry statistics");
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Statistics disconnected.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTelemetry();
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTelemetry();
    }, 1500);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  function getCircuitBadgeColor(state: string) {
    switch (state) {
      case "CLOSED":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "OPEN":
        return "text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse";
      case "HALF_OPEN":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      default:
        return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
    }
  }

  return (
    <div className="w-full bg-zinc-950/85 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md mb-6 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
            <Activity className="w-4 animate-pulse text-indigo-400" />
          </div>
          <div>
            <h3 className="text-zinc-100 font-semibold text-sm tracking-tight flex items-center gap-2">
              AI Resilience Pipeline Control Panel
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Model: gemini-3.5-flash with smart automatic rate limit pacing</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition px-2.5 py-1.5 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900 flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showExplanation ? "Hide Explanation" : "How it Works"}
          </button>
          <button
            onClick={() => {
              setAutoRefresh(!autoRefresh);
            }}
            className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition ${
              autoRefresh
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                : "text-zinc-500 border-zinc-800 bg-zinc-900 hover:text-zinc-400"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-400 animate-ping" : "bg-zinc-600"}`} />
            {autoRefresh ? "Live Syncing" : "Paused"}
          </button>
          <button
            onClick={fetchTelemetry}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
            title="Force refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Deep Dive Explanation Panel */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800 bg-zinc-900/10"
          >
            <div className="p-5 text-xs text-zinc-300 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="font-semibold text-zinc-100 uppercase tracking-wider text-[10px] text-indigo-400">Request Pacing Engine</p>
                <p>
                  To dodge the free tier quota blocks, our system schedules every outgoing Gemini request into an internal <strong>Priority Queue</strong> (processing Single Note Saves first, and Batch Takeout records last). 
                </p>
                <p>
                  A <strong>Token-Bucket</strong> rate-limiter prevents parallel bursts by leaking exactly 1 request per ticks (refilling every 5 seconds). Only cached prompts bypass this paced queue.
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-zinc-100 uppercase tracking-wider text-[10px] text-amber-500">Circuit Breaker & Fallback</p>
                <p>
                  If successive rate-limiting blocks (429 errors) happen, the <strong>Circuit Breaker rips open (OPEN state)</strong>. Instead of throwing crashes to users, requests bypass Google completely for 30s.
                </p>
                <p>
                  During active limits or circuit openings, an internal <strong>Deterministic Local Engine</strong> analyzes the content using local NLP heuristics (regex, title mapping, stop words, keywords) to respond instantly!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stats Grid */}
      {loading && !stats ? (
        <div className="p-8 flex items-center justify-center gap-2.5 text-xs text-zinc-500">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Loading pipeline telemetry...
        </div>
      ) : error ? (
        <div className="p-6 text-xs text-zinc-500 ">{error}</div>
      ) : (
        stats && (
          <div className="p-5 space-y-5">
            {/* Primary metrics and state */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Circuit Box */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500 font-medium">Circuit Breaker</span>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCircuitBadgeColor(stats.circuitState)}`}>
                    {stats.circuitState}
                  </div>
                </div>
                <div className="text-xl font-bold font-mono tracking-tight text-zinc-100">
                  {stats.circuitState === "CLOSED" ? "Healthy" : stats.circuitState === "OPEN" ? "Tripped" : "Probing"}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Handles quota exhaustion gracefully
                </div>
              </div>

              {/* Bucket tokens */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500 font-medium">Pacing Bucket Status</span>
                  <Layers className="w-3.5 text-indigo-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-zinc-100">{stats.tokensAvailable}</span>
                  <span className="text-xs text-zinc-500">/ 12 tokens</span>
                </div>
                {/* Visual meter */}
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${(stats.tokensAvailable / 12) * 100}%` }}
                  />
                </div>
              </div>

              {/* Queue Depth */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500 font-medium">Paced Queue Depth</span>
                  <Cpu className="w-3.5 text-zinc-400" />
                </div>
                <div className="text-xl font-bold font-mono text-zinc-100 flex items-center gap-2">
                  {stats.queueSize}
                  {stats.queueSize > 0 && (
                    <span className="text-xs text-indigo-400 font-medium animate-pulse">(Pacing...)</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  {stats.activeCalls} active pipeline task{stats.activeCalls === 1 ? "" : "s"}
                </div>
              </div>

              {/* Optimization Performance (Cache Efficiency) */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500 font-medium">Telemetry Cache Hits</span>
                  <CheckCircle2 className="w-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-zinc-100">
                  {stats.cacheHits}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  {stats.totalCalls > 0 ? `${Math.round((stats.cacheHits / (stats.totalCalls + stats.cacheHits)) * 100)}%` : "0%"} request bypass rate
                </div>
              </div>
            </div>

            {/* Sub-analytics counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/10 p-4 border border-zinc-800/60 rounded-xl divide-x divide-zinc-800/40">
              <div className="px-3">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Total Calls Sent</span>
                <span className="text-sm font-bold font-mono text-zinc-300 block mt-0.5">{stats.totalCalls}</span>
              </div>
              <div className="px-3">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Local Processing</span>
                <span className="text-sm font-bold font-mono text-emerald-400 block mt-0.5">{stats.totalFallbackCount}</span>
              </div>
              <div className="px-3">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">429 Rate Blocks</span>
                <span className="text-sm font-bold font-mono text-rose-400 block mt-0.5">{stats.rateLimit429Errors}</span>
              </div>
              <div className="px-3">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Backoffs & Retries</span>
                <span className="text-sm font-bold font-mono text-indigo-400 block mt-0.5">{stats.totalRetries}</span>
              </div>
            </div>

            {/* Scrollable Live Log Frame */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Terminal className="w-3.5 text-zinc-400" />
                <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest">AIEngine Console Logs (Server-Side Events)</span>
              </div>
              <div className="max-h-[140px] overflow-y-auto border border-zinc-800 bg-black/60 rounded-lg p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300 space-y-1">
                {stats.recentLogs && stats.recentLogs.length > 0 ? (
                  stats.recentLogs.map((log, index) => {
                    let logColor = "text-zinc-400";
                    if (log.level === "warn") logColor = "text-amber-400";
                    if (log.level === "error") logColor = "text-rose-400 font-medium";
                    return (
                      <div key={index} className="flex gap-2">
                        <span className="text-zinc-600 shrink-0">[{log.timestamp.split("T")[1].slice(0, 8)}]</span>
                        <span className={`${logColor}`}>{log.message}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-zinc-700 italic">No console logs reported. Trigger some AI tasks to begin logging...</div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
