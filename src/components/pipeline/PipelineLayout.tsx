"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { StageCard } from "./StageCard";
import { RunControls } from "./RunControls";
import { useRealtimeProgress } from "@/lib/hooks/useRealtimeProgress";

const STAGES = [
  { id: 1, name: "Client Discovery", description: "3-LLM structured interview with founding team" },
  { id: 2, name: "Consumer Interviews", description: "30 depth interviews with adaptive follow-ups" },
  { id: 3, name: "Survey Design", description: "AI-assisted instrument generation from themes" },
  { id: 4, name: "Survey Responses", description: "90 synthetic respondents across 5 segments" },
  { id: 5, name: "Data Analysis", description: "Statistical tests, bias detection, quality scoring" },
  { id: 6, name: "Validation Report", description: "Quality grade, confidence intervals, audit trail" },
];

type StageStatus = "locked" | "ready" | "running" | "completed" | "error";

interface StageState {
  status: StageStatus;
  progress: number;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
  tokensUsed: number;
  costEstimate: number;
}

interface PipelineRun {
  id: string;
  mode: string;
  status: string;
  current_stage: number;
  started_at: string;
  completed_at: string | null;
  total_cost: number | null;
}

const defaultStageState = (): StageState => ({
  status: "locked",
  progress: 0,
  message: "",
  startedAt: null,
  completedAt: null,
  tokensUsed: 0,
  costEstimate: 0,
});

export function PipelineLayout() {
  const [runId, setRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "demo" | "live">("idle");
  const [apiKey, setApiKey] = useState("");
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [stages, setStages] = useState<Record<number, StageState>>(
    Object.fromEntries(STAGES.map(s => [s.id, defaultStageState()]))
  );
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [liveRuns, setLiveRuns] = useState<PipelineRun[]>([]);
  const [demoRuns, setDemoRuns] = useState<PipelineRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<string | null>(null);
  const autoRunTriggered = useRef(false);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  // Fetch previous runs on mount (no auto-reconnect — landing page always starts fresh)
  useEffect(() => {
    fetch("/api/pipeline/runs")
      .then(res => res.json())
      .then(data => {
        setLiveRuns(data.liveRuns || []);
        setDemoRuns(data.demoRuns || []);
      })
      .catch(() => {});
  }, []);

  const updateStage = useCallback((stageId: number, update: Partial<StageState>) => {
    setStages(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], ...update },
    }));
  }, []);

  // Wire up realtime progress updates from Supabase
  useRealtimeProgress(runId, (progress) => {
    const statusMap: Record<string, StageStatus> = {
      pending: "locked",
      running: "running",
      completed: "completed",
      error: "error",
    };
    const mappedStatus = statusMap[progress.status] || (progress.status as StageStatus);

    updateStage(progress.stage, {
      status: mappedStatus,
      progress: progress.progress_pct,
      message: progress.message || "",
      startedAt: progress.started_at || null,
      completedAt: progress.completed_at || null,
      tokensUsed: progress.tokens_used ?? 0,
      costEstimate: progress.cost_estimate ? parseFloat(String(progress.cost_estimate)) : 0,
    });

    if (mappedStatus === "completed") {
      setExpandedStage(progress.stage);
      if (progress.stage < 6) {
        setStages(prev => {
          const next = progress.stage + 1;
          if (prev[next]?.status === "locked") {
            return { ...prev, [next]: { ...prev[next], status: "ready" } };
          }
          return prev;
        });
      } else {
        setRunCompletedAt(new Date().toISOString());
      }
    }
  });

  const handleStart = useCallback(async (selectedMode: "demo" | "live", key?: string) => {
    setMode(selectedMode);
    if (key) setApiKey(key);
    setRunStartedAt(new Date().toISOString());
    setRunCompletedAt(null);

    try {
      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const data = await res.json();
      setRunId(data.runId);

      if (selectedMode === "demo") {
        await fetch("/api/pipeline/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: data.runId }),
        });
        STAGES.forEach(s => updateStage(s.id, { status: "completed", progress: 100 }));
        setExpandedStage(1);
      } else {
        updateStage(1, { status: "ready" });
      }
    } catch (err) {
      console.error("Failed to start pipeline:", err);
    }
  }, [updateStage]);

  const handleRunStage = useCallback(async (stageId: number) => {
    if (!runId) return;
    updateStage(stageId, { status: "running", progress: 0, message: "Starting...", startedAt: new Date().toISOString() });

    try {
      // Fire-and-forget: kick off the stage, then let Supabase realtime
      // subscription handle all progress/completion/error updates.
      // This avoids browser/edge timeout on long-running stages (2-5 min).
      fetch(`/api/pipeline/${stageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, openrouterKey: apiKey }),
      }).catch(() => {
        // Connection may drop on long stages — that's fine,
        // the server continues and realtime updates handle the rest.
      });
      return true;
    } catch (err) {
      updateStage(stageId, { status: "error", message: String(err) });
      return false;
    }
  }, [runId, apiKey, updateStage]);

  const handleAutoRun = useCallback(async () => {
    setIsAutoRunning(true);
    for (const stage of STAGES) {
      // Read latest state via ref (not stale closure)
      const current = stagesRef.current[stage.id];
      if (current?.status === "completed") continue;
      // Skip if not actionable (must be ready, error, or stage 1)
      if (current?.status !== "ready" && current?.status !== "error" && stage.id !== 1) continue;

      const success = await handleRunStage(stage.id);
      if (!success) break;

      // Wait for this stage to complete (or error) before moving on
      await new Promise<void>((resolve) => {
        const check = () => {
          const s = stagesRef.current[stage.id]?.status;
          if (s === "completed" || s === "error") {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        };
        check();
      });

      // If stage errored, stop auto-run
      if (stagesRef.current[stage.id]?.status === "error") break;
    }
    setIsAutoRunning(false);
  }, [handleRunStage]);

  // Listen for auto-run event from RunControls
  useEffect(() => {
    const handler = () => { autoRunTriggered.current = true; };
    window.addEventListener("pipeline-auto-run", handler);
    return () => window.removeEventListener("pipeline-auto-run", handler);
  }, []);

  // Trigger auto-run when pipeline starts and auto-run was requested
  useEffect(() => {
    if (autoRunTriggered.current && mode === "live" && runId) {
      autoRunTriggered.current = false;
      handleAutoRun();
    }
  }, [mode, runId, handleAutoRun]);

  // Load a previous run
  const handleLoadRun = useCallback(async (run: PipelineRun) => {
    setRunId(run.id);
    setMode(run.mode as "demo" | "live");
    setShowHistory(false);
    setRunStartedAt(run.started_at);
    setRunCompletedAt(run.completed_at);

    // Fetch stage progress for this run
    try {
      const res = await fetch(`/api/pipeline/status/${run.id}`);
      const data = await res.json();

      if (data.stages) {
        const newStages: Record<number, StageState> = {};
        for (const sp of data.stages) {
          const statusMap: Record<string, StageStatus> = {
            pending: "locked",
            running: "running",  // Was "ready" — now correctly shows as running
            completed: "completed",
            error: "error",
          };
          newStages[sp.stage] = {
            status: statusMap[sp.status] || "locked",
            progress: sp.progress_pct || 0,
            message: sp.message || sp.error_message || "",
            startedAt: sp.started_at || null,
            completedAt: sp.completed_at || null,
            tokensUsed: sp.tokens_used ?? 0,
            costEstimate: sp.cost_estimate ? parseFloat(String(sp.cost_estimate)) : 0,
          };
        }
        // Make the first actionable stage "ready"
        let foundReady = false;
        for (let i = 1; i <= 6; i++) {
          if (!newStages[i]) {
            newStages[i] = defaultStageState();
          }
          // First non-completed, non-running stage after completed ones becomes "ready"
          if (!foundReady && newStages[i].status !== "completed" && newStages[i].status !== "running") {
            // Only mark ready if all previous stages are completed or running
            const allPriorDone = Array.from({ length: i - 1 }, (_, j) => j + 1)
              .every(j => newStages[j]?.status === "completed" || newStages[j]?.status === "running");
            if (allPriorDone && newStages[i].status !== "error") {
              newStages[i].status = "ready";
              foundReady = true;
            } else if (newStages[i].status === "error") {
              // Errored stages stay as error but are re-runnable via the retry button
              foundReady = true; // Don't ready anything after an error
            }
          }
        }
        setStages(newStages);
      }

      // Expand the last completed stage
      const lastCompleted = data.stages
        ?.filter((s: any) => s.status === "completed")
        .map((s: any) => s.stage)
        .sort((a: number, b: number) => b - a)[0];
      setExpandedStage(lastCompleted || 1);
    } catch {
      console.error("Failed to load run status");
    }
  }, []);

  const handleReset = useCallback(() => {
    setRunId(null);
    setMode("idle");
    setApiKey("");
    setExpandedStage(null);
    setIsAutoRunning(false);
    setRunStartedAt(null);
    setRunCompletedAt(null);
    autoRunTriggered.current = false;
    setStages(
      Object.fromEntries(STAGES.map(s => [s.id, defaultStageState()]))
    );
    // Refresh history
    fetch("/api/pipeline/runs")
      .then(res => res.json())
      .then(data => { setLiveRuns(data.liveRuns || []); setDemoRuns(data.demoRuns || []); })
      .catch(() => {});
  }, []);

  const hasReadyStage = Object.values(stages).some(s => s.status === "ready");
  const hasActionableStage = Object.values(stages).some(s => s.status === "ready" || s.status === "error");

  // Computed values
  const totalCost = Object.values(stages).reduce((sum, s) => sum + s.costEstimate, 0);
  const totalTokens = Object.values(stages).reduce((sum, s) => sum + s.tokensUsed, 0);
  const completedStages = Object.values(stages).filter(s => s.status === "completed").length;
  const allCompleted = completedStages === 6;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatDuration = (startIso: string | null, endIso: string | null) => {
    if (!startIso) return null;
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const secs = Math.round((end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
  };


  const RunRow = ({ run, onLoad }: { run: PipelineRun; onLoad: (run: PipelineRun) => void }) => (
    <button
      onClick={() => onLoad(run)}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/80 border border-gray-800/60 hover:border-gray-600 rounded-xl transition-all text-left group hover:bg-gray-900"
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          run.status === "completed" ? "bg-emerald-500" :
          run.status === "error" ? "bg-red-500" :
          "bg-yellow-500"
        }`} />
        <div>
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            {run.mode === "demo" ? "Demo" : "Live"} run
          </span>
          <span className="text-xs text-gray-700 ml-2 font-mono">
            {run.id.slice(0, 8)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-600">
          {run.current_stage}/6
        </span>
        {run.total_cost != null && run.total_cost > 0 && (
          <span className="text-xs text-emerald-500/80 font-mono">
            ${Number(run.total_cost).toFixed(2)}
          </span>
        )}
        {run.started_at && run.completed_at && (
          <span className="text-xs text-gray-600 font-mono">
            {formatDuration(run.started_at, run.completed_at)}
          </span>
        )}
        <span className="text-xs text-gray-700">
          {formatDate(run.started_at)}
        </span>
        <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      {mode === "idle" && (
        <div className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-gray-950 to-gray-950" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/5 rounded-full blur-3xl" />

          <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-12">
            <div className="text-center animate-fade-in-up">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/50 border border-blue-700/30 text-blue-400 text-xs font-medium mb-6 backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                STAMP Methodology &middot; 3-Model Triangulation
              </div>

              {/* Title */}
              <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
                <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">AI-Powered</span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Market Research</span>
              </h1>

              <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed mb-3">
                Simulated consumer research pipeline for <span className="text-white font-medium">Neo Smart Living</span> &mdash;
                from founder interviews to validated survey insights in 6 automated stages.
              </p>

              <div className="flex flex-wrap justify-center gap-3 mb-10">
                <Link href="/benchmark" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-600/30 hover:border-cyan-500/50 transition-all duration-200 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Benchmark Validation
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/methodology" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-all duration-200 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  STAMP Methodology
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/genai" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 hover:border-emerald-500/50 transition-all duration-200 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  GenAI Documentation
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/insights" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 hover:border-violet-500/50 transition-all duration-200 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Insights
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/deliverables" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-600/30 hover:border-amber-500/50 transition-all duration-200 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Deliverables
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/config" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-600/20 border border-gray-500/30 text-gray-300 text-sm font-medium hover:bg-gray-600/30 hover:border-gray-500/50 transition-all duration-200 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Config
                </Link>
              </div>

              {/* Pipeline Overview Cards */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-w-5xl mx-auto mb-10">
                {STAGES.map((s, i) => (
                  <div key={s.id} className="group relative" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="bg-gray-900/80 border border-gray-800/60 rounded-lg p-3 text-center hover:border-blue-700/40 hover:bg-blue-950/20 transition-all duration-200">
                      <div className="text-lg font-bold text-gray-500 group-hover:text-blue-400 transition-colors">{s.id}</div>
                      <div className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors leading-tight mt-0.5">{s.name}</div>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-1.5 w-3 h-px bg-gray-700" />
                    )}
                  </div>
                ))}

              </div>
            </div>

            {/* Run Controls */}
            <RunControls
              mode={mode}
              onStart={handleStart}
              onReset={handleReset}
              onAutoRun={undefined}
              isAutoRunning={isAutoRunning}
            />

            {/* Previous Runs — separated by mode */}
            {(liveRuns.length > 0 || demoRuns.length > 0) && (
              <div className="mt-8 flex flex-col items-center">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1.5"
                >
                  <svg className={`w-3 h-3 transition-transform duration-200 ${showHistory ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  {liveRuns.length + demoRuns.length} previous run{liveRuns.length + demoRuns.length !== 1 ? "s" : ""}
                </button>

                {showHistory && (
                  <div className="mt-3 w-full max-w-lg space-y-4 animate-fade-in-down">
                    {/* Live Runs */}
                    {liveRuns.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Live Runs</span>
                          <span className="text-xs text-gray-700">({liveRuns.length})</span>
                        </div>
                        <div className="space-y-2">
                          {liveRuns.map(run => (
                            <RunRow key={run.id} run={run} onLoad={handleLoadRun} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Demo Runs */}
                    {demoRuns.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Demo Runs</span>
                          <span className="text-xs text-gray-700">({demoRuns.length})</span>
                        </div>
                        <div className="space-y-2">
                          {demoRuns.map(run => (
                            <RunRow key={run.id} run={run} onLoad={handleLoadRun} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Active Pipeline View ─────────────────────────────────────── */}
      {mode !== "idle" && (
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Compact header for active runs */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">AYTM Pipeline</h1>
              <span className="text-[10px] font-mono text-gray-600 bg-gray-800/80 px-2 py-0.5 rounded">
                {runId?.slice(0, 8)}
              </span>
            </div>
            <RunControls
              mode={mode}
              onStart={handleStart}
              onReset={handleReset}
              onAutoRun={!allCompleted && hasActionableStage ? handleAutoRun : undefined}
              isAutoRunning={isAutoRunning}
            />
          </div>

          {/* Pipeline Progress Summary */}
          <div className="mb-6">
            <div className="flex items-center gap-1">
              {STAGES.map((s) => {
                const st = stages[s.id]?.status;
                const bg = st === "completed" ? "bg-emerald-500" : st === "running" ? "bg-blue-500 animate-pulse" : st === "error" ? "bg-red-500" : "bg-gray-800";
                return (
                  <div key={s.id} className="flex-1 flex items-center gap-1">
                    <div className={`h-1.5 flex-1 rounded-full ${bg} transition-all duration-500`} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-600">{completedStages}/6 stages</span>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="font-mono">{formatDuration(runStartedAt, runCompletedAt) || "..."}</span>
                {totalCost > 0 && <span className="text-emerald-500/70 font-mono">${totalCost.toFixed(4)}</span>}
                {totalTokens > 0 && <span className="font-mono">{totalTokens.toLocaleString()} tokens</span>}
              </div>
            </div>
          </div>

          {/* Stage Cards */}
          <div className="space-y-3 stagger-children">
            {STAGES.map((stage) => (
              <StageCard
                key={stage.id}
                stage={stage}
                state={stages[stage.id]}
                isExpanded={expandedStage === stage.id}
                runId={runId}
                onRun={() => handleRunStage(stage.id)}
                onToggle={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
              />
            ))}
          </div>

          {/* Completion banner with navigation */}
          {allCompleted && (
            <div className="mt-8 animate-fade-in-up">
              <div className="bg-gradient-to-r from-emerald-950/30 to-blue-950/30 border border-emerald-700/30 rounded-xl p-5">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-emerald-300 font-medium">Pipeline Complete</span>
                  {mode === "demo" && <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400 text-[10px] font-medium">DEMO DATA</span>}
                  {runStartedAt && <span className="text-xs text-emerald-500/60 font-mono">{formatDuration(runStartedAt, runCompletedAt)}</span>}
                  {totalCost > 0 && <span className="text-xs text-emerald-500/60 font-mono">${totalCost.toFixed(4)}</span>}
                </div>

                <p className="text-xs text-gray-400 text-center mb-4">
                  {mode === "demo"
                    ? "Pre-generated data loaded across all 6 stages. Click any stage above to explore, or jump to a key page:"
                    : "All 6 stages executed successfully. Explore the results:"}
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={`/stage/2?runId=${runId}`} className="px-4 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all">
                    Interviews &amp; Emotions
                  </Link>
                  <Link href="/benchmark" className="px-4 py-2 rounded-lg bg-cyan-900/40 border border-cyan-700/50 text-sm text-cyan-300 hover:text-white hover:border-cyan-500 transition-all font-medium">
                    Benchmark Validation
                  </Link>
                  <Link href={`/stage/5?runId=${runId}`} className="px-4 py-2 rounded-lg bg-blue-900/40 border border-blue-700/50 text-sm text-blue-300 hover:text-white hover:border-blue-500 transition-all font-medium">
                    Analysis &amp; STAMP
                  </Link>
                  <Link href={`/stage/6?runId=${runId}`} className="px-4 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all">
                    Validation Report
                  </Link>
                  <Link href="/insights" className="px-4 py-2 rounded-lg bg-violet-900/40 border border-violet-700/50 text-sm text-violet-300 hover:text-white hover:border-violet-500 transition-all font-medium">
                    Key Insights
                  </Link>
                  <Link href="/methodology" className="px-4 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all">
                    Methodology
                  </Link>
                  <Link href="/genai" className="px-4 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all">
                    GenAI Docs
                  </Link>
                  <Link href="/deliverables" className="px-4 py-2 rounded-lg bg-amber-900/40 border border-amber-700/50 text-sm text-amber-300 hover:text-white hover:border-amber-500 transition-all font-medium">
                    Deliverables
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
