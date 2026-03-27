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
  const [previousRuns, setPreviousRuns] = useState<PipelineRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<string | null>(null);
  const autoRunTriggered = useRef(false);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  // Fetch previous runs on mount
  useEffect(() => {
    fetch("/api/pipeline/runs")
      .then(res => res.json())
      .then(data => setPreviousRuns(data.runs || []))
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
      if (current?.status !== "ready" && stage.id !== 1) continue;

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
            running: "ready",
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
        // If a stage errored or is pending, make the next non-completed stage "ready"
        for (let i = 1; i <= 6; i++) {
          if (!newStages[i]) {
            newStages[i] = defaultStageState();
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
      .then(data => setPreviousRuns(data.runs || []))
      .catch(() => {});
  }, []);

  const hasReadyStage = Object.values(stages).some(s => s.status === "ready");

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-medium mb-4">
          STAMP Methodology
        </div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          AYTM Research Pipeline
        </h1>
        <p className="text-gray-400 text-lg">Neo Smart Living &mdash; Tahoe Mini Market Research</p>
        <p className="text-gray-500 text-sm mt-1">3-model triangulation &middot; 6 automated stages &middot; Full audit trail</p>
        <Link href="/methodology" className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors">
          View Bias Mitigation Methodology →
        </Link>
      </header>

      <RunControls
        mode={mode}
        onStart={handleStart}
        onReset={handleReset}
        onAutoRun={mode === "live" && hasReadyStage ? handleAutoRun : undefined}
        isAutoRunning={isAutoRunning}
      />

      {/* Previous runs — show when idle and runs exist */}
      {mode === "idle" && previousRuns.length > 0 && (
        <div className="mt-6 flex flex-col items-center">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showHistory ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {previousRuns.length} previous run{previousRuns.length !== 1 ? "s" : ""}
          </button>

          {showHistory && (
            <div className="mt-3 w-full max-w-lg space-y-2 animate-in slide-in-from-top-2 duration-200">
              {previousRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => handleLoadRun(run)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      run.status === "completed" ? "bg-green-500" :
                      run.status === "error" ? "bg-red-500" :
                      "bg-yellow-500"
                    }`} />
                    <div>
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                        {run.mode === "demo" ? "Demo" : "Live"} run
                      </span>
                      <span className="text-xs text-gray-600 ml-2">
                        {run.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {run.current_stage}/6 stages
                    </span>
                    {run.total_cost != null && run.total_cost > 0 && (
                      <span className="text-xs text-emerald-500 font-mono">
                        ${Number(run.total_cost).toFixed(2)}
                      </span>
                    )}
                    {run.started_at && run.completed_at && (
                      <span className="text-xs text-gray-500 font-mono">
                        {formatDuration(run.started_at, run.completed_at)}
                      </span>
                    )}
                    <span className="text-xs text-gray-600">
                      {formatDate(run.started_at)}
                    </span>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 space-y-4">
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

      {mode !== "idle" && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gray-900 border border-gray-800 text-xs text-gray-500">
            <span>Run ID: <span className="font-mono text-gray-400">{runId?.slice(0, 8)}...</span></span>
            <span className="w-px h-3 bg-gray-700" />
            <span>Mode: <span className="text-gray-400">{mode}</span></span>
            <span className="w-px h-3 bg-gray-700" />
            <span>Duration: <span className="text-gray-400 font-mono">{formatDuration(runStartedAt, runCompletedAt) || "..."}</span></span>
            {totalCost > 0 && (
              <>
                <span className="w-px h-3 bg-gray-700" />
                <span>Cost: <span className="text-emerald-400 font-mono">${totalCost.toFixed(4)}</span></span>
              </>
            )}
            {totalTokens > 0 && (
              <>
                <span className="w-px h-3 bg-gray-700" />
                <span>Tokens: <span className="text-gray-400 font-mono">{totalTokens.toLocaleString()}</span></span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
