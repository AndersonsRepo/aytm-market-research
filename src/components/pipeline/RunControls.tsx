"use client";

import Link from "next/link";

import { useState } from "react";

interface RunControlsProps {
  mode: "idle" | "demo" | "live";
  onStart: (mode: "demo" | "live", apiKey?: string) => void;
  onReset: () => void;
  onAutoRun?: () => void;
  isAutoRunning?: boolean;
}

export function RunControls({ mode, onStart, onReset, onAutoRun, isAutoRunning }: RunControlsProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [autoRunOnStart, setAutoRunOnStart] = useState(true);

  if (mode !== "idle") {
    return (
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-gray-900 border border-gray-800">
          {/* Mode indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${mode === "demo" ? "bg-green-500" : "bg-blue-500"} ${isAutoRunning ? "animate-pulse" : ""}`} />
            <span className="text-sm font-medium text-white">
              {mode === "demo" ? "Demo Mode" : isAutoRunning ? "Running Full Pipeline..." : "Live Mode"}
            </span>
          </div>

          <span className="w-px h-5 bg-gray-700" />

          {/* Auto-run button (live mode only when stages are ready and not already running) */}
          {onAutoRun && !isAutoRunning && (
            <button
              onClick={onAutoRun}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all shadow-lg shadow-purple-900/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Remaining Stages
            </button>
          )}

          {isAutoRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-300">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Auto-running...
            </div>
          )}

          <button
            onClick={onReset}
            disabled={isAutoRunning}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-4">
        <button
          onClick={() => onStart("demo")}
          className="group relative px-8 py-3.5 rounded-xl font-medium transition-all overflow-hidden bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg shadow-emerald-900/20"
        >
          <div className="relative flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Load Demo Data
          </div>
        </button>
        <button
          onClick={() => setShowKeyInput(!showKeyInput)}
          className={`group relative px-8 py-3.5 rounded-xl font-medium transition-all overflow-hidden ${
            showKeyInput
              ? "bg-blue-700 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/20"
          }`}
        >
          <div className="relative flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Start Live Run
          </div>
        </button>
        <Link
          href="/config"
          className="group relative px-4 py-3.5 rounded-xl font-medium transition-all overflow-hidden bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600"
          title="Pipeline Configuration"
        >
          <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>

      {showKeyInput && (
        <div className="w-full max-w-lg animate-in slide-in-from-top-2 duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>Enter your OpenRouter API key to run live LLM calls</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="sk-or-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter" && apiKey) onStart("live", apiKey); }}
              />
            </div>
            {/* Auto-run toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRunOnStart}
                onChange={(e) => setAutoRunOnStart(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400">Run full pipeline automatically</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (apiKey) onStart(autoRunOnStart ? "live" : "live", apiKey);
                  // Signal auto-run preference via a custom attribute on the event
                  if (apiKey && autoRunOnStart) {
                    // Small delay to let state settle, then trigger auto-run
                    setTimeout(() => {
                      const event = new CustomEvent("pipeline-auto-run");
                      window.dispatchEvent(event);
                    }, 500);
                  }
                }}
                disabled={!apiKey}
                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all shadow-lg shadow-purple-900/20"
              >
                {autoRunOnStart ? "⚡ Run Full Pipeline" : "Begin (Stage by Stage)"}
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Estimated cost: ~$0.50–$1.00 per full pipeline run &middot; Uses GPT-4.1-mini, Gemini-2.5-Flash, Claude-Sonnet-4.6
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 max-w-md text-center leading-relaxed">
        Demo mode loads pre-generated data instantly. Live mode calls 3 LLMs via OpenRouter for real-time triangulated research.
      </p>
    </div>
  );
}
